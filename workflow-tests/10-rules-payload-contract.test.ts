import test from 'node:test';
import assert from 'node:assert/strict';
import { RulesEngineSimulator } from './helpers/rulesEngineSimulator.ts';
import { TEST_ACCOUNTS } from './helpers/testContext.ts';

// ---------------------------------------------------------------------------
// SUITE 10: FIRESTORE RULES PAYLOAD CONTRACT SUITE
// Asserts that form sheet mutation payloads pass RulesEngineSimulator validation
// ---------------------------------------------------------------------------

const simulator = new RulesEngineSimulator();

simulator.registerMember(TEST_ACCOUNTS.agroAdmin.uid, {
  role: TEST_ACCOUNTS.agroAdmin.role,
  approvalStatus: TEST_ACCOUNTS.agroAdmin.approvalStatus,
  active: TEST_ACCOUNTS.agroAdmin.active,
  email: TEST_ACCOUNTS.agroAdmin.email,
  orgId: TEST_ACCOUNTS.agroAdmin.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.agroTreasurer.uid, {
  role: TEST_ACCOUNTS.agroTreasurer.role,
  approvalStatus: TEST_ACCOUNTS.agroTreasurer.approvalStatus,
  active: TEST_ACCOUNTS.agroTreasurer.active,
  email: TEST_ACCOUNTS.agroTreasurer.email,
  orgId: TEST_ACCOUNTS.agroTreasurer.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.agroMember.uid, {
  role: TEST_ACCOUNTS.agroMember.role,
  approvalStatus: TEST_ACCOUNTS.agroMember.approvalStatus,
  active: TEST_ACCOUNTS.agroMember.active,
  email: TEST_ACCOUNTS.agroMember.email,
  orgId: TEST_ACCOUNTS.agroMember.orgId,
});

const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
const orgId = TEST_ACCOUNTS.agroAdmin.orgId!;

test('WF-RULE-01: credit_sales Payload Contract — accepts both totalSaleAmount and totalAmount', () => {
  const validPayload1 = {
    id: 'CSALE-001',
    orgId,
    locationId: 'LOC-001',
    customerName: 'Chipo Moyo',
    totalSaleAmount: 120.0,
    creditBalanceRemaining: 80.0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const validPayload2 = {
    id: 'CSALE-002',
    orgId,
    locationId: 'LOC-001',
    customerName: 'Kudzi Dube',
    totalAmount: 150.0,
    creditBalanceRemaining: 100.0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Both payloads must pass for authenticated member
  const res1 = simulator.evaluate({
    collection: 'credit_sales',
    docId: 'CSALE-001',
    operation: 'create',
    auth: adminAuth,
    incomingData: validPayload1,
  });
  assert.equal(res1.allowed, true, 'credit_sales with totalSaleAmount must pass security rules');

  const res2 = simulator.evaluate({
    collection: 'credit_sales',
    docId: 'CSALE-002',
    operation: 'create',
    auth: memberAuth,
    incomingData: validPayload2,
  });
  assert.equal(res2.allowed, true, 'credit_sales with totalAmount must pass security rules');

  // Negative or zero amount must be rejected
  const invalidPayload = {
    ...validPayload1,
    totalSaleAmount: -10,
  };
  const res3 = simulator.evaluate({
    collection: 'credit_sales',
    docId: 'CSALE-003',
    operation: 'create',
    auth: adminAuth,
    incomingData: invalidPayload,
  });
  assert.equal(res3.allowed, false, 'Negative credit sale amount must be rejected by rules');
});

test('WF-RULE-02: debt_liabilities & loans_given Payload Contract', () => {
  const validDebt = {
    id: 'DEBT-001',
    orgId,
    creditorName: 'Agro Supply Ltd',
    principalAmount: 500.0,
    remainingBalance: 500.0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const validLoan = {
    id: 'LOAN-001',
    orgId,
    borrowerName: 'John Operator',
    principalAmount: 200.0,
    remainingRecoverableAmount: 200.0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Admin creating debt/loan allowed
  assert.equal(
    simulator.evaluate({
      collection: 'debt_liabilities',
      docId: 'DEBT-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validDebt,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'loans_given',
      docId: 'LOAN-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validLoan,
    }).allowed,
    true
  );

  // Unauthenticated creation rejected
  assert.equal(
    simulator.evaluate({
      collection: 'debt_liabilities',
      docId: 'DEBT-001',
      operation: 'create',
      auth: null,
      incomingData: validDebt,
    }).allowed,
    false
  );
});

test('WF-RULE-03: expense_ledger and feed_ledger Payloads Contract', () => {
  const validExpense = {
    id: 'EXP-001',
    orgId,
    locationId: 'LOC-001',
    amount: 75.0,
    category: 'VACCINE_MEDICATION',
    note: 'Purchased 2 vials Newcastle vaccine booster',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString(),
    auditHash: 'hash-abc-123',
  };

  const validFeed = {
    id: 'FEED-001',
    orgId,
    locationId: 'LOC-001',
    feedType: 'Broiler Starter Crumbles',
    bagsDelta: 10,
    direction: 'STOCK_IN',
    note: 'Received 10 bags feed shipment',
    createdAt: new Date().toISOString(),
    auditHash: 'hash-feed-456',
  };

  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'EXP-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validExpense,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'feed_ledger',
      docId: 'FEED-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validFeed,
    }).allowed,
    true
  );
});

test('WF-RULE-04: livestock_entries & livestock_lifecycle_events Contract', () => {
  const validLivestock = {
    id: 'LSTK-001',
    orgId,
    locationId: 'LOC-001',
    species: 'Broilers',
    nameOrTag: 'Broiler Batch #08',
    initialHeadcount: 100,
    entryDate: new Date().toISOString(),
    targetSaleDate: new Date(Date.now() + 42 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  const validLifecycleEvent = {
    id: 'EVT-001',
    orgId,
    livestockId: 'LSTK-001',
    eventType: 'MORTALITY_LOSS',
    headcountDelta: -2,
    note: '2 birds lost to cold shock',
    createdAt: new Date().toISOString(),
    auditHash: 'hash-evt-789',
  };

  assert.equal(
    simulator.evaluate({
      collection: 'livestock_entries',
      docId: 'LSTK-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validLivestock,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'livestock_lifecycle_events',
      docId: 'EVT-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validLifecycleEvent,
    }).allowed,
    true
  );
});

test('WF-RULE-05: runway_plans & runway_pledges Contract', () => {
  const validPlan = {
    id: 'PLN-001',
    orgId,
    name: 'Winter Wheat Irrigation Runway',
    status: 'ACTIVE',
    targetAmount: 5000,
    createdAt: new Date().toISOString(),
  };

  const validPledge = {
    id: 'PLG-001',
    orgId,
    planId: 'PLN-001',
    memberId: TEST_ACCOUNTS.agroMember.uid,
    amount: 1000,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  assert.equal(
    simulator.evaluate({
      collection: 'runway_plans',
      docId: 'PLN-001',
      operation: 'create',
      auth: adminAuth,
      incomingData: validPlan,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'runway_pledges',
      docId: 'PLG-001',
      operation: 'create',
      auth: memberAuth,
      incomingData: validPledge,
    }).allowed,
    true
  );
});
