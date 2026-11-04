import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { RecordGeneralSaleSheet } from '../../sheets/general/RecordGeneralSaleSheet.tsx';
import { StockInSheet } from '../../sheets/general/StockInSheet.tsx';
import { StockOutSheet } from '../../sheets/general/StockOutSheet.tsx';
import { LogExpenseSheet } from '../../sheets/expenses/LogExpenseSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface OperationsHubScreenProps {
  activeMember: OrgMember;
}

export const OperationsHubScreen: React.FC<OperationsHubScreenProps> = ({
  activeMember,
}) => {
  const { navigate } = useNavigation();

  const [showSaleSheet, setShowSaleSheet] = useState(false);
  const [showStockInSheet, setShowStockInSheet] = useState(false);
  const [showStockOutSheet, setShowStockOutSheet] = useState(false);
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);

  const finSummary = dataService.computeFinancialSummary();
  const inventory = dataService.computeFeedInventorySummaries();
  const assets = dataService.computeFixedAssetGroupSummaries();

  const totalStockUnits = inventory.reduce((acc: number, i: any) => acc + (i.remainingBags || i.currentBagsBalance || 0), 0);
  const totalAssetValue = assets.reduce((acc: number, a: any) => acc + (a.totalNetBookValueUsd || a.currentValue || 0), 0);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Metric Header Card */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="text-xs text-slate-400 font-medium">Enterprise Operations Hub</div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="text-xs text-slate-400">Available Liquid Cash</div>
            <div className="text-xl font-bold tracking-tight text-emerald-400 mt-0.5">
              {formatMoney(finSummary.leftMoney)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Fixed Assets NAV</div>
            <div className="text-xl font-bold tracking-tight mt-0.5">
              {formatMoney(totalAssetValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setShowSaleSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all flex flex-col gap-1.5"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-sm">
            💰
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Record Sale</div>
          <div className="text-[11px] text-slate-400">Cash / terms</div>
        </button>

        <button
          type="button"
          onClick={() => setShowStockInSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all flex flex-col gap-1.5"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-sm">
            📦
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Stock In</div>
          <div className="text-[11px] text-slate-400">Receive goods</div>
        </button>

        <button
          type="button"
          onClick={() => setShowStockOutSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all flex flex-col gap-1.5"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold text-sm">
            📤
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Stock Out</div>
          <div className="text-[11px] text-slate-400">Issue goods</div>
        </button>

        <button
          type="button"
          onClick={() => setShowExpenseSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all flex flex-col gap-1.5"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-sm">
            🧾
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Log Expense</div>
          <div className="text-[11px] text-slate-400">With multi-sig</div>
        </button>
      </div>

      {/* Operational Modules List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
        <ListRow
          icon="📦"
          title="Stock Inventory"
          subtitle={`${inventory.length} active SKUs · ${totalStockUnits} units in stock`}
          onClick={() => navigate('operations-inventory')}
        />
        <ListRow
          icon="📋"
          title="Stock Movement Ledger"
          subtitle="Audit log of all receipts, issues, and adjustments"
          onClick={() => navigate('operations-stock-ledger')}
        />
        <ListRow
          icon="🚜"
          title="Fixed Assets & Equipment"
          subtitle={`${assets.length} equipment items registered`}
          onClick={() => navigate('assets')}
        />
        <ListRow
          icon="🤝"
          title="Trade Credit & Debt"
          subtitle="Supplier credit, debt liabilities & receivables"
          onClick={() => navigate('loans-debts')}
        />
      </div>

      {/* Sheets */}
      <RecordGeneralSaleSheet
        isOpen={showSaleSheet}
        onClose={() => setShowSaleSheet(false)}
        activeMember={activeMember}
      />

      <StockInSheet
        isOpen={showStockInSheet}
        onClose={() => setShowStockInSheet(false)}
        activeMember={activeMember}
      />

      <StockOutSheet
        isOpen={showStockOutSheet}
        onClose={() => setShowStockOutSheet(false)}
        activeMember={activeMember}
      />

      <LogExpenseSheet
        isOpen={showExpenseSheet}
        onClose={() => setShowExpenseSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

