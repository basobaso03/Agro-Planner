import React from 'react';
import { Phone, Calendar, Clock, ChevronRight, Bell } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import type { CreditSaleEvent } from '../../types/agro.ts';

export interface SaleCardProps {
  sale: CreditSaleEvent;
  showNumbers?: boolean;
  onClick: () => void;
}

export const SaleCard: React.FC<SaleCardProps> = ({
  sale,
  showNumbers = true,
  onClick,
}) => {
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

  const totalPaid = sale.totalSaleAmount - sale.creditBalanceRemaining;
  const percentPaid = Math.min(100, Math.max(0, (totalPaid / (sale.totalSaleAmount || 1)) * 100));

  const itemsSummary = React.useMemo(() => {
    if (sale.items && sale.items.length > 0) {
      if (sale.items.length === 1) {
        return `${sale.items[0].quantitySold}x ${sale.items[0].livestockName}`;
      }
      return `${sale.quantitySold}x total (${sale.items.map((it) => `${it.quantitySold}x ${it.livestockName}`).join(', ')})`;
    }
    return `${sale.quantitySold}x ${sale.livestockName || 'Items'}`;
  }, [sale.items, sale.quantitySold, sale.livestockName]);

  return (
    <div
      onClick={onClick}
      className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer active:scale-[0.99] group w-full box-border min-w-0 overflow-hidden ${isSettled
        ? 'bg-slate-50/80 border-slate-200'
        : isOverdue
          ? 'bg-rose-50/40 border-rose-200 shadow-xs hover:border-rose-400'
          : 'bg-white border-[#E8DFCE] shadow-xs hover:border-amber-400'
        }`}
    >
      <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
        {/* Customer & Items */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <h3 className="font-black text-xs sm:text-sm text-slate-900 truncate tracking-tight group-hover:text-amber-600 transition-colors">
              {sale.customerName}
            </h3>
            <span
              className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${isSettled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isOverdue
                  ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
            >
              {isSettled ? 'Settled ✓' : isOverdue ? 'Overdue ⚠' : 'Outstanding'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-1 flex-wrap font-medium min-w-0">
            {sale.customerPhone && (
              <span className="flex items-center gap-1 font-mono shrink-0">
                <Phone className="w-3 h-3 text-slate-400" />
                {sale.customerPhone}
              </span>
            )}
            {sale.customerPhone && <span className="text-slate-300">•</span>}
            <span className="truncate">
              {itemsSummary}
            </span>
            {sale.depositPaidCash > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-bold whitespace-nowrap">
                  Deposit: {formatMoney(sale.depositPaidCash, showNumbers)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Balance Remaining */}
        <div className="text-right shrink-0 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block whitespace-nowrap">
            Balance Owed
          </span>
          <div
            className={`text-sm sm:text-base font-black font-mono tracking-tight whitespace-nowrap ${isSettled ? 'text-slate-400' : isOverdue ? 'text-rose-600' : 'text-slate-900'
              }`}
          >
            {formatMoney(sale.creditBalanceRemaining, showNumbers)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1 truncate mr-2">
            {!isSettled && (
              <Bell className={`w-3 h-3 shrink-0 ${isOverdue ? 'text-rose-500' : 'text-amber-500 animate-pulse'}`} />
            )}
            {isSettled && <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />}
            <span className={isOverdue ? 'text-rose-700 font-bold truncate' : 'truncate'}>{dueRelativeText}</span>
          </span>
          <span className="font-mono shrink-0">{percentPaid.toFixed(0)}% paid</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            style={{ width: `${percentPaid}%` }}
            className={`h-full rounded-full transition-all ${isSettled ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'
              }`}
          />
        </div>
      </div>
    </div>
  );
};

