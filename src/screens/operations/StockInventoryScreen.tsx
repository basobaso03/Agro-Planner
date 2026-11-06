import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { StockInSheet } from '../../sheets/general/StockInSheet.tsx';
import { StockOutSheet } from '../../sheets/general/StockOutSheet.tsx';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateStockInventoryPdf } from '../../services/pdf/generators/general/stockInventoryPdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface StockInventoryScreenProps {
  activeMember: OrgMember;
}

export const StockInventoryScreen: React.FC<StockInventoryScreenProps> = ({
  activeMember,
}) => {
  const [showInSheet, setShowInSheet] = useState(false);
  const [showOutSheet, setShowOutSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const summaries = dataService.computeFeedInventorySummaries();
  const filtered = summaries.filter((s: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.feedType.toLowerCase().includes(q) || s.locationName.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Search Input & Export Action */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products or inventory..."
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
        />
        <PdfExportButton
          label="Share Stock PDF"
          title="Stock Inventory SKU Catalog"
          filename={buildExportFilename({
            orgName: dataService.getActiveOrg()?.name,
            documentType: 'Stock-Inventory-Catalog',
          })}
          generateDoc={() =>
            generateStockInventoryPdf({
              organization: dataService.getActiveOrg(),
              items: summaries,
              operatorName: activeMember.fullName,
            })
          }
        />
      </div>

      {/* Inventory List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Products in Inventory"
          message="Record inward stock shipments to start tracking your inventory."
          actionLabel="Stock In Items"
          onAction={() => setShowInSheet(true)}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any, idx: number) => {
            const balance = item.remainingBags ?? item.currentBagsBalance ?? 0;
            const kgBalance = item.remainingKg ?? item.currentKgBalance ?? 0;
            const isLow = balance <= 5;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.feedType}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {item.locationName} · {item.events.length} logs
                  </div>
                  {isLow && (
                    <span className="inline-block mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      ⚠️ Low stock alert
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {balance} units
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {kgBalance.toLocaleString()} kg/units total
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-40">
        <button
          type="button"
          onClick={() => setShowOutSheet(true)}
          className="w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center font-bold text-lg active:scale-95"
          title="Stock Out"
        >
          📤
        </button>
        <button
          type="button"
          onClick={() => setShowInSheet(true)}
          className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center font-bold text-lg active:scale-95"
          title="Stock In"
        >
          📥
        </button>
      </div>

      <StockInSheet
        isOpen={showInSheet}
        onClose={() => setShowInSheet(false)}
        activeMember={activeMember}
      />

      <StockOutSheet
        isOpen={showOutSheet}
        onClose={() => setShowOutSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

