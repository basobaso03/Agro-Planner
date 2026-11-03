import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import {
  computeFinancialSummary,
  computeLivestockStatus,
} from '../src/utils/calculations.ts';
import type { FarmLocation, LivestockEntry } from '../src/types/agro.ts';
import {
  TEST_ACCOUNTS,
  toOrgMember,
} from './helpers/testContext.ts';

// ---------------------------------------------------------------------------
// SUITE 8: FINANCIAL REDESIGN, 9-PILLAR WEALTH & MODERN BANKING HUB WORKFLOWS
// ---------------------------------------------------------------------------

test('WF-FIN-01: Zero-Balance Overdraft Prevention — Disallow purchasing livestock with $0 money', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  // 1. Ensure an isolated test location exists
  const loc = dataService.addLocation({
    name: 'Norton Financial Test Farm Site',
    region: 'Mashonaland West',
    gpsCoordinates: '-17.8833, 30.7000',
    primaryOperatorName: adminActor.fullName,
    actor: adminActor,
  });

  // Calculate left money for this isolated location / org
  const leftCash = dataService.getCurrentOrgLeftMoney(orgId);

  // Attempting to register livestock costing more than leftCash using CASH_POOL must fail
  assert.throws(
    () => {
      dataService.registerLivestock({
        locationId: loc.id,
        species: 'Broiler Chicken',
        nameOrTag: 'BATCH-OVERDRAFT-TEST',
        initialHeadcount: 100,
        purchaseCostTotal: Math.max(leftCash + 500, 500),
        targetDurationValue: 42,
        targetDurationUnit: 'DAYS',
        targetSaleWeightKg: 2.2,
        notes: 'Attempting to buy broilers with negative / non-existent capital',
        actor: adminActor,
        fundingSource: 'CASH_POOL',
        autoDeductPurchaseFromLeftMoney: true,
      });
    },
    (err: any) => {
      assert.match(
        err.message,
        /Insufficient liquid funds in Left Money/i,
        'Expected overdraft prevention error when spending non-existent money'
      );
      return true;
    }
  );
});

test('WF-FIN-02: Supplier Credit Acquisition — Register livestock on trade credit without deducting cash', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = dataService.getState().locations.find((l) => l.orgId === orgId) || dataService.getState().locations[0];

  const initialCash = dataService.getCurrentOrgLeftMoney(orgId);

  // Register 100 broilers on SUPPLIER_CREDIT
  const result = dataService.registerLivestock({
    locationId: loc.id,
    species: 'Broiler Chicken',
    nameOrTag: 'BATCH-SUPPLIER-CREDIT-01',
    initialHeadcount: 100,
    purchaseCostTotal: 500,
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    targetSaleWeightKg: 2.2,
    notes: '100 Day-old chicks acquired on 30-day supplier credit from Irvines',
    actor: adminActor,
    fundingSource: 'SUPPLIER_CREDIT',
    creditorName: 'Irvines Hatcheries Zimbabwe',
    duePaymentDate: '2026-12-01',
    configuredSalePricePerUnit: 6.0,
  });

  assert.ok(result.id);
  assert.equal(result.species, 'Broiler Chicken');
  assert.equal(result.fundingSource, 'SUPPLIER_CREDIT');

  // Verify that cash on the ground was NOT deducted at stock entry
  const afterCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(afterCash, initialCash, 'Cash on the ground must remain unchanged when using supplier credit');

  // Verify that a DebtLiabilityEvent was automatically logged
  const debt = (dataService.getState().debtLiabilities || []).find(
    (d) => d.referenceEntityId === result.id
  );
  assert.ok(debt, 'A debt liability record must be created for the supplier credit');
  assert.equal(debt.creditorName, 'Irvines Hatcheries Zimbabwe');
  assert.equal(debt.principalAmount, 500);
  assert.equal(debt.remainingBalance, 500);
  assert.equal(debt.status, 'OUTSTANDING');
});

