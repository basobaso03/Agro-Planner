import React, { useState } from 'react';
import { Compass, Sparkles, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { OrgMember } from '../../types/agro';
import { PERMISSIONS } from '../../utils/permissions';

interface RunwayPromoCardProps {
  currentMember: OrgMember;
  onExplore: () => void;
  onEnable?: () => void;
  className?: string;
}

export const RunwayPromoCard: React.FC<RunwayPromoCardProps> = ({
  currentMember,
  onExplore,
  onEnable,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const org = (dataService.getState().organizations || []).find((o) => o.id === currentMember.orgId);
    if (!org) return false;
    if (org.features?.runwayModule) return true;
    if (org.runwayPromoSnoozedUntil) {
      const snoozedUntil = new Date(org.runwayPromoSnoozedUntil).getTime();
      if (snoozedUntil > Date.now()) return true;
    }
    return false;
  });

  if (dismissed) return null;

  const canEnable = PERMISSIONS.canEnableRunwayModule(currentMember.role);

  const handleDismiss = () => {
    if (currentMember.orgId) {
      dataService.snoozeRunwayPromo({
        orgId: currentMember.orgId,
        days: 7,
        actor: currentMember,
      });
    }
    setDismissed(true);
  };

  const handleEnableClick = () => {
    if (onEnable) {
      onEnable();
    } else if (currentMember.orgId) {
      dataService.setRunwayModuleEnabled({
        orgId: currentMember.orgId,
        enabled: true,
        actor: currentMember,
      });
      onExplore();
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-5 text-white shadow-xl border border-indigo-700/50 ${className}`}
    >
      {/* Decorative backdrop accents */}
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3.5 top-3.5 p-1 rounded-full text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Dismiss banner for 7 days"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start space-x-3.5 pr-6">
        <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0">
          <Compass className="w-6 h-6 text-indigo-200 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> New Architecture
            </span>
          </div>

          <h3 className="text-lg font-bold tracking-tight text-white">
            Runway Capital Planning & Spend Gate
          </h3>

          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
            Protect your venture from mid-cycle cash exhaustion. Map line-item budgets, aggregate member pledges, and enforce real-time spend discipline before purchasing inventory or equipment.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            {canEnable ? (
              <button
                onClick={handleEnableClick}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-xs sm:text-sm shadow-md hover:from-emerald-400 hover:to-teal-500 transition-all cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enable Module</span>
              </button>
            ) : null}

            <button
              onClick={onExplore}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm border border-white/15 transition-all cursor-pointer"
            >
              <span>Explore Preview & Templates</span>
              <ArrowRight className="w-4 h-4 text-indigo-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
