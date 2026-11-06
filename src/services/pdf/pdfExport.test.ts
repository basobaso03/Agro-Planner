import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBatchLifecyclePdf,
  generateVaccinationPdf,
  generateFeedInventoryPdf,
  generateSiteComparisonPdf,
  generateStockInventoryPdf,
  generateStockMovementPdf,
  generateExpenditureVoucherPdf,
  generateInvoicePdf,
  generateDebtLiabilityPdf,
  generateLoanAgreementPdf,
  generateRunwayReportPdf,
  generateEquityCertificatePdf,
  generateBalanceSheetPdf,
  generateAuditCertificatePdf,
} from './index.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import { createInitialSeedSnapshot } from '../../data/seedData.ts';
import { computeFinancialSummary, computeLivestockStatus } from '../../utils/calculations.ts';
import { computeFundingLayers } from '../../utils/runway.ts';

const mockOrg = {
  id: 'ORG-GVF-9021',
  name: 'Green Valley Farming & Agro Syndicate',
  type: 'AGRO_FARMING' as const,
  adminMemberId: 'mem-admin',
  adminEmail: 'admin@greenvalley.co',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-11-06T00:00:00Z',
  currentInviteCode: 'SEED-8492',
  inviteCodeCreatedAt: '2026-11-06T00:00:00Z',
  inviteCodeExpiresAt: '2026-11-07T00:00:00Z',
  defaultTargetContributionUsd: 5000,
  contributionPaceDefault: 'MONTHLY' as const,
  currency: 'USD',
  currencySymbol: '$',
  features: {
    livestockModule: true,
    farmSitesModule: true,
    feedInventoryModule: true,
    multiSigApprovals: true,
    publicAuditVerifier: true,
    runwayModule: true,
  },
};

const snapshot = createInitialSeedSnapshot(new Date('2026-11-06T00:00:00Z'));
const sampleLivestockStatus = computeLivestockStatus(
  snapshot.livestockEntries[0],
  snapshot.livestockEvents,
  snapshot.feedLedger,
  '2026-11-06T00:00:00Z'
);

test('PDF Engine: 1. Livestock Batch Lifecycle Report produces valid PDF with zero underscores in filename', () => {
  const batch = snapshot.livestockEntries[0];
  const computed = sampleLivestockStatus;

  const doc = generateBatchLifecyclePdf({
    organization: mockOrg,
    livestock: batch,
    computedStatus: computed,
    lifecycleEvents: snapshot.livestockEvents,
    operatorName: 'T. Moyo (Admin)',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Batch-Lifecycle-Report',
    entityName: batch.nameOrTag,
  });

  assert.ok(doc.getNumberOfPages() >= 1, 'Should have at least 1 page');
  assert.ok(!filename.includes('_'), `Filename "${filename}" must not contain underscores!`);
  assert.ok(filename.endsWith('.pdf'));
  assert.ok(doc.output('arraybuffer').byteLength > 5000, 'PDF byte length must be non-trivial');
});

