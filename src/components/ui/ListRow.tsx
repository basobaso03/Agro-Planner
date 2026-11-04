import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface ListRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  previewAmount?: string;
  badge?: string;
  badgeVariant?: 'amber' | 'rose' | 'emerald' | 'slate';
  onClick?: () => void;
  showChevron?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  iconBg = 'bg-slate-100',
  iconColor = 'text-slate-700',
  title,
  subtitle,
  previewAmount,
  badge,
  badgeVariant = 'slate',
  onClick,
  showChevron = true,
}) => {
  const badgeColors = {
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    rose: 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse',
    emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[56px] py-2.5 px-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition-colors cursor-pointer group"
    >
      {/* Column 1: Leading Icon Tile */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-xs`}>
        {icon}
      </div>

      {/* Column 2: Title and Subtitle */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="text-sm font-bold text-slate-900 truncate tracking-tight group-hover:text-amber-600 transition-colors">
          {title}
        </div>
        {subtitle && <div className="text-xs text-slate-500 font-medium truncate mt-0.5">{subtitle}</div>}
      </div>

      {/* Column 3: Trailing Preview Amount & Chevron */}
      <div className="flex items-center gap-2.5 shrink-0 text-right">
        <div className="flex flex-col items-end">
          {previewAmount && (
            <div className="text-sm font-black font-mono text-slate-900 tracking-tight">{previewAmount}</div>
          )}
          {badge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${badgeColors[badgeVariant]}`}
            >
              {badge}
            </span>
          )}
        </div>
        {showChevron && <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />}
      </div>
    </button>
  );
};

