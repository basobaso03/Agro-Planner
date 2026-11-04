import React from 'react';
import { Phone, Calendar, Clock, ChevronRight } from 'lucide-react';
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

  const daysDiff = Math.round((dueMs - now) / (1000 * 60 * 60 * 24));
  const dueRelativeText = isSettled
    ? 'Paid in full'
    : isOverdue
    ? `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`
    : daysDiff === 0
    ? 'Due today'
    : `Due in ${daysDiff} day${daysDiff === 1 ? '' : 's'}`;

  const totalPaid = sale.totalSaleAmount - sale.creditBalanceRemaining;
  const percentPaid = Math.min(100, Math.max(0, (totalPaid / (sale.totalSaleAmount || 1)) * 100));

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-3xl border transition-all cursor-pointer active:scale-[0.99] group ${
        isSettled
          ? 'bg-slate-50/80 border-slate-200'
          : isOverdue
          ? 'bg-rose-50/40 border-rose-200 shadow-xs hover:border-rose-400'
          : 'bg-white border-[#E8DFCE] shadow-xs hover:border-amber-400'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Customer & Items */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm text-slate-900 truncate tracking-tight group-hover:text-amber-600 transition-colors">
              {sale.customerName}
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isSettled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isOverdue
                  ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {isSettled ? 'Settled ✓' : isOverdue ? 'Overdue ⚠' : 'Outstanding'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap font-medium">
            {sale.customerPhone && (
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400" />
                {sale.customerPhone}
              </span>
            )}
            <span>•</span>
            <span>
              {sale.quantitySold}x {sale.livestockName || 'Items'}
            </span>
          </div>
        </div>

        {/* Balance Remaining */}
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Balance Owed</span>
          <div
            className={`text-base font-black font-mono tracking-tight ${
              isSettled ? 'text-slate-400' : isOverdue ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatMoney(sale.creditBalanceRemaining, showNumbers)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className={`w-3 h-3 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
            <span className={isOverdue ? 'text-rose-700 font-bold' : ''}>{dueRelativeText}</span>
          </span>
          <span className="font-mono">{percentPaid.toFixed(0)}% paid</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            style={{ width: `${percentPaid}%` }}
            className={`h-full rounded-full transition-all ${
              isSettled ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

