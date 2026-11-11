import React, { useState, useRef } from 'react';
import {
  Plus,
  RotateCcw,
  Truck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Maximize2,
  Upload,
} from 'lucide-react';
import type {
  AssetCondition,
  FarmLocation,
  FixedAssetCategory,
  FixedAssetGroupSummary,
  FixedAssetLedgerEvent,
  OrgMember,
} from '../types/agro.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';
import { useRunway } from '../hooks/useRunway.ts';
import { SpendGateDialog } from './runway/SpendGateDialog.tsx';
import { AssetSheet } from '../sheets/assets/AssetSheet.tsx';
import { AdjustAssetSheet } from '../sheets/assets/AdjustAssetSheet.tsx';
import { TransferAssetSheet } from '../sheets/assets/TransferAssetSheet.tsx';
import { ImageViewerSheet } from './ui/ImageViewerSheet.tsx';
import { dataService } from '../services/dataService.ts';
import type { RunwayAllocation } from '../types/runway.ts';
import { RunwayError } from '../types/runway.ts';

interface AssetsTabProps {
  assetGroups: FixedAssetGroupSummary[];
  locations: FarmLocation[];
  selectedLocationId: string;
  activeMember: OrgMember;
  leftMoney?: number;
  onLogAssetEvent: (data: {
    assetGroupId?: string;
    assetName: string;
    category: FixedAssetCategory;
    locationId?: string;
    direction: FixedAssetLedgerEvent['direction'];
    quantityDelta: number;
    valueDelta: number;
    condition: AssetCondition;
    referenceTransactionId?: string;
    note: string;
    deductFromLeftMoney?: boolean;
    photoUrl?: string;
    runwayAllocation?: RunwayAllocation;
  }) => void;
  onTransferAsset: (data: {
    assetGroupId: string;
    assetName: string;
    category: FixedAssetCategory;
    fromLocationId: string;
    toLocationId: string;
    quantityToTransfer: number;
    valueToTransfer: number;
    condition: AssetCondition;
    note: string;
  }) => void;
  showNumbers?: boolean;
}

const ASSET_CATEGORIES: { value: FixedAssetCategory; label: string }[] = [
  { value: 'HOUSING_INFRASTRUCTURE', label: 'Poultry & Goat Housing' },
  { value: 'WATER_SOLAR', label: 'Solar & Borehole Water' },
  { value: 'FEEDERS_EQUIPMENT', label: 'Feeders & Drinkers' },
  { value: 'FENCING_SECURITY', label: 'Fencing & Kraal Security' },
  { value: 'TOOLS_MACHINERY', label: 'Tools & Machinery' },
  { value: 'CUSTOM', label: '+ Other / Custom Category...' },
];