test('PDF Engine: 2. Vaccination & Health Certificate produces valid PDF with zero underscores in filename', () => {
  const batch = snapshot.livestockEntries[0];

  const doc = generateVaccinationPdf({
    organization: mockOrg,
    livestock: batch,
    checkpoints: [
      {
        id: 'cp-1',
        dayTarget: 1,
        title: 'Newcastle & Infectious Bronchitis Vaccine',
        category: 'VACCINE',
        completed: true,
        completedAt: '2026-10-16',
        completedNote: 'Coarse spray administered at hatchery',
        reminderStatus: 'COMPLETED',
      },
      {
        id: 'cp-2',
        dayTarget: 10,
        title: 'Gumboro (IBD) Intermediate Plus',
        category: 'VACCINE',
        completed: true,
        completedAt: '2026-10-25',
        completedNote: 'Drinking water with skimmed milk stabilizer',
        reminderStatus: 'COMPLETED',
      },
    ],
    operatorName: 'Dr. C. Shumba (Veterinarian)',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Flock-Vaccination-Certificate',
    entityName: batch.nameOrTag,
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'), `Filename "${filename}" must not contain underscores!`);
  assert.ok(filename.endsWith('.pdf'));
});

test('PDF Engine: 3. Feed Inventory & Burn Rate Report produces valid PDF with zero underscores in filename', () => {
  const doc = generateFeedInventoryPdf({
    organization: mockOrg,
    summaries: [
      {
        locationId: 'loc-1',
        locationName: 'Paddock A',
        feedType: 'Broiler Starter Crumbles',
        totalBagsStockedIn: 30,
        totalBagsConsumed: 28.5,
        totalContraBags: 0,
        remainingBags: 1.5,
        remainingKg: 75,
        kgPerBag: 50,
        estimatedDailyBurnBags: 0.5,
        daysRemaining: 3,
        events: [],
      },
    ],
    operatorName: 'Store Supervisor',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Feed-Inventory-Audit',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
  assert.ok(filename.endsWith('.pdf'));
});

test('PDF Engine: 4. Multi-Site Paddock Comparison Report produces valid PDF with zero underscores in filename', () => {
  const doc = generateSiteComparisonPdf({
    organization: mockOrg,
    siteSummaries: [
      {
        location: snapshot.locations[0],
        activeAnimalHeadcount: 1450,
        activeBatchCount: 2,
        siteApprovedExpenses: 2400,
        sitePendingExpenses: 0,
        siteFixedAssetValue: 8000,
        siteMortalityRatePercent: 3.2,
        siteSalesRevenue: 5200,
      },
    ],
    operatorName: 'Farm Operations Director',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Site-Paddock-Comparison',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
});

test('PDF Engine: 5. Stock Inventory SKU Catalog produces valid PDF with zero underscores in filename', () => {
  const doc = generateStockInventoryPdf({
    organization: mockOrg,
    items: [
      {
        feedType: '50kg Broiler Finisher Mash',
        locationName: 'Central Depot',
        remainingBags: 120,
        totalBagsStockedIn: 200,
        totalBagsConsumed: 80,
      },
    ],
    operatorName: 'Inventory Controller',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Stock-Inventory-Catalog',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
});

test('PDF Engine: 6. Stock Movement Dispatch Waybill produces valid PDF with zero underscores in filename', () => {
  const doc = generateStockMovementPdf({
    organization: mockOrg,
    events: snapshot.feedLedger,
    operatorName: 'Logistics Supervisor',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Stock-Movement-Waybill',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
});

test('PDF Engine: 7. Commercial Invoice & Credit Statement produces valid PDF with zero underscores in filename', () => {
  const mockCreditSale = {
    id: 'CSALE-4019',
    orgId: mockOrg.id,
    locationId: 'loc-1',
    locationName: 'Paddock A',
    customerName: 'Downtown Braai & Butchery',
    customerPhone: '+263 77 123 4567',
    customerAddress: 'Stand 409, Market Square',
    livestockName: 'Broiler Batch #04',
    quantitySold: 300,
    unitPrice: 6.0,
    totalSaleAmount: 1800.0,
    depositPaidCash: 600.0,
    creditBalanceRemaining: 1200.0,
    saleDate: '2026-11-01',
    agreedSettlementDate: '2026-11-25',
    paymentTerms: '33% upfront cash, balance upon month-end clearance',
    notes: 'Premium grade dressed birds',
    status: 'OUTSTANDING' as const,
    paymentLogs: [
      {
        id: 'pay-1',
        amount: 200,
        paidAt: '2026-11-04',
        paymentMethod: 'EcoCash',
        receiptReference: 'MP-892147',
        recordedByMemberId: 'mem-admin',
        recordedByName: 'T. Moyo',
        note: 'Partial installment collected',
        auditHash: 'a7c8...901',
      },
    ],
    dateExtensions: [],
    loggedByMemberId: 'mem-admin',
    loggedByName: 'T. Moyo',
    createdAt: '2026-11-01T10:00:00Z',
    auditHash: 'f4e2...890',
  };

  const doc = generateInvoicePdf({
    organization: mockOrg,
    sale: mockCreditSale,
    operatorName: 'T. Moyo (Admin)',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Commercial-Invoice',
    entityName: mockCreditSale.id,
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'), `Filename "${filename}" must not contain underscores!`);
  assert.ok(filename.endsWith('.pdf'));
});

test('PDF Engine: 8. Creditor Debt Liability Statement produces valid PDF with zero underscores in filename', () => {
  const mockDebt = {
    id: 'DEBT-8012',
    orgId: mockOrg.id,
    creditorName: "Irvine's Commercial Hatcheries",
    creditorContact: '+263 242 611 111',
    category: 'SUPPLIER_CREDIT' as const,
    principalAmount: 2500.0,
    remainingBalance: 1000.0,
    borrowDate: '2026-10-10',
    dueDate: '2026-11-30',
    interestRatePercent: 0,
    purposeNote: 'Acquisition of 1,500 day-old chicks and brooding starter feeds',
    status: 'PARTIALLY_PAID' as const,
    repayments: [
      {
        id: 'rep-1',
        amount: 1500.0,
        paidAt: '2026-10-28',
        paidByMemberId: 'mem-admin',
        paidByName: 'T. Moyo',
        paymentMethod: 'Bank Transfer',
        receiptReference: 'TXN-9021-IRV',
        note: 'First installment cleared',
        auditHash: '98d1...541',
      },
    ],
    loggedByMemberId: 'mem-admin',
    loggedByName: 'T. Moyo',
    createdAt: '2026-10-10T08:00:00Z',
    auditHash: '11c4...332',
  };

  const doc = generateDebtLiabilityPdf({
    organization: mockOrg,
    debt: mockDebt,
    operatorName: 'Finance Director',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Creditor-Debt-Statement',
    entityName: mockDebt.id,
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
});

test('PDF Engine: 9. Executive Runway Capital Plan Report produces valid PDF with zero underscores in filename', () => {
  const mockPlan = {
    id: 'RWY-BROILER-42',
    orgId: mockOrg.id,
    name: '42-Day Broiler Cycle Runway Plan',
    orgType: 'AGRO_FARMING' as const,
    mode: 'SIMPLE' as const,
    status: 'ACTIVE' as const,
    enforcement: 'STRICT' as const,
    startDate: '2026-10-15',
    fundingDeadline: '2026-10-20',
    breakEvenTargetDate: '2026-11-28',
    contingencyMode: 'PERCENT' as const,
    contingencyPercent: 10,
    targetBasis: 'GROSS' as const,
    activationThresholdPct: 100,
    openingCashAdopted: 500,
    plannedFinancing: [],
    phases: [{ id: 'ph-1', name: 'Brooding & Growth', order: 1, released: true }],
    showMemberPledges: true,
    collectionMode: 'ANYTIME' as const,
    milestonesReached: {},
    version: 1,
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  const lines = [
    {
      id: 'line-1',
      planId: mockPlan.id,
      name: 'Day-Old Chicks (1,500 Birds)',
      kind: 'COST' as const,
      costType: 'ONE_OFF' as const,
      priority: 'ESSENTIAL' as const,
      amount: 1200,
      phaseId: 'ph-1',
      origin: 'PLAN' as const,
      approval: 'APPROVED' as const,
      status: 'PAID' as const,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-15T00:00:00Z',
    },
  ];

  const layers = computeFundingLayers(mockPlan as any, lines as any, [], [], snapshot.expenses, []);

  const doc = generateRunwayReportPdf({
    organization: mockOrg,
    plan: mockPlan as any,
    lines: lines as any,
    expenses: snapshot.expenses,
    layers,
    livestockEvents: snapshot.livestockEvents,
    operatorName: 'T. Moyo (Admin)',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Runway-Variance-Report',
    entityName: mockPlan.name,
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
});

test('PDF Engine: 10. 9-Pillars Balance Sheet Report produces valid PDF with zero underscores in filename', () => {
  const doc = generateBalanceSheetPdf({
    organization: mockOrg,
    summary: {
      leftMoney: 3450,
      totalPool: 5000,
      totalSyndicatePool: 5000,
      approvedExpenses: 2150,
      pendingMultiSigExpenses: 0,
      totalSalesRevenue: 1800,
      reinvestedSalesCash: 1200,
      distributedDividendsCash: 600,
      totalFixedAssetsValue: 6500,
      estimatedActiveLivestockValue: 4200,
      totalExpectedLivestockRevenue: 5800,
      totalBorrowedDebtOutstanding: 1000,
      totalLoansGivenOutstanding: 0,
      totalCreditSalesOutstanding: 1200,
      totalCustomerDepositsCollected: 600,
      totalDebtRepaid: 1500,
      totalLoansRecovered: 0,
      netFinancialPosition: 14350,
      totalNav: 14350,
      totalSyndicateNav: 14350,
    },
    operatorName: 'Audit Committee',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: '9-Pillars-Balance-Sheet',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
  assert.ok(filename.endsWith('.pdf'));
});

test('PDF Engine: 11. Cryptographic SHA-256 Audit Trail Certificate produces valid PDF with zero underscores in filename', () => {
  const doc = generateAuditCertificatePdf({
    organization: mockOrg,
    auditEvents: snapshot.auditNotifications,
    operatorName: 'System Security Verifier',
  });

  const filename = buildExportFilename({
    orgName: mockOrg.name,
    documentType: 'Audit-Trail-Certificate',
  });

  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(!filename.includes('_'));
  assert.ok(filename.endsWith('.pdf'));
});