test('WF-FIN-03: Capital Deposit — Member contributes capital and increases liquid working pool', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  // Ensure an approved member exists in state
  let member = dataService.getState().members.find((m) => m.orgId === orgId && m.active);
  if (!member) {
    member = dataService.addMember({
      fullName: 'Chipo Tendai (Treasurer)',
      phoneOrEmail: 'chipo.treasurer@agroplanner.com',
      role: 'TREASURER',
      actor: adminActor,
    });
  }

  const beforeCash = dataService.getCurrentOrgLeftMoney(orgId);

  // Deposit $250 working capital
  const deposit = dataService.logCapitalContribution({
    memberId: member.id,
    direction: 'ADDITION',
    amount: 250,
    note: 'Working capital deposit for feed and supplier debt settlement',
    actor: adminActor,
  });

  assert.ok(deposit.id);
  assert.equal(deposit.amount, 250);

  const afterCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(afterCash, beforeCash + 250, 'Liquid working cash must increase by exactly $250');
});

test('WF-FIN-04: Debt Liability Repayment — Partial settlement reduces debt and deducts cash', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const debt = (dataService.getState().debtLiabilities || []).find(
    (d) => d.creditorName === 'Irvines Hatcheries Zimbabwe' && d.status === 'OUTSTANDING'
  );
  assert.ok(debt, 'Active debt liability to Irvines must exist');

  const beforeCash = dataService.getCurrentOrgLeftMoney(orgId);
  const beforeDebtBalance = debt.remainingBalance;

  // Repay $200 of the $500 debt
  const repayment = dataService.repayDebtLiability({
    debtId: debt.id,
    amount: 200,
    paymentMethod: 'Bank Transfer (Ecocash/CBZ)',
    referenceNote: 'Partial supplier debt payment for broiler chicks batch',
    actor: adminActor,
  });

  assert.equal(repayment.amount, 200);

  // Check updated debt balance
  const updatedDebt = (dataService.getState().debtLiabilities || []).find((d) => d.id === debt.id);
  assert.ok(updatedDebt);
  assert.equal(updatedDebt.remainingBalance, beforeDebtBalance - 200);
  assert.equal(updatedDebt.status, 'PARTIALLY_PAID');
  assert.equal(updatedDebt.repayments.length, 1);

  // Check that cash was cleanly deducted
  const afterCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(afterCash, beforeCash - 200, 'Liquid cash must decrease by the repaid debt amount ($200)');
});

test('WF-FIN-05: Loan Disbursal & Recovery — Money lent to third party and recovered to cash pool', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const beforeCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.ok(beforeCash >= 30, 'Sufficient cash must be available to disburse loan');

  // Disburse $30 short-term operational advance loan to an agricultural partner
  const loan = dataService.recordLoanGiven({
    borrowerName: 'Mukundi Organic Compost Ltd',
    borrowerContact: '+263 77 987 6543',
    principalAmount: 30,
    agreedReturnDate: '2026-11-20',
    reason: 'Emergency transport bridge advance for organic fertilizer bags delivery',
    actor: adminActor,
  });

  assert.ok(loan.id);
  assert.equal(loan.principalAmount, 30);
  assert.equal(loan.remainingBalance, 30);
  assert.equal(loan.status, 'ACTIVE');

  // Cash should drop by $30
  const midCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(midCash, beforeCash - 30, 'Cash must drop by $30 when loan is disbursed');

  // Recover the $30 loan back to treasury
  const recovery = dataService.recoverLoanGiven({
    loanId: loan.id,
    amount: 30,
    paymentMethod: 'Cash USD',
    referenceNote: 'Full repayment received with gratitude from Mukundi Organic',
    actor: adminActor,
  });

  assert.equal(recovery.amount, 30);

  const updatedLoan = (dataService.getState().loansGiven || []).find((l) => l.id === loan.id);
  assert.ok(updatedLoan);
  assert.equal(updatedLoan.remainingBalance, 0);
  assert.equal(updatedLoan.status, 'RECOVERED');

  // Cash returns to original level
  const finalCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(finalCash, beforeCash, 'Cash must return to original balance after loan recovery');
});

