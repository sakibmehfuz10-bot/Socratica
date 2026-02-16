
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
 * Main tutoring function using gemini-3-flash-preview for high-performance Socratic dialogue.
 */
export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  try {
    // Always use the recommended initialization with process.env.API_KEY directly as a named parameter.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const contents = history.map(msg => ({
      role: msg.sender === Sender.USER ? 'user' : 'model',
      parts: msg.parts.map(p => {
        if (p.inlineData) return { inlineData: p.inlineData };
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
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Directly access the .text property as per SDK documentation.
    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");

    return text;
  } catch (error: any) {
    console.error("Socratica Error:", error);
    const msg = error.message || "";
    
    // Handle specific API error conditions gracefully for the Socratic UI.
    if (error.status === 429) {
      return "API_ERROR: The logic gateway is congested (Quota Exceeded). Please wait a moment.";
    }
    
    if (msg.includes("Requested entity was not found") || msg.includes("API key")) {
      return "API_ERROR: Connection to the logic source failed. Please verify your logic source (API Key) configuration.";
    }
    
    return "API_ERROR: Socratica is momentarily disconnected. Please check your logic source connection.";
  }
};

/**
 * Transcribes student's audio queries into LaTeX-enriched text using the Flash model.
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    // Initialize SDK directly for transcription task.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: "Transcribe this math question accurately into text with LaTeX symbols." }
          ]
        }
      ]
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Failed:", error);
    return "";
  }
};