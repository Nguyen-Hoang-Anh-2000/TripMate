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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const isRailCity = /tokyo|osaka|kyoto|seoul|busan|bangkok|singapore|paris|london|taipei|hong kong|shanghai|beijing|berlin|new york/i.test(
    `${trip.destination} ${trip.country}`
  );

  const quickPrompts = lang === 'vi' ? [
    `Món ăn phải thử ở ${trip.destination}? 🍜`,
    `Văn hóa & quy tắc ứng xử ở ${trip.country}? 💡`,
    isRailCity
      ? `Thẻ giao thông công cộng tốt nhất? 🚆`
      : `Di chuyển thuận tiện nhất ở ${trip.destination}? 🛵`,
    `Mẹo an toàn & số điện thoại khẩn cấp? 🛡️`,
  ] : [
    `Must-try dishes in ${trip.destination}? 🍜`,
    `Tipping & cultural etiquette in ${trip.country}? 💡`,
    isRailCity
      ? `Best public transit pass to buy? 🚆`
      : `Best way to get around ${trip.destination}? 🛵`,
    `Safety tips & emergency numbers? 🛡️`,
  ];

  const generateFallbackChatReply = (queryText: string): string => {
    const q = queryText.toLowerCase();
    const dest = trip.destination || 'điểm đến';
    const isDalat = /đà lạt|da lat/i.test(dest);
    const isVungTau = /vũng tàu|vung tau/i.test(dest);
    const isPhuQuoc = /phú quốc|phu quoc/i.test(dest);
    const isDaNang = /đà nẵng|da nang/i.test(dest);
    const isViLang = lang === 'vi';

    if (/ăn|food|món|dish|restaurant|quán/i.test(q)) {
      if (isDalat) {
        return isViLang
          ? `Gợi ý món ngon không thể bỏ lỡ tại Đà Lạt:\n• Lẩu gà lá é Tao Ngộ (Đường 3/4)\n• Bánh mì xíu mại chén Hoàng Diệu buổi sáng\n• Bánh tráng nướng & sữa đậu nành nóng tại Chợ Đêm\n• Nem nướng Bà Hùng hoặc Lẩu bò Ba Toa Quán Gỗ`
          : `Must-try dishes in Da Lat:\n• Chicken hotpot with Basil leaves (Lẩu gà lá é Tao Ngộ)\n• Warm meatball baguette soup (Bánh mì xíu mại Hoàng Diệu)\n• Grilled rice paper & warm soy milk at Da Lat Night Market\n• Ba Toa beef hotpot (Lẩu bò Quán Gỗ)`;
      }
      if (isVungTau) {
        return isViLang
          ? `Món đặc sản nổi bật ở Vũng Tàu:\n• Bánh khọt Gốc Vú Sữa (Nguyễn Trường Tộ)\n• Lẩu cá đuối Út Mười hoặc Hoàng Minh\n• Hải sản tươi sống Chợ đêm Bãi Sau\n• Yaourt & trứng lòng đào đỉnh Hải Đăng`
          : `Must-try dishes in Vung Tau:\n• Crispy savory mini pancakes (Bánh khọt Gốc Vú Sữa)\n• Sour stingray hotpot (Lẩu cá đuối)\n• Fresh grilled seafood at Bai Sau Night Market\n• Soft yogurt & soft-boiled eggs at the Lighthouse`;
      }
      if (isPhuQuoc) {
        return isViLang
          ? `Đặc sản Phú Quốc nên thử:\n• Bún quậy Kiến Xây nổi tiếng\n• Gỏi cá trích & nhum biển nướng mỡ hành\n• Hải sản làng chài Hàm Ninh\n• Cà phê ngắm hoàng hôn Sunset Sanato / Dinh Cậu`
          : `Must-try in Phu Quoc:\n• Kien Xay Fresh Stirred Noodle Soup (Bún quậy)\n• Herring salad (Gỏi cá trích) & grilled sea urchin\n• Fresh seafood at Ham Ninh fishing village`;
      }
      if (isDaNang) {
        return isViLang
          ? `Đặc sản Đà Nẵng nên thử:\n• Mì Quảng Bà Mua hoặc Mì Quảng Ếch Bếp Trang\n• Bánh tráng cuốn thịt heo Trần\n• Hải sản tươi bờ biển Mỹ Khê\n• Chè sầu Liên nổi tiếng`
          : `Must-try in Da Nang:\n• Quang-style noodles (Mì Quảng)\n• Pork rice-paper rolls (Bánh tráng cuốn thịt heo)\n• Fresh seafood along My Khe Beach`;
      }
      return isViLang
        ? `Gợi ý thưởng thức ẩm thực tại ${dest}:\n• Ưu tiên quán đông khách bản địa, xem giờ mở cửa trước khi đi\n• Hỏi giá rõ ràng với hải sản hoặc chợ đêm\n• Dành 1 bữa tối tại phố ẩm thực hoặc chợ đêm trung tâm`
        : `Dining tips for ${dest}:\n• Look for busy local-favorite eateries and verify opening hours\n• Confirm prices beforehand at night markets and seafood stalls\n• Explore the central night food street for authentic snacks`;
    }

    if (/giao thông|di chuyển|transit|transport|xe|pass|get around/i.test(q)) {
      if (isRailCity) {
        return isViLang
          ? `Di chuyển tại ${dest}: Nên dùng thẻ tàu điện/metro không tiếp xúc (IC card hoặc thẻ ngày) kết hợp Google Maps để tiết kiệm chi phí và tránh tắc đường giờ cao điểm.`
          : `Getting around ${dest}: Use a contactless metro/transit day pass combined with Google Maps for the fastest and most economical routes.`;
      }
      return isViLang
        ? `Di chuyển thuận tiện tại ${dest}:\n• Nhóm đông 4–6 người: đặt GrabCar/Xanh SM hoặc thuê xe du lịch theo ngày\n• Nhóm nhỏ thích chủ động: thuê xe máy (~120.000–150.000₫/ngày), mang theo GPLX & kiểm tra phanh trước khi nhận xe`
        : `Best ways to get around ${dest}:\n• Groups of 4–6: Ride-hailing cars (Grab) or a private day driver\n• Flexible solo/couple travel: Motorbike rental or electric buggy along main scenic roads`;
    }

    if (/an toàn|khẩn cấp|safety|emergency/i.test(q)) {
      const isVietnam = /việt nam|vietnam|đà lạt|vũng tàu|phú quốc|đà nẵng|hà nội|hồ chí minh/i.test(
        `${dest} ${trip.country}`
      );
      if (isVietnam) {
        return isViLang
          ? `Số khẩn cấp tại Việt Nam & Mẹo an toàn ở ${dest}:\n• Công an: 113 | Cứu hỏa: 114 | Cấp cứu: 115\n• Lưu ảnh CCCD/Hộ chiếu trong tab Vé & Ví kèm mã PIN\n• Đi chợ đêm nhớ giữ túi đeo chéo phía trước và hỏi giá trước khi mua.`
          : `Vietnam Emergency Numbers & Safety Tips for ${dest}:\n• Police: 113 | Fire: 114 | Ambulance: 115\n• Keep a digital copy of your ID/Passport locked in Travel Vault\n• Agree on prices in advance at local markets and keep valuables secure.`;
      }
      return isViLang
        ? `Mẹo an toàn tại ${dest}:\n• Lưu sẵn địa chỉ khách sạn & số khẩn cấp địa phương (112/911)\n• Sao lưu hộ chiếu, bảo hiểm du lịch trong mục Vé & Ví có khóa PIN\n• Dùng eSIM hoặc tải sẵn bản đồ ngoại tuyến trước khi di chuyển.`
        : `Safety tips for ${dest}:\n• Save local emergency numbers (112/911) and hotel address offline\n• Keep passport & insurance backups PIN-locked in Travel Vault\n• Keep valuables in a front bag in crowded areas.`;
    }

    return isViLang
      ? `Mẹo du lịch ${dest} (${trip.startDate} – ${trip.endDate}):\n• Luôn kiểm tra thời tiết trực tiếp trên banner để mang trang phục phù hợp\n• Sắp xếp các điểm gần nhau trong cùng 1 ngày trên Bản đồ để tiết kiệm thời gian di chuyển\n• Ghi nhận chi tiêu chung ngay trên app để chia quỹ minh bạch cho cả nhóm.`
      : `Quick travel tips for ${dest} (${trip.startDate} – ${trip.endDate}):\n• Check the live weather badge on the banner before heading out\n• Group nearby stops by day in Interactive Map to cut transit time\n• Log shared bills right away in Expenses so everyone settles up easily.`;
  };

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
        text: data.reply || generateFallbackChatReply(query),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.warn('AI Chat timeout/fallback activated:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-fb-${Date.now()}`,
          sender: 'ai',
          text: generateFallbackChatReply(query),
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

      {/* Quick Prompts */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex flex-wrap items-center gap-1.5">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1 text-[10px] font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 rounded-lg transition-colors border border-slate-200/60 cursor-pointer text-left"
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
