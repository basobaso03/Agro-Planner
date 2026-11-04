import React, { useState, useEffect } from 'react';
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
  Coins,
  Package,
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

interface RunwayWizardProps {
  isOpen: boolean;
  onClose: () => void;
  currentMember: OrgMember;
  activeOrg?: Organization | null;
  locations?: FarmLocation[];
  onPlanCreated: (planId: string) => void;
}

export const RunwayWizard: React.FC<RunwayWizardProps> = ({
  isOpen,
  onClose,
  currentMember,
  activeOrg,
  locations = [],
  onPlanCreated,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  const orgId = currentMember.orgId || 'org-master';
  const resolvedOrg = activeOrg || (currentMember.orgId ? dataService.getActiveOrganization(currentMember.orgId) : null);
  const registeredOrgType = resolvedOrg?.type || 'AGRO_FARMING';

  // Step 1: Basics
  const [name, setName] = useState<string>('');
  const [ventureType, setVentureType] = useState<'AGRO_FARMING' | 'GENERAL_VENTURE'>(registeredOrgType);
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Step 2: Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    registeredOrgType === 'AGRO_FARMING' ? 'tpl-agro-broiler-500' : 'BLANK'
  );

  // Step 3: Lines
  const [customLines, setCustomLines] = useState<
    Array<
      Partial<RunwayLine> & {
        title: string;
        category: string;
        qty: number;
        unitCost: number;
        unitLabel?: string;
      }
    >
  >([]);

  // Step 3 inline line addition state
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLineTitle, setNewLineTitle] = useState('');
  const [newLineCategory, setNewLineCategory] = useState(
    ventureType === 'AGRO_FARMING' ? 'Feed & Nutrition' : 'Inventory & Stock'
  );
  const [newLineQty, setNewLineQty] = useState<number>(100);
  const [newLineUnitCost, setNewLineUnitCost] = useState<number>(1.5);
  const [newLineUnitLabel, setNewLineUnitLabel] = useState('units');

  // Step 4: Contingency & Opening Cash
  const [contingencyMode, setContingencyMode] = useState<ContingencyMode>('PERCENT');
  const [contingencyPercent, setContingencyPercent] = useState<number>(10);
  const [contingencyFixed, setContingencyFixed] = useState<number>(250);
  const [adoptOpeningCash, setAdoptOpeningCash] = useState<boolean>(true);

  // Step 5: Targets & Enforcement
  const [targetBasis, setTargetBasis] = useState<RunwayTargetBasis>('GROSS');
  const [activationThresholdPct, setActivationThresholdPct] = useState<number>(100);
  const [enforcement, setEnforcement] = useState<RunwayEnforcement>('STRICT');
  const [finishError, setFinishError] = useState<string | null>(null);

  const orgLeftMoney = dataService.getCurrentOrgLeftMoney(orgId);
  const availableTemplates = getAvailableTemplates(ventureType, dataService.getState().runwayTemplates || []);

  // When modal opens or org loads, align venture type with registered business type
  useEffect(() => {
    if (isOpen) {
      setVentureType(registeredOrgType);
      const defaultTpl = registeredOrgType === 'AGRO_FARMING' ? 'tpl-agro-broiler-500' : 'BLANK';
      setSelectedTemplateId(defaultTpl);
      handleTemplateSelect(defaultTpl, registeredOrgType);
      setFinishError(null);
    }
  }, [isOpen, registeredOrgType]);

  if (!isOpen) return null;

  const handleTemplateSelect = (tplId: string, currentVentureType = ventureType) => {
    setSelectedTemplateId(tplId);
    if (tplId === 'BLANK') {
      setCustomLines([]);
      return;
    }
    const tpls = getAvailableTemplates(currentVentureType, dataService.getState().runwayTemplates || []);
    const tpl = tpls.find((t) => t.id === tplId);
    if (tpl) {
      setName(tpl.name);
      setContingencyMode(tpl.defaultContingencyMode || 'PERCENT');
      if (tpl.contingencyPercent != null || tpl.defaultContingencyPercent != null) {
        setContingencyPercent(tpl.contingencyPercent ?? tpl.defaultContingencyPercent ?? 10);
      }
      setCustomLines(
        tpl.lines.map((l, idx) => ({
          ...l,
          sortOrder: idx,
        }))
      );
    }
  };

  const handleAddCustomLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineTitle.trim()) return;
    const item = {
      title: newLineTitle.trim(),
      category: newLineCategory,
      qty: Math.max(1, Number(newLineQty) || 1),
      unitCost: Math.max(0, Number(newLineUnitCost) || 0),
      unitLabel: newLineUnitLabel.trim() || 'units',
      sortOrder: customLines.length,
    };
    setCustomLines((prev) => [...prev, item]);
    setNewLineTitle('');
    setIsAddingLine(false);
  };

  const handleRemoveLine = (index: number) => {
    setCustomLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLine = (index: number, updates: Partial<typeof customLines[0]>) => {
    setCustomLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...updates } : line))
    );
  };

  const baselineCost = customLines.reduce(
    (acc, l) => acc + (Number(l.qty) || 0) * (Number(l.unitCost) || 0),
    0
  );

  const calculatedContingencyDollars =
    contingencyMode === 'PERCENT'
      ? (baselineCost * (Number(contingencyPercent) || 0)) / 100
      : Number(contingencyFixed) || 0;

  const totalCapitalRequirement = baselineCost + calculatedContingencyDollars;

  const handleFinish = () => {
    if (!name.trim()) {
      setFinishError('Please enter a name for your Runway Plan.');
      return;
    }
    setFinishError(null);

    try {
      // 1. Create plan
      const { plan } = dataService.createRunwayPlan({
        orgId,
        name: name.trim(),
        orgType: ventureType,
        locationId: locationId || undefined,
        startDate,
        contingencyMode,
        contingencyPercent: contingencyMode === 'PERCENT' ? contingencyPercent : undefined,
        contingencyFixedAmount: contingencyMode === 'FIXED' ? contingencyFixed : undefined,
        targetBasis,
        activationThresholdPct,
        enforcement,
        actor: currentMember,
      });

      // 2. Insert lines
      customLines.forEach((l) => {
        dataService.upsertRunwayLine({
          planId: plan.id,
          line: l,
          actor: currentMember,
        });
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-prevent-swipe="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in"
    >
      <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Wizard Header & Stepper */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  New Runway Capital Plan
                </h3>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {resolvedOrg?.name ? `${resolvedOrg.name} • ` : ''}Step {currentStep} of 5: {steps[currentStep - 1].title}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper bubbles */}
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentStep === s.num
                        ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-100 dark:ring-indigo-950'
                        : currentStep > s.num
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                      }`}
                  >
                    {currentStep > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span
                    className={`text-xs hidden sm:inline font-semibold ${currentStep === s.num
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-400'
                      }`}
                  >
                    {s.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${currentStep > s.num ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-800'
                      }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Wizard Step Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {finishError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{finishError}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Account / Business Type Recognition Banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-xs border border-indigo-100 dark:border-indigo-900">
                    {registeredOrgType === 'AGRO_FARMING' ? (
                      <Wheat className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      Recognized Business Account Mode
                    </span>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {registeredOrgType === 'AGRO_FARMING'
                        ? 'Agro-Farming & Livestock Enterprise'
                        : 'General Commercial Business Venture'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Registered Account
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Venture Operating Workspace Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setVentureType('AGRO_FARMING');
                      handleTemplateSelect('tpl-agro-broiler-500', 'AGRO_FARMING');
                    }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${ventureType === 'AGRO_FARMING'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                  >
                    <Wheat className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        Agro Farming
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Poultry, Goats, Feed, Vaccines, Borehole
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVentureType('GENERAL_VENTURE');
                      handleTemplateSelect('BLANK', 'GENERAL_VENTURE');
                    }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${ventureType === 'GENERAL_VENTURE'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                  >
                    <Building2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        Commercial Venture
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Retail, Transport Fleet, Light Mfg
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q1 Broiler Expansion (Batch 12)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {locations.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Operating Farm Site
                  </label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
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
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 2: TEMPLATE SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose an industry baseline configured for {ventureType === 'AGRO_FARMING' ? 'Agro-Farming' : 'Commercial Ventures'} or start with an editable blank slate.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Blank Option */}
                <div
                  onClick={() => handleTemplateSelect('BLANK')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${selectedTemplateId === 'BLANK'
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
                    Build your custom lines from scratch with full line item control.
                  </p>
                </div>

                {/* Turnkey Templates */}
                {availableTemplates.map((tpl) => {
                  const estCost = tpl.lines.reduce((acc, l) => acc + l.qty * l.unitCost, 0);
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleTemplateSelect(tpl.id)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950">
                          ~${estCost.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {tpl.description || tpl.name}
                      </p>
                      <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Planned Line Items ({customLines.length})
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Total Baseline: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">${baselineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingLine(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Add Line Form */}
              {isAddingLine && (
                <form
                  onSubmit={handleAddCustomLine}
                  className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Add Custom Budget Line
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
                        Item Description / Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={newLineTitle}
                        onChange={(e) => setNewLineTitle(e.target.value)}
                        placeholder="e.g. Day-Old Broiler Chicks (Cob 500)"
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
                        placeholder="e.g. chicks, bags, kg, litres"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newLineQty}
                        onChange={(e) => setNewLineQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Unit Cost ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newLineUnitCost}
                        onChange={(e) => setNewLineUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      Line Total: <strong className="text-emerald-600">${(newLineQty * newLineUnitCost).toFixed(2)}</strong>
                    </span>
                    <div className="flex gap-2">
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
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-gray-900 dark:text-white">
                      Custom Blank Slate
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-0.5">
                      You are building your budget from scratch. Click "Add Line Item" above to add your planned cycle inputs, inventory, feed, equipment, or labor.
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

              {/* Lines list with interactive quantity, unit cost, and delete controls */}
              {customLines.length > 0 && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  {customLines.map((l, idx) => (
                    <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 dark:text-white truncate">{l.title}</div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          {l.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={l.qty}
                            onChange={(e) =>
                              handleUpdateLine(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                            }
                            className="w-14 text-center font-mono font-bold text-gray-900 dark:text-white bg-transparent focus:outline-none"
                          />
                          <span className="text-[10px] text-gray-500">{l.unitLabel || 'units'}</span>
                        </div>

                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1">
                          <label className="text-[10px] text-gray-400 font-bold">@ $</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.unitCost}
                            onChange={(e) =>
                              handleUpdateLine(idx, { unitCost: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="w-16 text-center font-mono font-bold text-gray-900 dark:text-white bg-transparent focus:outline-none"
                          />
                        </div>

                        <div className="font-mono font-bold text-emerald-600 min-w-[70px] text-right">
                          ${((l.qty || 0) * (l.unitCost || 0)).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          title="Remove Line"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONTINGENCY EMERGENCY RESERVE & OPENING CASH */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Contingency Emergency Reserve</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                    +${calculatedContingencyDollars.toFixed(2)} buffer
                  </span>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setContingencyMode('PERCENT')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${contingencyMode === 'PERCENT'
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Percentage Mode ({contingencyPercent}%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContingencyMode('FIXED')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${contingencyMode === 'FIXED'
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Fixed Dollar Mode (${contingencyFixed})</span>
                  </button>
                </div>

                {/* Percentage Configuration Block */}
                {contingencyMode === 'PERCENT' && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-900 dark:text-white">
                        Contingency Percentage (%)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={contingencyPercent}
                          onChange={(e) =>
                            setContingencyPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
                          }
                          className="w-16 px-2.5 py-1 text-center font-mono font-bold text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-gray-500">%</span>
                      </div>
                    </div>

                    {/* Quick percentage presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Presets:</span>
                      {[5, 10, 15, 20, 25].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setContingencyPercent(pct)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${contingencyPercent === pct
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Calculates <strong>{contingencyPercent}%</strong> over your baseline cost ($
                      {baselineCost.toFixed(2)}) ={' '}
                      <strong className="text-amber-700 dark:text-amber-300 font-mono">
                        +${calculatedContingencyDollars.toFixed(2)}
                      </strong>.
                    </p>
                  </div>
                )}

                {/* Fixed Dollar Configuration Block */}
                {contingencyMode === 'FIXED' && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-900 dark:text-white">
                        Fixed Emergency Amount ($)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={contingencyFixed}
                          onChange={(e) =>
                            setContingencyFixed(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-24 px-2.5 py-1 text-center font-mono font-bold text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Quick dollar presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Presets:</span>
                      {[50, 150, 300, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setContingencyFixed(amt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${contingencyFixed === amt
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Locks in an emergency reserve of{' '}
                      <strong className="text-amber-700 dark:text-amber-300 font-mono">
                        ${contingencyFixed.toFixed(2)}
                      </strong>{' '}
                      regardless of line changes.
                    </p>
                  </div>
                )}
              </div>

              {/* Adopt Opening Cash Checkbox */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
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
                      If enabled, existing unencumbered cash currently in Left Money will automatically count toward your initial funding pool.
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
                    <span className="text-gray-500 block text-[11px]">Operating Mode</span>
                    <strong className="text-gray-900 dark:text-white">
                      {ventureType === 'AGRO_FARMING' ? 'Agro Farming' : 'Commercial Venture'}
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
                      Total Capital Target Required
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                      ${totalCapitalRequirement.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spend Gate Enforcement */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  Spend Gate Enforcement Mode
                </div>
                <div className="grid grid-cols-2 gap-2">
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

        {/* Wizard Footer Nav Buttons */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="inline-flex items-center space-x-1 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-20 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !name.trim()}
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
              className="inline-flex items-center space-x-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
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
};
