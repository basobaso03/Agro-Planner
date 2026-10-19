import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  MinusCircle,
  PlusCircle,
  Syringe,
  DollarSign,
  Scale,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  X,
  TrendingUp,
} from 'lucide-react';
import { LivestockGrowthCharts } from './LivestockGrowthCharts.tsx';
import type {
  DurationUnit,
  FarmLocation,
  LivestockComputedStatus,
  LivestockLifecycleEvent,
  MemberEquitySummary,
  SyndicateMember,
  TrackingMode,
} from '../types/agro.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { computeDividendDistribution } from '../utils/calculations.ts';

interface LivestockTabProps {
  livestockStatuses: LivestockComputedStatus[];
  locations: FarmLocation[];
  selectedLocationId: string;
  activeMember: SyndicateMember;
  memberEquities: MemberEquitySummary[];
  onRegisterLivestock: (data: {
    locationId: string;
    species: string;
    nameOrTag: string;
    trackingMode: TrackingMode;
    entryDate: string;
    initialAgeValue: number;
    initialAgeUnit: DurationUnit;
    targetDurationValue: number;
    targetDurationUnit: DurationUnit;
    initialHeadcount: number;
    purchaseCostTotal: number;
    targetSaleWeightKg?: number;
    notes: string;
    autoDeductPurchaseFromLeftMoney: boolean;
  }) => void;
  onLogLifecycleEvent: (data: {
    livestockId: string;
    eventType: LivestockLifecycleEvent['eventType'];
    headcountDelta: number;
    weightAvgKg?: number;
    saleRevenueAmount?: number;
    reinvestmentPercentage?: number;
    referenceTransactionId?: string;
    note: string;
  }) => void;
  showNumbers?: boolean;
}

