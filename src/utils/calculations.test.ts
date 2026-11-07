import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertToDays,
  computeLivestockStatus,
  computeFinancialSummary,
  computeMemberEquities,
  computeFixedAssetGroups,
  computeDividendDistribution,
} from './calculations.ts';
import {
  computeAuditEventHash,
  verifyAuditChainIntegrity,
  GENESIS_SHORT,
} from './cryptoHash.ts';
import { createInitialSeedSnapshot } from '../data/seedData.ts';

test('Universal Duration Conversion converts DAYS, WEEKS, MONTHS, YEARS accurately', () => {
  assert.equal(convertToDays(42, 'DAYS'), 42);
  assert.equal(convertToDays(6, 'WEEKS'), 42);
  assert.equal(convertToDays(8, 'MONTHS'), 8 * 30.4375);
  assert.equal(convertToDays(2, 'YEARS'), 730.5);
});

test('Seeded Organization Pool & Member Equity Shares sum to $5,000 and 100%', () => {
  const seed = createInitialSeedSnapshot(new Date('2026-10-17T12:00:00Z'));
  const livestockStatuses = seed.livestockEntries.map((entry) =>
    computeLivestockStatus(entry, seed.livestockEvents, seed.feedLedger, '2026-10-17T12:00:00Z')
  );
  const financials = computeFinancialSummary({
    capitalContributions: seed.capitalContributions,
    expenses: seed.expenses,
    fixedAssets: seed.fixedAssets,
    livestockStatuses,
    livestockEvents: seed.livestockEvents,
  });

  assert.equal(financials.totalPool, 5000);
  // Approved expenses: 850 + 320 + 270 + 640 + 45 + 450 - 300 (contra) + 140 = 2415
  assert.equal(financials.approvedExpenses, 2415);
  // Pending multi-sig expense: 280
  assert.equal(financials.pendingMultiSigExpenses, 280);
  // Left Money = 5000 - 2415 = 2585
  assert.equal(financials.leftMoney, 2585);
  // Fixed assets: 1200 + 850 + 650 + 240 = 2940
  assert.equal(financials.totalFixedAssetsValue, 2940);

  const equities = computeMemberEquities(
    seed.members,
    seed.capitalContributions,
    financials.totalNav
  );

  const chipo = equities.find((e) => e.member.id === 'mem-chipo')!;
  const tendai = equities.find((e) => e.member.id === 'mem-tendai')!;
  const kudzi = equities.find((e) => e.member.id === 'mem-kudzi')!;
  const tafadzwa = equities.find((e) => e.member.id === 'mem-tafadzwa')!;

  assert.equal(chipo.netContribution, 2000);
  assert.equal(chipo.profitSharePercentage, 40);

  assert.equal(tendai.netContribution, 1200);
  assert.equal(tendai.profitSharePercentage, 24);

  assert.equal(kudzi.netContribution, 1000);
  assert.equal(kudzi.profitSharePercentage, 20);

  assert.equal(tafadzwa.netContribution, 800);
  assert.equal(tafadzwa.profitSharePercentage, 16);

  // Dividend payout for $2,500 profit
  const payouts = computeDividendDistribution(2500, equities);
  const chipoPayout = payouts.find((p) => p.memberId === 'mem-chipo')!;
  const tendaiPayout = payouts.find((p) => p.memberId === 'mem-tendai')!;
  assert.equal(chipoPayout.payoutUsd, 1000);
  assert.equal(tendaiPayout.payoutUsd, 600);
});

test('Livestock Age, Countdown Badges & Append-Only Headcount Aggregation work accurately', () => {
  const refNow = new Date('2026-10-17T12:00:00Z');
  const seed = createInitialSeedSnapshot(refNow);

  const broiler12 = seed.livestockEntries.find((l) => l.id === 'LSTK-BROILER-12')!;
  const status12 = computeLivestockStatus(
    broiler12,
    seed.livestockEvents,
    seed.feedLedger,
    refNow.toISOString()
  );
  // 300 initial - 4 mortalities = 296 live
  assert.equal(status12.currentLiveHeadcount, 296);
  assert.equal(status12.daysOnFarm, 29);
  assert.equal(status12.daysLeftUntilSale, 13);
  assert.equal(status12.countdownUrgency, 'NORMAL');
  assert.equal(status12.mortalityRatePercent, 1.33);

  const boerHerd = seed.livestockEntries.find((l) => l.id === 'LSTK-BOER-HERD-01')!;
  const statusBoer = computeLivestockStatus(
    boerHerd,
    seed.livestockEvents,
    seed.feedLedger,
    refNow.toISOString()
  );
  // 15 initial + 3 kids born = 18 live
  assert.equal(statusBoer.currentLiveHeadcount, 18);
  assert.equal(statusBoer.totalBirths, 3);
  assert.equal(statusBoer.daysLeftUntilSale, 76);

  const broiler11 = seed.livestockEntries.find((l) => l.id === 'LSTK-BROILER-11')!;
  const status11 = computeLivestockStatus(
    broiler11,
    seed.livestockEvents,
    seed.feedLedger,
    refNow.toISOString()
  );
  // 200 initial - 3 mortalities = 197 live, 41 days old -> 1 day left
  assert.equal(status11.currentLiveHeadcount, 197);
  assert.equal(status11.daysLeftUntilSale, 1);
  assert.equal(status11.countdownUrgency, 'PREPARE_MARKET');
});

