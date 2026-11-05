import type { Organization } from './organization.ts';
export * from './financials.ts';
import type { DebtLiabilityEvent, LoanGivenEvent, CreditSaleEvent } from './financials.ts';
export * from './runway.ts';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayPledge,
  RunwayPaymentClaim,
  RunwayTemplate,
} from './runway.ts';

export type Role =
  | 'ORG_ADMIN'
  | 'MEMBER'
  | 'TREASURER'
  | 'GROUND_OPERATOR'
  // Legacy aliases for seamless data migration:
  | 'SYNDICATE_ADMIN'
  | 'REMOTE_INVESTOR';

export type MemberApprovalStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'SUSPENDED';

export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export type TrackingMode = 'BATCH' | 'INDIVIDUAL_TAG';

export type LedgerEntryDirection =
  | 'INITIAL'
  | 'ADDITION'
  | 'DEDUCTION'
  | 'CONTRA_REVERSAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface FarmLocation {
  id: string;
  orgId?: string;
  name: string;
  region: string;
  gpsCoordinates: string;
  primaryOperatorName: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface OrgMember {
  id: string;
  orgId?: string;
  uid?: string;
  email?: string;
  fullName: string;
  phoneOrEmail: string;
  phone?: string;
  jobTitle?: string;
  bio?: string;
  preferredContact?: 'EMAIL' | 'WHATSAPP' | 'SMS';
  role: Role;
  approvalStatus?: MemberApprovalStatus;
  authProviders?: string[];
  hasPasswordSetup?: boolean;
  passwordVerifierHash?: string;
  assignedLocationId?: string;

  // Capital Target Commitment Configuration
  targetContributionUsd?: number;
  contributionPace?: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
  monthlyAgreedAmountUsd?: number;

  joinedAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  active: boolean;
}

// Backward-compatible alias for legacy references
export type SyndicateMember = OrgMember;

// 1. CAPITAL POOL LEDGER (Append-Only)
export interface CapitalContributionEvent {
  id: string;
  orgId?: string;
  memberId: string;
  memberName: string;
  direction: 'INITIAL' | 'ADDITION' | 'CONTRA_REVERSAL';
  amount: number; // Positive for deposit, Negative for contra-reversal deduction
  referenceTransactionId?: string; // Required if direction === 'CONTRA_REVERSAL'
  note: string; // Mandatory explanation
  receiptUrlOrBase64?: string;
  runwayPlanId?: string;
  pledgeId?: string;
  claimId?: string;
  createdAt: string;
  createdByMemberId: string;
  auditHash: string;
}

// 2. EXPENSE & CASH LEDGER (Append-Only)
export type ExpenseCategory =
  | 'FEED'
  | 'VACCINES_MEDICATION'
  | 'LIVESTOCK_PURCHASE'
  | 'FIXED_ASSET_PURCHASE'
  | 'LABOR_WAGES'
  | 'TRANSPORT_LOGISTICS'
  | 'UTILITIES_SECURITY'
  | 'FENCING_SECURITY'
  | 'MAINTENANCE'
  | 'OTHER';

export type ApprovalStatus = 'APPROVED' | 'PENDING_MULTISIG' | 'REJECTED_BY_CONTRA';

export interface ExpenseLedgerEvent {
  id: string;
  orgId?: string;
  locationId: string;
  locationName: string;
  batchOrAnimalId?: string; // Optional link to specific animal group
  category: ExpenseCategory;
  direction: 'DEDUCTION' | 'CONTRA_REVERSAL';
  amount: number; // Positive for expense deduction, Negative if reversing an overstated expense
  referenceTransactionId?: string; // Required if CONTRA_REVERSAL
  note: string; // MANDATORY detailed description of what the money was used for
  loggedByMemberId: string;
  loggedByName: string;
  gpsStamp?: string;
  receiptPhotoDataUrl?: string;
  approvalStatus: ApprovalStatus;
  approvedByMemberIds: string[];
  runwayPlanId?: string;
  runwayLineId?: string;
  runwayReserveDraw?: number;
  runwayAllocationNote?: string;
  createdAt: string;
  auditHash: string;
}

// 3. FIXED ASSETS LEDGER (Append-Only)
export type FixedAssetCategory =
  | 'HOUSING_INFRASTRUCTURE'
  | 'WATER_SOLAR'
  | 'FEEDERS_EQUIPMENT'
  | 'FENCING_SECURITY'
  | 'TOOLS_MACHINERY'
  | 'CUSTOM'
  | (string & {});

export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';

