import React from 'react';
import { Clock } from 'lucide-react';
import { recentsManager, RecentPage } from '../../navigation/recents.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';

export interface RecentChipsProps {
  isAgroEnabled: boolean;
}

export const RecentChips: React.FC<RecentChipsProps> = ({ isAgroEnabled }) => {
  const { navigate } = useNavigation();
  const recents = recentsManager.getRecents(isAgroEnabled);

  if (recents.length === 0) return null;

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Recently Opened</span>
        </span>
        <button
          type="button"
          onClick={() => navigate('recentPages')}
          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
        >
          See All ›
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {recents.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.routeId, item.params, item.title)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white border border-[#E8DFCE] hover:border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate max-w-[220px]">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

