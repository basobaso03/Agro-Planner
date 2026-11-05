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
import { RegisterBatchSheet } from '../../sheets/livestock/RegisterBatchSheet.tsx';
import { FeedEventSheet } from '../../sheets/livestock/FeedEventSheet.tsx';
import { ImageViewerSheet } from '../../components/ui/ImageViewerSheet.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  PlusCircle,
  CalendarPlus,
  TrendingUp,
  AlertTriangle,
  Bell,
  Clock,
  Radio,
  Users,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ZoomIn,
} from 'lucide-react';
import type { OrgMember, AnimalCheckpoint } from '../../types/agro.ts';

const formatFundingSource = (src?: string) => {
  const map: Record<string, string> = {
    CASH_POOL: 'Cash Pool',
    POOL_CAPITAL: 'Pool Capital',
    MEMBER_DIRECT: 'Member Direct',
    SUPPLIER_CREDIT: 'Supplier Credit',
    DEBT_FINANCING: 'Debt Financing',
    GRANT: 'Grant / Donation',
  };
  if (!src) return 'Cash Pool';
  return map[src] || src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatCheckpointCategory = (cat?: string): string => {
  if (!cat) return 'General';
  const standardMap: Record<string, string> = {
    VACCINE: 'Vaccine / Health',
    FEED_TRANSITION: 'Feed Transition',
    WEIGHT_CHECK: 'Weight Check',
    BIOSECURITY: 'Biosecurity',
    MEDICATION: 'Medication',
    GENERAL_TASK: 'General Task',
  };
  if (standardMap[cat]) return standardMap[cat];
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export interface BatchDetailScreenProps {
  batchId?: string;
  activeMember: OrgMember;
}

export const BatchDetailScreen: React.FC<BatchDetailScreenProps> = ({
  batchId,
  activeMember,
}) => {
  const { currentRoute, goBack } = useNavigation();
  const { showToast } = useToast();
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
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [showFeedSheet, setShowFeedSheet] = useState(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

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
  const eventPhotos = events.map((e) => e.photoUrl).filter(Boolean) as string[];
  const feedPhotos = feedLogs.map((f: any) => f.photoUrl).filter(Boolean) as string[];
  const galleryPhotos = Array.from(new Set([
    ...(entry.gallery || []),
    ...(entry.imageUrl ? [entry.imageUrl] : []),
    ...eventPhotos,
    ...feedPhotos,
  ]));

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Hero Summary Card */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {entry.species} · {entry.locationName}
              </span>
              <button
                type="button"
                onClick={() => setShowEditBatch(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                title="Edit animal specifications, tags or parameters"
              >
                <Edit3 className="w-3 h-3 text-slate-600" />
                <span>Edit Batch</span>
              </button>
            </div>
            <h1 className="text-xl font-black text-slate-950 mt-0.5">
              {entry.nameOrTag}
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Started {new Date(entry.entryDate).toLocaleDateString()} · Age: {batchStatus.formattedCurrentAge}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              {batchStatus.countdownBadgeText}
            </span>
            <div className="text-xs text-slate-600 font-medium mt-1.5">
              Est. <strong className="text-emerald-700 font-black">{formatMoney(batchStatus.estimatedCurrentValueUsd)}</strong>
            </div>
          </div>
        </div>

        {/* 4-Stat Grid */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#F0EBE1] text-center text-xs">
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Live Count</div>
            <div className="text-base font-black font-mono text-slate-950 mt-0.5">
              {currentLiveHeadcount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Initial</div>
            <div className="text-base font-black font-mono text-slate-700 mt-0.5">
              {entry.initialHeadcount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Mortality</div>
            <div className={`text-base font-black font-mono mt-0.5 ${mortalityRatePercent > 5 ? 'text-rose-600' : 'text-slate-950'}`}>
              {mortalityRatePercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Avg Weight</div>
            <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
              {batchStatus.latestWeightAvgKg ? `${batchStatus.latestWeightAvgKg}kg` : '—'}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="pt-3 border-t border-[#F0EBE1] space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Quick Actions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setShowLogAction(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs hover:shadow-sm cursor-pointer transition-all whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 shrink-0 text-emerald-100" />
              <span>Log Event</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCheckpoint(undefined);
                setShowCheckpointSheet(true);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-bold shadow-xs hover:shadow-sm cursor-pointer transition-all whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4 shrink-0 text-amber-100" />
              <span>Add Checkpoint</span>
            </button>

            <button
              type="button"
              onClick={() => setShowValuationSheet(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold shadow-xs hover:shadow-sm cursor-pointer transition-all whitespace-nowrap"
            >
              <TrendingUp className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Valuation</span>
            </button>

            <button
              type="button"
              onClick={() => setShowContraSheet(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs hover:shadow-sm cursor-pointer transition-all whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-100" />
              <span>Contra Loss</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <SegmentedControl
        options={[
          { value: 'OVERVIEW', label: 'Overview' },
          { value: 'CHECKPOINTS', label: 'Checkpoints', badge: protocols.length },
          { value: 'FEED', label: 'Feed', badge: feedLogs.length },
          { value: 'WEIGHTS', label: 'Weights', badge: weightEvents.length },
          { value: 'GALLERY', label: 'Photos', badge: galleryPhotos.length },
        ]}
        value={activeSubTab}
        onChange={(val) => setActiveSubTab(val as any)}
      />

      {/* Sub-Tab Content */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white text-sm">Batch Specifications</div>
              <button
                type="button"
                onClick={() => setShowEditBatch(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit Specs</span>
              </button>
            </div>
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
                  {formatFundingSource(entry.fundingSource)}
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

          {/* Herd Valuation & Market Pricing Section */}
          <div className="bg-white dark:bg-slate-800 border border-[#E8DFCE] dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">Herd Valuation & Market Pricing</div>
                  <div className="text-[10px] text-slate-500">Live asset value, pricing calibration & profit projection</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowValuationSheet(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adjust Valuation</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-[#FAF8F5] dark:bg-slate-750 p-2.5 rounded-xl border border-[#E8DFCE] dark:border-slate-700">
              <strong>Purpose:</strong> The <em>Valuation</em> button allows you to set your target market selling price (per animal or per kg). Agro-Planner uses this to continuously calculate your live herd equity, projected gross harvest earnings, and expected net profit margins against initial purchase cost and feed consumed.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-slate-700/60 border border-[#E8DFCE] dark:border-slate-600">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Current Asset Value</div>
                <div className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatMoney(batchStatus.estimatedCurrentValueUsd)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Live herd equity</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-slate-700/60 border border-[#E8DFCE] dark:border-slate-600">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Target Price / Head</div>
                <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {formatMoney(batchStatus.configuredSalePricePerUnit || 0)}
                  {entry.configuredSalePricePerKg ? ` ($${entry.configuredSalePricePerKg}/kg)` : ''}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sale price target</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-slate-700/60 border border-[#E8DFCE] dark:border-slate-600">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Projected Revenue</div>
                <div className="text-sm font-black font-mono text-blue-700 dark:text-blue-400 mt-0.5">
                  {formatMoney(batchStatus.totalExpectedRevenueUsd || 0)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{currentLiveHeadcount} head expected</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-slate-700/60 border border-[#E8DFCE] dark:border-slate-600">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Projected Net Margin</div>
                <div className={`text-sm font-black font-mono mt-0.5 ${(batchStatus.totalProjectedMarginUsd ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatMoney(batchStatus.totalProjectedMarginUsd || 0)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Net over intake &amp; feed</div>
              </div>
            </div>
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
          {/* Org Notification Info Banner */}
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 shadow-xs text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Morning Dispatch Notifications (07:00 AM)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCheckpoint(undefined);
                  setShowCheckpointSheet(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-all"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>+ Custom Checkpoint</span>
              </button>
            </div>
            <p className="text-amber-800 leading-relaxed font-medium">
              Every member in your organization receives a morning notification on the exact scheduled date for each checkpoint milestone.
            </p>
          </div>

          {protocols.length === 0 ? (
            <EmptyState
              icon="💉"
              title="No Checkpoints Scheduled"
              message="Add health vaccinations, feed transitions, or biosecurity milestones."
              actionLabel="Add Checkpoint"
              onAction={() => setShowCheckpointSheet(true)}
            />
          ) : (
            <div className="space-y-3">
              {protocols.map((chk: any) => {
                const entryDateMs = new Date(entry.entryDate || entry.createdAt || Date.now()).getTime();
                const eventDateMs = entryDateMs + chk.dayTarget * 86400000;
                const eventDate = new Date(eventDateMs);
                const reminderDateStr =
                  chk.scheduledDate ||
                  eventDate.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                const isDueToday = chk.reminderStatus === 'DUE_TODAY';
                const isOverdue = !chk.completed && chk.reminderStatus === 'OVERDUE';

                return (
                  <div
                    key={chk.id}
                    className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs"
                  >
                    {/* Top Row: Complete Checkbox, Title, Category Badge, Edit */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            dataService.toggleMilestone(entry.id, chk.id, !chk.completed, activeMember);
                          }}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-all cursor-pointer ${chk.completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 text-transparent hover:border-emerald-600'
                            }`}
                        >
                          ✓
                        </button>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`font-bold text-sm ${chk.completed ? 'line-through text-slate-400' : 'text-slate-950'
                              }`}
                          >
                            Day {chk.dayTarget}: {chk.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wide">
                              {formatCheckpointCategory(chk.category)}
                            </span>
                            {chk.targetWeightKg && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                                Target {chk.targetWeightKg}kg
                              </span>
                            )}
                            {chk.feedPhase && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[10px]">
                                {chk.feedPhase}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const found = (entry.customCheckpoints || []).find((c: any) => c.id === chk.id);
                          setSelectedCheckpoint(
                            found || {
                              id: chk.id,
                              dayTarget: chk.dayTarget,
                              title: chk.title,
                              category: chk.category,
                              description: chk.description || chk.instructions,
                              instructions: chk.instructions || chk.description,
                              targetWeightKg: chk.targetWeightKg,
                              feedPhase: chk.feedPhase,
                              completed: chk.completed,
                              reminderStatus: chk.reminderStatus || 'SCHEDULED',
                            }
                          );
                          setShowCheckpointSheet(true);
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-bold p-1 shrink-0 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Checkpoint Instructions / Description Notes */}
                    {(chk.description || chk.instructions) && (
                      <p className="text-slate-600 text-xs pl-9 leading-relaxed">
                        {chk.description || chk.instructions}
                      </p>
                    )}

                    {/* Notification & Morning Reminder Display */}
                    <div className="ml-9 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Morning Alert: {reminderDateStr} at 07:00 AM</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Reaches all organization members</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {chk.completed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : isDueToday ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] animate-pulse">
                            <Bell className="w-3.5 h-3.5 text-amber-600" />
                            Due Today
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                            ⚠️ Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            Scheduled
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            dataService.dispatchLivestockMilestoneBroadcast({
                              livestockId: entry.id,
                              dayTarget: chk.dayTarget,
                              milestoneTitle: chk.title,
                              customNote: chk.description,
                              actor: activeMember,
                            });
                            showToast({
                              type: 'success',
                              title: 'Notification Dispatched',
                              message: `Morning checkpoint notification for "${chk.title}" sent to all org members!`,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#E0D7C6] hover:bg-slate-50 text-slate-800 font-bold text-[11px] cursor-pointer shadow-2xs transition-colors"
                          title="Send broadcast alert to all org members now"
                        >
                          <Radio className="w-3 h-3 text-amber-600" />
                          <span>Alert Org</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'FEED' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Total Feed Consumed</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {batchStatus.totalFeedConsumedKg.toFixed(1)} kg
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFeedSheet(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
            >
              <span>+ Log Feed</span>
            </button>
          </div>
          {feedLogs.length === 0 ? (
            <EmptyState
              icon="🥣"
              title="No Feed Issues Logged"
              message="Record feed issues, rations, or bags issued for this batch."
              actionLabel="Log Feed Consumption"
              onAction={() => setShowFeedSheet(true)}
            />
          ) : (
            feedLogs.map((fd: any) => (
              <div key={fd.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-center text-xs gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {fd.photoUrl && (
                    <img
                      src={fd.photoUrl}
                      alt="Feed photo"
                      onClick={() => setSelectedPhotoPreview(fd.photoUrl)}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-600 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">{fd.feedType}</div>
                    <div className="text-slate-500 mt-0.5 truncate">{fd.note}</div>
                  </div>
                </div>
                <div className="text-right font-bold text-amber-600 shrink-0">
                  {fd.kgPerBag && fd.kgPerBag > 1
                    ? `${fd.bagsDelta > 0 ? `+${fd.bagsDelta}` : fd.bagsDelta} bags (${Math.abs(fd.bagsDelta * fd.kgPerBag)} kg)`
                    : `${fd.bagsDelta > 0 ? `+${fd.bagsDelta}` : fd.bagsDelta} kg`}
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
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Batch Photos ({galleryPhotos.length})
            </div>
            <button
              type="button"
              onClick={() => setShowLogAction(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
            >
              <span>+ Add Photo</span>
            </button>
          </div>

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
                <div
                  key={i}
                  onClick={() => setSelectedPhotoPreview(url)}
                  className="aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 cursor-pointer relative group hover:opacity-95 transition-all shadow-xs"
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                    <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs transition-opacity flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5" />
                      View
                    </span>
                  </div>
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

      <FeedEventSheet
        isOpen={showFeedSheet}
        onClose={() => setShowFeedSheet(false)}
        batch={entry}
        activeMember={activeMember}
      />

      <RegisterBatchSheet
        isOpen={showEditBatch}
        onClose={() => setShowEditBatch(false)}
        activeMember={activeMember}
        existingBatch={entry}
      />

      <ImageViewerSheet
        isOpen={Boolean(selectedPhotoPreview)}
        onClose={() => setSelectedPhotoPreview(null)}
        imageUrl={selectedPhotoPreview}
        title={`${entry.nameOrTag} Photo`}
        subtitle={`${entry.species} · ${entry.locationName}`}
      />
    </div>
  );
};
