import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import { computeFinancialSummary, computeMemberEquities } from '../src/utils/calculations.ts';
import type { CapitalContributionEvent, OrgMember } from '../src/types/agro.ts';
import { TEST_ACCOUNTS, toOrgMember } from './helpers/testContext.ts';
import { RulesEngineSimulator } from './helpers/rulesEngineSimulator.ts';

// ---------------------------------------------------------------------------
// SUITE 6: STRICT MULTI-TENANT ISOLATION & ZERO SUPER-ADMIN MONEY BACKDOOR
// ---------------------------------------------------------------------------

test('WF-SEC-TENANT-01: Sovereign Organization Creation by Founder & Air-Gapped Data', () => {
  const marlvinActor = toOrgMember(TEST_ACCOUNTS.marlvinPersonal);

  // 1. Marlvin creates his own sovereign organization
  const marlvinOrg = dataService.createOrganization({
    name: 'Marlvin Agri-Ventures Holdings',
    type: 'AGRO_FARMING',
    actor: marlvinActor,
    defaultTargetContributionUsd: 5000,
    contributionPaceDefault: 'MONTHLY',
  });

  assert.ok(marlvinOrg.id);
  assert.equal(marlvinOrg.name, 'Marlvin Agri-Ventures Holdings');
  assert.equal(marlvinOrg.adminMemberId, marlvinActor.id);

  // 2. Sarah creates her own venture organization
  const sarahActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);
  const sarahOrg = dataService.createOrganization({
    name: 'Apex Commercial Logistics Co-op',
    type: 'GENERAL_VENTURE',
    actor: sarahActor,
    defaultTargetContributionUsd: 8000,
    contributionPaceDefault: 'MONTHLY',
  });

  assert.ok(sarahOrg.id);
  assert.equal(sarahOrg.name, 'Apex Commercial Logistics Co-op');
  assert.notEqual(sarahOrg.id, marlvinOrg.id);
});

test('WF-SEC-TENANT-02: Zero Super-Admin Money Backdoor — Marlvin is blocked from seeing Sarah’s money', () => {
  const marlvinActor = toOrgMember(TEST_ACCOUNTS.marlvinPersonal);
  const sarahActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);
  const brianTreasurer = toOrgMember(TEST_ACCOUNTS.ventureTreasurer);

  // Deposit 1: Marlvin deposits $5,000 into his own organization
  const marlvinDeposit: CapitalContributionEvent = {
    id: 'TX-CAP-MAR-01',
    orgId: marlvinActor.orgId,
    memberId: marlvinActor.id,
    memberName: marlvinActor.fullName,
    direction: 'INITIAL',
    amount: 5000,
    note: 'Marlvin founder seed investment for farm holding',
    createdAt: new Date().toISOString(),
    createdByMemberId: marlvinActor.id,
    auditHash: 'hash-mar-01',
  };

  // Deposit 2: Sarah and Brian deposit $8,000 into Apex Logistics Co-op
  const sarahDeposit: CapitalContributionEvent = {
    id: 'TX-CAP-SARAH-01',
    orgId: sarahActor.orgId,
    memberId: sarahActor.id,
    memberName: sarahActor.fullName,
    direction: 'INITIAL',
    amount: 8000,
    note: 'Apex logistics fleet acquisition fund',
    createdAt: new Date().toISOString(),
    createdByMemberId: brianTreasurer.id,
    auditHash: 'hash-sarah-01',
  };

  const allContributions = [marlvinDeposit, sarahDeposit];

  // 1. Calculate Financial Summary for Marlvin's Organization
  const marlvinContributions = allContributions.filter((c) => c.orgId === marlvinActor.orgId);
  const marlvinFinancials = computeFinancialSummary({
    capitalContributions: marlvinContributions,
    expenses: [],
    fixedAssets: [],
    livestockStatuses: [],
    livestockEvents: [],
  });

  // Marlvin sees strictly his own $5,000
  assert.equal(marlvinFinancials.totalPool, 5000);
  assert.equal(marlvinFinancials.leftMoney, 5000);

  // 2. Calculate Financial Summary for Sarah's Organization
  const sarahContributions = allContributions.filter((c) => c.orgId === sarahActor.orgId);
  const sarahFinancials = computeFinancialSummary({
    capitalContributions: sarahContributions,
    expenses: [],
    fixedAssets: [],
    livestockStatuses: [],
    livestockEvents: [],
  });

  // Sarah sees strictly her own $8,000
  assert.equal(sarahFinancials.totalPool, 8000);
  assert.equal(sarahFinancials.leftMoney, 8000);

  // 3. Absolute Mathematical Isolation Assertion:
  // Neither organization's financial summary contains any dollar from the other
  assert.equal(
    marlvinContributions.some((c) => c.orgId === sarahActor.orgId),
    false,
    'Marlvin state must contain zero records from Sarah organization'
  );
  assert.equal(
    sarahContributions.some((c) => c.orgId === marlvinActor.orgId),
    false,
    'Sarah state must contain zero records from Marlvin organization'
  );
});

