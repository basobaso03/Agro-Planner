import React, { useState } from 'react';
import { Scale, Plus, ArrowDownLeft, ArrowUpRight, Bell } from 'lucide-react';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { Chip } from '../../components/ui/Chip.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { formatMoney } from '../../utils/currency.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { PERMISSIONS } from '../../utils/permissions.ts';
import { dataService } from '../../services/dataService.ts';
import { NewDebtSheet } from '../../sheets/loans/NewDebtSheet.tsx';
import { NewLoanSheet } from '../../sheets/loans/NewLoanSheet.tsx';
import type { DebtLiabilityEvent, LoanGivenEvent, OrgMember } from '../../types/agro.ts';

export interface LoansDebtsScreenProps {
  debts?: DebtLiabilityEvent[];
  loansGiven?: LoanGivenEvent[];
  activeMember: OrgMember;
  leftMoney?: number;
  showNumbers?: boolean;
  onOpenNewDebt?: () => void;
  onOpenNewLoan?: () => void;
  onSelectDebt?: (debt: DebtLiabilityEvent) => void;
  onSelectLoan?: (loan: LoanGivenEvent) => void;
}

export const LoansDebtsScreen: React.FC<LoansDebtsScreenProps> = ({
  debts = dataService.getState().debtLiabilities || [],
  loansGiven = dataService.getState().loansGiven || [],
  activeMember,
  leftMoney = dataService.getFinancialSummary().leftMoney,
  showNumbers = true,
  onOpenNewDebt,
  onOpenNewLoan,
  onSelectDebt,
  onSelectLoan,
}) => {
  const { navigate } = useNavigation();
  const [activeSegment, setActiveSegment] = useState<'BORROWED' | 'LENT'>('BORROWED');
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [showNewLoan, setShowNewLoan] = useState(false);

  const handleOpenNewDebt = onOpenNewDebt || (() => setShowNewDebt(true));
  const handleOpenNewLoan = onOpenNewLoan || (() => setShowNewLoan(true));

  const activeDebts = debts.filter((d) => d.status !== 'SETTLED');
  const activeLoans = loansGiven.filter((l) => l.status !== 'RECOVERED');

  const totalBorrowedOutstanding = activeDebts.reduce((acc, d) => acc + d.remainingBalance, 0);
  const totalLoansOutstanding = activeLoans.reduce((acc, l) => acc + l.remainingBalance, 0);

  const canCreate =
    activeSegment === 'BORROWED'
      ? PERMISSIONS.canRecordDebt(activeMember.role)
      : PERMISSIONS.canIssueLoan(activeMember.role);

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto pb-28">
      {/* 1. Sticky Segmented Control (Borrowed vs Lent) */}
      <SegmentedControl
        value={activeSegment}
        onChange={(val) => setActiveSegment(val)}
        options={[
          {
            value: 'BORROWED',
            label: 'Borrowed (Liabilities)',
            badge: activeDebts.length,
          },
          {
            value: 'LENT',
            label: 'Lent (Loans Given)',
            badge: activeLoans.length,
          },
        ]}
      />

      {/* 2. Compact Financial Summary Card */}
      <div className="p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            {activeSegment === 'BORROWED' ? 'Total Outstanding Debt' : 'Total Outstanding Loans Given'}
          </span>
          <div
            className={`text-2xl font-black font-mono tracking-tight mt-1 ${activeSegment === 'BORROWED' ? 'text-rose-600' : 'text-emerald-700'
              }`}
          >
            {formatMoney(
              activeSegment === 'BORROWED' ? totalBorrowedOutstanding : totalLoansOutstanding,
              showNumbers
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {activeSegment === 'BORROWED'
              ? 'Owed by organization to creditors'
              : 'Advanced to outgrowers & partners'}
          </span>
        </div>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activeSegment === 'BORROWED' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}
        >
          {activeSegment === 'BORROWED' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
        </div>
      </div>

      {/* 3. Cards Stream */}
      {activeSegment === 'BORROWED' ? (
        debts.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No Borrowed Debt or Liabilities"
            description="When your organization receives supplier credit or external bank loans, record them here."
            actionLabel={canCreate ? '＋ Record New Debt' : undefined}
            onAction={canCreate ? handleOpenNewDebt : undefined}
          />
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => {
              const isSettled = debt.status === 'SETTLED';
              const isOverdue = !isSettled && debt.dueDate ? new Date(debt.dueDate).getTime() < Date.now() : false;
              const daysDiff = debt.dueDate
                ? Math.ceil((new Date(debt.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const overdueDays = daysDiff != null ? Math.abs(daysDiff) : 0;
              const dueReminderText = isSettled
                ? 'Settled'
                : !debt.dueDate
                  ? 'Terms'
                  : isOverdue
                    ? `Overdue by ${overdueDays}d`
                    : daysDiff === 0
                      ? 'Remind today at 09:00 AM'
                      : `Remind in ${daysDiff}d at 09:00 AM`;

              return (
                <div
                  key={debt.id}
                  onClick={() => (onSelectDebt ? onSelectDebt(debt) : navigate('debtDetail', { id: debt.id }))}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer active:scale-[0.99] group ${isSettled ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-[#E8DFCE] shadow-xs hover:border-rose-400'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm text-slate-900 group-hover:text-rose-600 transition-colors">
                          {debt.creditorName}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {debt.category.replace('_', ' ')}
                        </span>
                        {debt.interestRatePercent ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                            {debt.interestRatePercent}% int
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium flex-wrap">
                        <span>Due: {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : 'Agreed Terms'}</span>
                        {!isSettled && debt.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOverdue
                                ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                          >
                            <Bell className={`w-2.5 h-2.5 ${isOverdue ? 'text-rose-600' : 'text-amber-600 animate-pulse'}`} />
                            <span>{dueReminderText}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Balance Owed</span>
                      <span
                        className={`text-base font-black font-mono ${isSettled ? 'text-slate-400' : 'text-rose-600'}`}
                      >
                        {formatMoney(debt.remainingBalance, showNumbers)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loansGiven.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No Loans Advanced to Others"
          description="When your organization advances cash or credit to outgrowers, partners, or members, record them here."
          actionLabel={canCreate ? '＋ Advance New Loan' : undefined}
          onAction={canCreate ? handleOpenNewLoan : undefined}
        />
      ) : (
        <div className="space-y-3">
          {loansGiven.map((loan) => {
            const isRecovered = loan.status === 'RECOVERED';
            const isOverdue = !isRecovered && loan.agreedReturnDate ? new Date(loan.agreedReturnDate).getTime() < Date.now() : false;
            const daysDiff = loan.agreedReturnDate
              ? Math.ceil((new Date(loan.agreedReturnDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const overdueDays = daysDiff != null ? Math.abs(daysDiff) : 0;
            const dueReminderText = isRecovered
              ? 'Recovered'
              : !loan.agreedReturnDate
                ? 'Terms'
                : isOverdue
                  ? `Overdue by ${overdueDays}d`
                  : daysDiff === 0
                    ? 'Remind today at 09:00 AM'
                    : `Remind in ${daysDiff}d at 09:00 AM`;

            return (
              <div
                key={loan.id}
                onClick={() => (onSelectLoan ? onSelectLoan(loan) : navigate('loanDetail', { id: loan.id }))}
                className={`p-4 rounded-3xl border transition-all cursor-pointer active:scale-[0.99] group ${isRecovered ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-[#E8DFCE] shadow-xs hover:border-emerald-400'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {loan.borrowerName}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {loan.category.replace('_', ' ')}
                      </span>
                      {loan.interestRatePercent ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          +{loan.interestRatePercent}% int
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium flex-wrap">
                      <span>Return: {loan.agreedReturnDate ? new Date(loan.agreedReturnDate).toLocaleDateString() : 'Terms'}</span>
                      {!isRecovered && loan.agreedReturnDate && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOverdue
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                        >
                          <Bell className={`w-2.5 h-2.5 ${isOverdue ? 'text-rose-600' : 'text-amber-600 animate-pulse'}`} />
                          <span>{dueReminderText}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Unreturned Balance</span>
                    <span
                      className={`text-base font-black font-mono ${isRecovered ? 'text-slate-400' : 'text-emerald-700'}`}
                    >
                      {formatMoney(loan.remainingBalance, showNumbers)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. FAB Button */}
      {canCreate && (
        <Fab
          icon={Plus}
          label={activeSegment === 'BORROWED' ? 'New Debt' : 'Advance Loan'}
          onClick={activeSegment === 'BORROWED' ? handleOpenNewDebt : handleOpenNewLoan}
          variant={activeSegment === 'BORROWED' ? 'rose' : 'emerald'}
        />
      )}

      {/* Sheets */}
      <NewDebtSheet
        isOpen={showNewDebt}
        onClose={() => setShowNewDebt(false)}
        activeMember={activeMember}
      />

      <NewLoanSheet
        isOpen={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        activeMember={activeMember}
        leftMoney={leftMoney}
      />
    </div>
  );
};

