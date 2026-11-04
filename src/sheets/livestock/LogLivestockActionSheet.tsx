import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type { LivestockEntry, OrgMember, LivestockEventType } from '../../types/agro.ts';

export interface LogLivestockActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch: LivestockEntry;
  activeMember: OrgMember;
  onActionLogged?: () => void;
}

export const LogLivestockActionSheet: React.FC<LogLivestockActionSheetProps> = ({
  isOpen,
  onClose,
  batch,
  activeMember,
  onActionLogged,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const status = dataService.computeLivestockStatuses().find((s: any) => s.entry.id === batch.id);
  const currentHeadcount = status ? status.currentLiveHeadcount : batch.initialHeadcount;

  const form = useForm({
    initial: {
      actionType: 'MORTALITY_LOSS' as LivestockEventType,
      headcountCount: '1',
      weightAvgKg: '',
      note: '',
    },
    validate: (values) => {
      const isHeadcountAction = [
        'MORTALITY_LOSS',
        'BIRTH_OFFSPRING',
        'SLAUGHTER_HARVEST',
        'FARM_CONSUMPTION',
      ].includes(values.actionType);

      const count = parseInt(values.headcountCount || '0', 10);

      return {
        headcountCount:
          isHeadcountAction && (isNaN(count) || count <= 0)
            ? 'Enter headcount count > 0'
            : isHeadcountAction && values.actionType !== 'BIRTH_OFFSPRING' && count > currentHeadcount
              ? `Cannot exceed live headcount (${currentHeadcount})`
              : null,
        note: validators.minAuditNote(values.note, 4),
      };
    },
    onSubmit: async (values) => {
      try {
        const count = parseInt(values.headcountCount || '0', 10);
        let headcountDelta = 0;

        if (values.actionType === 'MORTALITY_LOSS' || values.actionType === 'SLAUGHTER_HARVEST' || values.actionType === 'FARM_CONSUMPTION') {
          headcountDelta = -Math.abs(count);
        } else if (values.actionType === 'BIRTH_OFFSPRING') {
          headcountDelta = Math.abs(count);
        }

        const weight = parseFloat(values.weightAvgKg);

        dataService.logLivestockLifecycleEvent({
          livestockId: batch.id,
          eventType: values.actionType,
          headcountDelta,
          weightAvgKg: !isNaN(weight) && weight > 0 ? weight : undefined,
          photoUrl,
          note: values.note.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Livestock Event Logged',
          message: `Record added to ${batch.nameOrTag} lifecycle audit trail.`,
        });
        onActionLogged?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Logging Failed',
          message: err?.message || 'Could not log livestock event.',
        });
      }
    },
  });

  const handleCapturePhoto = async () => {
    const photo = await promptPhotoSource();
    if (photo?.webPath) {
      setPhotoUrl(photo.webPath);
    }
  };

  const action = form.values.actionType;
  const isHeadcount = ['MORTALITY_LOSS', 'BIRTH_OFFSPRING', 'SLAUGHTER_HARVEST', 'FARM_CONSUMPTION'].includes(action);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Log Livestock Event"
      subtitle={`${batch.nameOrTag} (${batch.species}) · Live: ${currentHeadcount}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Record Event"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Action / Event Type" required>
          <select
            value={form.values.actionType}
            onChange={(e) => form.setValue('actionType', e.target.value as LivestockEventType)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            <option value="MORTALITY_LOSS">💀 Mortality Loss</option>
            <option value="WEIGHT_CHECK">⚖️ Weight Check / Sampling</option>
            <option value="VACCINATION_HEALTH">💉 Vaccination / Medication</option>
            <option value="BIRTH_OFFSPRING">🐣 Birth / Offspring</option>
            <option value="SLAUGHTER_HARVEST">🥩 Slaughter / Processing</option>
            <option value="FARM_CONSUMPTION">🍽️ Farm / Ration Consumption</option>
            <option value="PHOTO_PROGRESS">📸 Photo Progress Log</option>
          </select>
        </Field>

        {isHeadcount && (
          <Field
            label={action === 'BIRTH_OFFSPRING' ? 'Offspring Count' : 'Affected Headcount'}
            required
            error={form.errors.headcountCount}
          >
            <input
              type="number"
              min={1}
              value={form.values.headcountCount}
              onChange={(e) => form.setValue('headcountCount', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        )}

        {action === 'WEIGHT_CHECK' && (
          <Field label="Sample Average Weight (kg)" required>
            <input
              type="number"
              step="0.01"
              value={form.values.weightAvgKg}
              onChange={(e) => form.setValue('weightAvgKg', e.target.value)}
              placeholder="e.g. 1.85"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        )}

        <Field
          label="Mandatory Audit Notes"
          required
          error={form.errors.note}
          hint="Minimum 4 characters required."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. 2 chicks lost to sudden temperature drop overnight"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div>
          <button
            type="button"
            onClick={handleCapturePhoto}
            className="w-full py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2"
          >
            <span>📷</span>
            {photoUrl ? 'Replace Event Photo' : 'Attach Verification Photo'}
          </button>
          {photoUrl && (
            <div className="mt-2 relative rounded-lg overflow-hidden h-24 border border-slate-200 dark:border-slate-700">
              <img src={photoUrl} alt="Event verification" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

