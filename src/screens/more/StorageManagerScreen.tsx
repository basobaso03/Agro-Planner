import React, { useState, useEffect } from 'react';
import { appStorage } from '../../services/storage.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StorageManagerScreenProps {
  activeMember: OrgMember;
}

export const StorageManagerScreen: React.FC<StorageManagerScreenProps> = () => {
  const { showToast } = useToast();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setEstimate({
          usage: est.usage || 0,
          quota: est.quota || 0,
        });
      });
    }
  }, []);

  const handleClearCache = async () => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      showToast({
        type: 'success',
        title: 'Cache Cleared',
        message: 'Temporary images and assets pruned from device memory.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Failed',
        message: 'Could not clear cache.',
      });
    }
  };

  const usageMb = (estimate.usage / (1024 * 1024)).toFixed(2);
  const quotaMb = (estimate.quota / (1024 * 1024)).toFixed(0);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Storage Hero */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          High-Capacity IndexedDB Storage
        </div>
        <div className="text-2xl font-bold">{usageMb} MB Used</div>
        <div className="text-xs text-slate-400">
          Device Available Quota: ~{quotaMb} MB (IndexedDB replaces 5MB localStorage)
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Storage Maintenance</div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          The app stores cryptographic blocks, livestock photos, and offline journals locally. Pruning temporary cache will free storage while preserving all ledgers.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleClearCache}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs text-center hover:bg-slate-50 active:scale-95 transition-all"
          >
            Prune Temporary Image Cache
          </button>
        </div>
      </div>
    </div>
  );
};

