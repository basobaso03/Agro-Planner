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
      <div className="bg-white border border-[#E8DFCE] p-4.5 rounded-2xl shadow-xs">
        <h1 className="text-base font-black text-slate-950">Checkpoint & Health Agenda</h1>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          Chronological schedule of vaccinations, feed transitions, and biosecurity checks. All organization members receive a 07:00 AM morning dispatch alert when milestone dates arrive.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold text-center">
        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className={`py-2 rounded-lg transition-all cursor-pointer ${filter === 'PENDING'
            ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Pending / Due
        </button>
        <button
          type="button"
          onClick={() => setFilter('COMPLETED')}
          className={`py-2 rounded-lg transition-all cursor-pointer ${filter === 'COMPLETED'
            ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Completed
        </button>
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`py-2 rounded-lg transition-all cursor-pointer ${filter === 'ALL'
            ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
            : 'text-slate-600 hover:text-slate-900'
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
          message={filter === 'PENDING' ? 'All scheduled checkpoints have been completed!' : 'No checkpoints found.'}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item: any, idx: number) => (
            <div
              key={`${item.batchId}-${item.checkpointId}-${idx}`}
              className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    dataService.toggleMilestone(item.batchId, item.checkpointId, !item.completed, activeMember);
                  }}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer ${item.completed
                    ? 'bg-emerald-600 text-white'
                    : 'border-2 border-slate-300 text-transparent hover:border-emerald-600'
                    }`}
                >
                  ✓
                </button>
                <div>
                  <div className={`font-bold ${item.completed ? 'line-through text-slate-400' : 'text-slate-950'}`}>
                    Day {item.dayTarget}: {item.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-600 font-medium">
                      {item.batchName} ({item.species}) · {item.locationName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900" title="Morning alert sent to all org members">
                  🔔 {item.scheduledDate} · 07:00 AM
                </span>
                <div
                  onClick={() => navigate('livestock-detail', { id: item.batchId })}
                  className="text-[11px] text-emerald-700 font-bold mt-1 cursor-pointer hover:underline"
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