export const LivestockTab: React.FC<LivestockTabProps> = ({
  livestockStatuses,
  locations,
  selectedLocationId,
  activeMember,
  memberEquities,
  onRegisterLivestock,
  onLogLifecycleEvent,
  showNumbers = true,
}) => {
  const [speciesFilter, setSpeciesFilter] = useState('All');
  const [expandedProtocolsId, setExpandedProtocolsId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Register New Animal / Batch Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regLocationId, setRegLocationId] = useState(
    selectedLocationId !== 'ALL'
      ? selectedLocationId
      : activeMember.assignedLocationId || locations[0]?.id || ''
  );
  const [regSpecies, setRegSpecies] = useState('Broilers');
  const [customSpeciesName, setCustomSpeciesName] = useState('');
  const [regNameOrTag, setRegNameOrTag] = useState('');
  const [regMode, setRegMode] = useState<TrackingMode>('BATCH');
  const [regHeadcount, setRegHeadcount] = useState('100');
  const [regInitialAgeVal, setRegInitialAgeVal] = useState('1');
  const [regInitialAgeUnit, setRegInitialAgeUnit] = useState<DurationUnit>('DAYS');
  const [regTargetDurVal, setRegTargetDurVal] = useState('42');
  const [regTargetDurUnit, setRegTargetDurUnit] = useState<DurationUnit>('DAYS');
  const [regCost, setRegCost] = useState('95');
  const [regTargetWeight, setRegTargetWeight] = useState('2.2');
  const [regAutoExpense, setRegAutoExpense] = useState(true);
  const [regNotes, setRegNotes] = useState('');
  const [regError, setRegError] = useState('');

  // Recharts Growth Telemetry Chart Toggle State
  const [showGrowthCharts, setShowGrowthCharts] = useState(true);

  // Lifecycle Action Modal State
  const [activeActionModal, setActiveActionModal] = useState<{
    status: LivestockComputedStatus;
    mode:
      | 'MORTALITY_LOSS'
      | 'BIRTH_OFFSPRING'
      | 'VACCINATION_HEALTH'
      | 'SALE_DISPATCH'
      | 'HEADCOUNT_CONTRA_ADJUSTMENT'
      | 'WEIGHT_CHECK';
  } | null>(null);

  const [evQuantity, setEvQuantity] = useState('1');
  const [evWeightKg, setEvWeightKg] = useState('');
  const [evSaleRevenue, setEvSaleRevenue] = useState('450');
  const [evReinvestPct, setEvReinvestPct] = useState(60);
  const [evReferenceId, setEvReferenceId] = useState('');
  const [evContraSign, setEvContraSign] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [evNote, setEvNote] = useState('');
  const [evError, setEvError] = useState('');

  // Dynamically derive species filter badges from actual herd inventory
  const availableSpeciesFilters = useMemo(() => {
    const present = new Set<string>();
    livestockStatuses.forEach((s) => {
      if (s.entry.species && s.entry.species.trim()) {
        present.add(s.entry.species.trim());
      }
    });

    if (present.size === 0) {
      return ['All', 'Broilers', 'Boer Goats', 'Indigenous Goats', 'Cattle', 'Layers', 'Pigs', 'Zebras'];
    }

    return ['All', ...Array.from(present)];
  }, [livestockStatuses]);

  // Reset filter to 'All' if the filtered species no longer exists
  useEffect(() => {
    if (speciesFilter !== 'All' && !availableSpeciesFilters.includes(speciesFilter)) {
      setSpeciesFilter('All');
    }
  }, [availableSpeciesFilters, speciesFilter]);

  const filteredStatuses = useMemo(() => {
    return livestockStatuses.filter((s) => {
      if (speciesFilter === 'All') return true;
      return s.entry.species.toLowerCase() === speciesFilter.toLowerCase();
    });
  }, [livestockStatuses, speciesFilter]);

  // Intelligent preset autofill for species
  const handleSpeciesChange = (species: string) => {
    setRegSpecies(species);
    if (species === 'Broilers') {
      setRegHeadcount('100');
      setRegMode('BATCH');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('DAYS');
      setRegTargetDurVal('42');
      setRegTargetDurUnit('DAYS');
      setRegCost('95');
      setRegTargetWeight('2.2');
    } else if (species === 'Layers') {
      setRegHeadcount('100');
      setRegMode('BATCH');
      setRegInitialAgeVal('18');
      setRegInitialAgeUnit('WEEKS');
      setRegTargetDurVal('72');
      setRegTargetDurUnit('WEEKS');
      setRegCost('850');
      setRegTargetWeight('1.9');
    } else if (species === 'Boer Goats' || species === 'Indigenous Goats' || species === 'Sheep') {
      setRegHeadcount('10');
      setRegMode('BATCH');
      setRegInitialAgeVal('3');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('8');
      setRegTargetDurUnit('MONTHS');
      setRegCost('650');
      setRegTargetWeight('45');
    } else if (species === 'Cattle') {
      setRegHeadcount('5');
      setRegMode('INDIVIDUAL_TAG');
      setRegInitialAgeVal('6');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('18');
      setRegTargetDurUnit('MONTHS');
      setRegCost('2200');
      setRegTargetWeight('450');
    } else if (species === 'Pigs') {
      setRegHeadcount('10');
      setRegMode('BATCH');
      setRegInitialAgeVal('2');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('6');
      setRegTargetDurUnit('MONTHS');
      setRegCost('400');
      setRegTargetWeight('90');
    } else if (species === 'Zebras') {
      setRegHeadcount('2');
      setRegMode('BATCH');
      setRegInitialAgeVal('12');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('24');
      setRegTargetDurUnit('MONTHS');
      setRegCost('3200');
      setRegTargetWeight('300');
    } else if (species === 'Ostriches') {
      setRegHeadcount('4');
      setRegMode('BATCH');
      setRegInitialAgeVal('3');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('12');
      setRegTargetDurUnit('MONTHS');
      setRegCost('1200');
      setRegTargetWeight('105');
    } else if (species === 'Rabbits') {
      setRegHeadcount('20');
      setRegMode('BATCH');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('4');
      setRegTargetDurUnit('MONTHS');
      setRegCost('150');
      setRegTargetWeight('2.8');
    } else if (species === 'CUSTOM') {
      setRegHeadcount('10');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('12');
      setRegTargetDurUnit('MONTHS');
      setRegCost('500');
      setRegTargetWeight('50');
    }
  };

  const handleOpenActionModal = (
    status: LivestockComputedStatus,
    mode:
      | 'MORTALITY_LOSS'
      | 'BIRTH_OFFSPRING'
      | 'VACCINATION_HEALTH'
      | 'SALE_DISPATCH'
      | 'HEADCOUNT_CONTRA_ADJUSTMENT'
      | 'WEIGHT_CHECK'
  ) => {
    setActiveActionModal({ status, mode });
    setEvQuantity(mode === 'WEIGHT_CHECK' ? '0' : '1');
    setEvWeightKg(status.latestWeightAvgKg ? String(status.latestWeightAvgKg) : '');
    setEvSaleRevenue('600');
    setEvReinvestPct(50);
    setEvReferenceId(status.lifecycleEvents[0]?.id || status.entry.id);
    setEvContraSign('ADD');
    setEvNote(mode === 'WEIGHT_CHECK' ? 'Routine sample weigh-in and growth trajectory verification.' : '');
    setEvError('');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSpecies = regSpecies === 'CUSTOM' ? customSpeciesName.trim() : regSpecies;
    if (!finalSpecies) {
      setRegError('Please enter a species name for your custom animal (e.g. Zebras).');
      return;
    }
    if (!regNameOrTag.trim() || regNotes.trim().length < 4) {
      setRegError('Please provide a Batch/Ear-Tag name and mandatory notes (min 4 chars).');
      return;
    }
    const hc = Math.max(1, parseInt(regHeadcount, 10) || 1);
    const cost = Math.max(0, parseFloat(regCost) || 0);
    onRegisterLivestock({
      locationId: regLocationId || locations[0].id,
      species: finalSpecies,
      nameOrTag: regNameOrTag.trim(),
      trackingMode: regMode,
      entryDate: new Date().toISOString(),
      initialAgeValue: Math.max(0, parseFloat(regInitialAgeVal) || 0),
      initialAgeUnit: regInitialAgeUnit,
      targetDurationValue: Math.max(1, parseFloat(regTargetDurVal) || 1),
      targetDurationUnit: regTargetDurUnit,
      initialHeadcount: regMode === 'INDIVIDUAL_TAG' ? 1 : hc,
      purchaseCostTotal: cost,
      targetSaleWeightKg: parseFloat(regTargetWeight) || undefined,
      notes: regNotes.trim(),
      autoDeductPurchaseFromLeftMoney: regAutoExpense,
    });
    setRegNameOrTag('');
    setCustomSpeciesName('');
    setRegNotes('');
    setRegError('');
    setShowRegisterModal(false);
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionModal) return;
    if (evNote.trim().length < 4) {
      setEvError('Mandatory explanation note (min 4 characters) is required for immutable audit trail.');
      return;
    }

    const { status, mode } = activeActionModal;
    const rawQty = Math.max(0, parseInt(evQuantity, 10) || 0);
    let headcountDelta = 0;

    if (mode === 'WEIGHT_CHECK') {
      const w = parseFloat(evWeightKg);
      if (isNaN(w) || w <= 0) {
        setEvError('Please enter a valid positive weight in kilograms.');
        return;
      }
      headcountDelta = 0;
    } else if (mode === 'MORTALITY_LOSS' || mode === 'SALE_DISPATCH') {
      if (rawQty <= 0 || rawQty > status.currentLiveHeadcount) {
        setEvError(
          `Quantity must be between 1 and current live headcount (${status.currentLiveHeadcount}).`
        );
        return;
      }
      headcountDelta = -rawQty;
    } else if (mode === 'BIRTH_OFFSPRING') {
      if (rawQty <= 0) {
        setEvError('Offspring count must be at least 1.');
        return;
      }
      headcountDelta = rawQty;
    } else if (mode === 'HEADCOUNT_CONTRA_ADJUSTMENT') {
      if (rawQty <= 0) {
        setEvError('Adjustment quantity delta must be at least 1.');
        return;
      }
      headcountDelta = evContraSign === 'ADD' ? rawQty : -rawQty;
    } else {
      headcountDelta = 0;
    }

    onLogLifecycleEvent({
      livestockId: status.entry.id,
      eventType: mode,
      headcountDelta,
      weightAvgKg: evWeightKg ? parseFloat(evWeightKg) : undefined,
      saleRevenueAmount: mode === 'SALE_DISPATCH' ? Math.max(0, parseFloat(evSaleRevenue) || 0) : undefined,
      reinvestmentPercentage: mode === 'SALE_DISPATCH' ? evReinvestPct : undefined,
      referenceTransactionId:
        mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' ? evReferenceId || status.entry.id : undefined,
      note: evNote.trim(),
    });

    setActiveActionModal(null);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar: Species Filters + Chart Toggle + Register Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
          {availableSpeciesFilters.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSpeciesFilter(sp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                speciesFilter === sp
                  ? 'tab-brand-active'
                  : 'tab-brand-inactive'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGrowthCharts(!showGrowthCharts)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showGrowthCharts
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950'
                : 'bg-[#FAF8F5] hover:bg-[#F0EBE1] text-slate-700 border border-[#E8DFCE] shadow-sm'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {showGrowthCharts ? 'Hide Growth Charts' : 'Show Growth Charts'}
          </button>

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-emerald-950 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Animal / Batch
          </button>
        </div>
      </div>

      {/* Biological Growth Projection & Recharts Telemetry Section */}
      {showGrowthCharts && livestockStatuses.length > 0 && (
        <LivestockGrowthCharts
          livestockStatuses={livestockStatuses}
          selectedLocationId={selectedLocationId}
          onOpenWeightCheckModal={(status) => handleOpenActionModal(status, 'WEIGHT_CHECK')}
          showNumbers={showNumbers}
        />
      )}

      {/* Livestock Cards */}
      {filteredStatuses.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-white">No livestock batches match this filter</p>
          <p className="text-xs text-slate-400">
            Register a new animal batch or individual ear-tag to start live age & market countdown tracking.
          </p>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-colors cursor-pointer"
          >
            + Register First Animal / Batch
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStatuses.map((status) => {
            const isUrgent = status.countdownUrgency === 'READY_FOR_SALE';
            const isWarn = status.countdownUrgency === 'PREPARE_MARKET';
            const isProtocolsOpen = expandedProtocolsId === status.entry.id;
            const isHistoryOpen = expandedHistoryId === status.entry.id;
            const completedProtocols = status.protocols.filter((p) => p.completed).length;

            return (
              <article
                key={status.entry.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4"
              >
                {/* Header & Live Countdown */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-emerald-400 font-semibold">{status.entry.species}</span>
                      <span aria-hidden="true">·</span>
                      <span>{status.entry.locationName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono whitespace-nowrap">
                        {status.entry.trackingMode === 'INDIVIDUAL_TAG'
                          ? 'Individual Ear-Tag'
                          : 'Batch Tracking'}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                      {status.entry.nameOrTag}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{status.entry.notes}</p>
                  </div>

                  {/* Countdown Status Text */}
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono ${
                        isUrgent
                          ? 'text-rose-400'
                          : isWarn
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {isUrgent ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isWarn ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {status.countdownBadgeText}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Target Sale Date: {new Date(status.entry.targetSaleDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300">
                      Current Age:{' '}
                      <strong className="font-mono text-white">{!showNumbers ? '••••' : status.formattedCurrentAge}</strong>
                    </span>
                    <span className="font-mono text-slate-400">
                      {!showNumbers ? '••%' : `${status.progressPercentage}%`} of {!showNumbers ? '••' : status.entry.targetDurationValue}{' '}
                      {status.entry.targetDurationUnit.toLowerCase()} cycle
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-transform duration-200 ${
                        isUrgent
                          ? 'bg-rose-500'
                          : isWarn
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${status.progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* 5 Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <p className="text-[11px] text-slate-400">Live Headcount</p>
                    <p className="font-mono font-bold text-emerald-300 text-sm mt-0.5">
                      {!showNumbers ? '••••' : status.currentLiveHeadcount}{' '}
                      <span className="text-slate-400 font-normal text-xs">
                        / {!showNumbers ? '••••' : `${status.entry.initialHeadcount} init`}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Births / Offspring</p>
                    <p className="font-mono font-bold text-white text-sm mt-0.5">
                      {!showNumbers ? '••••' : `+${status.totalBirths}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Mortality Rate</p>
                    <p className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                      {!showNumbers ? '••%' : `${status.mortalityRatePercent}%`} ({!showNumbers ? '••' : status.totalMortalities} lost)
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Feed Consumed</p>
                    <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">
                      {!showNumbers ? '••••••' : `${status.totalFeedConsumedKg} kg`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Est. Herd Value</p>
                    <p className="font-mono font-bold text-white text-sm mt-0.5">
                      {!showNumbers ? '••••••••' : `$${status.estimatedCurrentValueUsd.toFixed(0)}`}
                    </p>
                  </div>
                </div>

                {/* 5 Append-Only Action Buttons */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'MORTALITY_LOSS')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/60 text-xs font-medium text-rose-300 flex items-center gap-1.5 transition-colors"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    Log Mortality / Loss
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'BIRTH_OFFSPRING')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-700/60 text-xs font-medium text-emerald-300 flex items-center gap-1.5 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Log Birth / Offspring
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'VACCINATION_HEALTH')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Syringe className="w-3.5 h-3.5" />
                    Log Vaccine
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'WEIGHT_CHECK')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-700/60 text-xs font-medium text-emerald-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    Weigh-In Check
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'SALE_DISPATCH')}
                    className="px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/60 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {activeMember.role === 'GROUND_OPERATOR'
                      ? 'Log Sale Dispatch & Cash'
                      : 'Log Sale & Distribute Profit'}
                  </button>

                  {PERMISSIONS.canPostContraReversals(activeMember.role) && (
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(status, 'HEADCOUNT_CONTRA_ADJUSTMENT')}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-amber-950/60 border border-slate-700 hover:border-amber-700/60 text-xs font-medium text-amber-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      Post Contra-Adjustment
                    </button>
                  )}
                </div>

                {/* Expandable Vaccination & Feed Protocol Checklist + Immutable History */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProtocolsId(isProtocolsOpen ? null : status.entry.id)
                    }
                    className="text-slate-300 hover:text-white font-medium flex items-center gap-1"
                  >
                    {isProtocolsOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-emerald-400" />
                    )}
                    Vaccination & Feed Protocol Schedule ({completedProtocols}/{status.protocols.length} Completed)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedHistoryId(isHistoryOpen ? null : status.entry.id)
                    }
                    className="text-slate-400 hover:text-white font-mono flex items-center gap-1"
                  >
                    {isHistoryOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Append-Only Event Log ({status.lifecycleEvents.length})
                  </button>
                </div>

                {isProtocolsOpen && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <p className="text-xs font-semibold text-slate-300">
                      Standard {status.entry.species} Biosecurity, Vaccine & Feed Schedule
                    </p>
                    <div className="divide-y divide-slate-800/70">
                      {status.protocols.map((proto) => (
                        <div
                          key={proto.id}
                          className="py-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                proto.completed ? 'text-emerald-400' : 'text-slate-600'
                              }`}
                            />
                            <div>
                              <span
                                className={
                                  proto.completed ? 'text-slate-200 font-medium' : 'text-slate-400'
                                }
                              >
                                {proto.title}
                              </span>
                              {proto.completedNote && (
                                <p className="text-[11px] text-slate-500">{proto.completedNote}</p>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 shrink-0">
                            {proto.completed ? 'Done' : `Due Day ${proto.dayTarget}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isHistoryOpen && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-300">
                      Immutable Lifecycle Ledger (Zero Edits / Zero Deletes)
                    </p>
                    <div className="divide-y divide-slate-800/70">
                      {status.lifecycleEvents.map((ev) => (
                        <div key={ev.id} className="py-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                            <span>
                              <strong className="text-slate-200 font-mono">Ref #{ev.id.slice(-6).toUpperCase()}</strong> ·{' '}
                              <span className="text-emerald-400 capitalize font-medium">{ev.eventType.toLowerCase().replace(/_/g, ' ')}</span>
                              {ev.referenceTransactionId ? ` · Linked Ref #${ev.referenceTransactionId.slice(-6).toUpperCase()}` : ''}
                            </span>
                            <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-200">{ev.note}</p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Verified Log · By {ev.loggedByName}
                            </span>
                            <span
                              className={
                                ev.headcountDelta > 0
                                  ? 'text-emerald-400 font-bold'
                                  : ev.headcountDelta < 0
                                  ? 'text-rose-400 font-bold'
                                  : 'text-slate-300'
                              }
                            >
                              {!showNumbers ? '•••• hd' : `${ev.headcountDelta > 0 ? `+${ev.headcountDelta}` : ev.headcountDelta} hd`}
                              {typeof ev.saleRevenueAmount === 'number'
                                ? ` · Sale: ${!showNumbers ? '••••••••' : `+$${ev.saleRevenueAmount.toFixed(2)}`}`
                                : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* REGISTER NEW ANIMAL / BATCH MODAL */}
      {showRegisterModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-livestock-title"
        >
          <div className="modal-dialog-responsive max-w-lg p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="reg-livestock-title" className="text-base font-bold text-slate-900">
                Register New Livestock Batch or Individual Ear-Tag
              </h2>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {regError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {regError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-loc" className="block text-xs font-medium text-slate-300 mb-1">
                    Farm Location *
                  </label>
                  <select
                    id="reg-loc"
                    value={regLocationId}
                    onChange={(e) => setRegLocationId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-species" className="block text-xs font-medium text-slate-300 mb-1">
                    Species / Category *
                  </label>
                  <select
                    id="reg-species"
                    value={regSpecies}
                    onChange={(e) => handleSpeciesChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    <optgroup label="Poultry">
                      <option value="Broilers">Broilers (Meat Birds)</option>
                      <option value="Layers">Layers (Egg Production)</option>
                    </optgroup>
                    <optgroup label="Livestock & Ruminants">
                      <option value="Boer Goats">Boer Goats</option>
                      <option value="Indigenous Goats">Indigenous Goats</option>
                      <option value="Cattle">Cattle (Beef / Dairy)</option>
                      <option value="Sheep">Sheep (Dorper / Meat)</option>
                      <option value="Pigs">Pigs / Swine</option>
                    </optgroup>
                    <optgroup label="Game, Wildlife & Equines">
                      <option value="Zebras">Zebras (Game / Wildlife)</option>
                      <option value="Ostriches">Ostriches</option>
                    </optgroup>
                    <optgroup label="Micro-Livestock">
                      <option value="Rabbits">Rabbits</option>
                    </optgroup>
                    <optgroup label="Custom / Other">
                      <option value="CUSTOM">+ Other / Custom Species (Type Name)...</option>
                    </optgroup>
                  </select>
                  {regSpecies === 'CUSTOM' && (
                    <div className="mt-2.5">
                      <label htmlFor="reg-custom-species" className="block text-xs font-semibold text-emerald-400 mb-1">
                        Enter Custom Species Name *
                      </label>
                      <input
                        id="reg-custom-species"
                        type="text"
                        required
                        placeholder="e.g. Zebras, Quails, Plains Zebra, Honeybees"
                        value={customSpeciesName}
                        onChange={(e) => setCustomSpeciesName(e.target.value)}
                        className="w-full bg-slate-950 border border-emerald-500/70 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-mode" className="block text-xs font-medium text-slate-300 mb-1">
                    Tracking Mode
                  </label>
                  <select
                    id="reg-mode"
                    value={regMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as TrackingMode;
                      setRegMode(nextMode);
                      if (nextMode === 'INDIVIDUAL_TAG') setRegHeadcount('1');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    <option value="BATCH">Batch / Flock / Herd</option>
                    <option value="INDIVIDUAL_TAG">Individual Ear-Tag</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-hc" className="block text-xs font-medium text-slate-300 mb-1">
                    Initial Headcount *
                  </label>
                  <input
                    id="reg-hc"
                    type="number"
                    min="1"
                    disabled={regMode === 'INDIVIDUAL_TAG'}
                    value={regMode === 'INDIVIDUAL_TAG' ? '1' : regHeadcount}
                    onChange={(e) => setRegHeadcount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1">
                  Batch Name or Ear-Tag Identifier *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  placeholder="e.g. Broiler Batch #14 or Boer Stud Buck #ZW-22"
                  value={regNameOrTag}
                  onChange={(e) => setRegNameOrTag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-init-age" className="block text-xs font-medium text-slate-300 mb-1">
                    Initial Age at Entry
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="reg-init-age"
                      type="number"
                      min="0"
                      value={regInitialAgeVal}
                      onChange={(e) => setRegInitialAgeVal(e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                    />
                    <select
                      aria-label="Initial Age Unit"
                      value={regInitialAgeUnit}
                      onChange={(e) => setRegInitialAgeUnit(e.target.value as DurationUnit)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                    >
                      <option value="DAYS">Days</option>
                      <option value="WEEKS">Weeks</option>
                      <option value="MONTHS">Months</option>
                      <option value="YEARS">Years</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-target-dur" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Sale Duration *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="reg-target-dur"
                      type="number"
                      min="1"
                      value={regTargetDurVal}
                      onChange={(e) => setRegTargetDurVal(e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                    />
                    <select
                      aria-label="Target Duration Unit"
                      value={regTargetDurUnit}
                      onChange={(e) => setRegTargetDurUnit(e.target.value as DurationUnit)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                    >
                      <option value="DAYS">Days</option>
                      <option value="WEEKS">Weeks</option>
                      <option value="MONTHS">Months</option>
                      <option value="YEARS">Years</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-cost" className="block text-xs font-medium text-slate-300 mb-1">
                    Total Purchase Cost ($)
                  </label>
                  <input
                    id="reg-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={regCost}
                    onChange={(e) => setRegCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="reg-weight" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Sale Weight (kg)
                  </label>
                  <input
                    id="reg-weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={regTargetWeight}
                    onChange={(e) => setRegTargetWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regAutoExpense}
                  onChange={(e) => setRegAutoExpense(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-xs text-slate-200">
                  Auto-log purchase cost (${regCost || '0'}) as an Expense from Left Money
                </span>
              </label>

              <div>
                <label htmlFor="reg-notes" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Audit Notes (Supplier, Breed, House Assignment) *
                </label>
                <textarea
                  id="reg-notes"
                  rows={2}
                  required
                  placeholder="e.g. Purchased from Irvines Harare, placed in disinfected Brooder Run #2"
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                >
                  Register & Start Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPEND-ONLY LIFECYCLE EVENT MODAL */}
      {activeActionModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lifecycle-modal-title"
        >
          <div className="modal-dialog-responsive max-w-lg p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <div>
                <h2 id="lifecycle-modal-title" className="text-base font-bold text-slate-900">
                  {activeActionModal.mode === 'MORTALITY_LOSS' && 'Log Mortality / Loss (Append-Only)'}
                  {activeActionModal.mode === 'BIRTH_OFFSPRING' && 'Log Birth / Offspring ($0 Cost)'}
                  {activeActionModal.mode === 'VACCINATION_HEALTH' &&
                    'Log Vaccination or Health Treatment'}
                  {activeActionModal.mode === 'WEIGHT_CHECK' &&
                    'Log Routine Weigh-In & Growth Check'}
                  {activeActionModal.mode === 'SALE_DISPATCH' &&
                    'Log Livestock Sale & Distribute Syndicate Profit'}
                  {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' &&
                    'Post Headcount Contra-Adjustment (Reversal)'}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeActionModal.status.entry.nameOrTag} · Live:{' '}
                  {activeActionModal.status.currentLiveHeadcount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLifecycleSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {evError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {evError}
                </p>
              )}

              {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' && (
                <div className="space-y-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50">
                  <p className="text-xs text-amber-200">
                    Strict Immutability Law: Past logs cannot be edited or deleted. Select the event to reference and post a positive or negative headcount adjustment.
                  </p>
                  <div>
                    <label htmlFor="contra-ref-ev" className="block text-xs font-medium text-slate-300 mb-1">
                      Reference Event ID *
                    </label>
                    <select
                      id="contra-ref-ev"
                      value={evReferenceId}
                      onChange={(e) => setEvReferenceId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    >
                      {activeActionModal.status.lifecycleEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.id} ({ev.eventType}: {ev.headcountDelta >= 0 ? `+${ev.headcountDelta}` : ev.headcountDelta})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEvContraSign('ADD')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${
                        evContraSign === 'ADD'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      + Restore / Add Headcount
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvContraSign('SUBTRACT')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${
                        evContraSign === 'SUBTRACT'
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      - Deduct Overstated Count
                    </button>
                  </div>
                </div>
              )}

              {activeActionModal.mode !== 'VACCINATION_HEALTH' && activeActionModal.mode !== 'WEIGHT_CHECK' && (
                <div>
                  <label htmlFor="ev-qty" className="block text-xs font-medium text-slate-300 mb-1">
                    {activeActionModal.mode === 'MORTALITY_LOSS' && 'Number of Animals Lost *'}
                    {activeActionModal.mode === 'BIRTH_OFFSPRING' && 'Number of New Offspring Born *'}
                    {activeActionModal.mode === 'SALE_DISPATCH' && 'Number of Animals Sold *'}
                    {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' &&
                      'Headcount Delta Quantity *'}
                  </label>
                  <input
                    id="ev-qty"
                    type="number"
                    min="1"
                    required
                    value={evQuantity}
                    onChange={(e) => setEvQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white"
                  />
                </div>
              )}

              <div>
                <label htmlFor="ev-weight" className="block text-xs font-medium text-slate-300 mb-1">
                  {activeActionModal.mode === 'WEIGHT_CHECK'
                    ? 'Sample Average Live Weight (kg) * Mandatory'
                    : 'Sample Average Live Weight (kg) — Optional'}
                </label>
                <input
                  id="ev-weight"
                  type="number"
                  step="0.01"
                  required={activeActionModal.mode === 'WEIGHT_CHECK'}
                  placeholder="e.g. 2.25"
                  value={evWeightKg}
                  onChange={(e) => setEvWeightKg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
                />
              </div>

              {activeActionModal.mode === 'SALE_DISPATCH' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
                  <div>
                    <label htmlFor="ev-sale-rev" className="block text-xs font-medium text-emerald-200 mb-1">
                      Total Gross Sale Revenue Received ($) *
                    </label>
                    <input
                      id="ev-sale-rev"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={evSaleRevenue}
                      onChange={(e) => setEvSaleRevenue(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-700 rounded-xl px-3.5 py-2 text-base font-bold font-mono text-white"
                    />
                  </div>

                  {PERMISSIONS.canConfigureProfitSplits(activeMember.role) ? (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                        <label htmlFor="reinvest-slider">
                          Reinvest to Left Money: <strong>{evReinvestPct}%</strong>
                        </label>
                        <span>
                          Member Dividends: <strong>{100 - evReinvestPct}%</strong>
                        </span>
                      </div>
                      <input
                        id="reinvest-slider"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={evReinvestPct}
                        onChange={(e) => setEvReinvestPct(parseInt(e.target.value, 10))}
                        className="w-full accent-emerald-500"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs font-mono">
                        <span className="text-emerald-300">
                          +${(((parseFloat(evSaleRevenue) || 0) * evReinvestPct) / 100).toFixed(2)} to Left Money
                        </span>
                        <span className="text-amber-300">
                          ${(((parseFloat(evSaleRevenue) || 0) * (100 - evReinvestPct)) / 100).toFixed(2)} Payout Pool
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-white">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Treasury Automated Revenue Reconciliation
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sale proceeds will be credited into the syndicate accounts. Dividend distribution percentages and farm working capital allocations are calculated and disbursed directly by the Syndicate Treasurer.
                      </p>
                    </div>
                  )}

                  {/* Live Member Dividend Preview */}
                  <div className="pt-2 border-t border-emerald-800/40 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-300">
                      Automatic Member Dividend Payout Breakdown:
                    </p>
                    {computeDividendDistribution(
                      ((parseFloat(evSaleRevenue) || 0) * (100 - evReinvestPct)) / 100,
                      memberEquities
                    ).map((d) => (
                      <div key={d.memberId} className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">
                          {d.memberName} ({d.sharePercent.toFixed(1)}%)
                        </span>
                        <span className="text-white font-semibold">${d.payoutUsd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="ev-note" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Explanation Note (Cause, Vaccine Batch, Buyer, or Correction Reason) *
                </label>
                <textarea
                  id="ev-note"
                  rows={3}
                  required
                  placeholder="Enter detailed ground observation (min 4 chars)..."
                  value={evNote}
                  onChange={(e) => setEvNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Append to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
