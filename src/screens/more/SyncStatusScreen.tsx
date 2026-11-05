import React, { useState, useEffect } from 'react';
import { outboxService, OutboxItem } from '../../services/outbox.ts';
import { getNetworkStatus } from '../../native/network.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export interface SyncStatusScreenProps {
  activeMember: OrgMember;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState(() => outboxService.getStatus());
  const [queue, setQueue] = useState<OutboxItem[]>(() => outboxService.getQueue());
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'FAILED' | 'PENDING'>('ALL');

  const refreshState = () => {
    setStatus(outboxService.getStatus());
    setQueue(outboxService.getQueue());
  };

  useEffect(() => {
    const unsub = outboxService.subscribe(() => {
      refreshState();
    });
    getNetworkStatus().then((s: any) => setIsOnline(Boolean(s?.connected)));
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await outboxService.flush();
      refreshState();
      showToast({
        type: 'success',
        title: 'Sync Processed',
        message: 'Outbox flush attempted.',
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

  const handleRetryAllFailed = async () => {
    setIsSyncing(true);
    try {
      outboxService.retryFailed();
      refreshState();
      showToast({
        type: 'info',
        title: 'Retrying Mutations',
        message: 'Failed items marked as pending and retry initiated.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Retry Error',
        message: err?.message || 'Failed to retry items.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllFailed = () => {
    outboxService.clearFailed();
    refreshState();
    showToast({
      type: 'info',
      title: 'Failed Items Cleared',
      message: 'Failed sync errors dismissed from outbox queue.',
    });
  };

  const handleClearEntireQueue = () => {
    if (window.confirm('Are you sure you want to clear the entire offline outbox? Unsynced changes will not be pushed to the cloud.')) {
      outboxService.clearQueue();
      refreshState();
      showToast({
        type: 'info',
        title: 'Queue Emptied',
        message: 'All outbox records cleared.',
      });
    }
  };

  const handleRetrySingle = (id: string) => {
    outboxService.retryItem(id);
    refreshState();
    showToast({
      type: 'info',
      title: 'Retrying Item',
      message: 'Mutation scheduled for retry.',
    });
  };

  const handleDismissSingle = (id: string) => {
    outboxService.removeItem(id);
    refreshState();
    showToast({
      type: 'info',
      title: 'Item Dismissed',
      message: 'Mutation removed from outbox queue.',
    });
  };

  const filteredQueue = queue.filter((item) => {
    if (filterMode === 'FAILED') return item.status === 'FAILED';
    if (filterMode === 'PENDING') return item.status === 'PENDING' || item.status === 'SYNCING';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-3.5 sm:p-5 pb-24 max-w-3xl mx-auto w-full space-y-4">
      {/* Network & Queue Hero */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-black text-slate-950">{isOnline ? 'Cloud Connection Active' : 'Offline Mode'}</span>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            {status.failedCount > 0
              ? `${status.failedCount} issue(s) require review`
              : status.pendingCount === 0
                ? 'All Changes Synced'
                : `${status.pendingCount} Pending`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F0EBE1] text-xs">
          <div>
            <div className="text-slate-600 font-medium">Queued Outbox Items</div>
            <div className="text-2xl font-black font-mono text-slate-950 mt-0.5">{status.pendingCount}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-600 font-medium">Sync Errors / Failed</div>
            <div className={`text-2xl font-black font-mono mt-0.5 ${status.failedCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
              {status.failedCount}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          {status.failedCount > 0 ? (
            <>
              <button
                type="button"
                onClick={handleRetryAllFailed}
                disabled={isSyncing}
                className="py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Retry {status.failedCount} Failed</span>
              </button>
              <button
                type="button"
                onClick={handleClearAllFailed}
                disabled={isSyncing}
                className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dismiss {status.failedCount} Errors</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || status.pendingCount === 0}
              className="sm:col-span-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Outbox...' : 'Force Cloud Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Advisory on Permission Denied / Cloud Sync */}
      {status.failedCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Why are mutations failing to sync?</span>
          </div>
          <p className="text-amber-900 leading-relaxed font-medium">
            Mutations fail when cloud Firestore security rules reject writes (e.g. unverified guest session or missing admin cloud permissions).
            <strong> Your data is safe locally on this device!</strong> You can dismiss these sync alerts without losing your local records.
          </p>
        </div>
      )}

      {/* Outbox Items Header & Filter Tabs */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-800" />
            <h3 className="text-sm font-black text-slate-950">
              Outbox Mutation Logs ({queue.length})
            </h3>
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${filterMode === 'ALL'
                ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              All ({queue.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('FAILED')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${filterMode === 'FAILED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 hover:text-rose-800'
                }`}
            >
              Failed ({status.failedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('PENDING')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${filterMode === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:text-amber-900'
                }`}
            >
              Pending ({status.pendingCount})
            </button>
          </div>
        </div>

        {/* Queue List */}
        {filteredQueue.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-[#E8DFCE] text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="font-black text-slate-950 text-sm">
              {filterMode === 'FAILED' ? 'No Sync Errors' : 'Outbox is Clean'}
            </div>
            <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto">
              All records on this device are in sync with cloud servers.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredQueue.map((item) => {
              const isFailed = item.status === 'FAILED';
              const isExpanded = expandedItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all text-xs overflow-hidden ${isFailed
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-white border-[#E8DFCE] shadow-xs'
                    }`}
                >
                  <div className="p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider ${isFailed
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                            }`}
                        >
                          {item.collectionPath}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px] font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                          {item.docId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'FAILED'
                            ? 'bg-rose-200 text-rose-900'
                            : item.status === 'SYNCING'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-slate-200 text-slate-800'
                            }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Error Message Details */}
                    {item.lastError && (
                      <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-800 font-medium flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div>{item.lastError}</div>
                          {item.errorCode && (
                            <div className="font-mono text-[10px] text-rose-500 mt-0.5">Code: {item.errorCode}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata & Actions */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                        </span>
                        <span>Attempts: {item.attempts}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{isExpanded ? 'Hide' : 'Payload'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => handleRetrySingle(item.id)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                            title="Retry this mutation"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDismissSingle(item.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Dismiss / remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Payload Preview */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-950 text-emerald-400 border-t border-slate-800 font-mono text-[10px] overflow-x-auto max-h-56">
                      <pre>{JSON.stringify(item.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {queue.length > 0 && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleClearEntireQueue}
              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Entire Outbox Queue</span>
            </button>
          </div>
        )}
      </div>

      {/* Offline Reliability Architecture Card */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-2 text-xs">
        <div className="font-black text-slate-950 text-sm">Offline First Protection</div>
        <p className="text-slate-800 leading-relaxed font-normal">
          The app uses a persistent IndexedDB queue and reconciliation layer. Even when you are offline in the field, all sales, repayments, feed, and livestock events are saved locally and will never be overwritten when cloud sync resumes.
        </p>
      </div>
    </div>
  );
};
