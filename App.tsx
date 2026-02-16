
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  GraduationCap,
  RotateCcw,
  ListTree,
  Mic,
  MicOff,
  Loader2,
  Zap,
  ArrowLeft,
  Camera,
  Heart,
  BrainCircuit,
  Key,
  ShieldAlert,
  Info
} from 'lucide-react';
import { ChatMessage, Sender, TutorState } from './types';
import { getGeminiTutorResponse, transcribeAudio } from './services/geminiService';
import MessageBubble from './components/MessageBubble';

const MATH_EXAMPLES = [
  {
    title: "Derivatives",
    text: "How do I find the derivative of $f(x) = x \cdot \sin(x)$?",
    icon: <Zap className="w-4 h-4 text-orange-500" />
  },
  {
    title: "Logic",
    text: "Why does $(a+b)^2 = a^2 + 2ab + b^2$ instead of just $a^2 + b^2$?",
    icon: <ListTree className="w-4 h-4 text-blue-500" />
  },
  {
    title: "Limits",
    text: "Can you help me visualize the limit of $\frac{1}{x}$ as $x \to \infty$?",
    icon: <RotateCcw className="w-4 h-4 text-green-500" />
  }
];

const QUICK_REACTIONS = [
  "I'm feeling stuck here.",
  "Can we try a simpler case?",
  "What's the 'Why' behind this?",
  "I think I see it!"
];

