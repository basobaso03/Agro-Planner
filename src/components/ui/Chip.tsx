import React from 'react';

export interface ChipProps {
  label: string;
  count?: number;
  isSelected?: boolean;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'amber' | 'rose' | 'emerald';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  count,
  isSelected = false,
  selected = false,
  onClick,
  variant = 'default',
}) => {
  const active = isSelected || selected;
  // If count is 0, render neutrally muted styling instead of loud amber/rose (Fixes B21)
  const isZero = count === 0;

  const getStyle = () => {
    if (active) {
      if (variant === 'amber') return 'bg-amber-500 text-white border-amber-500 shadow-xs';
      if (variant === 'rose') return 'bg-rose-500 text-white border-rose-500 shadow-xs';
      if (variant === 'emerald') return 'bg-emerald-600 text-white border-emerald-600 shadow-xs';
      return 'bg-slate-900 text-white border-slate-900 shadow-xs';
    }

    if (isZero) {
      return 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200';
    }

    if (variant === 'amber') return 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100';
    if (variant === 'rose') return 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100';
    if (variant === 'emerald') return 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100';

    return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-1.5 px-3 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${getStyle()}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
            isSelected
              ? 'bg-white/20 text-white'
              : isZero
              ? 'bg-slate-200 text-slate-500'
              : 'bg-black/10 text-current'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