test('WF-FIN-06: Customer Sale on Credit — Down payment, receivables tracking, live inventory deduction & broadcast', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const batch = (dataService.getState().livestockEntries || []).find(
    (l) => l.nameOrTag === 'BATCH-SUPPLIER-CREDIT-01'
  );
  assert.ok(batch, 'Batch must exist');

  const beforeCash = dataService.getCurrentOrgLeftMoney(orgId);

  // Sell 50 broilers on credit:
  // Total Sale Price: $300 ($6/bird)
  // Upfront Cash Deposit: $100
  // Remaining Balance on Credit: $200
  // Target Due Date: 14 days later
  const creditSale = dataService.recordCreditSale({
    customerName: 'Norton Fresh Supermarket',
    customerContact: '+263 77 555 4321',
    livestockId: batch.id,
    quantitySold: 50,
    unitPriceUsd: 6.0,
    totalSaleAmountUsd: 300,
    upfrontDepositUsd: 100,
    targetDueDate: '2026-11-25',
    notes: '50 live dressed broilers supplied on 14-day credit term',
    actor: adminActor,
  });

  assert.ok(creditSale.id);
  assert.equal(creditSale.quantitySold, 50);
  assert.equal(creditSale.totalSaleAmountUsd, 300);
  assert.equal(creditSale.upfrontDepositUsd, 100);
  assert.equal(creditSale.remainingCreditBalanceUsd, 200);
  assert.equal(creditSale.status, 'PARTIALLY_PAID');

  // Cash must increase by the upfront deposit collected ($100)
  const afterCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(afterCash, beforeCash + 100, 'Liquid cash must increase by $100 upfront deposit');

  // Batch lifecycle event must have deducted 50 animals from live stock
  const saleEvent = dataService.getState().livestockEvents.find(
    (e) => e.livestockId === batch.id && e.eventType === 'SALE_DISPATCH' && e.headcountDelta === -50
  );
  assert.ok(saleEvent, 'A SALE lifecycle event decremented live headcount by 50');

  // Computed status should reflect remaining 50 live headcount
  const computed = computeLivestockStatus(
    batch,
    dataService.getState().livestockEvents,
    dataService.getState().feedLedger
  );
  assert.equal(computed.currentLiveHeadcount, 50, 'Live headcount must now be 50');

  // System broadcast dispatched to organization members
  const broadcast = dataService.getState().auditNotifications.find(
    (a) => a.eventType === 'CREDIT_SALE' && a.referenceEntityId === creditSale.id
  );
  assert.ok(broadcast, 'Audit notification for credit sale must be broadcasted to all members');
  assert.match(broadcast.message, /Norton Fresh Supermarket/);
});

test('WF-FIN-07: Credit Sale Due Date Extension — Rescheduling with mandatory justification and audit broadcast', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  const creditSale = (dataService.getState().creditSales || []).find(
    (s) => s.customerName === 'Norton Fresh Supermarket'
  );
  assert.ok(creditSale, 'Credit sale must exist');

  const oldDueDate = creditSale.targetDueDate;
  const newDueDate = '2026-12-05';

  // 1. Attempting extension without reason must fail validation
  assert.throws(
    () => {
      dataService.extendCreditSaleDueDate({
        creditSaleId: creditSale.id,
        newDueDate,
        reason: '   ', // blank reason
        actor: adminActor,
      });
    },
    (err: any) => {
      assert.match(err.message, /Mandatory justification reason required/i);
      return true;
    }
  );

  // 2. Extending with valid reason
  const extended = dataService.extendCreditSaleDueDate({
    creditSaleId: creditSale.id,
    newDueDate,
    reason: 'Customer experienced corporate bank clearing delay; agreed to extend 10 days with 5% collateral pledge',
    actor: adminActor,
  });

  assert.equal(extended.targetDueDate, newDueDate);
  assert.equal(extended.dateExtensions.length, 1);
  assert.equal(extended.dateExtensions[0].previousDueDate, oldDueDate);
  assert.equal(extended.dateExtensions[0].newDueDate, newDueDate);
  assert.match(extended.dateExtensions[0].reason, /corporate bank clearing delay/);

  // System broadcast logged for the extension
  const extensionAudit = dataService.getState().auditNotifications.find(
    (a) => a.title.includes('Credit Sale Due Date Extended') && a.referenceEntityId === creditSale.id
  );
  assert.ok(extensionAudit, 'An audit alert must be broadcasted for the date extension');
});

