import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { ImageViewerSheet } from '../../components/ui/ImageViewerSheet.tsx';
import { Camera, Image as ImageIcon, X, Eye, Upload } from 'lucide-react';
import type { ExpenseCategory, FarmLocation, LivestockEntry, OrgMember } from '../../types/agro.ts';
import type { RunwayAllocation } from '../../types/runway.ts';

const AGRO_EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'FEED', label: 'Feed / Animal Rations' },
  { value: 'VACCINES_MEDICATION', label: 'Medication / Vaccines' },
  { value: 'FIXED_ASSET_PURCHASE', label: 'Equipment & Tools' },
  { value: 'LABOR_WAGES', label: 'Labor & Staff Wages' },
  { value: 'TRANSPORT_LOGISTICS', label: 'Transport & Fuel' },
  { value: 'UTILITIES_SECURITY', label: 'Electricity & Water' },
  { value: 'LIVESTOCK_PURCHASE', label: 'Livestock / Day-Old Chicks' },
  { value: 'OTHER', label: 'Other Expense' },
];

const GENERAL_EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'OTHER', label: 'General Operating / Inventory' },
  { value: 'LABOR_WAGES', label: 'Payroll & Staff Wages' },
  { value: 'TRANSPORT_LOGISTICS', label: 'Transport, Fuel & Logistics' },
  { value: 'UTILITIES_SECURITY', label: 'Rent, Utilities & Security' },
  { value: 'FIXED_ASSET_PURCHASE', label: 'Equipment & Supplies' },
  { value: 'MAINTENANCE', label: 'Maintenance & Repairs' },
];

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
  locations: locationsProp,
  batches: batchesProp,
  activeMember,
  leftMoney = dataService.getFinancialSummary().leftMoney,
  runwayAllocation,
  onExpenseLogged,
  onRequestSpendGate,
}) => {
  const { showToast } = useToast();
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAgro = dataService.isAgroOrganization(activeMember?.orgId);
  const categoryOptions = isAgro ? AGRO_EXPENSE_CATEGORIES : GENERAL_EXPENSE_CATEGORIES;
  const defaultCategory = (isAgro ? 'FEED' : 'OTHER') as ExpenseCategory;

  const locations = useMemo(() => {
    if (locationsProp) return locationsProp;
    const all = dataService.getState().locations || [];
    return activeMember?.orgId
      ? all.filter((l) => !l.orgId || l.orgId === activeMember.orgId)
      : all;
  }, [locationsProp, activeMember?.orgId, isOpen]);

  const batches = useMemo(() => {
    if (batchesProp) return batchesProp;
    const all = dataService.getState().livestockEntries || [];
    return activeMember?.orgId
      ? all.filter((b) => !b.orgId || b.orgId === activeMember.orgId)
      : all;
  }, [batchesProp, activeMember?.orgId, isOpen]);

  const form = useForm({
    initial: {
      amount: '',
      category: defaultCategory as ExpenseCategory,
      locationId: isAgro ? locations[0]?.id || '' : '',
      batchId: '',
      note: '',
    },
    draftKey: `expense_log_draft_${activeMember?.orgId || 'default'}_${isAgro ? 'agro' : 'general'}`,
    validate: (values) => {
      const errs: Record<string, string | null> = {
        amount: validators.positiveNumber(values.amount, 'Expense amount'),
        note: validators.minAuditNote(values.note, 4),
      };
      if (isAgro && !(values.locationId || locations[0]?.id)) {
        errs.locationId = 'Please register and select a farm site location first.';
      }
      return errs;
    },
    onSubmit: async (values) => {
      const amt = parseFloat(values.amount);
      const resolvedLocationId = isAgro ? values.locationId || locations[0]?.id : undefined;
      const resolvedBatchId = isAgro ? values.batchId || undefined : undefined;

      try {
        dataService.logExpense({
          locationId: resolvedLocationId,
          batchOrAnimalId: resolvedBatchId,
          category: values.category,
          direction: 'DEDUCTION',
          amount: amt,
          note: values.note.trim(),
          receiptPhotoDataUrl: photoDataUrl || undefined,
          actor: activeMember,
          runwayAllocation,
        });

        showToast(`Logged ${values.category.replace(/_/g, ' ')} expense of ${formatMoney(amt)}.`);
        form.reset({
          amount: '',
          category: defaultCategory,
          locationId: isAgro ? locations[0]?.id || '' : '',
          batchId: '',
          note: '',
        });
        setPhotoDataUrl(null);
        if (onExpenseLogged) onExpenseLogged();
        onClose();
      } catch (err: any) {
        const isRunwayGate =
          err?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
          err?.code === 'RUNWAY_LINE_OVERRUN' ||
          err?.message?.toLowerCase().includes('runway spend gate blocked');

        if (isRunwayGate && onRequestSpendGate) {
          onRequestSpendGate(amt, {
            locationId: resolvedLocationId,
            batchOrAnimalId: resolvedBatchId,
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

  useEffect(() => {
    const validValues = categoryOptions.map((c) => c.value);
    const hasValidCategory = validValues.includes(form.values.category);
    const nextCategory = hasValidCategory ? form.values.category : defaultCategory;
    const nextLocationId = isAgro ? form.values.locationId || locations[0]?.id || '' : '';
    const nextBatchId = isAgro ? form.values.batchId : '';

    if (
      nextCategory !== form.values.category ||
      nextLocationId !== form.values.locationId ||
      nextBatchId !== form.values.batchId
    ) {
      form.setValues(
        (prev) => ({
          ...prev,
          category: nextCategory,
          locationId: nextLocationId,
          batchId: nextBatchId,
        }),
        form.isDirty
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAgro, activeMember?.orgId, locations]);

  const handleCapturePhoto = async () => {
    try {
      const photo = await nativeCamera.takePhoto();
      if (photo?.dataUrl) {
        setPhotoDataUrl(photo.dataUrl);
        const filename = `receipt_${Date.now()}.jpg`;
        nativeFiles.saveImageFile(photo.dataUrl, filename).catch(() => { });
      }
    } catch {
      fileInputRef.current?.click();
    }
  };

  const handlePickGallery = async () => {
    try {
      const photo = await nativeCamera.pickFromGallery();
      if (photo?.dataUrl) {
        setPhotoDataUrl(photo.dataUrl);
        const filename = `receipt_${Date.now()}.jpg`;
        nativeFiles.saveImageFile(photo.dataUrl, filename).catch(() => { });
      }
    } catch {
      fileInputRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
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
              {categoryOptions.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
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

        {isAgro && (
          <div className={batches.length > 0 ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
            <Field label="Site Location" required error={form.errors.locationId}>
              <select
                value={form.values.locationId}
                onChange={(e) => form.setFieldValue('locationId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {locations.length === 0 ? (
                  <option value="">No farm site registered</option>
                ) : (
                  locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))
                )}
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
        )}

        {/* Receipt Attachment Buttons */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Receipt Attachment (Optional)</label>
          {photoDataUrl ? (
            <div className="flex items-center gap-3">
              <div
                onClick={() => setPreviewOpen(true)}
                className="group relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-400 bg-slate-100 cursor-pointer shadow-sm hover:ring-2 hover:ring-emerald-400 transition-all"
              >
                <img
                  src={photoDataUrl}
                  alt="Receipt preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Zoom</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Full Screen</span>
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Upload image file"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
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

      <ImageViewerSheet
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageUrl={photoDataUrl || ''}
        title="Expense Receipt Preview"
      />
    </FormSheet>
  );
};

