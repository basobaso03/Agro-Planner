import React from 'react';
import {
  Coins,
  CreditCard,
  Scale,
  Building2,
  Compass,
  Layers,
  Tag,
  Package,
  TrendingUp,
  Users,
  ShieldCheck,
  Megaphone,
  MapPin,
} from 'lucide-react';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { formatMoney } from '../../utils/currency.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { PERMISSIONS } from '../../utils/permissions.ts';
import { dataService } from '../../services/dataService.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface HubListProps {
  isAgroEnabled: boolean;
  activeMember: OrgMember;
  showNumbers?: boolean;
  poolContributed: number;
  creditOutstanding: number;
  creditOverdueCount: number;
  debtOutstanding: number;
  loansGivenOutstanding: number;
  fixedAssetsValue: number;
  runwayMonthsRemaining?: number;
  livestockFlockCount?: number;
  livestockValuation?: number;
  generalStockValue?: number;
  lowStockItemsCount?: number;
  unreadBroadcastsCount?: number;
  onOpenSiteManager?: () => void;
}

export const HubList: React.FC<HubListProps> = ({
  isAgroEnabled,
  activeMember,
  showNumbers = true,
  poolContributed,
  creditOutstanding,
  creditOverdueCount,
  debtOutstanding,
  loansGivenOutstanding,
  fixedAssetsValue,
  runwayMonthsRemaining,
  livestockFlockCount = 0,
  livestockValuation = 0,
  generalStockValue = 0,
  lowStockItemsCount = 0,
  unreadBroadcastsCount = 0,
  onOpenSiteManager,
}) => {
  const { navigate } = useNavigation();

  return (
    <div className="space-y-4">
      {/* ── SECTION 1: MONEY & WEALTH ── */}
      <div className="space-y-1">
        <div className="px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Money &amp; Wealth
        </div>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] divide-y divide-[#F0EBE1] overflow-hidden shadow-xs">
          {PERMISSIONS.canViewCapitalPoolTab(activeMember.role) && (
            <ListRow
              icon={<Coins className="w-5 h-5" />}
              iconBg="bg-emerald-500 text-white"
              title="Capital Equity Pool"
              subtitle="Member equity shares & contributions"
              previewAmount={formatMoney(poolContributed, showNumbers)}
              onClick={() => navigate('capitalPool')}
            />
          )}

          {isAgroEnabled && (
            <ListRow
              icon={<CreditCard className="w-5 h-5" />}
              iconBg="bg-amber-500 text-white"
              title="Sales on Credit"
              subtitle="Customer receivables & agreed due dates"
              previewAmount={formatMoney(creditOutstanding, showNumbers)}
              badge={creditOverdueCount > 0 ? `${creditOverdueCount} Overdue` : undefined}
              badgeVariant="rose"
              onClick={() => navigate('creditSales')}
            />
          )}

          <ListRow
            icon={<Scale className="w-5 h-5" />}
            iconBg="bg-rose-500 text-white"
            title="Loans &amp; Liabilities"
            subtitle={`Debt ${formatMoney(debtOutstanding, showNumbers)} • Lent ${formatMoney(loansGivenOutstanding, showNumbers)}`}
            previewAmount={formatMoney(debtOutstanding, showNumbers)}
            onClick={() => navigate('loansDebts')}
          />

          <ListRow
            icon={<Building2 className="w-5 h-5" />}
            iconBg="bg-blue-600 text-white"
            title="Fixed Assets"
            subtitle="Equipment, infrastructure & transport"
            previewAmount={formatMoney(fixedAssetsValue, showNumbers)}
            onClick={() => navigate('fixedAssets')}
          />

          {PERMISSIONS.canViewRunwayPlan(activeMember.role) && runwayMonthsRemaining !== undefined && (
            <ListRow
              icon={<Compass className="w-5 h-5" />}
              iconBg="bg-violet-600 text-white"
              title="Runway Capital Plan"
              subtitle={`${runwayMonthsRemaining.toFixed(1)} months estimated break-even runway`}
              previewAmount={`${runwayMonthsRemaining.toFixed(1)} mo`}
              onClick={() => navigate('runwayPlan')}
            />
          )}
        </div>
      </div>

      {/* ── SECTION 2: LIVESTOCK OPERATIONS (AGRO ONLY) ── */}
      {isAgroEnabled && (
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
            Agro Livestock Operations
          </div>

          <div className="bg-white rounded-3xl border border-[#E8DFCE] divide-y divide-[#F0EBE1] overflow-hidden shadow-xs">
            <ListRow
              icon={<Layers className="w-5 h-5" />}
              iconBg="bg-emerald-600 text-white"
              title="Active Livestock Batches"
              subtitle={`${livestockFlockCount} batches on ground across sites`}
              previewAmount={`${livestockFlockCount} Batches`}
              onClick={() => navigate('operations')}
            />

            <ListRow
              icon={<Tag className="w-5 h-5" />}
              iconBg="bg-amber-600 text-white"
              title="Biological Livestock Valuation"
              subtitle="Projected live market selling value"
              previewAmount={formatMoney(livestockValuation, showNumbers)}
              onClick={() => navigate('operations')}
            />
          </div>
        </div>
      )}

      {/* ── SECTION 3: TEAM & GOVERNANCE ── */}
      <div className="space-y-1">
        <div className="px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Team &amp; Governance
        </div>

        <div className="bg-white rounded-3xl border border-[#E8DFCE] divide-y divide-[#F0EBE1] overflow-hidden shadow-xs">
          {isAgroEnabled && (
            <ListRow
              icon={<MapPin className="w-5 h-5" />}
              iconBg="bg-amber-600 text-white"
              title="Operational Sites &amp; Locations"
              subtitle="Manage farm sites, kraals, station GPS &amp; operators"
              onClick={() => (onOpenSiteManager ? onOpenSiteManager() : navigate('siteCompare'))}
            />
          )}

          <ListRow
            icon={<Megaphone className="w-5 h-5" />}
            iconBg="bg-blue-500 text-white"
            title="Broadcast Center"
            subtitle="Operational announcements & notices"
            badge={unreadBroadcastsCount > 0 ? `${unreadBroadcastsCount} New` : undefined}
            badgeVariant="amber"
            onClick={() => navigate('broadcastCenter')}
          />

          <ListRow
            icon={<ShieldCheck className="w-5 h-5" />}
            iconBg="bg-slate-800 text-white"
            title="Audit Security Ledger"
            subtitle="Immutable verified security audit trail"
            onClick={() => navigate('auditLedger')}
          />

          {PERMISSIONS.canManageMembers(activeMember.role) && (
            <ListRow
              icon={<Users className="w-5 h-5" />}
              iconBg="bg-indigo-600 text-white"
              title="Members &amp; Permissions"
              subtitle="Invite codes, roles & access control"
              onClick={() => navigate('members')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