test('WF-FIN-08: Customer Credit Repayment & Full Settlement', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const creditSale = (dataService.getState().creditSales || []).find(
    (s) => s.customerName === 'Norton Fresh Supermarket'
  );
  assert.ok(creditSale);

  const beforeCash = dataService.getCurrentOrgLeftMoney(orgId);

  // 1. Partial customer payment of $120
  const payment1 = dataService.recordCreditSalePayment({
    creditSaleId: creditSale.id,
    amount: 120,
    paymentMethod: 'EcoCash Merchant',
    referenceNote: 'Installment 1 of 2 from Norton Fresh Supermarket',
    actor: adminActor,
  });

  assert.equal(payment1.amount, 120);

  const saleAfterP1 = (dataService.getState().creditSales || []).find((s) => s.id === creditSale.id);
  assert.ok(saleAfterP1);
  assert.equal(saleAfterP1.remainingCreditBalanceUsd, 80);
  assert.equal(saleAfterP1.status, 'PARTIALLY_PAID');

  const cashAfterP1 = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(cashAfterP1, beforeCash + 120);

  // 2. Final settlement payment of $80
  const payment2 = dataService.recordCreditSalePayment({
    creditSaleId: creditSale.id,
    amount: 80,
    paymentMethod: 'Cash USD',
    referenceNote: 'Final settlement payment; receipt issued in full',
    actor: adminActor,
  });

  assert.equal(payment2.amount, 80);

  const settledSale = (dataService.getState().creditSales || []).find((s) => s.id === creditSale.id);
  assert.ok(settledSale);
  assert.equal(settledSale.remainingCreditBalanceUsd, 0);
  assert.equal(settledSale.status, 'SETTLED');

  const finalCash = dataService.getCurrentOrgLeftMoney(orgId);
  assert.equal(finalCash, beforeCash + 200, 'All $200 credit balance has been collected into liquid cash');
});

test('WF-FIN-09: Unit Price Configuration & Herd Valuation Pricing', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  const batch = (dataService.getState().livestockEntries || []).find(
    (l) => l.nameOrTag === 'BATCH-SUPPLIER-CREDIT-01'
  );
  assert.ok(batch);

  // Configure expected selling price to $6.50/unit
  const updatedEntry = dataService.configureLivestockValuationPrice({
    livestockId: batch.id,
    configuredSalePricePerUnit: 6.5,
    actor: adminActor,
  });

  assert.equal(updatedEntry.configuredSalePricePerUnit, 6.5);

  const computed = computeLivestockStatus(
    updatedEntry,
    dataService.getState().livestockEvents,
    dataService.getState().feedLedger
  );

  assert.equal(computed.configuredSalePricePerUnit, 6.5);
  assert.equal(computed.expectedRevenuePerAnimalUsd, 6.5);
  // 50 birds remaining * $6.50 = $325.00
  assert.equal(computed.totalExpectedRevenueUsd, 325.0);
});

test('WF-FIN-10: Slaughter / Farm Harvest Event & Headcount Integrity', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  const batch = (dataService.getState().livestockEntries || []).find(
    (l) => l.nameOrTag === 'BATCH-SUPPLIER-CREDIT-01'
  );
  assert.ok(batch);

  // Log slaughter / harvest of 10 birds for dressed meat packaging
  const harvestEvent = dataService.logLivestockLifecycleEvent({
    livestockId: batch.id,
    eventType: 'SLAUGHTER_HARVEST',
    headcountDelta: -10,
    note: '10 birds slaughtered and packed for freezer dressed meat storage',
    actor: adminActor,
  });

  assert.ok(harvestEvent.id);
  assert.equal(harvestEvent.eventType, 'SLAUGHTER_HARVEST');
  assert.equal(harvestEvent.headcountDelta, -10);

  const computed = computeLivestockStatus(
    batch,
    dataService.getState().livestockEvents,
    dataService.getState().feedLedger
  );

  // Headcount: 100 initial - 50 sold - 10 slaughtered = 40 live birds
  assert.equal(computed.currentLiveHeadcount, 40);
  assert.equal(computed.totalSlaughteredOrConsumed, 10);
  // Expected revenue on 40 birds * $6.50 = $260.00
  assert.equal(computed.totalExpectedRevenueUsd, 260.0);
});

