import React from 'react';
import {
  Users,
  Warehouse,
  Radio,
  ShieldCheck,
  UserCog,
  Settings,
  Scale,
  HandCoins,
  TrendingUp,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  PiggyBank,
  BadgeAlert,
} from 'lucide-react';
import type { ActiveTab } from '../App.tsx';
import type { FinancialSummary } from '../types/agro.ts';

interface BankingHubGridProps {
  financials: FinancialSummary;
  memberCount: number;
  pendingUsersCount: number;
  unreadBroadcastsCount: number;
  assetCount: number;
  auditCount?: number;
  creditSalesCount: number;
  totalCreditSalesDue: number;
  totalDebtOutstanding: number;
  totalLoansGivenOutstanding: number;
  totalLivestockExpectedRevenue: number;
  canViewPool: boolean;
  canManageMembers: boolean;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenCreditSales: () => void;
  onOpenLoansDebts: () => void;
  onOpenLivestockValuation: () => void;
  showNumbers?: boolean;
}

export const BankingHubGrid: React.FC<BankingHubGridProps> = ({
  financials,
  memberCount,
  pendingUsersCount,
  unreadBroadcastsCount,
  assetCount,
  auditCount = 0,
  creditSalesCount,
  totalCreditSalesDue,
  totalDebtOutstanding,
  totalLoansGivenOutstanding,
  totalLivestockExpectedRevenue,
  canViewPool,
  canManageMembers,
  onNavigateTab,
  onOpenCreditSales,
  onOpenLoansDebts,
  onOpenLivestockValuation,
  showNumbers = true,
}) => {
  const formatMoney = (val: number) => {
    if (!showNumbers) return '••••';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const tiles = [
    // 1. Capital Pool (Transferred Tab)
    ...(canViewPool
      ? [
        {
          id: 'pool',
          title: 'Capital Pool',
          subtitle: 'Investments, equity & shares',
          preview: `${formatMoney(financials.totalPool)} · ${memberCount} Members`,
          icon: PiggyBank,
          badge: null,
          gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
          iconColor: 'text-amber-600 bg-amber-50 border-amber-200/80',
          borderColor: 'hover:border-amber-400',
          onClick: () => onNavigateTab('POOL'),
        },
      ]
      : []),

    // 2. Sales on Credit (New Feature Modal)
    {
      id: 'credit-sales',
      title: 'Sales on Credit',
      subtitle: 'Customer receivables & dates',
      preview: `${creditSalesCount} Active · ${formatMoney(totalCreditSalesDue)} Due`,
      icon: HandCoins,
      badge: creditSalesCount > 0 ? `${creditSalesCount} unpaid` : null,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      gradient: 'from-rose-500/20 via-rose-500/10 to-transparent',
      iconColor: 'text-rose-600 bg-rose-50 border-rose-200/80',
      borderColor: 'hover:border-rose-400',
      onClick: onOpenCreditSales,
    },

    // 3. Loans & Debts (New Feature Modal)
    {
      id: 'loans-debts',
      title: 'Loans & Debts',
      subtitle: 'External credit & money lent',
      preview: `Debt: ${formatMoney(totalDebtOutstanding)} · Lent: ${formatMoney(totalLoansGivenOutstanding)}`,
      icon: Scale,
      badge: totalDebtOutstanding > 0 ? 'Liabilities' : null,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      gradient: 'from-indigo-500/20 via-indigo-500/10 to-transparent',
      iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200/80',
      borderColor: 'hover:border-indigo-400',
      onClick: onOpenLoansDebts,
    },

    // 4. Livestock Valuation (New Feature Modal)
    {
      id: 'livestock-valuation',
      title: 'Livestock Valuation',
      subtitle: 'Price config & herd margin',
      preview: `Est. ${formatMoney(totalLivestockExpectedRevenue)} Projected Revenue`,
      icon: TrendingUp,
      badge: 'Price Config',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200/80',
      borderColor: 'hover:border-emerald-400',
      onClick: onOpenLivestockValuation,
    },

    // 5. Fixed Assets (Transferred Tab)
    {
      id: 'assets',
      title: 'Fixed Assets',
      subtitle: 'Machinery, sheds & items',
      preview: `${assetCount} Assets · ${formatMoney(financials.totalFixedAssetsValue)}`,
      icon: Warehouse,
      badge: null,
      gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
      iconColor: 'text-blue-600 bg-blue-50 border-blue-200/80',
      borderColor: 'hover:border-blue-400',
      onClick: () => onNavigateTab('ASSETS'),
    },

    // 6. Broadcast Center (Transferred Tab)
    {
      id: 'broadcasts',
      title: 'Broadcasts',
      subtitle: 'Urgent notices & updates',
      preview: unreadBroadcastsCount > 0 ? `${unreadBroadcastsCount} Unread Announcements` : 'All caught up',
      icon: Radio,
      badge: unreadBroadcastsCount > 0 ? `${unreadBroadcastsCount} new` : null,
      badgeColor: 'bg-amber-500 text-white border-amber-600',
      gradient: 'from-orange-500/20 via-orange-500/10 to-transparent',
      iconColor: 'text-orange-600 bg-orange-50 border-orange-200/80',
      borderColor: 'hover:border-orange-400',
      onClick: () => onNavigateTab('BROADCASTS'),
    },

    // 7. Audit Ledger (Transferred Tab)
    {
      id: 'audit',
      title: 'Audit Ledger',
      subtitle: 'Tamper-evident logs',
      preview: auditCount > 0 ? `${auditCount.toLocaleString()} Verified Events` : 'Verified Cryptographic Trail',
      icon: ShieldCheck,
      badge: 'Immutable',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      gradient: 'from-teal-500/20 via-teal-500/10 to-transparent',
      iconColor: 'text-teal-600 bg-teal-50 border-teal-200/80',
      borderColor: 'hover:border-teal-400',
      onClick: () => onNavigateTab('AUDIT'),
    },

    // 8. Roles & Members (Transferred Tab)
    ...(canManageMembers
      ? [
        {
          id: 'users',
          title: 'Roles & Members',
          subtitle: 'Access levels & approvals',
          preview: `${memberCount} Members · ${pendingUsersCount} Pending Approval`,
          icon: UserCog,
          badge: pendingUsersCount > 0 ? `${pendingUsersCount} pending` : null,
          badgeColor: 'bg-red-500 text-white border-red-600',
          gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
          iconColor: 'text-purple-600 bg-purple-50 border-purple-200/80',
          borderColor: 'hover:border-purple-400',
          onClick: () => onNavigateTab('USERS'),
        },
      ]
      : []),

    // 9. Settings & Security (Transferred Tab)
    {
      id: 'settings',
      title: 'Settings & Security',
      subtitle: 'Biometrics, passwords & backup',
      preview: 'Security Preferences & Tenant Info',
      icon: Settings,
      badge: null,
      gradient: 'from-slate-500/20 via-slate-500/10 to-transparent',
      iconColor: 'text-slate-700 bg-slate-100 border-slate-200/80',
      borderColor: 'hover:border-slate-400',
      onClick: () => onNavigateTab('SETTINGS'),
    },
  ];

  return (
    <section className="space-y-3">
      {/* Header with Title and Modern Subtitle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-sm font-bold tracking-tight text-slate-800">
            Operations & Financial Hub
          </h2>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-400">
          Mobile Banking Grid · {tiles.length} Modules
        </span>
      </div>

      {/* Modern Advanced Mobile Banking Grid (2 columns on mobile, 3 on tablet/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              className={`group relative text-left p-4 rounded-2xl bg-white border border-[#E8DFCE] ${tile.borderColor} shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_-6px_rgba(217,119,6,0.12)] active:scale-[0.99] transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer min-h-[110px]`}
            >
              {/* Subtle ambient background glow on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${tile.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              />

              {/* Top row: Icon with ambient badge, Title, and Chevron */}
              <div className="relative z-10 flex items-start justify-between gap-3 w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 duration-200 ${tile.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 transition-colors truncate">
                      {tile.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {tile.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {tile.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${tile.badgeColor || 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                    >
                      {tile.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                </div>
              </div>

              {/* Bottom row: Live Preview metric line */}
              <div className="relative z-10 mt-3 pt-2.5 border-t border-[#F2ECE1] flex items-center justify-between w-full">
                <span className="text-[11px] font-mono font-semibold text-slate-700 truncate">
                  {tile.preview}
                </span>
                <span className="text-[10px] font-bold text-amber-700 group-hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-0.5">
                  Open
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

