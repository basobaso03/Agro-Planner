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
  showNumbers?: boolean;
  onRefresh?: () => Promise<void>;
  onOpenSiteManager?: () => void;
}

export const BatchListScreen: React.FC<BatchListScreenProps> = ({
  activeMember,
  showNumbers = true,
  onOpenSiteManager,
}) => {
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
      <div className="bg-white border border-[#E8DFCE] p-4.5 rounded-2xl shadow-xs grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Total Live Animals</div>
          <div className="text-2xl font-black text-slate-950 tracking-tight mt-0.5">
            {showNumbers ? `${totalHeadcount} head` : '•••• head'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Estimated Asset Value</div>
          <div className="text-2xl font-black tracking-tight text-emerald-700 mt-0.5">
            {formatMoney(totalValuation, showNumbers)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 min-w-0 w-full">
          <div className="flex-1 min-w-0">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batches or tags..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 placeholder:text-slate-400 text-sm focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
          {locations.length > 0 ? (
            <div className="w-36 sm:w-44 shrink-0 min-w-0">
              <select
                value={selectedLocation}
                onChange={(e) => {
                  if (e.target.value === '__ADD_SITE__') {
                    onOpenSiteManager?.();
                  } else {
                    setSelectedLocation(e.target.value);
                  }
                }}
                className="w-full truncate px-2.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-xs font-bold focus:outline-none focus:border-amber-500 shadow-xs cursor-pointer"
              >
                <option value="ALL">All Sites ({locations.length})</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
                <option value="__ADD_SITE__">📍 Manage Sites</option>
              </select>
            </div>
          ) : (
            onOpenSiteManager && (
              <button
                type="button"
                onClick={onOpenSiteManager}
                className="px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold shrink-0 cursor-pointer shadow-xs"
              >
                ＋ Add Site
              </button>
            )
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
                className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs active:scale-[0.99] transition-all cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
                      {item.entry.species === 'Broilers' || item.entry.species === 'Layers'
                        ? '🐔'
                        : item.entry.species.includes('Goat')
                          ? '🐐'
                          : item.entry.species === 'Cattle'
                            ? '🐂'
                            : '🐾'}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950 leading-tight">
                        {item.entry.nameOrTag}
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-0.5">
                        {item.entry.locationName || 'Farm Site'} · {item.formattedCurrentAge}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 whitespace-nowrap text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isReady
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : item.daysLeftUntilSale <= 7
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                  >
                    {item.countdownBadgeText}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 font-medium mb-1">
                    <span>Market readiness</span>
                    <span className="font-bold text-slate-950">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isReady ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0EBE1] text-center text-xs">
                  <div>
                    <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Headcount</div>
                    <div className="font-black font-mono text-slate-950 mt-0.5">
                      {showNumbers ? `${item.currentLiveHeadcount} head` : '•••• head'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Avg Weight</div>
                    <div className="font-black font-mono text-slate-950 mt-0.5">
                      {showNumbers ? (item.latestWeightAvgKg ? `${item.latestWeightAvgKg} kg` : 'Pending') : '••••'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Est. Value</div>
                    <div className="font-black font-mono text-emerald-700 mt-0.5">
                      {formatMoney(item.estimatedCurrentValueUsd, showNumbers)}
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

