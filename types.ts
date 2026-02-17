
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
 * Fix: Moved to declare global to resolve collision between local and global interface types.
 */
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    /**
     * Environment API for API key selection.
     */
    aistudio?: AIStudio;
  }
}
