import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { formatMoney, isPrivacyMasked, togglePrivacyMask } from '../../utils/currency.ts';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { ContributionSheet } from '../../sheets/pool/ContributionSheet.tsx';
import { LogExpenseSheet } from '../../sheets/expenses/LogExpenseSheet.tsx';
import { NewDebtSheet } from '../../sheets/loans/NewDebtSheet.tsx';
import { RecordCreditSaleSheet } from '../../sheets/credit/RecordCreditSaleSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface MoneyScreenProps {
  activeMember: OrgMember;
}

export const MoneyScreen: React.FC<MoneyScreenProps> = ({ activeMember }) => {
  const { navigate } = useNavigation();
  const [masked, setMasked] = useState(isPrivacyMasked());

  // Sheets
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);
  const [showDebtSheet, setShowDebtSheet] = useState(false);
  const [showCreditSaleSheet, setShowCreditSaleSheet] = useState(false);

  const finSummary = dataService.computeFinancialSummary();
  const creditSales = dataService.getState().creditSales || [];
  const debts = dataService.getState().debtLiabilities || [];
  const loans = dataService.getState().loansGiven || [];
  const assets = dataService.computeFixedAssetGroupSummaries();

  const totalCreditReceivables = creditSales.reduce(
    (acc, s) => (s.status !== 'SETTLED' ? acc + (s.creditBalanceRemaining ?? (s.totalSaleAmount - (s.depositPaidCash || 0))) : acc),
    0
  );
  const totalDebtsOwed = debts.reduce(
    (acc, d) => (d.status !== 'SETTLED' ? acc + (d.remainingBalance ?? (d.principalAmount - (d.repayments?.reduce((r, p) => r + p.amount, 0) || 0))) : acc),
    0
  );
  const totalLoansLent = loans.reduce(
    (acc, l) => (l.status !== 'RECOVERED' ? acc + (l.remainingBalance ?? (l.principalAmount - (l.repayments?.reduce((r, p) => r + p.amount, 0) || 0))) : acc),
    0
  );
  const totalAssetValue = assets.reduce((acc, a) => acc + a.currentValue, 0);

  const netWorth = finSummary.leftMoney + totalAssetValue + totalCreditReceivables + totalLoansLent - totalDebtsOwed;

  const handleToggleMask = () => {
    const next = togglePrivacyMask();
    setMasked(next);
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Mobile Banking Balance Hero */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Liquid Left Money</span>
          <button
            type="button"
            onClick={handleToggleMask}
            className="text-xs px-2.5 py-1 rounded-full bg-slate-800 dark:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <span>{masked ? '👁️' : '🔒'}</span>
            <span>{masked ? 'Show' : 'Hide'}</span>
          </button>
        </div>

        <div>
          <div className="text-3xl font-extrabold tracking-tight">
            {formatMoney(finSummary.leftMoney, { mask: masked })}
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-medium">
            Net Capital Position: {formatMoney(netWorth, { mask: masked })}
          </div>
        </div>

        {/* 3 Secondary Mini-Balances */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 dark:border-slate-700 text-center text-xs">
          <div>
            <div className="text-[11px] text-slate-400">Total Pool</div>
            <div className="font-bold text-slate-200 mt-0.5">
              {formatMoney(finSummary.totalPool, { mask: masked })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Receivables</div>
            <div className="font-bold text-emerald-400 mt-0.5">
              {formatMoney(totalCreditReceivables, { mask: masked })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Liabilities</div>
            <div className="font-bold text-amber-400 mt-0.5">
              {formatMoney(totalDebtsOwed, { mask: masked })}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quick Banking Action Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setShowDepositSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-base">
            📥
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Deposit</div>
        </button>

        <button
          type="button"
          onClick={() => setShowExpenseSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-base">
            🧾
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Expense</div>
        </button>

        <button
          type="button"
          onClick={() => setShowCreditSaleSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-base">
            📋
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Credit Sale</div>
        </button>

        <button
          type="button"
          onClick={() => setShowDebtSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5"
        >
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold text-base">
            💳
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Borrow</div>
        </button>
      </div>

      {/* Financial Banking Modules */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
        <ListRow
          icon="📋"
          title="Sales on Credit & Receivables"
          subtitle={
            totalCreditReceivables > 0
              ? `${formatMoney(totalCreditReceivables, { mask: masked })} pending collection`
              : 'All customer invoices fully settled'
          }
          badge={creditSales.filter((s) => s.status !== 'SETTLED').length > 0 ? `${creditSales.filter((s) => s.status !== 'SETTLED').length} Active` : undefined}
          onClick={() => navigate('credit-sales')}
        />

        <ListRow
          icon="🤝"
          title="Loans & Debt Liabilities"
          subtitle={`Owed: ${formatMoney(totalDebtsOwed, { mask: masked })} · Lent: ${formatMoney(totalLoansLent, { mask: masked })}`}
          badge={debts.filter((d) => d.status !== 'SETTLED').length > 0 ? `${debts.filter((d) => d.status !== 'SETTLED').length} Active` : undefined}
          onClick={() => navigate('loans-debts')}
        />

        <ListRow
          icon="🛫"
          title="Runway Capital Planning"
          subtitle="Capital runway, member pledges, claims & spend gate"
          onClick={() => navigate('runway')}
        />

        <ListRow
          icon="🚜"
          title="Fixed Assets & Property NAV"
          subtitle={`${formatMoney(totalAssetValue, { mask: masked })} registered capital equipment`}
          onClick={() => navigate('assets')}
        />

        <ListRow
          icon="📊"
          title="Complete Financial Statements"
          subtitle="Income statement, cash flow & equity distribution"
          onClick={() => navigate('financial-summary')}
        />
      </div>

      {/* Sheets */}
      <ContributionSheet
        isOpen={showDepositSheet}
        onClose={() => setShowDepositSheet(false)}
        activeMember={activeMember}
      />

      <LogExpenseSheet
        isOpen={showExpenseSheet}
        onClose={() => setShowExpenseSheet(false)}
        activeMember={activeMember}
      />

      <NewDebtSheet
        isOpen={showDebtSheet}
        onClose={() => setShowDebtSheet(false)}
        activeMember={activeMember}
      />

      <RecordCreditSaleSheet
        isOpen={showCreditSaleSheet}
        onClose={() => setShowCreditSaleSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};
