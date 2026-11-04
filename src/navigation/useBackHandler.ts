import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

export type BackActionHandler = () => boolean; // Return true if handled, false to delegate

interface RegisteredHandler {
  id: string;
  priority: number; // Higher number runs first
  handler: BackActionHandler;
}

class BackHandlerRegistry {
  private handlers: RegisteredHandler[] = [];
  private lastExitPress = 0;
  private lastExecutedAt = 0;
  private isListening = false;

  public init() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    // Seed an initial history guard state so browser/WebView back presses fire popstate instead of exiting immediately
    try {
      if (!window.history.state || !window.history.state.__agroNavGuard) {
        window.history.replaceState({ __agroNavGuard: true, root: true }, '');
        window.history.pushState({ __agroNavGuard: true, depth: 1 }, '');
      }
    } catch {
      // Ignore in restricted environments
    }

    try {
      void CapacitorApp.addListener('backButton', () => {
        const handled = this.executeBack();
        if (handled) {
          this.ensureHistoryGuard();
        }
      });
    } catch {
      // Non-native
    }

    window.addEventListener('popstate', () => {
      const handled = this.executeBack();
      if (handled) {
        this.ensureHistoryGuard();
      }
    });
  }

  public ensureHistoryGuard() {
    if (typeof window === 'undefined') return;
    try {
      window.history.pushState({ __agroNavGuard: true, ts: Date.now() }, '');
    } catch {
      // Ignore
    }
  }

  public register(id: string, priority: number, handler: BackActionHandler): () => void {
    this.handlers.push({ id, priority, handler });
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  public executeBack(): boolean {
    const now = Date.now();
    // Prevent double-firing when both Capacitor backButton and window.popstate trigger within 180ms
    if (now - this.lastExecutedAt < 180) {
      return true;
    }
    this.lastExecutedAt = now;

    for (const reg of this.handlers) {
      const handled = reg.handler();
      if (handled) return true;
    }

    // Default at root (Overview): Double-back within 2s to exit app
    if (now - this.lastExitPress < 2000) {
      try {
        void CapacitorApp.exitApp();
      } catch {
        // Ignore
      }
      return true;
    }

    this.lastExitPress = now;
    return true;
  }
}

export const backHandlerRegistry = new BackHandlerRegistry();

export function useBackHandler(priority: number, handler: BackActionHandler, deps: any[] = []) {
  useEffect(() => {
    backHandlerRegistry.init();
    const id = `BACK_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return backHandlerRegistry.register(id, priority, handler);
  }, deps);
}


