
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

// Define the AIStudio interface to match the global declaration and provide type safety
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fixed: Use named AIStudio type and match existing modifiers (readonly) to resolve compiler errors
    readonly aistudio: AIStudio;
  }
}
