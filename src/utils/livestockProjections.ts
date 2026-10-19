import type {
  LivestockComputedStatus,
  LivestockLifecycleEvent,
} from '../types/agro.ts';

export interface GrowthChartDataPoint {
  day: number;
  date: string;
  label: string;
  actualWeightKg?: number | null;
  projectedWeightKg: number;
  targetBandLower: number;
  targetBandUpper: number;
  milestone?: string;
  milestoneType?: 'VACCINE' | 'FEED' | 'WEIGHT' | 'MARKET' | 'HEALTH';
  eventNote?: string;
  isToday?: boolean;
}

export interface HerdBiomassPoint {
  batchId: string;
  name: string;
  species: string;
  locationName: string;
  liveHeadcount: number;
  avgWeightKg: number;
  totalBiomassKg: number;
  estimatedValueUsd: number;
  daysLeft: number;
}

export interface FcrTelemetry {
  fcr: number;
  fcrRating: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
  totalFeedKg: number;
  totalBiomassKg: number;
  targetFcr: number;
  feedCostEstimatedUsd: number;
}

/**
 * Standard Broiler Cobb 500 / Ross 308 42-day sigmoidal growth curve
 */
function getBroilerStandardWeightKg(day: number, targetFinalWeight: number = 2.2): number {
  if (day <= 0) return 0.042;
  // S-curve logistic function for poultry growth
  const k = 0.115;
  const t0 = 24;
  const L = targetFinalWeight * 1.05;
  const raw = L / (1 + Math.exp(-k * (day - t0)));
  return Math.max(0.042, Number(raw.toFixed(3)));
}

/**
 * Standard Goat / Ruminant gradual linear & adolescent growth curve
 */
function getGoatStandardWeightKg(
  day: number,
  initialWeight: number = 24,
  targetWeight: number = 45,
  targetDays: number = 240
): number {
  if (day <= 0) return initialWeight;
  const progress = Math.min(1.2, day / Math.max(1, targetDays));
  const weight = initialWeight + (targetWeight - initialWeight) * Math.pow(progress, 0.95);
  return Number(weight.toFixed(2));
}

/**
 * Generates combined actual historical weight checks + projected milestone trajectory
 */
