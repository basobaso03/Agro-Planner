import React, { useState, useEffect } from 'react';
import { outboxService } from '../../services/outbox.ts';
import { getNetworkStatus } from '../../native/network.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface SyncStatusScreenProps {
  activeMember: OrgMember;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState(() => outboxService.getStatus());
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = outboxService.subscribe(setStatus);
    getNetworkStatus().then((s: any) => setIsOnline(Boolean(s?.connected)));
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await outboxService.flush();
      showToast({
        type: 'success',
        title: 'Sync Complete',
        message: 'All queued offline mutations processed successfully.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Sync Interrupted',
        message: err?.message || 'Check network connection.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Network & Queue Hero */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-sm font-bold">{isOnline ? 'Cloud Online' : 'Offline Mode'}</span>
          </div>
          <span className="text-xs text-slate-400">
            {status.pendingCount === 0 ? 'All Changes Synced' : `${status.pendingCount} Pending`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800 dark:border-slate-700 text-xs">
          <div>
            <div className="text-slate-400">Queued Outbox Items</div>
            <div className="text-2xl font-bold text-white mt-0.5">{status.pendingCount}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400">Failed / Retrying</div>
            <div className={`text-2xl font-bold mt-0.5 ${status.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {status.failedCount}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing || status.pendingCount === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>{isSyncing ? 'Flushing Outbox...' : 'Force Cloud Sync'}</span>
        </button>
      </div>

      {/* Offline Reliability Architecture Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-2 text-xs">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Offline First Protection</div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          The app uses a persistent IndexedDB queue and reconciliation layer. Even when you are offline in the field, all sales, repayments, feed, and livestock events are saved locally and will never be overwritten when cloud sync resumes.
        </p>
      </div>
    </div>
  );
};

