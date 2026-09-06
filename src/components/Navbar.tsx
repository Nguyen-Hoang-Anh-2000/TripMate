import React from 'react';
import { Compass, Plus, MessageSquare, Globe, ChevronDown } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface NavbarProps {
  trips: Trip[];
  activeTrip: Trip;
  onSelectTrip: (tripId: string) => void;
  onOpenNewTripModal: () => void;
  onOpenAIItineraryModal: () => void;
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onOpenNewTripModal,
  onToggleAiChat,
  isAiChatOpen,
}) => {
  const { lang, setLang } = useLanguage();

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'vi' : 'en');
  };

  const isVi = lang === 'vi';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-display text-base sm:text-lg font-extrabold text-slate-900 tracking-tight hidden xs:inline">
              TripMate
            </span>
          </div>

          {/* Simple Clean Trip Selector */}
          <div className="relative flex items-center flex-1 max-w-[150px] sm:max-w-[240px]">
            <select
              value={activeTrip.id}
              onChange={(e) => onSelectTrip(e.target.value)}
              className="w-full appearance-none text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 py-1.5 pl-2.5 pr-7 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer truncate"
              title={activeTrip.title}
            >
              {trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* New Trip Button */}
            <button
              onClick={onOpenNewTripModal}
              className="inline-flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer min-h-[36px]"
              title={isVi ? 'Tạo chuyến đi mới' : 'New Trip'}
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">{isVi ? 'Tạo chuyến đi' : 'New Trip'}</span>
            </button>

            {/* AI Assistant Button */}
            <button
              onClick={onToggleAiChat}
              className={`inline-flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer min-h-[36px] ${
                isAiChatOpen
                  ? 'bg-teal-50 text-teal-800 border-teal-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isVi ? 'Mở trợ lý AI' : 'Open AI Assistant'}
            >
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span className="hidden md:inline">{isVi ? 'Trợ lý AI' : 'AI Assistant'}</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer min-h-[36px]"
              title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <Globe className="w-3.5 h-3.5 text-teal-600" />
              <span>{isVi ? 'VI' : 'EN'}</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
