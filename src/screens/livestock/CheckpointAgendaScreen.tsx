import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface CheckpointAgendaScreenProps {
  activeMember: OrgMember;
}

export const CheckpointAgendaScreen: React.FC<CheckpointAgendaScreenProps> = ({
  activeMember,
}) => {
  const { navigate } = useNavigation();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('PENDING');

  const statuses = dataService.computeLivestockStatuses();

  // Aggregate all checkpoints across batches
  const agendaItems: Array<{
    batchId: string;
    batchName: string;
    species: string;
    locationName: string;
    checkpointId: string;
    dayTarget: number;
    title: string;
    category: string;
    completed: boolean;
    scheduledDate?: string;
  }> = [];

  for (const st of statuses) {
    const entryDate = new Date(st.entry.entryDate).getTime();
    for (const chk of st.protocols) {
      const scheduledMs = entryDate + chk.dayTarget * 86400000;
      agendaItems.push({
        batchId: st.entry.id,
        batchName: st.entry.nameOrTag,
        species: st.entry.species,
        locationName: st.entry.locationName,
        checkpointId: chk.id,
        dayTarget: chk.dayTarget,
        title: chk.title,
        category: chk.category,
        completed: chk.completed,
        scheduledDate: new Date(scheduledMs).toISOString().split('T')[0],
      });
    }
  }

  // Sort by scheduledDate ascending
  agendaItems.sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

  const filteredItems = agendaItems.filter((item) => {
    if (filter === 'PENDING') return !item.completed;
    if (filter === 'COMPLETED') return item.completed;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Info */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
        <h1 className="text-base font-bold">Protocol & Health Agenda</h1>
        <p className="text-xs text-slate-400 mt-1">
          Chronological schedule of vaccinations, feed transitions, and biosecurity checks across all batches.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-center">
        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className={`py-2 rounded-lg transition-all ${filter === 'PENDING'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          Pending / Due
        </button>
        <button
          type="button"
          onClick={() => setFilter('COMPLETED')}
          className={`py-2 rounded-lg transition-all ${filter === 'COMPLETED'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          Completed
        </button>
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`py-2 rounded-lg transition-all ${filter === 'ALL'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          All Items ({agendaItems.length})
        </button>
      </div>

      {/* Agenda list */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No Agenda Items"
          message={filter === 'PENDING' ? 'All scheduled protocols have been completed!' : 'No protocol checkpoints found.'}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item: any, idx: number) => (
            <div
              key={`${item.batchId}-${item.checkpointId}-${idx}`}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    dataService.toggleMilestone(item.batchId, item.checkpointId, !item.completed, activeMember);
                  }}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-all ${item.completed
                      ? 'bg-emerald-500 text-white'
                      : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500'
                    }`}
                >
                  ✓
                </button>
                <div>
                  <div className={`font-bold ${item.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    Day {item.dayTarget}: {item.title}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {item.batchName} ({item.species}) · {item.locationName}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {item.scheduledDate}
                </span>
                <div
                  onClick={() => navigate('livestock-detail', { id: item.batchId })}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 cursor-pointer hover:underline"
                >
                  View Batch →
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

