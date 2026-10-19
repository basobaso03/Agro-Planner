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

test('Seeded Syndicate Pool & Member Equity Shares sum to $5,000 and 100%', () => {
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

  assert.equal(financials.totalSyndicatePool, 5000);
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
    financials.totalSyndicateNav
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
});
