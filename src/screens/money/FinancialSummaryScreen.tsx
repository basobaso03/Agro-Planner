import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney, isPrivacyMasked } from '../../utils/currency.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface FinancialSummaryScreenProps {
  activeMember: OrgMember;
}

export const FinancialSummaryScreen: React.FC<FinancialSummaryScreenProps> = () => {
  const [masked] = useState(isPrivacyMasked());

  const fin = dataService.computeFinancialSummary();
  const equities = dataService.computeMemberEquitySummaries();
  const assets = dataService.computeFixedAssetGroupSummaries();

  const totalAssetValue = assets.reduce((acc, a) => acc + a.currentValue, 0);
  const netProfit = fin.totalSalesRevenue - fin.approvedExpenses;
  const netVentureWorth = fin.leftMoney + totalAssetValue;

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Statement */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="text-xs text-slate-400 font-medium">Consolidated Financial Statement</div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="text-xs text-slate-400">Net Venture Worth (NAV)</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-400 mt-0.5">
              {formatMoney(netVentureWorth, { mask: masked })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Net Operating Profit</div>
            <div
              className={`text-2xl font-bold tracking-tight mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
            >
              {formatMoney(netProfit, { mask: masked })}
            </div>
          </div>
        </div>
      </div>

      {/* Income & Expense Breakdown */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Income & Operating Ledger</div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Total Sales Revenue (Cash + Invoiced)</span>
            <span className="font-bold text-emerald-600">
              {formatMoney(fin.totalSalesRevenue, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Approved Operating Expenses</span>
            <span className="font-bold text-rose-600">
              {formatMoney(fin.approvedExpenses, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Pending Multi-Sig Clearances</span>
            <span className="font-bold text-amber-600">
              {formatMoney(fin.pendingMultiSigExpenses, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Syndicate Member Dividends Paid</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {formatMoney(fin.distributedDividendsCash, { mask: masked })}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Reinvested Sales Capital</span>
            <span className="font-bold text-emerald-600">
              {formatMoney(fin.reinvestedSalesCash, { mask: masked })}
            </span>
          </div>
        </div>
      </div>

      {/* Member Equity Distribution */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Syndicate Pool Equity Breakdown</div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {equities.map((eq) => (
            <div key={eq.member.id} className="py-2.5 flex justify-between items-center">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{eq.member.fullName}</div>
                <div className="text-[11px] text-slate-400">
                  Target: {formatMoney(eq.targetContributionUsd, { mask: masked })} · {eq.isGoalMet ? '✅ Goal Met' : `${eq.progressPercentage.toFixed(0)}% reached`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900 dark:text-white">
                  {formatMoney(eq.netContribution, { mask: masked })}
                </div>
                <div className="text-[11px] font-semibold text-emerald-600">
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

