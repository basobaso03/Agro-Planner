import type {
  CapitalContributionEvent,
  CountdownUrgency,
  DurationUnit,
  ExpenseLedgerEvent,
  FarmLocation,
  FeedInventorySummary,
  FeedLedgerEvent,
  FinancialSummary,
  FixedAssetGroupSummary,
  FixedAssetLedgerEvent,
  LivestockComputedStatus,
  LivestockEntry,
  LivestockLifecycleEvent,
  MemberEquitySummary,
  ProtocolMilestone,
  SiteComparisonSummary,
  SyndicateMember,
} from '../types/agro.ts';

const MS_PER_DAY = 86_400_000;

/**
 * 3. Universal Duration Conversion to exact days:
 * 1 DAY = 1 day
 * 1 WEEK = 7 days
 * 1 MONTH = 30.4375 days
 * 1 YEAR = 365.25 days
 */
export function convertToDays(value: number, unit: DurationUnit): number {
  switch (unit) {
    case 'DAYS':
      return value;
    case 'WEEKS':
      return value * 7;
    case 'MONTHS':
      return value * 30.4375;
    case 'YEARS':
      return value * 365.25;
  }
}

export function computeTargetSaleDate(
  entryDateIso: string,
  targetDurationValue: number,
  targetDurationUnit: DurationUnit
): string {
  const entryMs = new Date(entryDateIso).getTime();
  const targetDays = convertToDays(targetDurationValue, targetDurationUnit);
  const targetMs = entryMs + Math.round(targetDays * MS_PER_DAY);
  return new Date(targetMs).toISOString();
}

