import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  Save,
  Sparkles,
  X,
  BookOpen,
  ChevronDown,
  Scale,
  Wheat,
} from 'lucide-react';
import type {
  AnimalCheckpoint,
  CheckpointCategory,
  FarmRecipeTemplate,
  OrgMember,
} from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';

interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  species: string;
  initialAgeDays: number;
  targetDurationDays: number;
  initialWeightKg?: number;
  targetWeightKg?: number;
  currentCheckpoints: AnimalCheckpoint[];
  customRecipes?: FarmRecipeTemplate[];
  activeMember: OrgMember;
  entryDate?: string;
  onApplyCheckpoints: (checkpoints: AnimalCheckpoint[]) => void;
}

const DEFAULT_TEMPLATES: Record<string, { name: string; durationDays: number; targetWeightKg: number; checkpoints: any[] }> = {
  broiler: {
    name: 'Commercial Broiler 42-Day Standard',
    durationDays: 42,
    targetWeightKg: 2.2,
    checkpoints: [
      { dayTarget: 1, title: 'Day 1: Brooder Placement & Stress Pack', category: 'BIOSECURITY', targetWeightKg: 0.042, feedPhase: 'Starter Crumbles', instructions: 'Preheat brooder to 32°C. Stress pack in water.' },
      { dayTarget: 7, title: 'Day 7: Newcastle (B1) Vaccine & Sample Weigh-In', category: 'VACCINE', targetWeightKg: 0.185, feedPhase: 'Starter Crumbles', instructions: 'Eye-drop or water vaccine. Sample weigh flock.' },
      { dayTarget: 11, title: 'Day 11: 3-Day Starter to Grower Transition', category: 'FEED_TRANSITION', targetWeightKg: 0.35, feedPhase: '50/50 Starter-Grower Blend', instructions: 'Gradual switch over 3 days.' },
      { dayTarget: 14, title: 'Day 14: IBD (Infectious Bursal Disease) Vaccine', category: 'VACCINE', targetWeightKg: 0.48, feedPhase: 'Grower Pellets', instructions: 'Skim milk stabilizer in clean water.' },
      { dayTarget: 21, title: 'Day 21: Newcastle Booster + IBD Sample Weigh', category: 'VACCINE', targetWeightKg: 0.98, feedPhase: 'Grower Pellets', instructions: 'Drinking water administration.' },
      { dayTarget: 28, title: 'Day 28: Grower to Finisher Transition', category: 'FEED_TRANSITION', targetWeightKg: 1.62, feedPhase: '100% Broiler Finisher', instructions: 'Shift to high-energy finisher.' },
      { dayTarget: 35, title: 'Day 35: Pre-Market Weight Audit & Logistics Booking', category: 'WEIGHT_CHECK', targetWeightKg: 2.2, feedPhase: 'Finisher Feed', instructions: 'Finalize buyer orders and crate pickup.' },
      { dayTarget: 42, title: 'Day 42: Final Harvest & Pre-Slaughter Withdrawal', category: 'WEIGHT_CHECK', targetWeightKg: 2.45, feedPhase: 'Water Only (Feed Withdrawn)', instructions: '8-hr feed withdrawal; clean dawn catch.' },
    ],
  },
  goat: {
    name: 'Boer / Indigenous Goat 8-Month Growth Cycle',
    durationDays: 240,
    targetWeightKg: 45,
    checkpoints: [
      { dayTarget: 14, title: 'Day 14: Quarantine & Parasite Inspection', category: 'BIOSECURITY', targetWeightKg: 26, feedPhase: 'Quarantine Hay & Minerals', instructions: 'Hoof bath and skin check.' },
      { dayTarget: 30, title: 'Day 30: Pulpy Kidney & Tetanus Vaccine', category: 'VACCINE', targetWeightKg: 29, feedPhase: 'Grower Pasture + Lick', instructions: 'Subcutaneous injection.' },
      { dayTarget: 90, title: 'Day 90: Broad-Spectrum Deworming Drench', category: 'MEDICATION', targetWeightKg: 35, feedPhase: 'Pasture Rations', instructions: 'Oral drenching calibrated to weight.' },
      { dayTarget: 180, title: 'Day 180: Mid-Cycle Weight & Body Condition Score', category: 'WEIGHT_CHECK', targetWeightKg: 40, feedPhase: 'Finishing Supplement', instructions: 'Body condition score target 3.5/5.' },
      { dayTarget: 240, title: 'Day 240: Market Readiness & Buyer Weigh-In', category: 'WEIGHT_CHECK', targetWeightKg: 45, feedPhase: 'Pre-Market Blend', instructions: 'Batch weigh and dispatch.' },
    ],
  },
};

