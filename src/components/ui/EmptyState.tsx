import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon | string;
  title: string;
  description?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconOrEmoji,
  title,
  description,
  message,
  actionLabel,
  onAction,
}) => {
  const desc = description || message || '';
  const isEmojiOrString = typeof IconOrEmoji === 'string';

  return (
    <div className="p-8 sm:p-10 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#E8DFCE] my-4 flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs flex items-center justify-center text-slate-400 mb-3">
        {isEmojiOrString ? (
          <span className="text-2xl select-none">{IconOrEmoji}</span>
        ) : (
          <IconOrEmoji className="w-7 h-7" />
        )}
      </div>
      <h3 className="text-sm font-black text-slate-800 tracking-tight">{title}</h3>
      {desc && <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{desc}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