export function formatAnimalAge(totalDays: number, preferredUnit: DurationUnit): string {
  const roundedDays = Math.max(0, Math.floor(totalDays));
  if (preferredUnit === 'DAYS' || preferredUnit === 'WEEKS' || roundedDays < 60) {
    const weeks = Math.floor(roundedDays / 7);
    const remDays = roundedDays % 7;
    if (weeks === 0) {
      return `Day ${roundedDays}`;
    }
    return `Day ${roundedDays} (${weeks} wk${weeks !== 1 ? 's' : ''}${remDays > 0 ? ` ${remDays}d` : ''})`;
  }
  if (preferredUnit === 'MONTHS' || preferredUnit === 'YEARS' || roundedDays < 540) {
    let months = Math.floor(roundedDays / 30.4375);
    let remDays = Math.max(0, Math.round(roundedDays - months * 30.4375));
    if (remDays >= 30) {
      months += 1;
      remDays = 0;
    }
    if (remDays === 0) {
      return `${months} Month${months !== 1 ? 's' : ''} Old`;
    }
    return `${months} Month${months !== 1 ? 's' : ''} ${remDays} Day${remDays !== 1 ? 's' : ''}`;
  }
  const years = Math.floor(roundedDays / 365.25);
  const remMonths = Math.floor((roundedDays - years * 365.25) / 30.4375);
  return `${years} Yr${years !== 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} Mo` : ''} (${roundedDays}d)`;
}

export function generateVaccinationProtocols(
  entry: LivestockEntry,
  currentTotalAgeDays: number,
  lifecycleEvents: LivestockLifecycleEvent[]
): ProtocolMilestone[] {
  const vaxEvents = lifecycleEvents.filter(
    (e) => e.eventType === 'VACCINATION_HEALTH' || e.eventType === 'WEIGHT_CHECK'
  );
  const lowerSpecies = entry.species.toLowerCase();

  let templates: { dayTarget: number; title: string; category: ProtocolMilestone['category'] }[] = [];

  if (lowerSpecies.includes('broiler') || lowerSpecies.includes('chicken') || lowerSpecies.includes('layer') || lowerSpecies.includes('poultry')) {
    templates = [
      { dayTarget: 1, title: 'Day 1: Stress Pack + Brooder Temp Check (33°C)', category: 'BIOSECURITY' },
      { dayTarget: 7, title: 'Day 7: Newcastle Disease (Hitchner B1) Eye-Drop', category: 'VACCINE' },
      { dayTarget: 14, title: 'Day 14: Gumboro (IBD Intermediate) Drinking Water', category: 'VACCINE' },
      { dayTarget: 15, title: 'Day 15: Switch Starter Crumbles to Grower Mash', category: 'FEED_TRANSITION' },
      { dayTarget: 21, title: 'Day 21: Newcastle (LaSota) + Gumboro Booster', category: 'VACCINE' },
      { dayTarget: 28, title: 'Day 28: Switch Grower to Finisher Mash + Sample Weigh-In', category: 'FEED_TRANSITION' },
      { dayTarget: 35, title: 'Day 35: Pre-Market Weight Check & Buyer Booking', category: 'WEIGHT_CHECK' },
    ];
  } else if (lowerSpecies.includes('goat') || lowerSpecies.includes('sheep')) {
    templates = [
      { dayTarget: 14, title: 'Quarantine & Footbath Dip Inspection', category: 'BIOSECURITY' },
      { dayTarget: 30, title: 'Pulpy Kidney (Enterotoxaemia) & Tetanus Vaccine', category: 'VACCINE' },
      { dayTarget: 90, title: 'Quarterly Broad-Spectrum Deworming (Albendazole/Ivermectin)', category: 'VACCINE' },
      { dayTarget: 150, title: 'Mid-Cycle Body Condition & Weight Check', category: 'WEIGHT_CHECK' },
      { dayTarget: 210, title: 'Pre-Market Finishing Supplement Transition', category: 'FEED_TRANSITION' },
    ];
  } else if (lowerSpecies.includes('zebra') || lowerSpecies.includes('wildlife') || lowerSpecies.includes('game') || lowerSpecies.includes('ostrich') || lowerSpecies.includes('antelope')) {
    templates = [
      { dayTarget: 7, title: 'Day 7: Arrival Quarantine & Pasture Acclimatization Inspection', category: 'BIOSECURITY' },
      { dayTarget: 30, title: 'Day 30: Multivalent Clostridial / Anthrax Vaccine & Tick Dip Check', category: 'VACCINE' },
      { dayTarget: 90, title: 'Day 90: Seasonal Deworming & Mineral Lick Block Placement', category: 'FEED_TRANSITION' },
      { dayTarget: 180, title: 'Day 180: Bi-Annual Herd Condition Assessment & Microchip/Tag Audit', category: 'WEIGHT_CHECK' },
      { dayTarget: 360, title: 'Day 360: Annual Wildlife Census & Veterinary Health Clearance', category: 'BIOSECURITY' },
    ];
  } else if (lowerSpecies.includes('pig') || lowerSpecies.includes('swine')) {
    templates = [
      { dayTarget: 3, title: 'Day 3: Iron Dextran Injection & Needle Teeth Check', category: 'BIOSECURITY' },
      { dayTarget: 21, title: 'Day 21: Mycoplasma & Circovirus (PCV2) Vaccination', category: 'VACCINE' },
      { dayTarget: 28, title: 'Day 28: Weaning & Creep Feed Transition to Weaner Pellets', category: 'FEED_TRANSITION' },
      { dayTarget: 75, title: 'Day 75: Grower Mash Transition & Internal Parasite Control', category: 'FEED_TRANSITION' },
      { dayTarget: 150, title: 'Day 150: Finisher Weight Check & Market Booking', category: 'WEIGHT_CHECK' },
    ];
  } else {
    templates = [
      { dayTarget: 7, title: 'Arrival Quarantine & Ear-Tag Verification', category: 'BIOSECURITY' },
      { dayTarget: 30, title: 'Anthrax / Blackleg / Multivalent Vaccination', category: 'VACCINE' },
      { dayTarget: 90, title: 'Tick Dipping & Internal Parasite Drenching', category: 'VACCINE' },
      { dayTarget: 180, title: 'Bi-Annual Weight & Growth Curve Assessment', category: 'WEIGHT_CHECK' },
    ];
  }

  return templates.map((tpl, idx) => {
    const matchingEvent = vaxEvents.find((ev) =>
      ev.note.toLowerCase().includes(tpl.title.split(':')[1]?.trim().split(' ')[0]?.toLowerCase() || '__none__')
    );
    const autoDoneByAge = currentTotalAgeDays > tpl.dayTarget + 3;
    const completed = Boolean(matchingEvent) || autoDoneByAge;
    return {
      id: `${entry.id}-proto-${idx + 1}`,
      dayTarget: tpl.dayTarget,
      title: tpl.title,
      category: tpl.category,
      completed,
      completedNote: matchingEvent?.note || (autoDoneByAge ? 'Completed on schedule per site log' : undefined),
      completedAt: matchingEvent?.createdAt,
    };
  });
}

/**
 * 3 & 4. Universal Duration Conversion, Real-Time Animal Age / Sale Countdown & Live Headcount
 */
export function computeLivestockStatus(
  entry: LivestockEntry,
  allLifecycleEvents: LivestockLifecycleEvent[],
  allFeedEvents: FeedLedgerEvent[],
  nowIso: string = new Date().toISOString()
): LivestockComputedStatus {
  const nowMs = new Date(nowIso).getTime();
  const entryMs = new Date(entry.entryDate).getTime();

  const initialAgeDays = convertToDays(entry.initialAgeValue, entry.initialAgeUnit);
  const daysOnFarm = Math.max(0, Math.floor((nowMs - entryMs) / MS_PER_DAY));
  const currentTotalAgeDays = initialAgeDays + daysOnFarm;

  const targetDurationDays = convertToDays(entry.targetDurationValue, entry.targetDurationUnit);
  const targetSaleMs = entryMs + Math.round(targetDurationDays * MS_PER_DAY);
  const daysLeftUntilSale = Math.ceil((targetSaleMs - nowMs) / MS_PER_DAY);

  const progressPercentage = Math.min(
    100,
    Math.max(0, Math.round((daysOnFarm / Math.max(1, targetDurationDays)) * 100))
  );

  let countdownUrgency: CountdownUrgency = 'NORMAL';
  let countdownBadgeText = `${daysLeftUntilSale} Days Left to Sale`;

  if (daysLeftUntilSale <= 0) {
    countdownUrgency = 'READY_FOR_SALE';
    countdownBadgeText =
      daysLeftUntilSale === 0
        ? 'READY FOR SALE (Target Reached)'
        : `READY FOR SALE (+${Math.abs(daysLeftUntilSale)}d Past Target)`;
  } else if (daysLeftUntilSale <= 7) {
    countdownUrgency = 'PREPARE_MARKET';
    countdownBadgeText = `${daysLeftUntilSale} Day${daysLeftUntilSale === 1 ? '' : 's'} Left — Prepare Market!`;
  }

  const eventsForLivestock = allLifecycleEvents
    .filter((ev) => ev.livestockId === entry.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Append-Only Headcount Aggregation:
  // If there is an explicit INITIAL_STOCK event, sum all headcountDelta; otherwise start from entry.initialHeadcount + non-INITIAL_STOCK deltas
  const hasInitialStockEvent = eventsForLivestock.some((e) => e.eventType === 'INITIAL_STOCK');
  const sumAllDeltas = eventsForLivestock.reduce((acc, ev) => acc + ev.headcountDelta, 0);
  const currentLiveHeadcount = Math.max(
    0,
    hasInitialStockEvent ? sumAllDeltas : entry.initialHeadcount + sumAllDeltas
  );

  const totalMortalities = eventsForLivestock
    .filter((e) => e.eventType === 'MORTALITY_LOSS')
    .reduce((acc, ev) => acc + Math.abs(ev.headcountDelta), 0);

  const totalBirths = eventsForLivestock
    .filter((e) => e.eventType === 'BIRTH_OFFSPRING')
    .reduce((acc, ev) => acc + Math.max(0, ev.headcountDelta), 0);

  const totalSold = eventsForLivestock
    .filter((e) => e.eventType === 'SALE_DISPATCH')
    .reduce((acc, ev) => acc + Math.abs(ev.headcountDelta), 0);

  const totalContraDelta = eventsForLivestock
    .filter((e) => e.eventType === 'HEADCOUNT_CONTRA_ADJUSTMENT')
    .reduce((acc, ev) => acc + ev.headcountDelta, 0);

  // Also account for contra-adjustments that reversed a mortality log when computing net mortalities
  const mortalityContraRecovery = eventsForLivestock
    .filter((e) => e.eventType === 'HEADCOUNT_CONTRA_ADJUSTMENT' && e.headcountDelta > 0)
    .reduce((acc, ev) => acc + ev.headcountDelta, 0);

  const effectiveMortalities = Math.max(0, totalMortalities - mortalityContraRecovery);
  const denominator = Math.max(1, entry.initialHeadcount + totalBirths);
  const mortalityRatePercent = Number(((effectiveMortalities / denominator) * 100).toFixed(2));

  // Feed consumed linked to this batch
  const feedEvents = allFeedEvents.filter(
    (f) => f.linkedLivestockId === entry.id && f.direction !== 'STOCK_IN'
  );
  const totalFeedConsumedKg = feedEvents.reduce(
    (acc, f) => acc + Math.abs(f.bagsDelta) * f.kgPerBag * (f.direction === 'CONTRA_REVERSAL' && f.bagsDelta > 0 ? -1 : 1),
    0
  );

  const latestWeightEvent = eventsForLivestock.find((e) => typeof e.weightAvgKg === 'number');

  // Estimate current value based on purchase cost + age appreciation proportional to live headcount
  const unitPurchaseCost = entry.initialHeadcount > 0 ? entry.purchaseCostTotal / entry.initialHeadcount : 0;
  const growthMultiplier = 1 + (progressPercentage / 100) * 0.65;
  const estimatedCurrentValueUsd = Number(
    (currentLiveHeadcount * unitPurchaseCost * growthMultiplier).toFixed(2)
  );

  return {
    entry,
    initialAgeDays,
    daysOnFarm,
    currentTotalAgeDays,
    formattedCurrentAge: formatAnimalAge(currentTotalAgeDays, entry.targetDurationUnit),
    targetDurationDays,
    daysLeftUntilSale,
    progressPercentage,
    countdownBadgeText,
    countdownUrgency,
    currentLiveHeadcount,
    totalMortalities: effectiveMortalities,
    totalBirths,
    totalSold,
    totalContraDelta,
    mortalityRatePercent,
    totalFeedConsumedKg: Math.max(0, Number(totalFeedConsumedKg.toFixed(1))),
    latestWeightAvgKg: latestWeightEvent?.weightAvgKg,
    estimatedCurrentValueUsd,
    lifecycleEvents: eventsForLivestock,
    protocols: generateVaccinationProtocols(entry, currentTotalAgeDays, eventsForLivestock),
  };
}

/**
 * 5. Fixed Asset Net Valuation (Append-Only Aggregation grouped by assetGroupId)
 */
export function computeFixedAssetGroups(
  fixedAssetEvents: FixedAssetLedgerEvent[],
  locations: FarmLocation[],
  filterLocationId: string = 'ALL'
): FixedAssetGroupSummary[] {
  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const grouped = new Map<string, FixedAssetLedgerEvent[]>();

  for (const ev of fixedAssetEvents) {
    if (filterLocationId !== 'ALL' && ev.locationId !== filterLocationId) {
      continue;
    }
    const key = `${ev.assetGroupId}::${ev.locationId}`;
    const list = grouped.get(key) || [];
    list.push(ev);
    grouped.set(key, list);
  }

  const summaries: FixedAssetGroupSummary[] = [];

  for (const [, events] of grouped.entries()) {
    const sorted = [...events].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const first = sorted[sorted.length - 1];
    const latest = sorted[0];

    const currentQuantity = events.reduce((acc, e) => acc + e.quantityDelta, 0);
    const currentValue = events.reduce((acc, e) => acc + e.valueDelta, 0);

    if (currentQuantity <= 0 && currentValue <= 0 && events.every((e) => e.direction === 'TRANSFER_OUT')) {
      continue;
    }

    summaries.push({
      assetGroupId: first.assetGroupId,
      assetName: first.assetName,
      category: first.category,
      locationId: first.locationId,
      locationName: locMap.get(first.locationId) || first.locationId,
      currentQuantity: Math.max(0, currentQuantity),
      currentValue: Math.max(0, Number(currentValue.toFixed(2))),
      latestCondition: latest.condition,
      events: sorted,
    });
  }

  return summaries.sort((a, b) => b.currentValue - a.currentValue);
}

/**
 * 1 & 2. Financial Summary, Live "Left Money", and Member Equity / Profit-Share Engine
 */
export function computeFinancialSummary(params: {
  capitalContributions: CapitalContributionEvent[];
  expenses: ExpenseLedgerEvent[];
  fixedAssets: FixedAssetLedgerEvent[];
  livestockStatuses: LivestockComputedStatus[];
  livestockEvents: LivestockLifecycleEvent[];
  filterLocationId?: string;
}): FinancialSummary {
  const {
    capitalContributions,
    expenses,
    fixedAssets,
    livestockStatuses,
    livestockEvents,
    filterLocationId = 'ALL',
  } = params;

  const totalSyndicatePool = Number(
    capitalContributions.reduce((acc, c) => acc + c.amount, 0).toFixed(2)
  );

  const filteredExpenses =
    filterLocationId === 'ALL'
      ? expenses
      : expenses.filter((e) => e.locationId === filterLocationId);

  const approvedExpenses = Number(
    filteredExpenses
      .filter((e) => e.approvalStatus === 'APPROVED')
      .reduce((acc, e) => acc + e.amount, 0)
      .toFixed(2)
  );

  const pendingMultiSigExpenses = Number(
    filteredExpenses
      .filter((e) => e.approvalStatus === 'PENDING_MULTISIG')
      .reduce((acc, e) => acc + e.amount, 0)
      .toFixed(2)
  );

  const filteredLivestockEvents =
    filterLocationId === 'ALL'
      ? livestockEvents
      : livestockEvents.filter((e) => e.locationId === filterLocationId);

  const saleEvents = filteredLivestockEvents.filter(
    (e) => e.eventType === 'SALE_DISPATCH' && typeof e.saleRevenueAmount === 'number'
  );

  const totalSalesRevenue = Number(
    saleEvents.reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0).toFixed(2)
  );

  const reinvestedSalesCash = Number(
    saleEvents
      .reduce((acc, e) => {
        const rev = e.saleRevenueAmount || 0;
        const reinvPct = typeof e.reinvestmentPercentage === 'number' ? e.reinvestmentPercentage : 100;
        return acc + rev * (reinvPct / 100);
      }, 0)
      .toFixed(2)
  );

  const distributedDividendsCash = Number((totalSalesRevenue - reinvestedSalesCash).toFixed(2));

  // Master Syndicate Left Money = Total Syndicate Pool + Reinvested Sales Cash - Approved Expenses
  const allApprovedExpenses = Number(
    expenses
      .filter((e) => e.approvalStatus === 'APPROVED')
      .reduce((acc, e) => acc + e.amount, 0)
      .toFixed(2)
  );
  const allReinvestedSales = Number(
    livestockEvents
      .filter((e) => e.eventType === 'SALE_DISPATCH' && typeof e.saleRevenueAmount === 'number')
      .reduce((acc, e) => {
        const rev = e.saleRevenueAmount || 0;
        const pct = typeof e.reinvestmentPercentage === 'number' ? e.reinvestmentPercentage : 100;
        return acc + rev * (pct / 100);
      }, 0)
      .toFixed(2)
  );

  const leftMoney = Number(
    (totalSyndicatePool + allReinvestedSales - allApprovedExpenses).toFixed(2)
  );

  const filteredAssets =
    filterLocationId === 'ALL'
      ? fixedAssets
      : fixedAssets.filter((a) => a.locationId === filterLocationId);

  const totalFixedAssetsValue = Number(
    Math.max(0, filteredAssets.reduce((acc, a) => acc + a.valueDelta, 0)).toFixed(2)
  );

  const filteredStatuses =
    filterLocationId === 'ALL'
      ? livestockStatuses
      : livestockStatuses.filter((s) => s.entry.locationId === filterLocationId);

  const estimatedActiveLivestockValue = Number(
    filteredStatuses.reduce((acc, s) => acc + s.estimatedCurrentValueUsd, 0).toFixed(2)
  );

  const totalSyndicateNav = Number(
    (leftMoney + totalFixedAssetsValue + estimatedActiveLivestockValue).toFixed(2)
  );

  return {
    totalSyndicatePool,
    approvedExpenses,
    pendingMultiSigExpenses,
    totalSalesRevenue,
    reinvestedSalesCash,
    distributedDividendsCash,
    leftMoney,
    totalFixedAssetsValue,
    estimatedActiveLivestockValue,
    totalSyndicateNav,
  };
}

/**
 * 1. Member Net Contribution & Profit-Sharing Percentage
 */
export function computeMemberEquities(
  members: SyndicateMember[],
  capitalContributions: CapitalContributionEvent[],
  totalSyndicateNav: number
): MemberEquitySummary[] {
  const memberTotals = members.map((member) => {
    const events = capitalContributions.filter((c) => c.memberId === member.id);
    const grossContributed = events
      .filter((c) => c.direction !== 'CONTRA_REVERSAL')
      .reduce((acc, c) => acc + c.amount, 0);
    const contraAdjustments = events
      .filter((c) => c.direction === 'CONTRA_REVERSAL')
      .reduce((acc, c) => acc + c.amount, 0);
    const netContribution = Math.max(0, Number((grossContributed + contraAdjustments).toFixed(2)));
    return {
      member,
      grossContributed: Number(grossContributed.toFixed(2)),
      contraAdjustments: Number(contraAdjustments.toFixed(2)),
      netContribution,
      eventCount: events.length,
    };
  });

  const totalPool = memberTotals.reduce((acc, m) => acc + m.netContribution, 0);

  return memberTotals
    .map((item) => {
      const profitSharePercentage =
        totalPool > 0 ? Number(((item.netContribution / totalPool) * 100).toFixed(2)) : 0;
      const impliedNavEquityUsd =
        totalPool > 0
          ? Number(((item.netContribution / totalPool) * totalSyndicateNav).toFixed(2))
          : 0;
      return {
        ...item,
        profitSharePercentage,
        impliedNavEquityUsd,
      };
    })
    .sort((a, b) => b.netContribution - a.netContribution);
}

/**
 * Interactive Profit Payout Calculator
 */
export function computeDividendDistribution(
  profitAmountUsd: number,
  equities: MemberEquitySummary[]
): { memberId: string; memberName: string; role: string; sharePercent: number; payoutUsd: number }[] {
  const cleanProfit = Math.max(0, profitAmountUsd);
  return equities.map((eq) => ({
    memberId: eq.member.id,
    memberName: eq.member.fullName,
    role: eq.member.role,
    sharePercent: eq.profitSharePercentage,
    payoutUsd: Number(((cleanProfit * eq.profitSharePercentage) / 100).toFixed(2)),
  }));
}

/**
 * Feed Inventory & Burn-Rate Calculation
 */
export function computeFeedInventories(
  feedEvents: FeedLedgerEvent[],
  locations: FarmLocation[],
  filterLocationId: string = 'ALL'
): FeedInventorySummary[] {
  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const grouped = new Map<string, FeedLedgerEvent[]>();

  for (const ev of feedEvents) {
    if (filterLocationId !== 'ALL' && ev.locationId !== filterLocationId) {
      continue;
    }
    const key = `${ev.locationId}::${ev.feedType}`;
    const list = grouped.get(key) || [];
    list.push(ev);
    grouped.set(key, list);
  }

  const summaries: FeedInventorySummary[] = [];

  for (const [, events] of grouped.entries()) {
    const sorted = [...events].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const sample = sorted[0];

    const totalBagsStockedIn = events
      .filter((e) => e.direction === 'STOCK_IN')
      .reduce((acc, e) => acc + e.bagsDelta, 0);

    const totalBagsConsumed = events
      .filter((e) => e.direction === 'DAILY_CONSUMPTION')
      .reduce((acc, e) => acc + Math.abs(e.bagsDelta), 0);

    const totalContraBags = events
      .filter((e) => e.direction === 'CONTRA_REVERSAL')
      .reduce((acc, e) => acc + e.bagsDelta, 0);

    const remainingBags = Math.max(
      0,
      Number((totalBagsStockedIn - totalBagsConsumed + totalContraBags).toFixed(2))
    );
    const kgPerBag = sample.kgPerBag || 50;
    const remainingKg = Number((remainingBags * kgPerBag).toFixed(1));

    const consumptionEvents = events.filter((e) => e.direction === 'DAILY_CONSUMPTION');
    const avgDailyBurnBags =
      consumptionEvents.length > 0
        ? Number(
            (
              consumptionEvents.reduce((acc, e) => acc + Math.abs(e.bagsDelta), 0) /
              Math.max(1, consumptionEvents.length)
            ).toFixed(2)
          )
        : 0.5;

    const daysRemaining =
      avgDailyBurnBags > 0 ? Math.max(0, Math.floor(remainingBags / avgDailyBurnBags)) : 99;

    summaries.push({
      locationId: sample.locationId,
      locationName: locMap.get(sample.locationId) || sample.locationId,
      feedType: sample.feedType,
      totalBagsStockedIn: Number(totalBagsStockedIn.toFixed(2)),
      totalBagsConsumed: Number(totalBagsConsumed.toFixed(2)),
      totalContraBags: Number(totalContraBags.toFixed(2)),
      remainingBags,
      remainingKg,
      kgPerBag,
      estimatedDailyBurnBags: avgDailyBurnBags,
      daysRemaining,
      events: sorted,
    });
  }

  return summaries;
}

/**
 * Multi-Location Comparison Engine
 */
export function computeSiteComparisons(params: {
  locations: FarmLocation[];
  expenses: ExpenseLedgerEvent[];
  fixedAssets: FixedAssetLedgerEvent[];
  livestockStatuses: LivestockComputedStatus[];
  livestockEvents: LivestockLifecycleEvent[];
}): SiteComparisonSummary[] {
  const { locations, expenses, fixedAssets, livestockStatuses, livestockEvents } = params;

  return locations.map((loc) => {
    const siteAnimals = livestockStatuses.filter((s) => s.entry.locationId === loc.id);
    const activeAnimalHeadcount = siteAnimals.reduce((acc, s) => acc + s.currentLiveHeadcount, 0);
    const activeBatchCount = siteAnimals.length;

    const siteApprovedExpenses = Number(
      expenses
        .filter((e) => e.locationId === loc.id && e.approvalStatus === 'APPROVED')
        .reduce((acc, e) => acc + e.amount, 0)
        .toFixed(2)
    );

    const sitePendingExpenses = Number(
      expenses
        .filter((e) => e.locationId === loc.id && e.approvalStatus === 'PENDING_MULTISIG')
        .reduce((acc, e) => acc + e.amount, 0)
        .toFixed(2)
    );

    const siteFixedAssetValue = Number(
      Math.max(
        0,
        fixedAssets
          .filter((a) => a.locationId === loc.id)
          .reduce((acc, a) => acc + a.valueDelta, 0)
      ).toFixed(2)
    );

    const totalInitialPlusBirths = siteAnimals.reduce(
      (acc, s) => acc + s.entry.initialHeadcount + s.totalBirths,
      0
    );
    const totalMortalities = siteAnimals.reduce((acc, s) => acc + s.totalMortalities, 0);
    const siteMortalityRatePercent =
      totalInitialPlusBirths > 0
        ? Number(((totalMortalities / totalInitialPlusBirths) * 100).toFixed(2))
        : 0;

    const siteSalesRevenue = Number(
      livestockEvents
        .filter((e) => e.locationId === loc.id && e.eventType === 'SALE_DISPATCH')
        .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0)
        .toFixed(2)
    );

    return {
      location: loc,
      activeAnimalHeadcount,
      activeBatchCount,
      siteApprovedExpenses,
      sitePendingExpenses,
      siteFixedAssetValue,
      siteMortalityRatePercent,
      siteSalesRevenue,
    };
  });
}
