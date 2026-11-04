import React from 'react';
import { Phone, Calendar, Scale, ArrowDownLeft, CreditCard } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { nativeAppLauncher } from '../../native/appLauncher.ts';
import { dataService } from '../../services/dataService.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { RepayDebtSheet } from '../../sheets/loans/RepayDebtSheet.tsx';
import type { DebtLiabilityEvent, OrgMember } from '../../types/agro.ts';

export interface DebtDetailScreenProps {
  debt?: DebtLiabilityEvent;
  debtId?: string;
  activeMember: OrgMember;
  showNumbers?: boolean;
  onRepayDebt?: () => void;
  onBack?: () => void;
}

export const DebtDetailScreen: React.FC<DebtDetailScreenProps> = ({
  debt: propDebt,
  debtId,
  activeMember,
  showNumbers = true,
  onRepayDebt = () => { },
  onBack,
}) => {
  const [showRepaySheet, setShowRepaySheet] = React.useState(false);
  const debt = propDebt || (dataService.getState().debtLiabilities || []).find((d) => d.id === debtId);

  if (!debt) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <EmptyState
          icon={Scale}
          title="Debt Not Found"
          description="This debt record could not be found in the current database snapshot."
          actionLabel="Go Back"
          onAction={onBack || (() => window.history.back())}
        />
      </div>
    );
  }

  const isSettled = debt.status === 'SETTLED';

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto pb-28">
      {/* 1. Header Creditor Card */}
      <div className="p-5 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Creditor</span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">{debt.creditorName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Category: {debt.category.replace('_', ' ')}</p>
          </div>

          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border ${isSettled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
          >
            {isSettled ? 'Settled ✓' : 'Active Liability'}
          </span>
        </div>

        {debt.creditorContact && (
          <div className="pt-2 border-t border-[#F0EBE1]">
            <button
              type="button"
              onClick={() => void nativeAppLauncher.dialPhone(debt.creditorContact!)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call Creditor ({debt.creditorContact})</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Financial Balance Breakdown */}
      <div className="grid grid-cols-3 gap-2 p-4 rounded-3xl bg-white border border-[#E8DFCE] text-center shadow-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Principal</span>
          <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
            {formatMoney(debt.principalAmount, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-emerald-700 font-bold uppercase block">Repaid</span>
          <span className="text-sm font-black font-mono text-emerald-600 mt-0.5 block">
            {formatMoney(debt.principalAmount - debt.remainingBalance, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-rose-700 font-bold uppercase block">Remaining</span>
          <span className="text-sm font-black font-mono text-rose-600 mt-0.5 block">
            {formatMoney(debt.remainingBalance, showNumbers)}
          </span>
        </div>
      </div>

      {/* 3. Action Button */}
      {!isSettled && (
        <button
          type="button"
          onClick={() => {
            onRepayDebt();
            setShowRepaySheet(true);
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <CreditCard className="w-4 h-4" />
          <span>Disburse Debt Repayment</span>
        </button>
      )}

      {/* 4. Purpose & Timeline */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
          Liability Details &amp; Purpose
        </span>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] p-4 space-y-3 text-xs shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Mandatory Purpose Note</span>
            <p className="text-slate-800 font-medium mt-0.5">{debt.purposeNote}</p>
          </div>

          <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-slate-500 font-mono text-[11px]">
            <span>Due: {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : 'N/A'}</span>
            <span>Recorded: {new Date(debt.borrowDate || debt.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <RepayDebtSheet
        isOpen={showRepaySheet}
        onClose={() => setShowRepaySheet(false)}
        debt={debt}
        activeMember={activeMember}
        leftMoney={dataService.getFinancialSummary().leftMoney}
      />
    </div>
  );
};

