import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Plus,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  User,
  Phone,
  CheckCircle2,
  CalendarClock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { CreditSaleEvent, FarmLocation, LivestockComputedStatus, OrgMember } from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';

interface CreditSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditSales: CreditSaleEvent[];
  locations: FarmLocation[];
  livestockStatuses: LivestockComputedStatus[];
  activeMember: OrgMember;
  showNumbers?: boolean;
}

export const CreditSalesModal: React.FC<CreditSalesModalProps> = ({
  isOpen,
  onClose,
  creditSales,
  locations,
  livestockStatuses,
  activeMember,
  showNumbers = true,
}) => {
  const [activeView, setActiveView] = useState<'LIST' | 'NEW' | 'REPAY' | 'EXTEND'>('LIST');
  const [selectedSale, setSelectedSale] = useState<CreditSaleEvent | null>(null);

  // New Credit Sale Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newLocId, setNewLocId] = useState(locations[0]?.id || '');
  const [newLivestockId, setNewLivestockId] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnitPrice, setNewUnitPrice] = useState('6.00');
  const [newDeposit, setNewDeposit] = useState('0');
  const [newAgreedDate, setNewAgreedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [newPaymentTerms, setNewPaymentTerms] = useState('Net 14 Days — Balance payable on or before agreed date');
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Repayment Form State
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('Cash (USD)');
  const [repayRef, setRepayRef] = useState('');
  const [repayNote, setRepayNote] = useState('');

  // Date Extension Form State
  const [extendNewDate, setExtendNewDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  if (!isOpen) return null;

  const totalOutstandingCredit = creditSales
    .filter((s) => s.status !== 'SETTLED')
    .reduce((acc, s) => acc + s.creditBalanceRemaining, 0);

  const totalCollectedDeposits = creditSales.reduce(
    (acc, s) => acc + s.depositPaidCash + (s.paymentLogs || []).reduce((pAcc, p) => pAcc + p.amount, 0),
    0
  );

  const activeSalesCount = creditSales.filter((s) => s.status !== 'SETTLED').length;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const qty = parseInt(newQuantity, 10);
    const unitP = parseFloat(newUnitPrice);
    const deposit = parseFloat(newDeposit) || 0;

    if (!newCustName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setFormError('Quantity sold must be at least 1.');
      return;
    }
    if (isNaN(unitP) || unitP <= 0) {
      setFormError('Unit price must be greater than zero.');
      return;
    }
    if (!newAgreedDate) {
      setFormError('Agreed settlement due date is required.');
      return;
    }
    if (newNotes.trim().length < 4) {
      setFormError('Mandatory audit notes (at least 4 characters) are required.');
      return;
    }

    try {
      dataService.recordCreditSale({
        locationId: newLocId || locations[0]?.id,
        livestockId: newLivestockId || undefined,
        customerName: newCustName.trim(),
        customerPhone: newCustPhone.trim(),
        customerAddress: newCustAddress.trim(),
        quantitySold: qty,
        unitPrice: unitP,
        depositPaidCash: deposit,
        agreedSettlementDate: newAgreedDate,
        paymentTerms: newPaymentTerms.trim(),
        notes: newNotes.trim(),
        actor: activeMember,
      });

      // Reset
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewNotes('');
      setNewDeposit('0');
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record credit sale.');
    }
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    setFormError('');

    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }
    if (amt > selectedSale.creditBalanceRemaining) {
      setFormError(`Payment ($${amt.toFixed(2)}) cannot exceed remaining balance ($${selectedSale.creditBalanceRemaining.toFixed(2)}).`);
      return;
    }

    try {
      dataService.recordCreditSalePayment({
        creditSaleId: selectedSale.id,
        amount: amt,
        paymentMethod: repayMethod,
        receiptReference: repayRef.trim() || undefined,
        note: repayNote.trim() || `Customer installment payment from ${selectedSale.customerName}`,
        actor: activeMember,
      });

      setRepayAmount('');
      setRepayNote('');
      setRepayRef('');
      setSelectedSale(null);
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record payment.');
    }
  };

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    setFormError('');

    if (!extendNewDate) {
      setFormError('Please select a new agreed settlement date.');
      return;
    }
    if (extendReason.trim().length < 4) {
      setFormError('Mandatory reason for extending the date (at least 4 characters) is required.');
      return;
    }

    try {
      dataService.extendCreditSaleDueDate({
        creditSaleId: selectedSale.id,
        newAgreedDate: extendNewDate,
        reason: extendReason.trim(),
        actor: activeMember,
      });

      setExtendNewDate('');
      setExtendReason('');
      setSelectedSale(null);
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to extend date.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#F0EBE1] bg-gradient-to-r from-amber-500/10 via-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Sales on Credit &amp; Receivables
                <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                  {activeSalesCount} Active
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Track deferred payments, customer due dates, date extensions &amp; member broadcasts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 sm:p-6 bg-[#FAF8F5] border-b border-[#E8DFCE]">
          <div className="bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Outstanding Receivables
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalOutstandingCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Owed by customers</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Total Cash Collected
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-emerald-600 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalCollectedDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Deposits &amp; installments in pool</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Quick Actions
            </span>
            {activeView === 'LIST' ? (
              <button
                type="button"
                onClick={() => setActiveView('NEW')}
                className="mt-1 w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Credit Sale
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveView('LIST');
                  setSelectedSale(null);
                  setFormError('');
                }}
                className="mt-1 w-full py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                ← Back to List
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {activeView === 'LIST' && (
            <div className="space-y-3">
              {creditSales.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#E8DFCE]">
                  <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700">No Sales on Credit Recorded</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    When you sell broilers, livestock, or produce on credit, record them here to track payment due dates and alert all members.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('NEW')}
                    className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    + Record First Credit Sale
                  </button>
                </div>
              ) : (
                creditSales.map((sale) => {
                  const isSettled = sale.status === 'SETTLED';
                  const dueMs = new Date(sale.agreedSettlementDate).getTime();
                  const isOverdue = !isSettled && dueMs < Date.now();

                  return (
                    <div
                      key={sale.id}
                      className={`p-4 rounded-2xl border transition-all ${isSettled
                          ? 'bg-slate-50/70 border-slate-200 opacity-80'
                          : isOverdue
                            ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                            : 'bg-white border-[#E8DFCE] shadow-xs hover:border-amber-400'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">{sale.customerName}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSettled
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isOverdue
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                            >
                              {isSettled ? '✓ Fully Settled' : isOverdue ? '⚠️ OVERDUE' : '⏳ Outstanding'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {sale.customerPhone || 'No Phone'}
                            </span>
                            <span>•</span>
                            <span>{sale.quantitySold}x {sale.livestockName || 'Produce items'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                              <Calendar className="w-3 h-3 text-amber-500" />
                              Due: {new Date(sale.agreedSettlementDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-start sm:items-end">
                          <span className="text-xs text-slate-400">Balance Owed</span>
                          <span className={`text-base font-black font-mono ${isSettled ? 'text-slate-400' : 'text-rose-600'}`}>
                            ${sale.creditBalanceRemaining.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Total: ${sale.totalSaleAmount.toFixed(2)} (Deposit: ${sale.depositPaidCash.toFixed(2)})
                          </span>
                        </div>
                      </div>

                      {/* Date Extension History Banner */}
                      {sale.dateExtensions && sale.dateExtensions.length > 0 && (
                        <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-300/40 text-[11px] text-amber-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                            Date extended {sale.dateExtensions.length} time{sale.dateExtensions.length > 1 ? 's' : ''}: {sale.dateExtensions[0].reason}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            by {sale.dateExtensions[0].authorizedByName}
                          </span>
                        </div>
                      )}

                      {/* Action Bar */}
                      {!isSettled && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSale(sale);
                              setExtendNewDate(sale.agreedSettlementDate);
                              setExtendReason('');
                              setActiveView('EXTEND');
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                            Extend Due Date
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSale(sale);
                              setRepayAmount(String(sale.creditBalanceRemaining));
                              setRepayNote('');
                              setRepayRef('');
                              setActiveView('REPAY');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Record Payment ($)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* NEW CREDIT SALE VIEW */}
          {activeView === 'NEW' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                📢 <strong>Automatic Member Transparency:</strong> Recording a credit sale updates livestock headcount, adds any upfront cash deposit to Left Money, and automatically dispatches a notification to all members with the customer name, amount, and agreed settlement date.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="cs-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Customer / Business Name *
                  </label>
                  <input
                    id="cs-name"
                    type="text"
                    required
                    placeholder="e.g. Downtown Braai & Butchery or Mrs. Moyo"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="cs-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Phone Number *
                  </label>
                  <input
                    id="cs-phone"
                    type="tel"
                    required
                    placeholder="e.g. +263 77 123 4567"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="cs-loc" className="block text-xs font-bold text-slate-700 mb-1">
                    Dispatch Farm Site Location *
                  </label>
                  <select
                    id="cs-loc"
                    value={newLocId}
                    onChange={(e) => setNewLocId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cs-batch" className="block text-xs font-bold text-slate-700 mb-1">
                    Linked Livestock Batch (Optional)
                  </label>
                  <select
                    id="cs-batch"
                    value={newLivestockId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNewLivestockId(id);
                      const st = livestockStatuses.find((s) => s.entry.id === id);
                      if (st && st.configuredSalePricePerUnit) {
                        setNewUnitPrice(String(st.configuredSalePricePerUnit));
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">-- General Farm Sale (No Batch Linked) --</option>
                    {livestockStatuses.map((st) => (
                      <option key={st.entry.id} value={st.entry.id}>
                        {st.entry.nameOrTag} ({st.entry.species}) — {st.currentLiveHeadcount} available
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cs-qty" className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    id="cs-qty"
                    type="number"
                    min="1"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="cs-price" className="block text-xs font-bold text-slate-700 mb-1">
                    Unit Price ($) *
                  </label>
                  <input
                    id="cs-price"
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="cs-dep" className="block text-xs font-bold text-slate-700 mb-1">
                    Cash Deposit ($)
                  </label>
                  <input
                    id="cs-dep"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono text-emerald-700 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Financial Breakdown Preview */}
              {(() => {
                const q = parseInt(newQuantity, 10) || 0;
                const p = parseFloat(newUnitPrice) || 0;
                const d = parseFloat(newDeposit) || 0;
                const tot = q * p;
                const rem = Math.max(0, tot - d);

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>Total Value:</span>
                      <span className="font-mono text-white">${tot.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-400">
                      <span>Cash Paid Now (Added to Left Money):</span>
                      <span className="font-mono">+${d.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-amber-400 border-t border-slate-800 pt-1 text-sm">
                      <span>Remaining Credit Due from Customer:</span>
                      <span className="font-mono">${rem.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="cs-date" className="block text-xs font-bold text-slate-700 mb-1">
                    Agreed Settlement Due Date *
                  </label>
                  <input
                    id="cs-date"
                    type="date"
                    required
                    value={newAgreedDate}
                    onChange={(e) => setNewAgreedDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label htmlFor="cs-terms" className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Terms / Agreement Note
                  </label>
                  <input
                    id="cs-terms"
                    type="text"
                    value={newPaymentTerms}
                    onChange={(e) => setNewPaymentTerms(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cs-notes" className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Notes (Butchery address, contact person, truck delivery info) *
                </label>
                <textarea
                  id="cs-notes"
                  rows={2}
                  required
                  placeholder="e.g. Delivered 50 dressed broilers to Highfield Butchery. Manager Tendai promised full settlement on 20th Nov."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Save Credit Sale &amp; Notify Members
                </button>
              </div>
            </form>
          )}

          {/* REPAYMENT MODAL VIEW */}
          {activeView === 'REPAY' && selectedSale && (
            <form onSubmit={handleRepaySubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <h4 className="font-extrabold text-sm text-emerald-900">
                  Recording Payment for {selectedSale.customerName}
                </h4>
                <p>
                  Current Remaining Balance: <strong className="font-mono text-sm">${selectedSale.creditBalanceRemaining.toFixed(2)}</strong>
                </p>
                <p className="text-[11px] text-emerald-700">
                  Cash collected will be immediately credited into organization Left Money.
                </p>
              </div>

              <div>
                <label htmlFor="rep-amt" className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount Received ($) *
                </label>
                <input
                  id="rep-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedSale.creditBalanceRemaining}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="rep-meth" className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    id="rep-meth"
                    value={repayMethod}
                    onChange={(e) => setRepayMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Cash (USD)">Cash (USD)</option>
                    <option value="EcoCash USD">EcoCash USD</option>
                    <option value="InnBucks">InnBucks</option>
                    <option value="Bank Transfer">Bank Transfer (Nostro)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rep-ref" className="block text-xs font-bold text-slate-700 mb-1">
                    Receipt / Reference Number
                  </label>
                  <input
                    id="rep-ref"
                    type="text"
                    placeholder="e.g. REC-9921 or EcoCash Ref #..."
                    value={repayRef}
                    onChange={(e) => setRepayRef(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rep-note" className="block text-xs font-bold text-slate-700 mb-1">
                  Explanation Note
                </label>
                <textarea
                  id="rep-note"
                  rows={2}
                  placeholder="e.g. Cash collected by driver upon delivery round."
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Confirm Payment Collection
                </button>
              </div>
            </form>
          )}

          {/* EXTEND DUE DATE MODAL VIEW */}
          {activeView === 'EXTEND' && selectedSale && (
            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <h4 className="font-extrabold text-sm text-amber-900">
                  Reschedule / Extend Due Date for {selectedSale.customerName}
                </h4>
                <p>
                  Current Due Date: <strong className="font-mono text-sm">{new Date(selectedSale.agreedSettlementDate).toLocaleDateString()}</strong>
                </p>
                <p className="text-[11px] text-amber-800">
                  All members will be notified in the transparent audit trail explaining why the date was changed.
                </p>
              </div>

              <div>
                <label htmlFor="ext-date" className="block text-xs font-bold text-slate-700 mb-1">
                  New Agreed Settlement Date *
                </label>
                <input
                  id="ext-date"
                  type="date"
                  required
                  value={extendNewDate}
                  onChange={(e) => setExtendNewDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="ext-reason" className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Explanation / Agreement Reason *
                </label>
                <textarea
                  id="ext-reason"
                  rows={3}
                  required
                  placeholder="e.g. Customer requested a 10-day extension due to delay in butchery weekend customer turnover; agreed with farm manager."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Save New Date &amp; Broadcast
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

