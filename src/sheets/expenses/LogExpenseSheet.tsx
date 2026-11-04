import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { nativeCamera } from '../../native/camera.ts';
import { nativeFiles } from '../../native/files.ts';
import { Camera, Image as ImageIcon, MapPin, X } from 'lucide-react';
import type { ExpenseCategory, FarmLocation, LivestockEntry, OrgMember } from '../../types/agro.ts';
import type { RunwayAllocation } from '../../types/runway.ts';

export interface LogExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locations?: FarmLocation[];
  batches?: LivestockEntry[];
  activeMember: OrgMember;
  leftMoney?: number;
  runwayAllocation?: RunwayAllocation;
  onExpenseLogged?: () => void;
  onRequestSpendGate?: (amt: number, payload: any) => void;
}

export const LogExpenseSheet: React.FC<LogExpenseSheetProps> = ({
  isOpen,
  onClose,
  locations = dataService.getState().locations || [],
  batches = dataService.getState().livestockEntries || [],
  activeMember,
  leftMoney = dataService.getFinancialSummary().leftMoney,
  runwayAllocation,
  onExpenseLogged,
  onRequestSpendGate,
}) => {
  const { showToast } = useToast();
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const form = useForm({
    initial: {
      amount: '',
      category: 'FEED' as ExpenseCategory,
      locationId: locations[0]?.id || '',
      batchId: '',
      note: '',
    },
    draftKey: 'expense_log_draft',
    validate: (values) => ({
      amount: validators.positiveNumber(values.amount, 'Expense amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      const amt = parseFloat(values.amount);

      try {
        dataService.logExpense({
          locationId: values.locationId || locations[0]?.id,
          batchOrAnimalId: values.batchId || undefined,
          category: values.category,
          direction: 'DEDUCTION',
          amount: amt,
          note: values.note.trim(),
          receiptPhotoDataUrl: photoDataUrl || undefined,
          actor: activeMember,
          runwayAllocation,
        });

        showToast(`Logged ${values.category} expense of ${formatMoney(amt)}.`);
        if (onExpenseLogged) onExpenseLogged();
        onClose();
      } catch (err: any) {
        const isRunwayGate =
          err?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
          err?.code === 'RUNWAY_LINE_OVERRUN' ||
          err?.message?.toLowerCase().includes('runway spend gate blocked');

        if (isRunwayGate && onRequestSpendGate) {
          onRequestSpendGate(amt, {
            locationId: values.locationId || locations[0]?.id,
            batchOrAnimalId: values.batchId || undefined,
            category: values.category,
            direction: 'DEDUCTION',
            amount: amt,
            note: values.note.trim(),
            receiptPhotoDataUrl: photoDataUrl || undefined,
            actor: activeMember,
          });
          onClose();
        } else {
          throw err;
        }
      }
    },
  });

  const handleCapturePhoto = async () => {
    const photo = await nativeCamera.takePhoto();
    if (photo?.dataUrl) {
      const filename = `receipt_${Date.now()}.jpg`;
      const saved = await nativeFiles.saveImageFile(photo.dataUrl, filename);
      setPhotoDataUrl(saved || photo.dataUrl);
    }
  };

  const handlePickGallery = async () => {
    const photo = await nativeCamera.pickFromGallery();
    if (photo?.dataUrl) {
      const filename = `receipt_${Date.now()}.jpg`;
      const saved = await nativeFiles.saveImageFile(photo.dataUrl, filename);
      setPhotoDataUrl(saved || photo.dataUrl);
    }
  };

  const amtNum = parseFloat(form.values.amount) || 0;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Log Cash Expenditure"
      subtitle="Outflow logged against immutable ledger"
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty || Boolean(photoDataUrl)}
      stickyError={form.stickyError}
      submitLabel={`Disburse ${formatMoney(amtNum)}`}
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
          <span className="text-slate-500">Available Liquid Cash:</span>
          <span className="font-mono font-bold text-emerald-700">{formatMoney(leftMoney)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              value={form.values.category}
              onChange={(e) => form.setFieldValue('category', e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="FEED">Feed / Animal Rations</option>
              <option value="MEDICATION">Medication / Vaccines</option>
              <option value="EQUIPMENT">Equipment &amp; Tools</option>
              <option value="LABOR">Labor &amp; Staff Wages</option>
              <option value="LOGISTICS">Transport &amp; Fuel</option>
              <option value="UTILITIES">Electricity &amp; Water</option>
              <option value="LIVESTOCK_PURCHASE">Livestock / Day-Old Chicks</option>
              <option value="OTHER">Other Expense</option>
            </select>
          </Field>

          <Field label="Amount Spent" required error={form.errors.amount}>
            <MoneyInput
              value={form.values.amount}
              onChange={(val) => form.setFieldValue('amount', val)}
              hasError={Boolean(form.errors.amount)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Site Location" required>
            <select
              value={form.values.locationId}
              onChange={(e) => form.setFieldValue('locationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>

          {batches.length > 0 && (
            <Field label="Linked Batch" hint="Optional">
              <select
                value={form.values.batchId}
                onChange={(e) => form.setFieldValue('batchId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Farm General / Overhead</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameOrTag}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {/* Receipt Attachment Buttons */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Receipt Attachment (Optional)</label>
          {photoDataUrl ? (
            <div className="relative inline-block rounded-2xl overflow-hidden border border-slate-200">
              <img src={photoDataUrl} alt="Receipt preview" className="w-24 h-24 object-cover" />
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

        <Field
          label="Mandatory Audit Explanation"
          required
          hint="Min 4 characters (recorded in ledger)"
          error={form.errors.note}
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            placeholder="Explain why this money was disbursed..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

