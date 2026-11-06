import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney, isPrivacyMasked } from '../../utils/currency.ts';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateBalanceSheetPdf } from '../../services/pdf/generators/shared/balanceSheetPdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface FinancialSummaryScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
}

export const FinancialSummaryScreen: React.FC<FinancialSummaryScreenProps> = ({
  activeMember,
  showNumbers,
}) => {
  const masked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();

  const fin = dataService.computeFinancialSummary();
  const equities = dataService.computeMemberEquitySummaries();
  const assets = dataService.computeFixedAssetGroupSummaries();

  const totalAssetValue = assets.reduce((acc, a) => acc + a.currentValue, 0);
  const netProfit = fin.totalSalesRevenue - fin.approvedExpenses;
  const netVentureWorth = fin.leftMoney + totalAssetValue;

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Statement */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Consolidated Financial Statement</div>
          <PdfExportButton
            label="Share Balance Sheet PDF"
            title="9-Pillars Balance Sheet"
            filename={buildExportFilename({
              orgName: dataService.getActiveOrg()?.name,
              documentType: '9-Pillars-Balance-Sheet',
            })}
            generateDoc={() =>
              generateBalanceSheetPdf({
                organization: dataService.getActiveOrg(),
                summary: fin as any,
                operatorName: activeMember?.fullName || 'Authorized Treasurer',
              })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="text-xs text-slate-600 font-medium">Net Venture Worth (NAV)</div>
            <div className="text-2xl font-black font-mono tracking-tight text-emerald-700 mt-0.5">
              {formatMoney(netVentureWorth, { mask: masked })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-600 font-medium">Net Operating Profit</div>
            <div
              className={`text-2xl font-black font-mono tracking-tight mt-0.5 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
            >
              {formatMoney(netProfit, { mask: masked })}
            </div>
          </div>
        </div>
      </div>

      {/* Income & Expense Breakdown */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-black text-slate-950 text-sm">Income & Operating Ledger</div>
        <div className="divide-y divide-[#F0EBE1]">
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-800 font-medium">Total Sales Revenue (Cash + Invoiced)</span>
            <span className="font-black font-mono text-emerald-700">
              {formatMoney(fin.totalSalesRevenue, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-800 font-medium">Approved Operating Expenses</span>
            <span className="font-black font-mono text-rose-600">
              {formatMoney(fin.approvedExpenses, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-800 font-medium">Pending Multi-Sig Clearances</span>
            <span className="font-black font-mono text-amber-700">
              {formatMoney(fin.pendingMultiSigExpenses, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-800 font-medium">Syndicate Member Dividends Paid</span>
            <span className="font-black font-mono text-slate-950">
              {formatMoney(fin.distributedDividendsCash, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-800 font-medium">Reinvested Sales Capital</span>
            <span className="font-black font-mono text-emerald-700">
              {formatMoney(fin.reinvestedSalesCash, { mask: masked })}
            </span>
          </div>
        </div>
      </div>

      {/* Member Equity Distribution */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-black text-slate-950 text-sm">Syndicate Pool Equity Breakdown</div>
        <div className="divide-y divide-[#F0EBE1]">
          {equities.map((eq) => (
            <div key={eq.member.id} className="py-2.5 flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-950">{eq.member.fullName}</div>
                <div className="text-[11px] text-slate-600 font-medium">
                  Target: {formatMoney(eq.targetContributionUsd, { mask: masked })} · {eq.isGoalMet ? '✅ Goal Met' : `${eq.progressPercentage.toFixed(0)}% reached`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-black font-mono text-slate-950">
                  {formatMoney(eq.netContribution, { mask: masked })}
                </div>
                <div className="text-[11px] font-bold text-emerald-700">
                  {eq.profitSharePercentage.toFixed(2)}% equity
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