export const AssetsTab: React.FC<AssetsTabProps> = ({
  assetGroups,
  locations,
  selectedLocationId,
  activeMember,
  leftMoney = 0,
  onLogAssetEvent,
  onTransferAsset,
  showNumbers = true,
}) => {
  const isAgro = dataService.isAgroOrganization(activeMember?.orgId);
  const runway = useRunway();
  const [spendGateOpen, setSpendGateOpen] = useState(false);
  const [pendingAssetData, setPendingAssetData] = useState<{
    payload: Parameters<typeof onLogAssetEvent>[0];
    cost: number;
  } | null>(null);

  const astFileInputRef = useRef<HTMLInputElement>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Register New Fixed Asset Modal
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [astName, setAstName] = useState('');
  const [astCategory, setAstCategory] = useState<FixedAssetCategory>('HOUSING_INFRASTRUCTURE');
  const [customCategory, setCustomCategory] = useState('');
  const [astLocId, setAstLocId] = useState(
    selectedLocationId !== 'ALL'
      ? selectedLocationId
      : activeMember.assignedLocationId || locations[0]?.id || ''
  );
  const [astQty, setAstQty] = useState('1');
  const [astValue, setAstValue] = useState('350');
  const [astCondition, setAstCondition] = useState<AssetCondition>('EXCELLENT');
  const [astNote, setAstNote] = useState('');
  const [astPhoto, setAstPhoto] = useState<string | null>(null);
  const [isCompressingAstPhoto, setIsCompressingAstPhoto] = useState(false);
  const [astError, setAstError] = useState('');

  // Lightbox Viewer
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Valuation / Quantity Adjustment Modal (Contra-Entry)
  const [adjustTarget, setAdjustTarget] = useState<FixedAssetGroupSummary | null>(null);
  const [adjQtyDelta, setAdjQtyDelta] = useState('0');
  const [adjValDelta, setAdjValDelta] = useState('-50');
  const [adjCondition, setAdjCondition] = useState<AssetCondition>('GOOD');
  const [adjNote, setAdjNote] = useState('');
  const [adjError, setAdjError] = useState('');

  // Transfer Asset Between Locations Modal
  const [transferTarget, setTransferTarget] = useState<FixedAssetGroupSummary | null>(null);
  const [trToLocId, setTrToLocId] = useState('');
  const [trQty, setTrQty] = useState('1');
  const [trVal, setTrVal] = useState('100');
  const [trNote, setTrNote] = useState('');
  const [trError, setTrError] = useState('');

  const totalValuation = assetGroups.reduce((acc, g) => acc + g.currentValue, 0);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setAstError(validation.error || 'Invalid file format');
      return;
    }
    setIsCompressingAstPhoto(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
      setAstPhoto(compressed);
      setAstError('');
    } catch (err: unknown) {
      setAstError(err instanceof Error ? err.message : 'Photo compression failed');
    } finally {
      setIsCompressingAstPhoto(false);
      e.target.value = '';
    }
  };

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!astName.trim() || astNote.trim().length < 4) {
      setAstError('Please provide the asset name and a mandatory audit note (min 4 chars).');
      return;
    }
    const targetLocId = astLocId || locations[0]?.id;
    if (isAgro && !targetLocId) {
      setAstError('Please register a farm site location first before adding fixed assets.');
      return;
    }
    const qty = Math.max(1, parseInt(astQty, 10) || 1);
    const val = Math.max(0, parseFloat(astValue) || 0);

    if (val <= 0) {
      setAstError('Please enter a valid purchase cost greater than $0.');
      return;
    }
    if (leftMoney !== undefined) {
      if (leftMoney <= 0) {
        setAstError('Cannot purchase asset: No funds available in Left Money pool ($0.00).');
        return;
      }
      if (val > leftMoney) {
        setAstError(`Cannot purchase asset: Cost ($${val.toFixed(2)}) exceeds available Left Money balance ($${leftMoney.toFixed(2)}).`);
        return;
      }
    }

    const finalCategory = astCategory === 'CUSTOM' ? (customCategory.trim() || 'General Fixed Asset') : astCategory;
    if (!finalCategory) {
      setAstError('Please specify the asset category.');
      return;
    }

    const assetPayload: Parameters<typeof onLogAssetEvent>[0] = {
      assetName: astName.trim(),
      category: finalCategory,
      locationId: isAgro ? targetLocId : undefined,
      direction: 'INITIAL',
      quantityDelta: qty,
      valueDelta: val,
      condition: astCondition,
      note: astNote.trim(),
      deductFromLeftMoney: true,
      photoUrl: astPhoto || undefined,
    };

    try {
      onLogAssetEvent(assetPayload);
      setAstName('');
      setCustomCategory('');
      setAstNote('');
      setAstPhoto(null);
      setAstError('');
      setShowNewAssetModal(false);
    } catch (err: unknown) {
      const isRunwayGateError =
        err instanceof RunwayError ||
        (err as { code?: string })?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
        (err as { code?: string })?.code === 'RUNWAY_LINE_OVERRUN' ||
        (err instanceof Error && err.message.toLowerCase().includes('runway spend gate blocked'));

      if (isRunwayGateError) {
        setPendingAssetData({ payload: assetPayload, cost: val });
        setSpendGateOpen(true);
      } else {
        setAstError(err instanceof Error ? err.message : 'Failed to register asset.');
      }
    }
  };

  const handleAssetSpendGateAllocate = (allocation: RunwayAllocation) => {
    if (!pendingAssetData) return;
    try {
      onLogAssetEvent({
        ...pendingAssetData.payload,
        runwayAllocation: allocation,
      });
      setSpendGateOpen(false);
      setPendingAssetData(null);
      setAstName('');
      setCustomCategory('');
      setAstNote('');
      setAstPhoto(null);
      setAstError('');
      setShowNewAssetModal(false);
    } catch (err: unknown) {
      console.warn('Spend allocation rejected:', err);
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    if (adjNote.trim().length < 4) {
      setAdjError('Mandatory explanation note is required for valuation/quantity adjustments.');
      return;
    }
    const qDelta = parseFloat(adjQtyDelta) || 0;
    const vDelta = parseFloat(adjValDelta) || 0;
    if (qDelta === 0 && vDelta === 0) {
      setAdjError('Enter a non-zero quantity delta or value delta ($).');
      return;
    }

    try {
      onLogAssetEvent({
        assetGroupId: adjustTarget.assetGroupId,
        assetName: adjustTarget.assetName,
        category: adjustTarget.category,
        locationId: adjustTarget.locationId,
        direction: 'CONTRA_REVERSAL',
        quantityDelta: qDelta,
        valueDelta: vDelta,
        condition: adjCondition,
        referenceTransactionId: adjustTarget.events[0]?.id,
        note: adjNote.trim(),
      });
      setAdjustTarget(null);
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : 'Failed to log asset adjustment.');
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    if (!trToLocId || trToLocId === transferTarget.locationId) {
      setTrError('Please select a different destination farm site.');
      return;
    }
    if (trNote.trim().length < 4) {
      setTrError('Mandatory transfer reason note (min 4 chars) is required.');
      return;
    }
    const q = Math.max(1, parseFloat(trQty) || 1);
    const v = Math.max(0, parseFloat(trVal) || 0);
    if (q > transferTarget.currentQuantity) {
      setTrError(`Cannot transfer more than available quantity (${transferTarget.currentQuantity}).`);
      return;
    }

    try {
      onTransferAsset({
        assetGroupId: transferTarget.assetGroupId,
        assetName: transferTarget.assetName,
        category: transferTarget.category,
        fromLocationId: transferTarget.locationId,
        toLocationId: trToLocId,
        quantityToTransfer: q,
        valueToTransfer: v,
        condition: transferTarget.latestCondition,
        note: trNote.trim(),
      });
      setTransferTarget(null);
    } catch (err) {
      setTrError(err instanceof Error ? err.message : 'Failed to transfer asset.');
    }
  };

  const isGroundOperator = activeMember.role === 'GROUND_OPERATOR';
  const canAdjustValuation = PERMISSIONS.canAdjustAssetValuation(activeMember.role);
  const totalQuantityUnits = assetGroups.reduce((acc, g) => acc + g.currentQuantity, 0);

  return (
    <div className="space-y-4 pb-6">
      {/* Total Fixed Assets Summary Card */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            {isGroundOperator ? 'Station Equipment & Housing Assets' : 'Total Fixed Assets Net Valuation'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white mt-0.5">
            {!showNumbers
              ? '••••••••'
              : isGroundOperator
                ? `${totalQuantityUnits} Units Installed`
                : `$${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {!showNumbers ? '••' : assetGroups.length} active infrastructure & equipment groups tracked
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewAssetModal(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Register New Fixed Asset
        </button>
      </section>

      {/* Asset Group Cards */}
      <div className="space-y-3">
        {assetGroups.map((group) => {
          const groupKey = `${group.assetGroupId}-${group.locationId}`;
          const isOpen = expandedGroupKey === groupKey;
          const primaryPhoto = group.events.slice().reverse().find((e) => e.photoUrl)?.photoUrl;

          return (
            <div
              key={groupKey}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {primaryPhoto && (
                    <div
                      onClick={() => setLightboxPhoto({ url: primaryPhoto, title: group.assetName })}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0 cursor-pointer group/thumb"
                    >
                      <img
                        src={primaryPhoto}
                        alt={group.assetName}
                        className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-slate-400">
                      {group.locationName} · {group.category.replace(/_/g, ' ')} · Condition:{' '}
                      <strong className="text-emerald-300">{group.latestCondition}</strong>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">{group.assetName}</h3>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <p className="text-base font-bold text-emerald-400">
                    {!showNumbers ? '••••••••' : `$${group.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-xs text-slate-400">Qty: {!showNumbers ? '••••' : group.currentQuantity} units</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {canAdjustValuation && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustTarget(group);
                        setAdjQtyDelta('0');
                        setAdjValDelta('-50');
                        setAdjCondition(group.latestCondition);
                        setAdjNote('');
                        setAdjError('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-amber-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Log Valuation / Qty Adjustment
                    </button>
                  )}

                  {isAgro && locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const otherLoc =
                          locations.find((l) => l.id !== group.locationId)?.id || '';
                        setTransferTarget(group);
                        setTrToLocId(otherLoc);
                        setTrQty('1');
                        setTrVal(
                          String(
                            group.currentQuantity > 0
                              ? Math.round(group.currentValue / group.currentQuantity)
                              : group.currentValue
                          )
                        );
                        setTrNote('');
                        setTrError('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Transfer Between Sites
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedGroupKey(isOpen ? null : groupKey)}
                  className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  History ({group.events.length})
                </button>
              </div>

              {isOpen && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                  {group.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="py-1.5 border-b border-slate-800/70 last:border-none space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          <strong className="text-slate-200 font-mono">Ref #{ev.id.slice(-6).toUpperCase()}</strong> ·{' '}
                          <span className="text-emerald-400 font-medium">
                            {ev.direction === 'ADDITION' ? 'Acquisition' : ev.direction === 'DEDUCTION' ? 'Depreciation' : ev.direction === 'CONTRA_REVERSAL' ? 'Contra Adjustment' : 'Initial Registration'}
                          </span>
                          {ev.referenceTransactionId ? ` · Linked Ref #${ev.referenceTransactionId.slice(-6).toUpperCase()}` : ''}
                        </span>
                        <span className="font-mono">
                          Qty {!showNumbers ? '••••' : (ev.quantityDelta >= 0 ? `+${ev.quantityDelta}` : ev.quantityDelta)} ·{' '}
                          {!showNumbers ? '••••••••' : (ev.valueDelta >= 0 ? `+$${ev.valueDelta}` : `-$${Math.abs(ev.valueDelta)}`)}
                        </span>
                      </div>
                      <p className="text-slate-200">{ev.note}</p>
                      {ev.photoUrl && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPhoto({
                                url: ev.photoUrl!,
                                title: `${group.assetName} - Event #${ev.id.slice(-6).toUpperCase()}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-[11px] text-emerald-400 font-medium border border-slate-700 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            View Attached Asset Photo
                          </button>
                        </div>
                      )}
                      <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Verified Asset Entry · Logged by {ev.loggedByName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 1. REGISTER NEW FIXED ASSET BOTTOM SHEET */}
      <AssetSheet
        isOpen={showNewAssetModal}
        onClose={() => setShowNewAssetModal(false)}
        locations={locations}
        activeMember={activeMember}
        leftMoney={leftMoney ?? 0}
      />

      {/* 2. VALUATION / QUANTITY ADJUSTMENT BOTTOM SHEET */}
      {adjustTarget && adjustTarget.events && adjustTarget.events.length > 0 && (
        <AdjustAssetSheet
          isOpen={Boolean(adjustTarget)}
          onClose={() => setAdjustTarget(null)}
          asset={adjustTarget.events[0]}
          activeMember={activeMember}
        />
      )}

      {/* 3. INTER-LOCATION ASSET TRANSFER BOTTOM SHEET */}
      {transferTarget && transferTarget.events && transferTarget.events.length > 0 && (
        <TransferAssetSheet
          isOpen={Boolean(transferTarget)}
          onClose={() => setTransferTarget(null)}
          asset={transferTarget.events[0]}
          activeMember={activeMember}
        />
      )}

      {/* 4. PHOTO LIGHTBOX VIEWER SHEET */}
      <ImageViewerSheet
        isOpen={Boolean(lightboxPhoto)}
        onClose={() => setLightboxPhoto(null)}
        imageUrl={lightboxPhoto?.url}
        title={lightboxPhoto?.title}
      />

      {/* SPEND GATE MODAL */}
      {pendingAssetData && (
        <SpendGateDialog
          isOpen={spendGateOpen}
          onClose={() => setSpendGateOpen(false)}
          amount={pendingAssetData.cost}
          category="FIXED_ASSET_PURCHASE"
          lines={runway.lines}
          reserveLeft={runway.layers.reserveLeft}
          onAllocate={handleAssetSpendGateAllocate}
        />
      )}
    </div>
  );
};
