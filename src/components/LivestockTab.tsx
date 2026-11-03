import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  MinusCircle,
  PlusCircle,
  Syringe,
  DollarSign,
  Scale,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  X,
  TrendingUp,
  Camera,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Bell,
  Radio,
  Send,
  Calendar,
  Pencil,
  Trash2,
  Wheat,
  ClipboardList,
  Utensils,
  Scissors,
} from 'lucide-react';
import { LivestockGrowthCharts } from './LivestockGrowthCharts.tsx';
import { RecipeBuilderModal } from './RecipeBuilderModal.tsx';
import type {
  AnimalCheckpoint,
  CheckpointCategory,
  DurationUnit,
  FarmLocation,
  FarmRecipeTemplate,
  LivestockComputedStatus,
  LivestockEntry,
  LivestockLifecycleEvent,
  MemberEquitySummary,
  OrgMember,
  TrackingMode,
} from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { computeDividendDistribution } from '../utils/calculations.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';

const SPECIES_PRESETS = [
  { id: 'Broilers', name: 'Broilers', emoji: '🐔', cycle: 'Meat Birds (Customizable Days)' },
  { id: 'Layers', name: 'Layers', emoji: '🥚', cycle: 'Egg Production (Customizable Cycle)' },
  { id: 'Boer Goats', name: 'Boer Goats', emoji: '🐐', cycle: 'Stud / Commercial Meat' },
  { id: 'Indigenous Goats', name: 'Indigenous Goats', emoji: '🐐', cycle: 'Hardy Local Breed' },
  { id: 'Cattle', name: 'Cattle', emoji: '🐄', cycle: 'Beef / Dairy Cycle' },
  { id: 'Sheep', name: 'Sheep', emoji: '🐑', cycle: 'Dorper / Meat Breed' },
  { id: 'Pigs', name: 'Pigs / Swine', emoji: '🐖', cycle: 'Pork Production Cycle' },
  { id: 'Zebras', name: 'Zebras', emoji: '🦓', cycle: 'Game & Wildlife Management' },
  { id: 'Ostriches', name: 'Ostriches', emoji: '🪶', cycle: 'Feathers & Game Meat' },
  { id: 'Rabbits', name: 'Rabbits', emoji: '🐇', cycle: 'Micro-Livestock Breeding' },
  { id: 'CUSTOM', name: 'Custom Species', emoji: '✨', cycle: 'Custom Duration & Parameters' },
];

interface LivestockTabProps {
  livestockStatuses: LivestockComputedStatus[];
  locations: FarmLocation[];
  selectedLocationId: string;
  activeMember: OrgMember;
  memberEquities: MemberEquitySummary[];
  onRegisterLivestock: (data: {
    locationId: string;
    species: string;
    nameOrTag: string;
    trackingMode: TrackingMode;
    entryDate: string;
    initialAgeValue: number;
    initialAgeUnit: DurationUnit;
    targetDurationValue: number;
    targetDurationUnit: DurationUnit;
    initialHeadcount: number;
    purchaseCostTotal: number;
    targetSaleWeightKg?: number;
    notes: string;
    autoDeductPurchaseFromLeftMoney: boolean;
    imageUrl?: string;
    gallery?: string[];
    customCheckpoints?: AnimalCheckpoint[];
    fundingSource?: 'CASH_POOL' | 'SUPPLIER_CREDIT' | 'DIRECTOR_LOAN';
    supplierCreditorName?: string;
    supplierCreditDueDate?: string;
    configuredSalePricePerUnit?: number;
    configuredSalePricePerKg?: number;
  }) => void;
  customRecipes?: FarmRecipeTemplate[];
  leftMoney?: number;
  onLogLifecycleEvent: (data: {
    livestockId: string;
    eventType: LivestockLifecycleEvent['eventType'];
    headcountDelta: number;
    weightAvgKg?: number;
    saleRevenueAmount?: number;
    reinvestmentPercentage?: number;
    referenceTransactionId?: string;
    note: string;
    photoUrl?: string;
  }) => void;
  onAddLivestockPhoto?: (livestockId: string, photoUrl: string, caption?: string) => void;
  onBroadcastMilestone?: (data: {
    livestockId: string;
    dayTarget: number;
    milestoneTitle: string;
    customNote?: string;
  }) => void;
  showNumbers?: boolean;
}

