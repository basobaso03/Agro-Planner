import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type { LivestockEntry, OrgMember } from '../../types/agro.ts';

export interface HeadcountContraSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch: LivestockEntry;
  activeMember: OrgMember;
  onContraLogged?: () => void;
}

export const HeadcountContraSheet: React.FC<HeadcountContraSheetProps> = ({
  isOpen,
  onClose,
  batch,
  activeMember,
  onContraLogged,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const form = useForm({
    initial: {
      direction: 'ADDITION' as 'ADDITION' | 'DEDUCTION',
      count: '1',
      referenceTransactionId: '',
      note: '',
    },
    validate: (values) => ({
      count: validators.positiveInteger(values.count, 'Adjustment count'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      try {
        const count = parseInt(values.count, 10);
        const delta = values.direction === 'ADDITION' ? count : -count;

        dataService.logLivestockLifecycleEvent({
          livestockId: batch.id,
          eventType: 'HEADCOUNT_CONTRA_ADJUSTMENT',
          headcountDelta: delta,
          referenceTransactionId: values.referenceTransactionId.trim() || undefined,
          photoUrl,
          note: `[Contra Adjustment] ${values.note.trim()}`,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Contra Adjustment Recorded',
          message: `${delta > 0 ? `+${delta}` : delta} animals adjusted on ${batch.nameOrTag}.`,
        });
        onContraLogged?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Contra Failed',
          message: err?.message || 'Could not record contra adjustment.',
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

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Headcount Contra Correction"
      subtitle={`Immutable correction for ${batch.nameOrTag}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Apply Contra Adjustment"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          Under financial and livestock integrity rules, records cannot be silently deleted. All corrections are appended as cryptographic contra entries.
        </div>

        <Field label="Correction Direction" required>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => form.setValue('direction', 'ADDITION')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                form.values.direction === 'ADDITION'
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              + Restore / Add Stock
            </button>
            <button
              type="button"
              onClick={() => form.setValue('direction', 'DEDUCTION')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                form.values.direction === 'DEDUCTION'
                  ? 'bg-rose-500 text-white border-rose-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              - Deduct Miscounted Stock
            </button>
          </div>
        </Field>

        <Field label="Number of Animals" required error={form.errors.count}>
          <input
            type="number"
            min={1}
            value={form.values.count}
            onChange={(e) => form.setValue('count', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field label="Reference Transaction / Event ID (Optional)">
          <input
            type="text"
            value={form.values.referenceTransactionId}
            onChange={(e) => form.setValue('referenceTransactionId', e.target.value)}
            placeholder="e.g. EV-8910"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field
          label="Mandatory Audit Reason"
          required
          error={form.errors.note}
          hint="Audit trail requires minimum 4 characters explanation."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Reversing duplicate mortality logged in error yesterday morning"
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
            {photoUrl ? 'Replace Verification Photo' : 'Attach Verification Photo'}
          </button>
          {photoUrl && (
            <div className="mt-2 relative rounded-lg overflow-hidden h-24 border border-slate-200 dark:border-slate-700">
              <img src={photoUrl} alt="Contra verification" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

