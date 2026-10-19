import type {
  AgroStateSnapshot,
  AuditEventType,
  AuditNotificationEvent,
  CapitalContributionEvent,
  ExpenseLedgerEvent,
  FarmLocation,
  FeedLedgerEvent,
  FixedAssetLedgerEvent,
  LivestockEntry,
  LivestockLifecycleEvent,
  NotificationSeverity,
  Role,
  SyndicateMember,
} from '../types/agro.ts';
import {
  computeAuditEventHash,
  computeLedgerRecordHash,
  GENESIS_SHORT,
} from '../utils/cryptoHash.ts';
import { computeTargetSaleDate } from '../utils/calculations.ts';

const MS_PER_DAY = 86_400_000;

export const LEGACY_SEED_IDS = {
  locations: ['loc-norton-a', 'loc-gweru-b', 'loc-macheke-c'],
  members: ['mem-chipo', 'mem-tendai', 'mem-kudzi', 'mem-tafadzwa'],
  capitalContributions: ['TX-CAP-001', 'TX-CAP-002', 'TX-CAP-003', 'TX-CAP-004'],
  livestockEntries: [
    'LSTK-BROILER-12',
    'LSTK-BOER-HERD-01',
    'LSTK-BUCK-GW-01',
    'LSTK-BROILER-11',
  ],
  livestockEvents: [
    'EV-LSTK-001',
    'EV-LSTK-002',
    'EV-LSTK-003',
    'EV-LSTK-004',
    'EV-LSTK-005',
    'EV-LSTK-006',
    'EV-LSTK-007',
    'EV-LSTK-008',
    'EV-LSTK-009',
  ],
  expenses: [
    'TX-EXP-101',
    'TX-EXP-102',
    'TX-EXP-103',
    'TX-EXP-104',
    'TX-EXP-105',
    'TX-EXP-106',
    'TX-EXP-107-CONTRA',
    'TX-EXP-108',
    'TX-EXP-109-PENDING',
  ],
  fixedAssets: ['AST-EV-001', 'AST-EV-002', 'AST-EV-003', 'AST-EV-004'],
  feedLedger: ['FD-EV-001', 'FD-EV-002', 'FD-EV-003', 'FD-EV-004', 'FD-EV-005', 'FD-EV-006'],
  auditNotifications: [
    'AUD-001',
    'AUD-002',
    'AUD-003',
    'AUD-004',
    'AUD-005',
    'AUD-006',
    'AUD-007',
    'AUD-008',
  ],
};

export function createEmptyProductionSnapshot(): AgroStateSnapshot {
  return {
    locations: [],
    members: [],
    capitalContributions: [],
    expenses: [],
    fixedAssets: [],
    livestockEntries: [],
    livestockEvents: [],
    feedLedger: [],
    auditNotifications: [],
  };
}

