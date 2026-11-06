import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Compass,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  Sparkles,
  Building2,
  Wheat,
  Plus,
  Trash2,
  AlertTriangle,
  Percent,
  DollarSign,
  Package,
  Calculator,
} from 'lucide-react';
import type { OrgMember, FarmLocation } from '../../types/agro';
import type { Organization } from '../../types/organization';
import type {
  RunwayLine,
  RunwayEnforcement,
  RunwayTargetBasis,
  ContingencyMode,
} from '../../types/runway';
import { dataService } from '../../services/dataService';
import { getAvailableTemplates } from '../../utils/runwayTemplates';
import { useBackHandler } from '../../navigation/useBackHandler';
import { useKeyboardOpen } from '../../hooks/useKeyboardInset';

interface RunwayWizardProps {
  isOpen: boolean;
  onClose: () => void;
  currentMember: OrgMember;
  activeOrg?: Organization | null;
  locations?: FarmLocation[];
  onPlanCreated: (planId: string) => void;
}

type WizardBudgetLine = Partial<RunwayLine> & {
  title: string;
  category: string;
  qty: number;
  unitCost: number;
  unitLabel?: string;
  qtyInput?: string;
  totalPriceInput?: string;
};

export const RunwayWizard: React.FC<RunwayWizardProps> = ({
  isOpen,
  onClose,
  currentMember,
  activeOrg,
  locations = [],
  onPlanCreated,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const isKeyboardOpen = useKeyboardOpen();

  const orgId = currentMember.orgId || dataService.getActiveOrgId() || '';
  const resolvedOrg =
    activeOrg ||
    (currentMember.orgId ? dataService.getActiveOrganization(currentMember.orgId) : null) ||
    dataService.getActiveOrganization(orgId);
  const registeredOrgType: 'AGRO_FARMING' | 'GENERAL_VENTURE' =
    resolvedOrg?.type || 'AGRO_FARMING';

  // Step 1: Basics (Locked to registered business account type)
  const [name, setName] = useState<string>('');
  const [ventureType, setVentureType] = useState<'AGRO_FARMING' | 'GENERAL_VENTURE'>(registeredOrgType);
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Step 2: Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    registeredOrgType === 'AGRO_FARMING' ? 'TMP-AGRO-BROILER-42D' : 'TMP-VENTURE-RETAIL-SHOP'
  );

  // Step 3: Lines
  const [customLines, setCustomLines] = useState<WizardBudgetLine[]>([]);

  // Step 3 inline line addition state (string-backed so fields can be cleared freely without a stuck '1' or '0')
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLineTitle, setNewLineTitle] = useState('');
  const [newLineCategory, setNewLineCategory] = useState(
    registeredOrgType === 'AGRO_FARMING' ? 'Feed & Nutrition' : 'General Inventory'
  );
  const [newLineQtyStr, setNewLineQtyStr] = useState<string>('');
  const [newLineTotalPriceStr, setNewLineTotalPriceStr] = useState<string>('');
  const [newLineUnitLabel, setNewLineUnitLabel] = useState('units');

  // Step 4: Contingency & Opening Cash
  const [contingencyMode, setContingencyMode] = useState<ContingencyMode>('PERCENT');
  const [contingencyPercentStr, setContingencyPercentStr] = useState<string>('10');
  const [contingencyFixedStr, setContingencyFixedStr] = useState<string>('250');
  const [adoptOpeningCash, setAdoptOpeningCash] = useState<boolean>(true);

  // Step 5: Targets & Enforcement
  const [targetBasis] = useState<RunwayTargetBasis>('GROSS');
  const [activationThresholdPct, setActivationThresholdPct] = useState<number>(100);
  const [enforcement, setEnforcement] = useState<RunwayEnforcement>('STRICT');
  const [finishError, setFinishError] = useState<string | null>(null);

  const orgLeftMoney = dataService.getCurrentOrgLeftMoney(orgId);
  const availableTemplates = getAvailableTemplates(
    ventureType,
    dataService.getState().runwayTemplates || []
  );

  // Intercept phone hardware back button while wizard is open
  useBackHandler(
    100,
    () => {
      if (!isOpen) return false;
      if (isAddingLine) {
        setIsAddingLine(false);
        return true;
      }
      if (currentStep > 1) {
        setCurrentStep((prev) => Math.max(1, prev - 1));
        return true;
      }
      onClose();
      return true;
    },
    [isOpen, isAddingLine, currentStep, onClose]
  );

  const applyTemplateById = (
    tplId: string,
    currentVentureType: 'AGRO_FARMING' | 'GENERAL_VENTURE' = registeredOrgType
  ) => {
    setSelectedTemplateId(tplId);
    if (tplId === 'BLANK') {
      setCustomLines([]);
      return;
    }
    const tpls = getAvailableTemplates(
      currentVentureType,
      dataService.getState().runwayTemplates || []
    );
    const tpl = tpls.find((t) => t.id === tplId);
    if (tpl) {
      setName((prev) => (prev.trim() ? prev : tpl.name));
      setContingencyMode(tpl.defaultContingencyMode || 'PERCENT');
      const pct = tpl.contingencyPercent ?? tpl.defaultContingencyPercent ?? 10;
      setContingencyPercentStr(String(pct));
      setCustomLines(
        tpl.lines.map((l, idx) => {
          const lineTotal = Number((l.qty * l.unitCost).toFixed(2));
          return {
            ...l,
            qtyInput: String(l.qty),
            totalPriceInput: String(lineTotal),
            sortOrder: idx,
          };
        })
      );
    }
  };

  // When modal opens or org loads, align venture type strictly with registered business account type
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setVentureType(registeredOrgType);
      setNewLineCategory(
        registeredOrgType === 'AGRO_FARMING' ? 'Feed & Nutrition' : 'General Inventory'
      );
      const defaultTpl =
        registeredOrgType === 'AGRO_FARMING'
          ? 'TMP-AGRO-BROILER-42D'
          : 'TMP-VENTURE-RETAIL-SHOP';
      setSelectedTemplateId(defaultTpl);
      applyTemplateById(defaultTpl, registeredOrgType);
      setFinishError(null);
      setIsAddingLine(false);
    }
  }, [isOpen, registeredOrgType]);

  if (!isOpen) return null;

  const parsedNewQty = parseFloat(newLineQtyStr);
  const parsedNewTotal = parseFloat(newLineTotalPriceStr);
  const validNewQty = Number.isFinite(parsedNewQty) && parsedNewQty > 0 ? parsedNewQty : 0;
  const validNewTotal = Number.isFinite(parsedNewTotal) && parsedNewTotal >= 0 ? parsedNewTotal : 0;
  const autoNewUnitCost = validNewQty > 0 ? validNewTotal / validNewQty : 0;

  const handleAddCustomLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineTitle.trim()) return;
    const qtyVal = validNewQty > 0 ? validNewQty : 1;
    const totalVal = validNewTotal >= 0 ? validNewTotal : 0;
    const computedUnitCost = Number((totalVal / qtyVal).toFixed(4));

    const item: WizardBudgetLine = {
      title: newLineTitle.trim(),
      category: newLineCategory,
      qty: qtyVal,
      unitCost: computedUnitCost,
      unitLabel: newLineUnitLabel.trim() || 'units',
      qtyInput: String(qtyVal),
      totalPriceInput: String(Number(totalVal.toFixed(2))),
      sortOrder: customLines.length,
    };
    setCustomLines((prev) => [...prev, item]);
    setNewLineTitle('');
    setNewLineQtyStr('');
    setNewLineTotalPriceStr('');
    setIsAddingLine(false);
  };

  const handleRemoveLine = (index: number) => {
    setCustomLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineQtyInputChange = (index: number, rawQty: string) => {
    setCustomLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const parsedQty = parseFloat(rawQty);
        const currentTotal =
          line.totalPriceInput !== undefined
            ? parseFloat(line.totalPriceInput)
            : (Number(line.qty) || 0) * (Number(line.unitCost) || 0);
        const safeTotal = Number.isFinite(currentTotal) && currentTotal >= 0 ? currentTotal : 0;
        const nextQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
        const nextUnitCost = nextQty > 0 ? Number((safeTotal / nextQty).toFixed(4)) : 0;
        return {
          ...line,
          qtyInput: rawQty,
          qty: nextQty,
          unitCost: nextUnitCost,
        };
      })
    );
  };

  const handleLineTotalPriceInputChange = (index: number, rawTotal: string) => {
    setCustomLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const parsedTotal = parseFloat(rawTotal);
        const safeTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
        const currentQty = Number(line.qty) > 0 ? Number(line.qty) : 1;
        const nextUnitCost = Number((safeTotal / currentQty).toFixed(4));
        return {
          ...line,
          totalPriceInput: rawTotal,
          qty: currentQty,
          unitCost: nextUnitCost,
        };
      })
    );
  };

  const baselineCost = customLines.reduce((acc, l) => {
    if (l.totalPriceInput !== undefined && l.totalPriceInput !== '') {
      const parsed = parseFloat(l.totalPriceInput);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return acc + parsed;
      }
    }
    return acc + (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
  }, 0);

  const contingencyPercent = Math.max(0, Math.min(100, parseFloat(contingencyPercentStr) || 0));
  const contingencyFixed = Math.max(0, parseFloat(contingencyFixedStr) || 0);

  const calculatedContingencyDollars =
    contingencyMode === 'PERCENT'
      ? (baselineCost * contingencyPercent) / 100
      : contingencyFixed;

  const totalCapitalRequirement = baselineCost + calculatedContingencyDollars;

  const handleFinish = () => {
    if (!name.trim()) {
      setFinishError('Please enter a name for your Runway Plan.');
      return;
    }
    setFinishError(null);

    try {
      const preparedLines = customLines
        .filter((l) => l.title && l.title.trim())
        .map((l, idx) => {
          const finalQty = Number(l.qty) > 0 ? Number(l.qty) : 1;
          const rawTotal =
            l.totalPriceInput !== undefined && l.totalPriceInput !== ''
              ? parseFloat(l.totalPriceInput)
              : finalQty * (Number(l.unitCost) || 0);
          const safeTotal = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
          const finalUnitCost = Number((safeTotal / finalQty).toFixed(4));
          return {
            title: l.title.trim(),
            category: l.category || 'GENERAL',
            qty: finalQty,
            unitCost: finalUnitCost,
            unitLabel: l.unitLabel || 'units',
            kind: l.kind || 'COST',
            priority: l.priority || 'ESSENTIAL',
            sortOrder: idx,
          };
        });

      const { plan } = dataService.createRunwayPlan({
        orgId,
        name: name.trim(),
        orgType: registeredOrgType,
        locationId: locationId || undefined,
        startDate,
        contingencyMode,
        contingencyPercent: contingencyMode === 'PERCENT' ? contingencyPercent : undefined,
        contingencyFixedAmount: contingencyMode === 'FIXED' ? contingencyFixed : undefined,
        targetBasis,
        activationThresholdPct,
        enforcement,
        adoptOpeningCash,
        lines: preparedLines,
        actor: currentMember,
      });

      onPlanCreated(plan.id);
      onClose();
    } catch (err: unknown) {
      setFinishError(err instanceof Error ? err.message : 'Failed to create plan.');
    }
  };

  const steps = [
    { num: 1, title: 'Basics' },
    { num: 2, title: 'Template' },
    { num: 3, title: 'Budget Lines' },
    { num: 4, title: 'Contingency' },
    { num: 5, title: 'Review & Lock' },
  ];

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      data-prevent-swipe="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{
        top: 'var(--vvo, 0px)',
        height: 'var(--vvh, 100dvh)',
      }}
      className={`fixed left-0 right-0 z-[100] flex ${isKeyboardOpen ? 'items-end sm:items-center px-2 py-1' : 'items-center px-3 py-3 sm:p-6 pt-safe pb-safe'
        } justify-center bg-black/65 backdrop-blur-xs animate-in fade-in overflow-hidden`}
    >
      <div
        style={{
          maxHeight: isKeyboardOpen
            ? 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 6px)'
            : 'min(88dvh, calc(var(--vvh, 100dvh) - var(--sat, 0px) - var(--sab, 0px) - 20px))',
        }}
        className={`w-full max-w-2xl bg-white border border-[#E8DFCE] shadow-2xl flex flex-col overflow-hidden ${isKeyboardOpen ? 'rounded-2xl' : 'rounded-3xl'
          }`}
      >
        {/* Wizard Header & Stepper */}
        <div
          className={`shrink-0 border-b border-[#E8DFCE] bg-[#FAF8F5] ${isKeyboardOpen ? 'px-3.5 py-2' : 'p-3.5 sm:p-5'
            }`}
        >
          <div className={`flex items-center justify-between ${isKeyboardOpen ? '' : 'mb-2.5 sm:mb-3.5'}`}>
            <div className="flex items-center space-x-2.5 min-w-0">
              {!isKeyboardOpen && (
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                  <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-black text-slate-950 truncate">
                  New Runway Capital Plan
                </h3>
                <span className="text-[11px] text-slate-600 font-semibold block truncate">
                  {resolvedOrg?.name ? `${resolvedOrg.name} • ` : ''}Step {currentStep} of 5: {steps[currentStep - 1].title}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper bubbles (hidden while keyboard is open to maximize typing area) */}
          {!isKeyboardOpen && (
            <div className="flex items-center justify-between">
              {steps.map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex items-center space-x-1.5">
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all ${currentStep === s.num
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 sm:ring-4 ring-emerald-100'
                        : currentStep > s.num
                          ? 'bg-emerald-500 text-white'
                          : 'bg-stone-200 text-slate-700'
                        }`}
                    >
                      {currentStep > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                    </div>
                    <span
                      className={`text-xs hidden sm:inline font-bold ${currentStep === s.num
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                        }`}
                    >
                      {s.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1.5 sm:mx-2 ${currentStep > s.num ? 'bg-emerald-500' : 'bg-stone-200'
                        }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Persistent Live Total Required Strip on Steps 3, 4, and 5 */}
        {currentStep >= 3 && (
          <div
            className={`shrink-0 px-3.5 sm:px-5 bg-[#FAF8F5] border-b border-[#E8DFCE] flex flex-wrap items-center justify-between gap-2 text-xs ${isKeyboardOpen ? 'py-1.5' : 'py-2.5'
              }`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-slate-600 font-semibold">
                Items Cost:{' '}
                <strong className="font-mono text-slate-950 font-bold">
                  ${baselineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
              <span className="text-amber-800 font-semibold">
                + Contingency:{' '}
                <strong className="font-mono font-bold">
                  ${calculatedContingencyDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            </div>
            <div className="font-bold text-slate-950">
              Total Required:{' '}
              <span className="font-mono text-sm sm:text-base font-black text-emerald-700">
                ${totalCapitalRequirement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Wizard Step Content Body */}
        <div
          className={`flex-1 min-h-[110px] overflow-y-auto overscroll-contain ${isKeyboardOpen ? 'p-3.5 space-y-3 pb-6' : 'p-4 sm:p-6 space-y-4'
            }`}
        >
          {finishError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{finishError}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Recognized Registered Business Account Banner (Auto-Detected, No Redundant Question) */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-center justify-between gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white shadow-xs border border-[#E8DFCE] shrink-0">
                    {registeredOrgType === 'AGRO_FARMING' ? (
                      <Wheat className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Building2 className="w-5 h-5 text-emerald-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                      Registered Business Account Type
                    </span>
                    <div className="text-xs sm:text-sm font-bold text-slate-950 truncate">
                      {registeredOrgType === 'AGRO_FARMING'
                        ? 'Agro-Farming & Livestock Enterprise'
                        : 'Commercial & General Business Venture'}
                    </div>
                    {resolvedOrg?.name && (
                      <div className="text-[11px] text-slate-600 font-medium truncate">
                        Workspace: {resolvedOrg.name}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                  Auto-Linked
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">
                  Plan Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    registeredOrgType === 'AGRO_FARMING'
                      ? 'e.g. Q1 Broiler Expansion (Batch 12)'
                      : 'e.g. Q1 Retail Restock & Operations'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-sm font-bold text-slate-950 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {locations.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-950 mb-1">
                    Operating Site
                  </label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-sm font-semibold text-slate-950"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.region})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">
                  Target Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-sm font-semibold text-slate-950"
                />
              </div>
            </div>
          )}

          {/* STEP 2: TEMPLATE SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose a pre-built template for your{' '}
                <strong>
                  {registeredOrgType === 'AGRO_FARMING'
                    ? 'Agro-Farming'
                    : 'Commercial Business'}
                </strong>{' '}
                account or start with a custom blank slate.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Blank Option */}
                <div
                  onClick={() => applyTemplateById('BLANK', registeredOrgType)}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${selectedTemplateId === 'BLANK'
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      Custom / Blank Slate
                    </span>
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Build your custom planned lines from scratch.
                  </p>
                </div>

                {/* Turnkey Templates */}
                {availableTemplates.map((tpl) => {
                  const estCost = tpl.lines.reduce((acc, l) => acc + l.qty * l.unitCost, 0);
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => applyTemplateById(tpl.id, registeredOrgType)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 shrink-0">
                          ~${estCost.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {tpl.description || tpl.name}
                      </p>
                      <div className="mt-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        {tpl.lines.length} pre-configured line items
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: BUDGET LINES EDITING & ADDITION */}
          {currentStep === 3 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Planned Line Items ({customLines.length})
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingLine(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Add Line Form */}
              {isAddingLine && (
                <form
                  onSubmit={handleAddCustomLine}
                  className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Add Budget Line Item
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingLine(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Item Description / Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newLineTitle}
                        onChange={(e) => setNewLineTitle(e.target.value)}
                        placeholder={
                          registeredOrgType === 'AGRO_FARMING'
                            ? 'e.g. Day-Old Broiler Chicks or Starter Feed'
                            : 'e.g. Wholesale Stock Batch or Packaging'
                        }
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={newLineCategory}
                        onChange={(e) => setNewLineCategory(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-900 dark:text-white"
                      >
                        <option value="Chicks & Stock">Chicks &amp; Stock</option>
                        <option value="Feed & Nutrition">Feed &amp; Nutrition</option>
                        <option value="Vaccines & Medication">Vaccines &amp; Medication</option>
                        <option value="Bedding & Gas">Bedding &amp; Gas</option>
                        <option value="Equipment & Assets">Equipment &amp; Assets</option>
                        <option value="Labor & Ground Ops">Labor &amp; Ground Ops</option>
                        <option value="Utilities & Fuel">Utilities &amp; Fuel</option>
                        <option value="Packaging & Transport">Packaging &amp; Transport</option>
                        <option value="General Inventory">General Inventory</option>
                        <option value="Administrative">Administrative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Unit Label
                      </label>
                      <input
                        type="text"
                        value={newLineUnitLabel}
                        onChange={(e) => setNewLineUnitLabel(e.target.value)}
                        placeholder="e.g. chicks, bags, kg, units"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Planned Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="any"
                        required
                        value={newLineQtyStr}
                        onChange={(e) => setNewLineQtyStr(e.target.value)}
                        placeholder="Enter quantity (e.g. 100)"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Total ($) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        required
                        value={newLineTotalPriceStr}
                        onChange={(e) => setNewLineTotalPriceStr(e.target.value)}
                        placeholder="Enter total cost (e.g. 150)"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                      Unit Cost:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        ${autoNewUnitCost.toFixed(2)} / {newLineUnitLabel || 'unit'}
                      </strong>
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setIsAddingLine(false)}
                        className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-600 dark:text-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Add to Budget
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Blank slate empty notice */}
              {customLines.length === 0 && !isAddingLine && (
                <div className="p-6 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-gray-900 dark:text-white">
                      No Budget Lines Added Yet
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-0.5">
                      Tap &quot;Add Line Item&quot; to enter your planned quantity and estimated cost.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingLine(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Budget Item</span>
                  </button>
                </div>
              )}

              {/* Lines list with clearable Qty & Total Price inputs and auto-computed Unit Cost */}
              {customLines.length > 0 && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  {customLines.map((l, idx) => {
                    const qtyDisplay =
                      l.qtyInput !== undefined ? l.qtyInput : String(l.qty || '');
                    const lineTotalNum =
                      l.totalPriceInput !== undefined && l.totalPriceInput !== ''
                        ? parseFloat(l.totalPriceInput) || 0
                        : (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
                    const totalDisplay =
                      l.totalPriceInput !== undefined
                        ? l.totalPriceInput
                        : String(Number(lineTotalNum.toFixed(2)));
                    const unitCostAuto =
                      Number(l.qty) > 0 ? lineTotalNum / Number(l.qty) : 0;

                    return (
                      <div
                        key={idx}
                        className="p-3 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900 dark:text-white truncate">
                              {l.title}
                            </div>
                            <span className="text-[10px] text-gray-400 uppercase font-semibold">
                              {l.category} • Unit Cost: ${unitCostAuto.toFixed(2)}/{l.unitLabel || 'unit'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            title="Remove Line"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center justify-between gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5">
                            <label className="text-[10px] text-gray-500 font-bold uppercase shrink-0">
                              Qty
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0.01"
                              step="any"
                              placeholder="0"
                              value={qtyDisplay}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleLineQtyInputChange(idx, e.target.value)}
                              className="w-full text-right font-mono font-bold text-gray-900 dark:text-white bg-transparent focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {l.unitLabel || 'units'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-2.5 py-1.5">
                            <label className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase shrink-0">
                              Total $
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={totalDisplay}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleLineTotalPriceInputChange(idx, e.target.value)}
                              className="w-full text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-transparent focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONTINGENCY EMERGENCY RESERVE & OPENING CASH */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Contingency Emergency Reserve</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 shrink-0">
                    +${calculatedContingencyDollars.toFixed(2)}
                  </span>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setContingencyMode('PERCENT')}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${contingencyMode === 'PERCENT'
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <Percent className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Percent ({contingencyPercent}%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContingencyMode('FIXED')}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${contingencyMode === 'FIXED'
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Fixed (${contingencyFixed})</span>
                  </button>
                </div>

                {/* Percentage Configuration Block */}
                {contingencyMode === 'PERCENT' && (
                  <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-900 dark:text-white">
                        Contingency Percentage (%)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          value={contingencyPercentStr}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setContingencyPercentStr(e.target.value)}
                          className="w-16 px-2.5 py-1 text-center font-mono font-bold text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-gray-500">%</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">
                        Presets:
                      </span>
                      {[5, 10, 15, 20, 25].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setContingencyPercentStr(String(pct))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${contingencyPercent === pct
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fixed Dollar Configuration Block */}
                {contingencyMode === 'FIXED' && (
                  <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-900 dark:text-white">
                        Fixed Emergency Amount ($)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="10"
                          value={contingencyFixedStr}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setContingencyFixedStr(e.target.value)}
                          className="w-24 px-2.5 py-1 text-center font-mono font-bold text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">
                        Presets:
                      </span>
                      {[50, 150, 300, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setContingencyFixedStr(String(amt))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${contingencyFixed === amt
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total Required Money Breakdown Card */}
                <div className="p-3 rounded-xl bg-white/90 dark:bg-gray-900/90 border border-amber-300 dark:border-amber-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Items Baseline Cost:</span>
                    <span className="font-mono font-bold">${baselineCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-300">
                    <span>Contingency Reserve:</span>
                    <span className="font-mono font-bold">+${calculatedContingencyDollars.toFixed(2)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-amber-200 dark:border-amber-800 flex justify-between items-center font-bold text-gray-900 dark:text-white">
                    <span>Total Required Money (incl. Contingency):</span>
                    <span className="font-mono text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400">
                      ${totalCapitalRequirement.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adopt Opening Cash Checkbox */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adoptOpeningCash}
                    onChange={(e) => setAdoptOpeningCash(e.target.checked)}
                    className="mt-0.5 rounded-md border-gray-300 text-indigo-600"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                      Adopt Opening Ground Cash (${orgLeftMoney.toFixed(2)})
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Existing unencumbered cash in Left Money will automatically count toward your initial funding pool.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & ENFORCEMENT */}
          {currentStep === 5 && (
            <div className="space-y-4">
              {/* Financial Architecture Summary Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-gray-900 border border-indigo-200 dark:border-indigo-800 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Capital Plan Structure Summary
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Account Mode</span>
                    <strong className="text-gray-900 dark:text-white">
                      {registeredOrgType === 'AGRO_FARMING' ? 'Agro Farming' : 'Commercial Venture'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Cost Baseline</span>
                    <strong className="font-mono text-gray-900 dark:text-white">
                      ${baselineCost.toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Contingency Reserve</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">
                      +${calculatedContingencyDollars.toFixed(2)}
                    </strong>
                  </div>

                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Total Required Money (incl. Contingency)
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                      ${totalCapitalRequirement.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spend Gate Enforcement */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  Spend Gate Enforcement Mode
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnforcement('STRICT')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${enforcement === 'STRICT'
                      ? 'border-indigo-600 bg-white dark:bg-gray-800 ring-2 ring-indigo-500'
                      : 'border-transparent text-gray-500'
                      }`}
                  >
                    <div className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
                      Strict Gate (Recommended)
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Outflows require explicit line tagging or contingency approval.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnforcement('ADVISORY')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${enforcement === 'ADVISORY'
                      ? 'border-indigo-600 bg-white dark:bg-gray-800 ring-2 ring-indigo-500'
                      : 'border-transparent text-gray-500'
                      }`}
                  >
                    <div className="text-xs font-bold text-gray-900 dark:text-white">
                      Advisory Gate
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Unallocated outflows emit audit warnings without blocking.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Activation Threshold ({activationThresholdPct}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={activationThresholdPct}
                  onChange={(e) => setActivationThresholdPct(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Plan cannot transition from Pledging to Active until at least {activationThresholdPct}% of the target cash is collected.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Nav Buttons (shrink-0 & safe-area-aware so never hidden under mobile bar) */}
        <div
          className={`shrink-0 flex items-center justify-between border-t border-[#E8DFCE] bg-[#FAF8F5] ${isKeyboardOpen ? 'px-3.5 py-2' : 'px-4 py-3.5 sm:px-5 sm:py-4'
            }`}
        >
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="inline-flex items-center space-x-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-stone-200/70 disabled:opacity-30 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !name.trim()}
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Create Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    const portalRoot = document.getElementById('sheet-root') || document.body;
    return createPortal(modalContent, portalRoot);
  }

  return modalContent;
};
