import React from 'react';
import { Phone, Calendar, Scale, ArrowDownLeft, CreditCard, Bell, Clock, Users, Radio } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { nativeAppLauncher } from '../../native/appLauncher.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { RepayDebtSheet } from '../../sheets/loans/RepayDebtSheet.tsx';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateDebtLiabilityPdf } from '../../services/pdf/generators/shared/debtLiabilityPdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
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
  const { showToast } = useToast();
  const debt = propDebt || (dataService.getState().debtLiabilities || []).find((d) => d.id === debtId);

  const isSettled = debt ? debt.status === 'SETTLED' : false;
  const isOverdue = !isSettled && debt?.dueDate ? new Date(debt.dueDate).getTime() < Date.now() : false;
  const daysDiff = debt?.dueDate
    ? Math.ceil((new Date(debt.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const overdueDays = Math.abs(daysDiff);
  const dueRelativeText = isSettled
    ? 'Fully Settled'
    : isOverdue
      ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
      : daysDiff === 0
        ? `Remind today at 09:00 AM`
        : `Remind in ${daysDiff} day${daysDiff === 1 ? '' : 's'} at 09:00 AM`;

  const handleBroadcastOrgAlert = () => {
    if (!debt || !debt.dueDate) return;
    dataService.broadcastFinancialDueAlert({
      entityType: 'DEBT_LIABILITY',
      entityId: debt.id,
      partyName: debt.creditorName,
      amount: debt.remainingBalance,
      dueDate: debt.dueDate,
      customNote: `Debt liability alert for ${debt.creditorName}. Balance remaining: $${debt.remainingBalance.toFixed(2)}.`,
      actor: activeMember,
    });
    showToast(`Broadcast alert for ${debt.creditorName} sent to all org members.`);
  };

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

        <div className="pt-2 border-t border-[#F0EBE1] flex flex-wrap items-center gap-2">
          {debt.creditorContact && (
            <button
              type="button"
              onClick={() => void nativeAppLauncher.dialPhone(debt.creditorContact!)}
              className="flex-1 min-w-[130px] py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call ({debt.creditorContact})</span>
            </button>
          )}
          <PdfExportButton
            label="Share Debt Statement"
            title={`Creditor Statement: ${debt.creditorName}`}
            filename={buildExportFilename({
              orgName: dataService.getActiveOrg()?.name,
              documentType: 'Creditor-Debt-Statement',
              entityName: `${debt.id}-${debt.creditorName}`,
            })}
            generateDoc={() =>
              generateDebtLiabilityPdf({
                organization: dataService.getActiveOrg(),
                debt,
                operatorName: activeMember.fullName,
              })
            }
          />
        </div>
      </div>

      {/* Due Date & Active Reminder Schedule Card */}
      {debt.dueDate && (
        <div className="p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-2.5 rounded-2xl shrink-0 ${isSettled
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
                  Liability Due Date
                </span>
                <h4 className="text-sm font-black text-slate-900 truncate">
                  {new Date(debt.dueDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h4>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${isSettled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isOverdue
                    ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                    : 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                }`}
            >
              {dueRelativeText}
            </span>
          </div>

          {!isSettled && (
            <>
              <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs text-slate-600 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-[11px] leading-tight">
                    {isOverdue
                      ? `Alert passed on due date at 09:00 AM. Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}.`
                      : `Active morning notification scheduled for 2 days prior and on due date at 09:00 AM.`}
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

