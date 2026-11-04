export type RunwayPlanStatus = 'DRAFT' | 'PLEDGING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type RunwayEnforcement = 'STRICT' | 'ADVISORY';
export type RunwayMode = 'SIMPLE' | 'ADVANCED';
export type RunwayTargetBasis = 'GROSS' | 'PEAK_NEED';
export type ContingencyMode = 'PERCENT' | 'FIXED';
export type RunwayLinePriority = 'ESSENTIAL' | 'IMPORTANT' | 'NICE_TO_HAVE';
export type RunwayLineKind = 'COST' | 'INCOME';
export type RunwayLineOrigin = 'PLAN' | 'AMENDMENT';
export type RunwayApproval = 'APPROVED' | 'PROPOSED' | 'REJECTED';
export type RunwayLineStatus = 'PLANNED' | 'PARTIAL' | 'PAID' | 'COMMITTED' | 'SKIPPED';

export interface RunwayPhase {
  id: string;
  name: string;
  order: number;
  releaseAfterPhaseId?: string;
  released?: boolean;
}

export type RunwayMilestoneKey =
  | 'PLEDGED_25'
  | 'PLEDGED_50'
  | 'PLEDGED_75'
  | 'PLEDGED_100'
  | 'COLLECTED_25'
  | 'COLLECTED_50'
  | 'COLLECTED_75'
  | 'COLLECTED_100'
  | 'BREAK_EVEN';

export interface RunwayPlannedFinancing {
  id: string;
  lenderName: string;
  amount: number;
  expectedDate?: string;
  received?: boolean;
}

export interface RunwayPlan {
  id: string; // e.g. RWY-XXXX
  orgId: string;
  name: string;
  title?: string; // alias for name
  orgType: 'AGRO_FARMING' | 'GENERAL_VENTURE';
  mode: RunwayMode;
  status: RunwayPlanStatus;
  enforcement: RunwayEnforcement;
  spendEnforcement?: RunwayEnforcement; // alias for enforcement
  locationId?: string;
  linkedLivestockId?: string;
  templateId?: string;
  startDate: string; // ISO
  fundingDeadline?: string;
  breakEvenTargetDate?: string;
  contingencyMode: ContingencyMode;
  contingencyPercent?: number; // e.g. 10
  contingencyFixedAmount?: number;
  targetBasis: RunwayTargetBasis;
  activationThresholdPct: number; // default 100
  openingCashAdopted: number; // O, frozen at lock
  plannedFinancing: RunwayPlannedFinancing[];
  phases: RunwayPhase[];
  showMemberPledges: boolean;
  collectionMode: 'ANYTIME' | 'BY_DEADLINE' | 'INSTALMENTS';
  stress?: {
    costIncreasePct: number;
    incomeDelayMonths: number;
    incomeHaircutPct: number;
  };
  milestonesReached: Partial<Record<RunwayMilestoneKey, string>>;
  version: number;
  lockedAt?: string;
  activatedAt?: string;
  completedAt?: string;
  createdByMemberId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  auditHash: string;
}

export type RunwayAllocationMode = 'LINE' | 'NEW_LINE' | 'CONTINGENCY';
export type PaymentClaimMethod = string;

export interface RunwayLineRecurrence {
  everyDays: number;
  occurrences: number;
}

export interface RunwayLine {
  id: string; // e.g. RWL-XXXX
  planId: string;
  orgId: string;
  phaseId?: string;
  kind: RunwayLineKind;
  title: string;
  name?: string; // alias for title
  category: string;
  qty: number;
  unitCost: number;
  unitLabel?: string;
  budget?: number; // alias for total planned line cost
  actual?: number; // alias for actual spent on line
  recurrence?: RunwayLineRecurrence;
  plannedDate?: string;
  priority: RunwayLinePriority;
  excludeFromContingency?: boolean;
  confidencePct?: number; // for INCOME lines
  origin: RunwayLineOrigin;
  approval: RunwayApproval;
  proposedByMemberId?: string;
  approvedByMemberId?: string;
  amendmentNote?: string;
  amendmentReason?: string; // alias for amendmentNote
  skipped?: boolean;
  skippedNote?: string;
  linkedDebtId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  auditHash: string;
}

