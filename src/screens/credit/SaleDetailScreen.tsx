import React, { useState } from 'react';
import { Phone, Calendar, Clock, DollarSign, Share2, CalendarClock, CreditCard, Bell, Users, Radio } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { nativeAppLauncher } from '../../native/appLauncher.ts';
import { nativeShare } from '../../native/share.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { RecordPaymentSheet } from '../../sheets/credit/RecordPaymentSheet.tsx';
import { ExtendDueDateSheet } from '../../sheets/credit/ExtendDueDateSheet.tsx';
import type { CreditSaleEvent, OrgMember } from '../../types/agro.ts';

export interface SaleDetailScreenProps {
  sale?: CreditSaleEvent;
  saleId?: string;
  activeMember: OrgMember;
  showNumbers?: boolean;
  onRecordPayment?: () => void;
  onExtendDate?: () => void;
  onBack?: () => void;
}

export const SaleDetailScreen: React.FC<SaleDetailScreenProps> = ({
  sale: propSale,
  saleId,
  activeMember,
  showNumbers = true,
  onRecordPayment = () => { },
  onExtendDate = () => { },
  onBack,
}) => {
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showExtendSheet, setShowExtendSheet] = useState(false);
  const { showToast } = useToast();

  const sale = propSale || (dataService.getState().creditSales || []).find((s) => s.id === saleId);

  const handleBroadcastOrgAlert = () => {
    if (!sale) return;
    dataService.broadcastFinancialDueAlert({
      entityType: 'CREDIT_SALE',
      entityId: sale.id,
      partyName: sale.customerName,
      amount: sale.creditBalanceRemaining,
      dueDate: sale.agreedSettlementDate,
      customNote: `Credit sale reminder broadcast for ${sale.customerName}. Balance owed: $${sale.creditBalanceRemaining.toFixed(2)}.`,
      actor: activeMember,
    });
    showToast(`Broadcast alert for ${sale.customerName} sent to all org members.`);
  };

  if (!sale) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <EmptyState
          icon={CreditCard}
          title="Credit Sale Not Found"
          description="This credit sale record could not be found in the current ledger."
          actionLabel="Go Back"
          onAction={onBack || (() => window.history.back())}
        />
      </div>
    );
  }

  const isSettled = sale.status === 'SETTLED';
  const dueMs = new Date(sale.agreedSettlementDate).getTime();
  const now = Date.now();
  const isOverdue = !isSettled && dueMs < now;

  const daysDiff = Math.max(0, Math.ceil((dueMs - now) / (1000 * 60 * 60 * 24)));
  const overdueDays = Math.max(1, Math.floor((now - dueMs) / (1000 * 60 * 60 * 24)));

  const dueDateObj = new Date(sale.agreedSettlementDate);
  const timeFormatted = isNaN(dueDateObj.getTime())
    ? '09:00 AM'
    : dueDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const reminderTime =
    timeFormatted.includes('12:00 AM') || timeFormatted.includes('00:00') ? '09:00 AM' : timeFormatted;

  const dueRelativeText = isSettled
    ? 'Paid in full'
    : isOverdue
      ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
      : daysDiff === 0
        ? `Remind today at ${reminderTime}`
        : `Remind in ${daysDiff} day${daysDiff === 1 ? '' : 's'} at ${reminderTime}`;

  const itemsSummary =
    sale.items && sale.items.length > 1
      ? `${sale.quantitySold} animals across ${sale.items.length} types`
      : `${sale.quantitySold}x ${sale.livestockName || 'items'}`;

  const handleShareStatement = () => {
    let itemDetails = `${sale.quantitySold}x ${sale.livestockName || 'Produce'}`;
    if (sale.items && sale.items.length > 0) {
      itemDetails = sale.items
        .map((i) => `• ${i.quantitySold}x ${i.livestockName} @ $${i.unitPrice.toFixed(2)} = $${(i.totalAmount ?? (i.quantitySold * i.unitPrice)).toFixed(2)}`)
        .join('\n');
    }

    const text = `Credit Sale Statement for ${sale.customerName}\n\nItems Sold:\n${itemDetails}\n\nTotal Amount: $${sale.totalSaleAmount.toFixed(
      2
    )}\nDeposit Paid: $${sale.depositPaidCash.toFixed(2)}\nRemaining Balance: $${sale.creditBalanceRemaining.toFixed(
      2
    )}\nDue Date: ${new Date(sale.agreedSettlementDate).toLocaleDateString()}`;

    void nativeShare.shareTextOrUrl({
      title: `Credit Statement: ${sale.customerName}`,
      text,
    });
  };

  return (
    <div className="w-full max-w-full sm:max-w-xl mx-auto px-3.5 sm:px-5 py-3.5 sm:py-5 space-y-4 pb-28 box-border overflow-x-hidden min-w-0">
      {/* 1. Header Customer Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-3 w-full box-border min-w-0">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Customer</span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">{sale.customerName}</h2>
            {sale.customerAddress && <p className="text-xs text-slate-500 mt-0.5 truncate">{sale.customerAddress}</p>}
          </div>

          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap ${isSettled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
          >
            {isSettled ? 'Fully Settled' : 'Active Receivable'}
          </span>
        </div>

        {/* Call & WhatsApp Quick Buttons */}
        {sale.customerPhone && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-[#F0EBE1]">
            <button
              type="button"
              onClick={() => void nativeAppLauncher.dialPhone(sale.customerPhone)}
              className="flex-1 min-w-[140px] py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Call ({sale.customerPhone})</span>
            </button>

            <button
              type="button"
              onClick={() =>
                void nativeAppLauncher.openWhatsApp(
                  sale.customerPhone,
                  `Hello ${sale.customerName}, this is a friendly reminder regarding your outstanding balance of $${sale.creditBalanceRemaining.toFixed(
                    2
                  )} for ${itemsSummary} due on ${new Date(
                    sale.agreedSettlementDate
                  ).toLocaleDateString()}. Thank you.`
                )
              }
              className="py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>WhatsApp</span>
            </button>
          </div>
        )}
      </div>

      {/* Due Date & Active Reminder Schedule Card */}
      <div className="p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2.5 rounded-2xl shrink-0 ${
                isSettled
                  ? 'bg-emerald-50 text-emerald-700'
                  : isOverdue
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Agreed Settlement Due Date
              </span>
              <h4 className="text-sm font-black text-slate-900 truncate">
                {new Date(sale.agreedSettlementDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h4>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
              isSettled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isOverdue
                  ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                  : 'bg-amber-100 text-amber-900 border-amber-300 font-black'
            }`}
          >
            {dueRelativeText}
          </span>
        </div>

        {!isSettled && (
          <>
            <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs text-slate-600 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] leading-tight">
                  {isOverdue
                    ? `Alarm alert passed on due date at ${reminderTime}. Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}.`
                    : `Active device alarm notification scheduled for 2 days prior and on due date at ${reminderTime}.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onExtendDate();
                  setShowExtendSheet(true);
                }}
                className="text-amber-800 underline font-bold shrink-0 text-[11px] cursor-pointer"
              >
                Extend Date
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#F0EBE1]">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Users className="w-3.5 h-3.5 text-amber-700" />
                <span>Notify Entire Team</span>
              </div>
              <button
                type="button"
                onClick={handleBroadcastOrgAlert}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
                <span>Broadcast Alert to Org</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. Financial Balance Breakdown */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 p-3 sm:p-4 rounded-3xl bg-white border border-[#E8DFCE] text-center shadow-xs w-full box-border min-w-0">
        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase block truncate">Total Sale</span>
          <span className="text-xs sm:text-sm font-black font-mono text-slate-900 mt-0.5 block truncate">
            {formatMoney(sale.totalSaleAmount, showNumbers)}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold uppercase block truncate">Deposit</span>
          <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 mt-0.5 block truncate">
            {formatMoney(sale.depositPaidCash, showNumbers)}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] text-teal-700 font-bold uppercase block truncate">Total Paid</span>
          <span className="text-xs sm:text-sm font-black font-mono text-teal-600 mt-0.5 block truncate">
            {formatMoney(sale.totalSaleAmount - sale.creditBalanceRemaining, showNumbers)}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] text-rose-700 font-bold uppercase block truncate">Owed</span>
          <span className="text-xs sm:text-sm font-black font-mono text-rose-600 mt-0.5 block truncate">
            {formatMoney(sale.creditBalanceRemaining, showNumbers)}
          </span>
        </div>
      </div>

      {/* 3. Items Sold Breakdown (Supports Multi-Animal Line Items) */}
      <div className="space-y-2 w-full min-w-0">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Items Sold Breakdown
          </span>
          <span className="text-[11px] font-mono text-slate-500 font-semibold shrink-0">
            {sale.quantitySold} units total
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] p-4 divide-y divide-[#F0EBE1] shadow-xs w-full box-border min-w-0">
          {sale.items && sale.items.length > 0 ? (
            sale.items.map((item, idx) => (
              <div key={item.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{item.livestockName}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                    {item.quantitySold} units @ {formatMoney(item.unitPrice, showNumbers)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-slate-900">
                    {formatMoney(item.totalAmount ?? (item.quantitySold * item.unitPrice), showNumbers)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 flex items-center justify-between gap-3 text-xs min-w-0">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{sale.livestockName || 'Livestock'}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                  {sale.quantitySold} units @ {formatMoney(sale.totalSaleAmount / (sale.quantitySold || 1), showNumbers)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-slate-900">
                  {formatMoney(sale.totalSaleAmount, showNumbers)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="grid grid-cols-3 gap-2 w-full min-w-0">
        {!isSettled && (
          <>
            <button
              type="button"
              onClick={() => {
                onRecordPayment();
                setShowPaymentSheet(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all min-w-0"
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span className="truncate">Pay</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onExtendDate();
                setShowExtendSheet(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all min-w-0"
            >
              <CalendarClock className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Extend</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleShareStatement}
          className={`py-2.5 px-3 rounded-2xl border text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all min-w-0 ${isSettled
            ? 'col-span-3 bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span className="truncate">Share</span>
        </button>
      </div>

      {/* 5. Payment History Timeline */}
      <div className="space-y-2 w-full min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
          Payment History
        </span>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] p-4 divide-y divide-[#F0EBE1] shadow-xs w-full box-border min-w-0">
          {/* Initial Deposit */}
          <div className="py-2 flex items-center justify-between text-xs min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 truncate">Upfront Cash Deposit</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">Initial agreement</div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono font-bold text-emerald-600">
                {formatMoney(sale.depositPaidCash, showNumbers)}
              </span>
            </div>
          </div>

          {/* Payment Logs */}
          {(sale.paymentLogs || []).map((log) => (
            <div key={log.id} className="py-2 flex items-center justify-between text-xs min-w-0">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{log.paymentMethod}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {new Date(log.paidAt).toLocaleDateString()} {log.receiptReference ? `• Ref: ${log.receiptReference}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-emerald-600">
                  +{formatMoney(log.amount, showNumbers)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Date Extensions Timeline */}
      {sale.dateExtensions && sale.dateExtensions.length > 0 && (
        <div className="space-y-2 w-full min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            Date Extension History
          </span>
          <div className="bg-amber-50/50 rounded-3xl border border-amber-200 p-4 space-y-2 text-xs w-full box-border min-w-0">
            {sale.dateExtensions.map((ext) => (
              <div key={ext.id} className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-amber-950 truncate">{ext.reason}</div>
                  <div className="text-[10px] text-amber-800 truncate">
                    Extended to {new Date(ext.newAgreedDate).toLocaleDateString()} by {ext.authorizedByName}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {new Date(ext.extendedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Sheets */}
      <RecordPaymentSheet
        isOpen={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        sale={sale}
        activeMember={activeMember}
      />

      <ExtendDueDateSheet
        isOpen={showExtendSheet}
        onClose={() => setShowExtendSheet(false)}
        sale={sale}
        activeMember={activeMember}
      />
    </div>
  );
};

