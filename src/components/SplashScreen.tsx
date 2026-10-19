import React, { useEffect, useState } from 'react';
import { LogoSvg } from './BrandLogos.tsx';
import { X } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number;
  isManualPreview?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  duration = 2400,
  isManualPreview = false,
}) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Start fade-out before total duration
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, Math.max(800, duration - 600));

    // Complete dismissal
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  const handleClose = () => {
    setFadingOut(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center bg-[#FAF7F2] px-6 py-10 sm:py-14 select-none overflow-hidden transition-all duration-700 ease-in-out ${
        fadingOut ? 'opacity-0 scale-98 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Agro Planner Splash Screen"
    >
      {/* Background Ambient Glow & Organic Particle Accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-amber-400/10 rounded-full blur-2xl" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-600/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/5 rounded-full blur-2xl" />
      </div>

      {/* Manual Preview Close Button */}
      {isManualPreview && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close splash preview"
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-white/80 hover:bg-white border border-[#E0D7C6] text-slate-500 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Top Spacer to balance flex layout */}
      <div className="w-full h-8" />

      {/* Center Hero Zone: Icon + Styled Animated Text */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm sm:max-w-md mx-auto my-auto space-y-6">
        {/* Centered Organic Sprout AP Logo with Glowing Aura */}
        <div className="relative group">
          {/* Pulsing ambient border rings */}
          <div className="absolute -inset-3 rounded-[34px] bg-gradient-to-tr from-emerald-500/20 via-amber-400/20 to-emerald-400/20 blur-md animate-pulse" />
          <div className="absolute -inset-1 rounded-[30px] border border-emerald-500/30 animate-spin-slow opacity-60" />

          {/* Logo Container */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-[28px] overflow-hidden shadow-2xl border-2 border-emerald-600/20 bg-[#064e3b] flex items-center justify-center transform transition-transform duration-700 ease-out hover:scale-105 animate-fade-in-scale">
            <LogoSvg size="100%" />
          </div>
        </div>

        {/* Animated Gradient Text: "Agro Planner" */}
        <div className="space-y-2">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text animate-gradient-flow"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #047857 0%, #10b981 25%, #f59e0b 50%, #34d399 75%, #047857 100%)',
              backgroundSize: '200% auto',
            }}
          >
            Agro Planner
          </h1>
          <p className="text-xs sm:text-sm font-semibold tracking-wider text-slate-500 uppercase">
            Multi-Location Livestock &amp; Syndicate ERP
          </p>
        </div>

        {/* Sleek Gradient Shimmer Progress Line */}
        <div className="w-36 sm:w-44 h-1 rounded-full bg-[#E0D7C6]/60 overflow-hidden relative mt-2 shadow-inner">
          <div
            className="absolute inset-y-0 w-1/2 rounded-full animate-shimmer-slide"
            style={{
              background: 'linear-gradient(90deg, #10b981, #f59e0b, #10b981)',
            }}
          />
        </div>
      </div>

      {/* Bottom Zone: Well Gradient Colored Text "BASOBASO SOFTWARES" */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-1.5 pb-2">
        <span className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">
          Engineered by
        </span>
        <span
          className="text-xs sm:text-sm font-black tracking-[0.22em] uppercase text-transparent bg-clip-text animate-gradient-flow"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #b45309 0%, #be123c 35%, #047857 70%, #b45309 100%)',
            backgroundSize: '200% auto',
          }}
        >
          BASOBASO SOFTWARES
        </span>
      </div>
    </div>
  );
};
