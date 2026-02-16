
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

// Fix: Upgrade to gemini-3-pro-preview for complex math tutoring and reasoning tasks.
export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  try {
    // Re-initialize to pick up any key changes
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

    // Fix: Select 'gemini-3-pro-preview' for advanced math reasoning as per SDK guidelines.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Enabled thinking configuration to leverage the reasoning capabilities of the Pro model.
        thinkingConfig: { thinkingBudget: 16000 },
      },
    });

    const text = response.text;
    if (!text) return "API_ERROR: The logic realm is silent. Please check your connection.";
    return text;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    
    const errorMsg = error.message || "";
    const status = error.status || (error.error && error.error.code);

    // Handle 429 Quota errors specifically
    if (status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
      return "API_ERROR: Quota exceeded. You've reached the limit for discovery today. Please check your API key or wait a moment before trying again.";
    }
    
    // Handle 404/Invalid Key errors
    if (status === 404 || errorMsg.includes("not found") || errorMsg.includes("invalid")) {
      return "API_ERROR: Connection lost. The logic source is unavailable. Please re-select your key.";
    }
    
    return "API_ERROR: Socratica is momentarily disconnected from the flow of logic.";
  }
};

// Fix: Using gemini-3-flash-preview for transcription as it is a basic text-related task.
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: "Transcribe the following math question. Convert spoken math to clear LaTeX. Return only the transcription." }
          ]
        }
      ]
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "";
  }
};
