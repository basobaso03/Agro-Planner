import React, { useState } from 'react';
import { Phone, Calendar, Clock, DollarSign, Share2, CalendarClock, CreditCard } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { nativeAppLauncher } from '../../native/appLauncher.ts';
import { nativeShare } from '../../native/share.ts';
import { dataService } from '../../services/dataService.ts';
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
  onRecordPayment = () => {},
  onExtendDate = () => {},
  onBack,
}) => {
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showExtendSheet, setShowExtendSheet] = useState(false);

  const sale = propSale || (dataService.getState().creditSales || []).find((s) => s.id === saleId);

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

  const handleShareStatement = () => {
    const text = `Credit Sale Statement for ${sale.customerName}\nItem: ${sale.quantitySold}x ${
      sale.livestockName || 'Produce'
    }\nTotal Amount: $${sale.totalSaleAmount.toFixed(2)}\nDeposit Paid: $${sale.depositPaidCash.toFixed(
      2
    )}\nRemaining Balance: $${sale.creditBalanceRemaining.toFixed(2)}\nDue Date: ${new Date(
      sale.agreedSettlementDate
    ).toLocaleDateString()}`;

    void nativeShare.shareTextOrUrl({
      title: `Credit Statement: ${sale.customerName}`,
      text,
    });
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto pb-28">
      {/* 1. Header Customer Card */}
      <div className="p-5 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Customer</span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">{sale.customerName}</h2>
            {sale.customerAddress && <p className="text-xs text-slate-500 mt-0.5">{sale.customerAddress}</p>}
          </div>

          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border ${
              isSettled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isSettled ? 'Fully Settled' : 'Active Receivable'}
          </span>
        </div>

        {/* Call & WhatsApp Quick Buttons */}
        {sale.customerPhone && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#F0EBE1]">
            <button
              type="button"
              onClick={() => void nativeAppLauncher.dialPhone(sale.customerPhone)}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call ({sale.customerPhone})</span>
            </button>

            <button
              type="button"
              onClick={() =>
                void nativeAppLauncher.openWhatsApp(
                  sale.customerPhone,
                  `Hello ${sale.customerName}, this is a friendly reminder regarding your outstanding balance of $${sale.creditBalanceRemaining.toFixed(
                    2
                  )} for ${sale.quantitySold}x ${sale.livestockName || 'items'} due on ${new Date(
                    sale.agreedSettlementDate
                  ).toLocaleDateString()}. Thank you.`
                )
              }
              className="py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>WhatsApp</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Financial Balance Breakdown */}
      <div className="grid grid-cols-3 gap-2 p-4 rounded-3xl bg-white border border-[#E8DFCE] text-center shadow-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Sale</span>
          <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
            {formatMoney(sale.totalSaleAmount, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-emerald-700 font-bold uppercase block">Paid</span>
          <span className="text-sm font-black font-mono text-emerald-600 mt-0.5 block">
            {formatMoney(sale.totalSaleAmount - sale.creditBalanceRemaining, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-rose-700 font-bold uppercase block">Owed</span>
          <span className="text-sm font-black font-mono text-rose-600 mt-0.5 block">
            {formatMoney(sale.creditBalanceRemaining, showNumbers)}
          </span>
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {!isSettled && (
          <>
            <button
              type="button"
              onClick={() => {
                onRecordPayment();
                setShowPaymentSheet(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onExtendDate();
                setShowExtendSheet(true);
              }}
              className="py-2.5 px-3 rounded-2xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <span>Extend</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleShareStatement}
          className={`py-2.5 px-3 rounded-2xl border text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
            isSettled
              ? 'col-span-3 bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>

      {/* 4. Payment History Timeline */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
          Payment History
        </span>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] p-4 divide-y divide-[#F0EBE1] shadow-xs">
          {/* Initial Deposit */}
          <div className="py-2 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-slate-900">Upfront Cash Deposit</div>
              <div className="text-[10px] text-slate-400 font-mono">Initial agreement</div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-emerald-600">
                {formatMoney(sale.depositPaidCash, showNumbers)}
              </span>
            </div>
          </div>

          {/* Payment Logs */}
          {(sale.paymentLogs || []).map((log) => (
            <div key={log.id} className="py-2 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900">{log.paymentMethod}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.paidAt).toLocaleDateString()} {log.receiptReference ? `• Ref: ${log.receiptReference}` : ''}
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-emerald-600">
                  +{formatMoney(log.amount, showNumbers)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Date Extensions Timeline */}
      {sale.dateExtensions && sale.dateExtensions.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            Date Extension History
          </span>
          <div className="bg-amber-50/50 rounded-3xl border border-amber-200 p-4 space-y-2 text-xs">
            {sale.dateExtensions.map((ext) => (
              <div key={ext.id} className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-amber-950">{ext.reason}</div>
                  <div className="text-[10px] text-amber-800">
                    Extended to {new Date(ext.newAgreedDate).toLocaleDateString()} by {ext.authorizedByName}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
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

