import React, { useState, useMemo } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { Plus, Trash2, Layers, DollarSign, Calendar, FileText, AlertCircle, Bell, Users, Radio } from 'lucide-react';
import type { FarmLocation, LivestockComputedStatus, OrgMember } from '../../types/agro.ts';

export interface RecordCreditSaleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locations?: FarmLocation[];
  livestockStatuses?: LivestockComputedStatus[];
  activeMember: OrgMember;
  onSaleCreated?: () => void;
}

export interface FormSaleItem {
  id: string;
  livestockId: string;
  customName: string;
  quantity: string;
  unitPrice: string;
}

export const RecordCreditSaleSheet: React.FC<RecordCreditSaleSheetProps> = ({
  isOpen,
  onClose,
  locations = dataService.getState().locations || [],
  livestockStatuses = dataService.computeLivestockStatuses(),
  activeMember,
  onSaleCreated,
}) => {
  const { showToast } = useToast();
  const [stickyError, setStickyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer & Location
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.id || '');

  // Filter available livestock statuses (strictly those with live headcount > 0)
  const availableLivestock = useMemo(() => {
    return livestockStatuses.filter(
      (s) =>
        s.currentLiveHeadcount > 0 &&
        (!locationId || s.entry.locationId === locationId || !s.entry.locationId)
    );
  }, [livestockStatuses, locationId]);

  // Dynamic Sale Items
  const createDefaultItem = (firstAvailableId = ''): FormSaleItem => {
    const firstStatus =
      (firstAvailableId ? availableLivestock.find((s) => s.entry.id === firstAvailableId) : null) ||
      availableLivestock[0];
    const defaultPrice = firstStatus?.entry.configuredSalePricePerUnit
      ? String(firstStatus.entry.configuredSalePricePerUnit)
      : '6.00';
    return {
      id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      livestockId: firstStatus?.entry.id || '',
      customName: '',
      quantity: firstStatus ? '1' : '0',
      unitPrice: defaultPrice,
    };
  };

  const [items, setItems] = useState<FormSaleItem[]>([createDefaultItem()]);

  // Payment & Terms
  const [depositPaid, setDepositPaid] = useState('0.00');
  const [agreedDueDate, setAgreedDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState(
    'Net 14 Days - Full balance payable on or before agreed date'
  );
  const [note, setNote] = useState('');
  const [broadcastNow, setBroadcastNow] = useState(false);

  // Reset or initialize when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStickyError(null);
      setIsSubmitting(false);
      setItems([createDefaultItem(availableLivestock[0]?.entry.id || '')]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setDepositPaid('0.00');
      setNote('');
      if (locations.length > 0) {
        setLocationId(locations[0].id);
      }
    }
  }, [isOpen]);

  // Item manipulation helpers
  const handleAddItem = () => {
    const usedIds = new Set(items.map((i) => i.livestockId));
    const nextAvailable = availableLivestock.find((s) => !usedIds.has(s.entry.id));
    if (!nextAvailable) {
      setStickyError('All available livestock batches at this location have already been added.');
      return;
    }
    setItems((prev) => [...prev, createDefaultItem(nextAvailable.entry.id)]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof FormSaleItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // If animal was changed, update default unit price if configured
        if (field === 'livestockId') {
          const status = availableLivestock.find((s) => s.entry.id === value);
          if (status?.entry.configuredSalePricePerUnit) {
            updated.unitPrice = String(status.entry.configuredSalePricePerUnit);
          }
          if (status && (parseInt(updated.quantity, 10) || 0) > status.currentLiveHeadcount) {
            updated.quantity = String(status.currentLiveHeadcount);
          }
        }

        return updated;
      })
    );
  };

  // Calculations
  const totalAmount = items.reduce((acc, it) => {
    const q = parseInt(it.quantity, 10) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    return acc + q * p;
  }, 0);

  const totalHeadcountSold = items.reduce((acc, it) => {
    return acc + (parseInt(it.quantity, 10) || 0);
  }, 0);

  const depositNum = parseFloat(depositPaid) || 0;
  const balanceRemaining = Math.max(0, totalAmount - depositNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStickyError(null);

    // Validation
    if (!customerName.trim()) {
      setStickyError('Customer full name is required.');
      return;
    }

    if (availableLivestock.length === 0) {
      setStickyError(
        'No live animals available in inventory to sell. Credit sales cannot be processed without available stock.'
      );
      return;
    }

    if (items.length === 0) {
      setStickyError('At least one animal batch must be selected.');
      return;
    }

    // Check each item strictly
    const batchSoldMap = new Map<string, number>();

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.livestockId) {
        setStickyError(`Item #${i + 1}: Please select an animal batch from inventory.`);
        return;
      }

      const status = availableLivestock.find((s) => s.entry.id === it.livestockId);
      if (!status || status.currentLiveHeadcount <= 0) {
        setStickyError(`Item #${i + 1}: Selected animal batch is out of stock in inventory.`);
        return;
      }

      const q = parseInt(it.quantity, 10);
      if (!q || q <= 0) {
        setStickyError(`Item #${i + 1} (${status.entry.nameOrTag}): Quantity must be at least 1.`);
        return;
      }

      const p = parseFloat(it.unitPrice);
      if (isNaN(p) || p <= 0) {
        setStickyError(`Item #${i + 1} (${status.entry.nameOrTag}): Unit selling price must be greater than zero.`);
        return;
      }

      const totalRequested = (batchSoldMap.get(it.livestockId) || 0) + q;
      batchSoldMap.set(it.livestockId, totalRequested);

      if (totalRequested > status.currentLiveHeadcount) {
        setStickyError(
          `Item #${i + 1} (${status.entry.nameOrTag}): Selling quantity (${totalRequested}) exceeds available live headcount (${status.currentLiveHeadcount}).`
        );
        return;
      }
    }

    if (totalAmount <= 0) {
      setStickyError('Total sale amount must be greater than zero.');
      return;
    }

    if (depositNum > totalAmount) {
      setStickyError(`Deposit paid ($${depositNum.toFixed(2)}) cannot exceed total sale ($${totalAmount.toFixed(2)}).`);
      return;
    }

    if (!agreedDueDate) {
      setStickyError('Agreed settlement due date is required.');
      return;
    }

    if (!note.trim() || note.trim().length < 4) {
      setStickyError('Mandatory audit note (at least 4 characters) is required by security rules.');
      return;
    }

    setIsSubmitting(true);

    try {
      const saleItems = items.map((it) => {
        const status = availableLivestock.find((s) => s.entry.id === it.livestockId)!;
        const q = parseInt(it.quantity, 10);
        const p = parseFloat(it.unitPrice);
        return {
          id: it.id,
          livestockId: it.livestockId,
          livestockName: status.entry.nameOrTag,
          quantitySold: q,
          unitPrice: p,
          totalAmount: q * p,
        };
      });

      const created = dataService.recordCreditSale({
        locationId: locationId || locations[0]?.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        quantitySold: totalHeadcountSold,
        totalSaleAmountUsd: Number(totalAmount.toFixed(2)),
        depositPaidCash: Number(depositNum.toFixed(2)),
        agreedSettlementDate: agreedDueDate,
        paymentTerms: paymentTerms.trim(),
        notes: note.trim(),
        actor: activeMember,
        items: saleItems,
      });

      if (broadcastNow && created.agreedSettlementDate) {
        dataService.broadcastFinancialDueAlert({
          entityType: 'CREDIT_SALE',
          entityId: created.id,
          partyName: created.customerName,
          amount: created.creditBalanceRemaining,
          dueDate: created.agreedSettlementDate,
          customNote: created.notes,
          actor: activeMember,
        });
      }

      showToast(
        `Credit sale of $${totalAmount.toFixed(2)} (${totalHeadcountSold} animals) recorded for ${customerName.trim()}.`
      );

      if (onSaleCreated) onSaleCreated();
      onClose();
    } catch (err: any) {
      setStickyError(err.message || 'Error recording credit sale.');
      setIsSubmitting(false);
    }
  };

  const isSubmitBlocked =
    availableLivestock.length === 0 ||
    items.length === 0 ||
    items.some((it) => !it.livestockId) ||
    totalAmount <= 0;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Credit Sale"
      subtitle={`Customer, Animals, Initial Deposit & Credit Terms (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
      dirty={Boolean(customerName || note || items.length > 1 || depositNum > 0)}
      isSubmitting={isSubmitting}
      stickyError={stickyError}
      submitLabel={
        availableLivestock.length === 0
          ? 'No Stock Available to Sell'
          : isSubmitBlocked
            ? 'Select Livestock to Sell'
            : balanceRemaining > 0
              ? `Save Credit Sale (${formatMoney(balanceRemaining)} Owed)`
              : 'Save Paid Sale'
      }
      onSubmit={handleSubmit}
      footerExtra={
        <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Total Sale</span>
            <span className="font-bold text-slate-900">{formatMoney(totalAmount)}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-700 block font-sans font-bold">Deposit Paid</span>
            <span className="font-bold text-emerald-600">{formatMoney(depositNum)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-amber-700 block font-sans font-bold">Balance Owed</span>
            <span className="font-black text-rose-600">{formatMoney(balanceRemaining)}</span>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Section 1: Customer & Location */}
        <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <Field label="Customer Full Name" required>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. John Doe / City Butchery"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Customer Phone" hint="Optional">
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +263 77..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            <Field label="Farm Location" required>
              <select
                value={locationId}
                onChange={(e) => {
                  const newLocId = e.target.value;
                  setLocationId(newLocId);
                  // Refresh items against the new location's available stock
                  const newAvailable = livestockStatuses.filter(
                    (s) =>
                      s.currentLiveHeadcount > 0 &&
                      (!newLocId || s.entry.locationId === newLocId || !s.entry.locationId)
                  );
                  if (newAvailable.length > 0) {
                    setItems([
                      {
                        id: `ITEM-${Date.now()}`,
                        livestockId: newAvailable[0].entry.id,
                        customName: '',
                        quantity: '1',
                        unitPrice: newAvailable[0].entry.configuredSalePricePerUnit
                          ? String(newAvailable[0].entry.configuredSalePricePerUnit)
                          : '6.00',
                      },
                    ]);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Warning if 0 live stock available */}
        {availableLivestock.length === 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>No Live Animals Available in Inventory</span>
            </div>
            <p className="text-[11px] text-rose-800 font-medium leading-relaxed">
              There are currently 0 live animals available to sell at this farm location.
              Every credit sale must be linked to active livestock in inventory to deduct live headcount and prevent phantom sales.
            </p>
          </div>
        )}

        {/* Section 2: Animals & Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Animals Sold ({items.length})
              </h4>
            </div>

            <button
              type="button"
              disabled={items.length >= availableLivestock.length || availableLivestock.length === 0}
              onClick={handleAddItem}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${items.length >= availableLivestock.length || availableLivestock.length === 0
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 cursor-pointer'
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Batch</span>
            </button>
          </div>

          {items.map((item, idx) => {
            const selectedStatus = availableLivestock.find((s) => s.entry.id === item.livestockId);
            const maxAvailable = selectedStatus ? selectedStatus.currentLiveHeadcount : 0;
            const currentQty = parseInt(item.quantity, 10) || 0;
            const isOverStock = maxAvailable > 0 && currentQty > maxAvailable;
            const lineSubtotal = currentQty * (parseFloat(item.unitPrice) || 0);

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-colors space-y-3 ${!item.livestockId
                  ? 'bg-amber-50/50 border-amber-300'
                  : isOverStock
                    ? 'bg-rose-50/40 border-rose-300'
                    : 'bg-slate-50/80 border-slate-200'
                  }`}
              >
                {/* Item header with item # and remove button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{selectedStatus?.entry.nameOrTag || 'Select Livestock Batch'}</span>
                  </span>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Livestock Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Select Livestock Batch to Sell <span className="text-rose-500">*</span>
                    </label>
                    {selectedStatus && (
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {selectedStatus.currentLiveHeadcount} live in inventory
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={item.livestockId}
                    onChange={(e) => handleItemChange(item.id, 'livestockId', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white text-xs font-bold ${!item.livestockId
                      ? 'border-amber-400 text-amber-900 ring-2 ring-amber-400/20'
                      : 'border-slate-200 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500'
                      }`}
                  >
                    <option value="" disabled>
                      -- Select Available Livestock Batch (Required) * --
                    </option>
                    {availableLivestock.map((ls) => (
                      <option key={ls.entry.id} value={ls.entry.id}>
                        {ls.entry.nameOrTag} · {ls.currentLiveHeadcount} available ({ls.entry.species})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity & Unit Price */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">Quantity Sold <span className="text-rose-500">*</span></label>
                      {maxAvailable > 0 && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(item.id, 'quantity', String(maxAvailable))}
                          className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                        >
                          Max ({maxAvailable})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={maxAvailable || undefined}
                      value={item.quantity}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border bg-white text-xs font-mono font-bold focus:outline-hidden focus:ring-2 ${isOverStock
                        ? 'border-rose-400 text-rose-700 focus:ring-rose-500'
                        : 'border-slate-200 text-slate-800 focus:ring-amber-500'
                        }`}
                    />
                    {isOverStock && (
                      <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                        Exceeds available stock ({maxAvailable} max)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Unit Price ($) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={item.unitPrice}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Item Subtotal Preview */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Subtotal: {currentQty} × ${parseFloat(item.unitPrice || '0').toFixed(2)}
                  </span>
                  <span className="font-mono font-black text-slate-900">${lineSubtotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section 3: Prominent Initial Deposit Field */}
        <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Initial Cash Deposit Paid Today
              </label>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {formatMoney(depositNum)}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Amount paid in upfront cash by the customer today. If none, select No Deposit ($0).
          </p>

          {/* Quick deposit shortcut chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDepositPaid('0.00')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${depositNum === 0
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
            >
              No Deposit ($0)
            </button>
            {totalAmount > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setDepositPaid((totalAmount * 0.25).toFixed(2))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 text-[11px] font-bold cursor-pointer"
                >
                  25% (${(totalAmount * 0.25).toFixed(0)})
                </button>
                <button
                  type="button"
                  onClick={() => setDepositPaid((totalAmount * 0.5).toFixed(2))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 text-[11px] font-bold cursor-pointer"
                >
                  50% (${(totalAmount * 0.5).toFixed(0)})
                </button>
                <button
                  type="button"
                  onClick={() => setDepositPaid(totalAmount.toFixed(2))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold cursor-pointer"
                >
                  Full (${totalAmount.toFixed(0)})
                </button>
              </>
            )}
          </div>

          <MoneyInput
            value={depositPaid}
            onChange={(val) => setDepositPaid(val)}
          />

          {/* Balance Preview inside deposit card */}
          <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Remaining Customer Balance Owed:</span>
            <span className="font-mono font-black text-rose-600 text-sm">
              {formatMoney(balanceRemaining)}
            </span>
          </div>
        </div>

        {/* Section 4: Settlement Due Date & Terms */}
        <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-600" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Agreed Settlement Due Date <span className="text-rose-500">*</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { label: '+7 Days', days: 7 },
              { label: '+14 Days', days: 14 },
              { label: '+30 Days', days: 30 },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + chip.days);
                  setAgreedDueDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            required
            value={agreedDueDate}
            onChange={(e) => setAgreedDueDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />

          {/* Morning Notification Schedule & Member Scope Preview */}
          {agreedDueDate && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span>Morning Dispatch Notification</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  09:00 AM Alert
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  Settlement Due: {new Date(agreedDueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <div className="flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed pt-1.5 border-t border-amber-200/60">
                <Users className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Org-Wide Reach:</strong> Morning alerts will notify team members across the organization on the due date so credit collection is managed promptly.
                </span>
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastNow}
                  onChange={(e) => setBroadcastNow(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  Dispatch immediate broadcast to all org members right now
                </span>
              </label>
            </div>
          )}

          <Field label="Payment Terms Note">
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. Net 14 Days"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>
        </div>

        {/* Section 5: Mandatory Audit Trail Note */}
        <div className="space-y-2 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-600" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Mandatory Audit Note <span className="text-rose-500">*</span>
            </label>
          </div>

          <textarea
            rows={2}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain transaction agreement (e.g. Approved by treasurer for City Butchery, $40 upfront deposit received)..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[10px] text-slate-400">At least 4 characters required for immutable audit log.</span>
        </div>
      </div>
    </FormSheet>
  );
};
