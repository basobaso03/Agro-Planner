import React from 'react';
import { Plus, CreditCard, Scale, Megaphone, Coins } from 'lucide-react';

export interface QuickActionsProps {
  onLogExpense: () => void;
  onRecordSale: () => void;
  onAddLoanDebt: () => void;
  onBroadcast: () => void;
  isAgro?: boolean;
  onContributePool?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onLogExpense,
  onRecordSale,
  onAddLoanDebt,
  onBroadcast,
  isAgro = true,
  onContributePool,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2 text-center py-1">
      <button
        type="button"
        onClick={onLogExpense}
        className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group"
      >
        <div className="w-13 h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
          <Plus className="w-6 h-6" />
        </div>
        <span className="text-[11px] font-bold text-slate-700 leading-tight">Expense</span>
      </button>

      {isAgro ? (
        <button
          type="button"
          onClick={onRecordSale}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group"
        >
          <div className="w-13 h-13 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
            <CreditCard className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 leading-tight">Credit Sale</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onContributePool}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group"
        >
          <div className="w-13 h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
            <Coins className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 leading-tight">Contribute</span>
        </button>
      )}

      <button
        type="button"
        onClick={onAddLoanDebt}
        className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group"
      >
        <div className="w-13 h-13 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
          <Scale className="w-6 h-6" />
        </div>
        <span className="text-[11px] font-bold text-slate-700 leading-tight">Loan / Debt</span>
      </button>

      <button
        type="button"
        onClick={onBroadcast}
        className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group"
      >
        <div className="w-13 h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
          <Megaphone className="w-6 h-6" />
        </div>
        <span className="text-[11px] font-bold text-slate-700 leading-tight">Broadcast</span>
      </button>
    </div>
  );
};