test('Cryptographic SHA-256 Audit Chain Verifier validates intact chain and detects tampering', () => {
  const seed = createInitialSeedSnapshot(new Date('2026-10-17T12:00:00Z'));
  const verification = verifyAuditChainIntegrity(seed.auditNotifications);

  assert.equal(verification.valid, true);
  assert.equal(verification.totalBlocksChecked, 8);
  assert.equal(verification.genesisHash, GENESIS_SHORT);

  // Simulate an attacker trying to tamper with an event message in memory
  const tampered = seed.auditNotifications.map((ev) =>
    ev.sequenceNumber === 5 ? { ...ev, message: 'Tampered expense amount $10' } : ev
  );
  const tamperedVerification = verifyAuditChainIntegrity(tampered);
  assert.equal(tamperedVerification.valid, false);
  assert.equal(tamperedVerification.brokenAtSequence, 5);
});

test('Fixed Asset Aggregation groups by assetGroupId and locationId accurately', () => {
  const seed = createInitialSeedSnapshot(new Date('2026-10-17T12:00:00Z'));
  const groups = computeFixedAssetGroups(seed.fixedAssets, seed.locations, 'ALL');
  assert.equal(groups.length, 4);
  const totalVal = groups.reduce((acc, g) => acc + g.currentValue, 0);
  assert.equal(totalVal, 2940);
});

test('Livestock Growth Trajectory & Herd Biomass calculates milestones and projections', async () => {
  const { generateGrowthProjectionData, computeHerdBiomassSummary, computeFcrTelemetry } = await import('./livestockProjections.ts');
  const seed = createInitialSeedSnapshot(new Date('2026-10-17T12:00:00Z'));
  const statuses = seed.livestockEntries.map((entry) =>
    computeLivestockStatus(entry, seed.livestockEvents, seed.feedLedger, '2026-10-17T12:00:00Z')
  );

  const broiler12 = statuses.find((s) => s.entry.id === 'LSTK-BROILER-12')!;
  assert.ok(broiler12);

  const proj = generateGrowthProjectionData(broiler12);
  assert.ok(proj.points.length > 5);
  assert.ok(proj.currentWeightKg > 0);
  assert.equal(proj.targetWeightKg, 2.2);
  assert.ok(proj.weightGainRateGramsPerDay > 0);

  const fcr = computeFcrTelemetry(broiler12);
  assert.ok(fcr.fcr > 0);
  assert.ok(fcr.totalBiomassKg > 0);

  const biomass = computeHerdBiomassSummary(statuses);
  assert.equal(biomass.length, statuses.length);
  const totalBiomassKg = biomass.reduce((sum, b) => sum + b.totalBiomassKg, 0);
  assert.ok(totalBiomassKg > 500);

  // Checkpoint & Broiler Lifecycle Verification
  assert.equal(broiler12.protocols.length, 12, 'Broiler protocols should contain all 12 practical lifecycle stages');
  for (const proto of broiler12.protocols) {
    assert.ok(proto.scheduledDate, `Protocol ${proto.title} must have scheduledDate`);
    assert.equal(proto.dispatchTime, '07:00 AM', `Protocol ${proto.title} must have 07:00 AM dispatch time`);
    assert.ok(proto.dispatchIso, `Protocol ${proto.title} must have dispatchIso`);
    assert.ok(!proto.title.toLowerCase().includes('gumboro'), `Protocol title "${proto.title}" must not contain "Gumboro"`);
    assert.ok(!proto.description?.toLowerCase().includes('gumboro'), `Protocol description must not contain "Gumboro"`);
  }

  // Check specific phases exist
  const day1 = broiler12.protocols.find((p) => p.dayTarget === 1)!;
  const day4 = broiler12.protocols.find((p) => p.dayTarget === 4)!;
  const day11 = broiler12.protocols.find((p) => p.dayTarget === 11)!;
  const day14 = broiler12.protocols.find((p) => p.dayTarget === 14)!;
  const day25 = broiler12.protocols.find((p) => p.dayTarget === 25)!;
  const day28 = broiler12.protocols.find((p) => p.dayTarget === 28)!;
  const day32 = broiler12.protocols.find((p) => p.dayTarget === 32)!;
  const day38 = broiler12.protocols.find((p) => p.dayTarget === 38)!;

  assert.ok(day1 && day1.feedPhase?.includes('Starter Crumbles'));
  assert.ok(day4 && day4.title.includes('Starter Period'));
  assert.ok(day11 && day11.title.includes('Starter to Grower'));
  assert.ok(day14 && day14.title.includes('IBD Intermediate') && !day14.title.includes('Gumboro'));
  assert.ok(day25 && day25.title.includes('Grower to Finisher'));
  assert.ok(day28 && day28.title.includes('100% Finisher'));
  assert.ok(day32 && day32.title.includes('Medication Withdrawal'));
  assert.ok(day38 && day38.title.includes('Harvest'));

  // Verify odd-day checkpoints are not clipped from projection points
  const projDays = new Set(proj.points.map((pt) => pt.day));
  assert.ok(projDays.has(1), 'Day 1 checkpoint point must be in projection');
  assert.ok(projDays.has(7), 'Day 7 checkpoint point must be in projection');
  assert.ok(projDays.has(11), 'Day 11 checkpoint point must be in projection');
  assert.ok(projDays.has(21), 'Day 21 checkpoint point must be in projection');
  assert.ok(projDays.has(35), 'Day 35 checkpoint point must be in projection');
});

