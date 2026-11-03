import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  Clock,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  Zap,
  Activity,
  X,
  Bird,
  Wheat,
  Scale,
  ShieldAlert,
  Camera,
  Upload,
  Maximize2,
} from 'lucide-react';
import type {
  AuditNotificationEvent,
  FarmLocation,
  FinancialSummary,
  LivestockComputedStatus,
  NotificationSeverity,
  SiteComparisonSummary,
  OrgMember,
  LivestockEntry,
} from '../types/agro.ts';
import type {
  DebtLiabilityEvent,
  LoanGivenEvent,
  CreditSaleEvent,
} from '../types/financials.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';
import { FinancialBreakdownCards } from './FinancialBreakdownCards.tsx';
import { BankingHubGrid } from './BankingHubGrid.tsx';
import { CreditSalesModal } from './CreditSalesModal.tsx';
import { LoansDebtsModal } from './LoansDebtsModal.tsx';
import { LivestockValuationModal } from './LivestockValuationModal.tsx';

import type { ActiveTab } from '../App.tsx';

interface HomeTabProps {
  financials: FinancialSummary;
  livestockStatuses: LivestockComputedStatus[];
  siteComparisons: SiteComparisonSummary[];
  latestBroadcast?: AuditNotificationEvent;
  selectedLocationName: string;
  activeMember: OrgMember;
  locations: FarmLocation[];
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectLocation: (locId: string) => void;
  onPostBroadcast: (data: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    photoUrl?: string;
  }) => void;
  showNumbers?: boolean;
  isAgroEnabled?: boolean;

  // Modern Banking Redesign Extensions
  debtLiabilities?: DebtLiabilityEvent[];
  loansGiven?: LoanGivenEvent[];
  creditSales?: CreditSaleEvent[];
  livestockEntries?: LivestockEntry[];
  pendingUsersCount?: number;
  unreadBroadcastsCount?: number;
  totalMembersCount?: number;
  totalFixedAssetsCount?: number;
  totalAuditCount?: number;
  onRecordDebtLiability?: (params: any) => Promise<any> | any;
  onRepayDebtLiability?: (params: any) => Promise<any> | any;
  onRecordLoanGiven?: (params: any) => Promise<any> | any;
  onRecoverLoanGiven?: (params: any) => Promise<any> | any;
  onRecordCreditSale?: (params: any) => Promise<any> | any;
  onExtendCreditSaleDueDate?: (params: any) => Promise<any> | any;
  onRecordCreditSalePayment?: (params: any) => Promise<any> | any;
  onSaveLivestockValuation?: (livestockId: string, configuredSalePricePerUnit: number) => Promise<any> | any;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  financials,
  livestockStatuses,
  siteComparisons,
  latestBroadcast,
  selectedLocationName,
  activeMember,
  locations,
  onNavigateTab,
  onSelectLocation,
  onPostBroadcast,
  showNumbers = true,
  isAgroEnabled = true,

  debtLiabilities = [],
  loansGiven = [],
  creditSales = [],
  livestockEntries = [],
  pendingUsersCount = 0,
  unreadBroadcastsCount = 0,
  totalMembersCount = 0,
  totalFixedAssetsCount = 0,
  totalAuditCount = 0,
  onRecordDebtLiability,
  onRepayDebtLiability,
  onRecordLoanGiven,
  onRecoverLoanGiven,
  onRecordCreditSale,
  onExtendCreditSaleDueDate,
  onRecordCreditSalePayment,
  onSaveLivestockValuation,
}) => {
  const homeFileInputRef = useRef<HTMLInputElement>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showCreditSalesModal, setShowCreditSalesModal] = useState(false);
  const [showLoansDebtsModal, setShowLoansDebtsModal] = useState(false);
  const [showLivestockValuationModal, setShowLivestockValuationModal] = useState(false);
  const [bTitle, setBTitle] = useState('');
  const [bMsg, setBMsg] = useState('');
  const [bLocId, setBLocId] = useState(
    activeMember.assignedLocationId || locations[0]?.id || 'ALL'
  );
  const [bSeverity, setBSeverity] = useState<NotificationSeverity>('URGENT_GROUND');
  const [bPhoto, setBPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [bPhotoError, setBPhotoError] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Solora Interactive Frequency Scrubber State
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'>('1D');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setBPhotoError(validation.error || 'Invalid image file');
      return;
    }
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
      setBPhoto(compressed);
      setBPhotoError('');
    } catch (err: unknown) {
      setBPhotoError(err instanceof Error ? err.message : 'Photo compression failed');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bMsg.trim().length < 4) return;
    try {
      onPostBroadcast({
        locationId: bLocId,
        severity: bSeverity,
        title: bTitle.trim() || `Field Status Update — ${activeMember.fullName}`,
        message: bMsg.trim(),
        photoUrl: bPhoto || undefined,
      });
      setBTitle('');
      setBMsg('');
      setBPhoto(null);
      setBPhotoError('');
      setShowBroadcastModal(false);
    } catch (err) {
      setBPhotoError(err instanceof Error ? err.message : 'Failed to post broadcast.');
    }
  };

  const isGroundOperator = activeMember?.role === 'GROUND_OPERATOR';
  const canViewPool = PERMISSIONS.canViewCapitalPoolTab(activeMember?.role);
  const totalLiveHeadcount = (livestockStatuses || []).reduce((acc, s) => acc + (s.currentLiveHeadcount || 0), 0);
  const totalFeedConsumedKg = (livestockStatuses || []).reduce((acc, s) => acc + (s.totalFeedConsumedKg || 0), 0);
  const avgSurvivalRate = livestockStatuses && livestockStatuses.length > 0
    ? Math.round(livestockStatuses.reduce((acc, s) => acc + (100 - (s.mortalityRatePercent || 0)), 0) / livestockStatuses.length)
    : 100;

  // Liquid percentage of capital pool (for executive/investor view)
  const poolTotal = financials?.totalPool || 0;
  const leftCash = financials?.leftMoney || 0;
  const liquidPct = poolTotal > 0
    ? Math.max(0, Math.min(100, Math.round((leftCash / poolTotal) * 100)))
    : 0;

  return (
    <div className="space-y-5 pb-24">
      {/* 1. HERO CARD (Role-Tailored: Ground Operations Station vs Master Liquid Capital Vault) */}
      <section className="rounded-3xl bg-white border border-[#E8DFCE] p-4 sm:p-6 shadow-[0_12px_36px_-6px_rgba(217,119,6,0.07)] transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-700 break-words">
              {isGroundOperator ? 'Ground Station · ' : 'Live Operations Status · '}
              {selectedLocationName}
            </span>
          </div>
          <span className="font-mono flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0 self-start sm:self-auto text-[11px] whitespace-normal text-left">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {isGroundOperator ? 'Station Operational Ledger' : 'Ledger'}
          </span>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          {/* Left Primary Focus Figures */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {isGroundOperator ? 'Live Farm Inventory Headcount' : 'Left Money (Liquid Working Capital)'}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 whitespace-nowrap">
                Normally Active
              </span>
            </div>
            <h1
              data-testid="hero-left-money"
              className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tabular-nums tracking-tight text-slate-900 mt-1"
            >
              {!showNumbers
                ? '••••••••'
                : isGroundOperator
                  ? `${totalLiveHeadcount.toLocaleString()} Animals`
                  : `$${(financials?.leftMoney ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              {isGroundOperator
                ? 'Active broilers, layers, and goats currently fed and maintained on site.'
                : 'Instant disbursement funds available across all verified farm bank and mobile wallets.'}
            </p>
          </div>

          {/* Solora Radial Power Arc Gauge Widget */}
          <div className="flex items-center gap-4 bg-[#FAF8F5] p-3 sm:p-3.5 rounded-2xl border border-[#E8DFCE] shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E8DFCE"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="8"
                  strokeDasharray={`${(isGroundOperator ? avgSurvivalRate : liquidPct) * 2.39} 240`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900">
                  {isGroundOperator ? `${avgSurvivalRate}%` : `${liquidPct}%`}
                </span>
                <span className="text-[9px] font-semibold text-amber-700 uppercase">
                  {isGroundOperator ? 'Viable' : 'Liquid'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-left min-w-0">
              <div className="text-xs font-bold text-slate-800">
                {isGroundOperator ? 'Herd Survival Rate' : 'Capital Reserve'}
              </div>
              <div className="text-[11px] text-slate-500">
                {isGroundOperator
                  ? `${avgSurvivalRate}% flock health`
                  : `${liquidPct}% unspent cash`}
              </div>
              <div className="text-[11px] font-mono text-amber-700 font-semibold truncate">
                {isGroundOperator
                  ? `${totalFeedConsumedKg.toLocaleString()} kg Feed Logged`
                  : `$${(financials?.totalFixedAssetsValue ?? 0).toLocaleString()} Fixed Assets`}
              </div>
            </div>
          </div>
        </div>

        {/* Action Row: responsive grid on small screens so buttons never overflow */}
        <div className="mt-5 pt-4 border-t border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigateTab('EXPENSES')}
              className="px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center min-h-[42px]"
            >
              {isAgroEnabled ? '+ Log Farm Expense' : '+ Log Venture Expense'}
            </button>
            {isAgroEnabled && (
              <button
                type="button"
                onClick={() => onNavigateTab('LIVESTOCK')}
                className="px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] active:scale-[0.98] border border-[#E0D7C6] text-slate-800 text-xs font-semibold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center min-h-[42px]"
              >
                {isGroundOperator ? 'Weigh-In / Health' : 'Livestock Batches'}
              </button>
            )}
            {canViewPool && (
              <button
                type="button"
                onClick={() => onNavigateTab('POOL')}
                className="px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] active:scale-[0.98] border border-[#E0D7C6] text-slate-800 text-xs font-semibold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center min-h-[42px]"
              >
                Pool & Equity
              </button>
            )}
            {isGroundOperator && (
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center min-h-[42px]"
              >
                + Ground Broadcast
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-500 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0EBE1] w-full sm:w-auto">
            {isGroundOperator ? (
              <span className="font-mono text-slate-600 truncate">
                Operator Station: <strong className="text-slate-900">{activeMember.fullName}</strong>
              </span>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">
                  Total NAV: <strong className="font-mono text-slate-900">{!showNumbers ? '••••••' : `$${(financials?.totalNav ?? 0).toLocaleString()}`}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. MODERN 9-PILLAR FINANCIAL BREAKDOWN CARDS */}
      <FinancialBreakdownCards financials={financials} showNumbers={showNumbers} />

      {/* 3. MODERN MOBILE BANKING HUB GRID (TRANSFERRED TABS & SPECIALIZED MODULES) */}
      <BankingHubGrid
        financials={financials}
        memberCount={totalMembersCount}
        pendingUsersCount={pendingUsersCount}
        unreadBroadcastsCount={unreadBroadcastsCount}
        assetCount={totalFixedAssetsCount}
        auditCount={totalAuditCount}
        creditSalesCount={(creditSales || []).filter((s) => s.status !== 'SETTLED').length}
        totalCreditSalesDue={financials.totalCreditSalesOutstanding || 0}
        totalDebtOutstanding={financials.totalBorrowedDebtOutstanding || 0}
        totalLoansGivenOutstanding={financials.totalLoansGivenOutstanding || 0}
        totalLivestockExpectedRevenue={financials.totalExpectedLivestockRevenue || 0}
        canViewPool={canViewPool}
        canManageMembers={PERMISSIONS.canManageMembers(activeMember?.role)}
        onNavigateTab={onNavigateTab}
        onOpenCreditSales={() => setShowCreditSalesModal(true)}
        onOpenLoansDebts={() => setShowLoansDebtsModal(true)}
        onOpenLivestockValuation={() => setShowLivestockValuationModal(true)}
        showNumbers={showNumbers}
      />

      {/* 4. SOLORA DUAL KPI STRIP (Role-Tailored) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {isGroundOperator ? (
          <>
            {/* Ground Operator Card 1: Active Batches */}
            <div className="solora-card p-5 rounded-3xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Bird className="w-3.5 h-3.5 text-amber-500" />
                  <span>Monitored Livestock Batches</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {!showNumbers ? '••' : `${livestockStatuses.length} Batches Active`}
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                On Track
              </span>
            </div>

            {/* Ground Operator Card 2: Cumulative Feed Consumed */}
            <div className="solora-card p-5 rounded-3xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Wheat className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cumulative Feed Consumed</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {!showNumbers ? '••••••' : `${totalFeedConsumedKg.toLocaleString()} kg`}
                </div>
              </div>
              <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                Feed Rations Active
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Executive / Investor Card 1: Total Pool Contributed */}
            <div className="solora-card p-4 sm:p-5 rounded-3xl flex flex-wrap xs:flex-nowrap items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Total Pool Contributed</span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 truncate">
                  {!showNumbers ? '••••••••' : `$${(financials?.totalPool ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 whitespace-nowrap shrink-0">
                +100% Equity Pool
              </span>
            </div>

            {/* Executive / Investor Card 2: Approved Expenses */}
            <div className="solora-card p-4 sm:p-5 rounded-3xl flex flex-wrap xs:flex-nowrap items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Approved Farm Expenses</span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 truncate">
                  {!showNumbers ? '••••••••' : `-$${(financials?.approvedExpenses ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap shrink-0">
                {poolTotal > 0 ? (((financials?.approvedExpenses ?? 0) / poolTotal) * 100).toFixed(1) : 0}% Deployed
              </span>
            </div>
          </>
        )}
      </div>

      {/* 3. SOLORA TIMELINE & FREQUENCY SCRUBBER */}
      <section className="solora-card p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Operational Timeline &amp; Activity Frequency
            </h3>
            <p className="text-xs text-slate-700 font-semibold mt-0.5">
              Live Production & Feed Cycle Range
            </p>
          </div>

          {/* Solora Segmented Pill Filter */}
          <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] rounded-full border border-[#E8DFCE] overflow-x-auto max-w-full">
            {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${selectedTimeframe === tf
                  ? 'tab-brand-active'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Tactile Ruler / Tick Mark Bar */}
        <div className="pt-2 relative flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
            <span>06:00</span>
            <span>09:00</span>
            <span>12:00</span>
            <span className="font-bold text-amber-700">15:00 Live</span>
            <span>18:00</span>
            <span>21:00</span>
          </div>

          {/* Tick ruler */}
          <div className="w-full h-5 flex items-center justify-between px-1 border-t border-b border-[#E8DFCE] bg-[#FAF8F5]/80 rounded-md">
            {Array.from({ length: 33 }).map((_, i) => (
              <div
                key={i}
                className={`w-[1px] transition-all ${i === 16
                  ? 'h-4 bg-amber-500 shadow-xs'
                  : i % 4 === 0
                    ? 'h-3 bg-slate-300'
                    : 'h-1.5 bg-slate-200'
                  }`}
              />
            ))}
          </div>
          {/* Center Amber Needle Indicator */}
          <div className="absolute top-7 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-xs" />
        </div>
      </section>

      {/* 4. GROUND BROADCAST ALERT CARD */}
      <section className="solora-card p-4 sm:p-5 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap shrink-0">
                <Megaphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Ground Broadcast
              </span>
              {latestBroadcast && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-medium text-slate-700 break-words">{latestBroadcast.locationName}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-medium text-slate-700 break-words">{latestBroadcast.actorName}</span>
                </>
              )}
            </div>
            {latestBroadcast ? (
              <>
                <h2 className="text-sm font-bold text-slate-900 mt-1 break-words">{latestBroadcast.title}</h2>
                <p className="text-xs text-slate-600 leading-relaxed break-words">{latestBroadcast.message}</p>
                {latestBroadcast.photoUrl && (
                  <div className="pt-2">
                    <div
                      onClick={() => setLightboxPhoto({ url: latestBroadcast.photoUrl!, title: latestBroadcast.title })}
                      className="relative inline-block rounded-2xl overflow-hidden border border-[#E0D7C6] bg-slate-50 cursor-pointer group/photo shadow-xs"
                    >
                      <img
                        src={latestBroadcast.photoUrl}
                        alt={latestBroadcast.title}
                        className="max-h-48 w-auto object-cover group-hover/photo:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                        <Maximize2 className="w-4 h-4" />
                        <span>Enlarge Field Photo</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">No ground updates posted for this site yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white shrink-0 whitespace-nowrap text-center transition-colors shadow-xs cursor-pointer min-h-[40px] flex items-center justify-center"
          >
            Post Ground Update
          </button>
        </div>
      </section>

      {/* 5. WORKSPACE SPECIFIC MODULE: LIVESTOCK (AGRO) vs CAPITAL & ASSETS (GENERAL VENTURE) */}
      {isAgroEnabled ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Livestock Sale Countdowns</h2>
              <p className="text-xs text-slate-500">
                Real-time age progression &amp; market readiness across {livestockStatuses.length} tracked groups
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('LIVESTOCK')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer p-1"
            >
              Manage All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {livestockStatuses.length === 0 ? (
            <div className="solora-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  No Active Livestock Batches Registered Yet
                </h3>
                <p className="text-xs text-slate-500">
                  Start your clean production ledger by registering a farm site and adding your first broiler batch, goat herd, or ear-tagged animal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('LIVESTOCK')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Register First Livestock Batch
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {livestockStatuses.map((status) => {
                const isUrgent = status.countdownUrgency === 'READY_FOR_SALE';
                const isWarn = status.countdownUrgency === 'PREPARE_MARKET';

                return (
                  <div
                    key={status.entry.id}
                    className="solora-card-interactive p-4 sm:p-5 rounded-3xl flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 min-w-0">
                        <span className="font-semibold text-slate-600 break-words min-w-0">
                          {status.entry.species} · {status.entry.locationName}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0 whitespace-nowrap inline-flex items-center">
                          {status.entry.trackingMode === 'INDIVIDUAL_TAG' ? 'Ear-Tag' : 'Batch'}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-baseline justify-between gap-2 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 break-words whitespace-normal min-w-0">
                          {status.entry.nameOrTag}
                        </h3>
                        <span className="text-sm font-extrabold font-mono tabular-nums text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0 whitespace-nowrap">
                          {status.currentLiveHeadcount} Live
                        </span>
                      </div>

                      {/* Age & Target Metadata */}
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 gap-2 min-w-0">
                        <span className="break-words min-w-0">
                          Current Age: <strong className="font-mono text-slate-900">{status.formattedCurrentAge}</strong>
                        </span>
                        <span className="font-mono text-slate-500 shrink-0 whitespace-nowrap">
                          Target: {status.entry.targetDurationValue} {status.entry.targetDurationUnit.toLowerCase()}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2.5 w-full h-2 rounded-full bg-[#EFE9DF] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isUrgent
                            ? 'bg-rose-500'
                            : isWarn
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            }`}
                          style={{ width: `${status.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Countdown Footer */}
                    <div className="pt-3 border-t border-[#F0EBE1] flex items-center justify-between gap-2 min-w-0">
                      <span
                        className={`text-xs font-bold font-mono flex items-center gap-1.5 break-words min-w-0 ${isUrgent
                          ? 'text-rose-600'
                          : isWarn
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                          }`}
                      >
                        {isUrgent ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : isWarn ? (
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="break-words">{status.countdownBadgeText}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => onNavigateTab('LIVESTOCK')}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] flex items-center"
                      >
                        Log Event
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Venture Capital &amp; Operations</h2>
              <p className="text-xs text-slate-500">
                Shared capital pool liquidity, asset purchases, and multi-sig expense deductions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('POOL')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer p-1"
            >
              View Pool &amp; Equity
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Venture Metric 1: Capital Liquidity & Left Money */}
            <div className="solora-card-interactive p-4 sm:p-5 rounded-3xl flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Net Liquid Capital Balance
                </span>
                <div className="text-2xl font-black font-mono text-emerald-800">
                  {!showNumbers ? '••••••••' : `$${(financials?.leftMoney ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Available working capital remaining in the shared pool after authorized deductions and reinvestments.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EBE1] flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Pool: ${financials?.totalPool?.toLocaleString() || 0}</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('EXPENSES')}
                  className="font-bold text-amber-700 hover:underline cursor-pointer"
                >
                  View Deductions →
                </button>
              </div>
            </div>

            {/* Venture Metric 2: Capital Assets Portfolio */}
            <div className="solora-card-interactive p-4 sm:p-5 rounded-3xl flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Shared Asset Book Value
                </span>
                <div className="text-2xl font-black font-mono text-slate-900">
                  {!showNumbers ? '••••••••' : `$${(financials?.totalFixedAssetsValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Equipment, infrastructure, and tools purchased and owned collectively by organization participants.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EBE1] flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Net Asset Value: ${financials?.totalNav?.toLocaleString() || 0}</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('ASSETS')}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Inspect Assets →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. MULTI-LOCATION COMPARISON STRIP */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {isAgroEnabled ? 'Multi-Location Performance Comparison' : 'Operating Sites & Branch Comparison'}
          </h2>
          <p className="text-xs text-slate-500">
            {isAgroEnabled
              ? 'Cross-site headcount, approved site expenses, fixed assets, and mortality rates'
              : 'Cross-site deployed expenses, fixed capital assets, and operating stations'}
          </p>
        </div>

        {siteComparisons.length === 0 ? (
          <div className="solora-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                {isAgroEnabled ? 'No Farm Locations Registered Yet' : 'No Operating Sites Registered Yet'}
              </h3>
              <p className="text-xs text-slate-500">
                Click &ldquo;Manage Sites&rdquo; in the top location bar to register your first operating site or branch location.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {siteComparisons.map((site) => (
              <div
                key={site.location.id}
                className="solora-card-interactive p-4 sm:p-5 rounded-3xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 break-words min-w-0">{site.location.name}</h3>
                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                    {site.location.primaryOperatorName} · {site.location.region}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2.5 pt-3 border-t border-[#F0EBE1] text-xs">
                    <div>
                      <p className="text-[11px] text-slate-500">{isAgroEnabled ? 'Active Animals' : 'Active Units'}</p>
                      <p className="font-mono font-bold text-slate-900 mt-0.5 break-words">
                        {isAgroEnabled
                          ? `${site.activeAnimalHeadcount} hd (${site.activeBatchCount} grp)`
                          : `${site.activeBatchCount} batches`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Site Expenses</p>
                      <p className="font-mono font-bold text-amber-800 mt-0.5 break-words">
                        ${(site.siteApprovedExpenses ?? 0).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Fixed Assets</p>
                      <p className="font-mono font-bold text-emerald-700 mt-0.5 break-words">
                        ${(site.siteFixedAssetValue ?? 0).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">{isAgroEnabled ? 'Mortality' : 'Site Status'}</p>
                      <p className="font-mono font-bold text-slate-800 mt-0.5 break-words">
                        {isAgroEnabled ? `${(site.siteMortalityRatePercent ?? 0).toFixed(1)}%` : 'Operational'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F0EBE1]">
                  <button
                    type="button"
                    onClick={() => onSelectLocation(site.location.id)}
                    className="w-full py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-semibold text-slate-800 transition-colors text-center cursor-pointer min-h-[38px] flex items-center justify-center"
                  >
                    Filter View to This Site
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-white border border-[#E8DFCE] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-500" />
                Post Ground Broadcast Update
              </h2>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Location Scope
                  </label>
                  <select
                    value={bLocId}
                    onChange={(e) => setBLocId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Farm Locations (Organization-Wide)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Urgency Severity
                  </label>
                  <select
                    value={bSeverity}
                    onChange={(e) => setBSeverity(e.target.value as NotificationSeverity)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="URGENT_GROUND">Urgent Ground Notice / Emergency</option>
                    <option value="MILESTONE">Milestone / Weigh-in Advisory</option>
                    <option value="INFO">Routine Field Status Update</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weigh-in Day 41: Average weight 2.28kg"
                  value={bTitle}
                  onChange={(e) => setBTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Broadcast Message *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide field observations, feed consumption, health status, or buyer pickup instructions..."
                  value={bMsg}
                  onChange={(e) => setBMsg(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Photo Attachment Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ground Photo Evidence (Optional)
                </label>
                {bPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-[#E0D7C6] bg-[#FAF8F5] p-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={bPhoto}
                        alt="Broadcast preview"
                        className="w-12 h-12 object-cover rounded-xl border border-[#E0D7C6]"
                      />
                      <div className="text-xs">
                        <p className="font-bold text-emerald-800">Field photo attached</p>
                        <p className="text-slate-500 text-[11px]">Compressed for broadcast</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBPhoto(null)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={homeFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isCompressingPhoto}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => homeFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-[#CFC5B2] hover:border-amber-500 rounded-xl bg-[#FAF8F5] cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4 text-amber-600" />
                      <span className="text-xs text-slate-700 font-semibold">
                        {isCompressingPhoto ? 'Compressing photo...' : 'Attach Field Photo Evidence (Single Tap)'}
                      </span>
                    </button>
                  </div>
                )}
                {bPhotoError && <p className="text-xs text-rose-600 mt-1">{bPhotoError}</p>}
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm"
                >
                  Broadcast to Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white border border-[#E8DFCE] rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-[#F0EBE1] bg-[#FAF8F5]">
              <h4 className="text-sm font-bold text-slate-900 truncate">{lightboxPhoto.title}</h4>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/5">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modern Banking Hub Modals */}
      {showCreditSalesModal && (
        <CreditSalesModal
          isOpen={showCreditSalesModal}
          onClose={() => setShowCreditSalesModal(false)}
          creditSales={creditSales}
          locations={locations}
          livestockStatuses={livestockStatuses}
          activeMember={activeMember}
          showNumbers={showNumbers}
        />
      )}

      {showLoansDebtsModal && (
        <LoansDebtsModal
          isOpen={showLoansDebtsModal}
          onClose={() => setShowLoansDebtsModal(false)}
          debts={debtLiabilities}
          loansGiven={loansGiven}
          activeMember={activeMember}
          leftMoney={financials?.leftMoney || 0}
          showNumbers={showNumbers}
        />
      )}

      {showLivestockValuationModal && (
        <LivestockValuationModal
          isOpen={showLivestockValuationModal}
          onClose={() => setShowLivestockValuationModal(false)}
          livestockStatuses={livestockStatuses}
          activeMember={activeMember}
          showNumbers={showNumbers}
        />
      )}
    </div>
  );
};
