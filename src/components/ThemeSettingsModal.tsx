import React from 'react';
import { X, Check, Type, Sparkles, Sliders, SunMedium } from 'lucide-react';
import { FONT_OPTIONS, type FontStyleId } from '../types/theme.ts';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFontId: FontStyleId;
  onSelectFont: (fontId: FontStyleId) => void;
  backgroundIntensity: 'subtle' | 'standard' | 'expressive';
  onSelectBackgroundIntensity: (intensity: 'subtle' | 'standard' | 'expressive') => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  isOpen,
  onClose,
  activeFontId,
  onSelectFont,
  backgroundIntensity,
  onSelectBackgroundIntensity,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
      className="modal-overlay-responsive animate-in fade-in duration-200"
    >
      <div className="modal-dialog-responsive max-w-2xl relative">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-[#F0EBE1] bg-[#FAF8F5] gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <Type className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="theme-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2"
              >
                <span>Typography & Solora Theme Studio</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0 whitespace-nowrap">
                  5 Fonts
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Choose your preferred typography and background contour intensity
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Theme Settings"
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Section 1: Font Selector */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Select Primary Typography (5 Handpicked Fonts)</span>
              </label>
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 self-start sm:self-auto shrink-0 whitespace-nowrap">
                Live App Sync
              </span>
            </div>

            <div className="space-y-3">
              {FONT_OPTIONS.map((font) => {
                const isSelected = activeFontId === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => onSelectFont(font.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/60 border-amber-500/70 shadow-xs ring-1 ring-amber-500/20'
                        : 'bg-white border-[#E8DFCE] hover:border-slate-300 hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs sm:text-sm font-bold text-slate-900 ${font.cssClass}`}>
                            {font.name}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                            {font.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 sm:mb-2.5 leading-relaxed break-words">
                          {font.description}
                        </p>

                        {/* Live Typography Preview Strip */}
                        <div
                          className={`p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100 ${font.cssClass}`}
                        >
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 break-words">
                            {font.previewText}
                          </div>
                          <div className="text-xs text-emerald-700 font-medium tabular-nums mt-0.5">
                            {font.sampleFigures}
                          </div>
                        </div>
                      </div>

                      {/* Active Checkmark Pill */}
                      <div className="shrink-0 mt-0.5">
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                              : 'border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Farm Terrain Background Contour Intensity */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 min-w-0">
                <SunMedium className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Custom Farm Terrain Background Style</span>
              </label>
              <span className="text-xs text-slate-500 font-medium capitalize self-start sm:self-auto shrink-0">
                {backgroundIntensity} Contours
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {(['subtle', 'standard', 'expressive'] as const).map((level) => {
                const isActive = backgroundIntensity === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSelectBackgroundIntensity(level)}
                    className={`py-2.5 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold capitalize border transition-all truncate text-center min-h-[42px] flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'bg-white border-amber-500 text-amber-900 shadow-xs'
                        : 'bg-transparent border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Adjusts the organic elevation contour lines and solar ray ambient lighting behind cards.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#FAF8F5] border-t border-[#F0EBE1] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold transition-all min-h-[42px] flex items-center justify-center cursor-pointer shadow-xs"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