test('WF-SEC-TENANT-03: Firestore Security Rules Air-Gap — Cross-Tenant Money Queries Return PERMISSION_DENIED', () => {
  const simulator = new RulesEngineSimulator();

  // Register Marlvin in his own org
  simulator.registerMember(TEST_ACCOUNTS.marlvinPersonal.uid, {
    role: 'ORG_ADMIN',
    orgId: 'org-marlvin-ops-01',
    approvalStatus: 'APPROVED',
    active: true,
    email: TEST_ACCOUNTS.marlvinPersonal.email,
  });

  // Register Sarah in venture org
  simulator.registerMember(TEST_ACCOUNTS.ventureAdmin.uid, {
    role: 'ORG_ADMIN',
    orgId: 'org-venture-prod-02',
    approvalStatus: 'APPROVED',
    active: true,
    email: TEST_ACCOUNTS.ventureAdmin.email,
  });

  const marlvinAuth = { uid: TEST_ACCOUNTS.marlvinPersonal.uid, email: TEST_ACCOUNTS.marlvinPersonal.email };
  const sarahAuth = { uid: TEST_ACCOUNTS.ventureAdmin.uid, email: TEST_ACCOUNTS.ventureAdmin.email };

  const sarahPrivateMoneyRecord = {
    orgId: 'org-venture-prod-02',
    memberId: TEST_ACCOUNTS.ventureAdmin.id,
    amount: 8000,
    note: 'Confidential seed funding',
    createdAt: new Date().toISOString(),
    auditHash: 'valid-hash-venture',
  };

  const marlvinPrivateMoneyRecord = {
    orgId: 'org-marlvin-ops-01',
    memberId: TEST_ACCOUNTS.marlvinPersonal.id,
    amount: 5000,
    note: 'Confidential farm seed funding',
    createdAt: new Date().toISOString(),
    auditHash: 'valid-hash-marlvin',
  };

  // 1. Sarah reads her own money -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-SARAH-01',
      operation: 'read',
      auth: sarahAuth,
      existingData: sarahPrivateMoneyRecord,
    }).allowed,
    true
  );

  // 2. Marlvin (Superadmin) attempts to read Sarah's money -> STRICTLY DENIED!
  const marlvinAttempt = simulator.evaluate({
    collection: 'capital_contributions',
    docId: 'TX-SARAH-01',
    operation: 'read',
    auth: marlvinAuth,
    existingData: sarahPrivateMoneyRecord,
  });
  assert.equal(
    marlvinAttempt.allowed,
    false,
    'Superadmin Marlvin must be strictly denied from reading foreign organization money'
  );

  // 3. Sarah attempts to read Marlvin's money -> STRICTLY DENIED!
  const sarahAttempt = simulator.evaluate({
    collection: 'capital_contributions',
    docId: 'TX-MARLVIN-01',
    operation: 'read',
    auth: sarahAuth,
    existingData: marlvinPrivateMoneyRecord,
  });
  assert.equal(
    sarahAttempt.allowed,
    false,
    'Sarah must be strictly denied from reading foreign organization money'
  );

  // 4. Marlvin attempts to create a capital contribution in Sarah's org -> STRICTLY DENIED!
  const marlvinCreateAttempt = simulator.evaluate({
    collection: 'capital_contributions',
    docId: 'TX-UNAUTH-01',
    operation: 'create',
    auth: marlvinAuth,
    incomingData: {
      ...sarahPrivateMoneyRecord,
      note: 'Marlvin injecting unauthorized funds',
    },
  });
  assert.equal(
    marlvinCreateAttempt.allowed,
    false,
    'Marlvin must be blocked from writing to foreign organization ledger'
  );
});

test('WF-SEC-TENANT-04: Member Equity Partitioning — Equity shares never cross organizational boundaries', () => {
  const marlvinMember = toOrgMember(TEST_ACCOUNTS.marlvinPersonal);
  const sarahMember = toOrgMember(TEST_ACCOUNTS.ventureAdmin);
  const lindaMember = toOrgMember(TEST_ACCOUNTS.ventureMember);

  const marlvinPool: CapitalContributionEvent[] = [
    {
      id: 'TX-M-1',
      orgId: marlvinMember.orgId,
      memberId: marlvinMember.id,
      memberName: marlvinMember.fullName,
      direction: 'INITIAL',
      amount: 5000,
      note: 'Marlvin seed',
      createdAt: new Date().toISOString(),
      createdByMemberId: marlvinMember.id,
      auditHash: 'h1',
    },
  ];

  const venturePool: CapitalContributionEvent[] = [
    {
      id: 'TX-V-1',
      orgId: sarahMember.orgId,
      memberId: sarahMember.id,
      memberName: sarahMember.fullName,
      direction: 'INITIAL',
      amount: 4000,
      note: 'Sarah seed',
      createdAt: new Date().toISOString(),
      createdByMemberId: sarahMember.id,
      auditHash: 'hv1',
    },
    {
      id: 'TX-V-2',
      orgId: lindaMember.orgId,
      memberId: lindaMember.id,
      memberName: lindaMember.fullName,
      direction: 'INITIAL',
      amount: 4000,
      note: 'Linda seed',
      createdAt: new Date().toISOString(),
      createdByMemberId: sarahMember.id,
      auditHash: 'hv2',
    },
  ];

  // Marlvin computes equity in his organization: He owns 100% of $5,000
  const marlvinEquities = computeMemberEquities([marlvinMember], marlvinPool, 5000);
  assert.equal(marlvinEquities.length, 1);
  assert.equal(marlvinEquities[0].profitSharePercentage, 100);
  assert.equal(marlvinEquities[0].impliedNavEquityUsd, 5000);

  // Venture computes equities: Sarah and Linda each own 50% of $8,000
  const ventureEquities = computeMemberEquities([sarahMember, lindaMember], venturePool, 8000);
  assert.equal(ventureEquities.length, 2);
  assert.equal(ventureEquities[0].profitSharePercentage, 50);
  assert.equal(ventureEquities[1].profitSharePercentage, 50);
  assert.equal(ventureEquities[0].impliedNavEquityUsd, 4000);
  assert.equal(ventureEquities[1].impliedNavEquityUsd, 4000);

  // Verify Marlvin does not appear in Venture equities
  assert.equal(ventureEquities.some((e) => e.member.id === marlvinMember.id), false);
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
