import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type { OrgMember, NotificationSeverity } from '../../types/agro.ts';

export interface BroadcastSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onBroadcastPosted?: () => void;
}

export const BroadcastSheet: React.FC<BroadcastSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onBroadcastPosted,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      locationId: 'ALL',
      severity: 'URGENT_GROUND' as NotificationSeverity,
      title: '',
      message: '',
    },
    validate: (values) => ({
      message: validators.minAuditNote(values.message, 4),
    }),
    onSubmit: async (values) => {
      try {
        dataService.postGroundBroadcast({
          locationId: values.locationId,
          severity: values.severity,
          title: values.title.trim() || `Ground Dispatch - ${activeMember.fullName}`,
          message: values.message.trim(),
          photoUrl,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Broadcast Dispatched',
          message: 'Announcement posted to the organization stream.',
        });
        onBroadcastPosted?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Broadcast Failed',
          message: err?.message || 'Could not send broadcast.',
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
      title="Team Broadcast"
      subtitle="Publish an alert or operational dispatch"
      isSubmitting={form.isSubmitting}
      submitLabel="Send Broadcast"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target Location" required>
            <select
              value={form.values.locationId}
              onChange={(e) => form.setValue('locationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium"
            >
              <option value="ALL">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Alert Severity" required>
            <select
              value={form.values.severity}
              onChange={(e) => form.setValue('severity', e.target.value as NotificationSeverity)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium"
            >
              <option value="URGENT_GROUND">🚨 Urgent Ground</option>
              <option value="INFO">ℹ️ General Info</option>
              <option value="WARNING_CONTRA">⚠️ Warning / Attention</option>
              <option value="FINANCIAL">💰 Financial Alert</option>
              <option value="MILESTONE">🎯 Milestone Goal</option>
            </select>
          </Field>
        </div>

        <Field label="Headline / Subject (Optional)">
          <input
            type="text"
            value={form.values.title}
            onChange={(e) => form.setValue('title', e.target.value)}
            placeholder="e.g. Broiler Batch 4 Harvest Ready"
            className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm"
          />
        </Field>

        <Field
          label="Dispatch Message"
          required
          error={form.errors.message}
          hint="Audit trail requires minimum 4 characters."
        >
          <textarea
            rows={3}
            value={form.values.message}
            onChange={(e) => form.setValue('message', e.target.value)}
            placeholder="Describe operational dispatch, urgent instruction, or update..."
            className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm"
          />
        </Field>

        <div>
          <button
            type="button"
            onClick={handleCapturePhoto}
            className="w-full py-2.5 px-3 border border-dashed border-[#E0D7C6] rounded-xl text-xs font-bold text-slate-800 hover:bg-[#FAF8F5] flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>📷</span>
            {photoUrl ? 'Replace Attachment Photo' : 'Attach Photo Dispatch'}
          </button>
          {photoUrl && (
            <div className="mt-2 relative rounded-lg overflow-hidden h-28 border border-[#E8DFCE]">
              <img src={photoUrl} alt="Broadcast attachment" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

