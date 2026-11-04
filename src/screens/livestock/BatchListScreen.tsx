import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { Chip } from '../../components/ui/Chip.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { formatMoney } from '../../utils/currency.ts';
import { RegisterBatchSheet } from '../../sheets/livestock/RegisterBatchSheet.tsx';
import { Plus } from 'lucide-react';
import type { LivestockComputedStatus, OrgMember } from '../../types/agro.ts';

export interface BatchListScreenProps {
  activeMember: OrgMember;
  onRefresh?: () => Promise<void>;
}

export const BatchListScreen: React.FC<BatchListScreenProps> = ({ activeMember }) => {
  const { navigate } = useNavigation();
  const [selectedSpecies, setSelectedSpecies] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterSheet, setShowRegisterSheet] = useState(false);

  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );
  const statuses: LivestockComputedStatus[] = dataService.computeLivestockStatuses();

  const filteredStatuses = statuses.filter((st: LivestockComputedStatus) => {
    if (selectedLocation !== 'ALL' && st.entry.locationId !== selectedLocation) return false;
    if (selectedSpecies !== 'ALL' && st.entry.species !== selectedSpecies) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = st.entry.nameOrTag.toLowerCase().includes(q);
      const matchSpecies = st.entry.species.toLowerCase().includes(q);
      if (!matchName && !matchSpecies) return false;
    }
    return true;
  });

  const allSpecies: string[] = Array.from(new Set(statuses.map((s: LivestockComputedStatus) => s.entry.species)));

  const totalHeadcount = filteredStatuses.reduce((acc: number, s: LivestockComputedStatus) => acc + s.currentLiveHeadcount, 0);
  const totalValuation = filteredStatuses.reduce((acc: number, s: LivestockComputedStatus) => acc + s.estimatedCurrentValueUsd, 0);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Metric Bar */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-400 font-medium">Total Live Animals</div>
          <div className="text-2xl font-bold tracking-tight mt-0.5">{totalHeadcount} head</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium">Estimated Asset Value</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-400 mt-0.5">
            {formatMoney(totalValuation)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search batches or tags..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
          {locations.length > 1 && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            >
              <option value="ALL">All Sites</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Species horizontal filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Chip
            label="All Batches"
            count={statuses.length}
            selected={selectedSpecies === 'ALL'}
            onClick={() => setSelectedSpecies('ALL')}
          />
          {allSpecies.map((spec: string) => {
            const count = statuses.filter((s: LivestockComputedStatus) => s.entry.species === spec).length;
            return (
              <Chip
                key={spec}
                label={spec}
                count={count}
                selected={selectedSpecies === spec}
                onClick={() => setSelectedSpecies(spec)}
              />
            );
          })}
        </div>
      </div>

      {/* Batch Cards List */}
      {filteredStatuses.length === 0 ? (
        <EmptyState
          icon="🐔"
          title="No Livestock Batches Found"
          message={searchQuery ? 'Try adjusting your search criteria.' : 'Register your first batch of broilers, goats, or cattle.'}
          actionLabel="Register Batch"
          onAction={() => setShowRegisterSheet(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredStatuses.map((item) => {
            const isReady = item.daysLeftUntilSale <= 0;
            const progress = Math.min(100, Math.max(0, item.progressPercentage));

            return (
              <div
                key={item.entry.id}
                onClick={() => navigate('livestock-detail', { id: item.entry.id })}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs active:scale-[0.99] transition-all cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xl shrink-0">
                      {item.entry.species === 'Broilers' || item.entry.species === 'Layers'
                        ? '🐔'
                        : item.entry.species.includes('Goat')
                        ? '🐐'
                        : item.entry.species === 'Cattle'
                        ? '🐂'
                        : '🐾'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {item.entry.nameOrTag}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.entry.locationName || 'Farm Site'} · {item.formattedCurrentAge}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isReady
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : item.daysLeftUntilSale <= 7
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.countdownBadgeText}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Market readiness</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-center text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400">Headcount</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {item.currentLiveHeadcount} head
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Avg Weight</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {item.latestWeightAvgKg ? `${item.latestWeightAvgKg} kg` : 'Pending'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Est. Value</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatMoney(item.estimatedCurrentValueUsd)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button */}
      <Fab icon={Plus} label="Register Batch" onClick={() => setShowRegisterSheet(true)} />

      {/* Bottom Sheet */}
      <RegisterBatchSheet
        isOpen={showRegisterSheet}
        onClose={() => setShowRegisterSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

