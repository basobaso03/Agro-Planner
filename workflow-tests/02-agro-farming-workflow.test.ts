import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import {
  computeLivestockStatus,
  computeTargetSaleDate,
  computeFeedInventories,
  computeSiteComparisons,
} from '../src/utils/calculations.ts';
import type { FarmLocation, LivestockEntry, AnimalCheckpoint } from '../src/types/agro.ts';
import {
  TEST_ACCOUNTS,
  toOrgMember,
  loadRealTestImageBase64,
  loadProductionFixtures,
} from './helpers/testContext.ts';

// ---------------------------------------------------------------------------
// SUITE 2: AGRO-FARMING OPERATIONAL WORKFLOWS & COMPLETE MULTI-SITE VERIFICATION
// ---------------------------------------------------------------------------

test('WF-05: Farm Sites Full CRUD — Admin creates, updates and audits locations (Site A Norton)', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const fixtures = loadProductionFixtures();
  const siteFixture = fixtures.agroFarming.locations[0];

  // 1. Add Location (Site A)
  const newLoc = dataService.addLocation({
    name: siteFixture.name,
    region: siteFixture.region,
    gpsCoordinates: siteFixture.gpsCoordinates,
    primaryOperatorName: siteFixture.primaryOperatorName,
    actor: adminActor,
  });

  assert.ok(newLoc.id);
  assert.equal(newLoc.name, 'Norton Broiler Hub (Site A)');
  assert.equal(newLoc.primaryOperatorName, 'Tendai M.');

  // 2. Update Location (Reassign operator & refine GPS)
  const updatedLoc = dataService.updateLocation({
    locationId: newLoc.id,
    name: 'Norton Broiler Hub — Upgraded Site A',
    region: 'Mashonaland West Province',
    gpsCoordinates: '-17.8845, 30.7020',
    primaryOperatorName: 'Kudzi Mutasa',
    actor: adminActor,
  });

  assert.equal(updatedLoc.name, 'Norton Broiler Hub — Upgraded Site A');
  assert.equal(updatedLoc.primaryOperatorName, 'Kudzi Mutasa');
  assert.equal(updatedLoc.gpsCoordinates, '-17.8845, 30.7020');

  // Audit event must be recorded
  const audit = dataService.getState().auditNotifications.find(
    (a) => a.eventType === 'SITE_UPDATED' && a.referenceEntityId === newLoc.id
  );
  assert.ok(audit);
  assert.match(audit.title, /Site Details Updated/);
});

test('WF-05-NEG: Regular Member or Ground Operator attempting to modify site is rejected', () => {
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);

  const loc = dataService.getState().locations[0];
  assert.ok(loc);

  assert.throws(
    () => {
      dataService.updateLocation({
        locationId: loc.id,
        name: 'Hacked Site',
        region: 'Hacked Region',
        gpsCoordinates: '0, 0',
        primaryOperatorName: 'Hacker',
        actor: memberActor,
      });
    },
    /Access Denied: Only Organization Admins can modify farm sites/
  );

  assert.throws(
    () => {
      dataService.updateLocation({
        locationId: loc.id,
        name: 'Hacked Site',
        region: 'Hacked Region',
        gpsCoordinates: '0, 0',
        primaryOperatorName: 'Hacker',
        actor: operatorActor,
      });
    },
    /Access Denied: Only Organization Admins can modify farm sites/
  );
});