export interface FixedAssetLedgerEvent {
  id: string;
  orgId?: string;
  assetGroupId: string; // Groups initial purchase + subsequent valuation adjustments/transfers
  assetName: string;
  category: FixedAssetCategory;
  locationId: string;
  direction: 'INITIAL' | 'ADDITION' | 'DEDUCTION' | 'CONTRA_REVERSAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantityDelta: number; // e.g. +10 drinkers, or -2 broken drinkers
  valueDelta: number; // e.g. +$1200, or -$150 depreciation/damage adjustment
  condition: AssetCondition;
  referenceTransactionId?: string;
  note: string; // Mandatory note
  loggedByName: string;
  photoUrl?: string;
  createdAt: string;
  auditHash: string;
}

// 4. LIVESTOCK GROUPS / ANIMALS & LIFECYCLE LEDGER (Append-Only)
export type CheckpointCategory =
  | 'VACCINE'
  | 'FEED_TRANSITION'
  | 'WEIGHT_CHECK'
  | 'BIOSECURITY'
  | 'MEDICATION'
  | 'GENERAL_TASK';

export interface AnimalCheckpoint {
  id: string;
  dayTarget: number; // e.g. 1, 7, 14, 28, 42
  scheduledDate?: string; // Exact calendar date via DatePicker (YYYY-MM-DD)
  title: string;
  category: CheckpointCategory;
  targetWeightKg?: number;
  feedPhase?: string;
  instructions?: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  completedNote?: string;
  reminderStatus: 'SCHEDULED' | 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED';
}

export interface FarmRecipeTemplate {
  id: string;
  orgId: string;
  name: string; // e.g., 'Commercial 42-Day Broiler Standard', 'Hardy Boer Goat 8-Month'
  species: string;
  recommendedDurationDays: number;
  targetSaleWeightKg: number;
  checkpoints: Omit<AnimalCheckpoint, 'id' | 'completed' | 'completedAt' | 'reminderStatus'>[];
  isCustomOrgRecipe: boolean;
  createdAt: string;
  notes?: string;
}

export interface LivestockEntry {
  id: string;
  orgId?: string;
  locationId: string;
  locationName: string;
  species: string; // e.g. 'Broilers', 'Boer Goats', 'Layers', 'Cattle', 'Pigs', 'Sheep' or custom
  nameOrTag: string; // e.g. 'Broiler Batch #04' or 'Buck #GOAT-ZW-19'
  trackingMode: TrackingMode; // 'BATCH' or 'INDIVIDUAL_TAG'
  entryDate: string; // ISO timestamp when tracking started
  initialAgeValue: number; // Age when brought into farm (e.g. 1 day old, or 3 months old)
  initialAgeUnit: DurationUnit;
  targetDurationValue: number; // Target time until sale (e.g. 6 weeks, 42 days, 8 months, 2 years)
  targetDurationUnit: DurationUnit;
  targetSaleDate: string; // Computed ISO date when animal reaches market readiness
  initialHeadcount: number;
  purchaseCostTotal: number;
  targetSaleWeightKg?: number;
  notes: string;
  createdByMemberName: string;
  imageUrl?: string;
  gallery?: string[];
  createdAt: string;
  // Flexible custom recipe and checkpoints CRUD
  customCheckpoints?: AnimalCheckpoint[];
  recipeTemplateId?: string;
  // Configurable selling prices & funding tracking
  configuredSalePricePerUnit?: number;
  configuredSalePricePerKg?: number;
  fundingSource?: 'CASH_POOL' | 'SUPPLIER_CREDIT' | 'DIRECTOR_LOAN';
  fundingDebtId?: string;
}

export type LivestockEventType =
  | 'INITIAL_STOCK'
  | 'MORTALITY_LOSS'
  | 'BIRTH_OFFSPRING'
  | 'SALE_DISPATCH'
  | 'SLAUGHTER_HARVEST'
  | 'FARM_CONSUMPTION'
  | 'HEADCOUNT_CONTRA_ADJUSTMENT'
  | 'VACCINATION_HEALTH'
  | 'WEIGHT_CHECK'
  | 'PHOTO_PROGRESS'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN';

export interface LivestockLifecycleEvent {
  id: string;
  orgId?: string;
  livestockId: string;
  livestockName: string;
  locationId: string;
  eventType: LivestockEventType;
  headcountDelta: number; // e.g. -2 for mortality, +3 for goat kids born, +2 for contra-reversal
  weightAvgKg?: number;
  saleRevenueAmount?: number; // Populated if eventType === 'SALE_DISPATCH'
  reinvestmentPercentage?: number; // % of sale revenue returned to Left Money vs paid as Member Dividends
  referenceTransactionId?: string; // Populated if correcting a previous log
  note: string; // Mandatory note
  loggedByName: string;
  photoUrl?: string;
  createdAt: string;
  auditHash: string;
}

