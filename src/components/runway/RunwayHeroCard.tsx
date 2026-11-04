import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  PlusCircle,
  Receipt,
  Layers,
} from 'lucide-react';
import type { RunwayPlan, RunwayFundingLayers } from '../../types/runway';
import type { OrgMember } from '../../types/agro';
import { RunwayFundingBar } from './RunwayFundingBar';
import { PERMISSIONS } from '../../utils/permissions';

interface RunwayHeroCardProps {
  plan: RunwayPlan;
  layers: RunwayFundingLayers;
  runwayMonths: number;
  currentMember: OrgMember;
  onNavigateTab: (subTab?: 'PLAN' | 'PLEDGES' | 'PAYIN' | 'SPEND' | 'REPORT') => void;
  onOpenPledgeModal?: () => void;
  onOpenPayInModal?: () => void;
  className?: string;
}

export const RunwayHeroCard: React.FC<RunwayHeroCardProps> = ({
  plan,
  layers,
  runwayMonths,
  currentMember,
  onNavigateTab,
  onOpenPledgeModal,
  onOpenPayInModal,
  className = '',
}) => {
  const isPledging = plan.status === 'PLEDGING';
  const isActive = plan.status === 'ACTIVE';
  const isLowRunway = isActive && runwayMonths < 1.0;
  const isCriticalRunway = isActive && runwayMonths < 0.5;

  const canPledge = PERMISSIONS.canPledge(currentMember.role);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-5 transition-all hover:shadow-md ${className}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {plan.status}
            </span>

            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {plan.enforcement} Spend Gate
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            {plan.name}
          </h3>
        </div>

        {/* Runway Remaining Alert / Metric Badge */}
        {isActive && (
          <div
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${
              isCriticalRunway
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                : isLowRunway
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
            }`}
          >
            {isLowRunway ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>
              {runwayMonths >= 99
                ? 'Healthy runway'
                : `${(runwayMonths * 4.3).toFixed(1)} wks left`}
            </span>
          </div>
        )}
      </div>

      {/* Interactive multi-layer progress bar */}
      <div className="mb-4">
        <RunwayFundingBar layers={layers} showLabels={true} />
      </div>

      {/* Action footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center space-x-2">
          {isPledging && canPledge && (
            <button
              onClick={() => (onOpenPledgeModal ? onOpenPledgeModal() : onNavigateTab('PLEDGES'))}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Make Pledge</span>
            </button>
          )}

          {isPledging && (
            <button
              onClick={() => (onOpenPayInModal ? onOpenPayInModal() : onNavigateTab('PAYIN'))}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Submit Pay-In</span>
            </button>
          )}

          {isActive && (
            <button
              onClick={() => onNavigateTab('SPEND')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View Budget Lines</span>
            </button>
          )}
        </div>

        <button
          onClick={() => onNavigateTab(isActive ? 'REPORT' : 'PLAN')}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors ml-auto cursor-pointer"
        >
          <span>Open Runway Hub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

