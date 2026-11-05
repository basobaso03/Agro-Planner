import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { recentsManager } from '../../navigation/recents.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface RecentScreenProps {
  activeMember: OrgMember;
  isAgroEnabled?: boolean;
}

export const RecentScreen: React.FC<RecentScreenProps> = ({
  isAgroEnabled = true,
}) => {
  const { navigate } = useNavigation();
  const [recents, setRecents] = useState(recentsManager.getRecents(isAgroEnabled));

  const handleClear = () => {
    recentsManager.clear();
    setRecents([]);
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-slate-950">Opened Pages & Recents</h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">Quickly resume recently visited records</p>
        </div>
        {recents.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      {recents.length === 0 ? (
        <EmptyState
          icon="🕒"
          title="No Opened Pages"
          message="Pages and detail sheets you open will appear here for fast multitasking."
        />
      ) : (
        <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden">
          {recents.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(item.routeId, item.params)}
              className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F5] cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-center justify-center text-lg shrink-0">
                  {item.icon || '📄'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-950">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-0.5">{item.subtitle}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 font-mono font-medium shrink-0">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

