
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  HelpCircle, 
  GraduationCap,
  RotateCcw,
  ListTree,
  Mic,
  MicOff,
  Loader2,
  Zap,
  ArrowLeft,
  BookOpen,
  Keyboard
} from 'lucide-react';
import { ChatMessage, Sender, TutorState } from './types.ts';
import { getGeminiTutorResponse, transcribeAudio } from './services/geminiService.ts';
import MessageBubble from './components/MessageBubble.tsx';

const MATH_EXAMPLES = [
  {
    title: "Calculus",
    description: "Chain Rule",
    text: "How do I find the derivative of $f(x) = \\sin(x^2)$?",
    icon: <Zap className="w-4 h-4 text-orange-500" aria-hidden="true" />
  },
  {
    title: "Algebra",
    description: "Quadratic Formula",
    text: "Help me solve for $x$ in $2x^2 - 5x + 3 = 0$.",
    icon: <ListTree className="w-4 h-4 text-blue-500" aria-hidden="true" />
  },
  {
    title: "Trigonometry",
    description: "Unit Circle",
    text: "Explain why $\\sin(\\pi/2) = 1$ visually.",
    icon: <RotateCcw className="w-4 h-4 text-green-500" aria-hidden="true" />
  }
];

const App: React.FC = () => {
  const [state, setState] = useState<TutorState>({
    messages: [
      {
        id: '1',
        sender: Sender.AI,
        timestamp: Date.now(),
        parts: [{ text: "Hello! I'm Socratica. I'm here to help you truly understand the logic of math. \n\nWhat are we exploring today? You can type, speak, or upload a photo of your problem." }]
      }
    ],
    isLoading: false,
    currentImage: null,
    isDeepDive: false,
  });

  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.isLoading, isTranscribing, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
    }
  }, [inputText]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setImageMime(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageMime(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    textareaRef.current?.focus();
  };

  const handleSend = async (customText?: string, forceDeepDive: boolean = false) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim() && !imagePreview) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: Sender.USER,
      timestamp: Date.now(),
      parts: [
        ...(imagePreview && imageMime ? [{ inlineData: { mimeType: imageMime, data: imagePreview.split(',')[1] } }] : []),
        { text: textToSend }
      ]
    };

    const isCurrentlyDeepDive = forceDeepDive || state.isDeepDive;

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));

    if (customText === undefined) setInputText('');
    clearImage();
    setShowExamples(false);

    try {
      const responseText = await getGeminiTutorResponse(
        [...state.messages, userMessage],
        !!isCurrentlyDeepDive
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        timestamp: Date.now(),
        parts: [{ text: responseText }]
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        isLoading: false,
      }));
    } catch (error: any) {
      let feedback = "I encountered an issue. Please try again.";
      if (error.message === "API_KEY_INVALID") feedback = "The API key is missing or invalid.";
      else if (error.message === "RATE_LIMIT_EXCEEDED") feedback = "I'm a bit overwhelmed right now. Please wait a moment.";
      else if (error.message === "SAFETY_ERROR") feedback = "I can't answer that for safety reasons. Let's try another problem!";

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        timestamp: Date.now(),
        parts: [{ text: feedback }]
      };
      setState(prev => ({ ...prev, messages: [...prev.messages, errorMessage], isLoading: false }));
    }
  };

  const handleVariableClick = useCallback((variable: string) => {
    setState(prev => ({ ...prev, isDeepDive: true }));
    handleSend(`I want to learn more about this: $${variable}$. Can you explain its intuition?`, true);
  }, [state.messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const transcription = await transcribeAudio(base64, mediaRecorder.mimeType);
            if (transcription) setInputText(prev => prev ? `${prev} ${transcription}` : transcription);
          } catch (err) { console.error(err); }
          finally { setIsTranscribing(false); }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error("Mic error:", err); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const toggleDeepDive = () => { setState(prev => ({ ...prev, isDeepDive: !prev.isDeepDive })); };

  return (
    <div className={`flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-2xl transition-colors duration-500 overflow-hidden md:my-4 md:rounded-3xl border ${state.isDeepDive ? 'border-purple-300' : 'border-slate-200'}`}>
      <header className={`p-5 text-white flex justify-between items-center shadow-lg transition-colors duration-500 ${state.isDeepDive ? 'bg-purple-800' : 'bg-indigo-700'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
            {state.isDeepDive ? <Zap className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">{state.isDeepDive ? 'Deep Dive' : 'Socratica'}</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Guided Math Discovery</p>
          </div>
        </div>
        <div className="flex gap-2">
           {state.isDeepDive && (
             <button onClick={toggleDeepDive} className="px-3 py-2 bg-white text-purple-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform">
               <ArrowLeft className="w-3.5 h-3.5" /> Back
             </button>
           )}
           <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-xl transition-colors border border-white/30">
             <RotateCcw className="w-5 h-5" />
           </button>
        </div>
      </header>

      <section className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth ${state.isDeepDive ? 'bg-purple-50/20' : 'bg-slate-50'}`}>
        {state.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isDeepDiveContext={state.isDeepDive} onVariableClick={handleVariableClick} />
        ))}

        {showExamples && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Jump In</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MATH_EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => handleSend(ex.text)} className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-indigo-400 hover:shadow-md transition-all active:scale-[0.98]">
                  <div className="mb-2 p-1.5 bg-slate-50 rounded-lg inline-block">{ex.icon}</div>
                  <div className="text-xs font-black text-indigo-700 mb-1">{ex.title}</div>
                  <p className="text-[13px] text-slate-700 leading-tight line-clamp-2">{ex.text.replace(/\$/g, '')}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.isLoading && (
          <div className="flex items-start gap-3 max-w-[85%] animate-in fade-in slide-in-from-left-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${state.isDeepDive ? 'bg-purple-700' : 'bg-indigo-600'}`}>
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-slate-400 text-sm italic font-medium">Socratica is reflecting...</div>
          </div>
        )}
        
        {isTranscribing && (
          <div className="flex justify-end p-4 animate-in fade-in">
             <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Transcribing your question...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <div className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar py-1">
          <button onClick={() => handleSend("Why did we do that? Can you explain the logic with an analogy?")} className="flex-shrink-0 px-4 py-2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">
            Why this step?
          </button>
          <button onClick={() => handleSend("Can you visualize this function for me?")} className="flex-shrink-0 px-4 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
            Visualize it
          </button>
          <button onClick={toggleDeepDive} className="flex-shrink-0 px-4 py-2 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors">
            Enter Deep Dive
          </button>
        </div>

        <footer className="space-y-4">
          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} className="h-24 w-auto rounded-xl border-2 border-indigo-700 shadow-xl object-cover" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg active:scale-90 transition-transform"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          
          <div className="flex items-end gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-100 rounded-2xl hover:bg-indigo-100 transition-colors border border-slate-200 active:scale-95"><ImageIcon className="w-6 h-6" /></button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all shadow-sm active:scale-95 ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-800 hover:bg-indigo-100'}`}>
              {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            
            <div className="flex-1 relative group">
              <textarea 
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && !state.isLoading) { e.preventDefault(); handleSend(); } }}
                placeholder={state.isDeepDive ? "Ask about the intuition..." : "Enter your problem..."}
                className={`w-full p-4 pr-14 border rounded-2xl focus:outline-none focus:ring-2 transition-all resize-none shadow-sm min-h-[56px] max-h-[240px] custom-scrollbar text-[15px] font-medium ${state.isDeepDive ? 'bg-purple-50 border-purple-300 focus:ring-purple-600' : 'bg-slate-50 border-slate-300 focus:bg-white focus:ring-indigo-600'}`}
                disabled={state.isLoading}
              />
              <button 
                onClick={() => handleSend()}
                disabled={state.isLoading || (!inputText.trim() && !imagePreview)}
                className={`absolute right-2 bottom-2 p-2.5 rounded-xl transition-all shadow-md active:scale-90 ${state.isLoading || (!inputText.trim() && !imagePreview) ? 'text-slate-400' : state.isDeepDive ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}
              ><Send className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest pb-2">Shift + Enter to Send</div>
        </footer>
      </div>
    </div>
  );
};

export default App;