export const LivestockTab: React.FC<LivestockTabProps> = ({
  livestockStatuses,
  locations,
  selectedLocationId,
  activeMember,
  memberEquities,
  onRegisterLivestock,
  onLogLifecycleEvent,
  onAddLivestockPhoto,
  onBroadcastMilestone,
  customRecipes = [],
  leftMoney = 0,
  showNumbers = true,
}) => {
  const [speciesFilter, setSpeciesFilter] = useState('All');
  const [expandedProtocolsId, setExpandedProtocolsId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Register New Animal / Batch Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [regCustomCheckpoints, setRegCustomCheckpoints] = useState<AnimalCheckpoint[]>([]);
  const [regLocationId, setRegLocationId] = useState(
    selectedLocationId !== 'ALL'
      ? selectedLocationId
      : activeMember.assignedLocationId || locations[0]?.id || ''
  );
  const [regSpecies, setRegSpecies] = useState('Broilers');
  const [customSpeciesName, setCustomSpeciesName] = useState('');
  const [regNameOrTag, setRegNameOrTag] = useState('');
  const [regMode, setRegMode] = useState<TrackingMode>('BATCH');
  const [regHeadcount, setRegHeadcount] = useState('100');
  const [regMoveInDate, setRegMoveInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [regInitialAgeVal, setRegInitialAgeVal] = useState('1');
  const [regInitialAgeUnit, setRegInitialAgeUnit] = useState<DurationUnit>('DAYS');
  const [regTargetDurVal, setRegTargetDurVal] = useState('42');
  const [regTargetDurUnit, setRegTargetDurUnit] = useState<DurationUnit>('DAYS');
  const [regCost, setRegCost] = useState('95');
  const [regFundingSource, setRegFundingSource] = useState<'CASH_POOL' | 'SUPPLIER_CREDIT'>('CASH_POOL');
  const [regCreditorName, setRegCreditorName] = useState("Irvine's Hatcheries");
  const [regCreditorDueDate, setRegCreditorDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [regSalePriceUnit, setRegSalePriceUnit] = useState('6.00');
  const [regSalePriceKg, setRegSalePriceKg] = useState('');
  const [regTargetWeight, setRegTargetWeight] = useState('2.2');
  const [regAutoExpense, setRegAutoExpense] = useState(true);
  const [regNotes, setRegNotes] = useState('');
  const [regError, setRegError] = useState('');
  const [broadcastSuccessId, setBroadcastSuccessId] = useState<string | null>(null);

  // Active Livestock Checkpoint CRUD State
  const canManageCustom = PERMISSIONS.canManageCustomRecipes(activeMember.role);
  const [activeCheckpointModal, setActiveCheckpointModal] = useState<{
    livestockId: string;
    batchName: string;
    checkpointToEdit?: AnimalCheckpoint | null;
  } | null>(null);
  const [cpDay, setCpDay] = useState<number>(7);
  const [cpDate, setCpDate] = useState<string>('');
  const [cpTitle, setCpTitle] = useState('');
  const [cpCategory, setCpCategory] = useState<CheckpointCategory>('VACCINE');
  const [cpWeight, setCpWeight] = useState<string>('');
  const [cpFeed, setCpFeed] = useState('');
  const [cpInstructions, setCpInstructions] = useState('');
  const [cpError, setCpError] = useState('');

  const handleOpenAddCheckpoint = (entry: LivestockEntry) => {
    setActiveCheckpointModal({
      livestockId: entry.id,
      batchName: entry.nameOrTag,
      checkpointToEdit: null,
    });
    setCpDay(7);
    setCpDate('');
    setCpTitle('');
    setCpCategory('VACCINE');
    setCpWeight('');
    setCpFeed('');
    setCpInstructions('');
    setCpError('');
  };

  const handleOpenEditCheckpoint = (
    entry: LivestockEntry,
    cp: {
      id: string;
      dayTarget: number;
      scheduledDate?: string;
      title: string;
      category: CheckpointCategory;
      targetWeightKg?: number;
      feedPhase?: string;
      description?: string;
    }
  ) => {
    setActiveCheckpointModal({
      livestockId: entry.id,
      batchName: entry.nameOrTag,
      checkpointToEdit: {
        id: cp.id,
        dayTarget: cp.dayTarget,
        scheduledDate: cp.scheduledDate,
        title: cp.title,
        category: cp.category,
        targetWeightKg: cp.targetWeightKg,
        feedPhase: cp.feedPhase,
        instructions: cp.description,
        completed: false,
        reminderStatus: 'SCHEDULED',
      },
    });
    setCpDay(cp.dayTarget);
    setCpDate(cp.scheduledDate || '');
    setCpTitle(cp.title);
    setCpCategory(cp.category);
    setCpWeight(cp.targetWeightKg ? String(cp.targetWeightKg) : '');
    setCpFeed(cp.feedPhase || '');
    setCpInstructions(cp.description || '');
    setCpError('');
  };

  const handleSaveActiveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckpointModal) return;
    if (!cpTitle.trim()) {
      setCpError('Checkpoint title is required.');
      return;
    }
    setCpError('');
    try {
      if (activeCheckpointModal.checkpointToEdit) {
        dataService.updateLivestockCheckpoint({
          livestockId: activeCheckpointModal.livestockId,
          checkpointId: activeCheckpointModal.checkpointToEdit.id,
          updates: {
            dayTarget: Number(cpDay) || 1,
            scheduledDate: cpDate || undefined,
            title: cpTitle.trim(),
            category: cpCategory,
            targetWeightKg: cpWeight ? Number(cpWeight) : undefined,
            feedPhase: cpFeed.trim() || undefined,
            instructions: cpInstructions.trim() || undefined,
          },
          actor: activeMember,
        });
      } else {
        dataService.addCheckpointToLivestock({
          livestockId: activeCheckpointModal.livestockId,
          checkpoint: {
            dayTarget: Number(cpDay) || 1,
            scheduledDate: cpDate || undefined,
            title: cpTitle.trim(),
            category: cpCategory,
            targetWeightKg: cpWeight ? Number(cpWeight) : undefined,
            feedPhase: cpFeed.trim() || undefined,
            instructions: cpInstructions.trim() || undefined,
          },
          actor: activeMember,
        });
      }
      setActiveCheckpointModal(null);
    } catch (err: unknown) {
      setCpError(err instanceof Error ? err.message : 'Failed to save checkpoint.');
    }
  };

  const handleDeleteActiveCheckpoint = (livestockId: string, checkpointId: string) => {
    if (!window.confirm('Are you sure you want to delete this checkpoint from this batch?')) return;
    try {
      dataService.deleteLivestockCheckpoint({
        livestockId,
        checkpointId,
        actor: activeMember,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete checkpoint.');
    }
  };

  // Ground Photo & Gallery State
  const regFileInputRef = useRef<HTMLInputElement>(null);
  const evFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const [regImage, setRegImage] = useState<string | null>(null);
  const [evPhoto, setEvPhoto] = useState<string | null>(null);
  const [galleryTarget, setGalleryTarget] = useState<LivestockComputedStatus | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const [newGalleryPhoto, setNewGalleryPhoto] = useState<string | null>(null);
  const [newGalleryCaption, setNewGalleryCaption] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Quick Direct Feed Log Modal State
  const [feedModalStatus, setFeedModalStatus] = useState<LivestockComputedStatus | null>(null);
  const [feedKg, setFeedKg] = useState('');
  const [feedType, setFeedType] = useState('Standard Feed');
  const [feedNote, setFeedNote] = useState('');
  const [feedError, setFeedError] = useState('');
  const [feedSuccess, setFeedSuccess] = useState('');

  // Dedicated Checkpoints Modal State
  const [selectedCheckpointsStatus, setSelectedCheckpointsStatus] = useState<LivestockComputedStatus | null>(null);

  const handlePhotoFileChange = async (
    file: File | undefined,
    targetSetter: (url: string | null) => void
  ) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error || 'Invalid image file.');
      return;
    }
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
      targetSetter(compressed);
    } catch (err) {
      console.error('Failed to compress photo:', err);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Recharts Growth Telemetry Chart Toggle State
  const [showGrowthCharts, setShowGrowthCharts] = useState(true);

  // Lifecycle Action Modal State
  const [activeActionModal, setActiveActionModal] = useState<{
    status: LivestockComputedStatus;
    mode:
    | 'MORTALITY_LOSS'
    | 'BIRTH_OFFSPRING'
    | 'VACCINATION_HEALTH'
    | 'SALE_DISPATCH'
    | 'SLAUGHTER_HARVEST'
    | 'FARM_CONSUMPTION'
    | 'HEADCOUNT_CONTRA_ADJUSTMENT'
    | 'WEIGHT_CHECK';
  } | null>(null);

  const [evQuantity, setEvQuantity] = useState('1');
  const [evWeightKg, setEvWeightKg] = useState('');
  const [evSaleRevenue, setEvSaleRevenue] = useState('450');
  const [evReinvestPct, setEvReinvestPct] = useState(60);
  const [evReferenceId, setEvReferenceId] = useState('');
  const [evContraSign, setEvContraSign] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [evNote, setEvNote] = useState('');
  const [evError, setEvError] = useState('');

  // Dynamically derive species filter badges from actual herd inventory
  const availableSpeciesFilters = useMemo(() => {
    const present = new Set<string>();
    livestockStatuses.forEach((s) => {
      if (s.entry.species && s.entry.species.trim()) {
        present.add(s.entry.species.trim());
      }
    });

    if (present.size === 0) {
      return ['All', 'Broilers', 'Boer Goats', 'Indigenous Goats', 'Cattle', 'Layers', 'Pigs', 'Zebras'];
    }

    return ['All', ...Array.from(present)];
  }, [livestockStatuses]);

  // Reset filter to 'All' if the filtered species no longer exists
  useEffect(() => {
    if (speciesFilter !== 'All' && !availableSpeciesFilters.includes(speciesFilter)) {
      setSpeciesFilter('All');
    }
  }, [availableSpeciesFilters, speciesFilter]);

  const filteredStatuses = useMemo(() => {
    return livestockStatuses.filter((s) => {
      if (speciesFilter === 'All') return true;
      return s.entry.species.toLowerCase() === speciesFilter.toLowerCase();
    });
  }, [livestockStatuses, speciesFilter]);

  // Intelligent preset autofill for species
  const handleSpeciesChange = (species: string) => {
    setRegSpecies(species);
    setCustomSpeciesName(species === 'CUSTOM' ? '' : species);
    if (species === 'Broilers') {
      setRegHeadcount('100');
      setRegMode('BATCH');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('DAYS');
      setRegTargetDurVal('42');
      setRegTargetDurUnit('DAYS');
      setRegCost('95');
      setRegTargetWeight('2.2');
    } else if (species === 'Layers') {
      setRegHeadcount('100');
      setRegMode('BATCH');
      setRegInitialAgeVal('18');
      setRegInitialAgeUnit('WEEKS');
      setRegTargetDurVal('72');
      setRegTargetDurUnit('WEEKS');
      setRegCost('850');
      setRegTargetWeight('1.9');
    } else if (species === 'Boer Goats' || species === 'Indigenous Goats' || species === 'Sheep') {
      setRegHeadcount('10');
      setRegMode('BATCH');
      setRegInitialAgeVal('3');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('8');
      setRegTargetDurUnit('MONTHS');
      setRegCost('650');
      setRegTargetWeight('45');
    } else if (species === 'Cattle') {
      setRegHeadcount('5');
      setRegMode('INDIVIDUAL_TAG');
      setRegInitialAgeVal('6');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('18');
      setRegTargetDurUnit('MONTHS');
      setRegCost('2200');
      setRegTargetWeight('450');
    } else if (species === 'Pigs') {
      setRegHeadcount('10');
      setRegMode('BATCH');
      setRegInitialAgeVal('2');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('6');
      setRegTargetDurUnit('MONTHS');
      setRegCost('400');
      setRegTargetWeight('90');
    } else if (species === 'Zebras') {
      setRegHeadcount('2');
      setRegMode('BATCH');
      setRegInitialAgeVal('12');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('24');
      setRegTargetDurUnit('MONTHS');
      setRegCost('3200');
      setRegTargetWeight('300');
    } else if (species === 'Ostriches') {
      setRegHeadcount('4');
      setRegMode('BATCH');
      setRegInitialAgeVal('3');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('12');
      setRegTargetDurUnit('MONTHS');
      setRegCost('1200');
      setRegTargetWeight('105');
    } else if (species === 'Rabbits') {
      setRegHeadcount('20');
      setRegMode('BATCH');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('4');
      setRegTargetDurUnit('MONTHS');
      setRegCost('150');
      setRegTargetWeight('2.8');
    } else if (species === 'CUSTOM') {
      setRegHeadcount('10');
      setRegInitialAgeVal('1');
      setRegInitialAgeUnit('MONTHS');
      setRegTargetDurVal('12');
      setRegTargetDurUnit('MONTHS');
      setRegCost('500');
      setRegTargetWeight('50');
    }
  };

  const handleOpenActionModal = (
    status: LivestockComputedStatus,
    mode:
      | 'MORTALITY_LOSS'
      | 'BIRTH_OFFSPRING'
      | 'VACCINATION_HEALTH'
      | 'SALE_DISPATCH'
      | 'SLAUGHTER_HARVEST'
      | 'FARM_CONSUMPTION'
      | 'HEADCOUNT_CONTRA_ADJUSTMENT'
      | 'WEIGHT_CHECK'
  ) => {
    setActiveActionModal({ status, mode });
    setEvQuantity(mode === 'WEIGHT_CHECK' ? '0' : '1');
    setEvWeightKg(status.latestWeightAvgKg ? String(status.latestWeightAvgKg) : '');
    setEvSaleRevenue('600');
    setEvReinvestPct(50);
    setEvReferenceId(status.lifecycleEvents[0]?.id || status.entry.id);
    setEvContraSign('ADD');
    setEvNote(mode === 'WEIGHT_CHECK' ? 'Routine sample weigh-in and growth trajectory verification.' : '');
    setEvPhoto(null);
    setEvError('');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSpecies = customSpeciesName.trim() || regSpecies;
    if (!finalSpecies) {
      setRegError('Please enter a species/category name (e.g. Layers 50-Week, Broilers, Boer Goats).');
      return;
    }
    if (!regNameOrTag.trim() || regNotes.trim().length < 4) {
      setRegError('Please provide a Batch/Ear-Tag name and mandatory notes (min 4 chars).');
      return;
    }
    const targetLocId = regLocationId || locations[0]?.id;
    if (!targetLocId) {
      setRegError('Please register a farm site location first before adding livestock.');
      return;
    }
    const hc = Math.max(1, parseInt(regHeadcount, 10) || 1);
    const cost = Math.max(0, parseFloat(regCost) || 0);
    try {
      onRegisterLivestock({
        locationId: targetLocId,
        species: finalSpecies,
        nameOrTag: regNameOrTag.trim(),
        trackingMode: regMode,
        entryDate: regMoveInDate ? new Date(`${regMoveInDate}T07:00:00`).toISOString() : new Date().toISOString(),
        initialAgeValue: 0,
        initialAgeUnit: 'DAYS',
        targetDurationValue: Math.max(1, parseFloat(regTargetDurVal) || 1),
        targetDurationUnit: regTargetDurUnit,
        initialHeadcount: regMode === 'INDIVIDUAL_TAG' ? 1 : hc,
        purchaseCostTotal: cost,
        targetSaleWeightKg: parseFloat(regTargetWeight) || undefined,
        notes: regNotes.trim(),
        autoDeductPurchaseFromLeftMoney: regFundingSource === 'CASH_POOL' && regAutoExpense,
        fundingSource: regFundingSource,
        supplierCreditorName: regFundingSource === 'SUPPLIER_CREDIT' ? regCreditorName.trim() : undefined,
        supplierCreditDueDate: regFundingSource === 'SUPPLIER_CREDIT' ? regCreditorDueDate : undefined,
        configuredSalePricePerUnit: parseFloat(regSalePriceUnit) || undefined,
        configuredSalePricePerKg: parseFloat(regSalePriceKg) || undefined,
        imageUrl: regImage || undefined,
        gallery: regImage ? [regImage] : [],
        customCheckpoints: regCustomCheckpoints.length > 0 ? regCustomCheckpoints : undefined,
      });
      setRegNameOrTag('');
      setCustomSpeciesName('');
      setRegNotes('');
      setRegMoveInDate(new Date().toISOString().split('T')[0]);
      setRegImage(null);
      setRegCustomCheckpoints([]);
      setRegError('');
      setShowRegisterModal(false);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Failed to register livestock.');
    }
  };

  const handleDirectFeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedModalStatus) return;
    const kg = parseFloat(feedKg);
    if (isNaN(kg) || kg <= 0) {
      setFeedError('Please enter a valid feed weight in kilograms (greater than 0).');
      return;
    }
    try {
      dataService.logBatchDirectFeed({
        livestockId: feedModalStatus.entry.id,
        locationId: feedModalStatus.entry.locationId,
        kgConsumed: kg,
        feedType: feedType.trim() || 'Standard Feed',
        note: feedNote.trim() || `Direct ground feeding: ${kg} kg ${feedType.trim() || 'feed'} logged`,
        actor: activeMember,
      });
      setFeedSuccess(`Successfully logged ${kg} kg feed consumed!`);
      setTimeout(() => {
        setFeedModalStatus(null);
        setFeedSuccess('');
        setFeedError('');
      }, 1000);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Failed to log feed.');
    }
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionModal) return;
    if (evNote.trim().length < 4) {
      setEvError('Mandatory explanation note (min 4 characters) is required for immutable audit trail.');
      return;
    }

    const { status, mode } = activeActionModal;
    const rawQty = Math.max(0, parseInt(evQuantity, 10) || 0);
    let headcountDelta = 0;

    if (mode === 'WEIGHT_CHECK') {
      const w = parseFloat(evWeightKg);
      if (isNaN(w) || w <= 0) {
        setEvError('Please enter a valid positive weight in kilograms.');
        return;
      }
      headcountDelta = 0;
    } else if (mode === 'MORTALITY_LOSS' || mode === 'SALE_DISPATCH' || mode === 'SLAUGHTER_HARVEST' || mode === 'FARM_CONSUMPTION') {
      if (rawQty <= 0 || rawQty > status.currentLiveHeadcount) {
        setEvError(
          `Quantity must be between 1 and current live headcount (${status.currentLiveHeadcount}).`
        );
        return;
      }
      headcountDelta = -rawQty;
    } else if (mode === 'BIRTH_OFFSPRING') {
      if (rawQty <= 0) {
        setEvError('Offspring count must be at least 1.');
        return;
      }
      headcountDelta = rawQty;
    } else if (mode === 'HEADCOUNT_CONTRA_ADJUSTMENT') {
      if (rawQty <= 0) {
        setEvError('Adjustment quantity delta must be at least 1.');
        return;
      }
      headcountDelta = evContraSign === 'ADD' ? rawQty : -rawQty;
    } else {
      headcountDelta = 0;
    }

    try {
      onLogLifecycleEvent({
        livestockId: status.entry.id,
        eventType: mode,
        headcountDelta,
        weightAvgKg: evWeightKg ? parseFloat(evWeightKg) : undefined,
        saleRevenueAmount: mode === 'SALE_DISPATCH' ? Math.max(0, parseFloat(evSaleRevenue) || 0) : undefined,
        reinvestmentPercentage: mode === 'SALE_DISPATCH' ? evReinvestPct : undefined,
        referenceTransactionId:
          mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' ? evReferenceId || status.entry.id : undefined,
        note: evNote.trim(),
        photoUrl: evPhoto || undefined,
      });

      setEvPhoto(null);
      setActiveActionModal(null);
    } catch (err) {
      setEvError(err instanceof Error ? err.message : 'Failed to log lifecycle event.');
    }
  };

  const handleAddNewGalleryPhoto = () => {
    if (!galleryTarget || !newGalleryPhoto) return;
    const caption = newGalleryCaption.trim() || `Ground progress photo for ${galleryTarget.entry.nameOrTag}`;
    if (onAddLivestockPhoto) {
      onAddLivestockPhoto(galleryTarget.entry.id, newGalleryPhoto, caption);
    } else {
      onLogLifecycleEvent({
        livestockId: galleryTarget.entry.id,
        eventType: 'PHOTO_PROGRESS',
        headcountDelta: 0,
        note: caption,
        photoUrl: newGalleryPhoto,
      });
    }
    setNewGalleryPhoto(null);
    setNewGalleryCaption('');
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar: Species Filters + Chart Toggle + Register Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
          {availableSpeciesFilters.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSpeciesFilter(sp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${speciesFilter === sp
                ? 'tab-brand-active'
                : 'tab-brand-inactive'
                }`}
            >
              {sp}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGrowthCharts(!showGrowthCharts)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${showGrowthCharts
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950'
              : 'bg-[#FAF8F5] hover:bg-[#F0EBE1] text-slate-700 border border-[#E8DFCE] shadow-sm'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {showGrowthCharts ? 'Hide Growth Charts' : 'Show Growth Charts'}
          </button>

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-emerald-950 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Animal / Batch
          </button>
        </div>
      </div>

      {/* Biological Growth Projection & Recharts Telemetry Section */}
      {showGrowthCharts && livestockStatuses.length > 0 && (
        <LivestockGrowthCharts
          livestockStatuses={livestockStatuses}
          selectedLocationId={selectedLocationId}
          onOpenWeightCheckModal={(status) => handleOpenActionModal(status, 'WEIGHT_CHECK')}
          onBroadcastMilestone={onBroadcastMilestone}
          showNumbers={showNumbers}
        />
      )}

      {/* Livestock Cards */}
      {filteredStatuses.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-white">No livestock batches match this filter</p>
          <p className="text-xs text-slate-400">
            Register a new animal batch or individual ear-tag to start live age & market countdown tracking.
          </p>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-colors cursor-pointer"
          >
            + Register First Animal / Batch
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStatuses.map((status) => {
            const isUrgent = status.countdownUrgency === 'READY_FOR_SALE';
            const isWarn = status.countdownUrgency === 'PREPARE_MARKET';
            const isProtocolsOpen = expandedProtocolsId === status.entry.id;
            const isHistoryOpen = expandedHistoryId === status.entry.id;
            const completedProtocols = status.protocols.filter((p) => p.completed).length;

            return (
              <article
                key={status.entry.id}
                className="rounded-3xl bg-white border border-[#E8DFCE] p-4 sm:p-5 space-y-4 shadow-sm text-slate-950"
              >
                {/* Header & Live Countdown */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-emerald-700 font-bold">{status.entry.species}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium">{status.entry.locationName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono whitespace-nowrap">
                        {status.entry.trackingMode === 'INDIVIDUAL_TAG'
                          ? 'Individual Ear-Tag'
                          : 'Batch Tracking'}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-slate-950 mt-0.5">
                      {status.entry.nameOrTag}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">{status.entry.notes}</p>
                  </div>

                  {/* Countdown Status Text */}
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono ${isUrgent
                        ? 'text-rose-600'
                        : isWarn
                          ? 'text-amber-600'
                          : 'text-emerald-700'
                        }`}
                    >
                      {isUrgent ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isWarn ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {status.countdownBadgeText}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Target Sale Date: {new Date(status.entry.targetSaleDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Ground Visual Gallery Strip */}
                {Boolean(
                  status.entry.imageUrl ||
                  (status.entry.gallery && status.entry.gallery.length > 0) ||
                  status.lifecycleEvents.some((e) => e.photoUrl)
                ) && (
                    <div className="pt-1 pb-1">
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                        <span className="flex items-center gap-1.5 font-bold text-amber-800">
                          <Camera className="w-3.5 h-3.5 text-amber-600" />
                          Live Ground Evidence &amp; Progress Photos
                        </span>
                        <button
                          type="button"
                          onClick={() => setGalleryTarget(status)}
                          className="text-[11px] text-amber-700 hover:text-amber-800 font-bold underline cursor-pointer"
                        >
                          Open Full Gallery
                        </button>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {Array.from(
                          new Set([
                            ...(status.entry.imageUrl ? [status.entry.imageUrl] : []),
                            ...(status.entry.gallery || []),
                            ...(status.lifecycleEvents.map((e) => e.photoUrl).filter(Boolean) as string[]),
                          ])
                        )
                          .slice(0, 6)
                          .map((imgUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: imgUrl,
                                  caption: `${status.entry.nameOrTag} · Photo #${idx + 1}`,
                                })
                              }
                              className="relative group shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-[#E8DFCE] hover:border-amber-500 transition-all cursor-pointer shadow-xs"
                            >
                              <img
                                src={imgUrl}
                                alt={`${status.entry.nameOrTag} ground photo`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                                <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setGalleryTarget(status)}
                          className="shrink-0 h-16 sm:h-20 px-3 rounded-2xl border border-dashed border-[#D5C7B0] hover:border-amber-500 bg-[#FAF8F5] hover:bg-[#F5EFE6] text-[11px] font-bold text-amber-800 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-amber-600" />
                          <span>+ Add Photo</span>
                        </button>
                      </div>
                    </div>
                  )}

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600">
                      Current Age:{' '}
                      <strong className="font-mono text-slate-950 font-bold">{!showNumbers ? '••••' : status.formattedCurrentAge}</strong>
                    </span>
                    <span className="font-mono text-slate-500">
                      {!showNumbers ? '••%' : `${status.progressPercentage}%`} of {!showNumbers ? '••' : status.entry.targetDurationValue}{' '}
                      {status.entry.targetDurationUnit.toLowerCase()} cycle
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 border border-slate-200/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-transform duration-200 ${isUrgent
                        ? 'bg-rose-500'
                        : isWarn
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                        }`}
                      style={{ width: `${status.progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* 5 Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-[#F0EBE1] text-xs">
                  <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <p className="text-[11px] text-slate-500 font-medium">Live Headcount</p>
                    <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                      {!showNumbers ? '••••' : status.currentLiveHeadcount}{' '}
                      <span className="text-slate-500 font-normal text-xs">
                        / {!showNumbers ? '••••' : `${status.entry.initialHeadcount} init`}
                      </span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <p className="text-[11px] text-slate-500 font-medium">Births / Offspring</p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      {!showNumbers ? '••••' : `+${status.totalBirths}`}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <p className="text-[11px] text-slate-500 font-medium">Mortality Rate</p>
                    <p className="font-mono font-bold text-amber-700 text-sm mt-0.5">
                      {!showNumbers ? '••%' : `${status.mortalityRatePercent}%`} ({!showNumbers ? '••' : status.totalMortalities} lost)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] relative group">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500 font-medium">Feed Consumed</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedModalStatus(status);
                          setFeedKg('');
                          setFeedType('Standard Feed');
                          setFeedNote('');
                          setFeedError('');
                          setFeedSuccess('');
                        }}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                      >
                        + Log
                      </button>
                    </div>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      {!showNumbers ? '••••••' : `${status.totalFeedConsumedKg} kg`}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <p className="text-[11px] text-slate-500 font-medium">Est. Herd Value</p>
                    <p className="font-mono font-bold text-slate-950 text-sm mt-0.5">
                      {!showNumbers ? '••••••••' : `$${status.estimatedCurrentValueUsd.toFixed(0)}`}
                    </p>
                  </div>
                </div>

                {/* Action Buttons Strip */}
                <div className="pt-2 border-t border-[#F0EBE1] flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedModalStatus(status);
                      setFeedKg('');
                      setFeedType('Standard Feed');
                      setFeedNote('');
                      setFeedError('');
                      setFeedSuccess('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-black text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Wheat className="w-4 h-4" />
                    Log Feed Consumed
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCheckpointsStatus(status)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4 text-emerald-700" />
                    View All Checkpoints ({completedProtocols}/{status.protocols.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setGalleryTarget(status)}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E8DFCE] text-xs font-semibold text-amber-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    Ground Gallery ({
                      new Set([
                        ...(status.entry.imageUrl ? [status.entry.imageUrl] : []),
                        ...(status.entry.gallery || []),
                        ...(status.lifecycleEvents.map((e) => e.photoUrl).filter(Boolean) as string[]),
                      ]).size
                    })
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'MORTALITY_LOSS')}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                    Log Mortality / Loss
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'BIRTH_OFFSPRING')}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Log Birth / Offspring
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'VACCINATION_HEALTH')}
                    className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-medium text-sky-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Syringe className="w-3.5 h-3.5 text-sky-600" />
                    Log Vaccine
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'WEIGHT_CHECK')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-slate-600" />
                    Weigh-In Check
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'SALE_DISPATCH')}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {activeMember.role === 'GROUND_OPERATOR'
                      ? 'Log Sale Dispatch & Cash'
                      : 'Log Sale & Distribute Profit'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'SLAUGHTER_HARVEST')}
                    className="px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-xs font-medium text-orange-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-orange-600" />
                    Slaughter / Harvest
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenActionModal(status, 'FARM_CONSUMPTION')}
                    className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-medium text-purple-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 text-purple-600" />
                    Internal / Farm Use
                  </button>

                  {PERMISSIONS.canPostContraReversals(activeMember.role) && (
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(status, 'HEADCOUNT_CONTRA_ADJUSTMENT')}
                      className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-medium text-amber-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5 text-amber-700" />
                      Post Contra-Adjustment
                    </button>
                  )}
                </div>

                {/* Collapsible Append-Only Event Log */}
                <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedHistoryId(isHistoryOpen ? null : status.entry.id)}
                    className="text-slate-600 hover:text-slate-900 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    {isHistoryOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-emerald-600" />
                    )}
                    Append-Only Event Log ({status.lifecycleEvents.length})
                  </button>
                </div>

                {isHistoryOpen && (
                  <div className="bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl p-3.5 space-y-2.5">
                    <p className="text-xs font-bold text-slate-800">
                      Immutable Lifecycle Ledger (Zero Edits / Zero Deletes)
                    </p>
                    <div className="divide-y divide-[#E8DFCE]">
                      {status.lifecycleEvents.map((ev) => (
                        <div key={ev.id} className="py-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                            <span>
                              <strong className="text-slate-800 font-mono">Ref #{ev.id.slice(-6).toUpperCase()}</strong> ·{' '}
                              <span className="text-emerald-700 capitalize font-medium">{ev.eventType.toLowerCase().replace(/_/g, ' ')}</span>
                              {ev.referenceTransactionId ? ` · Linked Ref #${ev.referenceTransactionId.slice(-6).toUpperCase()}` : ''}
                            </span>
                            <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-800">{ev.note}</p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Verified Log · By {ev.loggedByName}
                            </span>
                            <span
                              className={
                                ev.headcountDelta > 0
                                  ? 'text-emerald-700 font-bold'
                                  : ev.headcountDelta < 0
                                    ? 'text-rose-600 font-bold'
                                    : 'text-slate-700'
                              }
                            >
                              {!showNumbers ? '•••• hd' : `${ev.headcountDelta > 0 ? `+${ev.headcountDelta}` : ev.headcountDelta} hd`}
                              {typeof ev.saleRevenueAmount === 'number'
                                ? ` · Sale: ${!showNumbers ? '••••••••' : `+$${ev.saleRevenueAmount.toFixed(2)}`}`
                                : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* REGISTER NEW ANIMAL / BATCH MODAL */}
      {showRegisterModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-livestock-title"
        >
          <div className="modal-dialog-responsive max-w-lg p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="reg-livestock-title" className="text-base font-bold text-slate-900">
                Register New Livestock Batch or Individual Ear-Tag
              </h2>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {regError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {regError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-loc" className="block text-xs font-medium text-slate-300 mb-1">
                    Farm Location *
                  </label>
                  <select
                    id="reg-loc"
                    value={regLocationId}
                    onChange={(e) => setRegLocationId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70 cursor-pointer"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="reg-species" className="block text-xs font-medium text-slate-300">
                      Species / Category *
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {SPECIES_PRESETS.find((p) => p.id === regSpecies)?.cycle || 'Standard Cycle'}
                    </span>
                  </div>

                  {/* Modern Visual Quick-Select Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-2 no-scrollbar">
                    {SPECIES_PRESETS.map((p) => {
                      const isSelected = regSpecies === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSpeciesChange(p.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1 transition-all cursor-pointer border ${isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                            : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                            }`}
                        >
                          <span>{p.emoji}</span>
                          <span>{p.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <select
                      id="reg-species"
                      value={regSpecies}
                      onChange={(e) => handleSpeciesChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                    >
                      <optgroup label="Poultry">
                        <option value="Broilers">🐔 Broilers (Meat Birds — Customizable Days)</option>
                        <option value="Layers">🥚 Layers (Egg Production — Customizable Cycle)</option>
                      </optgroup>
                      <optgroup label="Livestock & Ruminants">
                        <option value="Boer Goats">🐐 Boer Goats (Stud / Commercial Meat)</option>
                        <option value="Indigenous Goats">🐐 Indigenous Goats (Hardy Breed)</option>
                        <option value="Cattle">🐄 Cattle (Beef / Dairy)</option>
                        <option value="Sheep">🐑 Sheep (Dorper / Meat)</option>
                        <option value="Pigs">🐖 Pigs / Swine</option>
                      </optgroup>
                      <optgroup label="Game, Wildlife & Equines">
                        <option value="Zebras">🦓 Zebras (Game / Wildlife)</option>
                        <option value="Ostriches">🪶 Ostriches (Game / Feathers)</option>
                      </optgroup>
                      <optgroup label="Micro-Livestock">
                        <option value="Rabbits">🐇 Rabbits (Meat / Breeding)</option>
                      </optgroup>
                      <optgroup label="Custom / Other">
                        <option value="CUSTOM">✨ + Other / Custom Species (Type Name)...</option>
                      </optgroup>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="mt-2.5">
                    <label htmlFor="reg-custom-species" className="block text-xs font-semibold text-emerald-400 mb-1">
                      Species / Category Name * (Customizable)
                    </label>
                    <input
                      id="reg-custom-species"
                      type="text"
                      required
                      placeholder="e.g. Layers (50-week), Lohmann Brown, Broilers, Boer Goats"
                      value={customSpeciesName}
                      onChange={(e) => setCustomSpeciesName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-mode" className="block text-xs font-medium text-slate-300 mb-1">
                    Tracking Mode
                  </label>
                  <select
                    id="reg-mode"
                    value={regMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as TrackingMode;
                      setRegMode(nextMode);
                      if (nextMode === 'INDIVIDUAL_TAG') setRegHeadcount('1');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70 cursor-pointer"
                  >
                    <option value="BATCH">Batch / Flock / Herd</option>
                    <option value="INDIVIDUAL_TAG">Individual Ear-Tag</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-hc" className="block text-xs font-medium text-slate-300 mb-1">
                    Initial Headcount *
                  </label>
                  <input
                    id="reg-hc"
                    type="number"
                    min="1"
                    disabled={regMode === 'INDIVIDUAL_TAG'}
                    value={regMode === 'INDIVIDUAL_TAG' ? '1' : regHeadcount}
                    onChange={(e) => setRegHeadcount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1">
                  Batch Name or Ear-Tag Identifier *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  placeholder="e.g. Broiler Batch #14 or Boer Stud Buck #ZW-22"
                  value={regNameOrTag}
                  onChange={(e) => setRegNameOrTag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                />
              </div>

              {/* Move-in Date & Target Duration Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-movein-date" className="block text-xs font-medium text-slate-300 mb-1">
                    Move-in / Arrival Date *
                  </label>
                  <input
                    id="reg-movein-date"
                    type="date"
                    required
                    value={regMoveInDate}
                    onChange={(e) => setRegMoveInDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Date animals arrived (pick today or past date for existing stock).
                  </p>
                </div>

                <div>
                  <label htmlFor="reg-target-dur" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Sale Duration (Days/Years) *
                  </label>
                  <div className="flex items-center rounded-xl overflow-hidden border border-slate-700 bg-slate-950 focus-within:ring-2 focus-within:ring-amber-500/70 focus-within:border-transparent transition-all">
                    <input
                      id="reg-target-dur"
                      type="number"
                      min="1"
                      value={regTargetDurVal}
                      onChange={(e) => setRegTargetDurVal(e.target.value)}
                      className="w-24 px-3 py-2.5 bg-transparent text-sm font-mono text-white border-r border-slate-800 focus:outline-none"
                    />
                    <select
                      aria-label="Target Duration Unit"
                      value={regTargetDurUnit}
                      onChange={(e) => setRegTargetDurUnit(e.target.value as DurationUnit)}
                      className="flex-1 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 text-xs font-semibold text-slate-200 border-none focus:outline-none cursor-pointer"
                    >
                      <option value="DAYS">Days</option>
                      <option value="WEEKS">Weeks</option>
                      <option value="MONTHS">Months</option>
                      <option value="YEARS">Years</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Total growth duration until market sale readiness.
                  </p>
                </div>
              </div>

              {/* Dynamic Live Counting Preview: Move-In to Today Age & Strict Days Left */}
              {(() => {
                const moveInMs = new Date(regMoveInDate).getTime();
                const nowMs = new Date().setHours(0, 0, 0, 0);
                const daysElapsed = Math.max(0, Math.floor((nowMs - moveInMs) / (1000 * 60 * 60 * 24)));
                const durVal = Math.max(1, parseFloat(regTargetDurVal) || 1);
                const targetDays =
                  regTargetDurUnit === 'DAYS'
                    ? durVal
                    : regTargetDurUnit === 'WEEKS'
                      ? durVal * 7
                      : regTargetDurUnit === 'MONTHS'
                        ? Math.round(durVal * 30.4375)
                        : Math.round(durVal * 365.25);
                const daysLeft = Math.max(0, targetDays - daysElapsed);
                const targetDate = new Date(moveInMs + targetDays * 86400000);
                const targetDateStr = targetDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Accurate Animal Age & Target Countdown
                      </span>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {daysLeft === 0 ? 'Target Reached (Ready)' : `${daysLeft} Days Left to Sale`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono border-t border-amber-500/20">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Age Today</span>
                        <strong className="text-white">
                          {daysElapsed === 0 ? 'Day 0 (Arrival)' : `Day ${daysElapsed} on farm`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Target Cycle</span>
                        <strong className="text-white">{targetDays} Days</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Market Ready Date</span>
                        <strong className="text-white">{targetDateStr}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-cost" className="block text-xs font-medium text-slate-300 mb-1">
                    Total Purchase Cost ($)
                  </label>
                  <input
                    id="reg-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={regCost}
                    onChange={(e) => setRegCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                  />
                </div>
                <div>
                  <label htmlFor="reg-weight" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Sale Weight (kg)
                  </label>
                  <input
                    id="reg-weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={regTargetWeight}
                    onChange={(e) => setRegTargetWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                  />
                </div>
              </div>

              {/* Configured Selling Price Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-saleprice" className="block text-xs font-medium text-slate-300 mb-1">
                    Configured Selling Price ($ / animal) *
                  </label>
                  <input
                    id="reg-saleprice"
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="e.g. 6.00"
                    value={regSalePriceUnit}
                    onChange={(e) => setRegSalePriceUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Expected revenue calculation per bird/animal.</p>
                </div>
                <div>
                  <label htmlFor="reg-salepricekg" className="block text-xs font-medium text-slate-300 mb-1">
                    Selling Price per Kg ($ / kg, optional)
                  </label>
                  <input
                    id="reg-salepricekg"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 2.80"
                    value={regSalePriceKg}
                    onChange={(e) => setRegSalePriceKg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Alternative live-weight pricing per kilogram.</p>
                </div>
              </div>

              {/* Funding Source & Liquid Cash Overdraft Verification */}
              {(() => {
                const cost = parseFloat(regCost) || 0;
                const isOverdraft = cost > leftMoney;

                return (
                  <div className={`p-3.5 rounded-2xl border text-xs space-y-2.5 transition-all ${isOverdraft
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-slate-950 border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        Funding Source &amp; Cash Verification
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Money on Ground: <strong className={leftMoney <= 0 ? 'text-rose-400' : 'text-emerald-400'}>${leftMoney.toFixed(2)}</strong>
                      </span>
                    </div>

                    {isOverdraft && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          Warning: Insufficient liquid funds! Left Money has <strong>${leftMoney.toFixed(2)}</strong>, but this purchase requires <strong>${cost.toFixed(2)}</strong> (Deficit: ${(cost - leftMoney).toFixed(2)}).
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRegFundingSource('SUPPLIER_CREDIT');
                          setRegAutoExpense(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${regFundingSource === 'SUPPLIER_CREDIT'
                            ? 'bg-amber-500 text-white border-amber-400 font-bold shadow-xs'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                      >
                        <span className="block font-bold text-xs">Acquired on Supplier Credit</span>
                        <span className="text-[10px] block opacity-85">Chicks/stock taken on credit from supplier</span>
                      </button>

                      <button
                        type="button"
                        disabled={isOverdraft}
                        onClick={() => {
                          setRegFundingSource('CASH_POOL');
                          setRegAutoExpense(true);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${isOverdraft
                            ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                            : regFundingSource === 'CASH_POOL'
                              ? 'bg-emerald-600 text-white border-emerald-400 font-bold cursor-pointer shadow-xs'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500 cursor-pointer'
                          }`}
                      >
                        <span className="block font-bold text-xs">Pay from Liquid Cash</span>
                        <span className="text-[10px] block opacity-85">
                          {isOverdraft ? 'Blocked (Insufficient liquid cash)' : 'Auto-deduct from Left Money'}
                        </span>
                      </button>
                    </div>

                    {regFundingSource === 'SUPPLIER_CREDIT' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Supplier / Creditor Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={regCreditorName}
                            onChange={(e) => setRegCreditorName(e.target.value)}
                            placeholder="e.g. Irvine's Hatcheries"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Payment Due Date *
                          </label>
                          <input
                            type="date"
                            required
                            value={regCreditorDueDate}
                            onChange={(e) => setRegCreditorDueDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Custom Recipe & Checkpoints Builder Launcher */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Custom Lifecycle Recipe &amp; Checkpoints
                  </span>
                  <span className="text-[11px] text-amber-400 font-medium">
                    {regCustomCheckpoints.length > 0
                      ? `★ ${regCustomCheckpoints.length} custom checkpoints configured`
                      : 'Using standard preset checkpoints'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecipeBuilder(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                >
                  {regCustomCheckpoints.length > 0 ? 'Edit Recipe Checkpoints' : 'Customize Recipe'}
                </button>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regAutoExpense}
                  onChange={(e) => setRegAutoExpense(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-xs text-slate-200">
                  Auto-log purchase cost (${regCost || '0'}) as an Expense from Left Money
                </span>
              </label>

              <div>
                <label htmlFor="reg-notes" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Audit Notes (Supplier, Breed, House Assignment) *
                </label>
                <textarea
                  id="reg-notes"
                  rows={2}
                  required
                  placeholder="e.g. Purchased from Irvines Harare, placed in disinfected Brooder Run #2"
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    Livestock Arrival / Ear-Tag Photo
                  </span>
                  {regImage && (
                    <button
                      type="button"
                      onClick={() => setRegImage(null)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>
                {regImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-amber-500/40 bg-slate-950 p-2.5 flex items-center gap-3">
                    <img
                      src={regImage}
                      alt="Arrival preview"
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-700 shadow-sm"
                    />
                    <div className="text-xs text-slate-300 min-w-0">
                      <p className="font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Arrival Photo Attached
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        High-resolution photo compressed to ~40KB for instant mobile sync and visual gallery verification.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={regFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={isCompressingPhoto}
                      onChange={(e) => {
                        handlePhotoFileChange(e.target.files?.[0], setRegImage);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => regFileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-950/60 hover:bg-slate-900/50 cursor-pointer transition-all"
                    >
                      <Camera className="w-6 h-6 text-amber-400 mb-1" />
                      <span className="text-xs text-slate-200 font-semibold">
                        {isCompressingPhoto ? 'Optimizing photo...' : 'Snap or Upload Arrival Photo'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        JPG, PNG, WebP (Single tap triggers Camera or Gallery)
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                >
                  Register & Start Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPEND-ONLY LIFECYCLE EVENT MODAL */}
      {activeActionModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lifecycle-modal-title"
        >
          <div className="modal-dialog-responsive max-w-lg p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <div>
                <h2 id="lifecycle-modal-title" className="text-base font-bold text-slate-900">
                  {activeActionModal.mode === 'MORTALITY_LOSS' && 'Log Mortality / Loss (Append-Only)'}
                  {activeActionModal.mode === 'BIRTH_OFFSPRING' && 'Log Birth / Offspring ($0 Cost)'}
                  {activeActionModal.mode === 'VACCINATION_HEALTH' &&
                    'Log Vaccination or Health Treatment'}
                  {activeActionModal.mode === 'WEIGHT_CHECK' &&
                    'Log Routine Weigh-In & Growth Check'}
                  {activeActionModal.mode === 'SALE_DISPATCH' &&
                    'Log Livestock Sale & Distribute Proceeds'}
                  {activeActionModal.mode === 'SLAUGHTER_HARVEST' &&
                    'Log Slaughter / Harvest (Dressed Meat)'}
                  {activeActionModal.mode === 'FARM_CONSUMPTION' &&
                    'Log Internal Farm / Staff Consumption'}
                  {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' &&
                    'Post Headcount Contra-Adjustment (Reversal)'}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeActionModal.status.entry.nameOrTag} · Live:{' '}
                  {activeActionModal.status.currentLiveHeadcount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {evError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {evError}
                </p>
              )}

              {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' && (
                <div className="space-y-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50">
                  <p className="text-xs text-white font-medium">
                    Strict Immutability Law: Past logs cannot be edited or deleted. Select the event to reference and post a positive or negative headcount adjustment.
                  </p>
                  <div>
                    <label htmlFor="contra-ref-ev" className="block text-xs font-medium text-slate-300 mb-1">
                      Reference Event ID *
                    </label>
                    <select
                      id="contra-ref-ev"
                      value={evReferenceId}
                      onChange={(e) => setEvReferenceId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    >
                      {activeActionModal.status.lifecycleEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.id} ({ev.eventType}: {ev.headcountDelta >= 0 ? `+${ev.headcountDelta}` : ev.headcountDelta})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEvContraSign('ADD')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${evContraSign === 'ADD'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                    >
                      + Restore / Add Headcount
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvContraSign('SUBTRACT')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${evContraSign === 'SUBTRACT'
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                    >
                      - Deduct Overstated Count
                    </button>
                  </div>
                </div>
              )}

              {activeActionModal.mode !== 'VACCINATION_HEALTH' && activeActionModal.mode !== 'WEIGHT_CHECK' && (
                <div>
                  <label htmlFor="ev-qty" className="block text-xs font-medium text-slate-300 mb-1">
                    {activeActionModal.mode === 'MORTALITY_LOSS' && 'Number of Animals Lost *'}
                    {activeActionModal.mode === 'BIRTH_OFFSPRING' && 'Number of New Offspring Born *'}
                    {activeActionModal.mode === 'SALE_DISPATCH' && 'Number of Animals Sold *'}
                    {activeActionModal.mode === 'SLAUGHTER_HARVEST' && 'Number of Animals Slaughtered / Harvested *'}
                    {activeActionModal.mode === 'FARM_CONSUMPTION' && 'Number of Animals for Internal Use *'}
                    {activeActionModal.mode === 'HEADCOUNT_CONTRA_ADJUSTMENT' &&
                      'Headcount Delta Quantity *'}
                  </label>
                  <input
                    id="ev-qty"
                    type="number"
                    min="1"
                    required
                    value={evQuantity}
                    onChange={(e) => setEvQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white"
                  />
                </div>
              )}

              <div>
                <label htmlFor="ev-weight" className="block text-xs font-medium text-slate-300 mb-1">
                  {activeActionModal.mode === 'WEIGHT_CHECK'
                    ? 'Sample Average Live Weight (kg) * Mandatory'
                    : 'Sample Average Live Weight (kg) — Optional'}
                </label>
                <input
                  id="ev-weight"
                  type="number"
                  step="0.01"
                  required={activeActionModal.mode === 'WEIGHT_CHECK'}
                  placeholder="e.g. 2.25"
                  value={evWeightKg}
                  onChange={(e) => setEvWeightKg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
                />
              </div>

              {activeActionModal.mode === 'SALE_DISPATCH' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
                  <div>
                    <label htmlFor="ev-sale-rev" className="block text-xs font-medium text-emerald-200 mb-1">
                      Total Gross Sale Revenue Received ($) *
                    </label>
                    <input
                      id="ev-sale-rev"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={evSaleRevenue}
                      onChange={(e) => setEvSaleRevenue(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-700 rounded-xl px-3.5 py-2 text-base font-bold font-mono text-white"
                    />
                  </div>

                  {PERMISSIONS.canConfigureProfitSplits(activeMember.role) ? (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                        <label htmlFor="reinvest-slider">
                          Reinvest to Left Money: <strong>{evReinvestPct}%</strong>
                        </label>
                        <span>
                          Member Dividends: <strong>{100 - evReinvestPct}%</strong>
                        </span>
                      </div>
                      <input
                        id="reinvest-slider"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={evReinvestPct}
                        onChange={(e) => setEvReinvestPct(parseInt(e.target.value, 10))}
                        className="w-full accent-emerald-500"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs font-mono">
                        <span className="text-emerald-300">
                          +${(((parseFloat(evSaleRevenue) || 0) * evReinvestPct) / 100).toFixed(2)} to Left Money
                        </span>
                        <span className="text-amber-300">
                          ${(((parseFloat(evSaleRevenue) || 0) * (100 - evReinvestPct)) / 100).toFixed(2)} Payout Pool
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-white">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Treasury Automated Revenue Reconciliation
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sale proceeds will be credited into the organization accounts. Dividend distribution percentages and farm working capital allocations are calculated and disbursed directly by the Treasurer.
                      </p>
                    </div>
                  )}

                  {/* Live Member Dividend Preview */}
                  <div className="pt-2 border-t border-emerald-800/40 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-300">
                      Automatic Member Dividend Payout Breakdown:
                    </p>
                    {computeDividendDistribution(
                      ((parseFloat(evSaleRevenue) || 0) * (100 - evReinvestPct)) / 100,
                      memberEquities
                    ).map((d) => (
                      <div key={d.memberId} className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">
                          {d.memberName} ({d.sharePercent.toFixed(1)}%)
                        </span>
                        <span className="text-white font-semibold">${d.payoutUsd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="ev-note" className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Explanation Note (Cause, Vaccine Batch, Buyer, or Correction Reason) *
                </label>
                <textarea
                  id="ev-note"
                  rows={3}
                  required
                  placeholder="Enter detailed ground observation (min 4 chars)..."
                  value={evNote}
                  onChange={(e) => setEvNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    Photographic Ground Evidence (Autopsy, Scale, Vaccine, or Dispatch)
                  </span>
                  {evPhoto && (
                    <button
                      type="button"
                      onClick={() => setEvPhoto(null)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>
                {evPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950 p-2.5 flex items-center gap-3">
                    <img
                      src={evPhoto}
                      alt="Event evidence preview"
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-700 shadow-sm"
                    />
                    <div className="text-xs text-slate-300 min-w-0">
                      <p className="font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Evidence Photo Attached
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Will be permanently linked to this lifecycle block and added to the livestock gallery.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={evFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={isCompressingPhoto}
                      onChange={(e) => {
                        handlePhotoFileChange(e.target.files?.[0], setEvPhoto);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => evFileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center p-3.5 rounded-2xl border border-dashed border-slate-700 hover:border-emerald-400/80 bg-slate-950/60 hover:bg-slate-900/50 cursor-pointer transition-all"
                    >
                      <Camera className="w-5 h-5 text-emerald-400 mb-1" />
                      <span className="text-xs text-slate-200 font-semibold">
                        {isCompressingPhoto ? 'Optimizing evidence photo...' : 'Attach Proof Photo (Camera / File)'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        Single tap to snap mortality autopsy, scale readout, vaccine vial, or loading truck
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Append to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUND EVIDENCE GALLERY MODAL */}
      {galleryTarget && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-modal-title"
        >
          <div className="modal-dialog-responsive max-w-2xl p-5 sm:p-6 bg-slate-900 border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 id="gallery-modal-title" className="text-base font-bold flex items-center gap-2 text-white">
                  <Camera className="w-5 h-5 text-amber-400" />
                  Ground Evidence Gallery · {galleryTarget.entry.nameOrTag}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {galleryTarget.entry.species} · {galleryTarget.entry.locationName} · {galleryTarget.currentLiveHeadcount} Live
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryTarget(null)}
                aria-label="Close gallery"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body-scroll mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Quick Add Photo Dropzone */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-amber-400" />
                    Upload Live Ground Photo
                  </span>
                  {newGalleryPhoto && (
                    <button
                      type="button"
                      onClick={() => setNewGalleryPhoto(null)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {newGalleryPhoto ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={newGalleryPhoto}
                        alt="Preview"
                        className="w-16 h-16 rounded-xl object-cover border border-amber-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Caption (e.g. Day 28 flock feathering, pen disinfection)..."
                        value={newGalleryCaption}
                        onChange={(e) => setNewGalleryCaption(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewGalleryPhoto}
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Commit Photo to Organization Gallery
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={galleryFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={isCompressingPhoto}
                      onChange={(e) => {
                        handlePhotoFileChange(e.target.files?.[0], setNewGalleryPhoto);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => galleryFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-900/50 hover:bg-slate-900 text-xs text-slate-300 font-medium cursor-pointer transition-all"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>{isCompressingPhoto ? 'Compressing photo...' : 'Snap or Select Field Photo (Single Tap)'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Photos Grid */}
              {(() => {
                const allPhotos: { url: string; title: string; timestamp: string; actor?: string; eventType?: string }[] = [];

                if (galleryTarget.entry.imageUrl) {
                  allPhotos.push({
                    url: galleryTarget.entry.imageUrl,
                    title: 'Arrival Stocking Photo',
                    timestamp: galleryTarget.entry.createdAt,
                    actor: galleryTarget.entry.createdByMemberName,
                    eventType: 'INITIAL_STOCK',
                  });
                }

                (galleryTarget.entry.gallery || []).forEach((url, i) => {
                  if (url !== galleryTarget.entry.imageUrl) {
                    allPhotos.push({
                      url,
                      title: `Ground Photo #${i + 1}`,
                      timestamp: galleryTarget.entry.createdAt,
                      actor: galleryTarget.entry.createdByMemberName,
                    });
                  }
                });

                galleryTarget.lifecycleEvents.forEach((ev) => {
                  if (ev.photoUrl && !allPhotos.some((p) => p.url === ev.photoUrl)) {
                    allPhotos.push({
                      url: ev.photoUrl,
                      title: ev.note,
                      timestamp: ev.createdAt,
                      actor: ev.loggedByName,
                      eventType: ev.eventType,
                    });
                  }
                });

                if (allPhotos.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                      <p className="text-sm font-semibold text-slate-400">No Ground Photos Uploaded Yet</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Snap or select photos from your device to provide visual verification for remote organization members and investors.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allPhotos.map((photo, index) => (
                      <div
                        key={index}
                        className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col"
                      >
                        <div
                          onClick={() => setLightboxImage({ url: photo.url, caption: `${photo.title} (${new Date(photo.timestamp).toLocaleDateString()})` })}
                          className="relative aspect-4/3 overflow-hidden cursor-pointer bg-slate-900"
                        >
                          <img
                            src={photo.url}
                            alt={photo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                            <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                          </div>
                          {photo.eventType && (
                            <span className="absolute top-2 left-2 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-900/80 text-amber-300 border border-slate-700 backdrop-blur-xs">
                              {photo.eventType.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 text-xs space-y-0.5">
                          <p className="font-semibold text-slate-200 line-clamp-1">{photo.title}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{new Date(photo.timestamp).toLocaleDateString()}</span>
                            {photo.actor && <span className="truncate max-w-[80px]">{photo.actor}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/70">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                <Camera className="w-4 h-4 text-amber-400" />
                {lightboxImage.caption || 'Verified Ground Photo'}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label="Close preview"
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4 overflow-auto flex items-center justify-center bg-black/60">
              <img
                src={lightboxImage.url}
                alt="High resolution ground photo"
                className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM RECIPE & CHECKPOINTS BUILDER MODAL */}
      {showRecipeBuilder && (
        <RecipeBuilderModal
          isOpen={showRecipeBuilder}
          onClose={() => setShowRecipeBuilder(false)}
          species={regSpecies === 'CUSTOM' ? (customSpeciesName || 'Custom Species') : regSpecies}
          initialAgeDays={0}
          targetDurationDays={Math.max(1, parseFloat(regTargetDurVal) || 42)}
          targetWeightKg={parseFloat(regTargetWeight) || 2.2}
          currentCheckpoints={regCustomCheckpoints}
          customRecipes={customRecipes}
          activeMember={activeMember}
          entryDate={regMoveInDate}
          onApplyCheckpoints={(cps) => {
            setRegCustomCheckpoints(cps);
          }}
        />
      )}

      {/* ACTIVE BATCH CHECKPOINT CRUD MODAL */}
      {activeCheckpointModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-950 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    {activeCheckpointModal.checkpointToEdit ? 'Edit Batch Checkpoint' : 'Add Checkpoint to Batch'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeCheckpointModal.batchName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckpointModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cpError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-semibold">
                {cpError}
              </div>
            )}

            <form onSubmit={handleSaveActiveCheckpoint} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Day Target *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={cpDay}
                    onChange={(e) => setCpDay(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-bold text-slate-950 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. 7"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Calendar Date
                  </label>
                  <input
                    type="date"
                    value={cpDate}
                    onChange={(e) => setCpDate(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title &amp; Milestone Description *
                </label>
                <input
                  type="text"
                  required
                  value={cpTitle}
                  onChange={(e) => setCpTitle(e.target.value)}
                  placeholder="e.g. Day 14 Newcastle Vaccine + Weigh-In"
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-bold text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={cpCategory}
                    onChange={(e) => setCpCategory(e.target.value as CheckpointCategory)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-2 text-xs font-bold text-slate-950 focus:outline-none focus:border-amber-500"
                  >
                    <option value="VACCINE">Vaccine</option>
                    <option value="FEED_TRANSITION">Feed Transition</option>
                    <option value="WEIGHT_CHECK">Weight Check</option>
                    <option value="BIOSECURITY">Biosecurity</option>
                    <option value="MEDICATION">Medication</option>
                    <option value="GENERAL_TASK">General Task</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={cpWeight}
                    onChange={(e) => setCpWeight(e.target.value)}
                    placeholder="e.g. 0.450"
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-mono text-slate-950 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Feed Phase / Nutrition Rations
                </label>
                <input
                  type="text"
                  value={cpFeed}
                  onChange={(e) => setCpFeed(e.target.value)}
                  placeholder="e.g. Grower Pellets (20% CP)"
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ground Instructions / Protocols
                </label>
                <textarea
                  rows={2}
                  value={cpInstructions}
                  onChange={(e) => setCpInstructions(e.target.value)}
                  placeholder="Specific preparation steps, dosage, or administration notes..."
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EBE1]">
                <button
                  type="button"
                  onClick={() => setActiveCheckpointModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {activeCheckpointModal.checkpointToEdit ? 'Save Changes' : 'Add to Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED FULL CHECKPOINTS MODAL FOR SPECIFIC ANIMAL */}
      {selectedCheckpointsStatus && (() => {
        const liveStatus = livestockStatuses.find((s) => s.entry.id === selectedCheckpointsStatus.entry.id) || selectedCheckpointsStatus;
        const completedProtocols = liveStatus.protocols.filter((p) => p.completed).length;

        return (
          <div
            className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-2xl bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-950 flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-700 font-bold">{liveStatus.entry.species}</span>
                    <span>·</span>
                    <span>{liveStatus.entry.locationName}</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-950 mt-0.5">
                    {liveStatus.entry.nameOrTag} · Checkpoint Protocols
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Age: {liveStatus.formattedCurrentAge} · Cycle: {liveStatus.entry.targetDurationValue} {liveStatus.entry.targetDurationUnit.toLowerCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCheckpointsStatus(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#F0EBE1] shrink-0">
                <span className="text-xs font-bold text-slate-700">
                  Checkpoints Progress: {completedProtocols} / {liveStatus.protocols.length} Completed
                </span>
                {canManageCustom && (
                  <button
                    type="button"
                    onClick={() => handleOpenAddCheckpoint(liveStatus.entry)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Checkpoint</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#F0EBE1] pr-1 mt-2">
                {liveStatus.protocols.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No Checkpoints Configured</p>
                    <p className="text-xs text-slate-500 mt-1">Click "Add Checkpoint" above to set vaccines or weigh-in schedules for this animal.</p>
                  </div>
                ) : (
                  liveStatus.protocols.map((proto) => {
                    const isBroadcastActive = broadcastSuccessId === `${liveStatus.entry.id}-${proto.dayTarget}`;
                    return (
                      <div
                        key={proto.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <CheckCircle2
                            className={`w-5 h-5 shrink-0 mt-0.5 ${proto.completed ? 'text-emerald-600' : 'text-slate-300'
                              }`}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={proto.completed ? 'text-slate-500 line-through font-medium' : 'text-slate-900 font-bold'}>
                                {proto.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {proto.category.replace('_', ' ')}
                              </span>
                              {proto.targetWeightKg && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Target: {proto.targetWeightKg} kg
                                </span>
                              )}
                            </div>
                            {proto.feedPhase && (
                              <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                                Feed Phase: {proto.feedPhase}
                              </p>
                            )}
                            {proto.description && (
                              <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                                {proto.description}
                              </p>
                            )}
                            {proto.completedNote && (
                              <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                                ✓ {proto.completedNote}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <div className="text-right">
                            <span className="block font-mono text-[11px] text-slate-700 font-semibold">
                              {proto.scheduledDate ? `${proto.scheduledDate} · ${proto.dispatchTime || '07:00 AM'}` : `Day ${proto.dayTarget}`}
                            </span>
                            <span
                              className={`inline-block text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${proto.completed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : proto.reminderStatus === 'DUE_TODAY'
                                    ? 'bg-amber-100 text-amber-900 animate-pulse'
                                    : proto.reminderStatus === 'OVERDUE'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                              {proto.completed ? 'Done' : proto.reminderStatus === 'DUE_TODAY' ? 'Due Today' : `Due Day ${proto.dayTarget}`}
                            </span>
                          </div>

                          {onBroadcastMilestone && (
                            <button
                              type="button"
                              onClick={() => {
                                onBroadcastMilestone({
                                  livestockId: liveStatus.entry.id,
                                  dayTarget: proto.dayTarget,
                                  milestoneTitle: proto.title,
                                  customNote: proto.description,
                                });
                                setBroadcastSuccessId(`${liveStatus.entry.id}-${proto.dayTarget}`);
                                setTimeout(() => setBroadcastSuccessId(null), 4000);
                              }}
                              title="Broadcast milestone update to all members"
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-[11px] font-medium ${isBroadcastActive
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'bg-white border-[#E8DFCE] hover:border-amber-500 text-slate-700 hover:text-slate-950'
                                }`}
                            >
                              <Radio className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden sm:inline">
                                {isBroadcastActive ? 'Broadcasted' : 'Broadcast'}
                              </span>
                            </button>
                          )}

                          {canManageCustom && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCheckpoint(liveStatus.entry, {
                                  id: proto.id,
                                  dayTarget: proto.dayTarget,
                                  scheduledDate: proto.scheduledDate,
                                  title: proto.title,
                                  category: proto.category as CheckpointCategory,
                                  targetWeightKg: proto.targetWeightKg,
                                  feedPhase: proto.feedPhase,
                                  description: proto.description,
                                })}
                                title="Edit checkpoint"
                                aria-label="Edit checkpoint"
                                className="p-1.5 rounded-xl border border-[#E8DFCE] bg-white hover:border-amber-500 text-slate-600 hover:text-slate-950 transition-all cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteActiveCheckpoint(liveStatus.entry.id, proto.id)}
                                title="Delete checkpoint"
                                aria-label="Delete checkpoint"
                                className="p-1.5 rounded-xl border border-[#E8DFCE] bg-white hover:border-rose-500 text-slate-600 hover:text-rose-600 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-[#F0EBE1] shrink-0 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCheckpointsStatus(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUICK DIRECT FEED LOGGING MODAL */}
      {feedModalStatus && (
        <div
          className="fixed inset-0 z-[9995] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-950 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                  <Wheat className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Log Feed Consumed
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {feedModalStatus.entry.nameOrTag} · {feedModalStatus.entry.species}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedModalStatus(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-semibold">
                {feedError}
              </div>
            )}
            {feedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-semibold">
                {feedSuccess}
              </div>
            )}

            <form onSubmit={handleDirectFeedSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Feed Quantity Consumed (KG) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  autoFocus
                  value={feedKg}
                  onChange={(e) => setFeedKg(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Feed Type / Ration Name *
                </label>
                <input
                  type="text"
                  required
                  value={feedType}
                  onChange={(e) => setFeedType(e.target.value)}
                  placeholder="e.g. Broiler Finisher, Starter Crumbs, Hay / Lucerne"
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs font-medium text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Feeding Notes / Observations (Optional)
                </label>
                <textarea
                  rows={2}
                  value={feedNote}
                  onChange={(e) => setFeedNote(e.target.value)}
                  placeholder="e.g. Afternoon feeding, good appetite, all troughs cleaned"
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EBE1]">
                <button
                  type="button"
                  onClick={() => setFeedModalStatus(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Wheat className="w-4 h-4" />
                  <span>Confirm Feed Logged</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
