export type DebtCategory =
  | 'SUPPLIER_CREDIT'
  | 'EXTERNAL_LOAN'
  | 'DIRECTOR_MEMBER_ADVANCE'
  | 'EQUIPMENT_FINANCING';

export type DebtStatus = 'OUTSTANDING' | 'PARTIALLY_PAID' | 'SETTLED';

export interface DebtRepaymentLog {
  id: string;
  amount: number;
  paidAt: string;
  paidByMemberId: string;
  paidByName: string;
  paymentMethod: string;
  receiptReference?: string;
  note: string;
  auditHash: string;
}

export interface DebtLiabilityEvent {
  id: string; // e.g. DEBT-XXXX
  orgId: string;
  creditorName: string; // e.g. "Irvine's Hatcheries" or "AgriBank"
  creditorContact?: string;
  category: DebtCategory;
  principalAmount: number;
  remainingBalance: number;
  borrowDate: string;
  dueDate?: string;
  interestRatePercent?: number;
  purposeNote: string;
  status: DebtStatus;
  linkedBatchId?: string; // Optional link to livestock batch acquired
  linkedAssetId?: string;
  runwayPlanId?: string;
  referenceEntityId?: string;
  repayments: DebtRepaymentLog[];
  loggedByMemberId: string;
  loggedByName: string;
  createdAt: string;
  auditHash: string;
}

export type LoanCategory =
  | 'OUTGROWER_ADVANCE'
  | 'PARTNER_FARM_LOAN'
  | 'COMMERCIAL_CREDIT';

export type LoanStatus = 'ACTIVE' | 'PARTIALLY_RECOVERED' | 'RECOVERED' | 'DEFAULTED';

export interface LoanRecoveryLog {
  id: string;
  amount: number;
  recoveredAt: string;
  recordedByMemberId: string;
  recordedByName: string;
  paymentMethod: string;
  receiptReference?: string;
  note: string;
  auditHash: string;
}

export interface LoanGivenEvent {
  id: string; // e.g. LOAN-OUT-XXXX
  orgId: string;
  borrowerName: string; // e.g. "Outgrower Farmer Chitepo"
  borrowerContact: string;
  category: LoanCategory;
  principalAmount: number;
  remainingBalance: number;
  disbursedAt: string;
  agreedReturnDate: string;
  interestRatePercent?: number;
  collateralNote?: string;
  purposeNote: string;
  status: LoanStatus;
  repayments: LoanRecoveryLog[];
  disbursedByMemberId: string;
  disbursedByName: string;
  createdAt: string;
  auditHash: string;
}

export type CreditSaleStatus = 'OUTSTANDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'DEFAULTED';

export interface CreditSalePaymentLog {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod: string; // Cash, EcoCash, Bank Transfer, InnBucks
  receiptReference?: string;
  recordedByMemberId: string;
  recordedByName: string;
  note: string;
  auditHash: string;
}

export interface CreditSaleDateExtensionLog {
  id: string;
  previousDate: string;
  previousDueDate?: string; // Alias
  newAgreedDate: string;
  newDueDate?: string; // Alias
  reason: string;
  extendedAt: string;
  authorizedByMemberId: string;
  authorizedByName: string;
}

export interface CreditSaleEvent {
  id: string; // e.g. CSALE-XXXX
  orgId: string;
  locationId: string;
  locationName: string;
  customerName: string; // e.g. "Downtown Braai & Butchery"
  customerPhone: string;
  customerAddress?: string;
  livestockId?: string;
  livestockName?: string;
  quantitySold: number;
  unitPrice: number;
  totalSaleAmount: number;
  totalSaleAmountUsd?: number; // Alias
  depositPaidCash: number; // Down payment received immediately in liquid cash
  upfrontDepositUsd?: number; // Alias
  creditBalanceRemaining: number; // Principal still owed
  remainingCreditBalanceUsd?: number; // Alias
  saleDate: string;
  agreedSettlementDate: string; // Current agreed settlement date
  targetDueDate?: string; // Alias
  paymentTerms: string; // e.g. "50% upfront, remainder on Nov 25th"
  notes: string;
  status: CreditSaleStatus;
  paymentLogs: CreditSalePaymentLog[];
  dateExtensions: CreditSaleDateExtensionLog[];
  loggedByMemberId: string;
  loggedByName: string;
  createdAt: string;
  auditHash: string;
}

export interface ExtendedFinancialSummary {
  // Liquid cash physically on the ground in bank accounts & wallets
  leftMoney: number;
  // Capital pool (gross member contributions)
  totalPool: number;
  totalSyndicatePool: number;
  // Cumulative expenses approved
  approvedExpenses: number;
  pendingMultiSigExpenses: number;
  // Total cash sales & dividends
  totalSalesRevenue: number;
  reinvestedSalesCash: number;
  distributedDividendsCash: number;
  // Assets & Livestock
  totalFixedAssetsValue: number;
  estimatedActiveLivestockValue: number;
  totalExpectedLivestockRevenue: number;
  // 9-Pillar Expanded Balances
  totalBorrowedDebtOutstanding: number; // Borrowed liabilities (not paid yet)
  totalLoansGivenOutstanding: number; // Receivables lent to third parties (not returned yet)
  totalCreditSalesOutstanding: number; // Customer accounts receivable
  totalCustomerDepositsCollected: number; // Total cash deposits collected from credit sales
  totalDebtRepaid: number;
  totalLoansRecovered: number;
  // True Net Worth / Solvent Net Asset Value
  netFinancialPosition: number;
  totalNav: number;
  totalSyndicateNav: number;
}
