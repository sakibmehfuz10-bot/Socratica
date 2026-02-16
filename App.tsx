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
  AlertCircle
} from 'lucide-react';
import { ChatMessage, Sender, TutorState } from './types';
import { getGeminiTutorResponse, transcribeAudio } from './services/geminiService';
import MessageBubble from './components/MessageBubble';

const MATH_EXAMPLES = [
  {
    title: "Calculus",
    text: "Help me find the derivative of $f(x) = x^2 \\cdot \\sin(x)$",
    icon: <Zap className="w-4 h-4 text-orange-500" />
  },
  {
    title: "Algebra",
    text: "Why is $(a+b)^2$ not just $a^2 + b^2$?",
    icon: <ListTree className="w-4 h-4 text-blue-500" />
  },
  {
    title: "Logarithms",
    text: "Can you explain what $\\ln(x)$ actually represents?",
    icon: <RotateCcw className="w-4 h-4 text-green-500" />
  }
];

const QUICK_REACTIONS = [
  "I'm feeling lost.",
  "What is the goal of this step?",
  "Show me an analogy.",
  "Let's try a simpler example."
];

const App: React.FC = () => {
  const [state, setState] = useState<TutorState>({
    messages: [
      {
        id: '1',
        sender: Sender.AI,
        timestamp: Date.now(),
        parts: [{ text: "Welcome to your sanctuary for learning. I'm Socratica.\n\nMath isn't just about answers—it's about seeing the hidden logic of the universe. What should we explore together today?" }]
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
      console.error("Camera access denied", err);
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
      if (responseText.includes("Quota exceeded")) {
        setKeyError("Quota Exceeded: Your API key's limit has been reached. Please connect a key from a paid GCP project.");
      } else {
        setKeyError("Connection Error: Please verify your API settings.");
      }
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
          } catch (err) { console.error(err); }
          finally { setIsTranscribing(false); }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  return (
    <div className={`flex flex-col h-screen max-w-4xl mx-auto transition-colors duration-700 overflow-hidden md:my-4 md:rounded-3xl border shadow-2xl ${state.isDeepDive ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
      
      {/* Header */}
      <header className={`p-4 sm:p-5 flex justify-between items-center transition-all duration-700 ${state.isDeepDive ? 'bg-purple-800' : 'bg-indigo-700'} text-white shadow-lg`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl backdrop-blur-md ${state.isDeepDive ? 'bg-white/20' : 'bg-white/10'}`}>
            {state.isDeepDive ? <BrainCircuit className="w-6 h-6 animate-pulse" /> : <GraduationCap className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{state.isDeepDive ? 'Concept Deep Dive' : 'Socratica'}</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-70">Compassionate Mastery</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleOpenKeySelection}
            className={`p-2 rounded-xl transition-all border ${keyError ? 'bg-red-500 border-white animate-bounce' : 'hover:bg-white/10 border-white/20'}`}
            title="Update API Key"
          >
            <Key className="w-5 h-5" />
          </button>
          {state.isDeepDive && (
            <button onClick={() => setState(p => ({ ...p, isDeepDive: false }))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/10 rounded-xl transition-colors border border-white/20">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <section className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth custom-scrollbar ${state.isDeepDive ? 'bg-purple-50/30' : 'bg-slate-50'}`}>
        {state.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isDeepDiveContext={state.isDeepDive} onVariableClick={(v) => handleSend(`Can you help me understand the intuition behind $${v}$?`, true)} />
        ))}

        {keyError && (
          <div className="flex flex-col items-center gap-4 p-6 bg-red-50 border border-red-200 rounded-3xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <AlertCircle className="w-6 h-6" />
              <span>Logic Realm Blocked</span>
            </div>
            <p className="text-center text-sm text-red-700 leading-relaxed max-w-md">
              {keyError}
            </p>
            <button 
              onClick={handleOpenKeySelection}
              className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all flex items-center gap-2 active:scale-95"
            >
              <Key className="w-5 h-5" /> Connect API Key
            </button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-red-400 font-black uppercase tracking-widest hover:underline">
              Learn about Billing for paid projects
            </a>
          </div>
        )}

        {showExamples && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {MATH_EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => handleSend(ex.text)} className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-indigo-400 hover:shadow-md transition-all active:scale-[0.98] group">
                <div className="mb-2 p-2 bg-slate-50 rounded-lg inline-block group-hover:bg-indigo-50 transition-colors">{ex.icon}</div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">{ex.title}</div>
                <p className="text-[13px] text-slate-700 leading-snug line-clamp-2 font-medium">{ex.text.replace(/\$/g, '')}</p>
              </button>
            ))}
          </div>
        )}

        {state.isLoading && (
          <div className="flex items-start gap-3 max-w-[85%] animate-in fade-in slide-in-from-left-2 duration-500">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${state.isDeepDive ? 'bg-purple-700' : 'bg-indigo-600'}`}>
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Socratica is reflecting...</span>
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="flex justify-end p-2 animate-in fade-in">
             <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Transcribing...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4 relative">
        
        {/* Quick Socratic Reactions */}
        {!state.isLoading && !keyError && (
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
            {QUICK_REACTIONS.map((q, i) => (
              <button key={i} onClick={() => handleSend(q)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${state.isDeepDive ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}`}>
                {q}
              </button>
            ))}
          </div>
        )}

        <footer className="space-y-4">
          {imagePreview && (
            <div className="relative inline-block animate-in zoom-in-95">
              <img src={imagePreview} className="h-28 w-auto rounded-2xl border-2 border-indigo-600 shadow-2xl object-cover" />
              <button onClick={clearImage} className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-lg active:scale-90"><X className="w-4 h-4" /></button>
            </div>
          )}
          
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-2">
               <button onClick={startCamera} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-95 border border-slate-200 shadow-sm" title="Take a photo"><Camera className="w-6 h-6" /></button>
               <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-95 border border-slate-200 shadow-sm" title="Upload image"><ImageIcon className="w-6 h-6" /></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all shadow-md active:scale-95 border ${isRecording ? 'bg-red-600 border-red-700 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-indigo-100'}`}>
              {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            
            <div className="flex-1 relative group">
              <textarea 
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !state.isLoading) { e.preventDefault(); handleSend(); } }}
                placeholder={state.isDeepDive ? "Ask about the intuition..." : "Speak or type your logic..."}
                className={`w-full p-4 pr-14 border rounded-2xl focus:outline-none focus:ring-2 transition-all resize-none shadow-sm min-h-[60px] max-h-[200px] text-[15px] font-medium leading-relaxed ${state.isDeepDive ? 'bg-purple-50 border-purple-200 focus:ring-purple-600' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-indigo-600'}`}
                disabled={state.isLoading}
              />
              <button 
                onClick={() => handleSend()}
                disabled={state.isLoading || (!inputText.trim() && !imagePreview)}
                className={`absolute right-2 bottom-2 p-3 rounded-xl transition-all shadow-lg active:scale-90 ${state.isLoading || (!inputText.trim() && !imagePreview) ? 'bg-slate-100 text-slate-400' : state.isDeepDive ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}
              ><Send className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="text-[9px] text-center text-slate-400 font-black uppercase tracking-widest flex items-center justify-center gap-1.5 pb-2">
            <Heart className="w-3 h-3 text-red-400" /> Socratic discovery is a journey, not a race.
          </div>
        </footer>
      </div>

      {/* Camera Modal Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl border border-white/10">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
               <div className="w-full h-full border-2 border-dashed border-white/50 rounded-2xl" />
            </div>
            
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8">
              <button onClick={stopCamera} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-90"><X className="w-8 h-8" /></button>
              <button onClick={capturePhoto} className="p-6 bg-white rounded-full text-indigo-700 shadow-xl active:scale-95 hover:scale-105 transition-all"><Camera className="w-10 h-10" /></button>
              <div className="w-16" /> {/* Spacer */}
            </div>
            
            <p className="absolute top-10 w-full text-center text-white/70 text-xs font-black uppercase tracking-widest px-10">Align your homework within the frame</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;