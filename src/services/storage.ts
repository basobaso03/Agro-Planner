/**
 * High-Capacity IndexedDB Key-Value Storage Layer
 * Replaces localStorage for snapshots to prevent 5MB QuotaExceededError data loss.
 */

const DB_NAME = 'capitaseed_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  public async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage if IndexedDB is unavailable
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.error('CRITICAL: Storage quota failure across IndexedDB and localStorage:', err);
      }
    }
  }

  public async getItem<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    }
  }

  public async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
  }

  public async clearAll(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch {
      // Ignore
    }
    try {
      if (this.dbPromise) {
        const db = await Promise.race([
          this.getDB(),
          new Promise<null>((r) => setTimeout(() => r(null), 1000))
        ]);
        if (db) {
          await new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const req = store.clear();
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
            } catch {
              resolve();
            }
          });
          db.close();
        }
      }
    } catch {
      // Ignore clear error
    } finally {
      this.dbPromise = null;
    }
  }

  /**
   * Completely purges all IndexedDB databases on this origin.
   */
  public async purgeAllIndexedDatabases(): Promise<void> {
    if (this.dbPromise) {
      try {
        const db = await Promise.race([
          this.dbPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 500))
        ]);
        db?.close();
      } catch { }
      this.dbPromise = null;
    }

    if (typeof indexedDB === 'undefined') return;

    try {
      if (typeof indexedDB.databases === 'function') {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name) {
            try {
              indexedDB.deleteDatabase(dbInfo.name);
            } catch { }
          }
        }
      }
    } catch { }

    // Explicit fallback deletions for known databases
    const knownNames = [DB_NAME, 'agro_planner_db', 'firebaseLocalStorageDb'];
    for (const name of knownNames) {
      try {
        indexedDB.deleteDatabase(name);
      } catch { }
    }
  }

  /**
   * Scans and returns accurate storage diagnostics across LocalStorage and IndexedDB.
   */
  public async getStorageDiagnostics(): Promise<{
    localStorageBytes: number;
    localStorageKeys: number;
    estimatedUsageBytes: number;
    quotaBytes: number;
  }> {
    let lsBytes = 0;
    let lsKeys = 0;

    if (typeof localStorage !== 'undefined') {
      try {
        lsKeys = localStorage.length;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k) || '';
            lsBytes += (k.length + v.length) * 2; // Approximate UTF-16 size in bytes
          }
        }
      } catch { }
    }

    let quotaBytes = 0;
    let navUsageBytes = 0;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        quotaBytes = est.quota || 0;
        navUsageBytes = est.usage || 0;
      } catch { }
    }

    return {
      localStorageBytes: lsBytes,
      localStorageKeys: lsKeys,
      estimatedUsageBytes: Math.max(navUsageBytes, lsBytes),
      quotaBytes,
    };
  }
}

export const appStorage = new IndexedDBStorage();