// 5. FEED INVENTORY LEDGER (Append-Only)
export interface FeedLedgerEvent {
  id: string;
  orgId?: string;
  locationId: string;
  feedType: string; // e.g. 'Broiler Starter Crumbles', 'Broiler Finisher Mash', 'Goat Supplement'
  direction: 'STOCK_IN' | 'DAILY_CONSUMPTION' | 'CONTRA_REVERSAL';
  bagsDelta: number; // +20 bags bought, -1.5 bags consumed
  kgPerBag: number; // default 50kg
  linkedLivestockId?: string;
  referenceTransactionId?: string;
  note: string;
  photoUrl?: string;
  loggedByMemberId?: string;
  loggedByName: string;
  createdAt: string;
  auditHash: string;
}

// 6. IMMUTABLE AUDIT & NOTIFICATION STREAM
export type NotificationSeverity =
  | 'INFO'
  | 'FINANCIAL'
  | 'WARNING_CONTRA'
  | 'URGENT_GROUND'
  | 'MILESTONE';

export type AuditEventType =
  | 'ORGANIZATION_CREATED'
  | 'INVITE_CODE_REFRESHED'
  | 'SITE_REGISTERED'
  | 'SITE_UPDATED'
  | 'SITE_REMOVED'
  | 'RECIPE_TEMPLATE_SAVED'
  | 'CHECKPOINT_CUSTOMIZED'
  | 'MEMBER_ADDED'
  | 'MEMBER_APPROVED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_SUSPENDED'
  | 'MEMBER_DELETED'
  | 'MEMBER_PROFILE_UPDATED'
  | 'SECURITY_CREDENTIAL_LINKED'
  | 'SYSTEM_LEDGER_RESET'
  | 'CAPITAL_CONTRIBUTION'
  | 'CAPITAL_CONTRA'
  | 'EXPENSE_LOGGED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_CONTRA'
  | 'ASSET_LOGGED'
  | 'ASSET_CONTRA'
  | 'LIVESTOCK_REGISTERED'
  | 'LIVESTOCK_MORTALITY'
  | 'LIVESTOCK_BIRTH'
  | 'LIVESTOCK_SALE'
  | 'LIVESTOCK_CONTRA'
  | 'FEED_LOGGED'
  | 'GROUND_BROADCAST'
  | 'FINANCIAL_TRANSACTION'
  | 'CREDIT_SALE'
  | 'LIVESTOCK_UPDATED'
  | 'RUNWAY_PLAN_CREATED'
  | 'RUNWAY_PLAN_LOCKED'
  | 'RUNWAY_PLAN_ACTIVATED'
  | 'RUNWAY_PLEDGE'
  | 'RUNWAY_PAYMENT'
  | 'RUNWAY_AMENDMENT'
  | 'RUNWAY_RESERVE_DRAW'
  | 'RUNWAY_MILESTONE'
  | 'RUNWAY_OFF_PLAN_WARNING'
  | 'RUNWAY_PLAN_CLOSED';

export interface AuditNotificationEvent {
  id: string;
  orgId?: string;
  sequenceNumber: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  locationId: string; // 'ALL' or specific location ID
  locationName: string;
  eventType: AuditEventType;
  severity: NotificationSeverity;
  title: string;
  message: string; // Clear human-readable summary with mandatory note included
  deltaFinancial?: number;
  deltaHeadcount?: number;
  referenceEntityId?: string;
  previousHash: string;
  currentHash: string;
  readByMemberIds: string[];
  photoUrl?: string;
}

// DERIVED COMPUTED INTERFACES FOR REAL-TIME DASHBOARD
export interface MemberEquitySummary {
  member: OrgMember;
  grossContributed: number;
  contraAdjustments: number;
  netContribution: number;
  profitSharePercentage: number;
  impliedNavEquityUsd: number;
  eventCount: number;
  // Target Capital Progress
  targetContributionUsd: number;
  progressPercentage: number;
  remainingToTargetUsd: number;
  isGoalMet: boolean;
  contributionPace: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
}

