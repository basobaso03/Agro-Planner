import React, { useState, useRef } from 'react';
import {
  Plus,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Camera,
  Package,
  AlertCircle,
  X,
  TrendingUp,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  Lock,
  ChevronDown,
  ChevronUp,
  History,
  Maximize2,
  Upload,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import type {
  ExpenseCategory,
  ExpenseLedgerEvent,
  FarmLocation,
  FeedInventorySummary,
  FeedLedgerEvent,
  FinancialSummary,
  LivestockComputedStatus,
  OrgMember,
} from '../types/agro.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';
import { useRunway } from '../hooks/useRunway.ts';
import { SpendGateDialog } from './runway/SpendGateDialog.tsx';
import type { RunwayAllocation } from '../types/runway.ts';
import { RunwayError } from '../types/runway.ts';
import { ContraExpenseSheet } from '../sheets/expenses/ContraExpenseSheet.tsx';
import { LogExpenseSheet } from '../sheets/expenses/LogExpenseSheet.tsx';
import { FeedEventSheet } from '../sheets/expenses/FeedEventSheet.tsx';
import { ImageViewerSheet } from './ui/ImageViewerSheet.tsx';

interface ExpensesFeedTabProps {
  expenses: ExpenseLedgerEvent[];
  feedSummaries: FeedInventorySummary[];
  financials: FinancialSummary;
  locations: FarmLocation[];
  livestockStatuses: LivestockComputedStatus[];
  selectedLocationId: string;
  activeMember: OrgMember;
  onLogExpense: (data: {
    locationId: string;
    batchOrAnimalId?: string;
    category: ExpenseCategory;
    direction: 'DEDUCTION' | 'CONTRA_REVERSAL';
    amount: number;
    referenceTransactionId?: string;
    note: string;
    gpsStamp?: string;
    receiptPhotoDataUrl?: string;
    runwayAllocation?: RunwayAllocation;
  }) => void;
  onApproveMultiSig: (expenseId: string) => void;
  onLogFeedEvent: (data: {
    locationId: string;
    feedType: string;
    direction: FeedLedgerEvent['direction'];
    bagsDelta: number;
    kgPerBag: number;
    linkedLivestockId?: string;
    referenceTransactionId?: string;
    note: string;
  }) => void;
  showNumbers?: boolean;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'FEED',
  'VACCINES_MEDICATION',
  'LIVESTOCK_PURCHASE',
  'FIXED_ASSET_PURCHASE',
  'LABOR_WAGES',
  'TRANSPORT_LOGISTICS',
  'UTILITIES_SECURITY',
  'MAINTENANCE',
  'OTHER',
];

export const ExpensesFeedTab: React.FC<ExpensesFeedTabProps> = ({
  expenses,
  feedSummaries,
  financials,
  locations,
  livestockStatuses,
  selectedLocationId,
  activeMember,
  onLogExpense,
  onApproveMultiSig,
  onLogFeedEvent,
  showNumbers = true,
}) => {
  const [subTab, setSubTab] = useState<'LEDGER' | 'MULTISIG' | 'FEED'>('LEDGER');

  const runway = useRunway();
  const activePlan = runway.isEnabled && runway.plan?.status === 'ACTIVE' ? runway.plan : null;
  const costLines = runway.lines.filter((l) => l.kind === 'COST' && !l.skipped);

  // Log New Expense Modal State
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expLocationId, setExpLocationId] = useState(
    selectedLocationId !== 'ALL'
      ? selectedLocationId
      : activeMember.assignedLocationId || locations[0]?.id || ''
  );
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('FEED');
  const [expAmount, setExpAmount] = useState('');
  const [expBatchId, setExpBatchId] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expLineId, setExpLineId] = useState('');
  const [expReceiptDataUrl, setExpReceiptDataUrl] = useState<string | null>(null);
  const [isCompressingReceipt, setIsCompressingReceipt] = useState(false);
  const [receiptLightbox, setReceiptLightbox] = useState<{ url: string; title: string } | null>(null);
  const [expError, setExpError] = useState('');

  // Spend Gate Modal State
  const [spendGateOpen, setSpendGateOpen] = useState(false);
  const [pendingGateData, setPendingGateData] = useState<{
    amount: number;
    category: string;
    locId: string;
    batchId?: string;
    note: string;
    gpsStamp?: string;
    receiptUrl?: string;
  } | null>(null);

  // Contra-Entry Reversal Modal State
  const [contraTargetExpense, setContraTargetExpense] = useState<ExpenseLedgerEvent | null>(null);
  const [contraMode, setContraMode] = useState<'REDUCE_EXPENSE' | 'INCREASE_EXPENSE'>('REDUCE_EXPENSE');
  const [contraDeltaAmount, setContraDeltaAmount] = useState('');
  const [contraNote, setContraNote] = useState('');
  const [contraError, setContraError] = useState('');

  // Feed Modal State
  const [showFeedModal, setShowFeedModal] = useState<{
    direction: FeedLedgerEvent['direction'];
    defaultFeedType?: string;
    defaultLocationId?: string;
    referenceId?: string;
  } | null>(null);
  const [feedLocId, setFeedLocId] = useState(locations[0]?.id || '');
  const [feedType, setFeedType] = useState('Broiler Starter & Grower Mash');
  const [feedBags, setFeedBags] = useState('2');
  const [feedKgPerBag, setFeedKgPerBag] = useState('50');
  const [feedLivestockId, setFeedLivestockId] = useState('');
  const [feedNote, setFeedNote] = useState('');
  const [feedError, setFeedError] = useState('');
  const [expandedFeedKey, setExpandedFeedKey] = useState<string | null>(null);

  const pendingExpenses = expenses.filter((e) => e.approvalStatus === 'PENDING_MULTISIG');

  const handleReceiptUpload = async (file: File | undefined) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setExpError(validation.error || 'Invalid receipt image.');
      return;
    }
    setIsCompressingReceipt(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
      setExpReceiptDataUrl(compressed);
    } catch (err) {
      console.error('Failed to compress receipt photo:', err);
    } finally {
      setIsCompressingReceipt(false);
    }
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpError('Please enter a valid positive dollar amount.');
      return;
    }
    if (expNote.trim().length < 4) {
      setExpError('Mandatory detailed note is required explaining what the money was used for.');
      return;
    }
    const loc = locations.find((l) => l.id === expLocationId) || locations[0];
    if (!loc) {
      setExpError('Please register a farm site location first before logging expenses.');
      return;
    }
    const alloc: RunwayAllocation | undefined = expLineId
      ? { mode: 'LINE', lineId: expLineId }
      : undefined;

    try {
      onLogExpense({
        locationId: loc.id,
        batchOrAnimalId: expBatchId || undefined,
        category: expCategory,
        direction: 'DEDUCTION',
        amount: amt,
        note: expNote.trim(),
        gpsStamp: loc.gpsCoordinates,
        receiptPhotoDataUrl: expReceiptDataUrl || undefined,
        runwayAllocation: alloc,
      });
      setExpAmount('');
      setExpNote('');
      setExpLineId('');
      setExpReceiptDataUrl(null);
      setExpError('');
      setShowExpenseModal(false);
    } catch (err: unknown) {
      const isRunwayGateError =
        err instanceof RunwayError ||
        (err as { code?: string })?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
        (err as { code?: string })?.code === 'RUNWAY_LINE_OVERRUN' ||
        (err instanceof Error && err.message.toLowerCase().includes('runway spend gate blocked'));

      if (isRunwayGateError) {
        setPendingGateData({
          amount: amt,
          category: expCategory,
          locId: loc.id,
          batchId: expBatchId || undefined,
          note: expNote.trim(),
          gpsStamp: loc.gpsCoordinates,
          receiptUrl: expReceiptDataUrl || undefined,
        });
        setSpendGateOpen(true);
      } else {
        setExpError(err instanceof Error ? err.message : 'Failed to log expense.');
      }
    }
  };

  const handleSpendGateAllocate = (allocation: RunwayAllocation) => {
    if (!pendingGateData) return;
    try {
      onLogExpense({
        locationId: pendingGateData.locId,
        batchOrAnimalId: pendingGateData.batchId,
        category: pendingGateData.category as ExpenseCategory,
        direction: 'DEDUCTION',
        amount: pendingGateData.amount,
        note: pendingGateData.note,
        gpsStamp: pendingGateData.gpsStamp,
        receiptPhotoDataUrl: pendingGateData.receiptUrl,
        runwayAllocation: allocation,
      });
      setSpendGateOpen(false);
      setPendingGateData(null);
      setExpAmount('');
      setExpNote('');
      setExpLineId('');
      setExpReceiptDataUrl(null);
      setExpError('');
      setShowExpenseModal(false);
    } catch (err: unknown) {
      setExpError(err instanceof Error ? err.message : 'Spend allocation rejected.');
    }
  };

  const handleOpenContraModal = (exp: ExpenseLedgerEvent) => {
    setContraTargetExpense(exp);
    setContraMode('REDUCE_EXPENSE');
    setContraDeltaAmount(String(Math.abs(exp.amount)));
    setContraNote('');
    setContraError('');
  };

  const handleCreateContraExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contraTargetExpense) return;
    const rawDelta = parseFloat(contraDeltaAmount);
    if (isNaN(rawDelta) || rawDelta <= 0) {
      setContraError('Please enter a valid positive adjustment dollar amount.');
      return;
    }
    if (contraNote.trim().length < 4) {
      setContraError('Mandatory explanation note is required for a Contra-Entry Reversal.');
      return;
    }

    // If reducing an overstated expense, amount is negative (restores cash to Left Money)
    const signedAmount = contraMode === 'REDUCE_EXPENSE' ? -Math.abs(rawDelta) : Math.abs(rawDelta);

    try {
      onLogExpense({
        locationId: contraTargetExpense.locationId,
        batchOrAnimalId: contraTargetExpense.batchOrAnimalId,
        category: contraTargetExpense.category,
        direction: 'CONTRA_REVERSAL',
        amount: signedAmount,
        referenceTransactionId: contraTargetExpense.id,
        note: `CONTRA-ENTRY REVERSAL for ${contraTargetExpense.id}: ${contraNote.trim()}`,
      });
      setContraTargetExpense(null);
    } catch (err) {
      setContraError(err instanceof Error ? err.message : 'Failed to post contra reversal.');
    }
  };

  const handleCreateFeedEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedModal) return;
    const bags = parseFloat(feedBags);
    if (isNaN(bags) || bags === 0) {
      setFeedError('Please enter a non-zero number of bags.');
      return;
    }
    if (feedNote.trim().length < 4) {
      setFeedError('Mandatory note (at least 4 characters) is required.');
      return;
    }
    const targetLocId = feedLocId || locations[0]?.id;
    if (!targetLocId) {
      setFeedError('Please register a farm site location first before logging feed.');
      return;
    }

    try {
      onLogFeedEvent({
        locationId: targetLocId,
        feedType: feedType.trim(),
        direction: showFeedModal.direction,
        bagsDelta: bags,
        kgPerBag: parseFloat(feedKgPerBag) || 50,
        linkedLivestockId: feedLivestockId || undefined,
        referenceTransactionId: showFeedModal.referenceId,
        note: feedNote.trim(),
      });
      setShowFeedModal(null);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Failed to log feed event.');
    }
  };

  const canApproveMultiSig = PERMISSIONS.canApproveMultiSig(activeMember.role);
  const canPostContra = PERMISSIONS.canPostContraReversals(activeMember.role);
  const isGroundOperator = activeMember.role === 'GROUND_OPERATOR';

  return (
    <div className="space-y-4 pb-6">
      {/* Sub-Tabs & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className={`grid ${canApproveMultiSig ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl`}>
          <button
            type="button"
            onClick={() => setSubTab('LEDGER')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer ${subTab === 'LEDGER'
              ? 'tab-brand-active'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Ledger ({!showNumbers ? '••' : expenses.length})
          </button>
          {canApproveMultiSig && (
            <button
              type="button"
              onClick={() => setSubTab('MULTISIG')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer ${subTab === 'MULTISIG'
                ? 'tab-brand-active'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Multi-Sig ({!showNumbers ? '••' : pendingExpenses.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubTab('FEED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer ${subTab === 'FEED'
              ? 'tab-brand-active'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Feed Store ({!showNumbers ? '••' : feedSummaries.length})
          </button>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Log Farm Expense</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedLocId(
                selectedLocationId !== 'ALL' ? selectedLocationId : locations[0]?.id || ''
              );
              setFeedBags('1.5');
              setFeedNote('');
              setFeedError('');
              setShowFeedModal({ direction: 'DAILY_CONSUMPTION' });
            }}
            className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Log Daily Feed Used</span>
          </button>
        </div>
      </div>

      {/* Solora Financial Curve & Payback Return Card */}
      <section className="solora-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                Capital Deployment & Net Asset Curve
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Live Solora Telemetry
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Expense Burn vs Production Return
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-700 bg-[#FAF8F5] border border-[#E8DFCE] px-3 py-1 rounded-xl">
              ROI Factor: <strong className="text-emerald-700">{!showNumbers ? '••••' : `${(financials.totalNav / Math.max(1, financials.totalPool)).toFixed(2)}x NAV`}</strong>
            </span>
          </div>
        </div>

        {/* Dynamic Smooth Bezier Area Graph */}
        <div className="relative w-full h-32 sm:h-36 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] p-3 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 720 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="soloraGoldArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#FDE68A" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="soloraEmeraldArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Guides */}
            <line x1="0" y1="30" x2="720" y2="30" stroke="#E8DFCE" strokeDasharray="4 4" strokeWidth="1" />
            <line x1="0" y1="65" x2="720" y2="65" stroke="#E8DFCE" strokeDasharray="4 4" strokeWidth="1" />
            <line x1="0" y1="100" x2="720" y2="100" stroke="#E8DFCE" strokeWidth="1" />

            {/* Area 1: Projected Production NAV (Emerald) */}
            <path
              d="M 0,95 C 120,80 240,65 360,50 C 480,35 600,25 720,18 L 720,120 L 0,120 Z"
              fill="url(#soloraEmeraldArea)"
            />
            <path
              d="M 0,95 C 120,80 240,65 360,50 C 480,35 600,25 720,18"
              fill="none"
              stroke="#059669"
              strokeWidth="2"
              strokeDasharray="4 3"
            />

            {/* Area 2: Cumulative Expense Curve (Sun-Gold) */}
            <path
              d="M 0,105 C 100,98 220,92 340,78 C 460,62 580,48 720,38 L 720,120 L 0,120 Z"
              fill="url(#soloraGoldArea)"
            />
            <path
              d="M 0,105 C 100,98 220,92 340,78 C 460,62 580,48 720,38"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Real-time Indicator Point */}
            <circle cx="580" cy="48" r="4.5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="720" cy="18" r="4.5" fill="#059669" stroke="#FFFFFF" strokeWidth="2" />
          </svg>

          {/* Graph Overlaid Badges */}
          <div className="absolute top-2 left-4 flex items-center gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1 text-amber-800">
              <span className="w-2.5 h-1 rounded-full bg-amber-500" />
              Cumulative Farm Spend ({!showNumbers ? '••••••••' : `$${financials.approvedExpenses.toFixed(0)}`})
            </span>
            <span className="flex items-center gap-1 text-emerald-800">
              <span className="w-2.5 h-1 rounded-full bg-emerald-500" />
              Projected NAV Harvest ({!showNumbers ? '••••••••' : `$${financials.totalNav.toFixed(0)}`})
            </span>
          </div>
        </div>

        {/* Payback & Capital Return Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Capital Payback & Liquidity Recovery
            </span>
            <span className="text-slate-900 font-mono font-bold">
              {!showNumbers ? '••%' : `${Math.min(100, Math.round((financials.leftMoney / Math.max(1, financials.totalPool)) * 100))}%`} Unspent Reserve
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-[#FAF8F5] border border-[#E8DFCE] overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 transition-all duration-500 shadow-xs"
              style={{
                width: `${Math.min(100, Math.round((financials.leftMoney / Math.max(1, financials.totalPool)) * 100))}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-0.5">
            <span>{!showNumbers ? '••••' : '$0 Deployed'}</span>
            <span className="text-emerald-700 font-bold">Target Harvest Return: {!showNumbers ? '••••••••' : `$${(financials.totalPool * 1.35).toFixed(0)}`}</span>
          </div>
        </div>

        {/* 3 Metric Pills (Role-Tailored) */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-[#F0EBE1] text-xs">
          {isGroundOperator ? (
            <>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Site Approved Costs</p>
                <p className="font-mono font-bold text-amber-800 text-sm mt-0.5">
                  {!showNumbers ? '••••••••' : `-$${financials.approvedExpenses.toFixed(2)}`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Feed Stock In Store</p>
                <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                  {!showNumbers ? '••••' : `${feedSummaries.reduce((a, b) => a + b.remainingBags, 0)} Bags`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Feed Categories</p>
                <p className="font-mono font-bold text-slate-700 text-sm mt-0.5">
                  {!showNumbers ? '••' : `${feedSummaries.length} Rations Monitored`}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Available Left Money</p>
                <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                  {!showNumbers ? '••••••••' : `$${financials.leftMoney.toFixed(2)}`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Net Approved Expenses</p>
                <p className="font-mono font-bold text-amber-800 text-sm mt-0.5">
                  {!showNumbers ? '••••••••' : `-$${financials.approvedExpenses.toFixed(2)}`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                <p className="text-[10px] text-slate-500">Pending Multi-Sig (&gt;$150)</p>
                <p className="font-mono font-bold text-slate-700 text-sm mt-0.5">
                  {!showNumbers ? '••••••••' : `$${financials.pendingMultiSigExpenses.toFixed(2)}`}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* SUB-TAB 1: IMMUTABLE EXPENSE LEDGER */}
      {subTab === 'LEDGER' && (
        <div className="space-y-3">
          {expenses.map((exp) => {
            const isContra = exp.direction === 'CONTRA_REVERSAL';
            const isPending = exp.approvalStatus === 'PENDING_MULTISIG';
            const leftMoneyDelta = -exp.amount;

            return (
              <div
                key={exp.id}
                className={`rounded-3xl border p-4 sm:p-5 space-y-3 shadow-2xs transition-all ${isContra
                  ? 'bg-amber-50/60 border-amber-200'
                  : isPending
                    ? 'bg-amber-50/30 border-amber-300'
                    : 'bg-white border-[#E8DFCE]'
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono min-w-0">
                    <span className="font-bold text-slate-900 whitespace-nowrap bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#E0D7C6]">
                      {exp.id}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0 whitespace-nowrap">
                      {exp.category.replace(/_/g, ' ')}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-medium text-slate-700 whitespace-nowrap">{exp.locationName}</span>
                  </div>
                  <span className="font-mono text-slate-500 whitespace-nowrap text-[11px]">
                    {new Date(exp.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {exp.referenceTransactionId && (
                  <div className="p-2 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    Linked Contra-Entry referencing Original Receipt #{exp.referenceTransactionId.slice(-6).toUpperCase()}
                  </div>
                )}

                <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed break-words">{exp.note}</p>

                {exp.receiptPhotoDataUrl && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptLightbox({
                          url: exp.receiptPhotoDataUrl!,
                          title: `Expense Receipt #${exp.id.slice(-6).toUpperCase()} · $${Math.abs(exp.amount).toFixed(2)} (${exp.category.replace('_', ' ')})`,
                        })
                      }
                      className="group flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 transition-all text-left cursor-pointer"
                    >
                      <img
                        src={exp.receiptPhotoDataUrl}
                        alt="Receipt thumbnail"
                        className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shadow-xs group-hover:scale-105 transition-transform"
                      />
                      <div>
                        <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                          <Eye className="w-3 h-3 text-emerald-700" />
                          <span>Receipt Attached</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium">Click to view full screen</div>
                      </div>
                    </button>
                  </div>
                )}

                <div className="pt-2.5 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 space-y-1 min-w-0">
                    <div>
                      Logged by <strong className="text-slate-800">{exp.loggedByName}</strong>
                      {exp.gpsStamp ? ` · GPS: ${exp.gpsStamp}` : ''}
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Verified Ledger Receipt · Ref #{exp.id.slice(-6).toUpperCase()}
                      {exp.receiptPhotoDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setReceiptLightbox({
                              url: exp.receiptPhotoDataUrl!,
                              title: `Expense Receipt #${exp.id.slice(-6).toUpperCase()} · $${Math.abs(exp.amount).toFixed(2)} (${exp.category.replace('_', ' ')})`,
                            })
                          }
                          className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200 cursor-pointer transition-colors"
                        >
                          <Camera className="w-3 h-3 text-sky-600" />
                          <span>View Receipt Photo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-base font-black font-mono tabular-nums ${leftMoneyDelta > 0
                          ? 'text-emerald-700'
                          : isPending
                            ? 'text-slate-600'
                            : 'text-amber-800'
                          }`}
                      >
                        {!showNumbers ? '••••••••' : (leftMoneyDelta > 0 ? `+$${leftMoneyDelta.toFixed(2)}` : `-$${Math.abs(leftMoneyDelta).toFixed(2)}`)}
                      </p>
                      <p className="text-[10px] font-mono font-semibold text-slate-500">
                        {isPending
                          ? 'PENDING MULTI-SIG'
                          : leftMoneyDelta > 0
                            ? 'Restored to Left Money'
                            : 'Deducted from Left Money'}
                      </p>
                    </div>

                    {canPostContra && (
                      <button
                        type="button"
                        onClick={() => handleOpenContraModal(exp)}
                        className="px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-bold text-amber-900 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap min-h-[38px]"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Reverse / Adjust
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: PENDING MULTI-SIG APPROVALS */}
      {subTab === 'MULTISIG' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed font-medium">
            <strong>Maker-Checker Governance Rule:</strong> Expenses &le; $150 deduct immediately from Left Money. Expenses &gt; $150 require single-tap approval by a Treasurer or Organization Admin.
          </div>

          {pendingExpenses.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#E8DFCE] p-8 text-center space-y-2 shadow-2xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">All Multi-Sig Expenses Cleared</p>
              <p className="text-xs text-slate-500">
                No expenses above $150 are currently awaiting Treasurer or Admin approval.
              </p>
            </div>
          ) : (
            pendingExpenses.map((exp) => (
              <div
                key={exp.id}
                className="rounded-3xl bg-white border border-amber-400 p-4 sm:p-5 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs text-amber-800 font-mono font-bold">
                  <span>{exp.id} · AWAITING MULTI-SIG (&gt; $150)</span>
                  <span className="text-lg font-black text-slate-900">{!showNumbers ? '••••••••' : `$${exp.amount.toFixed(2)}`}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{exp.note}</p>
                <div className="text-xs text-slate-500">
                  Site: <strong className="text-slate-800">{exp.locationName}</strong> · Logged by <strong className="text-slate-800">{exp.loggedByName}</strong>
                </div>
                <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between gap-2">
                  {canPostContra && (
                    <button
                      type="button"
                      onClick={() => handleOpenContraModal(exp)}
                      className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0D7C6] text-xs font-bold text-amber-900 hover:bg-[#F0EBE1] cursor-pointer min-h-[38px]"
                    >
                      Post Contra-Reversal Instead
                    </button>
                  )}
                  {canApproveMultiSig ? (
                    <button
                      type="button"
                      onClick={() => onApproveMultiSig(exp.id)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors min-h-[42px]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Deduct {!showNumbers ? '••••••••' : `$${exp.amount.toFixed(2)}`}
                    </button>
                  ) : (
                    <span className="text-xs text-amber-800 font-mono font-semibold flex items-center gap-1.5 py-1">
                      <Lock className="w-3.5 h-3.5" />
                      Requires Treasurer or Admin Sign-Off
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUB-TAB 3: FEED INVENTORY & BURN-RATE */}
      {subTab === 'FEED' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Site Feed Store & Burn-Rate Tracker</h2>
              <p className="text-xs text-slate-500">
                Append-only stock-in, daily rations consumed, and estimated days of feed remaining
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFeedLocId(
                    selectedLocationId !== 'ALL' ? selectedLocationId : locations[0]?.id || ''
                  );
                  setFeedBags('10');
                  setFeedNote('');
                  setFeedError('');
                  setShowFeedModal({ direction: 'STOCK_IN' });
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1"
              >
                + Log Feed Stock In
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedLocId(
                    selectedLocationId !== 'ALL' ? selectedLocationId : locations[0]?.id || ''
                  );
                  setFeedBags('1.5');
                  setFeedNote('');
                  setFeedError('');
                  setShowFeedModal({ direction: 'DAILY_CONSUMPTION' });
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1"
              >
                - Log Daily Feed Used
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {feedSummaries.map((item) => {
              const totalBagsUsed = item.totalBagsConsumed;
              const totalLogs = item.events.length;
              const avgBagsPerDay = totalLogs > 0 ? (totalBagsUsed / Math.max(1, totalLogs)).toFixed(1) : '1.5';
              const isLowFeed = item.daysRemaining <= 5;
              const isWarnFeed = item.daysRemaining <= 10;

              return (
                <div
                  key={`${item.locationId}-${item.feedType}`}
                  className="rounded-3xl bg-white border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-[#D6C7AE] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 break-words">{item.locationName}</p>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5 break-words whitespace-normal">{item.feedType}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${isLowFeed
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : isWarnFeed
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                    >
                      {isLowFeed ? 'Critical Stock Alert' : isWarnFeed ? 'Order Soon' : 'Sufficient Feed'}
                    </span>
                  </div>

                  {/* Stock Level Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono font-semibold">
                      <span className="text-slate-600">Stock Availability:</span>
                      <span className="text-emerald-700">{!showNumbers ? '•••• Bags (•••• kg)' : `${item.remainingBags} Bags (${item.remainingKg} kg)`}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#FAF8F5] border border-[#E8DFCE] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isLowFeed ? 'bg-rose-500' : isWarnFeed ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        style={{
                          width: `${Math.min(100, Math.max(8, (item.remainingBags / Math.max(1, item.totalBagsStockedIn)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Detailed 4-Metric Grid */}
                  <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#F0EBE1] text-xs">
                    <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500">Remaining Stock</p>
                      <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                        {!showNumbers ? '••••' : `${item.remainingBags} bags`}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">{!showNumbers ? '••••' : `${item.remainingKg} kg total`}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500">Stocked / Consumed</p>
                      <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {!showNumbers ? '•••• / ••••' : `+${item.totalBagsStockedIn} / -${item.totalBagsConsumed}`}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">bags logged</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500">Estimated Burn Rate</p>
                      <p className="font-mono font-bold text-amber-800 text-sm mt-0.5">
                        {!showNumbers ? '••••' : `~${avgBagsPerDay} bags/day`}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">daily site usage</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500">Days Remaining</p>
                      <p
                        className={`font-mono font-black text-sm mt-0.5 ${isLowFeed ? 'text-rose-600' : isWarnFeed ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                      >
                        {!showNumbers ? '•• Days Left' : `~${item.daysRemaining} Days Left`}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">until empty</p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cardKey = `${item.locationId}-${item.feedType}`;
                        setExpandedFeedKey(expandedFeedKey === cardKey ? null : cardKey);
                      }}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#E0D7C6]"
                    >
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      <span>{item.events.length} Feed Logs</span>
                      {expandedFeedKey === `${item.locationId}-${item.feedType}` ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedLocId(item.locationId);
                        setFeedType(item.feedType);
                        setFeedBags('1');
                        setFeedNote('');
                        setFeedError('');
                        setShowFeedModal({
                          direction: 'CONTRA_REVERSAL',
                          defaultFeedType: item.feedType,
                          defaultLocationId: item.locationId,
                          referenceId: item.events[0]?.id,
                        });
                      }}
                      className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-600" />
                      Post Contra-Adjustment
                    </button>
                  </div>

                  {/* EXPANDED FEED MOVEMENTS HISTORY */}
                  {expandedFeedKey === `${item.locationId}-${item.feedType}` && (
                    <div className="pt-3 border-t border-[#F0EBE1] space-y-2 text-xs">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <History className="w-3 h-3 text-amber-600" />
                        Detailed Feed Audit Log ({item.events.length} Entries)
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {item.events.length === 0 ? (
                          <p className="text-slate-400 italic text-[11px]">No feed movements logged yet.</p>
                        ) : (
                          item.events.map((evt) => {
                            const isStockIn = evt.direction === 'STOCK_IN';
                            const isContra = evt.direction === 'CONTRA_REVERSAL';
                            return (
                              <div
                                key={evt.id}
                                className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-1"
                              >
                                <div className="flex items-center justify-between font-mono text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${isStockIn
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isContra
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                        }`}
                                    >
                                      {isStockIn ? '+STOCK IN' : isContra ? 'CONTRA ADJ' : '-DAILY RATION'}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      {!showNumbers ? '•••• Bags (•••• kg)' : `${evt.bagsDelta > 0 ? `+${evt.bagsDelta}` : evt.bagsDelta} Bags (${Math.abs(evt.bagsDelta * evt.kgPerBag)} kg)`}
                                    </span>
                                  </div>
                                  <span className="text-slate-400 text-[10px]">
                                    {new Date(evt.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-700 font-medium break-words leading-tight">{evt.note}</p>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Logged by <strong className="text-slate-700">{evt.loggedByName}</strong> · Ref #{evt.id.slice(-6).toUpperCase()}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LOG FARM EXPENSE BOTTOM SHEET */}
      <LogExpenseSheet
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        activeMember={activeMember}
      />

      {/* CONTRA-ENTRY REVERSAL SHEET */}
      {contraTargetExpense && (
        <ContraExpenseSheet
          isOpen={Boolean(contraTargetExpense)}
          onClose={() => setContraTargetExpense(null)}
          expense={contraTargetExpense}
          activeMember={activeMember}
          onContraCompleted={() => setContraTargetExpense(null)}
        />
      )}

      {/* FEED CONSUMPTION BOTTOM SHEET */}
      {showFeedModal && (
        <FeedEventSheet
          isOpen={Boolean(showFeedModal)}
          onClose={() => setShowFeedModal(null)}
          activeMember={activeMember}
        />
      )}

      {/* RECEIPT HIGH-RES LIGHTBOX SHEET */}
      {receiptLightbox && (
        <ImageViewerSheet
          isOpen={Boolean(receiptLightbox)}
          onClose={() => setReceiptLightbox(null)}
          imageUrl={receiptLightbox.url}
          title={receiptLightbox.title}
        />
      )}

      {/* SPEND GATE MODAL */}
      {pendingGateData && (
        <SpendGateDialog
          isOpen={spendGateOpen}
          onClose={() => setSpendGateOpen(false)}
          amount={pendingGateData.amount}
          category={pendingGateData.category}
          lines={runway.lines}
          reserveLeft={runway.layers.reserveLeft}
          onAllocate={handleSpendGateAllocate}
        />
      )}
    </div>
  );
};
