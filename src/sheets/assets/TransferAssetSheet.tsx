import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { promptPhotoSource } from '../../native/camera.ts';
import type { FixedAssetLedgerEvent, OrgMember, AssetCondition } from '../../types/agro.ts';

export interface TransferAssetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetLedgerEvent;
  activeMember: OrgMember;
  onAssetTransferred?: () => void;
}

export const TransferAssetSheet: React.FC<TransferAssetSheetProps> = ({
  isOpen,
  onClose,
  asset,
  activeMember,
  onAssetTransferred,
}) => {
  const { showToast } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const locations = dataService.getState().locations.filter(
    (l) => l.orgId === (activeMember.orgId ?? 'ORG-001') && l.id !== asset.locationId
  );

  const form = useForm({
    initial: {
      toLocationId: locations[0]?.id ?? '',
      quantity: String(asset.quantityDelta > 0 ? asset.quantityDelta : 1),
      value: String(asset.valueDelta > 0 ? asset.valueDelta : 0),
      condition: (asset.condition || 'GOOD') as AssetCondition,
      note: '',
    },
    validate: (values) => ({
      toLocationId: !values.toLocationId ? 'Select destination site' : null,
      quantity: validators.positiveInteger(values.quantity, 'Quantity'),
      value: validators.positiveNumber(values.value, 'Value to transfer'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      try {
        dataService.transferFixedAssetBetweenLocations({
          assetGroupId: asset.assetGroupId,
          assetName: asset.assetName,
          category: asset.category,
          fromLocationId: asset.locationId,
          toLocationId: values.toLocationId,
          quantityToTransfer: parseInt(values.quantity, 10),
          valueToTransfer: parseFloat(values.value),
          condition: values.condition,
          note: values.note.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Asset Transferred',
          message: `${asset.assetName} moved successfully to target site.`,
        });
        onAssetTransferred?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Transfer Failed',
          message: err?.message || 'Could not transfer asset.',
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
      title="Transfer Fixed Asset"
      subtitle={`Move "${asset.assetName}" to another site`}
      isSubmitting={form.isSubmitting}
      submitLabel="Confirm Transfer"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        {/* Source info pill */}
        <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E8DFCE]">
          <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Origin Location</div>
          <div className="text-sm font-black text-slate-950 mt-0.5">
            {locations.find((l) => l.id === asset.locationId)?.name || asset.locationId}
          </div>
          <div className="text-xs text-slate-600 font-medium mt-1">
            Current Recorded Value: {formatMoney(asset.valueDelta)} · Qty: {asset.quantityDelta}
          </div>
        </div>

        {/* Destination Location */}
        <Field label="Destination Location" required error={form.errors.toLocationId}>
          {locations.length === 0 ? (
            <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-300 font-medium">
              No alternate locations registered for this organization. Create a new site first.
            </div>
          ) : (
            <select
              value={form.values.toLocationId}
              onChange={(e) => form.setValue('toLocationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity to Move" required error={form.errors.quantity}>
            <input
              type="number"
              min={1}
              value={form.values.quantity}
              onChange={(e) => form.setValue('quantity', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium"
            />
          </Field>

          <Field label="Condition" required>
            <select
              value={form.values.condition}
              onChange={(e) => form.setValue('condition', e.target.value as AssetCondition)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium"
            >
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR_OPERATIONAL">Fair / In Use</option>
              <option value="NEEDS_MAINTENANCE">Needs Maintenance</option>
              <option value="SCRAP_RETIRED">Scrap / Broken</option>
            </select>
          </Field>
        </div>

        <Field label="Value to Transfer (USD)" required error={form.errors.value}>
          <MoneyInput
            value={form.values.value}
            onChange={(val) => form.setValue('value', val)}
            placeholder="0.00"
          />
        </Field>

        <Field
          label="Mandatory Transfer Reason"
          required
          error={form.errors.note}
          hint="Audit trail requires minimum 4 characters explanation."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Relocated diesel water pump to Site B for irrigation overhaul"
            className="w-full px-3 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm"
          />
        </Field>

        {/* Optional photo attachment */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Verification Photo (Optional)
          </label>
          <button
            type="button"
            onClick={handleCapturePhoto}
            className="w-full py-2.5 px-3 border border-dashed border-[#E0D7C6] rounded-xl text-xs font-bold text-slate-800 hover:bg-[#FAF8F5] flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>📷</span>
            {photoUrl ? 'Retake Site Transfer Photo' : 'Attach Transfer Condition Photo'}
          </button>
          {photoUrl && (
            <div className="mt-2 relative rounded-lg overflow-hidden h-24 border border-[#E8DFCE]">
              <img src={photoUrl} alt="Transfer verification" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

