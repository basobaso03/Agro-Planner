import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type { OrgMember, TrackingMode, DurationUnit } from '../../types/agro.ts';

export interface RegisterBatchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onBatchRegistered?: () => void;
}

export const RegisterBatchSheet: React.FC<RegisterBatchSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onBatchRegistered,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      locationId: locations[0]?.id || '',
      species: 'Broilers',
      nameOrTag: '',
      trackingMode: 'BATCH' as TrackingMode,
      initialHeadcount: '100',
      initialAgeValue: '1',
      initialAgeUnit: 'DAYS' as DurationUnit,
      targetDurationValue: '6',
      targetDurationUnit: 'WEEKS' as DurationUnit,
      purchaseCost: '',
      fundingSource: 'CASH_POOL' as 'CASH_POOL' | 'SUPPLIER_CREDIT' | 'DIRECTOR_LOAN',
      creditorName: '',
      targetSaleWeightKg: '2.2',
      notes: '',
    },
    validate: (values) => ({
      locationId: !values.locationId ? 'Farm site is required' : null,
      species: validators.required(values.species, 'Species'),
      nameOrTag: validators.required(values.nameOrTag, 'Batch name or tag ID'),
      initialHeadcount: validators.positiveInteger(values.initialHeadcount, 'Headcount'),
      targetDurationValue: validators.positiveInteger(values.targetDurationValue, 'Target duration'),
      notes: validators.minAuditNote(values.notes, 4),
    }),
    onSubmit: async (values) => {
      try {
        const cost = parseFloat(values.purchaseCost || '0');
        dataService.registerLivestock({
          locationId: values.locationId,
          species: values.species.trim(),
          nameOrTag: values.nameOrTag.trim(),
          trackingMode: values.trackingMode,
          initialHeadcount: parseInt(values.initialHeadcount, 10),
          initialAgeValue: parseInt(values.initialAgeValue || '1', 10),
          initialAgeUnit: values.initialAgeUnit,
          targetDurationValue: parseInt(values.targetDurationValue, 10),
          targetDurationUnit: values.targetDurationUnit,
          purchaseCostTotal: cost,
          autoDeductPurchaseFromLeftMoney: values.fundingSource === 'CASH_POOL' && cost > 0,
          fundingSource: values.fundingSource,
          supplierCreditorName: values.fundingSource === 'SUPPLIER_CREDIT' ? values.creditorName : undefined,
          targetSaleWeightKg: parseFloat(values.targetSaleWeightKg) || undefined,
          imageUrl: photoUrl,
          notes: values.notes.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Livestock Registered',
          message: `${values.nameOrTag} added to farm inventory.`,
        });
        onBatchRegistered?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Registration Failed',
          message: err?.message || 'Could not register livestock.',
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
      title="Register Livestock"
      subtitle="Onboard a new animal batch or tagged pedigree"
      isSubmitting={form.isSubmitting}
      submitLabel="Register Stock"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Farm Location" required error={form.errors.locationId}>
          <select
            value={form.values.locationId}
            onChange={(e) => form.setValue('locationId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Species" required error={form.errors.species}>
            <select
              value={form.values.species}
              onChange={(e) => form.setValue('species', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="Broilers">Broilers</option>
              <option value="Layers">Layers</option>
              <option value="Boer Goats">Boer Goats</option>
              <option value="Cattle">Cattle</option>
              <option value="Pigs">Pigs</option>
              <option value="Sheep">Sheep</option>
              <option value="Road Runners">Road Runners</option>
            </select>
          </Field>

          <Field label="Tracking Mode" required>
            <select
              value={form.values.trackingMode}
              onChange={(e) => form.setValue('trackingMode', e.target.value as TrackingMode)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="BATCH">Batch Flock / Herd</option>
              <option value="INDIVIDUAL_TAG">Individual Tagged</option>
            </select>
          </Field>
        </div>

        <Field label="Batch Name or Tag ID" required error={form.errors.nameOrTag}>
          <input
            type="text"
            value={form.values.nameOrTag}
            onChange={(e) => form.setValue('nameOrTag', e.target.value)}
            placeholder="e.g. Broiler Batch #05 or Buck #GT-09"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Initial Headcount" required error={form.errors.initialHeadcount}>
            <input
              type="number"
              min={1}
              value={form.values.initialHeadcount}
              onChange={(e) => form.setValue('initialHeadcount', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Target Weight (kg)">
            <input
              type="number"
              step="0.1"
              value={form.values.targetSaleWeightKg}
              onChange={(e) => form.setValue('targetSaleWeightKg', e.target.value)}
              placeholder="e.g. 2.2"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age on Entry">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={form.values.initialAgeValue}
                onChange={(e) => form.setValue('initialAgeValue', e.target.value)}
                className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center"
              />
              <select
                value={form.values.initialAgeUnit}
                onChange={(e) => form.setValue('initialAgeUnit', e.target.value as DurationUnit)}
                className="flex-1 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="DAYS">Days</option>
                <option value="WEEKS">Weeks</option>
                <option value="MONTHS">Months</option>
              </select>
            </div>
          </Field>

          <Field label="Target Duration to Market" required error={form.errors.targetDurationValue}>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={form.values.targetDurationValue}
                onChange={(e) => form.setValue('targetDurationValue', e.target.value)}
                className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center"
              />
              <select
                value={form.values.targetDurationUnit}
                onChange={(e) => form.setValue('targetDurationUnit', e.target.value as DurationUnit)}
                className="flex-1 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="DAYS">Days</option>
                <option value="WEEKS">Weeks</option>
                <option value="MONTHS">Months</option>
              </select>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Field label="Total Purchase Cost (USD)">
            <MoneyInput
              value={form.values.purchaseCost}
              onChange={(val) => form.setValue('purchaseCost', val)}
              placeholder="0.00"
            />
          </Field>

          <Field label="Funding Source">
            <select
              value={form.values.fundingSource}
              onChange={(e) => form.setValue('fundingSource', e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="CASH_POOL">Left Money Cash Pool</option>
              <option value="SUPPLIER_CREDIT">Supplier Credit (Pay Later)</option>
              <option value="DIRECTOR_LOAN">Director / Sponsor Loan</option>
            </select>
          </Field>
        </div>

        {form.values.fundingSource === 'SUPPLIER_CREDIT' && (
          <Field label="Supplier Creditor Name">
            <input
              type="text"
              value={form.values.creditorName}
              onChange={(e) => form.setValue('creditorName', e.target.value)}
              placeholder="e.g. Irvine's Chicks Ltd"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        )}

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
            placeholder="e.g. Delivered 100 day-old chicks in good health"
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
            {photoUrl ? 'Replace Batch Photo' : 'Attach Batch Arrival Photo'}
          </button>
          {photoUrl && (
            <div className="mt-2 relative rounded-lg overflow-hidden h-24 border border-slate-200 dark:border-slate-700">
              <img src={photoUrl} alt="Batch verification" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

