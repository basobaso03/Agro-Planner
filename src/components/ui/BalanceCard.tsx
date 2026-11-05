import React from 'react';
import { TrendingUp, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';

export interface BalanceCardProps {
  totalNav: number;
  leftMoney: number;
  receivables: number;
  liabilities: number;
  showNumbers?: boolean;
  onCardClick?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalNav,
  leftMoney,
  receivables,
  liabilities,
  showNumbers = true,
  onCardClick,
}) => {
  return (
    <div
      onClick={onCardClick}
      className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white shadow-xl border border-slate-800/80 cursor-pointer transition-all active:scale-[0.99] group"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Consolidated Net Worth (NAV)</span>
        </span>
      </div>

      {/* Main Big Number */}
      <div className="mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
        {formatMoney(totalNav, showNumbers)}
      </div>

      {/* Sub-Metric 3-Pillar Row */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-white/10 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Cash on Ground</span>
          <span className="font-mono font-bold text-emerald-400 mt-0.5 block truncate">
            {formatMoney(leftMoney, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Receivables</span>
          <span className="font-mono font-bold text-amber-400 mt-0.5 block truncate">
            {formatMoney(receivables, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Liabilities</span>
          <span className="font-mono font-bold text-rose-400 mt-0.5 block truncate">
            {formatMoney(liabilities, showNumbers)}
          </span>
        </div>
      </div>
    </div>
  );
};

