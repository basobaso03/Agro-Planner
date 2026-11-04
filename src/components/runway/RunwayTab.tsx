import React, { useState, useEffect } from 'react';
import {
  Compass,
  Plus,
  Lock,
  Play,
  CheckCircle,
  Archive,
  Layers,
  Users,
  Receipt,
  TrendingDown,
  Calendar,
  FileText,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import type { OrgMember, FarmLocation } from '../../types/agro';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayAllocation,
  PaymentClaimMethod,
} from '../../types/runway';
import { useRunway, useRunwayProgress } from '../../hooks/useRunway';
import { dataService } from '../../services/dataService';
import { PERMISSIONS } from '../../utils/permissions';
import { useToast } from '../ui/Toast.tsx';
import { RunwayHeroCard } from './RunwayHeroCard';
import { RunwayBudgetBuilder } from './RunwayBudgetBuilder';
import { PledgePanel } from './PledgePanel';
import { PayInPanel } from './PayInPanel';
import { SpendPanel } from './SpendPanel';
import { TimelineChart } from './TimelineChart';
import { RunwayReport } from './RunwayReport';
import { RunwayWizard } from './RunwayWizard';
import { AmendmentSheet } from './AmendmentSheet';
import { SpendGateDialog } from './SpendGateDialog';
import { MoneyFlowLayer } from './MoneyFlowLayer';

interface RunwayTabProps {
  currentMember: OrgMember;
  locations?: FarmLocation[];
  initialSubTab?: 'PLAN' | 'PLEDGES' | 'PAYIN' | 'SPEND' | 'TIMELINE' | 'REPORT';
  onOpenExpenseModal?: () => void;
}