const App: React.FC = () => {
  const [state, setState] = useState<TutorState>({
    messages: [
      {
        id: '1',
        sender: Sender.AI,
        timestamp: Date.now(),
        parts: [{ text: "Welcome to your sanctuary for mathematical discovery. I am Socratica.\n\nHere, we don't just find answers—we uncover the beauty of logic. What should we explore together today?" }]
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.isLoading, isTranscribing, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const handleOpenKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setKeyError(null);
    } else {
      window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank');
    }
  };

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

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImagePreview(dataUrl);
      setImageMime('image/jpeg');
      stopCamera();
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageMime(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

    const currentHistory = state.messages;

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      isDeepDive: forceDeepDive || prev.isDeepDive
    }));

    if (customText === undefined) setInputText('');
    clearImage();
    setShowExamples(false);

    const responseText = await getGeminiTutorResponse(
      [...currentHistory, userMessage],
      forceDeepDive || state.isDeepDive
    );

    if (responseText.includes("API_ERROR:")) {
      setKeyError(responseText.split("API_ERROR: ")[1]);
    } else {
      setKeyError(null);
    }

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: Sender.AI,
      timestamp: Date.now(),
      parts: [{ text: responseText }]
    };

    setState(prev => ({ ...prev, messages: [...prev.messages, aiMessage], isLoading: false }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const transcription = await transcribeAudio(base64, mediaRecorder.mimeType);
            if (transcription) setInputText(prev => prev ? `${prev} ${transcription}` : transcription);
          } catch (err) {}
          finally { setIsTranscribing(false); }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {}
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  return (
    <div className={`flex flex-col h-screen max-w-5xl mx-auto transition-all duration-700 overflow-hidden md:my-6 md:rounded-[2.5rem] border shadow-2xl relative ${state.isDeepDive ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <header className={`relative z-10 p-5 flex justify-between items-center transition-all duration-700 ${state.isDeepDive ? 'bg-purple-800' : 'bg-slate-900'} text-white shadow-xl`}>
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-2xl shadow-inner transition-colors duration-500 ${state.isDeepDive ? 'bg-purple-600' : 'bg-indigo-600'}`}>
            {state.isDeepDive ? <BrainCircuit className="w-6 h-6 animate-pulse" /> : <GraduationCap className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{state.isDeepDive ? 'Concept Deep Dive' : 'Socratica'}</h1>
            <div className="flex items-center gap-1.5 opacity-60">
               <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
               <span className="text-[10px] uppercase tracking-[0.2em] font-black">Guided Discovery</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {state.isDeepDive && (
            <button onClick={() => setState(p => ({ ...p, isDeepDive: false }))} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10">
              <ArrowLeft className="w-4 h-4" /> Exit Dive
            </button>
          )}
          <button 
            onClick={handleOpenKeySelection}
            className={`p-2.5 rounded-xl transition-all border ${keyError ? 'bg-red-500 border-white animate-bounce' : 'hover:bg-white/10 border-white/20'}`}
            title="Update Logic Source"
          >
            <Key className="w-5 h-5" />
          </button>
          <button onClick={() => window.location.reload()} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/20">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <section className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {state.messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isDeepDiveContext={state.isDeepDive} 
            onVariableClick={(v) => handleSend(`Help me understand the intuition behind $${v}$?`, true)} 
          />
        ))}

        {keyError && (
          <div className="flex flex-col items-center gap-4 p-8 bg-white border-2 border-red-100 rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-top-4 mx-auto max-w-lg">
            <div className="p-4 bg-red-50 rounded-full">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-red-900">Connection Interrupted</h2>
            <p className="text-center text-sm text-slate-600 leading-relaxed">
              {keyError}
            </p>
            <div className="flex flex-col w-full gap-2">
              <button 
                onClick={handleOpenKeySelection}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Key className="w-5 h-5" /> Re-connect Logic Source
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="flex items-center justify-center gap-1.5 py-3 text-[10px] text-slate-400 font-black uppercase tracking-widest hover:text-red-500 transition-colors">
                <Info className="w-3 h-3" /> Billing Documentation
              </a>
            </div>
          </div>
        )}

        {showExamples && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {MATH_EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => handleSend(ex.text)} className="group p-5 bg-white border border-slate-200 rounded-[2rem] text-left hover:border-indigo-400 hover:shadow-2xl transition-all active:scale-[0.98]">
                <div className="mb-4 p-3 bg-slate-50 rounded-2xl inline-block group-hover:bg-indigo-50 transition-colors shadow-sm">{ex.icon}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{ex.title}</div>
                <p className="text-sm text-slate-700 leading-relaxed font-semibold">{ex.text.replace(/\$/g, '')}</p>
              </button>
            ))}
          </div>
        )}

        {state.isLoading && (
          <div className="flex items-start gap-4 max-w-[90%] animate-in fade-in slide-in-from-left-4 duration-500">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${state.isDeepDive ? 'bg-purple-700' : 'bg-slate-900'}`}>
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Socratica is contemplating...</span>
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="flex justify-end p-2 animate-in fade-in">
             <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Translating Voice to Logic...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      {/* Input Area */}
      <div className="relative z-10 bg-white border-t border-slate-100 p-6 md:p-8">
        
        {/* Socratic Shortcuts */}
        {!state.isLoading && !keyError && (
          <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar pb-2">
            {QUICK_REACTIONS.map((q, i) => (
              <button key={i} onClick={() => handleSend(q)} className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${state.isDeepDive ? 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                {q}
              </button>
            ))}
          </div>
        )}

        <footer className="space-y-6">
          {imagePreview && (
            <div className="relative inline-block animate-in zoom-in-95 group">
              <img src={imagePreview} className="h-32 w-auto rounded-3xl border-4 border-white shadow-2xl object-cover ring-1 ring-slate-100" />
              <button onClick={clearImage} className="absolute -top-3 -right-3 bg-slate-900 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          )}
          
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2">
               <button onClick={startCamera} className="p-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all active:scale-90 border border-slate-100 shadow-sm" title="Capture Problem"><Camera className="w-6 h-6" /></button>
               <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all active:scale-90 border border-slate-100 shadow-sm" title="Upload Evidence"><ImageIcon className="w-6 h-6" /></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all shadow-md active:scale-90 border ${isRecording ? 'bg-red-600 border-red-700 text-white animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'}`}>
              {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            
            <div className="flex-1 relative group">
              <textarea 
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !state.isLoading) { e.preventDefault(); handleSend(); } }}
                placeholder={state.isDeepDive ? "Ask about the intuition..." : "Speak your logic here..."}
                className={`w-full p-5 pr-16 border rounded-[2rem] focus:outline-none focus:ring-4 transition-all resize-none shadow-inner min-h-[64px] max-h-[200px] text-base font-medium leading-relaxed ${state.isDeepDive ? 'bg-purple-50/50 border-purple-200 focus:ring-purple-200' : 'bg-slate-50 border-slate-100 focus:bg-white focus:ring-indigo-100'}`}
                disabled={state.isLoading}
              />
              <button 
                onClick={() => handleSend()}
                disabled={state.isLoading || (!inputText.trim() && !imagePreview)}
                className={`absolute right-3 bottom-3 p-3.5 rounded-2xl transition-all shadow-xl active:scale-90 ${state.isLoading || (!inputText.trim() && !imagePreview) ? 'bg-slate-100 text-slate-300' : state.isDeepDive ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-slate-900 text-white hover:bg-indigo-700'}`}
              ><Send className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest pb-2">
            <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400/20" />
            <span>Learning is a journey of discovery, not a race.</span>
          </div>
        </footer>
      </div>

      {/* Camera Fullscreen Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="relative w-full max-w-2xl aspect-[4/3] rounded-[3rem] overflow-hidden bg-black shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale-[20%]" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 border-[60px] border-black/60 pointer-events-none">
               <div className="w-full h-full border-2 border-dashed border-white/30 rounded-[2rem] flex items-center justify-center">
                  <div className="w-24 h-24 border-t-2 border-l-2 border-white/40 absolute top-4 left-4 rounded-tl-xl" />
                  <div className="w-24 h-24 border-t-2 border-r-2 border-white/40 absolute top-4 right-4 rounded-tr-xl" />
                  <div className="w-24 h-24 border-b-2 border-l-2 border-white/40 absolute bottom-4 left-4 rounded-bl-xl" />
                  <div className="w-24 h-24 border-b-2 border-r-2 border-white/40 absolute bottom-4 right-4 rounded-br-xl" />
               </div>
            </div>
            
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-12">
              <button onClick={stopCamera} className="p-5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-xl transition-all active:scale-90 border border-white/10"><X className="w-8 h-8" /></button>
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                <button onClick={capturePhoto} className="relative p-8 bg-white rounded-full text-slate-900 shadow-2xl active:scale-95 hover:scale-105 transition-all"><Camera className="w-12 h-12" /></button>
              </div>
              <div className="w-16" />
            </div>
            
            <p className="absolute top-12 w-full text-center text-white/50 text-xs font-black uppercase tracking-[0.3em] px-12">Align the mathematical logic within the frame</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
