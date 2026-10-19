import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Scale,
  Sparkles,
  Award,
  Zap,
  CheckCircle2,
  Clock,
  Plus,
  Layers,
  Activity,
  AlertCircle,
  HelpCircle,
  X,
  ChevronRight,
} from 'lucide-react';
import type { LivestockComputedStatus } from '../types/agro.ts';
import {
  generateGrowthProjectionData,
  computeHerdBiomassSummary,
  computeFcrTelemetry,
  type GrowthChartDataPoint,
  type HerdBiomassPoint,
} from '../utils/livestockProjections.ts';

interface LivestockGrowthChartsProps {
  livestockStatuses: LivestockComputedStatus[];
  selectedLocationId: string;
  onOpenWeightCheckModal?: (status: LivestockComputedStatus) => void;
  showNumbers?: boolean;
}

export const LivestockGrowthCharts: React.FC<LivestockGrowthChartsProps> = ({
  livestockStatuses,
  selectedLocationId,
  onOpenWeightCheckModal,
  showNumbers = true,
}) => {
  // Filter statuses if a specific location is selected
  const availableStatuses = useMemo(() => {
    if (selectedLocationId === 'ALL') return livestockStatuses;
    return livestockStatuses.filter((s) => s.entry.locationId === selectedLocationId);
  }, [livestockStatuses, selectedLocationId]);

  // Active selected batch
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
    return availableStatuses[0]?.entry.id || '';
  });

  // Keep selectedBatchId valid if filter changes
  const activeStatus = useMemo(() => {
    return (
      availableStatuses.find((s) => s.entry.id === selectedBatchId) ||
      availableStatuses[0] ||
      livestockStatuses[0]
    );
  }, [availableStatuses, selectedBatchId, livestockStatuses]);

  // Chart view mode
  const [chartMode, setChartMode] = useState<'GROWTH' | 'FCR' | 'HERD_BIOMASS'>('GROWTH');
  const [showConfidenceBand, setShowConfidenceBand] = useState(true);

  // Selected milestone checkpoint for full detail view / modal
  const [selectedMilestonePoint, setSelectedMilestonePoint] = useState<GrowthChartDataPoint | null>(null);
  const [showAllMilestones, setShowAllMilestones] = useState(false);

  // Generate projections for active batch
  const projection = useMemo(() => {
    if (!activeStatus) return null;
    return generateGrowthProjectionData(activeStatus);
  }, [activeStatus]);

  // Generate FCR metrics
  const fcrTelemetry = useMemo(() => {
    if (!activeStatus) return null;
    return computeFcrTelemetry(activeStatus);
  }, [activeStatus]);

  // Generate herd biomass data for all batches
  const herdBiomassData = useMemo(() => {
    return computeHerdBiomassSummary(availableStatuses);
  }, [availableStatuses]);

  if (!activeStatus || !projection) {
    return null;
  }

  const isPoultry = activeStatus.entry.species.toLowerCase().includes('broiler') ||
    activeStatus.entry.species.toLowerCase().includes('layer');

  const todayPoint = projection.points.find((p) => p.isToday);

  // Milestone points with notes
  const milestoneEvents = projection.points.filter((p) => p.milestone || p.eventNote);

  return (
    <section className="solora-card rounded-3xl p-4 sm:p-6 space-y-5 bg-white border border-[#E8DFCE] shadow-[0_12px_36px_-6px_rgba(217,119,6,0.06)]">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Biological Telemetry
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0 whitespace-nowrap">
              Live Historical Projections
            </span>
          </div>
          <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-1 break-words">
            Livestock Growth Trajectory & Milestone Projections
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Adaptive S-curve growth models tracking actual weigh-ins, protocol milestones, and market readiness dates.
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] rounded-xl border border-[#E8DFCE] overflow-x-auto max-w-full shrink-0 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('GROWTH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              chartMode === 'GROWTH'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Growth & Weight
          </button>
          <button
            type="button"
            onClick={() => setChartMode('FCR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              chartMode === 'FCR'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Feed Conversion (FCR)
          </button>
          <button
            type="button"
            onClick={() => setChartMode('HERD_BIOMASS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              chartMode === 'HERD_BIOMASS'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Herd Biomass
          </button>
        </div>
      </div>

      {/* Batch / Animal Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#F0EBE1]">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
            Batch / Herd:
          </span>
          {availableStatuses.map((st) => {
            const isSelected = st.entry.id === activeStatus.entry.id;
            return (
              <button
                key={st.entry.id}
                type="button"
                onClick={() => setSelectedBatchId(st.entry.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-500 shadow-xs'
                    : 'bg-[#FAF8F5] text-slate-600 border-[#E8DFCE] hover:bg-white'
                }`}
              >
                {st.entry.nameOrTag}
                <span className="ml-1.5 opacity-70 font-normal">
                  ({!showNumbers ? '••••' : st.currentLiveHeadcount} {isPoultry ? 'birds' : 'head'})
                </span>
              </button>
            );
          })}
        </div>

        {onOpenWeightCheckModal && (
          <button
            type="button"
            onClick={() => onOpenWeightCheckModal(activeStatus)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer min-h-[40px]"
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            + Log Weight Check
          </button>
        )}
      </div>

      {/* KPI Telemetry Ribbon for Active Batch */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Scale className="w-3 h-3 text-emerald-600" />
            Current Live Weight
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black font-mono tabular-nums text-slate-900">
              {!showNumbers ? '••••' : `${projection.currentWeightKg} kg`}
            </span>
            <span className="text-[10px] text-slate-500">
              / target {!showNumbers ? '••••' : `${projection.targetWeightKg} kg`}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Avg Daily Gain (ADG)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black font-mono tabular-nums text-emerald-700">
              {!showNumbers ? '••••' : `+${projection.weightGainRateGramsPerDay} g`}
            </span>
            <span className="text-[10px] text-slate-500">/ day</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            Days to Target Readiness
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black font-mono tabular-nums text-slate-900">
              {!showNumbers ? '••••' : `${activeStatus.daysLeftUntilSale} days`}
            </span>
            <span className="text-[10px] text-amber-700 font-semibold">
              ({!showNumbers ? '••%' : `${activeStatus.progressPercentage}%`} done)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            Feed Conversion (FCR)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black font-mono tabular-nums text-slate-900">
              {!showNumbers ? '••••' : (fcrTelemetry?.fcr || 1.55)}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              {fcrTelemetry?.fcrRating || 'GOOD'}
            </span>
          </div>
        </div>
      </div>

      {/* MODE 1: GROWTH & WEIGHT PROJECTION CHART */}
      {chartMode === 'GROWTH' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-emerald-800">
                <span className="w-3 h-1 bg-emerald-600 rounded-full" />
                Actual Recorded Weight (kg)
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-800">
                <span className="w-3 h-1 bg-amber-500 border-dashed rounded-full" />
                Target S-Curve Projection (kg)
              </span>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
              <input
                type="checkbox"
                checked={showConfidenceBand}
                onChange={(e) => setShowConfidenceBand(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
              <span>Optimal Growth Band (±8%)</span>
            </label>
          </div>

          {/* Recharts Container */}
          <div className="w-full h-80 sm:h-96 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] p-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={projection.points}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" opacity={0.8} />
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  unit=" kg"
                  domain={[0, 'auto']}
                  tickMargin={8}
                />
                <Tooltip content={<CustomGrowthTooltip />} />

                {/* Shaded Confidence Interval Range */}
                {showConfidenceBand && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="targetBandUpper"
                      name="Upper Target Range"
                      stroke="none"
                      fill="#F59E0B"
                      fillOpacity={0.12}
                    />
                    <Area
                      type="monotone"
                      dataKey="targetBandLower"
                      name="Lower Target Range"
                      stroke="none"
                      fill="#FAF8F5"
                      fillOpacity={1}
                    />
                  </>
                )}

                {/* Standard Target Projection Curve */}
                <Line
                  type="monotone"
                  dataKey="projectedWeightKg"
                  name="Standard Target Trajectory"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#F59E0B' }}
                />

                {/* Actual Historical Recorded Weight Points */}
                <Line
                  type="monotone"
                  dataKey="actualWeightKg"
                  name="Actual Historical Weight"
                  stroke="#059669"
                  strokeWidth={3}
                  connectNulls
                  dot={{
                    r: 5,
                    fill: '#059669',
                    stroke: '#FFFFFF',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 8,
                    fill: '#059669',
                    stroke: '#ECFDF5',
                    strokeWidth: 3,
                  }}
                />

                {/* Vertical Reference for Current Age / Today */}
                {todayPoint && (
                  <ReferenceLine
                    x={todayPoint.label}
                    stroke="#D97706"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{
                      value: 'Current Age',
                      position: 'top',
                      fill: '#B45309',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MODE 2: FEED CONVERSION RATIO (FCR) & BIOMASS EFFICIENCY */}
      {chartMode === 'FCR' && fcrTelemetry && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-amber-900 block">
                Feed Conversion Efficiency Benchmark
              </span>
              <span className="text-slate-600 mt-0.5 block">
                Target FCR for {activeStatus.entry.species} is{' '}
                <strong>{!showNumbers ? '••••' : fcrTelemetry.targetFcr}</strong> (1 kg live weight gain per {!showNumbers ? '••••' : fcrTelemetry.targetFcr} kg feed).
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                Current FCR: {!showNumbers ? '••••' : fcrTelemetry.fcr} ({fcrTelemetry.fcrRating})
              </span>
            </div>
          </div>

          {/* Bar Chart comparing Feed vs Biomass */}
          <div className="w-full h-80 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] p-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: 'Biomass & Feed Balance',
                    'Total Feed Consumed (kg)': fcrTelemetry.totalFeedKg,
                    'Total Live Biomass (kg)': fcrTelemetry.totalBiomassKg,
                    'Feed Investment ($)': fcrTelemetry.feedCostEstimatedUsd,
                  },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={11} unit=" kg" />
                <Tooltip content={<CustomFcrTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar
                  dataKey="Total Feed Consumed (kg)"
                  fill="#F59E0B"
                  radius={[8, 8, 0, 0]}
                  barSize={48}
                />
                <Bar
                  dataKey="Total Live Biomass (kg)"
                  fill="#059669"
                  radius={[8, 8, 0, 0]}
                  barSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MODE 3: HERD BIOMASS & SYNDICATE VALUATION */}
      {chartMode === 'HERD_BIOMASS' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Total live weight biomass (kg) and estimated market value ($) across all active farm batches.
          </p>

          <div className="w-full h-80 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] p-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={herdBiomassData}
                margin={{ top: 20, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={11}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#059669"
                  fontSize={11}
                  unit=" kg"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#D97706"
                  fontSize={11}
                  unit=" $"
                />
                <Tooltip content={<CustomHerdTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 15 }} />
                <Bar
                  yAxisId="left"
                  dataKey="totalBiomassKg"
                  name="Total Biomass (kg)"
                  fill="#059669"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
                <Bar
                  yAxisId="right"
                  dataKey="estimatedValueUsd"
                  name="Est. Market Value ($)"
                  fill="#F59E0B"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Milestone Checkpoint Feed Strip */}
      <div className="pt-3 border-t border-[#F0EBE1] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
              Lifecycle Milestones & Weight Checks for {activeStatus.entry.nameOrTag}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-500">
              {milestoneEvents.length} Recorded Checkpoints
            </span>
            {milestoneEvents.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllMilestones(!showAllMilestones)}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                {showAllMilestones ? 'Show Less' : `View All (${milestoneEvents.length})`}
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Click any checkpoint card below to inspect full telemetry, target variance, and complete unclipped field observations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(showAllMilestones ? milestoneEvents : milestoneEvents.slice(0, 6)).map((pt) => {
            const isCompleted = typeof pt.actualWeightKg === 'number';
            return (
              <div
                key={pt.day}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMilestonePoint(pt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedMilestonePoint(pt);
                  }
                }}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 text-xs transition-all cursor-pointer hover:border-amber-400 hover:shadow-xs active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  isCompleted
                    ? 'bg-emerald-50/40 border-emerald-300/80'
                    : 'bg-[#FAF8F5] border-[#E8DFCE]'
                }`}
              >
                <div>
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 truncate">
                          {pt.milestone || `Day ${pt.day} Check`}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {pt.date}
                        </span>
                      </div>
                      {pt.actualWeightKg ? (
                        <p className="text-emerald-700 font-bold font-mono text-[11px] mt-0.5">
                          Recorded Weight: {pt.actualWeightKg} kg
                        </p>
                      ) : (
                        <p className="text-amber-800 font-medium font-mono text-[11px] mt-0.5">
                          Target Weight: {pt.projectedWeightKg} kg
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Complete, unclipped note so information is never hidden */}
                  {pt.eventNote && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <p className="text-xs text-slate-700 leading-relaxed break-words font-medium">
                        {pt.eventNote}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-amber-700 font-semibold pt-1 border-t border-dashed border-[#E8DFCE]/60">
                  <span>Day {pt.day} Checkpoint</span>
                  <span className="flex items-center gap-0.5 hover:underline text-xs">
                    Inspect details
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checkpoint Full Detail Modal */}
      {selectedMilestonePoint && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                    typeof selectedMilestonePoint.actualWeightKg === 'number'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {typeof selectedMilestonePoint.actualWeightKg === 'number' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    {selectedMilestonePoint.milestone || `Day ${selectedMilestonePoint.day} Checkpoint`}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedMilestonePoint.date} · Day {selectedMilestonePoint.day} on site
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMilestonePoint(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close Checkpoint Detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Context */}
            <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span className="truncate">{activeStatus.entry.nameOrTag}</span>
                <span className="font-mono text-emerald-700 shrink-0">{activeStatus.currentLiveHeadcount} Live</span>
              </div>
              <p className="text-slate-500 truncate">
                {activeStatus.entry.species} · {activeStatus.entry.locationName}
              </p>
            </div>

            {/* Observation / Event Note: Complete & Prominent */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Field Observation / Protocol Log
              </span>
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-800 leading-relaxed break-words font-medium">
                {selectedMilestonePoint.eventNote || 'Standard scheduled biological growth checkpoint.'}
              </div>
            </div>

            {/* Telemetry Metrics Comparison Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <span className="text-[11px] text-slate-500">Actual Recorded Weight</span>
                <p className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-0.5">
                  {selectedMilestonePoint.actualWeightKg != null
                    ? `${selectedMilestonePoint.actualWeightKg} kg`
                    : 'Pending / Not Logged'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <span className="text-[11px] text-slate-500">Target S-Curve Weight</span>
                <p className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5">
                  {!showNumbers ? '••••' : `${selectedMilestonePoint.projectedWeightKg} kg`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <span className="text-[11px] text-slate-500">Optimal Growth Band</span>
                <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                  {!showNumbers ? '•••• - ••••' : `${selectedMilestonePoint.targetBandLower} - ${selectedMilestonePoint.targetBandUpper} kg`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <span className="text-[11px] text-slate-500">Trajectory Variance</span>
                <p className="text-xs font-mono font-bold mt-1">
                  {!showNumbers ? (
                    <span className="text-slate-500">••••</span>
                  ) : selectedMilestonePoint.actualWeightKg != null ? (
                    (() => {
                      const diff = Number((selectedMilestonePoint.actualWeightKg - selectedMilestonePoint.projectedWeightKg).toFixed(2));
                      return (
                        <span className={diff >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                          {diff >= 0 ? `+${diff} kg` : `${diff} kg`} ({diff >= 0 ? 'Ahead' : 'Below Target'})
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-slate-500">Pending Weigh-in</span>
                  )}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              {onOpenWeightCheckModal && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMilestonePoint(null);
                    onOpenWeightCheckModal(activeStatus);
                  }}
                  className="w-full sm:flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[42px]"
                >
                  <Scale className="w-4 h-4 shrink-0" />
                  Log New Weigh-In
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedMilestonePoint(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs font-semibold transition-all cursor-pointer min-h-[42px] flex items-center justify-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

/**
 * Custom Tooltip for Growth Projection
 */
const CustomGrowthTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const data: GrowthChartDataPoint = payload[0]?.payload;
  if (!data) return null;

  const diffKg = data.actualWeightKg != null
    ? Number((data.actualWeightKg - data.projectedWeightKg).toFixed(2))
    : null;

  return (
    <div className="p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E8DFCE] shadow-xl text-xs space-y-1.5 min-w-[210px]">
      <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-1.5">
        <span className="font-bold text-slate-900">{data.label} ({data.date})</span>
        {data.isToday && (
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
            TODAY
          </span>
        )}
      </div>

      {data.actualWeightKg != null && (
        <div className="flex items-center justify-between font-mono">
          <span className="text-slate-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Actual Weight:
          </span>
          <strong className="text-emerald-700 font-bold">{data.actualWeightKg} kg</strong>
        </div>
      )}

      <div className="flex items-center justify-between font-mono">
        <span className="text-slate-600 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Target S-Curve:
        </span>
        <strong className="text-slate-800 font-bold">{data.projectedWeightKg} kg</strong>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>Optimal Band:</span>
        <span>{data.targetBandLower} - {data.targetBandUpper} kg</span>
      </div>

      {diffKg != null && (
        <div className="pt-1 border-t border-[#F0EBE1] flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Trajectory Variance:</span>
          <span
            className={`font-bold font-mono ${
              diffKg >= 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {diffKg >= 0 ? `+${diffKg} kg` : `${diffKg} kg`} ({diffKg >= 0 ? 'Ahead' : 'Below Target'})
          </span>
        </div>
      )}

      {data.milestone && (
        <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-medium mt-1">
          ★ Milestone: {data.milestone}
        </div>
      )}

      {data.eventNote && (
        <div className="text-[10px] text-slate-600 italic">
          Note: {data.eventNote}
        </div>
      )}
    </div>
  );
};

/**
 * Custom Tooltip for FCR Chart
 */
const CustomFcrTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="p-3 rounded-xl bg-white border border-[#E8DFCE] shadow-lg text-xs space-y-1">
      <p className="font-bold text-slate-900">{p.name}</p>
      <p className="text-amber-800 font-mono">Feed Consumed: {p['Total Feed Consumed (kg)']} kg</p>
      <p className="text-emerald-800 font-mono">Live Biomass: {p['Total Live Biomass (kg)']} kg</p>
      <p className="text-slate-600 font-mono">Estimated Feed Cost: ${p['Feed Investment ($)']}</p>
    </div>
  );
};

/**
 * Custom Tooltip for Herd Biomass
 */
const CustomHerdTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item: HerdBiomassPoint = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="p-3 rounded-xl bg-white border border-[#E8DFCE] shadow-lg text-xs space-y-1">
      <p className="font-bold text-slate-900">{item.name}</p>
      <p className="text-slate-500 text-[11px]">{item.species} · {item.locationName}</p>
      <p className="text-emerald-700 font-mono font-semibold">Total Biomass: {item.totalBiomassKg} kg</p>
      <p className="text-amber-700 font-mono font-semibold">Market Value: ${item.estimatedValueUsd.toLocaleString()}</p>
      <p className="text-slate-600 font-mono">Headcount: {item.liveHeadcount} head (avg {item.avgWeightKg} kg)</p>
    </div>
  );
};
