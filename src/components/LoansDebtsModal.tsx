import React, { useState } from 'react';
import {
  X,
  Scale,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Clock,
  DollarSign,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import type { DebtLiabilityEvent, LoanGivenEvent, OrgMember, DebtCategory, LoanCategory } from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';

interface LoansDebtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: DebtLiabilityEvent[];
  loansGiven: LoanGivenEvent[];
  activeMember: OrgMember;
  leftMoney: number;
  showNumbers?: boolean;
}

export const LoansDebtsModal: React.FC<LoansDebtsModalProps> = ({
  isOpen,
  onClose,
  debts,
  loansGiven,
  activeMember,
  leftMoney,
  showNumbers = true,
}) => {
  const [activeTab, setActiveTab] = useState<'BORROWED' | 'LENT'>('BORROWED');
  const [activeView, setActiveView] = useState<'LIST' | 'NEW_DEBT' | 'NEW_LOAN' | 'REPAY_DEBT' | 'RECOVER_LOAN'>('LIST');

  const [selectedDebt, setSelectedDebt] = useState<DebtLiabilityEvent | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanGivenEvent | null>(null);
  const [formError, setFormError] = useState('');

  // New Debt Form State
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtContact, setDebtContact] = useState('');
  const [debtCategory, setDebtCategory] = useState<DebtCategory>('SUPPLIER_CREDIT');
  const [debtPrincipal, setDebtPrincipal] = useState('');
  const [debtDueDate, setDebtDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [debtPurpose, setDebtPurpose] = useState('');

  // Repay Debt Form State
  const [repayDebtAmount, setRepayDebtAmount] = useState('');
  const [repayDebtMethod, setRepayDebtMethod] = useState('Cash (USD)');
  const [repayDebtRef, setRepayDebtRef] = useState('');
  const [repayDebtNote, setRepayDebtNote] = useState('');

  // New Loan Form State
  const [loanBorrower, setLoanBorrower] = useState('');
  const [loanContact, setLoanContact] = useState('');
  const [loanCategory, setLoanCategory] = useState<LoanCategory>('OUTGROWER_ADVANCE');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanReturnDate, setLoanReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [loanCollateral, setLoanCollateral] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');

  // Recover Loan Form State
  const [recoverLoanAmount, setRecoverLoanAmount] = useState('');
  const [recoverLoanMethod, setRecoverLoanMethod] = useState('Cash (USD)');
  const [recoverLoanRef, setRecoverLoanRef] = useState('');
  const [recoverLoanNote, setRecoverLoanNote] = useState('');

  if (!isOpen) return null;

  const totalBorrowedOutstanding = debts
    .filter((d) => d.status !== 'SETTLED')
    .reduce((acc, d) => acc + d.remainingBalance, 0);

  const totalLoansOutstanding = loansGiven
    .filter((l) => l.status !== 'RECOVERED')
    .reduce((acc, l) => acc + l.remainingBalance, 0);

  const handleCreateDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const p = parseFloat(debtPrincipal);
    if (!debtCreditor.trim()) {
      setFormError('Creditor / Lender name is required.');
      return;
    }
    if (isNaN(p) || p <= 0) {
      setFormError('Principal amount must be greater than zero.');
      return;
    }
    if (debtPurpose.trim().length < 4) {
      setFormError('Mandatory explanation note (min 4 chars) is required.');
      return;
    }

    try {
      dataService.recordDebtLiability({
        creditorName: debtCreditor.trim(),
        creditorContact: debtContact.trim() || undefined,
        category: debtCategory,
        principalAmount: p,
        dueDate: debtDueDate || undefined,
        purposeNote: debtPurpose.trim(),
        actor: activeMember,
      });

      setDebtCreditor('');
      setDebtContact('');
      setDebtPrincipal('');
      setDebtPurpose('');
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record liability.');
    }
  };

  const handleRepayDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    setFormError('');
    const amt = parseFloat(repayDebtAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Repayment amount must be greater than zero.');
      return;
    }
    if (amt > selectedDebt.remainingBalance) {
      setFormError(`Repayment amount ($${amt.toFixed(2)}) exceeds remaining balance ($${selectedDebt.remainingBalance.toFixed(2)}).`);
      return;
    }
    if (amt > leftMoney) {
      setFormError(`Insufficient funds: Repayment requires $${amt.toFixed(2)}, but Left Money is $${leftMoney.toFixed(2)}.`);
      return;
    }

    try {
      dataService.repayDebtLiability({
        debtId: selectedDebt.id,
        amount: amt,
        paymentMethod: repayDebtMethod,
        receiptReference: repayDebtRef.trim() || undefined,
        note: repayDebtNote.trim() || `Debt repayment to ${selectedDebt.creditorName}`,
        actor: activeMember,
      });

      setSelectedDebt(null);
      setRepayDebtAmount('');
      setRepayDebtNote('');
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to disburse debt repayment.');
    }
  };

  const handleCreateLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const p = parseFloat(loanPrincipal);
    if (!loanBorrower.trim()) {
      setFormError('Borrower name is required.');
      return;
    }
    if (isNaN(p) || p <= 0) {
      setFormError('Loan amount must be greater than zero.');
      return;
    }
    if (p > leftMoney) {
      setFormError(`Insufficient cash: Left Money is $${leftMoney.toFixed(2)}, but loan requires $${p.toFixed(2)}.`);
      return;
    }
    if (!loanReturnDate) {
      setFormError('Agreed return date is required.');
      return;
    }
    if (loanPurpose.trim().length < 4) {
      setFormError('Mandatory loan purpose explanation (min 4 chars) is required.');
      return;
    }

    try {
      dataService.recordLoanGiven({
        borrowerName: loanBorrower.trim(),
        borrowerContact: loanContact.trim(),
        category: loanCategory,
        principalAmount: p,
        agreedReturnDate: loanReturnDate,
        collateralNote: loanCollateral.trim() || undefined,
        purposeNote: loanPurpose.trim(),
        actor: activeMember,
      });

      setLoanBorrower('');
      setLoanContact('');
      setLoanPrincipal('');
      setLoanPurpose('');
      setLoanCollateral('');
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to issue loan.');
    }
  };

  const handleRecoverLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setFormError('');
    const amt = parseFloat(recoverLoanAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Recovery amount must be greater than zero.');
      return;
    }
    if (amt > selectedLoan.remainingBalance) {
      setFormError(`Recovery amount ($${amt.toFixed(2)}) exceeds remaining loan balance ($${selectedLoan.remainingBalance.toFixed(2)}).`);
      return;
    }

    try {
      dataService.recoverLoanGiven({
        loanId: selectedLoan.id,
        amount: amt,
        paymentMethod: recoverLoanMethod,
        receiptReference: recoverLoanRef.trim() || undefined,
        note: recoverLoanNote.trim() || `Loan recovery from ${selectedLoan.borrowerName}`,
        actor: activeMember,
      });

      setSelectedLoan(null);
      setRecoverLoanAmount('');
      setRecoverLoanNote('');
      setActiveView('LIST');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to recover loan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#F0EBE1] bg-gradient-to-r from-amber-500/10 via-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Loans, Debts &amp; Liabilities Hub
              </h2>
              <p className="text-xs text-slate-500">
                Transparently record borrowed money (creditors) and credit given to others (debtors)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 gap-3 p-4 sm:p-6 bg-[#FAF8F5] border-b border-[#E8DFCE]">
          <div
            onClick={() => {
              setActiveTab('BORROWED');
              setActiveView('LIST');
            }}
            className={`p-3 rounded-2xl border cursor-pointer transition-all ${activeTab === 'BORROWED'
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-[#E8DFCE] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Borrowed (Not Paid Yet)
              </span>
              <ArrowDownLeft className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-lg sm:text-2xl font-black font-mono text-rose-600 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalBorrowedOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Supplier credit &amp; external debt</span>
          </div>

          <div
            onClick={() => {
              setActiveTab('LENT');
              setActiveView('LIST');
            }}
            className={`p-3 rounded-2xl border cursor-pointer transition-all ${activeTab === 'LENT'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-[#E8DFCE] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Loans Given (Not Returned Yet)
              </span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-2xl font-black font-mono text-emerald-700 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalLoansOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Advances to outgrowers &amp; partners</span>
          </div>
        </div>

        {/* Tab Selector & Action Switcher */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-[#E8DFCE]">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('BORROWED');
                setActiveView('LIST');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'BORROWED'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Borrowed Liabilities ({debts.filter((d) => d.status !== 'SETTLED').length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('LENT');
                setActiveView('LIST');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'LENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Loans Given ({loansGiven.filter((l) => l.status !== 'RECOVERED').length})
            </button>
          </div>

          {activeView === 'LIST' ? (
            <button
              type="button"
              onClick={() => setActiveView(activeTab === 'BORROWED' ? 'NEW_DEBT' : 'NEW_LOAN')}
              className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {activeTab === 'BORROWED' ? 'Record Borrowed Debt' : 'Disburse New Loan'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setActiveView('LIST');
                setSelectedDebt(null);
                setSelectedLoan(null);
                setFormError('');
              }}
              className="py-1.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
            >
              ← Back to List
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* LIST VIEW */}
          {activeView === 'LIST' && (
            <div className="space-y-3">
              {activeTab === 'BORROWED' ? (
                debts.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#E8DFCE]">
                    <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-700">No Borrowed Debts Recorded</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      If your organization takes chicks or feed on credit or borrows external funds, record it here so it is not mistaken for user money.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveView('NEW_DEBT')}
                      className="mt-4 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      + Record Borrowed Debt
                    </button>
                  </div>
                ) : (
                  debts.map((d) => {
                    const isSettled = d.status === 'SETTLED';
                    const isOverdue = !isSettled && d.dueDate && new Date(d.dueDate).getTime() < Date.now();

                    return (
                      <div
                        key={d.id}
                        className={`p-4 rounded-2xl border transition-all ${isSettled
                            ? 'bg-slate-50/70 border-slate-200 opacity-80'
                            : isOverdue
                              ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                              : 'bg-white border-[#E8DFCE] shadow-xs'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">{d.creditorName}</span>
                              <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                {d.category.replace('_', ' ')}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSettled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isOverdue
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                              >
                                {isSettled ? '✓ Settled' : isOverdue ? '⚠️ OVERDUE' : '⏳ Unpaid'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{d.purposeNote}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                              <span>Borrowed: {new Date(d.borrowDate).toLocaleDateString()}</span>
                              {d.dueDate && <span>• Due: {new Date(d.dueDate).toLocaleDateString()}</span>}
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-start sm:items-end">
                            <span className="text-xs text-slate-400">Balance Owed</span>
                            <span className={`text-base font-black font-mono ${isSettled ? 'text-slate-400' : 'text-rose-600'}`}>
                              ${d.remainingBalance.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Principal: ${d.principalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {!isSettled && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              Liquid Cash Available: <strong className="font-mono text-emerald-600">${leftMoney.toFixed(2)}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDebt(d);
                                setRepayDebtAmount(String(Math.min(leftMoney, d.remainingBalance)));
                                setRepayDebtNote('');
                                setActiveView('REPAY_DEBT');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Repay Debt ($)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                loansGiven.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#E8DFCE]">
                    <HandCoins className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-700">No Loans Given Recorded</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      If you lend farm money to outgrowers, partners, or members before it is returned, record it here to account for every dollar.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveView('NEW_LOAN')}
                      className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      + Disburse New Loan
                    </button>
                  </div>
                ) : (
                  loansGiven.map((l) => {
                    const isRecovered = l.status === 'RECOVERED';
                    const isOverdue = !isRecovered && new Date(l.agreedReturnDate).getTime() < Date.now();

                    return (
                      <div
                        key={l.id}
                        className={`p-4 rounded-2xl border transition-all ${isRecovered
                            ? 'bg-slate-50/70 border-slate-200 opacity-80'
                            : isOverdue
                              ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                              : 'bg-white border-[#E8DFCE] shadow-xs'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">{l.borrowerName}</span>
                              <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                {l.category.replace('_', ' ')}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isRecovered
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isOverdue
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                              >
                                {isRecovered ? '✓ Recovered' : isOverdue ? '⚠️ PAST DUE' : '⏳ Active Loan'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{l.purposeNote}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                              <span>Phone: {l.borrowerContact}</span>
                              <span>• Return Date: {new Date(l.agreedReturnDate).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-start sm:items-end">
                            <span className="text-xs text-slate-400">Balance to Recover</span>
                            <span className={`text-base font-black font-mono ${isRecovered ? 'text-slate-400' : 'text-emerald-700'}`}>
                              ${l.remainingBalance.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Lent: ${l.principalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {!isRecovered && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLoan(l);
                                setRecoverLoanAmount(String(l.remainingBalance));
                                setRecoverLoanNote('');
                                setActiveView('RECOVER_LOAN');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Recover Funds ($)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>
          )}

          {/* NEW DEBT VIEW */}
          {activeView === 'NEW_DEBT' && (
            <form onSubmit={handleCreateDebtSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                ℹ️ <strong>Liability Accounting:</strong> Recording borrowed debt or trade credit accounts for stock or cash obtained from external parties without mixing it with member capital.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="d-cred" className="block text-xs font-bold text-slate-700 mb-1">
                    Creditor / Lender / Supplier Name *
                  </label>
                  <input
                    id="d-cred"
                    type="text"
                    required
                    placeholder="e.g. Irvine's Hatcheries, AgriBank, or John Doe"
                    value={debtCreditor}
                    onChange={(e) => setDebtCreditor(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label htmlFor="d-cat" className="block text-xs font-bold text-slate-700 mb-1">
                    Liability Category *
                  </label>
                  <select
                    id="d-cat"
                    value={debtCategory}
                    onChange={(e) => setDebtCategory(e.target.value as DebtCategory)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="SUPPLIER_CREDIT">Supplier Credit (Chicks, Feed, Medication)</option>
                    <option value="EXTERNAL_LOAN">External Bank / Microfinance Loan</option>
                    <option value="DIRECTOR_MEMBER_ADVANCE">Director / Member Personal Advance</option>
                    <option value="EQUIPMENT_FINANCING">Equipment &amp; Asset Financing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="d-amt" className="block text-xs font-bold text-slate-700 mb-1">
                    Principal Amount ($) *
                  </label>
                  <input
                    id="d-amt"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 500.00"
                    value={debtPrincipal}
                    onChange={(e) => setDebtPrincipal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label htmlFor="d-due" className="block text-xs font-bold text-slate-700 mb-1">
                    Repayment Due Date
                  </label>
                  <input
                    id="d-due"
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="d-note" className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Purpose &amp; Terms Note *
                </label>
                <textarea
                  id="d-note"
                  rows={2}
                  required
                  placeholder="e.g. 500 Cobb 500 broilers taken from Irvine's on 30-day payment term at $1.00/bird."
                  value={debtPurpose}
                  onChange={(e) => setDebtPurpose(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Save Borrowed Liability
                </button>
              </div>
            </form>
          )}

          {/* REPAY DEBT VIEW */}
          {activeView === 'REPAY_DEBT' && selectedDebt && (
            <form onSubmit={handleRepayDebtSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1">
                <h4 className="font-extrabold text-sm text-rose-900">
                  Repaying Debt to {selectedDebt.creditorName}
                </h4>
                <p>
                  Remaining Balance: <strong className="font-mono text-sm">${selectedDebt.remainingBalance.toFixed(2)}</strong>
                </p>
                <p>
                  Liquid Cash in Left Money: <strong className="font-mono text-sm text-emerald-700">${leftMoney.toFixed(2)}</strong>
                </p>
              </div>

              <div>
                <label htmlFor="rd-amt" className="block text-xs font-bold text-slate-700 mb-1">
                  Repayment Amount to Disburse ($) *
                </label>
                <input
                  id="rd-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.min(leftMoney, selectedDebt.remainingBalance)}
                  required
                  value={repayDebtAmount}
                  onChange={(e) => setRepayDebtAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="rd-meth" className="block text-xs font-bold text-slate-700 mb-1">
                    Disbursement Method *
                  </label>
                  <select
                    id="rd-meth"
                    value={repayDebtMethod}
                    onChange={(e) => setRepayDebtMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="Cash (USD)">Cash (USD)</option>
                    <option value="Bank Transfer">Bank Transfer (Nostro)</option>
                    <option value="EcoCash USD">EcoCash USD</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rd-ref" className="block text-xs font-bold text-slate-700 mb-1">
                    Receipt / Transfer Reference
                  </label>
                  <input
                    id="rd-ref"
                    type="text"
                    placeholder="e.g. EFT-88219"
                    value={repayDebtRef}
                    onChange={(e) => setRepayDebtRef(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Disburse &amp; Settle Debt
                </button>
              </div>
            </form>
          )}

          {/* NEW LOAN GIVEN VIEW */}
          {activeView === 'NEW_LOAN' && (
            <form onSubmit={handleCreateLoanSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                ℹ️ <strong>Lending to Third Parties:</strong> When advancing funds to outgrower farmers or partner farms, money is disbursed from Left Money and tracked as an asset receivable until returned.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="l-bor" className="block text-xs font-bold text-slate-700 mb-1">
                    Borrower / Partner Name *
                  </label>
                  <input
                    id="l-bor"
                    type="text"
                    required
                    placeholder="e.g. Outgrower Farmer Chitepo"
                    value={loanBorrower}
                    onChange={(e) => setLoanBorrower(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="l-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Borrower Contact Phone *
                  </label>
                  <input
                    id="l-phone"
                    type="tel"
                    required
                    placeholder="e.g. +263 77 987 6543"
                    value={loanContact}
                    onChange={(e) => setLoanContact(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="l-amt" className="block text-xs font-bold text-slate-700 mb-1">
                    Loan Amount ($) * [Max Available: ${leftMoney.toFixed(2)}]
                  </label>
                  <input
                    id="l-amt"
                    type="number"
                    step="0.01"
                    min="1"
                    max={leftMoney}
                    required
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="l-date" className="block text-xs font-bold text-slate-700 mb-1">
                    Agreed Return Date *
                  </label>
                  <input
                    id="l-date"
                    type="date"
                    required
                    value={loanReturnDate}
                    onChange={(e) => setLoanReturnDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="l-purp" className="block text-xs font-bold text-slate-700 mb-1">
                  Loan Purpose &amp; Collateral Description *
                </label>
                <textarea
                  id="l-purp"
                  rows={2}
                  required
                  placeholder="e.g. Advanced $150 to buy 3 bags of layer mash, payable after egg harvest."
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Disburse Loan from Left Money
                </button>
              </div>
            </form>
          )}

          {/* RECOVER LOAN VIEW */}
          {activeView === 'RECOVER_LOAN' && selectedLoan && (
            <form onSubmit={handleRecoverLoanSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <h4 className="font-extrabold text-sm text-emerald-900">
                  Recovering Loan from {selectedLoan.borrowerName}
                </h4>
                <p>
                  Outstanding Loan Balance: <strong className="font-mono text-sm">${selectedLoan.remainingBalance.toFixed(2)}</strong>
                </p>
                <p className="text-[11px] text-emerald-700">
                  Recovered cash will be returned into Left Money.
                </p>
              </div>

              <div>
                <label htmlFor="rl-amt" className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Recovered ($) *
                </label>
                <input
                  id="rl-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedLoan.remainingBalance}
                  required
                  value={recoverLoanAmount}
                  onChange={(e) => setRecoverLoanAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Confirm Loan Recovery
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