export interface RunwayPledgeEvent {
  id: string;
  type: 'INITIAL' | 'INCREASE' | 'DECREASE' | 'WITHDRAW';
  previousAmount: number;
  newAmount: number;
  note: string;
  reason?: string; // alias for note
  byMemberId: string;
  at: string;
  timestamp?: string; // alias for at
  auditHash: string;
}

export interface RunwayInstalment {
  dueDate: string;
  amount: number;
}

export interface RunwayPledge {
  id: string; // e.g. PLG-XXXX
  planId: string;
  orgId: string;
  memberId: string;
  memberName: string;
  amount: number;
  pledgedAmount?: number; // alias for amount
  paidAmount?: number; // computed paid
  pace: 'ONE_OFF' | 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
  instalments?: RunwayInstalment[];
  history: RunwayPledgeEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface RunwayPaymentClaim {
  id: string; // e.g. CLM-XXXX
  planId: string;
  orgId: string;
  pledgeId: string;
  memberId: string;
  memberName: string;
  amount: number;
  method: string;
  reference?: string;
  proofPhotoDataUrl?: string;
  receiptPhotoDataUrl?: string; // alias for proofPhotoDataUrl
  note?: string; // alias for resolutionNote or member note
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  resolvedByMemberId?: string;
  resolutionNote?: string;
  contributionId?: string;
  createdAt: string;
  resolvedAt?: string;
  auditHash: string;
}

export interface RunwayTemplate {
  id: string;
  orgId?: string;
  name: string;
  description?: string;
  defaultContingencyMode?: ContingencyMode;
  defaultContingencyPercent?: number;
  orgType: 'AGRO_FARMING' | 'GENERAL_VENTURE' | 'ANY';
  contingencyPercent: number;
  phases: Omit<RunwayPhase, 'id'>[];
  lines: Omit<
    RunwayLine,
    'id' | 'planId' | 'orgId' | 'createdAt' | 'updatedAt' | 'auditHash' | 'approval' | 'origin'
  >[];
  isBuiltIn: boolean;
  createdAt: string;
}

export type RunwayAllocation =
  | { mode: 'LINE'; lineId: string; reserveDrawAmount?: number; reserveReason?: string }
  | { mode: 'NEW_LINE'; title: string; category: string; qty?: number; unitCost?: number; note: string }
  | { mode: 'CONTINGENCY'; reason: string };

export type RunwayErrorCode =
  | 'RUNWAY_ALLOCATION_REQUIRED'
  | 'RUNWAY_LINE_INVALID'
  | 'RUNWAY_PHASE_NOT_RELEASED'
  | 'RUNWAY_INSUFFICIENT_GROUND_CASH'
  | 'RUNWAY_LINE_OVERRUN'
  | 'RUNWAY_RESERVE_EXHAUSTED'
  | 'RUNWAY_AMENDMENT_PENDING'
  | 'RUNWAY_REASON_REQUIRED'
  | 'RUNWAY_PLAN_LOCKED'
  | 'RUNWAY_THRESHOLD_NOT_MET'
  | 'RUNWAY_PLEDGE_BELOW_PAID'
  | 'RUNWAY_NOT_ENABLED'
  | 'RUNWAY_ACTIVE_PLAN_EXISTS';

export class RunwayError extends Error {
  public code: RunwayErrorCode;
  public details?: Record<string, unknown>;

  constructor(
    code: RunwayErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RunwayError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, RunwayError.prototype);
  }
}

export type {
  RunwayFundingLayers,
  DerivedLineInfo,
  CashTimelineResult,
  CashTimelineEvent,
  RunwayPlanTotals,
  RunwayVarianceReport,
} from '../utils/runway.ts';
