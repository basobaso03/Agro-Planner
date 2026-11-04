import test from 'node:test';
import assert from 'node:assert/strict';
import { OutboxService, OutboxItem } from '../src/services/outbox.ts';

// ---------------------------------------------------------------------------
// SUITE 11: ATOMIC WRITES, OUTBOX QUEUE & SNAPSHOT RECONCILIATION SUITE
// Asserts that local mutations are never swallowed (B2) or wiped out by server snapshots (B20)
// ---------------------------------------------------------------------------

test('WF-OUTBOX-01: Offline Enqueue and Exponential Backoff upon Network Failure', async () => {
  const service = new OutboxService();
  service.clearQueue();

  let attemptCount = 0;
  service.setExecutor(async () => {
    attemptCount += 1;
    throw new Error('Network unavailable: ECONNRESET');
  });

  const item = service.enqueue('credit_sales', 'CSALE-OFFLINE-001', {
    id: 'CSALE-OFFLINE-001',
    customerName: 'Chipo Moyo',
    totalSaleAmount: 180,
  });

  assert.equal(item.docId, 'CSALE-OFFLINE-001');
  assert.equal(item.collectionPath, 'credit_sales');

  // Let the microtask / flush promise finish
  await new Promise((r) => setTimeout(r, 20));

  const queue = service.getQueue();
  assert.equal(queue.length, 1);
  const queuedItem = queue[0];
  assert.equal(queuedItem.status, 'PENDING');
  assert.equal(queuedItem.attempts, 1);
  assert.match(queuedItem.lastError || '', /Network unavailable/);
  // Exponential backoff should schedule next retry in the future
  assert.ok(queuedItem.nextRetryAt > Date.now());

  // Attempting to flush before nextRetryAt must skip the item
  await service.flush();
  assert.equal(attemptCount, 1, 'Flush must skip pending item whose backoff timer has not elapsed');
});

test('WF-OUTBOX-02: Permission Denied transitions immediately to FAILED with recovery via retryFailed', async () => {
  const service = new OutboxService();
  service.clearQueue();

  let shouldFail = true;
  service.setExecutor(async () => {
    if (shouldFail) {
      const err = new Error('Missing or insufficient permissions');
      (err as any).code = 'permission-denied';
      throw err;
    }
  });

  service.enqueue('debt_liabilities', 'DEBT-PERM-001', {
    id: 'DEBT-PERM-001',
    principalAmount: 1000,
  });

  await new Promise((r) => setTimeout(r, 20));

  const queue = service.getQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'FAILED');
  assert.equal(queue[0].errorCode, 'permission-denied');
  assert.equal(service.getStatus().failedCount, 1);

  // Once admin permissions are granted or credentials refreshed, retryFailed resets status
  shouldFail = false;
  service.retryFailed();

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(service.getStatus().failedCount, 0);
  assert.equal(service.getStatus().pendingCount, 0);
  assert.equal(service.getQueue().length, 0, 'Committed items must be cleaned up from queue');
});

