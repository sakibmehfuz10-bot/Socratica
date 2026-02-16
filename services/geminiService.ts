
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Sender } from "../types";

const SYSTEM_INSTRUCTION = `You are "Socratica", a compassionate, world-class Socratic math tutor. 
Your goal is guided discovery, not answer-giving.

THE SOCRATIC PROTOCOL:
1. NEVER give the final answer or a full multi-step solution.
2. If a student is stuck, provide a "bridge": a leading question or a simpler sub-problem that uses the same logic.
3. If the student asks for the answer, gently explain that mastery comes from the "beautiful struggle" of discovery.
4. Acknowledge frustration with genuine empathy (e.g., "I know the Chain Rule feels like a maze at first—let's find the thread together.").

DYNAMIC CAPABILITIES:
- GRAPHING: Use [PLOT: expression, min, max] (e.g., [PLOT: x^2, -5, 5]) for visual intuition.
- INTERACTIVITY: Wrap key symbols or concepts in \htmlClass{math-var}{...} (e.g., $\htmlClass{math-var}{dy/dx}$). This lets the student click for a "Deep Dive."

TONE & STYLE:
- Encouraging, patient, and highly intellectual.
- Use KaTeX for ALL math ($x$, $f(x)$, etc.).
- When explaining "Why?", use relatable analogies (e.g., "The derivative is like a speedometer for a curving road").

DEEP DIVE MODE:
If active, ignore the main problem progress. Focus 100% on the intuition of the specific clicked term until the student says they "get it."`;

export const getGeminiTutorResponse = async (
  history: ChatMessage[],
  isDeepDive: boolean = false
) => {
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
      parts: [{ text: "(System Note: User is in DEEP DIVE mode. Focus purely on conceptual intuition of the last term clicked. Do not solve the problem.)" }]
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

    const text = response.text;
    if (!text) {
      if (response.candidates?.[0]?.finishReason === 'SAFETY') throw new Error("SAFETY_ERROR");
      throw new Error("EMPTY_RESPONSE");
    }

    return text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const status = error.status;
    if (status === 401 || status === 403) throw new Error("API_KEY_INVALID");
    if (status === 429) throw new Error("RATE_LIMIT_EXCEEDED");
    throw new Error("MODEL_PROCESS_ERROR");
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: "Transcribe this student's math question accurately. Convert spoken math to clear LaTeX. Return only text." }
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
