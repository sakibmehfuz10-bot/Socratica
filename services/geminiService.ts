
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Sender } from "../types.ts";

const SYSTEM_INSTRUCTION = `You are "Socratica", a compassionate, world-class Socratic math tutor. 
Your goal is guided discovery. 

DYNAMIC CAPABILITIES:
1. GRAPHING: To show a graph, use: [PLOT: expression, min, max] (e.g., [PLOT: x^2, -5, 5]).
2. INTERACTIVITY: Wrap key symbols or concept names in \htmlClass{math-var}{...} (e.g., $\htmlClass{math-var}{dx}$ or $\htmlClass{math-var}{\text{Chain Rule}}$). This allows the student to click them for a Deep Dive.

GUIDELINES:
- Warmly acknowledge the student's struggle.
- Never give the full solution. Share one conceptual step or ask a leading question.
- When the user asks "Why?", provide an intuitive explanation focusing ONLY on the logic of the preceding step. Use relatable analogies.
- Use STRICT KaTeX for ALL math (even single variables like $x$).
- Tone: Encouraging, patient, and highly intellectual yet accessible.

DEEP DIVE MODE:
If active, focus EXCLUSIVELY on explaining the specific concept mentioned. Do not progress the main problem until the student feels confident in the concept.`;

export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
  // Always initialize right before use to ensure the latest API key from environment
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
      parts: [{ text: "(System Note: I am currently in DEEP DIVE mode. Please focus your entire explanation on the intuition and conceptual 'why' of the specific variable or term I just clicked. Use analogies and PLOT tags if it helps visual understanding.)" }]
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    // Extract text using the direct .text property as per SDK rules
    const text = response.text;
    if (!text) {
      if (response.candidates?.[0]?.finishReason === 'SAFETY') throw new Error("SAFETY_ERROR");
      throw new Error("EMPTY_RESPONSE");
    }

    return text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const status = error.status;
    const msg = error.message?.toLowerCase() || "";

    if (status === 401 || status === 403) throw new Error("API_KEY_INVALID");
    if (status === 429) throw new Error("RATE_LIMIT_EXCEEDED");
    if (msg.includes("fetch") || msg.includes("network")) throw new Error("NETWORK_ISSUE");
    if (msg.includes("safety")) throw new Error("SAFETY_ERROR");
    throw new Error("MODEL_PROCESS_ERROR");
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: "Transcribe this student's math question. Convert spoken math to clear LaTeX notation. Return only the transcription text." }
          ]
        }
      ]
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw new Error("TRANSCRIPTION_FAILED");
  }
};