export const RecipeBuilderModal: React.FC<RecipeBuilderModalProps> = ({
  isOpen,
  onClose,
  species,
  initialAgeDays,
  targetDurationDays,
  initialWeightKg = 0.042,
  targetWeightKg = 2.2,
  currentCheckpoints,
  customRecipes = [],
  activeMember,
  entryDate,
  onApplyCheckpoints,
}) => {
  const [checkpoints, setCheckpoints] = useState<AnimalCheckpoint[]>(() =>
    currentCheckpoints.length > 0 ? [...currentCheckpoints] : []
  );

  // New / Edit Checkpoint Item State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cpDay, setCpDay] = useState<number>(7);
  const [cpTitle, setCpTitle] = useState('');
  const [cpCategory, setCpCategory] = useState<CheckpointCategory>('VACCINE');
  const [cpWeight, setCpWeight] = useState<string>('');
  const [cpFeed, setCpFeed] = useState('');
  const [cpInstructions, setCpInstructions] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Template Saving State
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const getComputedCalendarDate = (day: number) => {
    try {
      const baseIso = entryDate || new Date().toISOString().split('T')[0];
      const baseMs = new Date(baseIso).getTime();
      const targetMs = baseMs + Number(day || 0) * 86400000;
      return new Date(targetMs).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const formatDisplayDate = (isoDate: string) => {
    try {
      const [y, m, d] = isoDate.split('-');
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  if (!isOpen) return null;

  // Advanced Mathematical Projections
  const safeDuration = Math.max(1, targetDurationDays);
  const estimatedAdgGrams =
    targetWeightKg && targetWeightKg > initialWeightKg
      ? Math.round(((targetWeightKg - initialWeightKg) / safeDuration) * 1000)
      : null;

  const handleApplyTemplate = (tpl: { durationDays: number; targetWeightKg: number; checkpoints: any[] }) => {
    const formatted: AnimalCheckpoint[] = tpl.checkpoints.map((c, idx) => ({
      id: `cp-${Date.now().toString(36)}-${idx}`,
      dayTarget: c.dayTarget,
      scheduledDate: getComputedCalendarDate(c.dayTarget),
      title: c.title,
      category: c.category,
      targetWeightKg: c.targetWeightKg,
      feedPhase: c.feedPhase,
      instructions: c.instructions,
      completed: false,
      reminderStatus: 'SCHEDULED',
    }));
    setCheckpoints(formatted.sort((a, b) => a.dayTarget - b.dayTarget));
    setStatusMsg(`Loaded template with ${formatted.length} checkpoints.`);
  };

  const handleSaveCheckpointItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpTitle.trim()) return;

    const computedDate = getComputedCalendarDate(cpDay);

    if (editingId) {
      setCheckpoints(
        checkpoints.map((c) =>
          c.id === editingId
            ? {
              ...c,
              dayTarget: Number(cpDay),
              scheduledDate: computedDate,
              title: cpTitle.trim(),
              category: cpCategory,
              targetWeightKg: cpWeight ? Number(cpWeight) : undefined,
              feedPhase: cpFeed.trim() || undefined,
              instructions: cpInstructions.trim() || undefined,
            }
            : c
        ).sort((a, b) => a.dayTarget - b.dayTarget)
      );
      setEditingId(null);
    } else {
      const newItem: AnimalCheckpoint = {
        id: `cp-${Date.now().toString(36)}`,
        dayTarget: Number(cpDay),
        scheduledDate: computedDate,
        title: cpTitle.trim(),
        category: cpCategory,
        targetWeightKg: cpWeight ? Number(cpWeight) : undefined,
        feedPhase: cpFeed.trim() || undefined,
        instructions: cpInstructions.trim() || undefined,
        completed: false,
        reminderStatus: 'SCHEDULED',
      };
      setCheckpoints([...checkpoints, newItem].sort((a, b) => a.dayTarget - b.dayTarget));
      setIsAddingNew(false);
    }

    // Reset inputs
    setCpTitle('');
    setCpWeight('');
    setCpFeed('');
    setCpInstructions('');
  };

  const startEdit = (cp: AnimalCheckpoint) => {
    setEditingId(cp.id);
    setIsAddingNew(false);
    setCpDay(cp.dayTarget);
    setCpTitle(cp.title);
    setCpCategory(cp.category);
    setCpWeight(cp.targetWeightKg ? String(cp.targetWeightKg) : '');
    setCpFeed(cp.feedPhase || '');
    setCpInstructions(cp.instructions || '');
  };

  const deleteItem = (id: string) => {
    setCheckpoints(checkpoints.filter((c) => c.id !== id));
  };

  const handleSaveOrgTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveTemplateName.trim()) return;

    dataService.saveCustomRecipeTemplate({
      name: saveTemplateName.trim(),
      species,
      recommendedDurationDays: targetDurationDays,
      targetSaleWeightKg: targetWeightKg || 2.2,
      checkpoints: checkpoints.map((c) => ({
        dayTarget: c.dayTarget,
        scheduledDate: c.scheduledDate,
        title: c.title,
        category: c.category,
        targetWeightKg: c.targetWeightKg,
        feedPhase: c.feedPhase,
        instructions: c.instructions,
      })),
      actor: activeMember,
    });
    setStatusMsg(`Recipe "${saveTemplateName}" saved to organization library.`);
    setShowSaveTemplate(false);
    setSaveTemplateName('');
  };

  const handleFinalApply = () => {
    onApplyCheckpoints(checkpoints);
    onClose();
  };

  return (
    <div
      className="modal-overlay-responsive animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog-responsive max-w-2xl bg-white border border-[#E8DFCE] rounded-3xl shadow-2xl text-slate-950 max-h-[88vh] flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-[#F0EBE1] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">
                Custom Lifecycle Recipe &amp; Checkpoints Builder
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Design custom feeding, vaccination, and weigh-in checkpoints for {species}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Telemetry Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Cycle Duration</span>
              <span className="font-mono font-black text-slate-950">{targetDurationDays} Days</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Target Market Weight</span>
              <span className="font-mono font-black text-emerald-800">{targetWeightKg || '2.2'} kg</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Projected ADG</span>
              <span className="font-mono font-black text-amber-800">
                {estimatedAdgGrams ? `+${estimatedAdgGrams} g/day` : 'N/A'}
              </span>
            </div>
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold">
              {statusMsg}
            </div>
          )}

          {/* Template Quick Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Preset Recipes:</span>
            </span>
            <button
              type="button"
              onClick={() => handleApplyTemplate(DEFAULT_TEMPLATES.broiler)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-900 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
            >
              Broiler 42-Day Standard
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate(DEFAULT_TEMPLATES.goat)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-900 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
            >
              Goat 8-Month Cycle
            </button>
            {customRecipes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleApplyTemplate({ durationDays: r.recommendedDurationDays, targetWeightKg: r.targetSaleWeightKg, checkpoints: r.checkpoints })}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 font-black text-xs border border-amber-300 transition-colors cursor-pointer"
              >
                ★ {r.name}
              </button>
            ))}
          </div>

          {/* Checkpoint Item Edit / Add Form */}
          {(isAddingNew || editingId) && (
            <form
              onSubmit={handleSaveCheckpointItem}
              className="p-4 rounded-2xl bg-[#FAF8F5] border border-amber-300 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-950">
                  {editingId ? 'Edit Checkpoint' : 'Add New Checkpoint'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingId(null);
                  }}
                  className="text-xs text-slate-500 font-bold hover:text-slate-950"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Target Day *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    required
                    value={cpDay}
                    onChange={(e) => setCpDay(Number(e.target.value))}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <span className="block text-[10px] font-black uppercase text-amber-800 mb-1">
                    Auto-Calculated Date
                  </span>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>{formatDisplayDate(getComputedCalendarDate(cpDay))}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Category *
                  </label>
                  <select
                    value={cpCategory}
                    onChange={(e) => setCpCategory(e.target.value as CheckpointCategory)}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="VACCINE">Vaccine / Health</option>
                    <option value="FEED_TRANSITION">Feed Transition / Ration</option>
                    <option value="WEIGHT_CHECK">Weigh-in &amp; Biomass Check</option>
                    <option value="BIOSECURITY">Biosecurity &amp; Sanitation</option>
                    <option value="MEDICATION">Deworming &amp; Medication</option>
                    <option value="GENERAL_TASK">General Farm Task</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Checkpoint Headline *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Day 14: IBD Intermediate Vaccine in Water"
                    value={cpTitle}
                    onChange={(e) => setCpTitle(e.target.value)}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Target Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 0.48"
                    value={cpWeight}
                    onChange={(e) => setCpWeight(e.target.value)}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Feed Phase / Ration Instruction
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Broiler Grower Pellets (20% CP)"
                    value={cpFeed}
                    onChange={(e) => setCpFeed(e.target.value)}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-black text-slate-950 mb-1">
                    Detailed Operator Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mix vaccine with chlorine-free water. Expand floor pen area."
                    value={cpInstructions}
                    onChange={(e) => setCpInstructions(e.target.value)}
                    className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-950 font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                >
                  {editingId ? 'Update Checkpoint' : 'Add Checkpoint to Recipe'}
                </button>
              </div>
            </form>
          )}

          {/* Checkpoints Sequence Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-950">
                Recipe Checkpoint Schedule ({checkpoints.length} Steps)
              </span>
              {!isAddingNew && !editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setIsAddingNew(true);
                    setCpDay(checkpoints.length > 0 ? (checkpoints[checkpoints.length - 1].dayTarget + 7) : 1);
                  }}
                  className="px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-800" />
                  <span>Add Step</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {checkpoints.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 font-medium">
                  No checkpoints added yet. Click &quot;Add Step&quot; or select a preset recipe above.
                </p>
              ) : (
                checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-start justify-between gap-2.5 hover:border-slate-300 transition-all text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md text-[10px]">
                          Day {cp.dayTarget}
                        </span>
                        {cp.scheduledDate && (
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[10px] border border-slate-200">
                            📅 {cp.scheduledDate}
                          </span>
                        )}
                        <span className="font-bold text-slate-950">{cp.title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 uppercase">
                          {cp.category.replace('_', ' ')}
                        </span>
                        {cp.targetWeightKg && (
                          <span className="font-mono font-bold text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Target: {cp.targetWeightKg} kg
                          </span>
                        )}
                      </div>
                      {cp.feedPhase && (
                        <p className="text-[11px] text-amber-800 font-bold">
                          Feed: {cp.feedPhase}
                        </p>
                      )}
                      {cp.instructions && (
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          {cp.instructions}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(cp)}
                        className="p-1 text-slate-500 hover:text-slate-950 cursor-pointer"
                        title="Edit step"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(cp.id)}
                        className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                        title="Delete step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Save as Org Template Option */}
          {showSaveTemplate ? (
            <form onSubmit={handleSaveOrgTemplate} className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. My High-Yield Broiler Recipe"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
              >
                Save Template
              </button>
              <button
                type="button"
                onClick={() => setShowSaveTemplate(false)}
                className="px-2 text-xs text-slate-500 font-bold"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setShowSaveTemplate(true)}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save this recipe to organization library</span>
              </button>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-[#F0EBE1] bg-[#FAF8F5] shrink-0 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFinalApply}
            className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/20"
          >
            <Check className="w-4 h-4" />
            <span>Apply Recipe to Batch ({checkpoints.length} Checkpoints)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