test('WF-OUTBOX-03: Snapshot Reconciler Invariant (Guarantees B20 Zero Snapshot Wipeout)', () => {
  const service = new OutboxService();
  service.clearQueue();

  // Disable executor so mutations stay pending in outbox
  service.setExecutor(async () => {
    throw new Error('Offline mode active');
  });

  // Local user records 3 pending documents offline
  const localCreditSale = {
    id: 'CSALE-PENDING-001',
    orgId: 'ORG-01',
    customerName: 'Alice Farmer',
    totalSaleAmount: 250,
  };
  const localDebt = {
    id: 'DEBT-PENDING-001',
    orgId: 'ORG-01',
    creditorName: 'Feed Supplier Co',
    principalAmount: 800,
  };
  const localLivestock = {
    id: 'BATCH-PENDING-001',
    orgId: 'ORG-01',
    species: 'Goats',
    nameOrTag: 'Boer Goats Pen 3',
  };

  service.enqueue('credit_sales', localCreditSale.id, localCreditSale);
  service.enqueue('debt_liabilities', localDebt.id, localDebt);
  service.enqueue('livestock_entries', localLivestock.id, localLivestock);

  // Assert pending IDs are tracked accurately
  const creditPending = service.getPendingDocIds('credit_sales');
  assert.ok(creditPending.has('CSALE-PENDING-001'));
  assert.equal(creditPending.size, 1);

  // Invariant A: Server snapshot is empty ([]). Reconciler must NOT wipe out local pending item!
  const serverEmptyCreditSales: typeof localCreditSale[] = [];
  const reconciledCredit = service.reconcileSnapshot(
    serverEmptyCreditSales,
    [localCreditSale],
    'credit_sales'
  );
  assert.equal(reconciledCredit.length, 1);
  assert.equal(reconciledCredit[0].id, 'CSALE-PENDING-001');

  // Invariant B: Server snapshot contains existing cloud documents, but misses local pending item.
  // Both must be merged cleanly.
  const serverExistingDebts = [
    { id: 'DEBT-CLOUD-999', orgId: 'ORG-01', creditorName: 'AgroBank', principalAmount: 5000 },
  ];
  const reconciledDebts = service.reconcileSnapshot(
    serverExistingDebts,
    [localDebt],
    'debt_liabilities'
  );
  assert.equal(reconciledDebts.length, 2);
  assert.ok(reconciledDebts.some((d) => d.id === 'DEBT-CLOUD-999'));
  assert.ok(reconciledDebts.some((d) => d.id === 'DEBT-PENDING-001'));

  // Invariant C: Local pending write takes priority over stale server version
  const staleServerBatch = {
    id: 'BATCH-PENDING-001',
    orgId: 'ORG-01',
    species: 'Goats',
    nameOrTag: 'Stale Server Name',
  };
  const reconciledLivestock = service.reconcileSnapshot(
    [staleServerBatch],
    [localLivestock],
    'livestock_entries'
  );
  assert.equal(reconciledLivestock.length, 1);
  assert.equal(reconciledLivestock[0].nameOrTag, 'Boer Goats Pen 3', 'Local pending mutation must take precedence over stale server copy');
});

test('WF-OUTBOX-04: Successful Flush marks items COMMITTED and updates lastSyncAt', async () => {
  const service = new OutboxService();
  service.clearQueue();

  const committedDocs: OutboxItem[] = [];
  service.setExecutor(async (item) => {
    committedDocs.push(item);
  });

  const beforeSync = Date.now();
  service.enqueue('expense_ledger', 'EXP-001', { id: 'EXP-001', amount: 45 });
  service.enqueue('feed_ledger', 'FEED-001', { id: 'FEED-001', bagsDelta: 5 });

  await new Promise((r) => setTimeout(r, 20));

  assert.equal(committedDocs.length, 2);
  assert.equal(service.getStatus().pendingCount, 0);
  assert.equal(service.getStatus().failedCount, 0);
  assert.ok(service.getStatus().lastSyncAt >= beforeSync);
  assert.equal(service.getQueue().length, 0);
});

test('WF-OUTBOX-05: Deduplication of rapid edits to the same document ID in offline queue', async () => {
  const service = new OutboxService();
  service.clearQueue();

  // Block executor
  service.setExecutor(async () => {
    throw new Error('Offline');
  });

  // User edits batch details twice while offline
  service.enqueue('livestock_entries', 'BATCH-DEDUP-001', {
    id: 'BATCH-DEDUP-001',
    nameOrTag: 'Batch Version 1',
  });

  service.enqueue('livestock_entries', 'BATCH-DEDUP-001', {
    id: 'BATCH-DEDUP-001',
    nameOrTag: 'Batch Version 2 Updated',
  });

  await new Promise((r) => setTimeout(r, 20));

  const queue = service.getQueue();
  assert.equal(queue.length, 1, 'Rapid enqueues for the same docId must update in-place without duplicates');
  assert.equal(queue[0].data.nameOrTag, 'Batch Version 2 Updated');
});