test('WF-FIN-11: Comprehensive 9-Pillar Financial Equation & Net Worth Verification', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const state = dataService.getState();
  const orgContributions = state.capitalContributions.filter((c) => c.orgId === orgId);
  const orgExpenses = state.expenses.filter((e) => e.orgId === orgId);
  const orgFixedAssets = state.fixedAssets.filter((a) => a.orgId === orgId);
  const orgEntries = state.livestockEntries.filter((l) => l.orgId === orgId);
  const orgEvents = state.livestockEvents.filter((e) => e.orgId === orgId);
  const orgFeed = state.feedLedger.filter((f) => f.orgId === orgId);
  const orgDebts = (state.debtLiabilities || []).filter((d) => d.orgId === orgId);
  const orgLoans = (state.loansGiven || []).filter((l) => l.orgId === orgId);
  const orgCreditSales = (state.creditSales || []).filter((s) => s.orgId === orgId);

  const statuses = orgEntries.map((e) => computeLivestockStatus(e, orgEvents, orgFeed));

  const financials = computeFinancialSummary({
    capitalContributions: orgContributions,
    expenses: orgExpenses,
    fixedAssets: orgFixedAssets,
    livestockStatuses: statuses,
    livestockEvents: orgEvents,
    debtLiabilities: orgDebts,
    loansGiven: orgLoans,
    creditSales: orgCreditSales,
  });

  // Verify all 9 pillars exist and are numbers
  assert.equal(typeof financials.leftMoney, 'number');
  assert.equal(typeof financials.totalBorrowedDebtOutstanding, 'number');
  assert.equal(typeof financials.totalLoansGivenOutstanding, 'number');
  assert.equal(typeof financials.totalCreditSalesOutstanding, 'number');
  assert.equal(typeof financials.totalCustomerDepositsCollected, 'number');
  assert.equal(typeof financials.totalFixedAssetsValue, 'number');
  assert.equal(typeof financials.totalExpectedLivestockRevenue, 'number');
  assert.equal(typeof financials.approvedExpenses, 'number');
  assert.equal(typeof financials.netFinancialPosition, 'number');
  assert.equal(typeof financials.totalNav, 'number');

  // Mathematical invariant check:
  // Net Financial Position = (Cash on Ground + Credit Sales Receivables + Loans Given) - Borrowed Debt
  const calculatedNetFin =
    financials.leftMoney +
    (financials.totalCreditSalesOutstanding || 0) +
    (financials.totalLoansGivenOutstanding || 0) -
    (financials.totalBorrowedDebtOutstanding || 0);

  assert.equal(
    Math.round(financials.netFinancialPosition || 0),
    Math.round(calculatedNetFin),
    'Net Financial Position must equal Cash + Receivables + Loans - Debt'
  );

  // Total NAV / Net Worth = (Cash + Receivables + Loans + Fixed Assets + Livestock Valuation) - Borrowed Debt
  const calculatedNav =
    financials.leftMoney +
    (financials.totalCreditSalesOutstanding || 0) +
    (financials.totalLoansGivenOutstanding || 0) +
    financials.totalFixedAssetsValue +
    financials.estimatedActiveLivestockValue -
    (financials.totalBorrowedDebtOutstanding || 0);

  assert.equal(
    Math.round(financials.totalNav || 0),
    Math.round(calculatedNav),
    'Total NAV must accurately include true cash, credit sales, loans given, fixed assets, livestock value less outstanding debt'
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
