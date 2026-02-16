
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
- Use relatable analogies (e.g., "A function is like a machine: you put in a raw ingredient (x), and it gives you a finished product (y)").
- Intellectual, patient, and highly encouraging.

DEEP DIVE HANDLING:
- If the system notes "DEEP DIVE mode", halt progress on the main problem. 
- Focus 100% on the conceptual intuition of the specific term the student clicked until they explicitly say they are ready to move back.`;

/**
 * Main tutoring function using gemini-3-pro-preview for complex reasoning
 * and multimodal Socratic dialogue.
 */
export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  try {
    // Validate API Key existence before initialization
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined in environment variables.");
    }

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
        parts: [{ text: "(System Note: User is currently in DEEP DIVE mode. Focus exclusively on the intuition of the term mentioned. Do not proceed with the math problem.)" }]
      });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.95,
        // Added thinkingConfig for enhanced Socratic reasoning in math
        thinkingConfig: { thinkingBudget: 16384 }
      },
    });

    const text = response.text;
    if (!text) {
      return "API_ERROR: The flow of logic was interrupted. Please try rephrasing.";
    }

    return text;
  } catch (error: any) {
    console.error("Gemini Tutor Error:", error);
    
    const errorMsg = error.message || "Unknown error";
    
    if (errorMsg.includes("API_KEY") || errorMsg.includes("not defined")) {
      return "API_ERROR: Environment Variable Missing. Ensure logic source is correctly configured.";
    }

    if (error.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota")) {
      return "API_ERROR: Discovery limit reached. Please wait a moment for the logic realm to reset.";
    }
    
    return "API_ERROR: Socratica is momentarily disconnected. Please check your logic source (API Key).";
  }
};

/**
 * Transcribes student voice questions into math-ready text.
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) return "";
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: "Accurately transcribe this math question. Convert spoken symbols to LaTeX (e.g., say 'x squared' -> '$x^2$'). Return only the transcribed text." }
          ]
        }
      ]
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    return "";
  }
};
