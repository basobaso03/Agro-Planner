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
  showNumbers?: boolean;
  onToggleShowNumbers?: () => void;
}

export const MoneyScreen: React.FC<MoneyScreenProps> = ({
  activeMember,
  showNumbers,
  onToggleShowNumbers,
}) => {
  const { navigate } = useNavigation();
  const masked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();

  // Sheets
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);
  const [showDebtSheet, setShowDebtSheet] = useState(false);
  const [showCreditSaleSheet, setShowCreditSaleSheet] = useState(false);

  const finSummary = dataService.computeFinancialSummary();
  const org = (dataService.getState().organizations || []).find((o) => o.id === activeMember.orgId);
  const isAgro = org?.type !== 'GENERAL_VENTURE';
  const creditSales = isAgro ? (dataService.getState().creditSales || []) : [];
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
    if (onToggleShowNumbers) {
      onToggleShowNumbers();
    } else {
      togglePrivacyMask();
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Mobile Banking Balance Hero */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Liquid Left Money</span>
          <button
            type="button"
            onClick={handleToggleMask}
            className="text-xs px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E0D7C6] text-slate-700 hover:text-slate-950 hover:bg-[#F0EBE1] flex items-center gap-1.5 font-bold cursor-pointer transition-colors shadow-xs"
          >
            <span>{masked ? '👁️' : '🔒'}</span>
            <span>{masked ? 'Show' : 'Hide'}</span>
          </button>
        </div>

        <div>
          <div className="text-3xl font-black font-mono text-slate-950 tracking-tight">
            {formatMoney(finSummary.leftMoney, { mask: masked })}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-bold">
            Net Capital Position: {formatMoney(netWorth, { mask: masked })}
          </div>
        </div>

        {/* 3 Secondary Mini-Balances */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F0EBE1] text-center text-xs">
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Total Pool</div>
            <div className="font-black font-mono text-slate-950 mt-0.5">
              {formatMoney(finSummary.totalPool, { mask: masked })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Receivables</div>
            <div className="font-black font-mono text-emerald-700 mt-0.5">
              {formatMoney(totalCreditReceivables + totalLoansLent, { mask: masked })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Liabilities</div>
            <div className="font-black font-mono text-amber-700 mt-0.5">
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
          className="p-3 bg-white border border-[#E8DFCE] rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-200">
            📥
          </div>
          <div className="text-xs font-black text-slate-950">Deposit</div>
        </button>

        <button
          type="button"
          onClick={() => setShowExpenseSheet(true)}
          className="p-3 bg-white border border-[#E8DFCE] rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-base border border-rose-200">
            🧾
          </div>
          <div className="text-xs font-black text-slate-950">Expense</div>
        </button>

        {isAgro ? (
          <button
            type="button"
            onClick={() => setShowCreditSaleSheet(true)}
            className="p-3 bg-white border border-[#E8DFCE] rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base border border-blue-200">
              📋
            </div>
            <div className="text-xs font-black text-slate-950">Credit Sale</div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('runway')}
            className="p-3 bg-white border border-[#E8DFCE] rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base border border-indigo-200">
              🛫
            </div>
            <div className="text-xs font-black text-slate-950">Runway</div>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowDebtSheet(true)}
          className="p-3 bg-white border border-[#E8DFCE] rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200">
            💳
          </div>
          <div className="text-xs font-black text-slate-950">Borrow</div>
        </button>
      </div>

      {/* Financial Banking Modules */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden">
        <ListRow
          icon="🪙"
          title="Capital Equity Pool"
          subtitle={`Total contributed: ${formatMoney(finSummary.totalPool, { mask: masked })}`}
          onClick={() => navigate('capitalPool')}
        />

        {isAgro && (
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
        )}

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