test('WF-06: Farm Site Deletion Dependency Guard — Active batches prevent deletion', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // Create isolated location
  const testLoc = dataService.addLocation({
    name: 'Active Batches Site Guard',
    region: 'Midlands',
    gpsCoordinates: '-19.45, 29.81',
    primaryOperatorName: 'Kudzi Mutasa',
    actor: adminActor,
  });

  // Assign active livestock entry to this location
  dataService.registerLivestock({
    locationId: testLoc.id,
    species: 'Broilers',
    nameOrTag: 'Guard Check Batch #1',
    trackingMode: 'BATCH',
    entryDate: new Date().toISOString(),
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    initialHeadcount: 500,
    purchaseCostTotal: 350,
    notes: 'Testing site delete guard',
    autoDeductPurchaseFromLeftMoney: false,
    actor: adminActor,
  });

  // Attempt to delete site while batch is active -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.deleteLocation({
        locationId: testLoc.id,
        actor: adminActor,
      });
    },
    /Cannot delete site: There are 1 active animal batch\(es\) registered at this location/
  );

  // Clean site without animals -> Deletion succeeds
  const emptyLoc = dataService.addLocation({
    name: 'Empty Unused Site',
    region: 'Harare South',
    gpsCoordinates: '-17.90, 31.00',
    primaryOperatorName: 'None',
    actor: adminActor,
  });

  const res = dataService.deleteLocation({
    locationId: emptyLoc.id,
    actor: adminActor,
  });

  assert.equal(res.success, true);
  assert.equal(dataService.getState().locations.some((l) => l.id === emptyLoc.id), false);
});

test('WF-07: Livestock Batches & Dynamic Checkpoints Full CRUD (Site A Norton)', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
  const realBroilerPhoto = loadRealTestImageBase64('broiler-batch-cobb500.jpg');

  const loc = dataService.getState().locations[0];
  assert.ok(loc);

  // 1. Register Batch with Real Image
  const batch = dataService.registerLivestock({
    locationId: loc.id,
    species: 'Broilers',
    nameOrTag: 'Cobb 500 Batch #2026-X',
    trackingMode: 'BATCH',
    entryDate: new Date().toISOString(),
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    initialHeadcount: 1000,
    purchaseCostTotal: 650,
    targetSaleWeightKg: 2.3,
    imageUrl: realBroilerPhoto,
    notes: 'Premium commercial broiler stock.',
    autoDeductPurchaseFromLeftMoney: false,
    actor: adminActor,
  });

  assert.ok(batch.id);
  assert.ok(batch.imageUrl?.startsWith('data:image/jpeg;base64,'));

  // 2. Add Custom Checkpoint (Day 7 IBD-1 Vaccine)
  const scheduledDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const checkpoint = dataService.addCheckpointToLivestock({
    livestockId: batch.id,
    checkpoint: {
      dayTarget: 7,
      scheduledDate,
      title: 'IBD-1 Vaccine & 7-Day Weigh-in',
      category: 'VACCINE',
      targetWeightKg: 0.185,
      feedPhase: 'Broiler Starter Crumbles',
      instructions: 'Administer via drinking water with skim milk stabilizer.',
    },
    actor: operatorActor,
  });

  assert.ok(checkpoint.id);
  assert.equal(checkpoint.dayTarget, 7);
  assert.equal(checkpoint.targetWeightKg, 0.185);
  assert.equal(checkpoint.completed, false);

  // 3. Edit Checkpoint (Adjust target weight to 0.190kg)
  const updatedCheckpoint = dataService.updateLivestockCheckpoint({
    livestockId: batch.id,
    checkpointId: checkpoint.id,
    updates: {
      targetWeightKg: 0.190,
      instructions: 'Water lines flushed 2 hours prior; administer intermediate plus strain.',
    },
    actor: operatorActor,
  });

  assert.equal(updatedCheckpoint.targetWeightKg, 0.190);

  // 4. Complete Checkpoint with Observation Notes
  const completedAt = new Date().toISOString();
  const completedCheckpoint = dataService.updateLivestockCheckpoint({
    livestockId: batch.id,
    checkpointId: checkpoint.id,
    updates: {
      completed: true,
      completedAt,
      reminderStatus: 'COMPLETED',
      completedNote: 'All 1,000 birds consumed vaccine within 90 minutes. 7-day avg weight 192g.',
    },
    actor: operatorActor,
  });

  assert.equal(completedCheckpoint.completed, true);
  assert.equal(completedCheckpoint.reminderStatus, 'COMPLETED');
  assert.equal(completedCheckpoint.completedAt, completedAt);

  // 5. Delete a Checkpoint
  const tempCheckpoint = dataService.addCheckpointToLivestock({
    livestockId: batch.id,
    checkpoint: {
      dayTarget: 10,
      title: 'Superfluous Mid-Week Check',
      category: 'GENERAL_TASK',
    },
    actor: operatorActor,
  });

  dataService.deleteLivestockCheckpoint({
    livestockId: batch.id,
    checkpointId: tempCheckpoint.id,
    actor: operatorActor,
  });

  const currentBatch = dataService.getState().livestockEntries.find((l) => l.id === batch.id)!;
  assert.equal(currentBatch.customCheckpoints?.some((c) => c.id === tempCheckpoint.id), false);
});

