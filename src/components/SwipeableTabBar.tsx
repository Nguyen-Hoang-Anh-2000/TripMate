import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SwipeableTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export const SwipeableTabBar: React.FC<SwipeableTabBarProps> = ({
  tabs,
  activeTab,
  onSelectTab,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

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

  // Mouse drag-to-scroll handlers (kéo lướt qua)
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
    const walk = (x - startX) * 1.5; // Drag speed multiplier
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

  return (
    <div className="relative group/tabs flex items-center border-b border-slate-200 py-1 select-none">
      
      {/* Scroll Left Button if overflowed */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScrollClick('left')}
          className="absolute left-0 z-10 p-1.5 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md rounded-full text-slate-600 hover:text-slate-900 transition-all cursor-pointer -ml-2 sm:-ml-3"
          title="Lướt sang trái"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Swipeable / Draggable Scroll Container */}
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

      {/* Scroll Right Button if overflowed */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScrollClick('right')}
          className="absolute right-0 z-10 p-1.5 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md rounded-full text-slate-600 hover:text-slate-900 transition-all cursor-pointer -mr-2 sm:-mr-3"
          title="Lướt sang phải"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

    </div>
  );
};