export function createInitialSeedSnapshot(referenceNow: Date = new Date()): AgroStateSnapshot {
  const nowMs = referenceNow.getTime();
  const daysAgoIso = (days: number, hourOffset: number = 0) =>
    new Date(nowMs - days * MS_PER_DAY + hourOffset * 3_600_000).toISOString();

  // 1. 3 Farm Locations
  const locations: FarmLocation[] = [
    {
      id: 'loc-norton-a',
      name: 'Norton Plot (Site A)',
      region: 'Mashonaland West, Zimbabwe',
      gpsCoordinates: '-17.8833, 30.7000',
      primaryOperatorName: 'Tendai M.',
      createdAt: daysAgoIso(180),
      createdBy: 'mem-chipo',
    },
    {
      id: 'loc-gweru-b',
      name: 'Gweru Homestead (Site B)',
      region: 'Midlands Province, Zimbabwe',
      gpsCoordinates: '-19.4500, 29.8167',
      primaryOperatorName: 'Tafadzwa R.',
      createdAt: daysAgoIso(175),
      createdBy: 'mem-chipo',
    },
    {
      id: 'loc-macheke-c',
      name: 'Macheke Ranch (Site C)',
      region: 'Mashonaland East, Zimbabwe',
      gpsCoordinates: '-18.1390, 31.8490',
      primaryOperatorName: 'Tendai M.',
      createdAt: daysAgoIso(120),
      createdBy: 'mem-chipo',
    },
  ];

  // 2. 4 Syndicate Members (Total Pool: $5,000)
  const members: SyndicateMember[] = [
    {
      id: 'mem-chipo',
      fullName: 'Chipo K.',
      phoneOrEmail: 'chipo.k@agrosyndicate.co.zw',
      role: 'SYNDICATE_ADMIN',
      joinedAt: daysAgoIso(180),
      active: true,
    },
    {
      id: 'mem-tendai',
      fullName: 'Tendai M.',
      phoneOrEmail: '+263 77 241 8890',
      role: 'GROUND_OPERATOR',
      assignedLocationId: 'loc-norton-a',
      joinedAt: daysAgoIso(180),
      active: true,
    },
    {
      id: 'mem-kudzi',
      fullName: 'Kudzi N.',
      phoneOrEmail: 'kudzi.treasury@agrosyndicate.co.zw',
      role: 'TREASURER',
      joinedAt: daysAgoIso(179),
      active: true,
    },
    {
      id: 'mem-tafadzwa',
      fullName: 'Tafadzwa R.',
      phoneOrEmail: '+263 71 903 4412',
      role: 'GROUND_OPERATOR',
      assignedLocationId: 'loc-gweru-b',
      joinedAt: daysAgoIso(175),
      active: true,
    },
  ];

  // 3. Capital Contributions ($5,000 total pool: Chipo $2,000 [40%], Tendai $1,200 [24%], Kudzi $1,000 [20%], Tafadzwa $800 [16%])
  const rawContributions: Omit<CapitalContributionEvent, 'auditHash'>[] = [
    {
      id: 'TX-CAP-001',
      memberId: 'mem-chipo',
      memberName: 'Chipo K.',
      direction: 'INITIAL',
      amount: 2000,
      note: 'Initial syndicate seed tranche via Stanbic USD Nostro transfer',
      createdAt: daysAgoIso(178, 1),
      createdByMemberId: 'mem-chipo',
    },
    {
      id: 'TX-CAP-002',
      memberId: 'mem-tendai',
      memberName: 'Tendai M.',
      direction: 'INITIAL',
      amount: 1200,
      note: 'Initial ground operator equity deposit — cash receipted by Treasurer',
      createdAt: daysAgoIso(178, 2),
      createdByMemberId: 'mem-kudzi',
    },
    {
      id: 'TX-CAP-003',
      memberId: 'mem-kudzi',
      memberName: 'Kudzi N.',
      direction: 'INITIAL',
      amount: 1000,
      note: 'Initial Treasurer capital pool contribution via EcoCash USD / Mukuru',
      createdAt: daysAgoIso(177, 3),
      createdByMemberId: 'mem-kudzi',
    },
    {
      id: 'TX-CAP-004',
      memberId: 'mem-tafadzwa',
      memberName: 'Tafadzwa R.',
      direction: 'INITIAL',
      amount: 800,
      note: 'Initial Gweru operator equity contribution — CBZ USD deposit',
      createdAt: daysAgoIso(175, 4),
      createdByMemberId: 'mem-kudzi',
    },
  ];

  const capitalContributions: CapitalContributionEvent[] = rawContributions.map((c) => ({
    ...c,
    auditHash: computeLedgerRecordHash('CAPITAL', c.id, c.createdAt, c.amount, c.note, c.referenceTransactionId),
  }));

  // 4. 4 Active Livestock Batches/Animals with Live Countdowns
  // - Broiler Batch #12 (Cobb 500) at Norton Plot: 300 initial birds, 4 mortalities logged (296 live), Target 6 Weeks (42 Days), currently 29 Days Old (13 Days Left to Sale).
  // - Boer Goat Breeding Herd at Norton Plot: 15 initial + 3 kids born (18 live), Target 8 Months, currently 5 Months 10 Days Old (76 Days Left to Sale).
  // - Kalahari Red Buck #GOAT-GW-01 (Individual Ear-Tag Mode) at Gweru Homestead: Target 1 Year, currently 9 Months Old.
  // - Broiler Batch #11 (Ready for Market) at Gweru Homestead: 200 birds (197 live), Target 42 Days, currently 41 Days Old (1 Day Left — Urgent Market Alert).
  const broiler12EntryDate = daysAgoIso(29);
  const boerHerdEntryDate = daysAgoIso(162); // 5 Months (~152d) + 10 Days = 162 days on farm, target 8 months (~243.5 days -> ~82 days or with initial age: let's set initialAgeValue=0, entryDate=168 days ago so 243.5 - 168 = 76 days left!)
  const boerExactEntryDate = new Date(nowMs - Math.round((8 * 30.4375 - 76) * MS_PER_DAY)).toISOString();
  const kalahariEntryDate = new Date(nowMs - Math.round(6 * 30.4375 * MS_PER_DAY)).toISOString(); // 3 months initial age + 6 months on farm = 9 months old!
  const broiler11EntryDate = daysAgoIso(41);

  const livestockEntries: LivestockEntry[] = [
    {
      id: 'LSTK-BROILER-12',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      species: 'Broilers',
      nameOrTag: 'Broiler Batch #12 (Cobb 500)',
      trackingMode: 'BATCH',
      entryDate: broiler12EntryDate,
      initialAgeValue: 0,
      initialAgeUnit: 'DAYS',
      targetDurationValue: 42,
      targetDurationUnit: 'DAYS',
      targetSaleDate: computeTargetSaleDate(broiler12EntryDate, 42, 'DAYS'),
      initialHeadcount: 300,
      purchaseCostTotal: 270,
      targetSaleWeightKg: 2.2,
      notes: 'Irvines day-old Cobb 500 chicks. High-density deep litter house #1.',
      createdByMemberName: 'Tendai M.',
      createdAt: broiler12EntryDate,
    },
    {
      id: 'LSTK-BOER-HERD-01',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      species: 'Boer Goats',
      nameOrTag: 'Boer Goat Breeding Herd',
      trackingMode: 'BATCH',
      entryDate: boerExactEntryDate,
      initialAgeValue: -5,
      initialAgeUnit: 'DAYS',
      targetDurationValue: 8,
      targetDurationUnit: 'MONTHS',
      targetSaleDate: computeTargetSaleDate(boerExactEntryDate, 8, 'MONTHS'),
      initialHeadcount: 15,
      purchaseCostTotal: 1125,
      targetSaleWeightKg: 42,
      notes: '12 breeding does + 3 young wethers on semi-intensive browse & paddock rotation.',
      createdByMemberName: 'Tendai M.',
      createdAt: boerExactEntryDate,
    },
    {
      id: 'LSTK-BUCK-GW-01',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      species: 'Boer Goats',
      nameOrTag: 'Kalahari Red Buck #GOAT-GW-01',
      trackingMode: 'INDIVIDUAL_TAG',
      entryDate: kalahariEntryDate,
      initialAgeValue: 3,
      initialAgeUnit: 'MONTHS',
      targetDurationValue: 1,
      targetDurationUnit: 'YEARS',
      targetSaleDate: computeTargetSaleDate(kalahariEntryDate, 1, 'YEARS'),
      initialHeadcount: 1,
      purchaseCostTotal: 320,
      targetSaleWeightKg: 68,
      notes: 'Pedigree Kalahari Red stud buck ear-tagged #GOAT-GW-01 for crossbreeding indigenous does.',
      createdByMemberName: 'Tafadzwa R.',
      createdAt: kalahariEntryDate,
    },
    {
      id: 'LSTK-BROILER-11',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      species: 'Broilers',
      nameOrTag: 'Broiler Batch #11 (Ready for Market)',
      trackingMode: 'BATCH',
      entryDate: broiler11EntryDate,
      initialAgeValue: 0,
      initialAgeUnit: 'DAYS',
      targetDurationValue: 42,
      targetDurationUnit: 'DAYS',
      targetSaleDate: computeTargetSaleDate(broiler11EntryDate, 42, 'DAYS'),
      initialHeadcount: 200,
      purchaseCostTotal: 180,
      targetSaleWeightKg: 2.35,
      notes: 'Ross 308 batch finished on high-energy pellets. Local abattoir & restaurant buyers booked.',
      createdByMemberName: 'Tafadzwa R.',
      createdAt: broiler11EntryDate,
    },
  ];

  // 5. Livestock Lifecycle Events (Append-Only)
  const rawLivestockEvents: Omit<LivestockLifecycleEvent, 'auditHash'>[] = [
    {
      id: 'EV-LSTK-001',
      livestockId: 'LSTK-BOER-HERD-01',
      livestockName: 'Boer Goat Breeding Herd',
      locationId: 'loc-norton-a',
      eventType: 'INITIAL_STOCK',
      headcountDelta: 15,
      weightAvgKg: 24.5,
      note: 'Initial 15 Boer goats stocked into Norton Plot elevated kraal.',
      loggedByName: 'Tendai M.',
      createdAt: boerExactEntryDate,
    },
    {
      id: 'EV-LSTK-002',
      livestockId: 'LSTK-BUCK-GW-01',
      livestockName: 'Kalahari Red Buck #GOAT-GW-01',
      locationId: 'loc-gweru-b',
      eventType: 'INITIAL_STOCK',
      headcountDelta: 1,
      weightAvgKg: 28.0,
      note: 'Initial ear-tag registration #GOAT-GW-01 upon arrival from Shangani stud.',
      loggedByName: 'Tafadzwa R.',
      createdAt: kalahariEntryDate,
    },
    {
      id: 'EV-LSTK-003',
      livestockId: 'LSTK-BROILER-11',
      livestockName: 'Broiler Batch #11 (Ready for Market)',
      locationId: 'loc-gweru-b',
      eventType: 'INITIAL_STOCK',
      headcountDelta: 200,
      weightAvgKg: 0.042,
      note: '200 day-old Ross 308 chicks placed in Gweru brooder house.',
      loggedByName: 'Tafadzwa R.',
      createdAt: broiler11EntryDate,
    },
    {
      id: 'EV-LSTK-004',
      livestockId: 'LSTK-BROILER-11',
      livestockName: 'Broiler Batch #11 (Ready for Market)',
      locationId: 'loc-gweru-b',
      eventType: 'MORTALITY_LOSS',
      headcountDelta: -3,
      note: 'First-week brooding mortality (3 weak chicks culled/lost during cold snap).',
      loggedByName: 'Tafadzwa R.',
      createdAt: daysAgoIso(35),
    },
    {
      id: 'EV-LSTK-005',
      livestockId: 'LSTK-BROILER-12',
      livestockName: 'Broiler Batch #12 (Cobb 500)',
      locationId: 'loc-norton-a',
      eventType: 'INITIAL_STOCK',
      headcountDelta: 300,
      weightAvgKg: 0.044,
      note: '300 day-old Cobb 500 chicks received at Norton Plot fowl run.',
      loggedByName: 'Tendai M.',
      createdAt: broiler12EntryDate,
    },
    {
      id: 'EV-LSTK-006',
      livestockId: 'LSTK-BOER-HERD-01',
      livestockName: 'Boer Goat Breeding Herd',
      locationId: 'loc-norton-a',
      eventType: 'BIRTH_OFFSPRING',
      headcountDelta: 3,
      weightAvgKg: 3.4,
      note: 'Twin kids born to Nanny #04 and single kid born to Nanny #07 — healthy and suckling well.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(22),
    },
    {
      id: 'EV-LSTK-007',
      livestockId: 'LSTK-BROILER-12',
      livestockName: 'Broiler Batch #12 (Cobb 500)',
      locationId: 'loc-norton-a',
      eventType: 'VACCINATION_HEALTH',
      headcountDelta: 0,
      weightAvgKg: 0.48,
      note: 'Day 14 Gumboro IBD vaccine administered in drinking water + vitamin electrolyte boost.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(15),
    },
    {
      id: 'EV-LSTK-008',
      livestockId: 'LSTK-BROILER-12',
      livestockName: 'Broiler Batch #12 (Cobb 500)',
      locationId: 'loc-norton-a',
      eventType: 'MORTALITY_LOSS',
      headcountDelta: -4,
      weightAvgKg: 1.45,
      note: '4 birds lost to acute ascites / flip-over syndrome; litter turned and ventilation opened.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(6),
    },
    {
      id: 'EV-LSTK-009',
      livestockId: 'LSTK-BROILER-11',
      livestockName: 'Broiler Batch #11 (Ready for Market)',
      locationId: 'loc-gweru-b',
      eventType: 'WEIGHT_CHECK',
      headcountDelta: 0,
      weightAvgKg: 2.28,
      note: 'Pre-market weigh-in of 25 sample birds: average 2.28 kg live weight. Ready for dispatch!',
      loggedByName: 'Tafadzwa R.',
      createdAt: daysAgoIso(1),
    },
  ];

  const livestockEvents: LivestockLifecycleEvent[] = rawLivestockEvents.map((ev) => ({
    ...ev,
    auditHash: computeLedgerRecordHash(
      'LIVESTOCK_EVENT',
      ev.id,
      ev.createdAt,
      ev.headcountDelta,
      ev.note,
      ev.referenceTransactionId
    ),
  }));

  // 6. Sample Immutable Expense Ledger & Explicit Contra-Entry Reversal Example
  // Includes 6+ realistic expenses + 1 explicit Contra-Entry Reversal example ($450 -> -$300 contra reversal) + 1 Pending Multi-Sig expense
  const rawExpenses: Omit<ExpenseLedgerEvent, 'auditHash'>[] = [
    {
      id: 'TX-EXP-101',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      category: 'FIXED_ASSET_PURCHASE',
      direction: 'DEDUCTION',
      amount: 850,
      note: '5kVA Solar Borehole Submersible Pump, 4x 450W panels & 5000L JoJo tank installation at Norton.',
      loggedByMemberId: 'mem-tendai',
      loggedByName: 'Tendai M.',
      gpsStamp: '-17.8833, 30.7000',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-chipo', 'mem-kudzi'],
      createdAt: daysAgoIso(90),
    },
    {
      id: 'TX-EXP-102',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      batchOrAnimalId: 'LSTK-BUCK-GW-01',
      category: 'LIVESTOCK_PURCHASE',
      direction: 'DEDUCTION',
      amount: 320,
      note: 'Purchase of Pedigree Kalahari Red stud buck #GOAT-GW-01 from Shangani breeders including vet permit.',
      loggedByMemberId: 'mem-tafadzwa',
      loggedByName: 'Tafadzwa R.',
      gpsStamp: '-19.4500, 29.8167',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-chipo', 'mem-kudzi'],
      createdAt: daysAgoIso(60),
    },
    {
      id: 'TX-EXP-103',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      batchOrAnimalId: 'LSTK-BROILER-12',
      category: 'LIVESTOCK_PURCHASE',
      direction: 'DEDUCTION',
      amount: 270,
      note: '300x Irvines Cobb 500 day-old chicks @ $0.90/chick delivered to Norton Plot.',
      loggedByMemberId: 'mem-tendai',
      loggedByName: 'Tendai M.',
      gpsStamp: '-17.8833, 30.7000',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-chipo', 'mem-kudzi'],
      createdAt: daysAgoIso(29),
    },
    {
      id: 'TX-EXP-104',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      batchOrAnimalId: 'LSTK-BROILER-12',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 640,
      note: '20x 50kg bags National Foods Broiler Starter Crumbles & Grower Mash for Batch #12.',
      loggedByMemberId: 'mem-tendai',
      loggedByName: 'Tendai M.',
      gpsStamp: '-17.8833, 30.7000',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-chipo', 'mem-kudzi'],
      createdAt: daysAgoIso(28),
    },
    {
      id: 'TX-EXP-105',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      batchOrAnimalId: 'LSTK-BROILER-12',
      category: 'VACCINES_MEDICATION',
      direction: 'DEDUCTION',
      amount: 45,
      note: 'Gumboro IBD vaccine vials, Newcastle LaSota doses, stress pack & virukill disinfectant.',
      loggedByMemberId: 'mem-tendai',
      loggedByName: 'Tendai M.',
      gpsStamp: '-17.8833, 30.7000',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-tendai'],
      createdAt: daysAgoIso(16),
    },
    {
      id: 'TX-EXP-106',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      category: 'MAINTENANCE',
      direction: 'DEDUCTION',
      amount: 450,
      note: 'High-tensile barbed wire rolls & treated gum poles for Gweru goat paddock perimeter (logged at $450 in error instead of $150 invoice).',
      loggedByMemberId: 'mem-tafadzwa',
      loggedByName: 'Tafadzwa R.',
      gpsStamp: '-19.4500, 29.8167',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-chipo', 'mem-kudzi'],
      createdAt: daysAgoIso(10),
    },
    {
      id: 'TX-EXP-107-CONTRA',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      category: 'MAINTENANCE',
      direction: 'CONTRA_REVERSAL',
      amount: -300,
      referenceTransactionId: 'TX-EXP-106',
      note: 'CONTRA-ENTRY REVERSAL for TX-EXP-106: Operator typed $450 instead of actual hardware invoice of $150. Restoring +$300.00 to Left Money.',
      loggedByMemberId: 'mem-kudzi',
      loggedByName: 'Kudzi N.',
      gpsStamp: '-19.4500, 29.8167',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-kudzi', 'mem-chipo'],
      createdAt: daysAgoIso(9),
    },
    {
      id: 'TX-EXP-108',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      batchOrAnimalId: 'LSTK-BROILER-11',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 140,
      note: '4x 50kg bags Broiler Finisher Pellets for Gweru Batch #11 final week finishing.',
      loggedByMemberId: 'mem-tafadzwa',
      loggedByName: 'Tafadzwa R.',
      gpsStamp: '-19.4500, 29.8167',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-tafadzwa'],
      createdAt: daysAgoIso(7),
    },
    {
      id: 'TX-EXP-109-PENDING',
      locationId: 'loc-macheke-c',
      locationName: 'Macheke Ranch (Site C)',
      category: 'FENCING_SECURITY',
      direction: 'DEDUCTION',
      amount: 280,
      note: 'Solar floodlights & night-watchman barbed wire reinforcement for Macheke cattle kraal (> $150 requires Treasurer/Admin multi-sig).',
      loggedByMemberId: 'mem-tendai',
      loggedByName: 'Tendai M.',
      gpsStamp: '-18.1390, 31.8490',
      approvalStatus: 'PENDING_MULTISIG',
      approvedByMemberIds: ['mem-tendai'],
      createdAt: daysAgoIso(1),
    },
  ];

  const expenses: ExpenseLedgerEvent[] = rawExpenses.map((e) => ({
    ...e,
    auditHash: computeLedgerRecordHash(
      'EXPENSE',
      e.id,
      e.createdAt,
      e.amount,
      e.note,
      e.referenceTransactionId
    ),
  }));

  // 7. Fixed Assets ($1,200 Poultry Fowl Run, $850 Solar Borehole, $650 Goat Kraal & Dip, $240 Tubular Feeders & Drinkers)
  const rawAssets: Omit<FixedAssetLedgerEvent, 'auditHash'>[] = [
    {
      id: 'AST-EV-001',
      assetGroupId: 'AGRP-FOWL-RUN-01',
      assetName: 'Brick & IBR Poultry Fowl Run (500-Bird Capacity)',
      category: 'HOUSING_INFRASTRUCTURE',
      locationId: 'loc-norton-a',
      direction: 'INITIAL',
      quantityDelta: 1,
      valueDelta: 1200,
      condition: 'EXCELLENT',
      note: 'Constructed 500-bird ventilated broiler house with concrete floor and side curtains at Norton Plot.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(150),
    },
    {
      id: 'AST-EV-002',
      assetGroupId: 'AGRP-SOLAR-BOREHOLE-01',
      assetName: '5kVA Solar Borehole System & 5000L JoJo Tank',
      category: 'WATER_SOLAR',
      locationId: 'loc-norton-a',
      direction: 'INITIAL',
      quantityDelta: 1,
      valueDelta: 850,
      condition: 'EXCELLENT',
      note: 'Installed submersible solar pump, 4x 450W monocrystalline panels & elevated 5000L tank.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(90),
    },
    {
      id: 'AST-EV-003',
      assetGroupId: 'AGRP-GOAT-KRAAL-01',
      assetName: 'Elevated Timber Goat Kraal & Concrete Footbath Dip',
      category: 'HOUSING_INFRASTRUCTURE',
      locationId: 'loc-gweru-b',
      direction: 'INITIAL',
      quantityDelta: 1,
      valueDelta: 650,
      condition: 'GOOD',
      note: 'Slatted-floor predator-proof goat kraal and tick dip race at Gweru Homestead.',
      loggedByName: 'Tafadzwa R.',
      createdAt: daysAgoIso(110),
    },
    {
      id: 'AST-EV-004',
      assetGroupId: 'AGRP-FEEDERS-01',
      assetName: '30x Tubular Feeders & Automatic Bell Drinkers Set',
      category: 'FEEDERS_EQUIPMENT',
      locationId: 'loc-norton-a',
      direction: 'INITIAL',
      quantityDelta: 30,
      valueDelta: 240,
      condition: 'GOOD',
      note: '15 heavy-duty 12kg tubular feeders + 15 automatic bell drinkers for poultry runs.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(140),
    },
  ];

  const fixedAssets: FixedAssetLedgerEvent[] = rawAssets.map((a) => ({
    ...a,
    auditHash: computeLedgerRecordHash(
      'ASSET',
      a.id,
      a.createdAt,
      a.valueDelta,
      a.note,
      a.referenceTransactionId
    ),
  }));

  // 8. Feed Inventory Ledger Events
  const rawFeed: Omit<FeedLedgerEvent, 'auditHash'>[] = [
    {
      id: 'FD-EV-001',
      locationId: 'loc-norton-a',
      feedType: 'Broiler Starter & Grower Mash',
      direction: 'STOCK_IN',
      bagsDelta: 20,
      kgPerBag: 50,
      linkedLivestockId: 'LSTK-BROILER-12',
      note: 'Stocked in 20x 50kg bags National Foods Starter & Grower Mash at Norton store.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(28),
    },
    {
      id: 'FD-EV-002',
      locationId: 'loc-norton-a',
      feedType: 'Broiler Starter & Grower Mash',
      direction: 'DAILY_CONSUMPTION',
      bagsDelta: -11.5,
      kgPerBag: 50,
      linkedLivestockId: 'LSTK-BROILER-12',
      note: 'Cumulative 28-day feed issue for 296 Cobb 500 broilers in House #1.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(3),
    },
    {
      id: 'FD-EV-003',
      locationId: 'loc-norton-a',
      feedType: 'Goat Lucerne & Boer Concentrate',
      direction: 'STOCK_IN',
      bagsDelta: 12,
      kgPerBag: 40,
      linkedLivestockId: 'LSTK-BOER-HERD-01',
      note: 'Stocked 12x 40kg bags goat lactation & kid creep pellets at Norton.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(25),
    },
    {
      id: 'FD-EV-004',
      locationId: 'loc-norton-a',
      feedType: 'Goat Lucerne & Boer Concentrate',
      direction: 'DAILY_CONSUMPTION',
      bagsDelta: -4.5,
      kgPerBag: 40,
      linkedLivestockId: 'LSTK-BOER-HERD-01',
      note: 'Supplementary feeding for nursing nannies and 3 newborn kids.',
      loggedByName: 'Tendai M.',
      createdAt: daysAgoIso(2),
    },
    {
      id: 'FD-EV-005',
      locationId: 'loc-gweru-b',
      feedType: 'Broiler Finisher Pellets',
      direction: 'STOCK_IN',
      bagsDelta: 14,
      kgPerBag: 50,
      linkedLivestockId: 'LSTK-BROILER-11',
      note: 'Stocked 14x 50kg bags Finisher Pellets for Gweru Batch #11.',
      loggedByName: 'Tafadzwa R.',
      createdAt: daysAgoIso(18),
    },
    {
      id: 'FD-EV-006',
      locationId: 'loc-gweru-b',
      feedType: 'Broiler Finisher Pellets',
      direction: 'DAILY_CONSUMPTION',
      bagsDelta: -11.5,
      kgPerBag: 50,
      linkedLivestockId: 'LSTK-BROILER-11',
      note: 'Finishing ration consumed by 197 Ross 308 birds approaching Day 42 market weight.',
      loggedByName: 'Tafadzwa R.',
      createdAt: daysAgoIso(1),
    },
  ];

  const feedLedger: FeedLedgerEvent[] = rawFeed.map((f) => ({
    ...f,
    auditHash: computeLedgerRecordHash(
      'FEED',
      f.id,
      f.createdAt,
      f.bagsDelta,
      f.note,
      f.referenceTransactionId
    ),
  }));

  // 9. Build Cryptographically Hash-Chained Audit & Notification Stream from Genesis
  const seedNotificationsInput: {
    id: string;
    timestamp: string;
    actorId: string;
    actorName: string;
    actorRole: Role;
    locationId: string;
    locationName: string;
    eventType: AuditEventType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    deltaFinancial?: number;
    deltaHeadcount?: number;
    referenceEntityId?: string;
    readByMemberIds: string[];
  }[] = [
    {
      id: 'AUD-001',
      timestamp: daysAgoIso(178, 1),
      actorId: 'mem-chipo',
      actorName: 'Chipo K.',
      actorRole: 'SYNDICATE_ADMIN',
      locationId: 'ALL',
      locationName: 'All Locations (Master Syndicate)',
      eventType: 'CAPITAL_CONTRIBUTION',
      severity: 'FINANCIAL',
      title: 'Syndicate Pool Initialized ($5,000.00)',
      message:
        '4 members contributed $5,000.00 total seed capital: Chipo K. ($2,000 / 40%), Tendai M. ($1,200 / 24%), Kudzi N. ($1,000 / 20%), Tafadzwa R. ($800 / 16%).',
      deltaFinancial: 5000,
      referenceEntityId: 'TX-CAP-001',
      readByMemberIds: ['mem-chipo', 'mem-tendai', 'mem-kudzi', 'mem-tafadzwa'],
    },
    {
      id: 'AUD-002',
      timestamp: daysAgoIso(90),
      actorId: 'mem-tendai',
      actorName: 'Tendai M.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      eventType: 'ASSET_LOGGED',
      severity: 'FINANCIAL',
      title: '5kVA Solar Borehole Installed ($850.00)',
      message:
        'Installed 5kVA Solar Borehole Submersible Pump, 4x 450W panels & 5000L JoJo tank at Norton Plot.',
      deltaFinancial: -850,
      referenceEntityId: 'TX-EXP-101',
      readByMemberIds: ['mem-chipo', 'mem-tendai', 'mem-kudzi', 'mem-tafadzwa'],
    },
    {
      id: 'AUD-003',
      timestamp: daysAgoIso(29),
      actorId: 'mem-tendai',
      actorName: 'Tendai M.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      eventType: 'LIVESTOCK_REGISTERED',
      severity: 'MILESTONE',
      title: 'Broiler Batch #12 Stocked (300 Cobb 500 Chicks)',
      message:
        '300 day-old Irvines Cobb 500 chicks placed at Norton Plot. Target cycle: 42 Days (6 Weeks). Purchase cost $270.00 deducted from Left Money.',
      deltaFinancial: -270,
      deltaHeadcount: 300,
      referenceEntityId: 'LSTK-BROILER-12',
      readByMemberIds: ['mem-chipo', 'mem-tendai', 'mem-kudzi'],
    },
    {
      id: 'AUD-004',
      timestamp: daysAgoIso(22),
      actorId: 'mem-tendai',
      actorName: 'Tendai M.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      eventType: 'LIVESTOCK_BIRTH',
      severity: 'MILESTONE',
      title: '+3 Boer Goat Kids Born at Norton Plot',
      message:
        'Twin kids born to Nanny #04 and single kid born to Nanny #07. Boer Breeding Herd live headcount increased from 15 to 18 at $0 purchase cost.',
      deltaHeadcount: 3,
      referenceEntityId: 'EV-LSTK-006',
      readByMemberIds: ['mem-chipo', 'mem-tendai', 'mem-kudzi'],
    },
    {
      id: 'AUD-005',
      timestamp: daysAgoIso(10),
      actorId: 'mem-tafadzwa',
      actorName: 'Tafadzwa R.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      eventType: 'EXPENSE_LOGGED',
      severity: 'FINANCIAL',
      title: 'Fence Maintenance Logged ($450.00)',
      message:
        'TX-EXP-106: High-tensile barbed wire rolls & treated gum poles for Gweru goat paddock perimeter.',
      deltaFinancial: -450,
      referenceEntityId: 'TX-EXP-106',
      readByMemberIds: ['mem-chipo', 'mem-kudzi', 'mem-tafadzwa'],
    },
    {
      id: 'AUD-006',
      timestamp: daysAgoIso(9),
      actorId: 'mem-kudzi',
      actorName: 'Kudzi N.',
      actorRole: 'TREASURER',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      eventType: 'EXPENSE_CONTRA',
      severity: 'WARNING_CONTRA',
      title: 'Contra-Entry Reversal (+$300.00 to Left Money)',
      message:
        'TX-EXP-107-CONTRA linked to TX-EXP-106: Operator typed $450 instead of actual hardware invoice of $150. Restoring +$300.00 to Left Money without altering original record.',
      deltaFinancial: 300,
      referenceEntityId: 'TX-EXP-107-CONTRA',
      readByMemberIds: ['mem-chipo', 'mem-kudzi'],
    },
    {
      id: 'AUD-007',
      timestamp: daysAgoIso(6),
      actorId: 'mem-tendai',
      actorName: 'Tendai M.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-norton-a',
      locationName: 'Norton Plot (Site A)',
      eventType: 'LIVESTOCK_MORTALITY',
      severity: 'URGENT_GROUND',
      title: 'Mortality Alert: -4 Birds in Broiler Batch #12',
      message:
        '4 birds lost to acute ascites / flip-over syndrome; litter turned and side curtains opened. Live count now 296 / 300 (1.33% mortality).',
      deltaHeadcount: -4,
      referenceEntityId: 'EV-LSTK-008',
      readByMemberIds: ['mem-tendai'],
    },
    {
      id: 'AUD-008',
      timestamp: daysAgoIso(1),
      actorId: 'mem-tafadzwa',
      actorName: 'Tafadzwa R.',
      actorRole: 'GROUND_OPERATOR',
      locationId: 'loc-gweru-b',
      locationName: 'Gweru Homestead (Site B)',
      eventType: 'GROUND_BROADCAST',
      severity: 'URGENT_GROUND',
      title: 'Gweru Batch #11 at Day 41 (1 Day to Market!)',
      message:
        'Sample weigh-in hit 2.28kg average across 197 live birds in Gweru Homestead. Midlands wholesale buyer confirmed pickup tomorrow morning at $6.00/bird.',
      referenceEntityId: 'LSTK-BROILER-11',
      readByMemberIds: ['mem-tafadzwa'],
    },
  ];

  const auditNotifications: AuditNotificationEvent[] = [];
  let prevHash = GENESIS_SHORT;

  seedNotificationsInput.forEach((item, index) => {
    const sequenceNumber = index + 1;
    const currentHash = computeAuditEventHash({
      previousHash: prevHash,
      timestamp: item.timestamp,
      actorId: item.actorId,
      locationId: item.locationId,
      eventType: item.eventType,
      payloadSummary: `${item.title}::${item.message}`,
    });

    auditNotifications.push({
      ...item,
      sequenceNumber,
      previousHash: prevHash,
      currentHash,
    });

    prevHash = currentHash;
  });

  return {
    locations,
    members,
    capitalContributions,
    expenses,
    fixedAssets,
    livestockEntries,
    livestockEvents,
    feedLedger,
    auditNotifications: auditNotifications.reverse(), // Latest first for UI feed; verifier sorts by sequenceNumber
  };
}
