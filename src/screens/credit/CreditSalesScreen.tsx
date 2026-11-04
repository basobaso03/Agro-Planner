import React, { useState } from 'react';
import { CreditCard, Plus, ArrowLeft } from 'lucide-react';
import { SaleCard } from './SaleCard.tsx';
import { Chip } from '../../components/ui/Chip.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { formatMoney } from '../../utils/currency.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { RecordCreditSaleSheet } from '../../sheets/credit/RecordCreditSaleSheet.tsx';
import type { CreditSaleEvent, FarmLocation, LivestockComputedStatus, OrgMember } from '../../types/agro.ts';

export interface CreditSalesScreenProps {
  creditSales?: CreditSaleEvent[];
  locations?: FarmLocation[];
  livestockStatuses?: LivestockComputedStatus[];
  activeMember: OrgMember;
  isAgroEnabled?: boolean;
  showNumbers?: boolean;
  onOpenRecordSale?: () => void;
  onSelectSale?: (sale: CreditSaleEvent) => void;
}

export const CreditSalesScreen: React.FC<CreditSalesScreenProps> = ({
  creditSales = dataService.getState().creditSales || [],
  locations = dataService.getState().locations || [],
  livestockStatuses = dataService.computeLivestockStatuses(),
  activeMember,
  isAgroEnabled = true,
  showNumbers = true,
  onOpenRecordSale,
  onSelectSale,
}) => {
  const { pop, navigate } = useNavigation();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OUTSTANDING' | 'OVERDUE' | 'SETTLED'>('OUTSTANDING');
  const [showRecordSheet, setShowRecordSheet] = useState(false);

  const handleOpenRecord = onOpenRecordSale || (() => setShowRecordSheet(true));

  const now = Date.now();
  const outstandingSales = creditSales.filter((s) => s.status !== 'SETTLED');
  const overdueSales = outstandingSales.filter((s) => new Date(s.agreedSettlementDate).getTime() < now);
  const settledSales = creditSales.filter((s) => s.status === 'SETTLED');

  const totalOutstanding = outstandingSales.reduce((acc, s) => acc + s.creditBalanceRemaining, 0);
  const totalCollected = creditSales.reduce(
    (acc, s) => acc + s.depositPaidCash + (s.paymentLogs || []).reduce((pAcc, p) => pAcc + p.amount, 0),
    0
  );

  const filteredSales =
    activeFilter === 'ALL'
      ? creditSales
      : activeFilter === 'OUTSTANDING'
      ? outstandingSales
      : activeFilter === 'OVERDUE'
      ? overdueSales
      : settledSales;

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto pb-28">
      {/* 1. Compact Summary Strip */}
      <div className="grid grid-cols-2 gap-3 p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            Outstanding Receivables
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">
            {formatMoney(totalOutstanding, showNumbers)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Owed by customers</span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Total Cash Collected
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">
            {formatMoney(totalCollected, showNumbers)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Deposits &amp; payments</span>
        </div>
      </div>

      {/* 2. Filter Segment Chips (Neutral Muted when Count is 0 - Fixes B21) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Chip
          label="Outstanding"
          count={outstandingSales.length}
          isSelected={activeFilter === 'OUTSTANDING'}
          onClick={() => setActiveFilter('OUTSTANDING')}
          variant="amber"
        />
        <Chip
          label="Overdue"
          count={overdueSales.length}
          isSelected={activeFilter === 'OVERDUE'}
          onClick={() => setActiveFilter('OVERDUE')}
          variant="rose"
        />
        <Chip
          label="Settled"
          count={settledSales.length}
          isSelected={activeFilter === 'SETTLED'}
          onClick={() => setActiveFilter('SETTLED')}
          variant="emerald"
        />
        <Chip
          label="All Sales"
          count={creditSales.length}
          isSelected={activeFilter === 'ALL'}
          onClick={() => setActiveFilter('ALL')}
        />
      </div>

      {/* 3. Sales Cards Stream */}
      {filteredSales.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={
            activeFilter === 'OVERDUE'
              ? 'No Overdue Sales'
              : activeFilter === 'OUTSTANDING'
              ? 'No Outstanding Receivables'
              : 'No Credit Sales Recorded'
          }
          description="When you sell broilers, livestock, or produce on deferred credit, record them here to track payment due dates."
          actionLabel="＋ Record First Credit Sale"
          onAction={handleOpenRecord}
        />
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => (
            <SaleCard
              key={sale.id}
              sale={sale}
              showNumbers={showNumbers}
              onClick={() => (onSelectSale ? onSelectSale(sale) : navigate('saleDetail', { id: sale.id }))}
            />
          ))}
        </div>
      )}

      {/* 4. FAB Floating Action Button */}
      <Fab icon={Plus} label="Record Sale" onClick={handleOpenRecord} variant="amber" />

      {/* Sheet */}
      <RecordCreditSaleSheet
        isOpen={showRecordSheet}
        onClose={() => setShowRecordSheet(false)}
        activeMember={activeMember}
        locations={locations}
        livestockStatuses={livestockStatuses}
      />
    </div>
  );
};

