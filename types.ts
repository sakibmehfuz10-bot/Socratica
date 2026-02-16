
export enum Sender {
  USER = 'user',
  AI = 'ai'
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  parts: MessagePart[];
  timestamp: number;
  isThinking?: boolean;
}

export interface TutorState {
  messages: ChatMessage[];
  isLoading: boolean;
  currentImage: string | null;
  isDeepDive?: boolean;
}

/**
 * Interface for the AI Studio environment API.
 */
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// Global declaration for the aistudio environment API
declare global {
  interface Window {
    // Fixed: Use the named interface AIStudio to ensure property type and modifiers 
    // match the pre-existing global declarations.
    aistudio: AIStudio;
  }
}