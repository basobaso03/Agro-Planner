import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { scheduleCheckpointReminder } from '../../native/reminders.ts';
import { Bell, Users, Calendar, Radio, Plus } from 'lucide-react';
import type { LivestockEntry, OrgMember, AnimalCheckpoint, CheckpointCategory } from '../../types/agro.ts';

export interface CheckpointSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch: LivestockEntry;
  activeMember: OrgMember;
  existingCheckpoint?: AnimalCheckpoint;
  onCheckpointSaved?: () => void;
}

const STANDARD_CATEGORIES: { value: CheckpointCategory; label: string }[] = [
  { value: 'VACCINE', label: '💉 Vaccine / Health' },
  { value: 'FEED_TRANSITION', label: '🥣 Feed Transition' },
  { value: 'WEIGHT_CHECK', label: '⚖️ Weight Check' },
  { value: 'BIOSECURITY', label: '🛡️ Biosecurity Protocol' },
  { value: 'MEDICATION', label: '💊 Medication / Treatment' },
  { value: 'GENERAL_TASK', label: '📋 General Management' },
];

export const CheckpointSheet: React.FC<CheckpointSheetProps> = ({
  isOpen,
  onClose,
  batch,
  activeMember,
  existingCheckpoint,
  onCheckpointSaved,
}) => {
  const { showToast } = useToast();

  const entryTime = new Date(batch.entryDate || batch.createdAt || Date.now()).getTime();

  // Helper to calculate date string from dayTarget
  const getDateStringFromDay = (day: number) => {
    const targetMs = entryTime + day * 86400000;
    return new Date(targetMs).toISOString().split('T')[0];
  };

  const initialDay = existingCheckpoint?.dayTarget || 14;
  const initialDateStr = existingCheckpoint?.scheduledDate || getDateStringFromDay(initialDay);

  const isExistingCategoryStandard = existingCheckpoint?.category
    ? STANDARD_CATEGORIES.some((c) => c.value === existingCheckpoint.category)
    : true;

  const [scheduledDateStr, setScheduledDateStr] = useState<string>(initialDateStr);
  const [selectedCategoryOption, setSelectedCategoryOption] = useState<string>(
    isExistingCategoryStandard ? (existingCheckpoint?.category || 'VACCINE') : '__CUSTOM__'
  );
  const [customCategoryText, setCustomCategoryText] = useState<string>(
    isExistingCategoryStandard ? '' : (existingCheckpoint?.category || '')
  );
  const [notifyAllMembers, setNotifyAllMembers] = useState(true);
  const [broadcastNowIfDue, setBroadcastNowIfDue] = useState(false);

  const form = useForm({
    initial: {
      title: existingCheckpoint?.title || '',
      dayTarget: String(initialDay),
      description: existingCheckpoint?.description || existingCheckpoint?.instructions || '',
      feedPhase: existingCheckpoint?.feedPhase || '',
      targetWeightKg: String(existingCheckpoint?.targetWeightKg || ''),
    },
    validate: (values) => ({
      title: validators.required(values.title, 'Checkpoint title'),
      dayTarget: validators.positiveInteger(values.dayTarget, 'Target day'),
    }),
    onSubmit: async (values) => {
      try {
        const dayTarget = parseInt(values.dayTarget, 10);
        const weight = parseFloat(values.targetWeightKg);
        const cleanDesc = values.description.trim() || undefined;
        const cleanFeedPhase = values.feedPhase.trim() || undefined;

        const effectiveCategory: CheckpointCategory =
          selectedCategoryOption === '__CUSTOM__'
            ? (customCategoryText.trim().toUpperCase().replace(/\s+/g, '_') as CheckpointCategory) || 'GENERAL_TASK'
            : (selectedCategoryOption as CheckpointCategory);

        const targetTime = new Date(entryTime + dayTarget * 86400000);
        // Set reminder to morning 07:00 AM on scheduled date
        const morningReminderTime = new Date(targetTime);
        morningReminderTime.setHours(7, 0, 0, 0);

        let savedCheckpoint: AnimalCheckpoint;

        if (existingCheckpoint) {
          savedCheckpoint = dataService.updateLivestockCheckpoint({
            livestockId: batch.id,
            checkpointId: existingCheckpoint.id,
            updates: {
              title: values.title.trim(),
              dayTarget,
              scheduledDate: scheduledDateStr,
              category: effectiveCategory,
              description: cleanDesc,
              instructions: cleanDesc,
              feedPhase: cleanFeedPhase,
              targetWeightKg: !isNaN(weight) && weight > 0 ? weight : undefined,
            },
            actor: activeMember,
          });
        } else {
          savedCheckpoint = dataService.addCheckpointToLivestock({
            livestockId: batch.id,
            checkpoint: {
              title: values.title.trim(),
              dayTarget,
              scheduledDate: scheduledDateStr,
              category: effectiveCategory,
              description: cleanDesc,
              instructions: cleanDesc,
              feedPhase: cleanFeedPhase,
              targetWeightKg: !isNaN(weight) && weight > 0 ? weight : undefined,
            },
            actor: activeMember,
          });
        }

        // Schedule notification reminder if target date is in future
        if (morningReminderTime.getTime() > Date.now()) {
          await scheduleCheckpointReminder({
            id: savedCheckpoint.id,
            title: `Morning Checkpoint: ${values.title}`,
            body: `${batch.nameOrTag} reached Day ${dayTarget}. Please execute ${effectiveCategory} checkpoint.`,
            at: morningReminderTime,
          });
        }

        // If requested to broadcast immediately or if due today
        if (broadcastNowIfDue) {
          dataService.dispatchLivestockMilestoneBroadcast({
            livestockId: batch.id,
            dayTarget,
            milestoneTitle: values.title.trim(),
            customNote: cleanDesc,
            actor: activeMember,
          });
        }

        showToast({
          type: 'success',
          title: existingCheckpoint ? 'Checkpoint Updated' : 'Checkpoint Added',
          message: `Checkpoint "${values.title}" saved. Morning notifications scheduled for all org members.`,
        });
        onCheckpointSaved?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Save Failed',
          message: err?.message || 'Could not save checkpoint.',
        });
      }
    },
  });

  // Keep date and dayTarget in sync
  const handleDayChange = (newDayStr: string) => {
    form.setValue('dayTarget', newDayStr);
    const dayNum = parseInt(newDayStr, 10);
    if (!isNaN(dayNum) && dayNum >= 0) {
      setScheduledDateStr(getDateStringFromDay(dayNum));
    }
  };

  const handleDateChange = (newDateStr: string) => {
    setScheduledDateStr(newDateStr);
    if (newDateStr) {
      const selectedMs = new Date(newDateStr).getTime();
      const diffDays = Math.max(1, Math.round((selectedMs - entryTime) / 86400000));
      form.setValue('dayTarget', String(diffDays));
    }
  };

  const currentDayNum = parseInt(form.values.dayTarget, 10) || 1;
  const calculatedDate = new Date(entryTime + currentDayNum * 86400000);
  const formattedReminderDate = calculatedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isDueTodayOrPast = calculatedDate.getTime() <= Date.now() + 86400000;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={existingCheckpoint ? 'Edit Checkpoint' : 'Add Checkpoint'}
      subtitle={`Lifecycle schedule & member reminders for ${batch.nameOrTag}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Save Checkpoint"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Checkpoint Title" required error={form.errors.title}>
          <input
            type="text"
            value={form.values.title}
            onChange={(e) => form.setValue('title', e.target.value)}
            placeholder="e.g. Day 10 IBD Vaccine Booster"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Day of Cycle" required error={form.errors.dayTarget}>
            <input
              type="number"
              min={1}
              value={form.values.dayTarget}
              onChange={(e) => handleDayChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>

          <Field label="Calendar Reminder Date" required>
            <input
              type="date"
              value={scheduledDateStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        </div>

        {/* Morning Notification Schedule & Member Scope Preview */}
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Bell className="w-4 h-4 text-amber-600" />
              <span>Morning Dispatch Notification</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
              07:00 AM Alert
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{formattedReminderDate}</span>
          </div>

          <div className="flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed pt-1.5 border-t border-amber-200/60">
            <Users className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Org-Wide Reach:</strong> When the event date arrives in the morning, an alert is sent across the team so every member in the organization is notified.
            </span>
          </div>

          {isDueTodayOrPast && (
            <label className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastNowIfDue}
                onChange={(e) => setBroadcastNowIfDue(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                Dispatch immediate broadcast to all org members right now
              </span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              value={selectedCategoryOption}
              onChange={(e) => setSelectedCategoryOption(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {STANDARD_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
              <option value="__CUSTOM__">➕ Custom Category...</option>
            </select>
          </Field>

          <Field label="Target Weight Milestone (kg)">
            <input
              type="number"
              step="0.05"
              value={form.values.targetWeightKg}
              onChange={(e) => form.setValue('targetWeightKg', e.target.value)}
              placeholder="e.g. 1.20"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        </div>

        {selectedCategoryOption === '__CUSTOM__' && (
          <Field label="Custom Category Name" required hint="Add your own specialized activity tag">
            <input
              type="text"
              value={customCategoryText}
              onChange={(e) => setCustomCategoryText(e.target.value)}
              placeholder="e.g. Hoof Trimming, Dehorning, Sorting"
              className="w-full px-3 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        )}

        {/* Brown Badge Text: Feed Phase / Ration Tag */}
        <Field
          label="Feed Phase / Ration Tag (Optional)"
          hint="Nutritional stage shown in amber badge (e.g. Starter Crumbles, Finisher Pellets)"
        >
          <input
            type="text"
            value={form.values.feedPhase}
            onChange={(e) => form.setValue('feedPhase', e.target.value)}
            placeholder="e.g. Broiler Starter Crumbles (22-24% CP)"
            className="w-full px-3 py-2.5 rounded-xl border border-amber-300/80 dark:border-amber-700 bg-amber-50/30 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        <Field label="Instructions & Stage Details">
          <textarea
            rows={3}
            value={form.values.description}
            onChange={(e) => form.setValue('description', e.target.value)}
            placeholder="e.g. Administer 1 vial per 1,000 birds via clean drinking water with skim milk stabilizer. Brooder temperature at 30°C."
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
          />
        </Field>
      </div>
    </FormSheet>
  );
};
