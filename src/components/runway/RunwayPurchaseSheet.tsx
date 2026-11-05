import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import type { RunwayPlan, RunwayLine } from '../../types/runway';
import type { FarmLocation, OrgMember, FixedAssetCategory, ExpenseCategory } from '../../types/agro';
import { dataService } from '../../services/dataService';
import { useBackHandler } from '../../navigation/useBackHandler';

interface RunwayPurchaseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  line: RunwayLine;
  plan: RunwayPlan;
  availableCash: number;
  locations: FarmLocation[];
  currentMember: OrgMember;
  remainingBudget: number;
  spentSoFar: number;
  onSuccess: (message: string) => void;
}

function mapLineCategoryToExpenseCategory(cat: string): ExpenseCategory {
  const c = cat.toUpperCase();
  if (c.includes('FEED')) return 'FEED';
  if (c.includes('MEDIC') || c.includes('VACCIN')) return 'VACCINES_MEDICATION';
  if (c.includes('CHICK') || c.includes('LIVESTOCK')) return 'LIVESTOCK_PURCHASE';
  if (c.includes('EQUIP') || c.includes('ASSET')) return 'FIXED_ASSET_PURCHASE';
  if (c.includes('LABOR') || c.includes('WAGE')) return 'LABOR_WAGES';
  if (c.includes('TRANSPORT') || c.includes('LOGISTIC')) return 'TRANSPORT_LOGISTICS';
  if (c.includes('UTILIT') || c.includes('FUEL') || c.includes('GAS')) return 'UTILITIES_SECURITY';
  if (c.includes('MAINTENANCE') || c.includes('REPAIR')) return 'MAINTENANCE';
  return 'OTHER';
}

function mapLineCategoryToAssetCategory(cat: string): FixedAssetCategory {
  const c = cat.toUpperCase();
  if (c.includes('WATER') || c.includes('SOLAR') || c.includes('PUMP')) return 'WATER_SOLAR';
  if (c.includes('FEEDER') || c.includes('DRINKER')) return 'FEEDERS_EQUIPMENT';
  if (c.includes('FENC') || c.includes('SECURITY')) return 'FENCING_SECURITY';
  if (c.includes('HOUSE') || c.includes('SHED') || c.includes('BUILD') || c.includes('COOP')) return 'HOUSING_INFRASTRUCTURE';
  return 'TOOLS_MACHINERY';
}