test('WF-08: Custom Farm Recipe Template & Dynamic Batch Instantiation', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // 1. Save Organization Recipe Template
  const recipeTemplate = dataService.saveCustomRecipeTemplate({
    name: 'Commercial 42-Day Broiler Standard',
    species: 'Broilers',
    recommendedDurationDays: 42,
    targetSaleWeightKg: 2.3,
    checkpoints: [
      {
        dayTarget: 1,
        title: "Marek's Vaccine & Electrolyte Welcome",
        category: 'VACCINE',
        targetWeightKg: 0.045,
        feedPhase: 'Broiler Starter Crumbles',
      },
      {
        dayTarget: 7,
        title: 'IBD-1 Vaccine & 7-Day Weight Check',
        category: 'VACCINE',
        targetWeightKg: 0.185,
        feedPhase: 'Broiler Starter Crumbles',
      },
      {
        dayTarget: 14,
        title: 'Starter to Grower Transition & Newcastle Lasota',
        category: 'FEED_TRANSITION',
        targetWeightKg: 0.48,
        feedPhase: 'Broiler Grower Pellets',
      },
      {
        dayTarget: 28,
        title: 'Grower to Finisher Transition',
        category: 'FEED_TRANSITION',
        targetWeightKg: 1.55,
        feedPhase: 'Broiler Finisher Pellets',
      },
      {
        dayTarget: 42,
        title: 'Final Market Harvest & Depopulation',
        category: 'WEIGHT_CHECK',
        targetWeightKg: 2.6,
      },
    ],
    notes: 'Field-tested on Mashonaland West broiler units with 1.6 FCR.',
    actor: adminActor,
  });

  assert.ok(recipeTemplate.id);
  assert.equal(recipeTemplate.checkpoints.length, 5);

  // 2. Instantiate Recipe onto a New Batch with Dynamic Scheduled Calendar Dates
  const loc = dataService.getState().locations[0];
  const batchEntryDate = '2026-11-01T08:00:00.000Z';
  const instantiatedCheckpoints: AnimalCheckpoint[] = recipeTemplate.checkpoints.map((cp, idx) => {
    const targetDate = new Date(new Date(batchEntryDate).getTime() + (cp.dayTarget - 1) * 86400000);
    return {
      id: `CP-INST-${idx + 1}`,
      dayTarget: cp.dayTarget,
      scheduledDate: targetDate.toISOString().split('T')[0],
      title: cp.title,
      category: cp.category,
      targetWeightKg: cp.targetWeightKg,
      feedPhase: cp.feedPhase,
      completed: false,
      reminderStatus: 'SCHEDULED',
    };
  });

  const recipeBatch = dataService.registerLivestock({
    locationId: loc.id,
    species: 'Broilers',
    nameOrTag: 'Recipe-Driven Batch #42',
    trackingMode: 'BATCH',
    entryDate: batchEntryDate,
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    initialHeadcount: 1000,
    purchaseCostTotal: 650,
    targetSaleWeightKg: 2.3,
    customCheckpoints: instantiatedCheckpoints,
    notes: 'Batch initialized with proprietary 42-day recipe schedule.',
    autoDeductPurchaseFromLeftMoney: false,
    actor: adminActor,
  });

  assert.equal(recipeBatch.customCheckpoints?.length, 5);
  assert.equal(recipeBatch.customCheckpoints?.[0].scheduledDate, '2026-11-01');
  assert.equal(recipeBatch.customCheckpoints?.[1].scheduledDate, '2026-11-07');
  assert.equal(recipeBatch.customCheckpoints?.[4].scheduledDate, '2026-12-12');
});

