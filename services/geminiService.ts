
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
 * Main tutoring function using gemini-3-pro-preview for advanced mathematical reasoning.
 */
export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  try {
    // Check if API key is available (it's injected via vite.config.ts define)
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY_MISSING: The logic gateway is closed. Check environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey });

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
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 16384 } // High budget for solving the math internally first
      },
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");

    return text;
  } catch (error: any) {
    console.error("Socratica Error:", error);
    const msg = error.message || "";
    
    if (msg.includes("API_KEY_MISSING")) {
      return "API_ERROR: Environment variable API_KEY is missing in your deployment dashboard.";
    }
    if (error.status === 429) {
      return "API_ERROR: Logic realm is busy (Quota Exceeded). Please wait a moment.";
    }
    return "API_ERROR: Socratica had trouble reaching the logic source. Check your API key.";
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return "";
    
    const ai = new GoogleGenAI({ apiKey });
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
    return "";
  }
};
