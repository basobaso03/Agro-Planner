import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { nativeCamera } from '../../native/camera.ts';
import { nativeFiles } from '../../native/files.ts';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import type { LivestockEntry, OrgMember } from '../../types/agro.ts';

export interface FeedEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch?: LivestockEntry;
  activeMember: OrgMember;
  onFeedLogged?: () => void;
}

export const FeedEventSheet: React.FC<FeedEventSheetProps> = ({
  isOpen,
  onClose,
  batch: propBatch,
  activeMember,
  onFeedLogged,
}) => {
  const { showToast } = useToast();
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const batch = propBatch || dataService.getState().livestockEntries[0];

  const form = useForm({
    initial: {
      quantityKg: '',
      feedBrandRation: 'Starter Broiler Crumbs',
      date: new Date().toISOString().split('T')[0],
      note: batch ? `Daily feed consumption for ${batch.nameOrTag}` : 'Daily feed consumption',
    },
    draftKey: batch ? `feed_log_${batch.id}` : 'feed_log_default',
    validate: (values) => ({
      quantityKg: validators.positiveNumber(values.quantityKg, 'Feed quantity (kg)'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      const kg = parseFloat(values.quantityKg);

      if (!batch) {
        showToast('Please create a livestock batch before logging feed consumption.');
        return;
      }

      dataService.logFeedConsumption({
        livestockId: batch.id,
        quantityKg: kg,
        feedBrandOrRation: values.feedBrandRation.trim(),
        date: values.date,
        notes: values.note.trim(),
        photoDataUrl: photoDataUrl || undefined,
        actor: activeMember,
      });

      showToast(`Logged ${kg}kg of ${values.feedBrandRation} for ${batch.nameOrTag}.`);
      if (onFeedLogged) onFeedLogged();
      onClose();
    },
  });

  const handleCapturePhoto = async () => {
    const photo = await nativeCamera.takePhoto();
    if (photo?.dataUrl || photo?.webPath) {
      setPhotoDataUrl(photo.dataUrl || photo.webPath || null);
    }
  };

  const handlePickGallery = async () => {
    const photo = await nativeCamera.pickFromGallery();
    if (photo?.dataUrl || photo?.webPath) {
      setPhotoDataUrl(photo.dataUrl || photo.webPath || null);
    }
  };

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Log Feed Consumed"
      subtitle={batch ? `Batch: ${batch.nameOrTag} (${batch.initialHeadcount} head)` : 'No active batch'}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty || Boolean(photoDataUrl)}
      stickyError={form.stickyError}
      submitLabel="Record Feed Consumption"
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Feed Quantity (kg)" required error={form.errors.quantityKg}>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.1"
              value={form.values.quantityKg}
              onChange={(e) => form.setFieldValue('quantityKg', e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>

          <Field label="Ration Phase / Brand" required>
            <input
              type="text"
              value={form.values.feedBrandRation}
              onChange={(e) => form.setFieldValue('feedBrandRation', e.target.value)}
              placeholder="e.g. Grower Mash / National Foods"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        </div>

        <Field label="Feeding Date" required>
          <input
            type="date"
            value={form.values.date}
            onChange={(e) => form.setFieldValue('date', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        {/* Feed Bag / Scale Photo */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Feed Photo (Optional)</label>
          {photoDataUrl ? (
            <div className="relative inline-block rounded-2xl overflow-hidden border border-slate-200">
              <img src={photoDataUrl} alt="Feed receipt" className="w-24 h-24 object-cover" />
              <button
                type="button"
                onClick={() => setPhotoDataUrl(null)}
                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Snap Camera</span>
              </button>
              <button
                type="button"
                onClick={handlePickGallery}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Choose Photo</span>
              </button>
            </div>
          )}
        </div>

        <Field label="Audit Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

