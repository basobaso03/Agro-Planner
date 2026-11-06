import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateSiteComparisonPdf } from '../../services/pdf/generators/agro/siteComparisonPdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface SiteCompareScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
  onOpenSiteManager?: () => void;
}

export const SiteCompareScreen: React.FC<SiteCompareScreenProps> = ({
  activeMember,
  showNumbers = true,
  onOpenSiteManager,
}) => {
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );
  const statuses = dataService.computeLivestockStatuses();
  const assets = dataService.computeFixedAssetGroupSummaries();
  const feedSummaries = dataService.computeFeedInventorySummaries();

  const [selectedSiteId, setSelectedSiteId] = useState<string>(locations[0]?.id || '');

  // Calculate metrics per location
  const siteMetrics = locations.map((loc) => {
    const locBatches = statuses.filter((s: any) => s.entry.locationId === loc.id);
    const locAssets = assets.filter((a: any) => a.locationId === loc.id);
    const locFeed = feedSummaries.filter((f: any) => f.locationId === loc.id);

    const liveHeadcount = locBatches.reduce((acc: number, b: any) => acc + b.currentLiveHeadcount, 0);
    const initialHeadcount = locBatches.reduce((acc: number, b: any) => acc + b.entry.initialHeadcount, 0);
    const mortalities = locBatches.reduce((acc: number, b: any) => acc + b.totalMortalities, 0);
    const mortalityRate = initialHeadcount > 0 ? (mortalities / initialHeadcount) * 100 : 0;
    const livestockValue = locBatches.reduce((acc: number, b: any) => acc + b.estimatedCurrentValueUsd, 0);
    const fixedAssetValue = locAssets.reduce((acc: number, a: any) => acc + (a.totalNetBookValueUsd || a.currentValue || 0), 0);
    const feedBags = locFeed.reduce((acc: number, f: any) => acc + (f.currentBagsBalance || 0), 0);

    return {
      location: loc,
      batchCount: locBatches.length,
      liveHeadcount,
      mortalityRate,
      livestockValue,
      fixedAssetValue,
      totalSiteNAV: livestockValue + fixedAssetValue,
      feedBags,
    };
  });

  const activeSite = siteMetrics.find((m) => m.location.id === selectedSiteId) || siteMetrics[0];

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Info */}
      <div className="bg-white border border-[#E8DFCE] p-4 sm:p-5 rounded-2xl shadow-xs flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div>
          <h1 className="text-base font-black text-slate-950">Multi-Site Operations Benchmark</h1>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Comparative analytics across all registered operational branches and farming sites.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PdfExportButton
            label="Share Site Report"
            title="Multi-Site Operations Benchmark"
            filename={buildExportFilename({
              orgName: dataService.getActiveOrg()?.name,
              documentType: 'Site-Comparison-Report',
            })}
            generateDoc={() =>
              generateSiteComparisonPdf({
                organization: dataService.getActiveOrg(),
                siteSummaries: siteMetrics.map((m) => ({
                  location: m.location,
                  activeAnimalHeadcount: m.liveHeadcount,
                  activeBatchCount: m.batchCount,
                  siteApprovedExpenses: 0,
                  sitePendingExpenses: 0,
                  siteFixedAssetValue: m.fixedAssetValue,
                  siteMortalityRatePercent: m.mortalityRate,
                  siteSalesRevenue: m.livestockValue,
                })),
                operatorName: activeMember.fullName,
              })
            }
          />
          {onOpenSiteManager && (
            <button
              type="button"
              onClick={onOpenSiteManager}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs shrink-0 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <span>＋ Manage Sites</span>
            </button>
          )}
        </div>
      </div>

      {/* Site Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {siteMetrics.map((sm) => (
          <button
            key={sm.location.id}
            type="button"
            onClick={() => setSelectedSiteId(sm.location.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${sm.location.id === activeSite?.location.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-[#E8DFCE] text-slate-800 hover:bg-[#FAF8F5]'
              }`}
          >
            {sm.location.name}
          </button>
        ))}
        {onOpenSiteManager && (
          <button
            type="button"
            onClick={onOpenSiteManager}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 transition-all shrink-0 cursor-pointer inline-flex items-center gap-1 shadow-xs"
          >
            <span>＋ Add Site</span>
          </button>
        )}
      </div>

      {siteMetrics.length === 0 && (
        <div className="p-8 bg-white border border-[#E8DFCE] rounded-2xl text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No operational sites registered yet.</p>
          {onOpenSiteManager && (
            <button
              type="button"
              onClick={onOpenSiteManager}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer"
            >
              ＋ Add Your First Site
            </button>
          )}
        </div>
      )}

      {/* Selected Site Detail Card */}
      {activeSite && (
        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {activeSite.location.region}
              </div>
              <h2 className="text-lg font-black text-slate-950 mt-0.5">
                {activeSite.location.name}
              </h2>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                Operator: {activeSite.location.primaryOperatorName} · GPS: {activeSite.location.gpsCoordinates}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Total Site NAV</div>
              <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
                {formatMoney(activeSite.totalSiteNAV)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#F0EBE1] text-center text-xs">
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Active Batches</div>
              <div className="text-base font-black font-mono text-slate-950 mt-0.5">
                {activeSite.batchCount}
              </div>
            </div>
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Live Animals</div>
              <div className="text-base font-black font-mono text-slate-950 mt-0.5">
                {activeSite.liveHeadcount} head
              </div>
            </div>
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Mortality Rate</div>
              <div
                className={`text-base font-black font-mono mt-0.5 ${activeSite.mortalityRate > 5 ? 'text-rose-600' : 'text-slate-950'
                  }`}
              >
                {activeSite.mortalityRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Feed Stock</div>
              <div className="text-base font-black font-mono text-slate-950 mt-0.5">
                {activeSite.feedBags} bags
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Matrix Table */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="font-black text-slate-950 text-sm">Site Comparison Matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#F0EBE1] text-slate-600 uppercase text-[11px] font-bold">
                <th className="pb-2">Site</th>
                <th className="pb-2 text-center">Headcount</th>
                <th className="pb-2 text-center">Mortality</th>
                <th className="pb-2 text-right">Fixed Assets</th>
                <th className="pb-2 text-right">Total NAV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1]">
              {siteMetrics.map((sm) => (
                <tr key={sm.location.id} className="hover:bg-[#FAF8F5]">
                  <td className="py-2.5 font-bold text-slate-950">
                    {sm.location.name}
                  </td>
                  <td className="py-2.5 text-center font-mono text-slate-800">
                    {sm.liveHeadcount}
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`font-mono font-bold ${sm.mortalityRate > 5 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                    >
                      {sm.mortalityRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-800">
                    {formatMoney(sm.fixedAssetValue)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-black text-slate-950">
                    {formatMoney(sm.totalSiteNAV)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

