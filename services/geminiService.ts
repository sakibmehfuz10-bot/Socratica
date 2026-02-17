
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Sender } from "../types";

const SYSTEM_INSTRUCTION = `Role: You are "Socratica", a world-class Socratic math tutor.
Mission: Lead students to discovery through questioning, never by giving answers.

THE SOCRATIC PROTOCOL:
1. STRICT RULE: Never provide final answers, numerical solutions, or step-by-step full derivations. 
2. SCALING HINTS: If a student is stuck, provide a "bridge"—a leading question or a smaller sub-problem that uses the same logic.
3. REFUSAL POLICY: If asked for the answer, gently explain that mastery comes from the "beautiful struggle" of discovery. Use warm, encouraging language.
4. EMPATHY: Acknowledge frustration (e.g., "Logarithms can feel like learning a new language, but you're already translating the basics!").

DYNAMIC CAPABILITIES:
- GRAPHING: When visual intuition helps, use: [PLOT: expression, min, max] (Example: [PLOT: sin(x), -3.14, 3.14]).
- INTERACTIVITY: Wrap key concepts in \htmlClass{math-var}{...} (Example: $\htmlClass{math-var}{f(x)}$).

TONE & STYLE:
- Use KaTeX for ALL mathematical notation (always wrap in $ or $$).
- Use relatable analogies.
- Intellectual, patient, and highly encouraging.

DEEP DIVE HANDLING:
- If the system notes "DEEP DIVE mode", focus 100% on the conceptual intuition of the specific term clicked.`;

/**
 * Main tutoring function using gemini-3-flash-preview.
 * Switched from Pro to Flash to provide higher RPM and resolve 429 errors on Vercel free tier.
 */
export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  try {
    const MODEL_NAME = 'gemini-3-flash-preview';
    console.log(`Using Model: ${MODEL_NAME}`);
    
    // Initializing with the system-required process.env.API_KEY.
    // The vite.config.ts maps VITE_GEMINI_API_KEY to this variable.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Optimization: history windowing
    const optimizedHistory = history.slice(-8);

    const contents = optimizedHistory.map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.inlineData) {
          return { 
            inlineData: { 
              mimeType: p.inlineData.mimeType,
              data: p.inlineData.data
            } 
          };
        }
        return { text: p.text || '' };
      })
    }));

    if (isDeepDive) {
      contents.push({
        role: 'user',
        parts: [{ text: "(System Note: User is in DEEP DIVE mode. Focus only on conceptual intuition.)" }]
      });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.95,
        // Limiting output to save quota as requested.
        // We set thinkingBudget to 0 to prioritize speed and standard output for the Flash model.
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");

    return text;
  } catch (error: any) {
    console.error("Socratica Error:", error);
    const msg = error.message || "";
    const status = error.status || 0;
    
    if (status === 429 || msg.includes("429") || msg.includes("quota")) {
      return "API_ERROR: The logic gate is momentarily saturated. Since we are using Flash, this usually clears in 10-20 seconds. Please try again shortly.";
    }

    if (!process.env.API_KEY) {
      return "API_ERROR: Logic Source Connection missing. Please ensure VITE_GEMINI_API_KEY is set in your Vercel Environment Variables.";
    }
    
    return `API_ERROR: Socratica is momentarily disconnected (${status}). Please check your connection.`;
  }
};

/**
 * Transcribes student's audio queries using the faster Flash model.
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: audioBase64 } },
          { text: "Transcribe this math question accurately into text with LaTeX symbols. Only return the transcription." }
        ]
      },
      config: {
        maxOutputTokens: 500,
        temperature: 0.1 // Lower temperature for more accurate transcription
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Failed:", error);
    return "";
  }
};
