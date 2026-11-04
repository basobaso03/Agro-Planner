import { RouteId } from './routes.ts';

export interface RecentPage {
  id: string; // Unique entity identifier (e.g. 'saleDetail:CS-8812')
  routeId: RouteId;
  title: string;
  subtitle: string;
  icon: string;
  params: Record<string, string>;
  timestamp: number;
  workspaceMode: 'AGRO_FARMING' | 'GENERAL_VENTURE' | 'BOTH';
}

const RECENTS_STORAGE_KEY = 'capita_recents_pages_v1';
const MAX_RECENTS = 8;

class RecentsManager {
  private recents: RecentPage[] = [];

  constructor() {
    this.load();
  }

  private load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (raw) {
        this.recents = JSON.parse(raw);
      }
    } catch {
      this.recents = [];
    }
  }

  private save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(this.recents));
    } catch {
      // Ignore
    }
  }

  public record(page: Omit<RecentPage, 'timestamp'>) {
    const existingIdx = this.recents.findIndex((r) => r.id === page.id);
    const item: RecentPage = {
      ...page,
      timestamp: Date.now(),
    };

    if (existingIdx >= 0) {
      this.recents.splice(existingIdx, 1);
    }
    this.recents.unshift(item);

    if (this.recents.length > MAX_RECENTS) {
      this.recents = this.recents.slice(0, MAX_RECENTS);
    }

    this.save();
  }

  public getRecents(isAgroEnabled: boolean): RecentPage[] {
    return this.recents.filter((r) => {
      if (r.workspaceMode === 'BOTH') return true;
      if (isAgroEnabled && r.workspaceMode === 'AGRO_FARMING') return true;
      if (!isAgroEnabled && r.workspaceMode === 'GENERAL_VENTURE') return true;
      return false;
    });
  }

  public clear() {
    this.recents = [];
    this.save();
  }
}

export const recentsManager = new RecentsManager();