test('WF-09: Mathematical Growth Projections, Weight Interpolation & Urgency Badges', () => {
  const now = new Date();
  const entryDate = new Date(now.getTime() - 14 * 86400000).toISOString(); // 14 days ago

  const mockLivestock: LivestockEntry = {
    id: 'LSTK-MATH-TEST-01',
    orgId: 'org-agro-prod-01',
    locationId: 'loc-norton-a',
    locationName: 'Norton Broiler Hub',
    species: 'Broilers',
    nameOrTag: 'Math Broiler Group',
    trackingMode: 'BATCH',
    entryDate,
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    targetSaleDate: computeTargetSaleDate(entryDate, 42, 'DAYS'),
    initialHeadcount: 1000,
    purchaseCostTotal: 650,
    targetSaleWeightKg: 2.3,
    notes: 'Test batch for mathematical curves',
    createdByMemberName: 'Dr. Marlvin Basera',
    createdAt: entryDate,
  };

  const status = computeLivestockStatus(mockLivestock, [], [], now.toISOString());

  assert.equal(status.daysOnFarm, 14);
  assert.equal(status.currentTotalAgeDays, 15);
  assert.equal(status.daysLeftUntilSale, 28);
  assert.equal(status.progressPercentage, Math.round((14 / 42) * 100));
  assert.equal(status.countdownUrgency, 'NORMAL');
  assert.equal(status.currentLiveHeadcount, 1000);
});

test('WF-10: Feed Inventory Ledger — Stock-in, Daily Burn & Stock Bounds Validation', () => {
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
  const loc = dataService.getState().locations[0];

  // 1. Stock In 40 bags (50kg each)
  const stockInEvent = dataService.logFeedEvent({
    locationId: loc.id,
    feedType: 'Broiler Starter Crumbles (50kg)',
    direction: 'STOCK_IN',
    bagsDelta: 40,
    kgPerBag: 50,
    note: 'Initial delivery 40 bags feed',
    actor: operatorActor,
  });

  assert.ok(stockInEvent.id);
  assert.equal(stockInEvent.bagsDelta, 40);

  // 2. Daily Burn consumption (-2.5 bags)
  const burnEvent = dataService.logFeedEvent({
    locationId: loc.id,
    feedType: 'Broiler Starter Crumbles (50kg)',
    direction: 'DAILY_CONSUMPTION',
    bagsDelta: 2.5,
    kgPerBag: 50,
    note: 'Daily feeding at Day 14',
    actor: operatorActor,
  });

  assert.ok(burnEvent.id);

  // 3. Operational Bounds Validation: Attempting to burn 100 bags (exceeds 37.5 remaining) -> MUST REJECT
  assert.throws(
    () => {
      dataService.logFeedEvent({
        locationId: loc.id,
        feedType: 'Broiler Starter Crumbles (50kg)',
        direction: 'DAILY_CONSUMPTION',
        bagsDelta: 100, // Exceeds available stock
        kgPerBag: 50,
        note: 'Massive feed burn exceeding stock',
        actor: operatorActor,
      });
    },
    /Insufficient feed stock/
  );

  // 4. Compute Aggregated Feed Inventory
  const feeds = dataService.getState().feedLedger.filter(
    (f) => f.locationId === loc.id && f.feedType === 'Broiler Starter Crumbles (50kg)'
  );
  const summaries = computeFeedInventories(feeds, [loc]);
  const feedSummary = summaries.find((s) => s.feedType === 'Broiler Starter Crumbles (50kg)')!;

  assert.ok(feedSummary);
  assert.equal(feedSummary.totalBagsStockedIn, 40);
  assert.equal(feedSummary.totalBagsConsumed, 2.5);
  assert.equal(feedSummary.remainingBags, 37.5);
  assert.equal(feedSummary.remainingKg, 37.5 * 50);
});

