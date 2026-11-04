import { Keyboard } from '@capacitor/keyboard';

export type KeyboardStateListener = (height: number) => void;

class NativeKeyboardManager {
  private currentHeight = 0;
  private listeners: Set<KeyboardStateListener> = new Set();
  private initialized = false;

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.updateHeight(info.keyboardHeight);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        this.updateHeight(0);
      });
    } catch {
      // Fallback for browser / PWA visual viewport
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
          if (!window.visualViewport) return;
          const kbHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
          this.updateHeight(kbHeight);
        });
      }
    }
  }

  private updateHeight(height: number) {
    this.currentHeight = height;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--kb', `${height}px`);
      if (window.visualViewport) {
        document.documentElement.style.setProperty('--vvh', `${window.visualViewport.height}px`);
      }
    }
    this.listeners.forEach((listener) => listener(height));
  }

  public getHeight(): number {
    return this.currentHeight;
  }

  public subscribe(listener: KeyboardStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentHeight);
    return () => this.listeners.delete(listener);
  }

  public async hide(): Promise<void> {
    try {
      await Keyboard.hide();
    } catch {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }
}

export const nativeKeyboard = new NativeKeyboardManager();

