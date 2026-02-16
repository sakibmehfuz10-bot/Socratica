import React, { useState } from 'react';
import { Sender, ChatMessage } from '../types';
import { User, Sparkles, Zap, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MathGraph from '../MathGraph';

interface MessageBubbleProps {
  message: ChatMessage;
  isDeepDiveContext?: boolean;
  onVariableClick?: (variable: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isDeepDiveContext, onVariableClick }) => {
  const [copied, setCopied] = useState(false);
  const isAi = message.sender === Sender.AI;

  const handleCopy = () => {
    const fullText = message.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('\n');
    
    if (fullText) {
      navigator.clipboard.writeText(fullText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mathVar = target.closest('.math-var');
    if (mathVar && onVariableClick) {
      onVariableClick(mathVar.textContent || '');
    }
  };

  const renderContent = (text: string) => {
    // Robust regex for [PLOT: expression, min, max] or [PLOT: expression]
    const parts = text.split(/(\[PLOT:\s*[^\]]+\])/);
    
    return parts.filter(Boolean).map((part, i) => {
      const plotMatch = part.match(/\[PLOT:\s*([^,\]]+)(?:,\s*([^,\]]+))?(?:,\s*([^,\]]+))?\]/);
      if (plotMatch) {
        const expr = plotMatch[1].trim();
        const min = plotMatch[2] ? parseFloat(plotMatch[2]) : -5;
        const max = plotMatch[3] ? parseFloat(plotMatch[3]) : 5;
        return <MathGraph key={i} expression={expr} range={[min, max]} color={isDeepDiveContext ? '#a855f7' : '#6366f1'} />;
      }
      
      return (
        <ReactMarkdown 
          key={i}
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[[rehypeKatex, { trust: true, strict: false }]]}
          className={`prose prose-sm max-w-none ${isAi ? 'prose-slate' : 'prose-invert'} 
            prose-p:leading-relaxed prose-p:text-slate-950 prose-li:my-1 
            prose-headings:font-bold 
            prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-pink-700
            ${isAi && isDeepDiveContext ? 'prose-headings:text-purple-900 prose-strong:text-purple-900' : 'prose-headings:text-indigo-950 prose-strong:text-indigo-950'}`}
          components={{
            p: ({children}) => <p className="mb-3 last:mb-0 text-inherit">{children}</p>,
            li: ({children}) => <li className={`mb-2 last:mb-0 ml-4 list-disc text-inherit ${isDeepDiveContext ? 'marker:text-purple-600' : 'marker:text-indigo-600'}`}>{children}</li>,
            ol: ({children}) => <ol className={`mb-3 space-y-2 list-decimal ml-4 font-medium text-inherit ${isDeepDiveContext ? 'marker:text-purple-600' : 'marker:text-indigo-600'}`}>{children}</ol>,
            ul: ({children}) => <ul className="mb-3 space-y-1 text-inherit">{children}</ul>,
            strong: ({children}) => <strong className={isAi ? isDeepDiveContext ? "text-purple-900 font-bold" : "text-indigo-950 font-bold" : "text-white font-black"}>{children}</strong>,
          }}
        >
          {part}
        </ReactMarkdown>
      );
    });
  };
  
  return (
    <article 
      className={`flex w-full gap-3 group ${isAi ? 'justify-start' : 'justify-end flex-row-reverse animate-in fade-in slide-in-from-bottom-2 duration-300'}`}
      aria-label={`${isAi ? 'Socratica said' : 'You said'} at ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
    >
      <div 
        className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md transition-colors duration-500 ${
          isAi 
            ? isDeepDiveContext ? 'bg-purple-700 text-white' : 'bg-indigo-600 text-white' 
            : 'bg-slate-200 text-slate-700'
        }`}
        aria-hidden="true"
      >
        {isAi 
          ? isDeepDiveContext ? <Zap className="w-5 h-5 sm:w-6 sm:h-6" /> : <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" /> 
          : <User className="w-5 h-5 sm:w-6 sm:h-6" />
        }
      </div>
      
      <div className={`max-w-[88%] sm:max-w-[80%] flex flex-col gap-2 ${isAi ? 'items-start' : 'items-end'}`}>
        {message.parts.map((part, idx) => {
          if (part.inlineData) {
            return (
              <div key={idx} className="relative group/img">
                <img 
                  src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                  alt="Student's uploaded math problem"
                  className="max-w-full rounded-2xl border-2 border-white shadow-lg transition-transform group-hover/img:scale-[1.01]"
                />
              </div>
            );
          }
          if (part.text) {
            return (
              <div 
                key={idx}
                onClick={handleContainerClick}
                className={`relative p-4 sm:p-5 rounded-2xl shadow-sm leading-relaxed text-[15px] transition-colors duration-500 ${isAi ? 'deep-dive-active' : ''} ${
                  isAi 
                    ? isDeepDiveContext 
                      ? 'bg-purple-50 text-slate-950 border border-purple-100 ring-1 ring-purple-500/10' 
                      : 'bg-white text-slate-950 border border-slate-100 ring-1 ring-black/5' 
                    : isDeepDiveContext
                      ? 'bg-purple-600 text-white font-medium'
                      : 'bg-indigo-600 text-white font-medium'
                }`}
              >
                {renderContent(part.text)}

                {isAi && (
                  <button 
                    onClick={handleCopy}
                    aria-label={copied ? "Copied to clipboard" : "Copy AI response"}
                    className={`absolute bottom-2 right-2 p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:outline-none ${
                      isDeepDiveContext 
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 focus:ring-purple-400' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-indigo-400'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            );
          }
          return null;
        })}
        <time 
          className="text-[10px] text-slate-600 font-bold tracking-wider px-1"
          dateTime={new Date(message.timestamp).toISOString()}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </article>
  );
};

export default MessageBubble;