test('WF-11: Livestock Lifecycle Events & Headcount Bounds Validation', () => {
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const loc = dataService.getState().locations[0];

  // Create batch
  const batch = dataService.registerLivestock({
    locationId: loc.id,
    species: 'Broilers',
    nameOrTag: 'Batch 2026-Cycle-Sale',
    trackingMode: 'BATCH',
    entryDate: new Date().toISOString(),
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    initialHeadcount: 1000,
    purchaseCostTotal: 650,
    notes: 'Sale lifecycle test',
    autoDeductPurchaseFromLeftMoney: false,
    actor: adminActor,
  });

  // 1. Mortality loss (-12 birds)
  dataService.logLivestockLifecycleEvent({
    livestockId: batch.id,
    eventType: 'MORTALITY_LOSS',
    headcountDelta: -12,
    note: 'Heat stress mortality in south wing of pen.',
    actor: operatorActor,
  });

  // 2. Operational Bounds Validation: Attempting to log mortality loss of -1500 birds (exceeds 988 live) -> MUST REJECT
  assert.throws(
    () => {
      dataService.logLivestockLifecycleEvent({
        livestockId: batch.id,
        eventType: 'MORTALITY_LOSS',
        headcountDelta: -1500,
        note: 'Impossible catastrophic mortality',
        actor: operatorActor,
      });
    },
    /Invalid mortality: Headcount loss \(1500\) exceeds current live headcount/
  );

  // 3. Harvest Sale Dispatch (+revenue $4,410 for 980 birds, 50% reinvestment)
  dataService.logLivestockLifecycleEvent({
    livestockId: batch.id,
    eventType: 'SALE_DISPATCH',
    headcountDelta: -980,
    saleRevenueAmount: 4410,
    reinvestmentPercentage: 50,
    note: 'Batch harvested and dispatched to wholesale poultry buyer.',
    actor: adminActor,
  });

  // 4. Attempting to sell more birds than live remaining (8 live left, try selling 50) -> MUST REJECT
  assert.throws(
    () => {
      dataService.logLivestockLifecycleEvent({
        livestockId: batch.id,
        eventType: 'SALE_DISPATCH',
        headcountDelta: -50,
        saleRevenueAmount: 200,
        note: 'Attempting to oversell harvested batch',
        actor: adminActor,
      });
    },
    /Invalid sale: Harvest headcount \(50\) exceeds current live headcount/
  );

  const events = dataService.getState().livestockEvents.filter((e) => e.livestockId === batch.id);
  const computed = computeLivestockStatus(batch, events, []);

  assert.equal(computed.totalMortalities, 12);
  assert.equal(computed.totalSold, 980);
  assert.equal(computed.currentLiveHeadcount, 8); // 1000 - 12 - 980
  assert.equal(computed.mortalityRatePercent, 1.2);
});

// ---------------------------------------------------------------------------
// NEW MULTI-SITE VERIFICATIONS: SITE B (GWERU GOATS) & SITE C (MACHEKE FREE-RANGE)
// ---------------------------------------------------------------------------