test('Move-in Date & strict days left accurately calculates animal age and countdown for existing stock', () => {
  // Scenario: A farmer bought 100 chicks 10 days ago (Move-in date: 2026-10-07T07:00:00Z)
  // Target cycle: 35 days
  // Calculation date: 2026-10-17T07:00:00Z (exactly 10 days later)
  const existingFlock: any = {
    id: 'LSTK-TEST-FLOCK',
    locationId: 'loc-1',
    locationName: 'Test Farm',
    species: 'Broilers',
    nameOrTag: 'Existing Flock #1',
    trackingMode: 'BATCH',
    entryDate: '2026-10-07T07:00:00Z',
    initialAgeValue: 0,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 35,
    targetDurationUnit: 'DAYS',
    targetSaleDate: '2026-11-11T07:00:00Z',
    initialHeadcount: 100,
    purchaseCostTotal: 95,
    notes: 'Existing stock brought 10 days ago',
    createdByMemberName: 'Farmer Joe',
    createdAt: '2026-10-07T07:00:00Z',
  };

  const status = computeLivestockStatus(existingFlock, [], [], '2026-10-17T07:00:00Z');
  assert.equal(status.daysOnFarm, 10, 'Must strictly calculate 10 days on farm from move-in date');
  assert.equal(status.currentTotalAgeDays, 10, 'Total animal age must be 10 days');
  assert.equal(status.daysLeftUntilSale, 25, 'Must strictly calculate 25 days remaining (35 - 10)');
  assert.equal(status.progressPercentage, 29, 'Progress should be 29% (10/35)');

  // Verify Day 14 milestone reminder status is SCHEDULED (since age is 10)
  const day14Proto = status.protocols.find((p) => p.dayTarget === 14)!;
  assert.equal(day14Proto.reminderStatus, 'SCHEDULED');
  assert.equal(day14Proto.completed, false);

  // Verify Day 7 milestone status: since no log was recorded and day 7 is in the past, it is OVERDUE
  const day7Proto = status.protocols.find((p) => p.dayTarget === 7)!;
  assert.equal(day7Proto.completed, false);
  assert.equal(day7Proto.reminderStatus, 'OVERDUE');

  // Verify that when a vaccine event IS logged for Day 7, it is COMPLETED
  const loggedStatus = computeLivestockStatus(
    existingFlock,
    [
      {
        id: 'EV-1',
        livestockId: existingFlock.id,
        livestockName: existingFlock.nameOrTag,
        locationId: existingFlock.locationId,
        eventType: 'VACCINATION_HEALTH',
        headcountDelta: 0,
        note: 'Day 7 Newcastle B1 administered in drinking water',
        loggedByName: 'Farmer Joe',
        createdAt: '2026-10-14T07:00:00Z',
        auditHash: 'hash-1',
      },
    ],
    [],
    '2026-10-17T07:00:00Z'
  );
  const loggedDay7 = loggedStatus.protocols.find((p) => p.dayTarget === 7)!;
  assert.equal(loggedDay7.completed, true);
  assert.equal(loggedDay7.reminderStatus, 'COMPLETED');
});

