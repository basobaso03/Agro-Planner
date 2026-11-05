import React, { useState, useMemo, useEffect } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type {
  OrgMember,
  TrackingMode,
  DurationUnit,
  AnimalCheckpoint,
  CheckpointCategory,
  LivestockEntry,
} from '../../types/agro.ts';
import { formatMoney } from '../../utils/currency.ts';
import { convertToDays } from '../../utils/calculations.ts';
import {
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  X,
  Layers,
  ShieldCheck,
  RotateCcw,
  Tag,
} from 'lucide-react';

export interface RegisterBatchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onBatchRegistered?: () => void;
  existingBatch?: LivestockEntry;
}

// Built-in standard protocol presets
interface ProtocolPreset {
  name: string;
  durationValue: number;
  durationUnit: DurationUnit;
  targetWeight?: number;
  checkpoints: Omit<AnimalCheckpoint, 'completed' | 'reminderStatus'>[];
}

const DEFAULT_PROTOCOL_TEMPLATES: Record<string, ProtocolPreset> = {
  Broilers: {
    name: 'Commercial Broiler 42-Day Protocol',
    durationValue: 6,
    durationUnit: 'WEEKS',
    targetWeight: 2.2,
    checkpoints: [
      { id: 'cp-b1', dayTarget: 1, title: 'Day 1: Placement, Brooder Setup (32-33°C) & Stress Pack', category: 'BIOSECURITY', targetWeightKg: 0.042, feedPhase: 'Broiler Starter Crumbles (22-24% CP)', instructions: 'Brooder preheated. Administer Stress Pack (glucose + electrolytes + multivitamins) in clean water.' },
      { id: 'cp-b4', dayTarget: 4, title: 'Day 4: Starter Period: Brooder Temp Stepping & Crop Audit', category: 'FEED_TRANSITION', targetWeightKg: 0.095, feedPhase: 'Broiler Starter Crumbles (22-24% CP)', instructions: 'Brooder temp step-down (-0.5°C/day towards 28°C). Active feeding and crop audit.' },
      { id: 'cp-b7', dayTarget: 7, title: 'Day 7: Week 1 Weight Check & Newcastle (B1) Vaccine', category: 'VACCINE', targetWeightKg: 0.185, feedPhase: 'Broiler Starter Crumbles (22-24% CP)', instructions: 'Newcastle Hitchner B1 eye-drop or drinking water. Conduct 10% sample weigh-in.' },
      { id: 'cp-b11', dayTarget: 11, title: 'Day 11: Feed Switch: 3-Day Starter to Grower Blend', category: 'FEED_TRANSITION', targetWeightKg: 0.35, feedPhase: '50% Starter / 50% Grower Blend', instructions: '3-day gradual blend switch: Day 11 (75/25), Day 12 (50/50), Day 13 (25/75).' },
      { id: 'cp-b14', dayTarget: 14, title: 'Day 14: Week 2 Weight & IBD Intermediate Vaccine', category: 'VACCINE', targetWeightKg: 0.48, feedPhase: '100% Broiler Grower Pellets (20% CP)', instructions: 'IBD Intermediate vaccine in clean chlorine-free water with skim milk stabilizer.' },
      { id: 'cp-b18', dayTarget: 18, title: 'Day 18: Grower Phase: Ventilation & Litter Audit', category: 'FEED_TRANSITION', targetWeightKg: 0.72, feedPhase: 'Broiler Grower Pellets (20% CP)', instructions: 'Turn litter to prevent caking, check drinker pressure and daily intake.' },
      { id: 'cp-b21', dayTarget: 21, title: 'Day 21: Week 3 Weight & Newcastle + IBD Booster', category: 'VACCINE', targetWeightKg: 0.98, feedPhase: 'Broiler Grower Pellets (20% CP)', instructions: 'Newcastle LaSota + IBD booster in drinking water. Weigh sample (target: 950-1050g).' },
      { id: 'cp-b25', dayTarget: 25, title: 'Day 25: Feed Transition: 3-Day Grower to Finisher Blend', category: 'FEED_TRANSITION', targetWeightKg: 1.35, feedPhase: '50% Grower / 50% Finisher Blend', instructions: '3-day transition: Day 25 (75/25), Day 26 (50/50), Day 27 (25/75).' },
      { id: 'cp-b28', dayTarget: 28, title: 'Day 28: Week 4 Weight Check & 100% Finisher Transition', category: 'FEED_TRANSITION', targetWeightKg: 1.62, feedPhase: '100% Broiler Finisher (18-19% CP)', instructions: 'Full transition to high-energy finisher. Sample weigh-in (target: 1.55-1.70kg).' },
      { id: 'cp-b32', dayTarget: 32, title: 'Day 32: Biosecurity & Medication Withdrawal Audit', category: 'BIOSECURITY', targetWeightKg: 1.95, feedPhase: 'Unmedicated Broiler Finisher', instructions: 'Mandatory veterinary withdrawal of any anticoccidials or medicated feeds.' },
      { id: 'cp-b35', dayTarget: 35, title: 'Day 35: Week 5 Pre-Market Weight Audit & Buyer Booking', category: 'WEIGHT_CHECK', targetWeightKg: 2.2, feedPhase: 'Unmedicated Broiler Finisher', instructions: 'Flock weigh-in (target 2.1-2.3 kg). Finalize customer bookings and processing slots.' },
      { id: 'cp-b38', dayTarget: 38, title: 'Day 38: Final Harvest & Dispatch Readiness', category: 'WEIGHT_CHECK', targetWeightKg: 2.45, feedPhase: 'Pre-Slaughter Feed Withdrawal', instructions: '8-10 hour feed withdrawal before harvest. Early dawn or night dispatch.' },
    ],
  },
  Layers: {
    name: 'Egg Layers Pullet Protocol',
    durationValue: 72,
    durationUnit: 'WEEKS',
    targetWeight: 1.9,
    checkpoints: [
      { id: 'cp-l1', dayTarget: 1, title: 'Day 1: Marek’s Vaccine & Warm Brooder Intake', category: 'BIOSECURITY', instructions: 'Stress pack, warm brooder at 33°C, clean water with glucose.' },
      { id: 'cp-l7', dayTarget: 7, title: 'Day 7: Newcastle B1 / Hitchner Eye-Drop', category: 'VACCINE', instructions: 'Administer ocular drop or drinking water.' },
      { id: 'cp-l14', dayTarget: 14, title: 'Day 14: IBD Intermediate Vaccine', category: 'VACCINE', instructions: 'Administer IBD intermediate strain in water.' },
      { id: 'cp-l21', dayTarget: 21, title: 'Day 21: Newcastle Booster (LaSota)', category: 'VACCINE', instructions: 'Newcastle LaSota drinking water vaccine.' },
      { id: 'cp-l35', dayTarget: 35, title: 'Day 35: Fowl Pox & Wing Web Inoculation', category: 'VACCINE', instructions: 'Wing-web stab puncture vaccine.' },
      { id: 'cp-l56', dayTarget: 56, title: 'Day 56: Pullet Grower Feed Switch & Deworming', category: 'FEED_TRANSITION', instructions: 'Transition to Pullet Grower Mash. Oral deworming.' },
      { id: 'cp-l112', dayTarget: 112, title: 'Day 112: Pre-Lay Mash & Nest Box Familiarization', category: 'FEED_TRANSITION', instructions: 'High calcium pre-lay mash. Open nesting boxes.' },
      { id: 'cp-l140', dayTarget: 140, title: 'Day 140: 100% Layer Mash & Point-of-Lay Audit', category: 'GENERAL_TASK', instructions: 'Layer mash with 3.8% calcium. Monitor onset of lay.' },
    ],
  },
  'Boer Goats': {
    name: 'Hardy Boer Goat Management',
    durationValue: 8,
    durationUnit: 'MONTHS',
    targetWeight: 45,
    checkpoints: [
      { id: 'cp-g14', dayTarget: 14, title: 'Day 14: Quarantine, Hoof Dip & Ear Tag Audit', category: 'BIOSECURITY', instructions: 'Inspect isolation paddock, dip feet in copper sulfate.' },
      { id: 'cp-g30', dayTarget: 30, title: 'Day 30: Pulpy Kidney & Clostridial Vaccine', category: 'VACCINE', instructions: 'Multivalent enterotoxaemia injection.' },
      { id: 'cp-g90', dayTarget: 90, title: 'Day 90: Broad-Spectrum Deworming (Albendazole)', category: 'VACCINE', instructions: 'Oral drenching calibrated to live weight.' },
      { id: 'cp-g150', dayTarget: 150, title: 'Day 150: Mid-Cycle Body Condition Score Audit', category: 'WEIGHT_CHECK', instructions: 'Score body condition (target 3.5/5), weigh sample.' },
      { id: 'cp-g210', dayTarget: 210, title: 'Day 210: Pre-Market Finishing Supplement', category: 'FEED_TRANSITION', instructions: 'Transition to finishing ration and buyer pre-orders.' },
    ],
  },
  Cattle: {
    name: 'Pasture Cattle Herd Protocol',
    durationValue: 18,
    durationUnit: 'MONTHS',
    targetWeight: 420,
    checkpoints: [
      { id: 'cp-c7', dayTarget: 7, title: 'Day 7: Arrival Quarantine & Ear-Tag Verification', category: 'BIOSECURITY', instructions: 'Check individual tags, record weights.' },
      { id: 'cp-c30', dayTarget: 30, title: 'Day 30: Multivalent Clostridial / Blackleg Vaccine', category: 'VACCINE', instructions: 'Subcutaneous injection on clean neck.' },
      { id: 'cp-c90', dayTarget: 90, title: 'Day 90: Tick Plunge Dip & Seasonal Deworming', category: 'VACCINE', instructions: 'Plunge dip or spray race acaricide treatment.' },
      { id: 'cp-c180', dayTarget: 180, title: 'Day 180: Bi-Annual Herd Weigh-In & Growth Curve', category: 'WEIGHT_CHECK', instructions: 'Crush weigh-in and mineral lick placement.' },
    ],
  },
  Pigs: {
    name: 'Commercial Swine Protocol',
    durationValue: 5,
    durationUnit: 'MONTHS',
    targetWeight: 90,
    checkpoints: [
      { id: 'cp-p3', dayTarget: 3, title: 'Day 3: Iron Dextran Injection & Needle Teeth Check', category: 'BIOSECURITY', instructions: '200mg iron dextran to prevent anaemia.' },
      { id: 'cp-p21', dayTarget: 21, title: 'Day 21: PCV2 Circovirus & Mycoplasma Vaccine', category: 'VACCINE', instructions: 'Protect respiratory and lymphoid health.' },
      { id: 'cp-p28', dayTarget: 28, title: 'Day 28: Weaning & Weaner Pellets Transition', category: 'FEED_TRANSITION', instructions: 'Gradual switch from creep to weaner pellets.' },
      { id: 'cp-p75', dayTarget: 75, title: 'Day 75: Pig Grower Mash Transition & Deworming', category: 'FEED_TRANSITION', instructions: 'Grower ration with broad-spectrum ivermectin.' },
      { id: 'cp-p150', dayTarget: 150, title: 'Day 150: Final Finisher Weight Audit & Abattoir Booking', category: 'WEIGHT_CHECK', instructions: 'Final weight audit (target 85-95kg).' },
    ],
  },
  Sheep: {
    name: 'Sheep Flock Protocol',
    durationValue: 7,
    durationUnit: 'MONTHS',
    targetWeight: 40,
    checkpoints: [
      { id: 'cp-s14', dayTarget: 14, title: 'Day 14: Quarantine & Foot Rot Screening', category: 'BIOSECURITY', instructions: 'Inspect feet, hoof trim and footbath.' },
      { id: 'cp-s30', dayTarget: 30, title: 'Day 30: Clostridial 8-in-1 / Pulpy Kidney Vaccine', category: 'VACCINE', instructions: 'Subcutaneous vaccination.' },
      { id: 'cp-s90', dayTarget: 90, title: 'Day 90: Seasonal Deworming & Mineral Block', category: 'VACCINE', instructions: 'Oral drench and cobalt/selenium lick block.' },
      { id: 'cp-s180', dayTarget: 180, title: 'Day 180: Pre-Sale Weigh-In & Market Prep', category: 'WEIGHT_CHECK', instructions: 'Sample weighing and market batching.' },
    ],
  },
  'Road Runners': {
    name: 'Indigenous Free-Range Poultry',
    durationValue: 20,
    durationUnit: 'WEEKS',
    targetWeight: 1.8,
    checkpoints: [
      { id: 'cp-rr1', dayTarget: 1, title: 'Day 1: Brooder Placement & Aloe/Multivitamin Drink', category: 'BIOSECURITY', instructions: 'Warm brooding, glucose and natural aloe/stress pack water.' },
      { id: 'cp-rr7', dayTarget: 7, title: 'Day 7: Newcastle Hitchner B1 Vaccine', category: 'VACCINE', instructions: 'Eye-drop or water vaccination.' },
      { id: 'cp-rr21', dayTarget: 21, title: 'Day 21: Newcastle Booster (LaSota)', category: 'VACCINE', instructions: 'Drinking water booster.' },
      { id: 'cp-rr42', dayTarget: 42, title: 'Day 42: Free-Range Paddock Release & Fowl Pox', category: 'VACCINE', instructions: 'Wing-web puncture for fowl pox. Release to forage run.' },
      { id: 'cp-rr84', dayTarget: 84, title: 'Day 84: Routine Deworming & Grain Supplement', category: 'FEED_TRANSITION', instructions: 'Internal parasite control and crushed grain supplement.' },
      { id: 'cp-rr140', dayTarget: 140, title: 'Day 140: Market Readiness Weigh-In & Selection', category: 'WEIGHT_CHECK', instructions: 'Live weight selection (target 1.6 - 2.0 kg).' },
    ],
  },
};

