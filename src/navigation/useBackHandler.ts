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
  private isListening = false;

  public init() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    try {
      CapacitorApp.addListener('backButton', () => {
        this.executeBack();
      });
    } catch {
      // Non-native
    }

    window.addEventListener('popstate', () => {
      this.executeBack();
    });
  }

  public register(id: string, priority: number, handler: BackActionHandler): () => void {
    this.handlers.push({ id, priority, handler });
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  public executeBack(): boolean {
    for (const reg of this.handlers) {
      const handled = reg.handler();
      if (handled) return true;
    }

    // Default at root: Double-back to exit
    const now = Date.now();
    if (now - this.lastExitPress < 2000) {
      try {
        void CapacitorApp.exitApp();
      } catch {
        // Ignore
      }
      return true;
    }

    this.lastExitPress = now;
    return false;
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

