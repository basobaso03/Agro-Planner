/**
 * Persistent Outbox & Cloud Snapshot Reconciler Engine
 * Resolves B2 (swallowed persistence) and B20 (cloud sync snapshot wipeouts).
 */

export interface OutboxItem {
  id: string; // Mutation ID
  collectionPath: string; // Target Firestore collection
  docId: string; // Document ID
  data: Record<string, any>;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMMITTED';
  attempts: number;
  lastError?: string;
  errorCode?: string;
  createdAt: string;
  nextRetryAt: number;
}

export interface SyncStatus {
  online: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number;
}

const OUTBOX_STORAGE_KEY = 'capita_outbox_queue_v1';

export class OutboxService {
  private queue: OutboxItem[] = [];
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private lastSyncAt: number = Date.now();
  private isFlushing = false;
  private executor?: (item: OutboxItem) => Promise<void>;

  constructor() {
    this.loadQueue();
  }

  public clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  private loadQueue() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Ignore
    }
    this.notifyStatus();
  }

  public setExecutor(fn: (item: OutboxItem) => Promise<void>) {
    this.executor = fn;
  }

  public enqueue(collectionPath: string, docId: string, data: Record<string, any>): OutboxItem {
    const existingIdx = this.queue.findIndex(
      (item) => item.collectionPath === collectionPath && item.docId === docId && item.status !== 'COMMITTED'
    );

    const now = Date.now();
    const item: OutboxItem = {
      id: `OUTBOX_${now}_${Math.random().toString(36).substring(2, 7)}`,
      collectionPath,
      docId,
      data: JSON.parse(JSON.stringify(data)),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString(),
      nextRetryAt: now,
    };

    if (existingIdx >= 0) {
      this.queue[existingIdx] = item;
    } else {
      this.queue.push(item);
    }

    this.saveQueue();
    void this.flush();
    return item;
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || !this.executor) return;
    this.isFlushing = true;

    try {
      while (true) {
        const pendingItems = this.queue.filter(
          (i) => (i.status === 'PENDING' || i.status === 'SYNCING') && i.nextRetryAt <= Date.now()
        );

        if (pendingItems.length === 0) break;

        for (const item of pendingItems) {
          item.status = 'SYNCING';
          item.attempts += 1;
          try {
            await this.executor(item);
            item.status = 'COMMITTED';
            this.lastSyncAt = Date.now();
          } catch (err: any) {
            const isPerm =
              err?.code === 'permission-denied' ||
              err?.message?.toLowerCase().includes('permission') ||
              err?.message?.toLowerCase().includes('denied');

            if (isPerm) {
              item.status = 'FAILED';
              item.errorCode = 'permission-denied';
              item.lastError = err?.message || 'Permission denied by server governance rules';
            } else {
              item.status = 'PENDING';
              item.lastError = err?.message || 'Network unavailable';
              // Exponential backoff: 2s, 5s, 15s, 45s, max 2 min
              const backoffSec = Math.min(120, Math.pow(2.2, item.attempts));
              item.nextRetryAt = Date.now() + backoffSec * 1000;
            }
          }
        }
      }

      // Evict committed items
      this.queue = this.queue.filter((i) => i.status !== 'COMMITTED');
      this.saveQueue();
    } finally {
      this.isFlushing = false;
    }
  }

  public retryFailed(): void {
    for (const item of this.queue) {
      if (item.status === 'FAILED') {
        item.status = 'PENDING';
        item.attempts = 0;
        item.nextRetryAt = Date.now();
      }
    }
    this.saveQueue();
    void this.flush();
  }

  public getPendingDocIds(collectionPath: string): Set<string> {
    const set = new Set<string>();
    for (const item of this.queue) {
      if (item.collectionPath === collectionPath && item.status !== 'COMMITTED') {
        set.add(item.docId);
      }
    }
    return set;
  }

  /**
   * Snapshot Reconciler Invariant (Fixes B20):
   * When server snapshots arrive, local items that have pending outbox mutations
   * MUST NOT be wiped out or overwritten by stale server snapshots!
   */
  public reconcileSnapshot<T extends { id: string }>(
    cloudDocs: T[],
    localCollection: T[],
    collectionPath: string
  ): T[] {
    const pendingIds = this.getPendingDocIds(collectionPath);
    if (pendingIds.size === 0) {
      return cloudDocs;
    }

    const localMap = new Map<string, T>();
    for (const item of localCollection) {
      if (pendingIds.has(item.id)) {
        localMap.set(item.id, item);
      }
    }

    const mergedMap = new Map<string, T>();
    for (const doc of cloudDocs) {
      mergedMap.set(doc.id, doc);
    }
    // Local pending writes take absolute priority over cloud snapshot
    for (const [id, localItem] of localMap.entries()) {
      mergedMap.set(id, localItem);
    }

    return Array.from(mergedMap.values());
  }

  public getStatus(): SyncStatus {
    const pending = this.queue.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING').length;
    const failed = this.queue.filter((i) => i.status === 'FAILED').length;
    return {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingCount: pending,
      failedCount: failed,
      lastSyncAt: this.lastSyncAt,
    };
  }

  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public getQueue(): OutboxItem[] {
    return [...this.queue];
  }
}

export const outboxService = new OutboxService();