export function generateGrowthProjectionData(status: LivestockComputedStatus): {
  points: GrowthChartDataPoint[];
  currentWeightKg: number;
  targetWeightKg: number;
  weightGainRateGramsPerDay: number;
  projectedDaysToMarket: number;
} {
  const lower = status.entry.species.toLowerCase();
  const isPoultry = lower.includes('broiler') || lower.includes('layer') || lower.includes('poultry');
  const isLargeMammal = lower.includes('cattle') || lower.includes('zebra') || lower.includes('horse') || lower.includes('wildlife');

  const totalTargetDays = Math.max(14, status.targetDurationDays);
  const daysOnFarm = Math.max(0, status.daysOnFarm);
  const targetWeight = status.entry.targetSaleWeightKg || (isPoultry ? 2.2 : (isLargeMammal ? 320 : 42));

  // Collect all historical events with weight
  const weightEvents = status.lifecycleEvents
    .filter((e) => typeof e.weightAvgKg === 'number' && e.weightAvgKg > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Collect protocols with dayTarget
  const protocolMap = new Map<number, string>();
  for (const p of status.protocols) {
    protocolMap.set(p.dayTarget, p.title);
  }

  // Initial recorded weight
  const initialWeight = weightEvents[0]?.weightAvgKg || (isPoultry ? 0.044 : (isLargeMammal ? 180 : 24));
  const latestActualWeight = status.latestWeightAvgKg || (isPoultry ? (daysOnFarm > 25 ? 1.85 : 0.45) : (isLargeMammal ? 240 : 32));

  const entryTime = new Date(status.entry.entryDate).getTime();
  const stepDays = isPoultry ? 2 : Math.max(7, Math.round(totalTargetDays / 20));

  const points: GrowthChartDataPoint[] = [];

  // Generate timeline markers from Day 0 up to targetDurationDays + padding
  const maxDay = Math.max(totalTargetDays + (isPoultry ? 4 : 14), daysOnFarm + 4);

  for (let d = 0; d <= maxDay; d += stepDays) {
    const pointDate = new Date(entryTime + d * 86400000);
    const dateStr = pointDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    // Standard projected weight
    const projectedWeight = isPoultry
      ? getBroilerStandardWeightKg(d, targetWeight)
      : getGoatStandardWeightKg(d, initialWeight, targetWeight, totalTargetDays);

    // Confidence interval band (+/- 8% to 10%)
    const bandTolerance = isPoultry ? 0.08 : 0.10;
    const lowerBand = Number((projectedWeight * (1 - bandTolerance)).toFixed(3));
    const upperBand = Number((projectedWeight * (1 + bandTolerance)).toFixed(3));

    // Check if there is an actual event logged on or near this day
    let actualWeight: number | null = null;
    let eventNote: string | undefined = undefined;
    let milestone = protocolMap.get(d);
    let milestoneType: GrowthChartDataPoint['milestoneType'] = milestone ? 'VACCINE' : undefined;

    // Check historical events matching near this day (+/- stepDays/2)
    const matchingEvent = weightEvents.find((e) => {
      const evDays = Math.round((new Date(e.createdAt).getTime() - entryTime) / 86400000);
      return Math.abs(evDays - d) < (stepDays / 2 + 0.5);
    });

    if (matchingEvent && matchingEvent.weightAvgKg) {
      actualWeight = matchingEvent.weightAvgKg;
      eventNote = `${matchingEvent.eventType.replace(/_/g, ' ')}: ${matchingEvent.note}`;
      if (matchingEvent.eventType === 'VACCINATION_HEALTH') milestoneType = 'VACCINE';
      if (matchingEvent.eventType === 'WEIGHT_CHECK') milestoneType = 'WEIGHT';
    } else if (d === 0) {
      actualWeight = initialWeight;
    } else if (d <= daysOnFarm && Math.abs(d - daysOnFarm) < stepDays) {
      // Current day checkpoint
      actualWeight = latestActualWeight;
    }

    if (d === totalTargetDays) {
      milestone = milestone || 'Target Market Sale Ready';
      milestoneType = 'MARKET';
    }

    const isToday = Math.abs(d - daysOnFarm) < stepDays / 2;

    points.push({
      day: d,
      date: dateStr,
      label: `Day ${d}`,
      actualWeightKg: d <= daysOnFarm ? actualWeight : null,
      projectedWeightKg: projectedWeight,
      targetBandLower: lowerBand,
      targetBandUpper: upperBand,
      milestone,
      milestoneType,
      eventNote,
      isToday,
    });
  }

  // Calculate Average Daily Gain (ADG)
  const daysTracked = Math.max(1, daysOnFarm);
  const totalGainKg = Math.max(0, latestActualWeight - initialWeight);
  const weightGainRateGramsPerDay = Math.round((totalGainKg / daysTracked) * 1000);

  const remainingKg = Math.max(0, targetWeight - latestActualWeight);
  const projectedDaysToMarket = weightGainRateGramsPerDay > 0
    ? Math.round((remainingKg * 1000) / weightGainRateGramsPerDay)
    : status.daysLeftUntilSale;

  return {
    points,
    currentWeightKg: latestActualWeight,
    targetWeightKg: targetWeight,
    weightGainRateGramsPerDay,
    projectedDaysToMarket,
  };
}

/**
 * Computes Herd Biomass for all active livestock batches
 */
export function computeHerdBiomassSummary(statuses: LivestockComputedStatus[]): HerdBiomassPoint[] {
  return statuses.map((s) => {
    const lower = s.entry.species.toLowerCase();
    const isPoultry = lower.includes('broiler') || lower.includes('layer') || lower.includes('poultry');
    const isLargeMammal = lower.includes('cattle') || lower.includes('zebra') || lower.includes('horse') || lower.includes('wildlife');
    const avgWeight = s.latestWeightAvgKg || (isPoultry ? 1.85 : (isLargeMammal ? 280 : 34));
    const totalBiomass = Math.round(s.currentLiveHeadcount * avgWeight);

    return {
      batchId: s.entry.id,
      name: s.entry.nameOrTag,
      species: s.entry.species,
      locationName: s.entry.locationName,
      liveHeadcount: s.currentLiveHeadcount,
      avgWeightKg: avgWeight,
      totalBiomassKg: totalBiomass,
      estimatedValueUsd: s.estimatedCurrentValueUsd,
      daysLeft: s.daysLeftUntilSale,
    };
  });
}

/**
 * Computes Feed Conversion Ratio (FCR)
 */
export function computeFcrTelemetry(status: LivestockComputedStatus): FcrTelemetry {
  const lower = status.entry.species.toLowerCase();
  const isPoultry = lower.includes('broiler') || lower.includes('layer') || lower.includes('poultry');
  const isLargeMammal = lower.includes('cattle') || lower.includes('zebra') || lower.includes('horse') || lower.includes('wildlife');
  const avgWeight = status.latestWeightAvgKg || (isPoultry ? 1.85 : (isLargeMammal ? 280 : 32));
  const totalBiomassKg = Math.max(1, status.currentLiveHeadcount * avgWeight);
  const totalFeedKg = status.totalFeedConsumedKg > 0
    ? status.totalFeedConsumedKg
    : (isPoultry ? Math.round(totalBiomassKg * 1.55) : (isLargeMammal ? Math.round(totalBiomassKg * 6.5) : Math.round(totalBiomassKg * 4.2)));

  const fcr = Number((totalFeedKg / totalBiomassKg).toFixed(2));
  const targetFcr = isPoultry ? 1.55 : (isLargeMammal ? 6.5 : 4.5);

  let fcrRating: FcrTelemetry['fcrRating'] = 'GOOD';
  if (isPoultry) {
    if (fcr <= 1.55) fcrRating = 'EXCELLENT';
    else if (fcr <= 1.75) fcrRating = 'GOOD';
    else fcrRating = 'NEEDS_ATTENTION';
  } else {
    if (fcr <= (isLargeMammal ? 6.5 : 4.2)) fcrRating = 'EXCELLENT';
    else if (fcr <= (isLargeMammal ? 8.0 : 5.2)) fcrRating = 'GOOD';
    else fcrRating = 'NEEDS_ATTENTION';
  }

  // Estimated Feed cost ($0.50/kg for poultry, $0.30/kg for ruminant supplements)
  const feedCostEstimatedUsd = Math.round(totalFeedKg * (isPoultry ? 0.52 : 0.35));

  return {
    fcr,
    fcrRating,
    totalFeedKg,
    totalBiomassKg,
    targetFcr,
    feedCostEstimatedUsd,
  };
}
