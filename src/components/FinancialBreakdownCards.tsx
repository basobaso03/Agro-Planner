import React from 'react';
import {
  Wallet,
  TrendingUp,
  Receipt,
  Scale,
  CreditCard,
  Building2,
  Bird,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import type { FinancialSummary } from '../types/agro.ts';

interface FinancialBreakdownCardsProps {
  financials: FinancialSummary;
  showNumbers?: boolean;
  onOpenLoansDebts?: () => void;
  onOpenCreditSales?: () => void;
  onOpenLivestockValuation?: () => void;
  onNavigateTab?: (tab: any) => void;
  isAgroEnabled?: boolean;
}

export const FinancialBreakdownCards: React.FC<FinancialBreakdownCardsProps> = ({
  financials,
  showNumbers = true,
  onOpenLoansDebts,
  onOpenCreditSales,
  onOpenLivestockValuation,
  onNavigateTab,
  isAgroEnabled = true,
}) => {
  const leftCash = financials.leftMoney ?? 0;
  const netWorth = financials.netFinancialPosition ?? financials.totalNav;
  const totalPool = financials.totalPool ?? 0;
  const expenses = financials.approvedExpenses ?? 0;
  const borrowed = financials.totalBorrowedDebtOutstanding ?? 0;
  const loansGiven = financials.totalLoansGivenOutstanding ?? 0;
  const creditSales = financials.totalCreditSalesOutstanding ?? 0;
  const fixedAssets = financials.totalFixedAssetsValue ?? 0;
  const livestockVal = financials.totalExpectedLivestockRevenue ?? financials.estimatedActiveLivestockValue ?? 0;

  const cards = [
    {
      id: 'CASH',
      title: 'True Cash on Ground',
      value: leftCash,
      subtitle: 'Liquid Bank & Mobile Wallets',
      badge: leftCash <= 0 ? 'Empty' : 'Liquid Cash',
      badgeColor: leftCash <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
      icon: Wallet,
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
      borderAccent: 'border-emerald-200 hover:border-emerald-400',
      onClick: () => onNavigateTab?.('POOL'),
    },
    {
      id: 'NET_WORTH',
      title: 'True Net Worth (NAV)',
      value: netWorth,
      subtitle: 'Cash + Assets + Debts Net',
      badge: 'Solvent Net Worth',
      badgeColor: 'bg-amber-100 text-amber-800',
      icon: TrendingUp,
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
      borderAccent: 'border-amber-200 hover:border-amber-400',
      onClick: () => onNavigateTab?.('POOL'),
    },
    {
      id: 'BORROWED',
      title: 'Borrowed (Not Paid Yet)',
      value: borrowed,
      subtitle: 'Supplier Credit & Bank Debt',
      badge: borrowed > 0 ? 'Active Debt' : 'Debt Free',
      badgeColor: borrowed > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600',
      icon: ArrowDownLeft,
      iconBg: 'bg-gradient-to-br from-rose-500 to-red-600 text-white',
      borderAccent: 'border-rose-200 hover:border-rose-400',
      onClick: onOpenLoansDebts,
    },
    {
      id: 'CREDIT_SALES',
      title: 'Sales on Credit (Receivables)',
      value: creditSales,
      subtitle: 'Customer Accounts Due',
      badge: creditSales > 0 ? 'Due from Customers' : 'All Settled',
      badgeColor: creditSales > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600',
      icon: CreditCard,
      iconBg: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
      borderAccent: 'border-sky-200 hover:border-sky-400',
      onClick: onOpenCreditSales,
    },
    {
      id: 'LOANS_GIVEN',
      title: 'Loans Given (Not Returned)',
      value: loansGiven,
      subtitle: 'Advances to Outgrowers',
      badge: loansGiven > 0 ? 'Lent Out' : 'None Active',
      badgeColor: loansGiven > 0 ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600',
      icon: ArrowUpRight,
      iconBg: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white',
      borderAccent: 'border-teal-200 hover:border-teal-400',
      onClick: onOpenLoansDebts,
    },
    {
      id: 'LIVESTOCK_VAL',
      title: isAgroEnabled ? 'Livestock Expected Revenue' : 'Project Valuation',
      value: livestockVal,
      subtitle: isAgroEnabled ? 'Living Herd Expected Sale' : 'Inventory Value',
      badge: 'Expected Proceeds',
      badgeColor: 'bg-amber-100 text-amber-800',
      icon: isAgroEnabled ? Bird : Sparkles,
      iconBg: 'bg-gradient-to-br from-amber-600 to-yellow-600 text-white',
      borderAccent: 'border-amber-200 hover:border-amber-400',
      onClick: onOpenLivestockValuation,
    },
    {
      id: 'FIXED_ASSETS',
      title: 'Fixed Assets Valuation',
      value: fixedAssets,
      subtitle: 'Equipment, Solar, Vehicles',
      badge: 'Verified Assets',
      badgeColor: 'bg-slate-100 text-slate-800',
      icon: Building2,
      iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white',
      borderAccent: 'border-slate-200 hover:border-slate-400',
      onClick: () => onNavigateTab?.('ASSETS'),
    },
    {
      id: 'CONTRIBUTIONS',
      title: 'Member Capital Pool',
      value: totalPool,
      subtitle: 'Total Contributed Equity',
      badge: 'Paid-in Capital',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      icon: ShieldCheck,
      iconBg: 'bg-gradient-to-br from-emerald-600 to-green-700 text-white',
      borderAccent: 'border-emerald-200 hover:border-emerald-400',
      onClick: () => onNavigateTab?.('POOL'),
    },
    {
      id: 'EXPENSES',
      title: 'Cumulative Expenses',
      value: expenses,
      subtitle: 'Feed, Medication, Labor',
      badge: 'Approved Outflows',
      badgeColor: 'bg-rose-100 text-rose-800',
      icon: Receipt,
      iconBg: 'bg-gradient-to-br from-rose-600 to-pink-700 text-white',
      borderAccent: 'border-rose-200 hover:border-rose-400',
      onClick: () => onNavigateTab?.('EXPENSES'),
    },
  ];

  return (
    <section aria-label="Transparent 9-Pillar Financial Breakdown" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Treasury &amp; Wealth Breakdown</span>
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
              9-Pillar Ledger
            </span>
          </h2>
          <p className="text-[11px] text-slate-500">
            Real money on the ground, debts owed, customer receivables, and physical valuations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={card.onClick}
              className={`p-3.5 sm:p-4 rounded-3xl bg-white border ${card.borderAccent} shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${card.iconBg} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">
                      {card.title}
                    </span>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
                      {card.subtitle}
                    </span>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900">
                  {!showNumbers
                    ? '••••••••'
                    : `$${card.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
                <span className="text-[10px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

