import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Sparkles, MessageSquare, Lightbulb } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  generateSmartFallbackChatReply,
  normalizeChatCacheKey,
} from '../utils/chatFallbackUtils';

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

const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_CACHE_STORAGE_KEY = 'tripmate_ai_chat_cache_v1';
const moduleChatCache = new Map<string, { reply: string; expiresAt: number }>();

function buildCandidateCacheKeys(queryText: string, destination: string, lang: string): string[] {
  const clean = queryText.trim();
  const stripped = clean.replace(/[?!.,;:]+$/g, '').trim();
  const exactKey = normalizeChatCacheKey(clean, destination, lang);
  const strippedKey = normalizeChatCacheKey(stripped || clean, destination, lang);
  return exactKey === strippedKey ? [exactKey] : [exactKey, strippedKey];
}

function readPersistentChatCache(keys: string[]): string | null {
  const now = Date.now();
  for (const k of keys) {
    const modHit = moduleChatCache.get(k);
    if (modHit && modHit.expiresAt > now) {
      return modHit.reply;
    }
  }
  try {
    const raw = localStorage.getItem(CHAT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, { reply: string; expiresAt: number }>;
    if (!parsed || typeof parsed !== 'object') return null;
    for (const k of keys) {
      const entry = parsed[k];
      if (entry && typeof entry.reply === 'string' && entry.expiresAt > now) {
        moduleChatCache.set(k, entry);
        return entry.reply;
      }
    }
  } catch {
    // Ignore storage parse failures
  }
  return null;
}

function writePersistentChatCache(keys: string[], reply: string, expiresAt: number): void {
  const entry = { reply, expiresAt };
  for (const k of keys) {
    moduleChatCache.set(k, entry);
  }
  try {
    const now = Date.now();
    const raw = localStorage.getItem(CHAT_CACHE_STORAGE_KEY);
    const parsed: Record<string, { reply: string; expiresAt: number }> =
      raw ? JSON.parse(raw) || {} : {};
    // Prune expired entries to keep storage compact
    const nextStore: Record<string, { reply: string; expiresAt: number }> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.expiresAt === 'number' && v.expiresAt > now) {
        nextStore[k] = v;
      }
    }
    for (const k of keys) {
      nextStore[k] = entry;
    }
    localStorage.setItem(CHAT_CACHE_STORAGE_KEY, JSON.stringify(nextStore));
  } catch {
    // Ignore storage quota issues
  }
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientChatCacheRef = useRef<Map<string, { reply: string; expiresAt: number }>>(new Map());

  useEffect(() => {
    let isCancelled = false;
    const checkConnectivity = async () => {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3500);
      try {
        const res = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
        if (!isCancelled) setIsOnline(res.ok || navigator.onLine);
      } catch {
        if (!isCancelled) setIsOnline(navigator.onLine);
      } finally {
        clearTimeout(tId);
      }
    };
    checkConnectivity();
    const handleOnline = () => {
      checkConnectivity();
    };
    const handleOffline = () => {
      checkConnectivity();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const quickPrompts = lang === 'vi' ? [
    '🍜 Quán ngon',
    '🛵 Di chuyển',
    '🛡️ Lưu ý an toàn',
    '✨ Gợi ý điểm đi',
  ] : [
    '🍜 Local food',
    '🛵 Getting around',
    '🛡️ Safety tips',
    '✨ Top spots',
  ];

  const generateFallbackChatReply = (queryText: string): string => {
    return generateSmartFallbackChatReply(
      queryText,
      {
        destination: trip.destination,
        country: trip.country,
        startDate: trip.startDate,
        endDate: trip.endDate,
      },
      lang
    );
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMsg;
    if (!query.trim() || loading) return;

    const cleanQuery = query.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: cleanQuery,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const candidateKeys = buildCandidateCacheKeys(cleanQuery, trip.destination, lang);
    let cachedReplyText: string | null = null;
    for (const key of candidateKeys) {
      const hit = clientChatCacheRef.current.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        cachedReplyText = hit.reply;
        break;
      }
    }
    if (!cachedReplyText) {
      cachedReplyText = readPersistentChatCache(candidateKeys);
    }

    if (cachedReplyText) {
      const expiresAt = Date.now() + CHAT_CACHE_TTL_MS;
      for (const key of candidateKeys) {
        clientChatCacheRef.current.set(key, { reply: cachedReplyText, expiresAt });
      }
      setInputMsg('');
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `ai-cache-${Date.now()}`,
          sender: 'ai',
          text: cachedReplyText!,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: cleanQuery,
          tripContext: {
            destination: trip.destination,
            country: trip.country,
            startDate: trip.startDate,
            endDate: trip.endDate,
          },
          language: lang,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch AI reply.');

      const data = await res.json();
      const finalReply = data.reply || generateFallbackChatReply(cleanQuery);
      const expiresAt = Date.now() + CHAT_CACHE_TTL_MS;
      for (const key of candidateKeys) {
        clientChatCacheRef.current.set(key, { reply: finalReply, expiresAt });
      }
      writePersistentChatCache(candidateKeys, finalReply, expiresAt);

      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: finalReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.warn('AI Chat timeout/fallback activated:', err);
      const fallbackText = generateFallbackChatReply(cleanQuery);
      const expiresAt = Date.now() + CHAT_CACHE_TTL_MS;
      for (const key of candidateKeys) {
        clientChatCacheRef.current.set(key, { reply: fallbackText, expiresAt });
      }
      writePersistentChatCache(candidateKeys, fallbackText, expiresAt);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-fb-${Date.now()}`,
          sender: 'ai',
          text: fallbackText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:bottom-4 sm:right-4 z-50 sm:w-96 h-[min(520px,74dvh)] sm:h-[min(540px,80dvh)] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs text-white">{t('aiChat.title')}</h4>
          </div>
        </div>

        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isOnline && (
        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] font-medium flex items-center justify-between">
          <span>
            {lang === 'vi'
              ? 'Đang ngoại tuyến — sử dụng gợi ý du lịch cục bộ cho chuyến đi.'
              : 'Offline mode — replying with cached destination guidance.'}
          </span>
        </div>
      )}

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

      {/* Quick Prompts (2x2 compact grid) */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 grid grid-cols-2 gap-1.5">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 rounded-lg transition-colors border border-slate-200/60 cursor-pointer text-left truncate"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
      >
        <input
          type="text"
          placeholder={t('aiChat.inputPlaceholder')}
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          className="flex-1 text-sm sm:text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim() || loading}
          className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all disabled:opacity-40 shrink-0 shadow-xs cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
};
