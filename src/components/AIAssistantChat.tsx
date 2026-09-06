import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Sparkles, MessageSquare, Lightbulb } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AIAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Initialize initial greeting when lang or trip changes
  useEffect(() => {
    const greetingText = lang === 'vi'
      ? `Xin chào! Tôi là trợ lý du lịch AI TripMate cho ${trip.destination}. Tôi có thể giúp gì cho bạn hôm nay?`
      : `Hello! I'm your TripMate AI travel guide for ${trip.destination}. How can I assist you today?`;

    setMessages([
      {
        id: 'm-1',
        sender: 'ai',
        text: greetingText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [trip.destination, lang]);

  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const quickPrompts = lang === 'vi' ? [
    `Món ăn phải thử ở ${trip.destination}? 🍜`,
    `Văn hóa & quy tắc ứng xử ở ${trip.country}? 💡`,
    `Thẻ giao thông công cộng tốt nhất? 🚆`,
    `Mẹo an toàn & số điện thoại khẩn cấp? 🛡️`,
  ] : [
    `Must-try dishes in ${trip.destination}? 🍜`,
    `Tipping & cultural etiquette in ${trip.country}? 💡`,
    `Best public transit pass to buy? 🚆`,
    `Safety tips & emergency numbers? 🛡️`,
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMsg;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          tripContext: {
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
          },
          language: lang,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch AI reply.');

      const data = await res.json();

      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || (lang === 'vi' ? "Tôi ở đây để giúp giải đáp thắc mắc du lịch của bạn!" : "I'm here to help with any travel questions!"),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: lang === 'vi'
            ? 'Rất tiếc, tôi gặp sự cố kết nối. Vui lòng thử lại!'
            : 'Sorry, I ran into a network glitch. Please try again!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full sm:w-96 h-[540px] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs text-white">{t('aiChat.title')}</h4>
            <span className="text-[10px] text-teal-300">{t('aiChat.context', { dest: trip.destination })}</span>
          </div>
        </div>

        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-teal-600 text-white rounded-br-none shadow-2xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-2xs'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white p-2.5 rounded-2xl border border-slate-100 max-w-[70%]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            <span>{t('aiChat.thinking')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1 text-[10px] font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 rounded-lg whitespace-nowrap transition-colors border border-slate-200/60 shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
      >
        <input
          type="text"
          placeholder={t('aiChat.inputPlaceholder', { dest: trip.destination })}
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim() || loading}
          className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all disabled:opacity-40 shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
};
