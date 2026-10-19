import React, { useState } from 'react';
import {
  Plus,
  RotateCcw,
  Truck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type {
  AssetCondition,
  FarmLocation,
  FixedAssetCategory,
  FixedAssetGroupSummary,
  FixedAssetLedgerEvent,
  SyndicateMember,
} from '../types/agro.ts';
import { PERMISSIONS } from '../utils/permissions.ts';

interface AssetsTabProps {
  assetGroups: FixedAssetGroupSummary[];
  locations: FarmLocation[];
  selectedLocationId: string;
  activeMember: SyndicateMember;
  onLogAssetEvent: (data: {
    assetGroupId?: string;
    assetName: string;
    category: FixedAssetCategory;
    locationId: string;
    direction: FixedAssetLedgerEvent['direction'];
    quantityDelta: number;
    valueDelta: number;
    condition: AssetCondition;
    referenceTransactionId?: string;
    note: string;
    deductFromLeftMoney?: boolean;
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
];

export const AssetsTab: React.FC<AssetsTabProps> = ({
  assetGroups,
  locations,
  selectedLocationId,
  activeMember,
  onLogAssetEvent,
  onTransferAsset,
  showNumbers = true,
}) => {
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Register New Fixed Asset Modal
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [astName, setAstName] = useState('');
  const [astCategory, setAstCategory] = useState<FixedAssetCategory>('HOUSING_INFRASTRUCTURE');
  const [astLocId, setAstLocId] = useState(
    selectedLocationId !== 'ALL'
      ? selectedLocationId
      : activeMember.assignedLocationId || locations[0]?.id || ''
  );
  const [astQty, setAstQty] = useState('1');
  const [astValue, setAstValue] = useState('350');
  const [astCondition, setAstCondition] = useState<AssetCondition>('EXCELLENT');
  const [astDeductCash, setAstDeductCash] = useState(true);
  const [astNote, setAstNote] = useState('');
  const [astError, setAstError] = useState('');

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

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!astName.trim() || astNote.trim().length < 4) {
      setAstError('Please provide the asset name and a mandatory audit note (min 4 chars).');
      return;
    }
    const qty = Math.max(1, parseInt(astQty, 10) || 1);
    const val = Math.max(0, parseFloat(astValue) || 0);

    onLogAssetEvent({
      assetName: astName.trim(),
      category: astCategory,
      locationId: astLocId || locations[0].id,
      direction: 'INITIAL',
      quantityDelta: qty,
      valueDelta: val,
      condition: astCondition,
      note: astNote.trim(),
      deductFromLeftMoney: astDeductCash,
    });
    setAstName('');
    setAstNote('');
    setAstError('');
    setShowNewAssetModal(false);
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

          return (
            <div
              key={groupKey}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">
                    {group.locationName} · {group.category.replace(/_/g, ' ')} · Condition:{' '}
                    <strong className="text-emerald-300">{group.latestCondition}</strong>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">{group.assetName}</h3>
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

      {/* REGISTER NEW FIXED ASSET MODAL */}
      {showNewAssetModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-asset-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="new-asset-title" className="text-base font-bold text-slate-900">
                Register New Fixed Asset
              </h2>
              <button
                type="button"
                onClick={() => setShowNewAssetModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="modal-body-scroll mt-4 space-y-3.5">
              {astError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {astError}
                </p>
              )}

              <div>
                <label htmlFor="ast-name" className="block text-xs font-medium text-slate-300 mb-1">
                  Asset / Infrastructure Name *
                </label>
                <input
                  id="ast-name"
                  type="text"
                  required
                  placeholder="e.g. 20x Chick Brooder Infrared Lamps & Guard Rings"
                  value={astName}
                  onChange={(e) => setAstName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ast-loc" className="block text-xs font-medium text-slate-300 mb-1">
                    Farm Site
                  </label>
                  <select
                    id="ast-loc"
                    value={astLocId}
                    onChange={(e) => setAstLocId(e.target.value)}
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
                  <label htmlFor="ast-cat" className="block text-xs font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    id="ast-cat"
                    value={astCategory}
                    onChange={(e) => setAstCategory(e.target.value as FixedAssetCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="ast-qty" className="block text-xs font-medium text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    id="ast-qty"
                    type="number"
                    min="1"
                    value={astQty}
                    onChange={(e) => setAstQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="ast-val" className="block text-xs font-medium text-slate-300 mb-1">
                    Total Value ($) *
                  </label>
                  <input
                    id="ast-val"
                    type="number"
                    min="1"
                    step="0.01"
                    value={astValue}
                    onChange={(e) => setAstValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="ast-cond" className="block text-xs font-medium text-slate-300 mb-1">
                    Condition
                  </label>
                  <select
                    id="ast-cond"
                    value={astCondition}
                    onChange={(e) => setAstCondition(e.target.value as AssetCondition)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              {!isGroundOperator && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={astDeductCash}
                    onChange={(e) => setAstDeductCash(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-xs text-slate-200">
                    Deduct purchase cost (${astValue || '0'}) from Syndicate Left Money
                  </span>
                </label>
              )}

              <div>
                <label htmlFor="ast-note" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Audit Note *
                </label>
                <textarea
                  id="ast-note"
                  rows={2}
                  required
                  placeholder="Describe supplier, serial number, or construction details..."
                  value={astNote}
                  onChange={(e) => setAstNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewAssetModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                >
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VALUATION / QUANTITY CONTRA-ADJUSTMENT MODAL */}
      {adjustTarget && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adj-asset-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <div>
                <h2 id="adj-asset-title" className="text-base font-bold text-slate-900">
                  Log Asset Valuation / Quantity Adjustment
                </h2>
                <p className="text-xs text-slate-500">{adjustTarget.assetName}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {adjError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {adjError}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="adj-qty" className="block text-xs font-medium text-slate-300 mb-1">
                    Qty Delta (+ or -)
                  </label>
                  <input
                    id="adj-qty"
                    type="number"
                    value={adjQtyDelta}
                    onChange={(e) => setAdjQtyDelta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="adj-val" className="block text-xs font-medium text-slate-300 mb-1">
                    Value Delta ($)
                  </label>
                  <input
                    id="adj-val"
                    type="number"
                    step="0.01"
                    value={adjValDelta}
                    onChange={(e) => setAdjValDelta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="adj-cond" className="block text-xs font-medium text-slate-300 mb-1">
                    Updated Cond.
                  </label>
                  <select
                    id="adj-cond"
                    value={adjCondition}
                    onChange={(e) => setAdjCondition(e.target.value as AssetCondition)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="adj-note" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Reason for Adjustment (Depreciation, Breakage, Count Fix) *
                </label>
                <textarea
                  id="adj-note"
                  rows={2}
                  required
                  placeholder="e.g. 2 bell drinkers cracked during winter frost..."
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500"
                >
                  Append Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-LOCATION ASSET TRANSFER MODAL */}
      {transferTarget && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tr-asset-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <div>
                <h2 id="tr-asset-title" className="text-base font-bold text-slate-900">
                  Transfer Fixed Asset Between Farm Sites
                </h2>
                <p className="text-xs text-slate-500">
                  From {transferTarget.locationName} (Available: {transferTarget.currentQuantity})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferTarget(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {trError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {trError}
                </p>
              )}

              <div>
                <label htmlFor="tr-to-loc" className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Farm Site *
                </label>
                <select
                  id="tr-to-loc"
                  value={trToLocId}
                  onChange={(e) => setTrToLocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {locations
                    .filter((l) => l.id !== transferTarget.locationId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tr-qty" className="block text-xs font-medium text-slate-300 mb-1">
                    Quantity to Transfer *
                  </label>
                  <input
                    id="tr-qty"
                    type="number"
                    min="1"
                    max={transferTarget.currentQuantity}
                    value={trQty}
                    onChange={(e) => setTrQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tr-val" className="block text-xs font-medium text-slate-300 mb-1">
                    Book Value Transferred ($) *
                  </label>
                  <input
                    id="tr-val"
                    type="number"
                    min="0"
                    step="0.01"
                    value={trVal}
                    onChange={(e) => setTrVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tr-note" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Dispatch & Transfer Note *
                </label>
                <textarea
                  id="tr-note"
                  rows={2}
                  required
                  placeholder="e.g. Dispatched 10 tubular feeders to Gweru via pickup truck..."
                  value={trNote}
                  onChange={(e) => setTrNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                >
                  Log Paired Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
