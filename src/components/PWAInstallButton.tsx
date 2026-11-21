import React, { useState } from 'react';
import {
  PlusSquare,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  getInstallGuideContent,
  triggerDeviceInstall,
} from '../utils/pwaInstallUtils';

interface PWAInstallButtonProps {
  variant?: 'modal-card' | 'sheet-row';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'modal-card',
}) => {
  const { isVi } = useLanguage();
  const { isInstalled, platform } = usePWAInstall();
  const [justInstalled, setJustInstalled] = useState(false);
  const [inlineFallbackHint, setInlineFallbackHint] = useState<string | null>(null);

  // Suppress install CTA when already running inside standalone installed PWA
  if (isInstalled && !justInstalled) {
    return null;
  }

  const handleClick = async () => {
    setInlineFallbackHint(null);
    const result = await triggerDeviceInstall(platform);
    if (result === 'installed') {
      setJustInstalled(true);
      return;
    }
    if (result === 'unavailable') {
      const guide = getInstallGuideContent(platform, isVi);
      setInlineFallbackHint(guide.steps[1] || guide.steps[0] || null);
    }
  };

  if (justInstalled) {
    return (
      <div className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-bold">
            {isVi ? 'Đã thêm vào màn hình chính!' : 'Added to Home Screen!'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {variant === 'modal-card' ? (
        <button
          type="button"
          onClick={handleClick}
          data-testid="add-to-home-screen-btn"
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/70 active:scale-[0.99] border border-slate-200 hover:border-teal-300 transition-all text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shadow-xs shrink-0">
              <PlusSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900">
                {isVi ? 'Thêm vào màn hình chính' : 'Add to Home Screen'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          data-testid="add-to-home-screen-btn"
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70 hover:bg-teal-50 active:bg-teal-100/70 transition-colors text-left cursor-pointer border border-slate-200/70"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
            <PlusSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900">
              {isVi ? 'Thêm vào màn hình chính' : 'Add to Home Screen'}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-teal-600 shrink-0" />
        </button>
      )}

      {inlineFallbackHint && (
        <p className="text-[11px] text-slate-500 px-2 leading-relaxed">
          {inlineFallbackHint}
        </p>
      )}
    </div>
  );
};
