import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../services/dataService.ts';
import { computeLivestockStatus, generateVaccinationProtocols } from './calculations.ts';
import { generateGrowthProjectionData } from './livestockProjections.ts';
import type { LivestockEntry, OrgMember, AnimalCheckpoint } from '../types/agro.ts';

const mockActor: OrgMember = {
  id: 'mem-admin-test',
  orgId: 'org-test-1',
  fullName: 'Test Farm Operator',
  phoneOrEmail: 'operator@farm.test',
  role: 'ORG_ADMIN',
  approvalStatus: 'APPROVED',
  active: true,
  joinedAt: '2026-10-01T00:00:00Z',
};

test('Checkpoints Engine: Add, edit, and delete checkpoints on active livestock batch', () => {
  // 1. Setup a test livestock batch
  const testBatch: LivestockEntry = {
    id: `LSTK-BATCH-${Date.now()}`,
    orgId: 'org-test-1',
    locationId: 'loc-1',
    locationName: 'Station Alpha',
    species: 'Broilers',
    nameOrTag: 'Test Dynamic Batch #99',
    trackingMode: 'BATCH',
    entryDate: '2026-10-01T07:00:00Z',
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    targetSaleDate: '2026-11-12T07:00:00Z',
    initialHeadcount: 200,
    purchaseCostTotal: 190,
    targetSaleWeightKg: 2.3,
    notes: 'Testing dynamic checkpoint builder',
    createdByMemberName: 'Test Admin',
    createdAt: '2026-10-01T07:00:00Z',
  };

  const state = dataService.getState();
  (dataService as any).saveLocalState({
    ...state,
    livestockEntries: [...state.livestockEntries, testBatch],
  });

  // 2. Add custom checkpoint with arbitrary calendar date
  const addedCp = dataService.addCheckpointToLivestock({
    livestockId: testBatch.id,
    checkpoint: {
      dayTarget: 18,
      scheduledDate: '2026-10-19',
      title: 'Day 18 Custom Vitamin & Probiotic Flush',
      category: 'MEDICATION',
      targetWeightKg: 0.85,
      feedPhase: 'Grower Pellets',
      instructions: 'Administer water-soluble probiotics for 48 hours.',
    },
    actor: mockActor,
  });

  assert.ok(addedCp.id);
  assert.equal(addedCp.dayTarget, 18);
  assert.equal(addedCp.scheduledDate, '2026-10-19');
  assert.equal(addedCp.category, 'MEDICATION');

  // Verify checkpoint exists on entry in state
  const updatedEntry = dataService.getState().livestockEntries.find((l) => l.id === testBatch.id)!;
  assert.ok(updatedEntry.customCheckpoints);
  const found = updatedEntry.customCheckpoints.find((c) => c.id === addedCp.id);
  assert.ok(found);
  assert.equal(found.title, 'Day 18 Custom Vitamin & Probiotic Flush');

  // 3. Edit custom checkpoint
  const editedCp = dataService.updateLivestockCheckpoint({
    livestockId: testBatch.id,
    checkpointId: addedCp.id,
    updates: {
      title: 'Day 18 Electrolyte & Probiotic Boost',
      targetWeightKg: 0.90,
    },
    actor: mockActor,
  });

  assert.equal(editedCp.title, 'Day 18 Electrolyte & Probiotic Boost');
  assert.equal(editedCp.targetWeightKg, 0.90);

  // 4. Delete custom checkpoint
  dataService.deleteLivestockCheckpoint({
    livestockId: testBatch.id,
    checkpointId: addedCp.id,
    actor: mockActor,
  });

  const entryAfterDelete = dataService.getState().livestockEntries.find((l) => l.id === testBatch.id)!;
  const deletedCheck = (entryAfterDelete.customCheckpoints || []).find((c) => c.id === addedCp.id);
  assert.equal(deletedCheck, undefined, 'Checkpoint should be completely removed from batch');
});

test('Checkpoints Engine: Custom farm recipes accurately feed into growth projections', () => {
  const customCheckpoints: AnimalCheckpoint[] = [
    {
      id: 'cp-1',
      dayTarget: 1,
      title: 'Day 1 Placement',
      category: 'BIOSECURITY',
      targetWeightKg: 0.044,
      feedPhase: 'Starter Crumbles',
      completed: true,
      reminderStatus: 'COMPLETED',
    },
    {
      id: 'cp-2',
      dayTarget: 14,
      title: 'Day 14 Weight Benchmark',
      category: 'WEIGHT_CHECK',
      targetWeightKg: 0.520,
      feedPhase: 'Grower Blend',
      completed: false,
      reminderStatus: 'SCHEDULED',
    },
    {
      id: 'cp-3',
      dayTarget: 35,
      title: 'Day 35 Early Harvest Weigh-In',
      category: 'WEIGHT_CHECK',
      targetWeightKg: 2.100,
      feedPhase: 'Finisher Pellets',
      completed: false,
      reminderStatus: 'SCHEDULED',
    },
  ];

  const batchWithCustomRecipe: LivestockEntry = {
    id: 'LSTK-CUSTOM-RECIPE-01',
    orgId: 'org-test-1',
    locationId: 'loc-1',
    locationName: 'Station Beta',
    species: 'Broilers',
    nameOrTag: 'Custom Recipe Flock',
    trackingMode: 'BATCH',
    entryDate: '2026-10-01T07:00:00Z',
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 35,
    targetDurationUnit: 'DAYS',
    targetSaleDate: '2026-11-05T07:00:00Z',
    initialHeadcount: 150,
    purchaseCostTotal: 140,
    targetSaleWeightKg: 2.1,
    notes: 'Flock with custom checkpoints',
    createdByMemberName: 'Farmer Jane',
    createdAt: '2026-10-01T07:00:00Z',
    customCheckpoints,
  };

  const status = computeLivestockStatus(batchWithCustomRecipe, [], [], '2026-10-10T07:00:00Z');
  assert.equal(status.protocols.length, 3, 'Must consume custom checkpoints instead of hardcoded defaults');
  assert.equal(status.protocols[0].title, 'Day 1 Placement');
  assert.equal(status.protocols[1].dayTarget, 14);
  assert.equal(status.protocols[2].targetWeightKg, 2.1);

  const proj = generateGrowthProjectionData(status);
  assert.ok(proj.points.length >= 3);
  const projDays = new Set(proj.points.map((p) => p.day));
  assert.ok(projDays.has(1), 'Day 1 must be present in projection');
  assert.ok(projDays.has(14), 'Day 14 milestone must be plotted in projection points');
  assert.ok(projDays.has(35), 'Day 35 harvest milestone must be plotted');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});

