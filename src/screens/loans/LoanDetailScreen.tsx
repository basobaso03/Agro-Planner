import React from 'react';
import { Phone, Calendar, Scale, ArrowUpRight, DollarSign, Bell, Clock, Users, Radio } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { nativeAppLauncher } from '../../native/appLauncher.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { RecoverLoanSheet } from '../../sheets/loans/RecoverLoanSheet.tsx';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateLoanAgreementPdf } from '../../services/pdf/generators/shared/loanAgreementPdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import type { LoanGivenEvent, OrgMember } from '../../types/agro.ts';

export interface LoanDetailScreenProps {
  loan?: LoanGivenEvent;
  loanId?: string;
  activeMember: OrgMember;
  showNumbers?: boolean;
  onRecoverLoan?: () => void;
  onBack?: () => void;
}

export const LoanDetailScreen: React.FC<LoanDetailScreenProps> = ({
  loan: propLoan,
  loanId,
  activeMember,
  showNumbers = true,
  onRecoverLoan = () => { },
  onBack,
}) => {
  const [showRecoverSheet, setShowRecoverSheet] = React.useState(false);
  const { showToast } = useToast();
  const loan = propLoan || (dataService.getState().loansGiven || []).find((l) => l.id === loanId);

  const isRecovered = loan ? loan.status === 'RECOVERED' : false;
  const isOverdue = !isRecovered && loan?.agreedReturnDate ? new Date(loan.agreedReturnDate).getTime() < Date.now() : false;
  const daysDiff = loan?.agreedReturnDate
    ? Math.ceil((new Date(loan.agreedReturnDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const overdueDays = Math.abs(daysDiff);
  const dueRelativeText = isRecovered
    ? 'Fully Recovered'
    : isOverdue
      ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
      : daysDiff === 0
        ? `Remind today at 09:00 AM`
        : `Remind in ${daysDiff} day${daysDiff === 1 ? '' : 's'} at 09:00 AM`;

  const handleBroadcastOrgAlert = () => {
    if (!loan || !loan.agreedReturnDate) return;
    dataService.broadcastFinancialDueAlert({
      entityType: 'LOAN_GIVEN',
      entityId: loan.id,
      partyName: loan.borrowerName,
      amount: loan.remainingBalance,
      dueDate: loan.agreedReturnDate,
      customNote: `Loan advance alert for ${loan.borrowerName}. Balance receivable: $${loan.remainingBalance.toFixed(2)}.`,
      actor: activeMember,
    });
    showToast(`Broadcast alert for ${loan.borrowerName} sent to all org members.`);
  };

  if (!loan) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <EmptyState
          icon={Scale}
          title="Loan Not Found"
          description="This loan record could not be found in the current database snapshot."
          actionLabel="Go Back"
          onAction={onBack || (() => window.history.back())}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto pb-28">
      {/* 1. Header Borrower Card */}
      <div className="p-5 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Borrower</span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">{loan.borrowerName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Category: {loan.category.replace('_', ' ')}</p>
          </div>

          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border ${isRecovered
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
          >
            {isRecovered ? 'Fully Recovered ✓' : 'Active Loan'}
          </span>
        </div>

        <div className="pt-2 border-t border-[#F0EBE1] flex flex-wrap items-center gap-2">
          {loan.borrowerContact && (
            <button
              type="button"
              onClick={() => void nativeAppLauncher.dialPhone(loan.borrowerContact!)}
              className="flex-1 min-w-[130px] py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call ({loan.borrowerContact})</span>
            </button>
          )}
          <PdfExportButton
            label="Share Loan Contract"
            title={`Loan Agreement: ${loan.borrowerName}`}
            filename={buildExportFilename({
              orgName: dataService.getActiveOrg()?.name,
              documentType: 'Outgrower-Loan-Agreement',
              entityName: `${loan.id}-${loan.borrowerName}`,
            })}
            generateDoc={() =>
              generateLoanAgreementPdf({
                organization: dataService.getActiveOrg(),
                loan,
                operatorName: activeMember.fullName,
              })
            }
          />
        </div>
      </div>

      {/* Due Date & Active Reminder Schedule Card */}
      {loan.agreedReturnDate && (
        <div className="p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-2.5 rounded-2xl shrink-0 ${isRecovered
                    ? 'bg-emerald-50 text-emerald-700'
                    : isOverdue
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-amber-50 text-amber-700'
                  }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Agreed Return Date
                </span>
                <h4 className="text-sm font-black text-slate-900 truncate">
                  {new Date(loan.agreedReturnDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h4>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${isRecovered
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isOverdue
                    ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                    : 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                }`}
            >
              {dueRelativeText}
            </span>
          </div>

          {!isRecovered && (
            <>
              <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs text-slate-600 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-[11px] leading-tight">
                    {isOverdue
                      ? `Alert passed on agreed return date at 09:00 AM. Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}.`
                      : `Active morning notification scheduled for 2 days prior and on return date at 09:00 AM.`}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#F0EBE1]">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span>Notify Entire Team</span>
                </div>
                <button
                  type="button"
                  onClick={handleBroadcastOrgAlert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
                  <span>Broadcast Alert to Org</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. Financial Balance Breakdown */}
      <div className="grid grid-cols-3 gap-2 p-4 rounded-3xl bg-white border border-[#E8DFCE] text-center shadow-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Principal</span>
          <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
            {formatMoney(loan.principalAmount, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-emerald-700 font-bold uppercase block">Recovered</span>
          <span className="text-sm font-black font-mono text-emerald-600 mt-0.5 block">
            {formatMoney(loan.principalAmount - loan.remainingBalance, showNumbers)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-amber-700 font-bold uppercase block">Outstanding</span>
          <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 block">
            {formatMoney(loan.remainingBalance, showNumbers)}
          </span>
        </div>
      </div>

      {/* 3. Action Button */}
      {!isRecovered && (
        <button
          type="button"
          onClick={() => {
            onRecoverLoan();
            setShowRecoverSheet(true);
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <DollarSign className="w-4 h-4" />
          <span>Record Loan Recovery Payment</span>
        </button>
      )}

      {/* 4. Purpose, Collateral & Timeline */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
          Loan Details &amp; Collateral
        </span>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] p-4 space-y-3 text-xs shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Loan Purpose</span>
            <p className="text-slate-800 font-medium mt-0.5">{loan.purposeNote}</p>
          </div>

          {loan.collateralNote && (
            <div className="pt-2 border-t border-[#F0EBE1]">
              <span className="text-[10px] text-slate-400 block">Agreed Collateral</span>
              <p className="text-slate-800 font-medium mt-0.5">{loan.collateralNote}</p>
            </div>
          )}

          <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-slate-500 font-mono text-[11px]">
            <span>Agreed Return: {loan.agreedReturnDate ? new Date(loan.agreedReturnDate).toLocaleDateString() : 'N/A'}</span>
            <span>Issued: {new Date(loan.disbursedAt || loan.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <RecoverLoanSheet
        isOpen={showRecoverSheet}
        onClose={() => setShowRecoverSheet(false)}
        loan={loan}
        activeMember={activeMember}
      />
    </div>
  );
};