test('Member Target Capital Contribution: calculates progress percentage, remaining balance, and goal met status', () => {
  const memberA: any = {
    id: 'mem-progress-a',
    fullName: 'Investor Alice',
    phoneOrEmail: 'alice@test.com',
    role: 'MEMBER',
    targetContributionUsd: 1000,
    contributionPace: 'MONTHLY',
    active: true,
    joinedAt: '2026-10-01T00:00:00Z',
  };

  const memberB: any = {
    id: 'mem-progress-b',
    fullName: 'Investor Bob',
    phoneOrEmail: 'bob@test.com',
    role: 'MEMBER',
    targetContributionUsd: 1500,
    contributionPace: 'MILESTONE',
    active: true,
    joinedAt: '2026-10-01T00:00:00Z',
  };

  const contributions: any[] = [
    // Alice deposited $600 of $1,000 target -> 60% progress, $400 remaining
    {
      id: 'c-1',
      memberId: 'mem-progress-a',
      amount: 600,
      direction: 'INITIAL',
      createdAt: '2026-10-01T00:00:00Z',
    },
    // Bob deposited $1,500 of $1,500 target -> 100% progress, $0 remaining, goal met
    {
      id: 'c-2',
      memberId: 'mem-progress-b',
      amount: 1500,
      direction: 'INITIAL',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];

  const equities = computeMemberEquities([memberA, memberB], contributions, 2100);

  const alice = equities.find((e) => e.member.id === 'mem-progress-a')!;
  assert.equal(alice.netContribution, 600);
  assert.equal(alice.targetContributionUsd, 1000);
  assert.equal(alice.progressPercentage, 60);
  assert.equal(alice.remainingToTargetUsd, 400);
  assert.equal(alice.isGoalMet, false);
  assert.equal(alice.contributionPace, 'MONTHLY');

  const bob = equities.find((e) => e.member.id === 'mem-progress-b')!;
  assert.equal(bob.netContribution, 1500);
  assert.equal(bob.targetContributionUsd, 1500);
  assert.equal(bob.progressPercentage, 100);
  assert.equal(bob.remainingToTargetUsd, 0);
  assert.equal(bob.isGoalMet, true);
  assert.equal(bob.contributionPace, 'MILESTONE');
});

test('Debt and Loan Interest calculations: verifies Cash on Ground and Net Worth behavior', () => {
  // Borrowing $1,000 cash at 10% interest -> Cash increases by $1,000, Total debt balance owed is $1,100
  // Disbursing $500 loan at 20% interest -> Cash decreases by $500, Total loan receivable is $600
  const initialPool: any[] = [
    {
      id: 'c-test-1',
      memberId: 'mem-1',
      amount: 2000,
      direction: 'INITIAL' as const,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];

  const debtLiabilities: any[] = [
    {
      id: 'debt-test-1',
      creditorName: 'AgriBank',
      category: 'EXTERNAL_LOAN',
      principalAmount: 1000,
      remainingBalance: 1100, // $1,000 + 10% interest
      interestRatePercent: 10,
      status: 'OUTSTANDING',
      repayments: [],
    },
  ];

  const loansGiven: any[] = [
    {
      id: 'loan-test-1',
      borrowerName: 'Partner Grower',
      category: 'OUTGROWER_ADVANCE',
      principalAmount: 500,
      remainingBalance: 600, // $500 + 20% interest
      interestRatePercent: 20,
      status: 'ACTIVE',
      repayments: [],
    },
  ];

  const fin = computeFinancialSummary({
    capitalContributions: initialPool,
    expenses: [],
    fixedAssets: [],
    livestockStatuses: [],
    livestockEvents: [],
    debtLiabilities,
    loansGiven,
  });

  // Cash on Ground = Initial Pool ($2,000) + Borrowed Cash ($1,000) - Disbursed Loan ($500) = $2,500
  assert.equal(fin.leftMoney, 2500);

  // Total Borrowed Debt Outstanding = $1,100 (includes interest)
  assert.equal(fin.totalBorrowedDebtOutstanding, 1100);

  // Total Loans Given Outstanding = $600 (includes interest)
  assert.equal(fin.totalLoansGivenOutstanding, 600);

  // Total NAV = Left Money ($2,500) + Loans Receivable ($600) - Debt Liabilities ($1,100) = $2,000
  assert.equal(fin.totalNav, 2000);
});