export const RunwayTab: React.FC<RunwayTabProps> = ({
  currentMember,
  locations = [],
  initialSubTab = 'PLAN',
  onOpenExpenseModal,
}) => {
  const orgId = currentMember.orgId || 'org-master';
  const { showToast } = useToast();
  // Selected plan state (defaults to activePlan, or first plan)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planSuccessBanner, setPlanSuccessBanner] = useState<string | null>(null);

  const {
    activePlan,
    plans,
    lines,
    pledges,
    claims,
    fundingLayers,
    runwayMonths,
    isFullyFunded,
    isFullyPledged,
    currentOrg,
  } = useRunway(selectedPlanId || undefined, orgId);

  const [activeSubTab, setActiveSubTab] = useState<
    'PLAN' | 'PLEDGES' | 'PAYIN' | 'SPEND' | 'TIMELINE' | 'REPORT'
  >(initialSubTab);

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isAmendmentOpen, setIsAmendmentOpen] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Set selected plan on initial load or plan change
  useEffect(() => {
    if (activePlan) {
      setSelectedPlanId(activePlan.id);
    } else if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [activePlan, plans, selectedPlanId]);

  // Delta celebrations
  const delta = useRunwayProgress(fundingLayers);
  useEffect(() => {
    if (delta && delta.type !== 'NONE') {
      setShowCelebration(true);
    }
  }, [delta]);

  const currentPlan = (plans || []).find((p: RunwayPlan) => p.id === selectedPlanId) || activePlan || plans[0];
  const planLines = currentPlan ? lines.filter((l) => l.planId === currentPlan.id) : [];
  const planPledges = currentPlan ? pledges.filter((p) => p.planId === currentPlan.id) : [];

  const canEdit = PERMISSIONS.canEditRunwayDraft(currentMember.role);
  const canLock = PERMISSIONS.canLockRunwayPlan(currentMember.role);
  const canActivate = PERMISSIONS.canActivateRunwayPlan(currentMember.role);
  const canClose = PERMISSIONS.canClosePlan(currentMember.role);

  // Handlers
  const handleLockPlan = () => {
    if (!currentPlan) return;
    try {
      dataService.lockRunwayPlan({
        planId: currentPlan.id,
        adoptOpeningCash: true,
        actor: currentMember,
      });
      setActiveSubTab('PLEDGES');
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'Error locking plan.' });
    }
  };

  const handleActivatePlan = () => {
    if (!currentPlan) return;
    try {
      dataService.activateRunwayPlan({
        planId: currentPlan.id,
        actor: currentMember,
      });
      setShowCelebration(true);
      setActiveSubTab('SPEND');
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'Error activating plan.' });
    }
  };

  const handleClosePlan = () => {
    if (!currentPlan) return;
    try {
      dataService.closeRunwayPlan({
        planId: currentPlan.id,
        actor: currentMember,
      });
      showToast({ type: 'success', message: `Plan "${currentPlan.name}" marked as COMPLETED.` });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'Error closing plan.' });
    }
  };

  // Empty state if no plans exist in the organization
  if (plans.length === 0) {
    return (
      <div className="space-y-5 w-full max-w-4xl mx-auto px-3.5 sm:px-5 py-4 box-border overflow-x-hidden">
        <div className="text-center p-6 sm:p-10 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Compass className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              No Runway Capital Plans Configured
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Launch a structured runway plan to align member pledges, map out cycle costs, and protect your cash flow from mid-production overdrafts.
            </p>
          </div>

          {canEdit && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center justify-center space-x-2 w-full sm:w-auto px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Launch 5-Step Runway Wizard</span>
            </button>
          )}
        </div>

        <RunwayWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          currentMember={currentMember}
          activeOrg={currentOrg}
          locations={locations}
          onPlanCreated={(id) => {
            setSelectedPlanId(id);
            setActiveSubTab('PLAN');
            setIsWizardOpen(false);
            setPlanSuccessBanner('Runway Capital Plan created successfully! Review your budget lines below.');
            setTimeout(() => setPlanSuccessBanner(null), 6000);
          }}
        />
      </div>
    );
  }

  const subTabs = [
    { id: 'PLAN', label: 'Budget Plan', icon: Layers },
    { id: 'PLEDGES', label: 'Pledges', icon: Users, badge: planPledges.length },
    { id: 'PAYIN', label: 'Pay-in', icon: Receipt },
    { id: 'SPEND', label: 'Execution', icon: TrendingDown },
    { id: 'TIMELINE', label: 'Timeline', icon: Calendar },
    { id: 'REPORT', label: 'Variance', icon: FileText },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto px-3.5 sm:px-5 py-3 pb-10 box-border overflow-x-hidden">
      {/* Particle Celebration Burst */}
      <MoneyFlowLayer
        active={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {planSuccessBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <span>{planSuccessBanner}</span>
          <button
            type="button"
            onClick={() => setPlanSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Plan Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 w-full min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full max-w-[210px] sm:max-w-xs truncate appearance-none pl-3 pr-7 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-xs sm:text-sm font-bold text-gray-900 dark:text-white shadow-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {(plans || []).map((p: RunwayPlan) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {currentPlan && (
            <span
              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${currentPlan.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : currentPlan.status === 'PLEDGING'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
            >
              {currentPlan.status}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-500" />
              <span>New Plan</span>
            </button>
          )}

          {currentPlan?.status === 'DRAFT' && canLock && (
            <button
              onClick={handleLockPlan}
              disabled={planLines.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Plan</span>
            </button>
          )}

          {currentPlan?.status === 'PLEDGING' && canActivate && (
            <button
              onClick={handleActivatePlan}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Activate Plan</span>
            </button>
          )}

          {currentPlan?.status === 'ACTIVE' && canClose && (
            <button
              onClick={handleClosePlan}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Close Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Overview Card */}
      {currentPlan && (
        <RunwayHeroCard
          plan={currentPlan}
          layers={fundingLayers}
          runwayMonths={runwayMonths}
          currentMember={currentMember}
          onNavigateTab={(st) => setActiveSubTab(st || 'PLAN')}
        />
      )}

      {/* Segmented Subtab Navigation Bar */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar w-full max-w-full p-1 rounded-2xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-800">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const isSelected = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${isSelected
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Subtab Content Panes */}
      {currentPlan && (
        <div className="transition-all">
          {activeSubTab === 'PLAN' && (
            <RunwayBudgetBuilder
              plan={currentPlan}
              lines={planLines}
              currentMember={currentMember}
              pastExpenses={dataService.getState().expenses}
              readOnly={currentPlan.status !== 'DRAFT'}
              onUpsertLine={(line) =>
                dataService.upsertRunwayLine({ planId: currentPlan.id, line, actor: currentMember })
              }
              onRemoveLine={(id) =>
                dataService.removeRunwayLine({ planId: currentPlan.id, lineId: id, actor: currentMember })
              }
              onReorderLines={(ids) =>
                dataService.reorderRunwayLines({ planId: currentPlan.id, lineIds: ids, actor: currentMember })
              }
              onUpdateReserve={(mode, val) =>
                dataService.updateRunwayReserve({
                  planId: currentPlan.id,
                  contingencyMode: mode,
                  contingencyPercent: mode === 'PERCENT' ? val : undefined,
                  contingencyFixedAmount: mode === 'FIXED' ? val : undefined,
                  actor: currentMember,
                })
              }
              onLockPlan={handleLockPlan}
              onSaveAsTemplate={(name) =>
                dataService.saveRunwayTemplate({
                  name,
                  orgId: currentPlan.orgId,
                  orgType: currentPlan.orgType,
                  contingencyPercent: currentPlan.contingencyPercent ?? 10,
                  phases: currentPlan.phases.map(({ id, ...rest }) => rest),
                  lines: planLines.map(({ id, planId, orgId, createdAt, updatedAt, auditHash, approval, origin, ...rest }) => rest),
                  actor: currentMember,
                })
              }
            />
          )}

          {activeSubTab === 'PLEDGES' && (
            <PledgePanel
              plan={currentPlan}
              pledges={planPledges}
              contributions={dataService.getState().capitalContributions}
              members={dataService.getState().members}
              currentMember={currentMember}
              layers={fundingLayers}
              onPledge={(p) =>
                dataService.pledgeToRunwayPlan({
                  planId: currentPlan.id,
                  memberId: p.memberId,
                  amount: p.amount,
                  note: p.note,
                  actor: currentMember,
                })
              }
            />
          )}

          {activeSubTab === 'PAYIN' && (
            <PayInPanel
              plan={currentPlan}
              claims={claims}
              currentMember={currentMember}
              members={dataService.getState().members}
              onSubmitClaim={(c) =>
                dataService.submitRunwayPaymentClaim({
                  planId: c.planId,
                  amount: c.amount,
                  method: c.method,
                  reference: c.reference,
                  proofPhotoDataUrl: c.receiptPhotoDataUrl,
                  actor: currentMember,
                })
              }
              onResolveClaim={(r) =>
                dataService.resolveRunwayPaymentClaim({
                  claimId: r.claimId,
                  decision: r.decision,
                  note: r.note,
                  actor: currentMember,
                })
              }
            />
          )}

          {activeSubTab === 'SPEND' && (
            <SpendPanel
              plan={currentPlan}
              lines={planLines}
              expenses={dataService.getState().expenses}
              layers={fundingLayers}
              currentMember={currentMember}
              onRecordExpense={() => onOpenExpenseModal?.()}
              onProposeAmendment={() => setIsAmendmentOpen(true)}
            />
          )}

          {activeSubTab === 'TIMELINE' && (
            <TimelineChart
              plan={currentPlan}
              lines={planLines}
              openingCash={currentPlan.openingCashAdopted || 0}
            />
          )}

          {activeSubTab === 'REPORT' && (
            <RunwayReport
              plan={currentPlan}
              lines={planLines}
              expenses={dataService.getState().expenses}
              livestockEvents={dataService.getState().livestockEvents}
              creditSales={dataService.getState().creditSales}
              layers={fundingLayers}
            />
          )}
        </div>
      )}

      {/* Creation Wizard Modal */}
      <RunwayWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        currentMember={currentMember}
        activeOrg={currentOrg}
        locations={locations}
        onPlanCreated={(id) => {
          setSelectedPlanId(id);
          setActiveSubTab('PLAN');
          setIsWizardOpen(false);
          setPlanSuccessBanner('Runway Capital Plan created successfully! Review your budget lines below.');
          setTimeout(() => setPlanSuccessBanner(null), 6000);
        }}
      />

      {/* Amendment Drawer */}
      {currentPlan && (
        <AmendmentSheet
          isOpen={isAmendmentOpen}
          onClose={() => setIsAmendmentOpen(false)}
          planId={currentPlan.id}
          lines={planLines}
          currentMember={currentMember}
          onPropose={(p) =>
            dataService.proposeRunwayAmendment({
              planId: p.planId,
              title: p.title,
              category: p.category,
              qty: p.qty,
              unitCost: p.unitCost,
              note: p.note,
              actor: currentMember,
            })
          }
          onResolve={(r) =>
            dataService.resolveRunwayAmendment({
              lineId: r.lineId,
              decision: r.decision,
              note: r.note,
              actor: currentMember,
            })
          }
        />
      )}
    </div>
  );
};
