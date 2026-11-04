import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface FabProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  variant?: 'amber' | 'emerald' | 'slate' | 'rose';
}

export const Fab: React.FC<FabProps> = ({
  icon: Icon,
  label,
  onClick,
  variant = 'amber',
}) => {
  const variantStyles = {
    amber: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25',
    slate: 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/25',
    rose: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25',
  };

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 z-40 pointer-events-none">
      <button
        type="button"
        onClick={onClick}
        aria-label={label || 'Action'}
        className={`pointer-events-auto h-13 px-4 rounded-full flex items-center justify-center gap-2 shadow-xl border border-white/20 active:scale-95 transition-all cursor-pointer font-black text-sm tracking-tight ${variantStyles[variant]}`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {label && <span>{label}</span>}
      </button>
    </div>
  );
};

