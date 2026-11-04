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
  OrgMember,
  DebtLiabilityEvent,
  LoanGivenEvent,
  CreditSaleEvent,
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

  let templates: {
    dayTarget: number;
    title: string;
    category: ProtocolMilestone['category'];
    targetWeightKg?: number;
    feedPhase?: string;
    description?: string;
  }[] = [];

  // 1. If entry has user-defined custom checkpoints, prioritize the custom farm recipe
  if (entry.customCheckpoints && entry.customCheckpoints.length > 0) {
    templates = entry.customCheckpoints.map((cp) => ({
      dayTarget: cp.dayTarget,
      title: cp.title,
      category: (cp.category === 'MEDICATION' || cp.category === 'GENERAL_TASK'
        ? 'BIOSECURITY'
        : cp.category) as ProtocolMilestone['category'],
      targetWeightKg: cp.targetWeightKg,
      feedPhase: cp.feedPhase,
      description: cp.instructions,
    }));
  } else if (lowerSpecies.includes('broiler') || lowerSpecies.includes('chicken') || lowerSpecies.includes('layer') || lowerSpecies.includes('poultry')) {
    templates = [
      {
        dayTarget: 1,
        title: 'Day 1: Placement, Brooder Setup (32-33°C) & Stress Pack',
        category: 'BIOSECURITY',
        targetWeightKg: 0.042,
        feedPhase: 'Broiler Starter Crumbles (22-24% CP)',
        description: 'Brooder preheated to 32-33°C. Administer Stress Pack (glucose + electrolytes + multivitamins) in clean water. Broiler Starter Crumbles on paper trays. Crop fill audit at 24h (target >95%).',
      },
      {
        dayTarget: 4,
        title: 'Day 4: Starter Period: Brooder Temp Stepping & Crop Audit',
        category: 'FEED_TRANSITION',
        targetWeightKg: 0.095,
        feedPhase: 'Broiler Starter Crumbles (22-24% CP)',
        description: 'Brooder temperature step-down (-0.5°C/day towards 28°C). Maintain 23h light / 1h dark. Verify active feeding & clean fresh water supply.',
      },
      {
        dayTarget: 7,
        title: 'Day 7: Week 1 Weight Check & Newcastle (B1) Vaccine',
        category: 'VACCINE',
        targetWeightKg: 0.185,
        feedPhase: 'Broiler Starter Crumbles (22-24% CP)',
        description: 'Newcastle Disease (Hitchner B1 / Clone 30) eye-drop or drinking water. Conduct 10% sample weigh-in (target: 180-200g, minimum 4.5x hatch weight).',
      },
      {
        dayTarget: 11,
        title: 'Day 11: Feed Transition: 3-Day Starter to Grower Blend',
        category: 'FEED_TRANSITION',
        targetWeightKg: 0.350,
        feedPhase: '50% Starter / 50% Grower Blend',
        description: 'Initiate 3-day gradual feed switch to protect gut microflora: Day 11 (75/25), Day 12 (50/50), Day 13 (25/75). Blend Starter Crumbles with Grower Pellets/Mash.',
      },
      {
        dayTarget: 14,
        title: 'Day 14: Week 2 Weight Check & IBD Intermediate Vaccine',
        category: 'VACCINE',
        targetWeightKg: 0.480,
        feedPhase: '100% Broiler Grower Pellets (20% CP)',
        description: 'IBD Intermediate vaccine in clean chlorine-free water with skim milk stabilizer. Sample weigh-in (target: 450-500g). Phase down artificial brooder heating to ambient 24-26°C; expand pen floor space.',
      },
      {
        dayTarget: 18,
        title: 'Day 18: Grower Phase: Ventilation, Litter Audit & FCR Check',
        category: 'FEED_TRANSITION',
        targetWeightKg: 0.720,
        feedPhase: 'Broiler Grower Pellets (20% CP)',
        description: 'Turn litter to prevent caking and ammonia buildup. Inspect drinker line pressure and daily feed intake against standard FCR curves.',
      },
      {
        dayTarget: 21,
        title: 'Day 21: Week 3 Weight Check & Newcastle + IBD Booster',
        category: 'VACCINE',
        targetWeightKg: 0.980,
        feedPhase: 'Broiler Grower Pellets (20% CP)',
        description: 'Newcastle Disease (LaSota) + IBD Booster vaccine in drinking water. Sample weigh-in (target: 950-1050g). Inspect flock uniformity, footpad health, and feathering.',
      },
      {
        dayTarget: 25,
        title: 'Day 25: Feed Transition: 3-Day Grower to Finisher Blend',
        category: 'FEED_TRANSITION',
        targetWeightKg: 1.350,
        feedPhase: '50% Grower / 50% Finisher Blend',
        description: 'Begin 3-day gradual transition to Finisher: Day 25 (75/25), Day 26 (50/50), Day 27 (25/75). Maintains uniform intestinal flora and appetite.',
      },
      {
        dayTarget: 28,
        title: 'Day 28: Week 4 Weight Check & 100% Finisher Transition',
        category: 'FEED_TRANSITION',
        targetWeightKg: 1.620,
        feedPhase: '100% Broiler Finisher (18-19% CP)',
        description: 'Full transition to high-energy Broiler Finisher feed (3,200 kcal/kg) for rapid breast muscle accretion. Sample weigh-in (target: 1.55-1.70 kg).',
      },
      {
        dayTarget: 32,
        title: 'Day 32: Biosecurity & Medication Withdrawal Audit',
        category: 'BIOSECURITY',
        targetWeightKg: 1.950,
        feedPhase: 'Unmedicated Broiler Finisher',
        description: 'Mandatory veterinary withdrawal of any anti-coccidials or medicated feeds. Switch to 100% plain water and clean finisher feed to guarantee zero residues in meat.',
      },
      {
        dayTarget: 35,
        title: 'Day 35: Week 5 Pre-Market Weight Audit & Buyer Booking',
        category: 'WEIGHT_CHECK',
        targetWeightKg: 2.200,
        feedPhase: 'Unmedicated Broiler Finisher',
        description: 'Comprehensive flock weigh-in (target: 2.1-2.3 kg, CV < 10%). Finalize buyer pickup dates, processing slots, and crate staging logistics.',
      },
      {
        dayTarget: 38,
        title: 'Day 38: Final Harvest, Feed Withdrawal & Dispatch Readiness',
        category: 'WEIGHT_CHECK',
        targetWeightKg: 2.450,
        feedPhase: 'Pre-Slaughter Feed Withdrawal (Water Only)',
        description: '8-10 hour pre-slaughter feed withdrawal protocol (fresh water stays available). Cool-night or early dawn catching, crating, weighing, and market dispatch.',
      },
    ];
  } else if (lowerSpecies.includes('goat') || lowerSpecies.includes('sheep')) {
    templates = [
      { dayTarget: 14, title: 'Quarantine & Footbath Dip Inspection', category: 'BIOSECURITY', targetWeightKg: 26, feedPhase: 'Quarantine Hay & Mineral Supplement', description: 'Inspect isolation pen, hoof bath dip, and internal parasite check.' },
      { dayTarget: 30, title: 'Pulpy Kidney (Enterotoxaemia) & Tetanus Vaccine', category: 'VACCINE', targetWeightKg: 29, feedPhase: 'Grower Pasture + Protein Lick', description: 'Clostridial vaccine injection with sterile needles.' },
      { dayTarget: 90, title: 'Quarterly Broad-Spectrum Deworming (Albendazole/Ivermectin)', category: 'VACCINE', targetWeightKg: 35, feedPhase: 'High-Energy Finishing Supplement', description: 'Oral drenching calibrated to body weight.' },
      { dayTarget: 150, title: 'Mid-Cycle Body Condition & Weight Check', category: 'WEIGHT_CHECK', targetWeightKg: 40, feedPhase: 'Finishing Ration', description: 'Body condition score audit (target 3.5/5).' },
      { dayTarget: 210, title: 'Pre-Market Finishing Supplement Transition', category: 'FEED_TRANSITION', targetWeightKg: 45, feedPhase: 'Pre-Market Finishing Blend', description: 'Transition to final finishing feed and buyer booking.' },
    ];
  } else if (lowerSpecies.includes('zebra') || lowerSpecies.includes('wildlife') || lowerSpecies.includes('game') || lowerSpecies.includes('ostrich') || lowerSpecies.includes('antelope')) {
    templates = [
      { dayTarget: 7, title: 'Day 7: Arrival Quarantine & Pasture Acclimatization Inspection', category: 'BIOSECURITY', feedPhase: 'Quarantine Boma Rations', description: 'Acclimatization, fence inspection and parasite screening.' },
      { dayTarget: 30, title: 'Day 30: Multivalent Clostridial / Anthrax Vaccine & Tick Dip Check', category: 'VACCINE', feedPhase: 'Rangeland Grazing + Salt Blocks', description: 'Multivalent clostridial immunization and plunge dip inspection.' },
      { dayTarget: 90, title: 'Day 90: Seasonal Deworming & Mineral Lick Block Placement', category: 'FEED_TRANSITION', feedPhase: 'Seasonal Mineral Blocks', description: 'Seasonal dewormer delivery and mineral supplement placement.' },
      { dayTarget: 180, title: 'Day 180: Bi-Annual Herd Condition Assessment & Microchip/Tag Audit', category: 'WEIGHT_CHECK', feedPhase: 'Standard Natural Rangeland', description: 'Aerial or vehicle herd count and condition scoring.' },
      { dayTarget: 360, title: 'Day 360: Annual Wildlife Census & Veterinary Health Clearance', category: 'BIOSECURITY', feedPhase: 'Dry Season Supplementation', description: 'Veterinary health cert clearance and herd sustainability audit.' },
    ];
  } else if (lowerSpecies.includes('pig') || lowerSpecies.includes('swine')) {
    templates = [
      { dayTarget: 3, title: 'Day 3: Iron Dextran Injection & Needle Teeth Check', category: 'BIOSECURITY', targetWeightKg: 1.8, feedPhase: 'Sow Milk + Creep Feed', description: 'Administer iron dextran 200mg and inspect creep box temperature.' },
      { dayTarget: 21, title: 'Day 21: Mycoplasma & Circovirus (PCV2) Vaccination', category: 'VACCINE', targetWeightKg: 6.5, feedPhase: 'Creep Feed Pellets', description: 'PCV2 immunization and initial weaning prep.' },
      { dayTarget: 28, title: 'Day 28: Weaning & Creep Feed Transition to Weaner Pellets', category: 'FEED_TRANSITION', targetWeightKg: 8.5, feedPhase: 'Weaner Pellets', description: 'Wean piglets and transition feed over 4 days.' },
      { dayTarget: 75, title: 'Day 75: Grower Mash Transition & Internal Parasite Control', category: 'FEED_TRANSITION', targetWeightKg: 35, feedPhase: 'Pig Grower Mash', description: 'Transition to grower mash and broad-spectrum deworming.' },
      { dayTarget: 150, title: 'Day 150: Finisher Weight Check & Market Booking', category: 'WEIGHT_CHECK', targetWeightKg: 90, feedPhase: 'Finisher Meal', description: 'Weight audit (target 85-95kg) and abattoir booking.' },
    ];
  } else {
    templates = [
      { dayTarget: 7, title: 'Arrival Quarantine & Ear-Tag Verification', category: 'BIOSECURITY', description: 'Quarantine and physical inspection.' },
      { dayTarget: 30, title: 'Anthrax / Blackleg / Multivalent Vaccination', category: 'VACCINE', description: 'Routine clostridial multivalent immunization.' },
      { dayTarget: 90, title: 'Tick Dipping & Internal Parasite Drenching', category: 'VACCINE', description: 'Plunge dipping or pour-on acaricide.' },
      { dayTarget: 180, title: 'Bi-Annual Weight & Growth Curve Assessment', category: 'WEIGHT_CHECK', description: 'Scale weigh-in and body condition score.' },
    ];
  }

  const entryMs = new Date(entry.entryDate || entry.createdAt || Date.now()).getTime();

  return templates.map((tpl, idx) => {
    const matchingEvent = vaxEvents.find((ev) => {
      const noteLower = ev.note.toLowerCase();
      // Match explicit day number (e.g. "day 14" or "day 7")
      if (noteLower.includes(`day ${tpl.dayTarget}`)) return true;
      // Match key disease / protocol terms
      if (tpl.title.toLowerCase().includes('ibd') && noteLower.includes('ibd')) return true;
      if (tpl.title.toLowerCase().includes('newcastle') && noteLower.includes('newcastle')) return true;
      if (tpl.title.toLowerCase().includes('starter') && noteLower.includes('starter')) return true;
      if (tpl.title.toLowerCase().includes('grower') && noteLower.includes('grower')) return true;
      if (tpl.title.toLowerCase().includes('finisher') && noteLower.includes('finisher')) return true;
      // Match first primary keyword from title
      const titleKey = tpl.title.split(':')[1]?.trim().split(' ')[0]?.toLowerCase();
      return titleKey && titleKey.length > 2 && noteLower.includes(titleKey);
    });

    const autoDoneByAge = currentTotalAgeDays > tpl.dayTarget + 3;
    const completed = Boolean(matchingEvent) || autoDoneByAge;

    const targetDateMs = entryMs + tpl.dayTarget * MS_PER_DAY;
    const targetDateObj = new Date(targetDateMs);
    const scheduledDate = targetDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const dispatchTime = '07:00 AM';
    const dispatchIso = new Date(new Date(targetDateMs).setHours(7, 0, 0, 0)).toISOString();

    let reminderStatus: ProtocolMilestone['reminderStatus'] = 'SCHEDULED';
    if (completed) {
      reminderStatus = 'COMPLETED';
    } else if (currentTotalAgeDays === tpl.dayTarget) {
      reminderStatus = 'DUE_TODAY';
    } else if (currentTotalAgeDays > tpl.dayTarget) {
      reminderStatus = 'OVERDUE';
    }

    return {
      id: `${entry.id}-proto-${idx + 1}`,
      dayTarget: tpl.dayTarget,
      title: tpl.title,
      category: tpl.category,
      completed,
      completedNote: matchingEvent?.note || (autoDoneByAge ? 'Completed on schedule per site log' : undefined),
      completedAt: matchingEvent?.createdAt,
      scheduledDate,
      dispatchTime,
      dispatchIso,
      targetWeightKg: tpl.targetWeightKg,
      feedPhase: tpl.feedPhase,
      description: tpl.description,
      reminderStatus,
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
  const entryMs = new Date(entry.entryDate || entry.createdAt || Date.now()).getTime();

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

  const totalSlaughteredOrConsumed = eventsForLivestock
    .filter((e) => e.eventType === 'SLAUGHTER_HARVEST' || e.eventType === 'FARM_CONSUMPTION')
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

  // Configured Selling Price & Expected Income Engine
  const configuredSalePricePerUnit =
    typeof entry.configuredSalePricePerUnit === 'number' && entry.configuredSalePricePerUnit > 0
      ? entry.configuredSalePricePerUnit
      : entry.species.toLowerCase().includes('broiler')
        ? 6.0
        : entry.species.toLowerCase().includes('goat')
          ? 120.0
          : entry.species.toLowerCase().includes('layer')
            ? 8.0
            : unitPurchaseCost * 1.5 || 10.0;

  const expectedRevenuePerAnimalUsd =
    typeof entry.configuredSalePricePerKg === 'number' && entry.configuredSalePricePerKg > 0
      ? Number(((latestWeightEvent?.weightAvgKg || entry.targetSaleWeightKg || 2.0) * entry.configuredSalePricePerKg).toFixed(2))
      : configuredSalePricePerUnit;

  const totalExpectedRevenueUsd = Number(
    (currentLiveHeadcount * expectedRevenuePerAnimalUsd).toFixed(2)
  );

  // Projected margin = Expected Revenue - Initial cost of live stock - estimated feed costs ($0.60/kg feed)
  const estimatedFeedCostUsd = totalFeedConsumedKg * 0.65;
  const totalProjectedMarginUsd = Number(
    (totalExpectedRevenueUsd - (currentLiveHeadcount * unitPurchaseCost + estimatedFeedCostUsd)).toFixed(2)
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
    totalSlaughteredOrConsumed,
    totalContraDelta,
    mortalityRatePercent,
    totalFeedConsumedKg: Math.max(0, Number(totalFeedConsumedKg.toFixed(1))),
    latestWeightAvgKg: latestWeightEvent?.weightAvgKg,
    estimatedCurrentValueUsd,
    configuredSalePricePerUnit,
    configuredSalePricePerKg: entry.configuredSalePricePerKg,
    expectedRevenuePerAnimalUsd,
    totalExpectedRevenueUsd,
    totalProjectedMarginUsd,
    lifecycleEvents: eventsForLivestock,
    protocols: generateVaccinationProtocols(entry, currentTotalAgeDays, eventsForLivestock),
    customCheckpoints: entry.customCheckpoints,
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
  debtLiabilities?: DebtLiabilityEvent[];
  loansGiven?: LoanGivenEvent[];
  creditSales?: CreditSaleEvent[];
}): FinancialSummary {
  const {
    capitalContributions,
    expenses,
    fixedAssets,
    livestockStatuses,
    livestockEvents,
    filterLocationId = 'ALL',
    debtLiabilities = [],
    loansGiven = [],
    creditSales = [],
  } = params;

  const totalPool = Number(
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

  // Master Organization Left Money = Total Pool + Reinvested Sales Cash - Approved Expenses
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

  // Expanded Banking Ledger Computations:
  const totalBorrowedDebtOutstanding = Number(
    debtLiabilities
      .filter((d) => d.status !== 'SETTLED')
      .reduce((acc, d) => acc + (typeof d.remainingBalance === 'number' ? d.remainingBalance : d.principalAmount), 0)
      .toFixed(2)
  );

  const totalDebtRepaid = Number(
    debtLiabilities
      .reduce((acc, d) => acc + (d.repayments || []).reduce((rAcc, r) => rAcc + r.amount, 0), 0)
      .toFixed(2)
  );

  const totalLoansGivenOutstanding = Number(
    loansGiven
      .filter((l) => l.status !== 'RECOVERED')
      .reduce((acc, l) => acc + (typeof l.remainingBalance === 'number' ? l.remainingBalance : l.principalAmount), 0)
      .toFixed(2)
  );

  const totalLoansRecovered = Number(
    loansGiven
      .reduce((acc, l) => acc + (l.repayments || []).reduce((rAcc, r) => rAcc + r.amount, 0), 0)
      .toFixed(2)
  );

  const totalCreditSalesOutstanding = Number(
    creditSales
      .filter((cs) => cs.status !== 'SETTLED')
      .reduce((acc, cs) => acc + (typeof cs.creditBalanceRemaining === 'number' ? cs.creditBalanceRemaining : cs.totalSaleAmount - cs.depositPaidCash), 0)
      .toFixed(2)
  );

  const totalCustomerDepositsCollected = Number(
    creditSales
      .reduce((acc, cs) => {
        const deposit = cs.depositPaidCash || 0;
        const installments = (cs.paymentLogs || []).reduce((pAcc, p) => pAcc + p.amount, 0);
        return acc + deposit + installments;
      }, 0)
      .toFixed(2)
  );

  // Cash flow adjustments from lending and debt
  const loansDisbursedCash = Number(
    loansGiven.reduce((acc, l) => acc + l.principalAmount, 0).toFixed(2)
  );
  const externalCashLoansBorrowed = Number(
    debtLiabilities
      .filter((d) => d.category === 'EXTERNAL_LOAN' || d.category === 'DIRECTOR_MEMBER_ADVANCE')
      .reduce((acc, d) => acc + d.principalAmount, 0)
      .toFixed(2)
  );

  const leftMoney = Number(
    (
      totalPool +
      allReinvestedSales +
      totalCustomerDepositsCollected +
      externalCashLoansBorrowed +
      totalLoansRecovered -
      allApprovedExpenses -
      loansDisbursedCash -
      totalDebtRepaid
    ).toFixed(2)
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

  const totalExpectedLivestockRevenue = Number(
    filteredStatuses
      .reduce((acc, s) => acc + (s.totalExpectedRevenueUsd || s.estimatedCurrentValueUsd), 0)
      .toFixed(2)
  );

  const netFinancialPosition = Number(
    (
      leftMoney +
      totalCreditSalesOutstanding +
      totalLoansGivenOutstanding -
      totalBorrowedDebtOutstanding
    ).toFixed(2)
  );

  const totalNav = Number(
    (
      leftMoney +
      totalCreditSalesOutstanding +
      totalLoansGivenOutstanding +
      totalFixedAssetsValue +
      estimatedActiveLivestockValue -
      totalBorrowedDebtOutstanding
    ).toFixed(2)
  );

  return {
    totalPool,
    totalSyndicatePool: totalPool,
    approvedExpenses,
    pendingMultiSigExpenses,
    totalSalesRevenue,
    reinvestedSalesCash,
    distributedDividendsCash,
    leftMoney,
    totalFixedAssetsValue,
    estimatedActiveLivestockValue,
    totalExpectedLivestockRevenue,
    totalBorrowedDebtOutstanding,
    totalLoansGivenOutstanding,
    totalCreditSalesOutstanding,
    totalCustomerDepositsCollected,
    totalDebtRepaid,
    totalLoansRecovered,
    netFinancialPosition,
    creditSalesReceivables: totalCreditSalesOutstanding,
    debtLiabilitiesOwed: totalBorrowedDebtOutstanding,
    loansGivenRecoverable: totalLoansGivenOutstanding,
    totalNav,
    totalSyndicateNav: totalNav,
  };
}

/**
 * 1. Member Net Contribution & Profit-Sharing Percentage
 */
export function computeMemberEquities(
  members: OrgMember[],
  capitalContributions: CapitalContributionEvent[],
  totalNav: number
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
          ? Number(((item.netContribution / totalPool) * totalNav).toFixed(2))
          : 0;

      const targetContributionUsd = item.member.targetContributionUsd || 1000;
      const progressPercentage = Math.min(
        100,
        Math.round((item.netContribution / Math.max(1, targetContributionUsd)) * 100)
      );
      const remainingToTargetUsd = Math.max(0, targetContributionUsd - item.netContribution);
      const isGoalMet = item.netContribution >= targetContributionUsd;
      const contributionPace = item.member.contributionPace || 'MONTHLY';

      return {
        ...item,
        profitSharePercentage,
        impliedNavEquityUsd,
        targetContributionUsd,
        progressPercentage,
        remainingToTargetUsd,
        isGoalMet,
        contributionPace,
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
      currentBagsBalance: remainingBags,
      remainingKg,
      currentKgBalance: remainingKg,
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
