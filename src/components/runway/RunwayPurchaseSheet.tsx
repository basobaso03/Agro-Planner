import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Tag,
  PlusCircle,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Edit2,
  Plus,
} from 'lucide-react';
import type { RunwayPlan, RunwayLine } from '../../types/runway';
import type {
  FarmLocation,
  OrgMember,
  FixedAssetCategory,
  ExpenseCategory,
  DurationUnit,
  TrackingMode,
  LivestockEntry,
  AnimalCheckpoint,
  CheckpointCategory,
} from '../../types/agro';
import { dataService } from '../../services/dataService';
import { useBackHandler } from '../../navigation/useBackHandler';
import { compressImage } from '../../utils/imageUpload';
import {
  DEFAULT_PROTOCOL_TEMPLATES,
  detectSpeciesFromTitle,
  PRESET_SPECIES,
  formatCheckpointCategory,
} from '../../sheets/livestock/RegisterBatchSheet';

import { formatMoney, isPrivacyMasked } from '../../utils/currency';

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
  showNumbers?: boolean;
  onSuccess: (message: string) => void;
}

function mapLineCategoryToExpenseCategory(cat: string, isAgroPlan: boolean = true): ExpenseCategory {
  const c = cat.toUpperCase();
  if (isAgroPlan && c.includes('FEED')) return 'FEED';
  if (isAgroPlan && (c.includes('MEDIC') || c.includes('VACCIN'))) return 'VACCINES_MEDICATION';
  if (isAgroPlan && (c.includes('CHICK') || c.includes('LIVESTOCK'))) return 'LIVESTOCK_PURCHASE';
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

function isAnimalCategoryOrTitle(category: string, title: string): boolean {
  const cat = (category || '').toLowerCase();
  const t = (title || '').toLowerCase();
  return (
    cat.includes('livestock') ||
    cat.includes('animal') ||
    cat.includes('chick') ||
    t.includes('chick') ||
    t.includes('goat') ||
    t.includes('broiler') ||
    t.includes('layer') ||
    t.includes('cattle') ||
    t.includes('cow') ||
    t.includes('bull') ||
    t.includes('pig') ||
    t.includes('sheep') ||
    t.includes('lamb') ||
    t.includes('road runner') ||
    t.includes('animal') ||
    t.includes('poultry') ||
    t.includes('heifer') ||
    t.includes('steer') ||
    t.includes('calf') ||
    t.includes('doe') ||
    t.includes('buck') ||
    t.includes('pullet')
  );
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
  showNumbers,
  onSuccess,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  const linePlannedTotal = Number((line.qty * line.unitCost).toFixed(2));
  const actualRemainingBudget = Math.max(0, Number((linePlannedTotal - spentSoFar).toFixed(2)));
  const actualRemainingUnits =
    line.unitCost > 0
      ? Math.max(0, Number((actualRemainingBudget / line.unitCost).toFixed(2)))
      : (actualRemainingBudget > 0 ? (line.qty || 1) : 0);

  const initialAmount = actualRemainingBudget > 0 ? actualRemainingBudget : 0;
  const initialQty = actualRemainingUnits > 0 ? actualRemainingUnits : 0;

  // Check if current venture/plan belongs to Agricultural Farming (livestock is strictly disabled for GENERAL_VENTURE)
  const activeOrg = dataService.getActiveOrganization(plan.orgId);
  const isAgroPlan = plan.orgType !== 'GENERAL_VENTURE' && activeOrg?.type !== 'GENERAL_VENTURE';

  const [purchaseQtyStr, setPurchaseQtyStr] = useState<string>(String(initialQty));
  const [purchaseAmountStr, setPurchaseAmountStr] = useState<string>(String(Number(initialAmount.toFixed(2))));
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    isAgroPlan ? locations[0]?.id || plan.locationId || '' : ''
  );
  const [note, setNote] = useState<string>(`Purchase of ${line.title}`);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detection for livestock vs capital assets vs operational spend
  const isDefaultLivestock = isAgroPlan && isAnimalCategoryOrTitle(line.category, line.title);
  const isDefaultCapex = !isDefaultLivestock && Boolean(
    line.excludeFromContingency ||
    line.category === 'EQUIPMENT' ||
    line.category === 'Equipment & Assets'
  );

  const [isLivestock, setIsLivestock] = useState<boolean>(isDefaultLivestock);
  const [livestockMode, setLivestockMode] = useState<'NEW_BATCH' | 'EXISTING_BATCH'>('NEW_BATCH');
  const [selectedSpeciesOption, setSelectedSpeciesOption] = useState<string>(() => detectSpeciesFromTitle(line.title));
  const [customSpeciesText, setCustomSpeciesText] = useState<string>('');
  const [batchName, setBatchName] = useState<string>(line.title);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('BATCH');

  const initialDetected = detectSpeciesFromTitle(line.title);
  const initialPreset = DEFAULT_PROTOCOL_TEMPLATES[initialDetected];
  const [targetDurationValue, setTargetDurationValue] = useState<string>(
    String(initialPreset?.durationValue || 6)
  );
  const [targetDurationUnit, setTargetDurationUnit] = useState<DurationUnit>(
    initialPreset?.durationUnit || 'WEEKS'
  );
  const [targetSaleWeightKg, setTargetSaleWeightKg] = useState<string>(
    initialPreset?.targetWeight ? String(initialPreset.targetWeight) : '2.2'
  );

  // Checkpoint protocol template selection: Preset or Scratch
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(
    initialPreset ? initialDetected : 'SCRATCH'
  );
  const [checkpoints, setCheckpoints] = useState<AnimalCheckpoint[]>(() => {
    return initialPreset
      ? initialPreset.checkpoints.map((cp) => ({
        ...cp,
        completed: false,
        reminderStatus: 'SCHEDULED' as const,
      }))
      : [];
  });

  // Inline Edit Checkpoint state
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editDayTarget, setEditDayTarget] = useState<string>('1');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<CheckpointCategory>('VACCINE');
  const [editWeight, setEditWeight] = useState<string>('');
  const [editFeedPhase, setEditFeedPhase] = useState<string>('');
  const [editInstructions, setEditInstructions] = useState<string>('');

  // Inline Add Checkpoint state
  const [showAddCheckpoint, setShowAddCheckpoint] = useState<boolean>(false);
  const [newDayTarget, setNewDayTarget] = useState<string>('7');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<CheckpointCategory>('VACCINE');
  const [newWeight, setNewWeight] = useState<string>('');
  const [newFeedPhase, setNewFeedPhase] = useState<string>('');
  const [newInstructions, setNewInstructions] = useState<string>('');

  const [selectedExistingBatchId, setSelectedExistingBatchId] = useState<string>('');

  const [isCapitalAsset, setIsCapitalAsset] = useState<boolean>(isDefaultCapex);
  const [assetCategory, setAssetCategory] = useState<FixedAssetCategory>(
    mapLineCategoryToAssetCategory(line.category)
  );
  const [assetCondition, setAssetCondition] = useState<'EXCELLENT' | 'GOOD' | 'FAIR'>('EXCELLENT');

  const existingBatchesAtSite = useMemo(() => {
    const all = dataService.getState().livestockEntries || [];
    return all.filter(
      (b) =>
        b.locationId === selectedLocationId &&
        (!plan.orgId || !b.orgId || b.orgId === plan.orgId)
    );
  }, [selectedLocationId, plan.orgId, isOpen]);

  // Switch or reload protocol template
  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === 'SCRATCH') {
      setCheckpoints([]);
      return;
    }
    const preset = DEFAULT_PROTOCOL_TEMPLATES[templateKey];
    if (preset) {
      setTargetDurationValue(String(preset.durationValue));
      setTargetDurationUnit(preset.durationUnit);
      if (preset.targetWeight) {
        setTargetSaleWeightKg(String(preset.targetWeight));
      }
      setCheckpoints(
        preset.checkpoints.map((cp) => ({
          ...cp,
          completed: false,
          reminderStatus: 'SCHEDULED' as const,
        }))
      );
    }
  };

  const handleDeleteCheckpoint = (id: string) => {
    setCheckpoints((prev) => prev.filter((c) => c.id !== id));
  };

  const handleStartEdit = (cp: AnimalCheckpoint) => {
    setEditingCheckpointId(cp.id);
    setEditDayTarget(String(cp.dayTarget));
    setEditTitle(cp.title);
    setEditCategory(cp.category);
    setEditWeight(cp.targetWeightKg ? String(cp.targetWeightKg) : '');
    setEditFeedPhase(cp.feedPhase || '');
    setEditInstructions(cp.instructions || cp.description || '');
  };

  const handleSaveEdit = () => {
    if (!editingCheckpointId || !editTitle.trim()) return;
    const targetDay = parseInt(editDayTarget, 10) || 1;
    setCheckpoints((prev) =>
      prev
        .map((cp) => {
          if (cp.id !== editingCheckpointId) return cp;
          return {
            ...cp,
            dayTarget: targetDay,
            title: editTitle.trim(),
            category: editCategory,
            targetWeightKg: editWeight ? parseFloat(editWeight) : undefined,
            feedPhase: editFeedPhase.trim() || undefined,
            instructions: editInstructions.trim() || undefined,
            description: editInstructions.trim() || undefined,
          };
        })
        .sort((a, b) => a.dayTarget - b.dayTarget)
    );
    setEditingCheckpointId(null);
  };

  const handleAddCheckpoint = () => {
    if (!newTitle.trim()) return;
    const targetDay = parseInt(newDayTarget, 10) || 1;
    const id = `cp-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newCp: AnimalCheckpoint = {
      id,
      dayTarget: targetDay,
      title: newTitle.trim(),
      category: newCategory,
      targetWeightKg: newWeight ? parseFloat(newWeight) : undefined,
      feedPhase: newFeedPhase.trim() || undefined,
      instructions: newInstructions.trim() || undefined,
      description: newInstructions.trim() || undefined,
      completed: false,
      reminderStatus: 'SCHEDULED',
    };
    setCheckpoints((prev) => [...prev, newCp].sort((a, b) => a.dayTarget - b.dayTarget));
    setShowAddCheckpoint(false);
    setNewTitle('');
    setNewWeight('');
    setNewFeedPhase('');
    setNewInstructions('');
    setNewDayTarget(String(targetDay + 7));
  };

  const handleSpeciesSelect = (val: string) => {
    setSelectedSpeciesOption(val);
    if (val !== '__CUSTOM__') {
      const preset = DEFAULT_PROTOCOL_TEMPLATES[val];
      if (preset) {
        setTargetDurationValue(String(preset.durationValue));
        setTargetDurationUnit(preset.durationUnit);
        if (preset.targetWeight) {
          setTargetSaleWeightKg(String(preset.targetWeight));
        }
        if (selectedTemplateKey !== 'SCRATCH') {
          handleTemplateChange(val);
        }
      }
    }
  };

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

      const isAnimal = isAgroPlan && isAnimalCategoryOrTitle(line.category, line.title);
      setIsLivestock(isAnimal);
      setLivestockMode('NEW_BATCH');
      const detSpecies = detectSpeciesFromTitle(line.title);
      setSelectedSpeciesOption(detSpecies);
      setCustomSpeciesText('');
      setBatchName(line.title);
      setTrackingMode('BATCH');

      const preset = DEFAULT_PROTOCOL_TEMPLATES[detSpecies];
      if (preset) {
        setSelectedTemplateKey(detSpecies);
        setCheckpoints(
          preset.checkpoints.map((cp) => ({
            ...cp,
            completed: false,
            reminderStatus: 'SCHEDULED' as const,
          }))
        );
        setTargetDurationValue(String(preset.durationValue || 6));
        setTargetDurationUnit(preset.durationUnit || 'WEEKS');
        setTargetSaleWeightKg(preset.targetWeight ? String(preset.targetWeight) : '2.2');
      } else {
        setSelectedTemplateKey('SCRATCH');
        setCheckpoints([]);
        setTargetDurationValue('6');
        setTargetDurationUnit('WEEKS');
        setTargetSaleWeightKg('2.2');
      }
      setEditingCheckpointId(null);
      setShowAddCheckpoint(false);

      const isCapex = !isAnimal && Boolean(
        line.excludeFromContingency ||
        line.category === 'EQUIPMENT' ||
        line.category === 'Equipment & Assets'
      );
      setIsCapitalAsset(isCapex);
      setAssetCategory(mapLineCategoryToAssetCategory(line.category));

      const chosenLoc = isAgroPlan ? locations[0]?.id || plan.locationId || '' : '';
      setSelectedLocationId(chosenLoc);

      // Pre-select linked batch if plan has one
      if (plan.linkedLivestockId) {
        setSelectedExistingBatchId(plan.linkedLivestockId);
      } else {
        const matchingBatches = (dataService.getState().livestockEntries || []).filter(
          (b) => b.locationId === chosenLoc && (!plan.orgId || !b.orgId || b.orgId === plan.orgId)
        );
        setSelectedExistingBatchId(matchingBatches[0]?.id || '');
      }
    }
    // Only reset when sheet is opened or when the line item changes - do NOT re-run on background location ref changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, line.id]);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
      setPhotoDataUrl(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      // Clear value so the same file or subsequent selection triggers onChange immediately
      e.target.value = '';
    }
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

    if (isAgroPlan && !selectedLocationId) {
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

      if (isAgroPlan && isLivestock) {
        if (livestockMode === 'NEW_BATCH') {
          const effectiveSpecies =
            selectedSpeciesOption === '__CUSTOM__'
              ? customSpeciesText.trim() || 'Custom'
              : selectedSpeciesOption;
          const preset = DEFAULT_PROTOCOL_TEMPLATES[effectiveSpecies];

          const registered = dataService.registerLivestock({
            locationId: selectedLocationId,
            species: effectiveSpecies,
            nameOrTag: batchName.trim() || line.title,
            trackingMode,
            entryDate: new Date().toISOString(),
            initialAgeValue: 1,
            initialAgeUnit: 'DAYS',
            targetDurationValue: parseInt(targetDurationValue, 10) || preset?.durationValue || 6,
            targetDurationUnit: targetDurationUnit || preset?.durationUnit || 'WEEKS',
            initialHeadcount: Math.round(validQty),
            purchaseCostTotal: Number(validAmount.toFixed(2)),
            autoDeductPurchaseFromLeftMoney: true,
            fundingSource: 'CASH_POOL',
            targetSaleWeightKg: parseFloat(targetSaleWeightKg) || preset?.targetWeight || undefined,
            customCheckpoints: checkpoints,
            notes: detailedNote,
            imageUrl: photoDataUrl,
            actor: currentMember,
            runwayAllocation: lineAllocation,
            runwayPlanId: plan.id,
          });

          // Link batch to plan if not linked yet
          if (!plan.linkedLivestockId) {
            try {
              const plans = dataService.getState().runwayPlans || [];
              const p = plans.find((x) => x.id === plan.id);
              if (p) {
                p.linkedLivestockId = registered.id;
                dataService.saveLocalState({ ...dataService.getState() });
              }
            } catch { }
          }

          onSuccess(
            `Successfully purchased ${qtySummary} of "${line.title}" for $${validAmount.toFixed(2)} and registered as livestock batch "${registered.nameOrTag}" (${effectiveSpecies})!`
          );
        } else {
          // Existing batch addition
          if (!selectedExistingBatchId) {
            setErrorMsg('Please select an existing livestock batch to add animals to.');
            setIsSubmitting(false);
            return;
          }

          dataService.logLivestockLifecycleEvent({
            livestockId: selectedExistingBatchId,
            eventType: 'INITIAL_STOCK',
            headcountDelta: Math.round(validQty),
            note: detailedNote,
            photoUrl: photoDataUrl,
            actor: currentMember,
          });

          dataService.spendAgainstRunwayPlan({
            planId: plan.id,
            allocation: lineAllocation,
            amount: Number(validAmount.toFixed(2)),
            locationId: selectedLocationId,
            category: 'LIVESTOCK_PURCHASE',
            batchOrAnimalId: selectedExistingBatchId,
            note: detailedNote,
            actor: currentMember,
            receiptPhotoDataUrl: photoDataUrl,
          });

          onSuccess(
            `Successfully purchased ${qtySummary} of "${line.title}" ($${validAmount.toFixed(2)}) and added to existing livestock batch!`
          );
        }
      } else if (isCapitalAsset) {
        // Automatically registers into the organization's Capital Assets ledger AND records the Runway expense
        dataService.logFixedAssetEvent({
          assetName: line.title,
          category: assetCategory,
          locationId: isAgroPlan ? selectedLocationId : undefined,
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
          locationId: isAgroPlan ? selectedLocationId : undefined,
          category: mapLineCategoryToExpenseCategory(line.category, isAgroPlan),
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

              {isAgroPlan && isLivestock && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center gap-1 shrink-0">
                  <span>🐾</span>
                  Livestock Batch
                </span>
              )}
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

          {/* Ground Cash Indicator & Dual Verification */}
          <div
            className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${isCashSufficient
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
                Organization Master Cash (<strong className="font-mono">leftMoney</strong>): <strong>${availableCash.toFixed(2)}</strong>
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto px-2 py-0.5 rounded-md bg-white/70 border border-current">
              {isCashSufficient ? 'Treasury Cash Ready' : 'Insufficient Treasury Cash'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            Dual Gate: Spend is authorized against this step&apos;s budget ({isMasked ? '•••••• rem' : `$${actualRemainingBudget.toFixed(2)} rem`}) and withdraws directly from the Organization&apos;s physical liquid cash ({formatMoney(availableCash, !isMasked)} available).
          </p>

          {/* Already Fully Purchased Alert */}
          {isAlreadyFullyPaid && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Line Already Fully Purchased</span>
              </div>
              <p className="text-[11px] text-amber-900/80">
                This item has already been 100% purchased ({isMasked ? '•••••• spent of •••••• planned' : `$${spentSoFar.toFixed(2)} spent of $${linePlannedTotal.toFixed(2)} planned`}). Any additional purchase here will be an overrun drawn from the contingency reserve buffer.
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
                    disabled={isMasked}
                    onClick={() => handleQtyChange(String(actualRemainingUnits))}
                    className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Max Left ({isMasked ? '••' : actualRemainingUnits})
                  </button>
                )}
              </div>
              <input
                type={isMasked ? 'password' : 'number'}
                inputMode="decimal"
                min="0.01"
                max={actualRemainingUnits > 0 ? actualRemainingUnits : 0}
                step="any"
                required
                disabled={actualRemainingUnits <= 0 || isMasked}
                value={isMasked ? '••••' : purchaseQtyStr}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder={isMasked ? '••••' : `e.g. ${actualRemainingUnits || 0}`}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-bold text-slate-950 focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Unit: {isMasked ? '••••••' : `$${line.unitCost.toFixed(2)}`} / {line.unitLabel || 'unit'}</span>
                <span className="font-semibold text-emerald-700">
                  {isMasked ? '••' : actualRemainingUnits} left in plan
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
                  disabled={isMasked}
                  onClick={() => {
                    setPurchaseAmountStr(String(Number(actualRemainingBudget.toFixed(2))));
                    if (actualRemainingUnits > 0) setPurchaseQtyStr(String(actualRemainingUnits));
                  }}
                  className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer disabled:opacity-50"
                >
                  Max ({formatMoney(actualRemainingBudget, !isMasked)})
                </button>
              </div>
              <input
                type={isMasked ? 'password' : 'number'}
                inputMode="decimal"
                min="0.01"
                max={actualRemainingBudget > 0 ? actualRemainingBudget : 0}
                step="0.01"
                required
                disabled={actualRemainingBudget <= 0 || isMasked}
                value={isMasked ? '••••' : purchaseAmountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder={isMasked ? '••••' : 'e.g. 150.00'}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-bold text-slate-950 focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Can pay partial or exact remaining</span>
                <span className="font-semibold text-emerald-700">
                  {formatMoney(actualRemainingBudget, !isMasked)} left
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

          {/* Location / Site (Agro-Farming only) */}
          {isAgroPlan && (
            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Disbursement Location / Site <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
              >
                {locations.length === 0 ? (
                  <option value="">No farm site registered</option>
                ) : (
                  locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.region ? `(${loc.region})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Livestock Registration Integration Card - strictly for AGRO_FARMING plans */}
          {isAgroPlan && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2.5">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLivestock}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsLivestock(checked);
                    if (checked) setIsCapitalAsset(false);
                  }}
                  className="mt-0.5 rounded-md border-[#E8DFCE] text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-950 flex items-center gap-1.5">
                    <span className="text-sm">🐾</span>
                    <span>Register in Livestock Inventory</span>
                  </span>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Automatically records animals into the organization&apos;s Livestock Tracker with health protocols, headcount, and cycle duration — no duplicate entry needed.
                  </p>
                </div>
              </label>

              {isLivestock && (
                <div className="space-y-3 pt-2.5 border-t border-[#E8DFCE]">
                  {/* Batch Mode: New vs Existing */}
                  {existingBatchesAtSite.length > 0 && (
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-[#E8DFCE]">
                      <button
                        type="button"
                        onClick={() => setLivestockMode('NEW_BATCH')}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${livestockMode === 'NEW_BATCH'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        New Batch / Flock
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLivestockMode('EXISTING_BATCH');
                          if (!selectedExistingBatchId && existingBatchesAtSite[0]) {
                            setSelectedExistingBatchId(existingBatchesAtSite[0].id);
                          }
                        }}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${livestockMode === 'EXISTING_BATCH'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Add to Existing Batch ({existingBatchesAtSite.length})
                      </button>
                    </div>
                  )}

                  {livestockMode === 'EXISTING_BATCH' && existingBatchesAtSite.length > 0 ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-950 mb-1">
                        Target Livestock Batch <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedExistingBatchId}
                        onChange={(e) => setSelectedExistingBatchId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
                      >
                        {existingBatchesAtSite.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nameOrTag} ({b.species}) — {b.initialHeadcount} initial head
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Adds {validQty} head to this existing batch upon confirming purchase.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-950 mb-1">
                            Species / Animal Type <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={selectedSpeciesOption}
                            onChange={(e) => handleSpeciesSelect(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-semibold text-slate-950"
                          >
                            {PRESET_SPECIES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                            <option value="__CUSTOM__">Other (Custom Species)...</option>
                          </select>
                        </div>

                        {selectedSpeciesOption === '__CUSTOM__' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-950 mb-1">
                              Custom Species Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={customSpeciesText}
                              onChange={(e) => setCustomSpeciesText(e.target.value)}
                              placeholder="e.g. Quails, Rabbits, Turkeys"
                              className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-medium text-slate-950"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-bold text-slate-950 mb-1">
                            Batch / Animal Tag <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            placeholder="e.g. Broiler Batch #04"
                            className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-semibold text-slate-950"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-950 mb-1">
                            Target Cycle Duration
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={targetDurationValue}
                              onChange={(e) => setTargetDurationValue(e.target.value)}
                              className="w-16 px-2 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-mono font-bold text-slate-950"
                            />
                            <select
                              value={targetDurationUnit}
                              onChange={(e) => setTargetDurationUnit(e.target.value as DurationUnit)}
                              className="flex-1 px-2 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
                            >
                              <option value="DAYS">Days</option>
                              <option value="WEEKS">Weeks</option>
                              <option value="MONTHS">Months</option>
                              <option value="YEARS">Years</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-950 mb-1">
                            Target Sale Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={targetSaleWeightKg}
                            onChange={(e) => setTargetSaleWeightKg(e.target.value)}
                            placeholder="e.g. 2.2"
                            className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-mono font-bold text-slate-950"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-950 mb-1">
                          Tracking Mode
                        </label>
                        <select
                          value={trackingMode}
                          onChange={(e) => setTrackingMode(e.target.value as TrackingMode)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-semibold text-slate-950"
                        >
                          <option value="BATCH">Batch (Flock / Herd)</option>
                          <option value="INDIVIDUAL_TAG">Individual Tagged Animal</option>
                        </select>
                      </div>

                      {/* Checkpoint Schedule Configuration */}
                      <div className="p-3 rounded-2xl bg-white border border-[#E8DFCE] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>Checkpoint Schedule</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                                {checkpoints.length} {checkpoints.length === 1 ? 'stage' : 'stages'}
                              </span>
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Pick a template or start from scratch. Edit or delete any step.
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTemplateChange('SCRATCH')}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Start from Scratch
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const key = DEFAULT_PROTOCOL_TEMPLATES[selectedSpeciesOption]
                                  ? selectedSpeciesOption
                                  : 'Broilers';
                                handleTemplateChange(key);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                              title="Reset to species template"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset Template</span>
                            </button>
                          </div>
                        </div>

                        {/* Template Switcher Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-bold shrink-0">Template:</span>
                          <select
                            value={selectedTemplateKey}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-pointer"
                          >
                            {Object.entries(DEFAULT_PROTOCOL_TEMPLATES).map(([k, t]) => (
                              <option key={k} value={k}>
                                {t.name} ({t.checkpoints.length} stages)
                              </option>
                            ))}
                            <option value="SCRATCH">Start from Scratch (Blank Schedule - 0 stages)</option>
                          </select>
                        </div>

                        {/* Checkpoint list */}
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {checkpoints.length === 0 ? (
                            <div className="p-3.5 rounded-xl border border-dashed border-slate-300 text-center space-y-1.5">
                              <Layers className="w-5 h-5 text-slate-400 mx-auto" />
                              <p className="text-xs text-slate-500 font-medium">
                                No checkpoints scheduled. Batch will be created with a blank protocol.
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowAddCheckpoint(true)}
                                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add First Checkpoint</span>
                              </button>
                            </div>
                          ) : (
                            checkpoints.map((cp) => {
                              const isEditing = editingCheckpointId === cp.id;
                              if (isEditing) {
                                return (
                                  <div
                                    key={cp.id}
                                    className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between font-bold text-amber-950">
                                      <span>Edit Protocol Stage</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingCheckpointId(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                          Day Target
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          value={editDayTarget}
                                          onChange={(e) => setEditDayTarget(e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                          Category
                                        </label>
                                        <select
                                          value={editCategory}
                                          onChange={(e) => setEditCategory(e.target.value as CheckpointCategory)}
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                                        >
                                          <option value="VACCINE">Vaccine</option>
                                          <option value="FEED_TRANSITION">Feed Transition</option>
                                          <option value="WEIGHT_CHECK">Weight Check</option>
                                          <option value="BIOSECURITY">Biosecurity</option>
                                          <option value="MEDICATION">Medication</option>
                                          <option value="GENERAL_TASK">General Task</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                        Stage Title <span className="text-rose-500">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        placeholder="e.g. Day 14: Week 2 Weight & IBD Vaccine"
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                          Target Weight (kg)
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={editWeight}
                                          onChange={(e) => setEditWeight(e.target.value)}
                                          placeholder="e.g. 0.48"
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                          Feed Phase
                                        </label>
                                        <input
                                          type="text"
                                          value={editFeedPhase}
                                          onChange={(e) => setEditFeedPhase(e.target.value)}
                                          placeholder="e.g. Grower Pellets"
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                        Instructions / Note
                                      </label>
                                      <input
                                        type="text"
                                        value={editInstructions}
                                        onChange={(e) => setEditInstructions(e.target.value)}
                                        placeholder="Instructions for farm team..."
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                      />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCheckpointId(null)}
                                        className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-bold"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                      >
                                        Save Changes
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={cp.id}
                                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                                        Day {cp.dayTarget}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                          cp.category === 'VACCINE'
                                            ? 'bg-purple-100 text-purple-800'
                                            : cp.category === 'FEED_TRANSITION'
                                              ? 'bg-amber-100 text-amber-800'
                                              : cp.category === 'WEIGHT_CHECK'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {formatCheckpointCategory(cp.category)}
                                      </span>
                                    </div>

                                    <div className="font-bold text-slate-900 truncate">
                                      {cp.title}
                                    </div>

                                    {(cp.feedPhase || cp.targetWeightKg) && (
                                      <div className="text-[11px] text-slate-500 font-medium">
                                        {cp.targetWeightKg ? `Target: ${cp.targetWeightKg}kg · ` : ''}
                                        {cp.feedPhase || ''}
                                      </div>
                                    )}

                                    {(cp.instructions || cp.description) && (
                                      <div className="text-[10px] text-slate-500 truncate">
                                        {cp.instructions || cp.description}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(cp)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                      title="Edit stage"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCheckpoint(cp.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete stage"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Add Checkpoint Form */}
                        {showAddCheckpoint ? (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span>Add Custom Checkpoint Stage</span>
                              <button
                                type="button"
                                onClick={() => setShowAddCheckpoint(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                  Day Target
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={newDayTarget}
                                  onChange={(e) => setNewDayTarget(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                  Category
                                </label>
                                <select
                                  value={newCategory}
                                  onChange={(e) => setNewCategory(e.target.value as CheckpointCategory)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                                >
                                  <option value="VACCINE">Vaccine</option>
                                  <option value="FEED_TRANSITION">Feed Transition</option>
                                  <option value="WEIGHT_CHECK">Weight Check</option>
                                  <option value="BIOSECURITY">Biosecurity</option>
                                  <option value="MEDICATION">Medication</option>
                                  <option value="GENERAL_TASK">General Task</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                Stage Title <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g. Day 21: Gumboro / IBD Booster"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                  Target Weight (kg)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newWeight}
                                  onChange={(e) => setNewWeight(e.target.value)}
                                  placeholder="e.g. 0.90"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                  Feed Phase
                                </label>
                                <input
                                  type="text"
                                  value={newFeedPhase}
                                  onChange={(e) => setNewFeedPhase(e.target.value)}
                                  placeholder="e.g. Finisher Pellets"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                Instructions / Note
                              </label>
                              <input
                                type="text"
                                value={newInstructions}
                                onChange={(e) => setNewInstructions(e.target.value)}
                                placeholder="Instructions for farm team..."
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowAddCheckpoint(false)}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleAddCheckpoint}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                              >
                                Add Stage
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddCheckpoint(true)}
                              className="w-full py-1.5 px-3 rounded-xl border border-dashed border-[#E8DFCE] hover:border-emerald-600 bg-[#FAF8F5] text-slate-700 hover:text-emerald-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Custom Checkpoint Stage</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fixed Capital Asset Integration Checkbox */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2.5">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isCapitalAsset}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsCapitalAsset(checked);
                  if (checked) setIsLivestock(false);
                }}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-[#E8DFCE] bg-[#FAF8F5] text-xs font-bold text-slate-950 hover:bg-stone-50 cursor-pointer active:scale-95 transition-transform"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-700" />
                <span>{photoDataUrl ? 'Change Receipt Photo' : 'Attach Receipt Photo'}</span>
              </button>
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
                    : `Confirm Purchase (${formatMoney(validAmount, !isMasked)})`}
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