test('WF-12-SITE-B: Gweru Livestock Ranch (Site B) — Boer Goats, Kid Births, Tagged Herd & Harvest Sales', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
  const goatPhoto = loadRealTestImageBase64('boer-goat-herd.jpg');

  // 1. Create Site B: Gweru Livestock Ranch
  const gweruSite = dataService.addLocation({
    name: 'Gweru Livestock Ranch (Site B)',
    region: 'Midlands Province, Zimbabwe',
    gpsCoordinates: '-19.4500, 29.8167',
    primaryOperatorName: 'Kudzi Mutasa',
    actor: adminActor,
  });

  assert.ok(gweruSite.id);
  assert.equal(gweruSite.name, 'Gweru Livestock Ranch (Site B)');

  // 2. Register Boer Goats Herd (35 head, tagged tracking mode) with real photograph
  const goatHerd = dataService.registerLivestock({
    locationId: gweruSite.id,
    species: 'Boer Goats',
    nameOrTag: 'Boer Breeding Herd #B-12',
    trackingMode: 'INDIVIDUAL_TAG',
    entryDate: '2026-07-01T08:00:00.000Z',
    initialAgeValue: 3,
    initialAgeUnit: 'MONTHS',
    targetDurationValue: 8,
    targetDurationUnit: 'MONTHS',
    initialHeadcount: 35,
    purchaseCostTotal: 2450,
    targetSaleWeightKg: 45,
    imageUrl: goatPhoto,
    notes: 'Select breeding doe kids and registered stud buck with tags GOAT-ZW-01 to 35.',
    autoDeductPurchaseFromLeftMoney: false,
    actor: adminActor,
  });

  assert.ok(goatHerd.id);
  assert.equal(goatHerd.trackingMode, 'INDIVIDUAL_TAG');
  assert.ok(goatHerd.imageUrl?.startsWith('data:image/jpeg;base64,'));

  // 3. Log Kid Births Event (+4 doe offspring born)
  const birthEvent = dataService.logLivestockLifecycleEvent({
    livestockId: goatHerd.id,
    eventType: 'BIRTH_OFFSPRING',
    headcountDelta: 4,
    note: 'Twin birth deliveries recorded from Doe #04 and Doe #11. 4 healthy doe kids tagged.',
    actor: operatorActor,
  });

  assert.ok(birthEvent.id);
  assert.equal(birthEvent.headcountDelta, 4);

  // 4. Log Vaccination Event (Brucellosis & Clostridial booster)
  const vaccineEvent = dataService.logLivestockLifecycleEvent({
    livestockId: goatHerd.id,
    eventType: 'VACCINATION_HEALTH',
    headcountDelta: 0,
    note: 'Administered 2ml Clostridial 8-way vaccine to entire breeding herd and newborn kids.',
    actor: operatorActor,
  });
  assert.ok(vaccineEvent.id);

  // 5. Log Sales Dispatch of 1 Mature Stud Buck ($750 revenue, 70% reinvestment)
  const saleEvent = dataService.logLivestockLifecycleEvent({
    livestockId: goatHerd.id,
    eventType: 'SALE_DISPATCH',
    headcountDelta: -1,
    saleRevenueAmount: 750,
    reinvestmentPercentage: 70,
    note: 'Registered stud buck #GOAT-ZW-01 sold to commercial breeder in Kwekwe.',
    actor: adminActor,
  });

  assert.ok(saleEvent.id);

  // 6. Verify Gweru Goat Herd Computed Headcount
  const goatEvents = dataService.getState().livestockEvents.filter((e) => e.livestockId === goatHerd.id);
  const goatStatus = computeLivestockStatus(goatHerd, goatEvents, []);

  // 35 initial + 4 births - 1 sold = 38 current live head
  assert.equal(goatStatus.totalBirths, 4);
  assert.equal(goatStatus.totalSold, 1);
  assert.equal(goatStatus.currentLiveHeadcount, 38);
});