const STANDARD_SPECIES = [
  'Broilers',
  'Layers',
  'Boer Goats',
  'Cattle',
  'Pigs',
  'Sheep',
  'Road Runners',
];

export const PRESET_SPECIES = STANDARD_SPECIES;

export const formatCheckpointCategory = (cat?: string): string => {
  if (!cat) return 'General';
  const standardMap: Record<string, string> = {
    VACCINE: 'Vaccine / Health',
    FEED_TRANSITION: 'Feed Transition',
    WEIGHT_CHECK: 'Weight Check',
    BIOSECURITY: 'Biosecurity',
    MEDICATION: 'Medication',
    GENERAL_TASK: 'General Task',
  };
  if (standardMap[cat]) return standardMap[cat];
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const RegisterBatchSheet: React.FC<RegisterBatchSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onBatchRegistered,
  existingBatch,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  // Species management: preset or custom typing
  const [selectedSpeciesOption, setSelectedSpeciesOption] = useState<string>('Broilers');
  const [customSpeciesText, setCustomSpeciesText] = useState<string>('');

  // Move-in date replaces age on entry
  const [moveInDate, setMoveInDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Click-to-clear tracking so clicking prefilled numbers clears them instantly
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Locations & Left Money Pool
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );
  const targetOrgId = activeMember.orgId || locations[0]?.orgId || 'org-master';
  const currentLeftMoney = dataService.getCurrentOrgLeftMoney(targetOrgId);

  // Protocols & Flexible CRUD state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('Broilers');
  const [checkpoints, setCheckpoints] = useState<AnimalCheckpoint[]>(() => {
    const preset = DEFAULT_PROTOCOL_TEMPLATES['Broilers'];
    return preset
      ? preset.checkpoints.map((cp) => ({
        ...cp,
        completed: false,
        reminderStatus: 'SCHEDULED' as const,
      }))
      : [];
  });

  // Checkpoint editing state
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editDayTarget, setEditDayTarget] = useState<string>('1');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<CheckpointCategory>('VACCINE');
  const [editWeight, setEditWeight] = useState<string>('');
  const [editFeedPhase, setEditFeedPhase] = useState<string>('');
  const [editInstructions, setEditInstructions] = useState<string>('');

  // New checkpoint inline creation state
  const [showAddCheckpoint, setShowAddCheckpoint] = useState<boolean>(false);
  const [newDayTarget, setNewDayTarget] = useState<string>('7');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<CheckpointCategory>('VACCINE');
  const [newWeight, setNewWeight] = useState<string>('');
  const [newFeedPhase, setNewFeedPhase] = useState<string>('');
  const [newInstructions, setNewInstructions] = useState<string>('');

  // Effective species name
  const effectiveSpecies =
    selectedSpeciesOption === '__CUSTOM__'
      ? customSpeciesText.trim()
      : selectedSpeciesOption;

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingBatch) {
        const isPreset = PRESET_SPECIES.includes(existingBatch.species);
        setSelectedSpeciesOption(isPreset ? existingBatch.species : '__CUSTOM__');
        setCustomSpeciesText(isPreset ? '' : existingBatch.species);
        setMoveInDate(
          existingBatch.entryDate
            ? new Date(existingBatch.entryDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setPhotoUrl(existingBatch.imageUrl);
        setTouchedFields({});
        setShowAddCheckpoint(false);
        setEditingCheckpointId(null);
        setSelectedTemplateKey(isPreset ? existingBatch.species : 'Custom');
        setCheckpoints(existingBatch.customCheckpoints || []);

        form.setValues({
          locationId: existingBatch.locationId || locations[0]?.id || '',
          nameOrTag: existingBatch.nameOrTag || '',
          trackingMode: existingBatch.trackingMode || 'BATCH',
          initialHeadcount: String(existingBatch.initialHeadcount || 1),
          targetDurationValue: String(existingBatch.targetDurationValue || 6),
          targetDurationUnit: existingBatch.targetDurationUnit || 'WEEKS',
          purchaseCost: existingBatch.purchaseCostTotal ? String(existingBatch.purchaseCostTotal) : '',
          targetSaleWeightKg: existingBatch.targetSaleWeightKg ? String(existingBatch.targetSaleWeightKg) : '',
          notes: existingBatch.notes || '',
        });
      } else {
        setSelectedSpeciesOption('Broilers');
        setCustomSpeciesText('');
        setMoveInDate(new Date().toISOString().split('T')[0]);
        setTouchedFields({});
        setShowAddCheckpoint(false);
        setEditingCheckpointId(null);
        setPhotoUrl(undefined);

        // Load broiler defaults
        const preset = DEFAULT_PROTOCOL_TEMPLATES['Broilers'];
        setSelectedTemplateKey('Broilers');
        setCheckpoints(
          preset
            ? preset.checkpoints.map((cp) => ({
              ...cp,
              completed: false,
              reminderStatus: 'SCHEDULED' as const,
            }))
            : []
        );

        form.setValues({
          locationId: locations[0]?.id || '',
          nameOrTag: '',
          trackingMode: 'BATCH' as TrackingMode,
          initialHeadcount: '100',
          targetDurationValue: '6',
          targetDurationUnit: 'WEEKS' as DurationUnit,
          purchaseCost: '',
          targetSaleWeightKg: '2.2',
          notes: '',
        });
      }
    }
  }, [isOpen, existingBatch?.id]);

  // Form handling
  const form = useForm({
    initial: {
      locationId: locations[0]?.id || '',
      nameOrTag: '',
      trackingMode: 'BATCH' as TrackingMode,
      initialHeadcount: '100',
      targetDurationValue: '6',
      targetDurationUnit: 'WEEKS' as DurationUnit,
      purchaseCost: '',
      targetSaleWeightKg: '2.2',
      notes: '',
    },
    validate: (values) => {
      const cost = parseFloat(values.purchaseCost || '0');
      const errors: Record<string, string | null> = {
        locationId: !values.locationId ? 'Farm site is required' : null,
        species:
          selectedSpeciesOption === '__CUSTOM__' && !customSpeciesText.trim()
            ? 'Please enter custom species name'
            : null,
        nameOrTag: validators.required(values.nameOrTag, 'Batch name or tag ID'),
        initialHeadcount: validators.positiveInteger(values.initialHeadcount, 'Headcount'),
        targetDurationValue: validators.positiveInteger(values.targetDurationValue, 'Target duration'),
        notes: validators.minAuditNote(values.notes, 4),
      };

      // Strict validation: All money is from Left Money! If insufficient, registration is blocked for new registrations.
      if (!existingBatch && cost > 0 && cost > currentLeftMoney) {
        errors.purchaseCost = `Insufficient Left Money (${formatMoney(currentLeftMoney)} available). Cannot register stock with cost exceeding available cash.`;
      }

      return errors;
    },
    onSubmit: async (values) => {
      try {
        const cost = parseFloat(values.purchaseCost || '0');

        // Overdraft verification guard on new batch
        if (!existingBatch && cost > 0 && cost > currentLeftMoney) {
          throw new Error(
            `Insufficient Left Money: Purchase cost of ${formatMoney(cost)} exceeds available Left Money (${formatMoney(currentLeftMoney)}). Please deposit capital first.`
          );
        }

        // Calculate age on entry from move-in date
        const entryIso = new Date(moveInDate).toISOString();
        const initialAgeValue = Math.max(1, detectedAgeDays);

        if (existingBatch) {
          dataService.updateLivestockEntry({
            id: existingBatch.id,
            updates: {
              locationId: values.locationId,
              species: effectiveSpecies,
              nameOrTag: values.nameOrTag.trim(),
              trackingMode: values.trackingMode,
              entryDate: entryIso,
              initialAgeValue,
              initialAgeUnit: 'DAYS',
              targetDurationValue: parseInt(values.targetDurationValue, 10),
              targetDurationUnit: values.targetDurationUnit,
              initialHeadcount: parseInt(values.initialHeadcount, 10),
              purchaseCostTotal: cost,
              targetSaleWeightKg: parseFloat(values.targetSaleWeightKg) || undefined,
              customCheckpoints: checkpoints.length > 0 ? checkpoints : undefined,
              imageUrl: photoUrl,
              notes: values.notes.trim(),
            },
            actor: activeMember,
          });

          showToast({
            type: 'success',
            title: 'Livestock Record Updated',
            message: `Specifications successfully updated for ${values.nameOrTag.trim()}.`,
          });
        } else {
          dataService.registerLivestock({
            locationId: values.locationId,
            species: effectiveSpecies,
            nameOrTag: values.nameOrTag.trim(),
            trackingMode: values.trackingMode,
            entryDate: entryIso,
            initialAgeValue,
            initialAgeUnit: 'DAYS',
            targetDurationValue: parseInt(values.targetDurationValue, 10),
            targetDurationUnit: values.targetDurationUnit,
            initialHeadcount: parseInt(values.initialHeadcount, 10),
            purchaseCostTotal: cost,
            autoDeductPurchaseFromLeftMoney: cost > 0,
            fundingSource: cost > 0 ? 'CASH_POOL' : undefined,
            targetSaleWeightKg: parseFloat(values.targetSaleWeightKg) || undefined,
            customCheckpoints: checkpoints.length > 0 ? checkpoints : undefined,
            imageUrl: photoUrl,
            notes: values.notes.trim(),
            actor: activeMember,
          });

          showToast({
            type: 'success',
            title: 'Livestock Registered',
            message: `${values.nameOrTag.trim()} (${effectiveSpecies}) added to farm inventory.`,
          });
        }
        onBatchRegistered?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: existingBatch ? 'Update Failed' : 'Registration Failed',
          message: err?.message || 'Could not save livestock record.',
        });
      }
    },
  });

  // Calculate elapsed days, current age, days left, and current protocol stage
  const { elapsedDays, detectedAgeDays, targetDurationDays, daysLeft, targetSaleDateString, currentProtocolStage, nextProtocolStage } =
    useMemo(() => {
      let elapsed = 0;
      if (moveInDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = moveInDate.split('-').map(Number);
        const arrival = new Date(y, m - 1, d);
        arrival.setHours(0, 0, 0, 0);
        const diff = today.getTime() - arrival.getTime();
        elapsed = Math.max(0, Math.floor(diff / 86400000));
      }

      const isPoultry =
        effectiveSpecies.toLowerCase().includes('broiler') ||
        effectiveSpecies.toLowerCase().includes('chick') ||
        effectiveSpecies.toLowerCase().includes('layer') ||
        effectiveSpecies.toLowerCase().includes('poultry');

      // Chicks enter at Day 1, older stock at elapsed days
      const ageDays = isPoultry ? elapsed + 1 : elapsed;

      // Target duration converted to days
      const targetDays = convertToDays(
        parseInt(form.values.targetDurationValue, 10) || 0,
        form.values.targetDurationUnit
      );
      const remainingDays = targetDays - elapsed;

      // Target sale date calculation
      const arrivalDateObj = new Date(moveInDate || Date.now());
      const saleDateObj = new Date(arrivalDateObj.getTime() + targetDays * 86400000);
      const saleDateStr = saleDateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      // Find current stage & next upcoming stage in checkpoints
      const sorted = [...checkpoints].sort((a, b) => a.dayTarget - b.dayTarget);
      const pastOrCurrent = sorted.filter((c) => c.dayTarget <= ageDays);
      const currentStage = pastOrCurrent[pastOrCurrent.length - 1];
      const nextStage = sorted.find((c) => c.dayTarget > ageDays);

      return {
        elapsedDays: elapsed,
        detectedAgeDays: ageDays,
        targetDurationDays: targetDays,
        daysLeft: remainingDays,
        targetSaleDateString: saleDateStr,
        currentProtocolStage: currentStage,
        nextProtocolStage: nextStage,
      };
    }, [moveInDate, effectiveSpecies, form.values.targetDurationValue, form.values.targetDurationUnit, checkpoints]);

  // Click-to-clear input event handlers
  const handleNumberInputClick = (field: 'initialHeadcount' | 'targetSaleWeightKg' | 'targetDurationValue') => (
    e: React.MouseEvent<HTMLInputElement>
  ) => {
    if (!touchedFields[field] && form.values[field]) {
      form.setValue(field, '');
      setTouchedFields((prev) => ({ ...prev, [field]: true }));
    } else {
      (e.target as HTMLInputElement).select();
    }
  };

  const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // Switch species preset or custom
  const handleSpeciesSelect = (val: string) => {
    setSelectedSpeciesOption(val);
    if (val !== '__CUSTOM__' && DEFAULT_PROTOCOL_TEMPLATES[val]) {
      const preset = DEFAULT_PROTOCOL_TEMPLATES[val];
      setSelectedTemplateKey(val);
      form.setValue('targetDurationValue', String(preset.durationValue));
      form.setValue('targetDurationUnit', preset.durationUnit);
      if (preset.targetWeight) {
        form.setValue('targetSaleWeightKg', String(preset.targetWeight));
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

  // Switch or reload protocol template
  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === 'SCRATCH') {
      setCheckpoints([]);
      showToast({
        type: 'info',
        message: 'Blank protocol loaded. Add your custom farm stages below.',
      });
      return;
    }
    const preset = DEFAULT_PROTOCOL_TEMPLATES[templateKey];
    if (preset) {
      form.setValue('targetDurationValue', String(preset.durationValue));
      form.setValue('targetDurationUnit', preset.durationUnit);
      if (preset.targetWeight) {
        form.setValue('targetSaleWeightKg', String(preset.targetWeight));
      }
      setCheckpoints(
        preset.checkpoints.map((cp) => ({
          ...cp,
          completed: false,
          reminderStatus: 'SCHEDULED' as const,
        }))
      );
      showToast({
        type: 'success',
        message: `Loaded template: ${preset.name}`,
      });
    }
  };

  // Checkpoint CRUD: Delete
  const handleDeleteCheckpoint = (id: string) => {
    setCheckpoints((prev) => prev.filter((c) => c.id !== id));
  };

  // Checkpoint CRUD: Start Edit
  const handleStartEdit = (cp: AnimalCheckpoint) => {
    setEditingCheckpointId(cp.id);
    setEditDayTarget(String(cp.dayTarget));
    setEditTitle(cp.title);
    setEditCategory(cp.category);
    setEditWeight(cp.targetWeightKg ? String(cp.targetWeightKg) : '');
    setEditFeedPhase(cp.feedPhase || '');
    setEditInstructions(cp.instructions || cp.description || '');
  };

  // Checkpoint CRUD: Save Edit
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

  // Checkpoint CRUD: Add New Checkpoint
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

  const handleCapturePhoto = async () => {
    const photo = await promptPhotoSource();
    if (photo?.webPath) {
      setPhotoUrl(photo.webPath);
    }
  };

  const costNumber = parseFloat(form.values.purchaseCost || '0');
  const isOverBudget = !existingBatch && costNumber > 0 && costNumber > currentLeftMoney;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={existingBatch ? 'Edit Livestock Record' : 'Register Livestock'}
      subtitle={
        existingBatch
          ? `Update specifications and targets for ${existingBatch.nameOrTag}`
          : 'Onboard animals with automatic age tracking & custom protocol'
      }
      isSubmitting={form.isSubmitting}
      submitLabel={
        existingBatch
          ? 'Save Changes'
          : isOverBudget
            ? 'Insufficient Left Money'
            : 'Register Stock'
      }
      onSubmit={form.handleSubmit}
      maxHeight="90dvh"
    >
      <div className="space-y-4">
        {/* Section 1: Location & Species */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
          <Field label="Farm Location" required error={form.errors.locationId}>
            <select
              value={form.values.locationId}
              onChange={(e) => form.setValue('locationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Species / Type" required error={form.errors.species}>
              <select
                value={selectedSpeciesOption}
                onChange={(e) => handleSpeciesSelect(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
              >
                {STANDARD_SPECIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__CUSTOM__">➕ Other (Type Custom Species...)</option>
              </select>
            </Field>

            <Field label="Tracking Mode" required>
              <select
                value={form.values.trackingMode}
                onChange={(e) => form.setValue('trackingMode', e.target.value as TrackingMode)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
              >
                <option value="BATCH">Batch Flock / Herd</option>
                <option value="INDIVIDUAL_TAG">Individual Tagged</option>
              </select>
            </Field>
          </div>

          {/* Custom Species Text Input if "Other" is chosen */}
          {selectedSpeciesOption === '__CUSTOM__' && (
            <Field
              label="Enter Custom Species Name"
              required
              hint="e.g. Quails, Rabbits, Turkeys, Ducks, Tilapia, Bees"
            >
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  required
                  value={customSpeciesText}
                  onChange={(e) => setCustomSpeciesText(e.target.value)}
                  placeholder="e.g. Quails or Rabbits"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold ring-2 ring-emerald-500/20"
                />
                {customSpeciesText && (
                  <button
                    type="button"
                    onClick={() => setCustomSpeciesText('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
          )}

          <Field label="Batch Name or Tag ID" required error={form.errors.nameOrTag}>
            <input
              type="text"
              value={form.values.nameOrTag}
              onChange={(e) => form.setValue('nameOrTag', e.target.value)}
              placeholder="e.g. Broiler Batch #05 or Buck #GT-09"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
            />
          </Field>
        </div>

        {/* Section 2: Move-In Date, Headcount & Target Duration */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Arrival / Move-In Date <span className="text-rose-500">*</span></span>
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setMoveInDate(new Date().toISOString().split('T')[0])}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setMoveInDate(d.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setMoveInDate(d.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
              >
                -7d
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 14);
                  setMoveInDate(d.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
              >
                -14d
              </button>
            </div>
          </div>

          <input
            type="date"
            required
            value={moveInDate}
            onChange={(e) => setMoveInDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
          />

          {/* Numbers grid with click-to-clear support */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Initial Headcount" required error={form.errors.initialHeadcount}>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={form.values.initialHeadcount}
                  placeholder="e.g. 100"
                  onClick={handleNumberInputClick('initialHeadcount')}
                  onFocus={handleNumberInputFocus}
                  onChange={(e) => {
                    setTouchedFields((prev) => ({ ...prev, initialHeadcount: true }));
                    form.setValue('initialHeadcount', e.target.value);
                  }}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold"
                />
                {form.values.initialHeadcount && (
                  <button
                    type="button"
                    onClick={() => form.setValue('initialHeadcount', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                    title="Clear number"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>

            <Field label="Target Weight (kg)">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={form.values.targetSaleWeightKg}
                  placeholder="e.g. 2.2"
                  onClick={handleNumberInputClick('targetSaleWeightKg')}
                  onFocus={handleNumberInputFocus}
                  onChange={(e) => {
                    setTouchedFields((prev) => ({ ...prev, targetSaleWeightKg: true }));
                    form.setValue('targetSaleWeightKg', e.target.value);
                  }}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold"
                />
                {form.values.targetSaleWeightKg && (
                  <button
                    type="button"
                    onClick={() => form.setValue('targetSaleWeightKg', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                    title="Clear number"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
          </div>

          <Field label="Target Duration to Market" required error={form.errors.targetDurationValue}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={1}
                  value={form.values.targetDurationValue}
                  placeholder="e.g. 6"
                  onClick={handleNumberInputClick('targetDurationValue')}
                  onFocus={handleNumberInputFocus}
                  onChange={(e) => {
                    setTouchedFields((prev) => ({ ...prev, targetDurationValue: true }));
                    form.setValue('targetDurationValue', e.target.value);
                  }}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold text-center"
                />
                {form.values.targetDurationValue && (
                  <button
                    type="button"
                    onClick={() => form.setValue('targetDurationValue', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                    title="Clear number"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={form.values.targetDurationUnit}
                onChange={(e) => form.setValue('targetDurationUnit', e.target.value as DurationUnit)}
                className="w-32 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
              >
                <option value="DAYS">Days</option>
                <option value="WEEKS">Weeks</option>
                <option value="MONTHS">Months</option>
              </select>
            </div>
          </Field>

          {/* Automatic Live Detection Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-amber-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-800 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60 dark:border-emerald-800/60">
              <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Real-Time Livestock Intelligence</span>
              </span>
              <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                {elapsedDays === 0 ? 'Moved In Today' : `${elapsedDays}d on Farm`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Detected Age:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {detectedAgeDays} Days Old{' '}
                  {detectedAgeDays >= 7 ? `(${Math.floor(detectedAgeDays / 7)}w ${detectedAgeDays % 7}d)` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Days Left to Sale:</span>
                <span
                  className={`font-bold text-xs ${daysLeft <= 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : daysLeft <= 7
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                >
                  {daysLeft <= 0 ? 'Ready for Market Today' : `${daysLeft} Days Left`}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[11px] space-y-1">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Target Market Date: </span>
                <strong className="text-slate-800 dark:text-slate-200">{targetSaleDateString}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Current Protocol Stage: </span>
                {currentProtocolStage ? (
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    Day {currentProtocolStage.dayTarget}: {currentProtocolStage.title}
                  </strong>
                ) : (
                  <span className="text-slate-500 italic">Pre-protocol arrival setup</span>
                )}
              </div>
              {nextProtocolStage && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Next Upcoming Action: </span>
                  <span className="text-amber-800 dark:text-amber-300 font-semibold">
                    Day {nextProtocolStage.dayTarget}: {nextProtocolStage.title} (in{' '}
                    {Math.max(1, nextProtocolStage.dayTarget - detectedAgeDays)} days)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Protocol Management & Flexible CRUD */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Checkpoint Schedule</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  {checkpoints.length} {checkpoints.length === 1 ? 'stage' : 'stages'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pick a template or start from scratch. Edit or delete any step.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTemplateChange('SCRATCH')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
              >
                Start from Scratch
              </button>
              <button
                type="button"
                onClick={() => {
                  const key = STANDARD_SPECIES.includes(selectedSpeciesOption)
                    ? selectedSpeciesOption
                    : 'Broilers';
                  handleTemplateChange(key);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
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
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
            >
              {Object.entries(DEFAULT_PROTOCOL_TEMPLATES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.name} ({t.checkpoints.length} stages)
                </option>
              ))}
              <option value="SCRATCH">Start from Scratch (Blank Schedule)</option>
            </select>
          </div>

          {/* Checkpoint list */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {checkpoints.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <Layers className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  No checkpoints defined yet. Build your custom farm schedule from scratch!
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCheckpoint(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Checkpoint</span>
                </button>
              </div>
            ) : (
              checkpoints.map((cp) => {
                const isPast = detectedAgeDays > cp.dayTarget;
                const isToday = detectedAgeDays === cp.dayTarget;
                const isUpcoming = detectedAgeDays < cp.dayTarget;
                const isEditing = editingCheckpointId === cp.id;

                if (isEditing) {
                  return (
                    <div
                      key={cp.id}
                      className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-amber-950 dark:text-amber-200">
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
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Day Target
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editDayTarget}
                            onChange={(e) => setEditDayTarget(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Category
                          </label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as CheckpointCategory)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
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
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Stage Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="e.g. Day 14: Week 2 Weight & IBD Vaccine"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Target Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            placeholder="e.g. 0.48"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Feed Phase
                          </label>
                          <input
                            type="text"
                            value={editFeedPhase}
                            onChange={(e) => setEditFeedPhase(e.target.value)}
                            placeholder="e.g. Grower Pellets"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Instructions / Note
                        </label>
                        <input
                          type="text"
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          placeholder="Instructions for team..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
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
                    className={`p-2.5 rounded-xl border transition-colors flex items-start justify-between gap-2 text-xs ${isToday
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700'
                      : isPast
                        ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          Day {cp.dayTarget}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${cp.category === 'VACCINE'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                            : cp.category === 'FEED_TRANSITION'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                              : cp.category === 'WEIGHT_CHECK'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                        >
                          {formatCheckpointCategory(cp.category)}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> Due Today!
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Past Stage
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            (in {cp.dayTarget - detectedAgeDays}d)
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {cp.title}
                      </div>

                      {(cp.feedPhase || cp.targetWeightKg) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {cp.targetWeightKg ? `Target: ${cp.targetWeightKg}kg · ` : ''}
                          {cp.feedPhase || ''}
                        </div>
                      )}

                      {(cp.instructions || cp.description) && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {cp.instructions || cp.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Edit stage"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckpoint(cp.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
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

          {/* Add custom checkpoint button or form */}
          {!showAddCheckpoint ? (
            <button
              type="button"
              onClick={() => setShowAddCheckpoint(true)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Checkpoint</span>
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-950 dark:text-emerald-200">
                <span>Add Custom Checkpoint</span>
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
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Target Day <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newDayTarget}
                    onChange={(e) => setNewDayTarget(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CheckpointCategory)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
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
                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Stage Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Day 10: IBD 1st Dose Vaccination"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Target Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="e.g. 0.35"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Feed Phase
                  </label>
                  <input
                    type="text"
                    value={newFeedPhase}
                    onChange={(e) => setNewFeedPhase(e.target.value)}
                    placeholder="e.g. Grower Mash"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Instructions / Protocol Details
                </label>
                <textarea
                  rows={2}
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Administer in clean chlorine-free water..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
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
                  className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                >
                  Add Stage
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Purchase Cost & Left Money Funding Guard */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
              Total Purchase Cost (USD)
            </label>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
              <span className="text-slate-400">Available Left Money:</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(currentLeftMoney)}</span>
            </div>
          </div>

          <MoneyInput
            value={form.values.purchaseCost}
            onChange={(val) => form.setValue('purchaseCost', val)}
            placeholder="0.00"
          />

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            All animal purchases are automatically funded from available Left Money.
          </p>

          {/* Insufficient Funds Blocking Alert */}
          {isOverBudget && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Insufficient Left Money Balance!</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium pl-5">
                Purchase cost of {formatMoney(costNumber)} exceeds available cash ({formatMoney(currentLeftMoney)}).
                No payment or livestock registration can be performed until capital is deposited into the pool.
              </p>
            </div>
          )}
        </div>

        {/* Section 5: Mandatory Notes & Arrival Photo */}
        <div className="space-y-3">
          <Field
            label="Mandatory Audit Notes"
            required
            error={form.errors.notes}
            hint="Minimum 4 characters."
          >
            <textarea
              rows={2}
              value={form.values.notes}
              onChange={(e) => form.setValue('notes', e.target.value)}
              placeholder="e.g. Delivered 100 healthy day-old chicks directly from hatchery"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <div>
            <button
              type="button"
              onClick={handleCapturePhoto}
              className="w-full py-2.5 px-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>📷</span>
              <span>{photoUrl ? 'Replace Batch Photo' : 'Attach Batch Arrival Photo'}</span>
            </button>
            {photoUrl && (
              <div className="mt-2 relative rounded-lg overflow-hidden h-28 border border-slate-200 dark:border-slate-700">
                <img src={photoUrl} alt="Batch verification" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
    </FormSheet>
  );
};
