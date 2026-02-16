
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

// Global declaration for the aistudio environment API
declare global {
  interface Window {
    // Fixed: Removed 'readonly' and used an inline type to match pre-existing declarations 
    // without causing naming collisions with other AIStudio interfaces.
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
