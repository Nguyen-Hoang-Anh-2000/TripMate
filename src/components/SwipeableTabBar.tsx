import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

export interface TabItem {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SwipeableTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  mobileMoreTabIds?: string[];
}

export const SwipeableTabBar: React.FC<SwipeableTabBarProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  mobileMoreTabIds = ['vault', 'packing'],
}) => {
  const { isVi } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Check scroll boundary
  const updateScrollButtons = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [tabs]);

  // Scroll active tab into view smoothly
  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement;
    if (activeEl) {
      const container = containerRef.current;
      const elLeft = activeEl.offsetLeft;
      const elWidth = activeEl.offsetWidth;
      const containerWidth = container.clientWidth;

      if (elLeft < container.scrollLeft || elLeft + elWidth > container.scrollLeft + containerWidth) {
        container.scrollTo({
          left: elLeft - containerWidth / 2 + elWidth / 2,
          behavior: 'smooth',
        });
      }
    }
    updateScrollButtons();
  }, [activeTab]);

  // Mouse drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeftState(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
    }
    containerRef.current.scrollLeft = scrollLeftState - walk;
    updateScrollButtons();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScrollClick = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = 160;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(updateScrollButtons, 200);
  };

  const mobilePrimaryTabs = tabs.filter((t) => !mobileMoreTabIds.includes(t.id)).slice(0, 4);
  const mobileMoreTabs = tabs.filter((t) => mobileMoreTabIds.includes(t.id));
  const isMoreActive = mobileMoreTabs.some((t) => t.id === activeTab);

  return (
    <>
      <div className="hidden sm:flex relative group/tabs items-center border-b border-slate-200 py-1 select-none">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollClick('left')}
            className="absolute left-0 z-10 p-1.5 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md rounded-full text-slate-600 hover:text-slate-900 transition-all cursor-pointer -ml-2 sm:-ml-3"
            title={isVi ? 'Lướt sang trái' : 'Scroll left'}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div
          ref={containerRef}
          onScroll={updateScrollButtons}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full px-1 py-1 cursor-grab ${
            isDragging ? 'cursor-grabbing active:cursor-grabbing' : ''
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                type="button"
                onClick={() => {
                  if (!hasMoved) {
                    onSelectTab(tab.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs scale-100 ring-2 ring-slate-900/10'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/90'
                }`}
              >
                <span className={isActive ? 'text-teal-400' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollClick('right')}
            className="absolute right-0 z-10 p-1.5 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md rounded-full text-slate-600 hover:text-slate-900 transition-all cursor-pointer -mr-2 sm:-mr-3"
            title={isVi ? 'Lướt sang phải' : 'Scroll right'}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fixed Thumb-Friendly 5-Tab Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)] select-none"
      >
        <div className="grid grid-cols-5 items-stretch h-16 px-1">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onSelectTab(tab.id);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors cursor-pointer min-w-0 min-h-[44px] ${
                  isActive ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-teal-600" />
                )}
                <span className={`transition-transform ${isActive ? 'text-teal-600 scale-110' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                <span className="text-[10px] leading-tight truncate max-w-full">
                  {tab.mobileLabel || tab.label}
                </span>
              </button>
            );
          })}

          {mobileMoreTabs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors cursor-pointer min-w-0 min-h-[44px] ${
                isMoreActive || isMoreOpen ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              {(isMoreActive || isMoreOpen) && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-teal-600" />
              )}
              <span className={`transition-transform ${isMoreActive || isMoreOpen ? 'text-teal-600 scale-110' : 'text-slate-400'}`}>
                <MoreHorizontal className="w-4 h-4" />
              </span>
              <span className="text-[10px] leading-tight truncate max-w-full">
                {isVi ? 'Thêm' : 'More'}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile "Thêm" Bottom Sheet Drawer for Travel Vault & Packing List */}
      {isMoreOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:hidden animate-in fade-in duration-150"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-4 pb-8 space-y-2.5 animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-1" />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isVi ? 'Tiện ích chuyến đi' : 'Trip Utilities'}
              </span>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {mobileMoreTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsMoreOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-h-[52px] ${
                      isActive
                        ? 'bg-teal-50 border-teal-400 text-teal-900 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold'
                    }`}
                  >
                    <span className={`p-2 rounded-xl ${isActive ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      {tab.icon}
                    </span>
                    <span className="text-xs truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