export interface FinancialSummary {
  totalPool: number;
  totalSyndicatePool: number; // Backward-compatible alias
  approvedExpenses: number;
  pendingMultiSigExpenses: number;
  totalSalesRevenue: number;
  reinvestedSalesCash: number;
  distributedDividendsCash: number;
  leftMoney: number;
  totalFixedAssetsValue: number;
  estimatedActiveLivestockValue: number;
  totalNav: number;
  totalSyndicateNav: number; // Backward-compatible alias
  // 9-Pillar Expanded Financial Balances
  totalBorrowedDebtOutstanding?: number;
  totalLoansGivenOutstanding?: number;
  totalCreditSalesOutstanding?: number;
  totalCustomerDepositsCollected?: number;
  totalExpectedLivestockRevenue?: number;
  totalDebtRepaid?: number;
  totalLoansRecovered?: number;
  netFinancialPosition?: number;
  creditSalesReceivables?: number;
  debtLiabilitiesOwed?: number;
  loansGivenRecoverable?: number;
}

export type CountdownUrgency = 'NORMAL' | 'PREPARE_MARKET' | 'READY_FOR_SALE';

export interface ProtocolMilestone {
  id: string;
  dayTarget: number;
  title: string;
  category: 'VACCINE' | 'FEED_TRANSITION' | 'WEIGHT_CHECK' | 'BIOSECURITY';
  completed: boolean;
  completedNote?: string;
  completedAt?: string;
  // Lifecycle checkpoint reminder, dispatch & telemetry metadata:
  scheduledDate?: string;
  dispatchTime?: string;
  dispatchIso?: string;
  targetWeightKg?: number;
  feedPhase?: string;
  description?: string;
  reminderStatus?: 'SCHEDULED' | 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED';
}

export interface LivestockComputedStatus {
  entry: LivestockEntry;
  initialAgeDays: number;
  daysOnFarm: number;
  currentTotalAgeDays: number;
  formattedCurrentAge: string;
  targetDurationDays: number;
  daysLeftUntilSale: number;
  progressPercentage: number;
  countdownBadgeText: string;
  countdownUrgency: CountdownUrgency;
  currentLiveHeadcount: number;
  totalMortalities: number;
  totalBirths: number;
  totalSold: number;
  totalSlaughteredOrConsumed?: number;
  totalContraDelta: number;
  mortalityRatePercent: number;
  totalFeedConsumedKg: number;
  latestWeightAvgKg?: number;
  estimatedCurrentValueUsd: number;
  // Configured pricing & income projections
  configuredSalePricePerUnit?: number;
  configuredSalePricePerKg?: number;
  expectedRevenuePerAnimalUsd?: number;
  totalExpectedRevenueUsd?: number;
  totalProjectedMarginUsd?: number;
  lifecycleEvents: LivestockLifecycleEvent[];
  protocols: ProtocolMilestone[];
  customCheckpoints?: AnimalCheckpoint[];
}

export interface FixedAssetGroupSummary {
  assetGroupId: string;
  assetName: string;
  category: FixedAssetCategory;
  locationId: string;
  locationName: string;
  currentQuantity: number;
  currentValue: number;
  latestCondition: AssetCondition;
  events: FixedAssetLedgerEvent[];
}

export interface FeedInventorySummary {
  locationId: string;
  locationName: string;
  feedType: string;
  totalBagsStockedIn: number;
  totalBagsConsumed: number;
  totalContraBags: number;
  remainingBags: number;
  remainingKg: number;
  currentBagsBalance?: number;
  currentKgBalance?: number;
  kgPerBag: number;
  estimatedDailyBurnBags: number;
  daysRemaining: number;
  events: FeedLedgerEvent[];
}

export interface SiteComparisonSummary {
  location: FarmLocation;
  activeAnimalHeadcount: number;
  activeBatchCount: number;
  siteApprovedExpenses: number;
  sitePendingExpenses: number;
  siteFixedAssetValue: number;
  siteMortalityRatePercent: number;
  siteSalesRevenue: number;
}

export interface AgroStateSnapshot {
  organizations?: Organization[];
  activeOrgId?: string;
  locations: FarmLocation[];
  members: OrgMember[];
  capitalContributions: CapitalContributionEvent[];
  expenses: ExpenseLedgerEvent[];
  fixedAssets: FixedAssetLedgerEvent[];
  livestockEntries: LivestockEntry[];
  livestockEvents: LivestockLifecycleEvent[];
  feedLedger: FeedLedgerEvent[];
  auditNotifications: AuditNotificationEvent[];
  customRecipes?: FarmRecipeTemplate[];
  debtLiabilities?: DebtLiabilityEvent[];
  loansGiven?: LoanGivenEvent[];
  creditSales?: CreditSaleEvent[];
  runwayPlans?: RunwayPlan[];
  runwayLines?: RunwayLine[];
  runwayPledges?: RunwayPledge[];
  runwayClaims?: RunwayPaymentClaim[];
  runwayTemplates?: RunwayTemplate[];
}

export type CapitaSeedStateSnapshot = AgroStateSnapshot;
