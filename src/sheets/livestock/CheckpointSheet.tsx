import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { scheduleCheckpointReminder } from '../../native/reminders.ts';
import type { LivestockEntry, OrgMember, AnimalCheckpoint } from '../../types/agro.ts';

export interface CheckpointSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch: LivestockEntry;
  activeMember: OrgMember;
  existingCheckpoint?: AnimalCheckpoint;
  onCheckpointSaved?: () => void;
}

export const CheckpointSheet: React.FC<CheckpointSheetProps> = ({
  isOpen,
  onClose,
  batch,
  activeMember,
  existingCheckpoint,
  onCheckpointSaved,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      title: existingCheckpoint?.title || '',
      dayTarget: String(existingCheckpoint?.dayTarget || 14),
      category: (existingCheckpoint?.category || 'VACCINE') as
        | 'VACCINE'
        | 'FEED_TRANSITION'
        | 'WEIGHT_CHECK'
        | 'BIOSECURITY',
      description: existingCheckpoint?.description || '',
      targetWeightKg: String(existingCheckpoint?.targetWeightKg || ''),
    },
    validate: (values) => ({
      title: validators.required(values.title, 'Checkpoint milestone title'),
      dayTarget: validators.positiveInteger(values.dayTarget, 'Target day'),
    }),
    onSubmit: async (values) => {
      try {
        const dayTarget = parseInt(values.dayTarget, 10);
        const weight = parseFloat(values.targetWeightKg);

        if (existingCheckpoint) {
          dataService.updateLivestockCheckpoint({
            livestockId: batch.id,
            checkpointId: existingCheckpoint.id,
            updates: {
              title: values.title.trim(),
              dayTarget,
              category: values.category,
              description: values.description.trim() || undefined,
              targetWeightKg: !isNaN(weight) && weight > 0 ? weight : undefined,
            },
            actor: activeMember,
          });
        } else {
          const checkpoint = dataService.addCheckpointToLivestock({
            livestockId: batch.id,
            checkpoint: {
              title: values.title.trim(),
              dayTarget,
              category: values.category,
              description: values.description.trim() || undefined,
              targetWeightKg: !isNaN(weight) && weight > 0 ? weight : undefined,
            },
            actor: activeMember,
          });

          // Schedule native notification reminder if target date is in future
          if (batch.entryDate) {
            const entryTime = new Date(batch.entryDate).getTime();
            const triggerTime = new Date(entryTime + dayTarget * 86400000);
            if (triggerTime.getTime() > Date.now()) {
              await scheduleCheckpointReminder({
                id: checkpoint.id,
                title: `Reminder: ${values.title}`,
                body: `${batch.nameOrTag} reached Day ${dayTarget}. Please execute ${values.category.toLowerCase()} protocol.`,
                at: triggerTime,
              });
            }
          }
        }

        showToast({
          type: 'success',
          title: existingCheckpoint ? 'Checkpoint Updated' : 'Checkpoint Added',
          message: `Milestone "${values.title}" saved on ${batch.nameOrTag}.`,
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

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={existingCheckpoint ? 'Edit Farm Protocol' : 'Add Custom Checkpoint'}
      subtitle={`Lifecycle schedule for ${batch.nameOrTag}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Save Checkpoint"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Protocol Milestone Title" required error={form.errors.title}>
          <input
            type="text"
            value={form.values.title}
            onChange={(e) => form.setValue('title', e.target.value)}
            placeholder="e.g. Day 10 Gumboro Vaccine Booster"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Day of Cycle" required error={form.errors.dayTarget}>
            <input
              type="number"
              min={1}
              value={form.values.dayTarget}
              onChange={(e) => form.setValue('dayTarget', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Category" required>
            <select
              value={form.values.category}
              onChange={(e) => form.setValue('category', e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="VACCINE">💉 Vaccine / Health</option>
              <option value="FEED_TRANSITION">🥣 Feed Transition</option>
              <option value="WEIGHT_CHECK">⚖️ Weight Check</option>
              <option value="BIOSECURITY">🛡️ Biosecurity Protocol</option>
            </select>
          </Field>
        </div>

        <Field label="Target Weight Milestone (kg)">
          <input
            type="number"
            step="0.05"
            value={form.values.targetWeightKg}
            onChange={(e) => form.setValue('targetWeightKg', e.target.value)}
            placeholder="e.g. 1.20"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field label="Instructions & Formulation Notes">
          <textarea
            rows={2}
            value={form.values.description}
            onChange={(e) => form.setValue('description', e.target.value)}
            placeholder="e.g. Administer 1 vial per 1,000 birds via clean drinking water with skim milk stabilizer"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

