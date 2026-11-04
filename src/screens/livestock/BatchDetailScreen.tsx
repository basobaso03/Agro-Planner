import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { LogLivestockActionSheet } from '../../sheets/livestock/LogLivestockActionSheet.tsx';
import { CheckpointSheet } from '../../sheets/livestock/CheckpointSheet.tsx';
import { HeadcountContraSheet } from '../../sheets/livestock/HeadcountContraSheet.tsx';
import { LivestockValuationSheet } from '../../sheets/livestock/LivestockValuationSheet.tsx';
import type { OrgMember, AnimalCheckpoint } from '../../types/agro.ts';

export interface BatchDetailScreenProps {
  batchId?: string;
  activeMember: OrgMember;
}

export const BatchDetailScreen: React.FC<BatchDetailScreenProps> = ({
  batchId,
  activeMember,
}) => {
  const { currentRoute, goBack } = useNavigation();
  const id = batchId || currentRoute.params?.id;

  const [activeSubTab, setActiveSubTab] = useState<
    'OVERVIEW' | 'CHECKPOINTS' | 'FEED' | 'WEIGHTS' | 'GALLERY'
  >('OVERVIEW');

  // Sheet states
  const [showLogAction, setShowLogAction] = useState(false);
  const [showCheckpointSheet, setShowCheckpointSheet] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<AnimalCheckpoint | undefined>(undefined);
  const [showContraSheet, setShowContraSheet] = useState(false);
  const [showValuationSheet, setShowValuationSheet] = useState(false);

  const statuses = dataService.computeLivestockStatuses();
  const batchStatus = statuses.find((s) => s.entry.id === id);

  if (!batchStatus) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <EmptyState
          icon="❓"
          title="Batch Not Found"
          message="This livestock record could not be located in the current database snapshot."
          actionLabel="Go Back"
          onAction={goBack}
        />
      </div>
    );
  }

  const { entry, currentLiveHeadcount, mortalityRatePercent, protocols } = batchStatus;
  const events = dataService.getState().livestockEvents.filter((e) => e.livestockId === entry.id);
  const feedLogs = (dataService.getState().feedLedger || []).filter((f: any) => f.linkedLivestockId === entry.id);
  const weightEvents = events.filter((e) => e.eventType === 'WEIGHT_CHECK' || (e.weightAvgKg && e.weightAvgKg > 0));
  const galleryPhotos = entry.gallery || (entry.imageUrl ? [entry.imageUrl] : []);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Hero Summary Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {entry.species} · {entry.locationName}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {entry.nameOrTag}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Started {new Date(entry.entryDate).toLocaleDateString()} · Age: {batchStatus.formattedCurrentAge}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {batchStatus.countdownBadgeText}
            </span>
            <div className="text-xs text-slate-400 mt-1.5">
              Est. {formatMoney(batchStatus.estimatedCurrentValueUsd)}
            </div>
          </div>
        </div>

        {/* 4-Stat Grid */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center text-xs">
          <div>
            <div className="text-[11px] text-slate-400">Live Count</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {currentLiveHeadcount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Initial</div>
            <div className="text-base font-bold text-slate-500 mt-0.5">
              {entry.initialHeadcount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Mortality</div>
            <div className={`text-base font-bold mt-0.5 ${mortalityRatePercent > 5 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {mortalityRatePercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Avg Weight</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {batchStatus.latestWeightAvgKg ? `${batchStatus.latestWeightAvgKg}kg` : '—'}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowLogAction(true)}
            className="py-2 px-1 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-xs text-center"
          >
            + Log Event
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCheckpoint(undefined);
              setShowCheckpointSheet(true);
            }}
            className="py-2 px-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold text-center"
          >
            + Protocol
          </button>
          <button
            type="button"
            onClick={() => setShowValuationSheet(true)}
            className="py-2 px-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold text-center"
          >
            💲 Valuation
          </button>
          <button
            type="button"
            onClick={() => setShowContraSheet(true)}
            className="py-2 px-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold text-center"
          >
            ⚠️ Contra
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <SegmentedControl
        options={[
          { value: 'OVERVIEW', label: 'Overview' },
          { value: 'CHECKPOINTS', label: `Protocols (${protocols.length})` },
          { value: 'FEED', label: `Feed (${feedLogs.length})` },
          { value: 'WEIGHTS', label: `Weights (${weightEvents.length})` },
          { value: 'GALLERY', label: `Photos (${galleryPhotos.length})` },
        ]}
        value={activeSubTab}
        onChange={(val) => setActiveSubTab(val as any)}
      />

      {/* Sub-Tab Content */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
            <div className="font-bold text-slate-900 dark:text-white text-sm">Batch Specifications</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400">Target Duration:</span>{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {entry.targetDurationValue} {entry.targetDurationUnit}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Target Sale Date:</span>{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(entry.targetSaleDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Funding Method:</span>{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {entry.fundingSource || 'CASH_POOL'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Purchase Cost:</span>{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoney(entry.purchaseCostTotal)}
                </span>
              </div>
            </div>
            {entry.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Initial Notes:</span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">{entry.notes}</p>
              </div>
            )}
          </div>

          {/* Recent Lifecycle Events Stream */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="font-bold text-slate-900 dark:text-white text-sm">Lifecycle Event History</div>
            {events.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">No lifecycle events recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {ev.eventType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-500 mt-0.5">{ev.note}</div>
                    </div>
                    <div className="text-right">
                      {ev.headcountDelta !== 0 && (
                        <span className={`font-bold ${ev.headcountDelta > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {ev.headcountDelta > 0 ? `+${ev.headcountDelta}` : ev.headcountDelta}
                        </span>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'CHECKPOINTS' && (
        <div className="space-y-3">
          {protocols.length === 0 ? (
            <EmptyState
              icon="💉"
              title="No Protocol Checkpoints"
              message="Add health vaccinations, feed transitions, or biosecurity milestones."
              actionLabel="Add Checkpoint"
              onAction={() => setShowCheckpointSheet(true)}
            />
          ) : (
            <div className="space-y-2">
              {protocols.map((chk: any) => (
                <div
                  key={chk.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        dataService.toggleMilestone(entry.id, chk.id, !chk.completed, activeMember);
                      }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${chk.completed
                        ? 'bg-emerald-500 text-white'
                        : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500'
                        }`}
                    >
                      ✓
                    </button>
                    <div>
                      <div className={`font-bold ${chk.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        Day {chk.dayTarget}: {chk.title}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {chk.category} {chk.targetWeightKg ? `· Target ${chk.targetWeightKg}kg` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const found = (entry.customCheckpoints || []).find((c: any) => c.id === chk.id);
                      if (found) {
                        setSelectedCheckpoint(found);
                        setShowCheckpointSheet(true);
                      }
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold p-1"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'FEED' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs">
            <div className="text-xs text-slate-400">Total Feed Consumed</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {batchStatus.totalFeedConsumedKg.toFixed(1)} kg
            </div>
          </div>
          {feedLogs.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-6">No direct feed issues logged for this batch yet.</div>
          ) : (
            feedLogs.map((fd: any) => (
              <div key={fd.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{fd.feedType}</div>
                  <div className="text-slate-500 mt-0.5">{fd.note}</div>
                </div>
                <div className="text-right font-bold text-amber-600">
                  {fd.bagsDelta} bags
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'WEIGHTS' && (
        <div className="space-y-3">
          {weightEvents.length === 0 ? (
            <EmptyState
              icon="⚖️"
              title="No Weights Recorded"
              message="Perform regular weight checks to project growth curve."
              actionLabel="Log Weight"
              onAction={() => setShowLogAction(true)}
            />
          ) : (
            weightEvents.map((w: any) => (
              <div key={w.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Sample Average</div>
                  <div className="text-slate-500 mt-0.5">{w.note}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{w.weightAvgKg} kg</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{new Date(w.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'GALLERY' && (
        <div className="space-y-3">
          {galleryPhotos.length === 0 ? (
            <EmptyState
              icon="📸"
              title="No Photos Yet"
              message="Attach growth progression and site condition photos."
              actionLabel="Add Photo"
              onAction={() => setShowLogAction(true)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {galleryPhotos.map((url: string, i: number) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sheets */}
      <LogLivestockActionSheet
        isOpen={showLogAction}
        onClose={() => setShowLogAction(false)}
        batch={entry}
        activeMember={activeMember}
      />

      <CheckpointSheet
        isOpen={showCheckpointSheet}
        onClose={() => setShowCheckpointSheet(false)}
        batch={entry}
        activeMember={activeMember}
        existingCheckpoint={selectedCheckpoint}
      />

      <HeadcountContraSheet
        isOpen={showContraSheet}
        onClose={() => setShowContraSheet(false)}
        batch={entry}
        activeMember={activeMember}
      />

      <LivestockValuationSheet
        isOpen={showValuationSheet}
        onClose={() => setShowValuationSheet(false)}
        batch={entry}
        activeMember={activeMember}
      />
    </div>
  );
};
