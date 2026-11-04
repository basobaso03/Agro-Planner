import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface SiteCompareScreenProps {
  activeMember: OrgMember;
}

export const SiteCompareScreen: React.FC<SiteCompareScreenProps> = ({
  activeMember,
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
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
        <h1 className="text-base font-bold">Multi-Site Operations Benchmark</h1>
        <p className="text-xs text-slate-400 mt-1">
          Comparative analytics across all registered operational branches and farming sites.
        </p>
      </div>

      {/* Site Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {siteMetrics.map((sm) => (
          <button
            key={sm.location.id}
            type="button"
            onClick={() => setSelectedSiteId(sm.location.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              sm.location.id === activeSite?.location.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {sm.location.name}
          </button>
        ))}
      </div>

      {/* Selected Site Detail Card */}
      {activeSite && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {activeSite.location.region}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {activeSite.location.name}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Operator: {activeSite.location.primaryOperatorName} · GPS: {activeSite.location.gpsCoordinates}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Total Site NAV</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatMoney(activeSite.totalSiteNAV)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center text-xs">
            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl">
              <div className="text-slate-400">Active Batches</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {activeSite.batchCount}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl">
              <div className="text-slate-400">Live Animals</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {activeSite.liveHeadcount} head
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl">
              <div className="text-slate-400">Mortality Rate</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  activeSite.mortalityRate > 5 ? 'text-rose-500' : 'text-slate-900 dark:text-white'
                }`}
              >
                {activeSite.mortalityRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl">
              <div className="text-slate-400">Feed Stock</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {activeSite.feedBags} bags
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Matrix Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Site Comparison Matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400">
                <th className="pb-2 font-medium">Site</th>
                <th className="pb-2 font-medium text-center">Headcount</th>
                <th className="pb-2 font-medium text-center">Mortality</th>
                <th className="pb-2 font-medium text-right">Fixed Assets</th>
                <th className="pb-2 font-medium text-right">Total NAV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {siteMetrics.map((sm) => (
                <tr key={sm.location.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="py-2.5 font-semibold text-slate-900 dark:text-white">
                    {sm.location.name}
                  </td>
                  <td className="py-2.5 text-center text-slate-600 dark:text-slate-300">
                    {sm.liveHeadcount}
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`font-semibold ${
                        sm.mortalityRate > 5 ? 'text-rose-500' : 'text-emerald-600'
                      }`}
                    >
                      {sm.mortalityRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                    {formatMoney(sm.fixedAssetValue)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
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