export const RunwayPurchaseSheet: React.FC<RunwayPurchaseSheetProps> = ({
  isOpen,
  onClose,
  line,
  plan,
  availableCash,
  locations,
  currentMember,
  remainingBudget,
  spentSoFar,
  onSuccess,
}) => {
  const linePlannedTotal = Number((line.qty * line.unitCost).toFixed(2));
  const actualRemainingBudget = Math.max(0, Number((linePlannedTotal - spentSoFar).toFixed(2)));
  const actualRemainingUnits =
    line.unitCost > 0
      ? Math.max(0, Number((actualRemainingBudget / line.unitCost).toFixed(2)))
      : (actualRemainingBudget > 0 ? (line.qty || 1) : 0);

  const initialAmount = actualRemainingBudget > 0 ? actualRemainingBudget : 0;
  const initialQty = actualRemainingUnits > 0 ? actualRemainingUnits : 0;

  const [purchaseQtyStr, setPurchaseQtyStr] = useState<string>(String(initialQty));
  const [purchaseAmountStr, setPurchaseAmountStr] = useState<string>(String(Number(initialAmount.toFixed(2))));
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations[0]?.id || plan.locationId || 'LOC-MAIN'
  );
  const [note, setNote] = useState<string>(`Purchase of ${line.title}`);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Capital asset toggle: auto-checked if line was marked CAPEX or category is EQUIPMENT
  const isDefaultCapex = Boolean(
    line.excludeFromContingency ||
    line.category === 'EQUIPMENT' ||
    line.category === 'Equipment & Assets'
  );
  const [isCapitalAsset, setIsCapitalAsset] = useState<boolean>(isDefaultCapex);
  const [assetCategory, setAssetCategory] = useState<FixedAssetCategory>(
    mapLineCategoryToAssetCategory(line.category)
  );
  const [assetCondition, setAssetCondition] = useState<'EXCELLENT' | 'GOOD' | 'FAIR'>('EXCELLENT');

  useBackHandler(
    100,
    () => {
      if (!isOpen) return false;
      onClose();
      return true;
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      const remCash = Math.max(0, Number(((line.qty * line.unitCost) - spentSoFar).toFixed(2)));
      const remUnits =
        line.unitCost > 0
          ? Math.max(0, Number((remCash / line.unitCost).toFixed(2)))
          : (remCash > 0 ? (line.qty || 1) : 0);

      const defaultQty = remUnits > 0 ? remUnits : 0;
      const defaultAmount = remCash > 0 ? remCash : 0;

      setPurchaseQtyStr(String(defaultQty));
      setPurchaseAmountStr(String(Number(defaultAmount.toFixed(2))));
      setNote(`Purchase of ${line.title}`);
      setErrorMsg(null);
      setIsSubmitting(false);
      setPhotoDataUrl(undefined);
      const isCapex = Boolean(
        line.excludeFromContingency ||
        line.category === 'EQUIPMENT' ||
        line.category === 'Equipment & Assets'
      );
      setIsCapitalAsset(isCapex);
      setAssetCategory(mapLineCategoryToAssetCategory(line.category));
      if (locations.length > 0) {
        setSelectedLocationId(locations[0].id);
      }
    }
  }, [isOpen, line, spentSoFar, locations]);

  if (!isOpen) return null;

  const parsedQty = parseFloat(purchaseQtyStr);
  const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const parsedAmount = parseFloat(purchaseAmountStr);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const isCashSufficient = availableCash >= validAmount;

  const isAlreadyFullyPaid = actualRemainingBudget <= 0.01 || actualRemainingUnits <= 0;
  const isOverBudget = validAmount > actualRemainingBudget + 0.01;
  const isOverQty = actualRemainingUnits > 0 && validQty > actualRemainingUnits + 0.001;
  const overrunAmount = isOverBudget ? Number((validAmount - actualRemainingBudget).toFixed(2)) : 0;

  const handleQtyChange = (nextQtyStr: string) => {
    const numQty = parseFloat(nextQtyStr);
    if (Number.isFinite(numQty) && actualRemainingUnits > 0 && numQty > actualRemainingUnits) {
      setPurchaseQtyStr(String(actualRemainingUnits));
      const calcAmount = Number((actualRemainingUnits * line.unitCost).toFixed(2));
      setPurchaseAmountStr(String(calcAmount));
      setErrorMsg(
        `Quantity capped: Only ${actualRemainingUnits} ${line.unitLabel || 'units'} remain in this plan line. You cannot buy ${numQty}.`
      );
      return;
    }

    if (actualRemainingUnits <= 0) {
      setPurchaseQtyStr('0');
      setPurchaseAmountStr('0.00');
      setErrorMsg('This line item has already been 100% purchased.');
      return;
    }

    setErrorMsg(null);
    setPurchaseQtyStr(nextQtyStr);
    if (Number.isFinite(numQty) && numQty > 0 && line.unitCost > 0) {
      const calcAmount = Math.min(
        actualRemainingBudget,
        Number((numQty * line.unitCost).toFixed(2))
      );
      setPurchaseAmountStr(String(calcAmount));
    }
  };

  const handleAmountChange = (nextAmountStr: string) => {
    const numAmt = parseFloat(nextAmountStr);
    if (Number.isFinite(numAmt) && actualRemainingBudget > 0 && numAmt > actualRemainingBudget + 0.01) {
      setPurchaseAmountStr(String(Number(actualRemainingBudget.toFixed(2))));
      if (line.unitCost > 0) {
        setPurchaseQtyStr(String(actualRemainingUnits));
      }
      setErrorMsg(
        `Amount capped: Remaining planned budget for this line is $${actualRemainingBudget.toFixed(2)}.`
      );
      return;
    }

    setErrorMsg(null);
    setPurchaseAmountStr(nextAmountStr);
    if (Number.isFinite(numAmt) && numAmt > 0 && line.unitCost > 0) {
      const calcQty = Number((numAmt / line.unitCost).toFixed(2));
      if (actualRemainingUnits > 0 && calcQty <= actualRemainingUnits) {
        setPurchaseQtyStr(String(calcQty));
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isAlreadyFullyPaid) {
      setErrorMsg('This planned line item has already been fully purchased (0 units remaining).');
      return;
    }

    if (validQty <= 0) {
      setErrorMsg(`Please enter a valid quantity greater than 0 (max ${actualRemainingUnits} ${line.unitLabel || 'units'}).`);
      return;
    }

    if (actualRemainingUnits > 0 && validQty > actualRemainingUnits) {
      setErrorMsg(
        `Quantity Exceeded: You cannot purchase ${validQty} ${line.unitLabel || 'units'}. Only ${actualRemainingUnits} ${line.unitLabel || 'units'} remain in this plan line.`
      );
      return;
    }

    if (validAmount <= 0) {
      setErrorMsg('Please enter a valid purchase amount greater than $0.00.');
      return;
    }

    if (validAmount > actualRemainingBudget + 0.01) {
      setErrorMsg(
        `Budget Exceeded: Purchase amount of $${validAmount.toFixed(2)} exceeds remaining line budget of $${actualRemainingBudget.toFixed(2)}.`
      );
      return;
    }

    if (validAmount > availableCash) {
      setErrorMsg(
        `Insufficient Money on the Ground: You have $${availableCash.toFixed(2)} available, but this purchase requires $${validAmount.toFixed(2)}. Pledges must be paid in first.`
      );
      return;
    }

    if (!selectedLocationId) {
      setErrorMsg('Please select a valid site/location.');
      return;
    }

    setIsSubmitting(true);

    try {
      const lineAllocation = {
        mode: 'LINE' as const,
        lineId: line.id,
      };

      const qtySummary = `${validQty} ${line.unitLabel || 'units'}`;
      const detailedNote = `${note.trim() || `Purchase of ${line.title}`} [Qty: ${qtySummary}]`;

      if (isCapitalAsset) {
        // Automatically registers into the organization's Capital Assets ledger AND records the Runway expense
        dataService.logFixedAssetEvent({
          assetName: line.title,
          category: assetCategory,
          locationId: selectedLocationId,
          direction: 'INITIAL',
          quantityDelta: validQty,
          valueDelta: Number(validAmount.toFixed(2)),
          condition: assetCondition,
          note: detailedNote,
          deductFromLeftMoney: true,
          photoUrl: photoDataUrl,
          actor: currentMember,
          runwayAllocation: lineAllocation,
          runwayPlanId: plan.id,
        });

        onSuccess(
          `Successfully purchased ${qtySummary} of "${line.title}" for $${validAmount.toFixed(2)} and registered in Capital Equipment & Assets!`
        );
      } else {
        // Records standard allocated operational runway expense
        dataService.spendAgainstRunwayPlan({
          planId: plan.id,
          allocation: lineAllocation,
          amount: Number(validAmount.toFixed(2)),
          locationId: selectedLocationId,
          category: mapLineCategoryToExpenseCategory(line.category),
          note: detailedNote,
          actor: currentMember,
          receiptPhotoDataUrl: photoDataUrl,
        });

        onSuccess(`Successfully recorded purchase of ${qtySummary} of "${line.title}" ($${validAmount.toFixed(2)})!`);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording purchase against plan line.');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      style={{
        top: 'var(--vvo, 0px)',
        height: 'var(--vvh, 100dvh)',
      }}
      className="fixed left-0 right-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs px-2 py-1.5 sm:p-4 animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        style={{
          maxHeight: 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 8px)',
        }}
        className="w-full max-w-lg rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-[#E8DFCE]">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950">
                Purchase Planned Item
              </h3>
              <p className="text-[11px] text-slate-600 font-medium">
                Disburse capital and mark planned line as purchased
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePurchase} className="flex-1 min-h-[110px] overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 pb-6">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item & Financial Context Card */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {line.category}
                </span>
                <h4 className="text-sm font-black text-slate-950">
                  {line.title}
                </h4>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Plan Target: {line.qty} {line.unitLabel || 'units'} × ${line.unitCost.toFixed(2)} = ${(line.qty * line.unitCost).toFixed(2)}
                </p>
              </div>

              {isCapitalAsset && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 shrink-0">
                  <Building2 className="w-3 h-3" />
                  CAPEX Asset
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8DFCE] text-center">
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-semibold">Planned</span>
                <div className="text-xs font-mono font-bold text-slate-950">
                  ${(line.qty * line.unitCost).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-semibold">Spent So Far</span>
                <div className="text-xs font-mono font-bold text-emerald-700">
                  ${spentSoFar.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-semibold">Remaining</span>
                <div className="text-xs font-mono font-black text-emerald-700">
                  ${remainingBudget.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Ground Cash Indicator */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${isCashSufficient
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
              }`}
          >
            <div className="flex items-center space-x-1.5">
              {isCashSufficient ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">
                Available Ground Cash: <strong>${availableCash.toFixed(2)}</strong>
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isCashSufficient ? 'Ready to Spend' : 'Insufficient Cash'}
            </span>
          </div>

          {/* Already Fully Purchased Alert */}
          {isAlreadyFullyPaid && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Line Already Fully Purchased</span>
              </div>
              <p className="text-[11px] text-amber-900/80">
                This item has already been 100% purchased (${spentSoFar.toFixed(2)} spent of ${linePlannedTotal.toFixed(2)} planned). Any additional purchase here will be an overrun drawn from the contingency reserve buffer.
              </p>
            </div>
          )}

          {/* Quantity to Purchase & Purchase Amount ($) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-950">
                  Quantity to Buy ({line.unitLabel || 'units'}) <span className="text-rose-500">*</span>
                </label>
                {actualRemainingUnits > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQtyChange(String(actualRemainingUnits))}
                    className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    Max Left ({actualRemainingUnits})
                  </button>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max={actualRemainingUnits > 0 ? actualRemainingUnits : 0}
                step="any"
                required
                disabled={actualRemainingUnits <= 0}
                value={purchaseQtyStr}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder={`e.g. ${actualRemainingUnits || 0}`}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-bold text-slate-950 focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Unit: ${line.unitCost.toFixed(2)} / {line.unitLabel || 'unit'}</span>
                <span className="font-semibold text-emerald-700">
                  {actualRemainingUnits} left in plan
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-950">
                  Purchase Amount ($) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseAmountStr(String(Number(actualRemainingBudget.toFixed(2))));
                    if (actualRemainingUnits > 0) setPurchaseQtyStr(String(actualRemainingUnits));
                  }}
                  className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Max (${actualRemainingBudget.toFixed(2)})
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max={actualRemainingBudget > 0 ? actualRemainingBudget : 0}
                step="0.01"
                required
                disabled={actualRemainingBudget <= 0}
                value={purchaseAmountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="e.g. 150.00"
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-bold text-slate-950 focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Can pay partial or exact remaining</span>
                <span className="font-semibold text-emerald-700">
                  ${actualRemainingBudget.toFixed(2)} left
                </span>
              </div>
            </div>
          </div>

          {/* Over-Plan Alert */}
          {(isOverQty || isOverBudget) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Exceeds Planned Remainder</span>
              </div>
              <p className="text-[11px] text-rose-700">
                {isOverQty && (
                  <span>
                    You entered {validQty} {line.unitLabel || 'units'}, but only <strong>{actualRemainingUnits} {line.unitLabel || 'units'}</strong> remain in this plan line.
                  </span>
                )}
                {isOverBudget && (
                  <span>
                    {' '}Amount of ${validAmount.toFixed(2)} exceeds remaining budget of <strong>${actualRemainingBudget.toFixed(2)}</strong>.
                  </span>
                )}
                <span className="block mt-1 font-semibold text-rose-900">
                  Purchases are restricted to the remaining plan budget ({actualRemainingUnits} {line.unitLabel || 'units'} / ${actualRemainingBudget.toFixed(2)}).
                </span>
              </p>
            </div>
          )}

          {/* Location / Site */}
          <div>
            <label className="block text-xs font-bold text-slate-950 mb-1">
              Disbursement Location / Site <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.region ? `(${loc.region})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fixed Capital Asset Integration Checkbox */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2.5">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isCapitalAsset}
                onChange={(e) => setIsCapitalAsset(e.target.checked)}
                className="mt-0.5 rounded-md border-[#E8DFCE] text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-950 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  Register in Equipment &amp; Assets Inventory
                </span>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Automatically adds this purchase to the organization&apos;s Capital Assets ledger and tracks it as company equipment at the selected site — no duplicate entry needed.
                </p>
              </div>
            </label>

            {isCapitalAsset && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#E8DFCE]">
                <div>
                  <label className="block text-[11px] font-bold text-slate-950 mb-1">
                    Asset Category
                  </label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value as FixedAssetCategory)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-semibold text-slate-950"
                  >
                    <option value="TOOLS_MACHINERY">Tools &amp; Machinery</option>
                    <option value="FEEDERS_EQUIPMENT">Feeders &amp; Drinkers</option>
                    <option value="WATER_SOLAR">Water &amp; Solar</option>
                    <option value="HOUSING_INFRASTRUCTURE">Housing &amp; Sheds</option>
                    <option value="FENCING_SECURITY">Fencing &amp; Security</option>
                    <option value="CUSTOM">Custom Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-950 mb-1">
                    Asset Condition
                  </label>
                  <select
                    value={assetCondition}
                    onChange={(e) => setAssetCondition(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-semibold text-slate-950"
                  >
                    <option value="EXCELLENT">Brand New / Excellent</option>
                    <option value="GOOD">Good Working Order</option>
                    <option value="FAIR">Fair / Functional</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Purchase Note */}
          <div>
            <label className="block text-xs font-bold text-slate-950 mb-1">
              Purchase Note / Supplier Reference <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bought from Agricura, Invoice #4892"
              className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-medium text-slate-950"
            />
          </div>

          {/* Optional Receipt Photo */}
          <div>
            <label className="block text-xs font-bold text-slate-950 mb-1">
              Receipt / Proof Photo (Optional)
            </label>
            <div className="flex items-center space-x-3">
              <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-[#E8DFCE] bg-[#FAF8F5] text-xs font-bold text-slate-950 hover:bg-stone-50">
                <Camera className="w-3.5 h-3.5 text-emerald-700" />
                <span>{photoDataUrl ? 'Change Receipt Photo' : 'Attach Receipt Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {photoDataUrl && (
                <div className="flex items-center space-x-1 text-xs text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Photo attached</span>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(undefined)}
                    className="text-slate-400 hover:text-slate-700 ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E8DFCE]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-700 hover:bg-stone-100 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !isCashSufficient ||
                isAlreadyFullyPaid ||
                validQty <= 0 ||
                validAmount <= 0 ||
                (actualRemainingUnits > 0 && validQty > actualRemainingUnits) ||
                validAmount > actualRemainingBudget + 0.01
              }
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 ${!isCashSufficient ||
                isSubmitting ||
                isAlreadyFullyPaid ||
                validQty <= 0 ||
                validAmount <= 0 ||
                (actualRemainingUnits > 0 && validQty > actualRemainingUnits) ||
                validAmount > actualRemainingBudget + 0.01
                ? 'bg-stone-300 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Processing...'
                  : isAlreadyFullyPaid
                    ? 'Line Fully Purchased'
                    : `Confirm Purchase ($${validAmount.toFixed(2)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    const portalRoot = document.getElementById('sheet-root') || document.body;
    return createPortal(modalContent, portalRoot);
  }

  return modalContent;
};