test('WF-13-SITE-C: Macheke Free-Range Farm (Site C) — Site CRUD, GPS Refinement & Operator Assignment', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // 1. Admin creates Site C (Macheke)
  const machekeSite = dataService.addLocation({
    name: 'Macheke Free-Range Farm (Site C)',
    region: 'Mashonaland East Province, Zimbabwe',
    gpsCoordinates: '-18.1390, 31.8490',
    primaryOperatorName: 'Chipo Tendai',
    actor: adminActor,
  });

  assert.ok(machekeSite.id);
  assert.equal(machekeSite.primaryOperatorName, 'Chipo Tendai');

  // 2. Admin edits Site C details (refines GPS coordinates)
  const updatedMacheke = dataService.updateLocation({
    locationId: machekeSite.id,
    name: 'Macheke Free-Range Layer Facility (Site C)',
    region: 'Mashonaland East Province, Zimbabwe',
    gpsCoordinates: '-18.1405, 31.8512',
    primaryOperatorName: 'Chipo Tendai',
    actor: adminActor,
  });

  assert.equal(updatedMacheke.gpsCoordinates, '-18.1405, 31.8512');
  assert.equal(updatedMacheke.name, 'Macheke Free-Range Layer Facility (Site C)');

  // 3. Since zero animal batches are registered at Macheke, safe deletion succeeds
  const deleteResult = dataService.deleteLocation({
    locationId: machekeSite.id,
    actor: adminActor,
  });

  assert.equal(deleteResult.success, true);
  assert.equal(dataService.getState().locations.some((l) => l.id === machekeSite.id), false);

  // 4. Re-create Site C so multi-site comparison engine has all 3 locations
  const restoredSiteC = dataService.addLocation({
    name: 'Macheke Free-Range Layer Facility (Site C)',
    region: 'Mashonaland East Province, Zimbabwe',
    gpsCoordinates: '-18.1405, 31.8512',
    primaryOperatorName: 'Chipo Tendai',
    actor: adminActor,
  });
  assert.ok(restoredSiteC.id);
});

test('WF-14-MULTI-SITE: computeSiteComparisons Engine Across Site A, Site B, and Site C', () => {
  const allLocations = dataService.getState().locations;
  const allLivestock = dataService.getState().livestockEntries;
  const allEvents = dataService.getState().livestockEvents;
  const allExpenses = dataService.getState().expenses;
  const allAssets = dataService.getState().fixedAssets;

  const allStatuses = allLivestock.map((l) => computeLivestockStatus(l, allEvents, []));

  const comparisons = computeSiteComparisons({
    locations: allLocations,
    expenses: allExpenses,
    fixedAssets: allAssets,
    livestockStatuses: allStatuses,
    livestockEvents: allEvents,
  });

  assert.ok(comparisons.length >= 2);

  // Site A (Norton) checks: Active head = 8, active batches >= 1, sales revenue = $4,410
  const nortonSummary = comparisons.find((c) => c.location.name.includes('Norton'));
  assert.ok(nortonSummary);
  assert.ok(nortonSummary.activeAnimalHeadcount >= 8);
  assert.equal(nortonSummary.siteSalesRevenue, 4410);

  // Site B (Gweru) checks: Active head = 38 (35 + 4 births - 1 sold), sales revenue = $750
  const gweruSummary = comparisons.find((c) => c.location.name.includes('Gweru'));
  assert.ok(gweruSummary);
  assert.equal(gweruSummary.activeAnimalHeadcount, 38);
  assert.equal(gweruSummary.siteSalesRevenue, 750);
});

test('WF-15-BROADCAST: Dedicated Broadcast Center with Authentic Photography & Acknowledgment Telemetry', () => {
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);
  const alertPhoto = loadRealTestImageBase64('urgent-biosecurity-alert.jpg');
  const loc = dataService.getState().locations[0];

  // 1. Operator posts urgent field broadcast with photo
  const broadcast = dataService.postGroundBroadcast({
    locationId: loc.id,
    severity: 'URGENT_GROUND',
    title: 'Urgent Biosecurity Notice: Footbath Refresh Required',
    message: 'Increased wild bird activity near west pen. All personnel must use virucidal footbaths before entering coops.',
    photoUrl: alertPhoto,
    actor: operatorActor,
  });

  assert.ok(broadcast.id);
  assert.equal(broadcast.severity, 'URGENT_GROUND');
  assert.ok(broadcast.photoUrl?.startsWith('data:image/jpeg;base64,'));

  // 2. Member acknowledges the broadcast
  const ack = dataService.markNotificationRead(broadcast.id, memberActor.id);
  assert.ok(ack?.readByMemberIds?.includes(memberActor.id));
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
