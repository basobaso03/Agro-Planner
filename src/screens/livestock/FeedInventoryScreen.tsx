import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { FeedEventSheet } from '../../sheets/expenses/FeedEventSheet.tsx';
import { Plus } from 'lucide-react';
import type { OrgMember } from '../../types/agro.ts';

export interface FeedInventoryScreenProps {
  activeMember: OrgMember;
}

export const FeedInventoryScreen: React.FC<FeedInventoryScreenProps> = ({
  activeMember,
}) => {
  const [showFeedSheet, setShowFeedSheet] = useState(false);

  const summaries = dataService.computeFeedInventorySummaries();
  const feedEvents = dataService.getState().feedLedger || [];

  const totalBags = summaries.reduce((acc: number, s: any) => acc + (s.remainingBags || s.currentBagsBalance || 0), 0);
  const totalKg = summaries.reduce((acc: number, s: any) => acc + (s.remainingKg || s.currentKgBalance || 0), 0);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E8DFCE] p-4.5 rounded-2xl shadow-xs">
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Total Feed Stock</div>
          <div className="text-2xl font-black font-mono text-slate-950 tracking-tight mt-0.5">{totalBags} bags</div>
          <div className="text-xs text-emerald-700 font-bold mt-1">{(totalKg / 1000).toFixed(2)} metric tons</div>
        </div>

        <div className="bg-white border border-[#E8DFCE] p-4.5 rounded-2xl shadow-xs">
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Distinct Rations</div>
          <div className="text-2xl font-black font-mono text-slate-950 tracking-tight mt-0.5">
            {summaries.length} formulas
          </div>
          <div className="text-xs text-slate-600 font-medium mt-1">Append-only ledger</div>
        </div>
      </div>

      {/* Stock Cards List */}
      <div className="space-y-3">
        <div className="font-black text-slate-950 text-sm">Feed Formulations & Rations</div>
        {summaries.length === 0 ? (
          <EmptyState
            icon="🌾"
            title="No Feed Logged"
            message="Record inward stock-in feed bags to begin inventory tracking."
            actionLabel="Log Feed Event"
            onAction={() => setShowFeedSheet(true)}
          />
        ) : (
          summaries.map((item: any, idx: number) => (
            <div
              key={idx}
              className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs flex justify-between items-center text-xs"
            >
              <div>
                <div className="font-bold text-slate-950 text-sm">
                  {item.feedType}
                </div>
                <div className="text-slate-600 font-medium mt-0.5">
                  {item.locationName} · {item.events.length} transactions
                </div>
              </div>

              <div className="text-right">
                <div className="text-base font-black font-mono text-slate-950">
                  {item.remainingBags || item.currentBagsBalance || 0} bags
                </div>
                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                  {(item.remainingKg || item.currentKgBalance || 0).toLocaleString()} kg net
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Ledger Events */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Recent Ledger Dispatches</div>
        {feedEvents.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">No events logged yet.</div>
        ) : (
          <div className="space-y-2">
            {feedEvents.slice(0, 10).map((ev: any) => (
              <div
                key={ev.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {ev.direction.replace(/_/g, ' ')} · {ev.feedType}
                  </div>
                  <div className="text-slate-500 mt-0.5">{ev.note}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${ev.bagsDelta > 0 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                  >
                    {ev.bagsDelta > 0 ? `+${ev.bagsDelta}` : ev.bagsDelta} bags
                  </span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(ev.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Fab icon={Plus} label="Log Feed" onClick={() => setShowFeedSheet(true)} />

      {/* Sheet */}
      <FeedEventSheet
        isOpen={showFeedSheet}
        onClose={() => setShowFeedSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

