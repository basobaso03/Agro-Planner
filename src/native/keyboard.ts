import { Keyboard } from '@capacitor/keyboard';

export type KeyboardStateListener = (height: number, isOpen: boolean) => void;

const EDITABLE_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';

class NativeKeyboardManager {
  private currentHeight = 0;
  private isOpenState = false;
  private nativeKeyboardHeight = 0;
  private baselineWindowHeight = 0;
  private listeners: Set<KeyboardStateListener> = new Set();
  private initialized = false;
  private scrollTimers: number[] = [];

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.baselineWindowHeight = Math.max(
      window.innerHeight,
      window.visualViewport?.height || 0
    );

    this.syncViewportMetrics();

    try {
      void Keyboard.addListener('keyboardWillShow', (info) => {
        this.nativeKeyboardHeight = Math.max(0, info.keyboardHeight || 0);
        this.syncViewportMetrics();
        this.scheduleScrollFocusedElement();
      });

      void Keyboard.addListener('keyboardDidShow', (info) => {
        this.nativeKeyboardHeight = Math.max(0, info.keyboardHeight || 0);
        this.syncViewportMetrics();
        this.scheduleScrollFocusedElement();
      });

      void Keyboard.addListener('keyboardWillHide', () => {
        this.nativeKeyboardHeight = 0;
        this.syncViewportMetrics();
      });

      void Keyboard.addListener('keyboardDidHide', () => {
        this.nativeKeyboardHeight = 0;
        this.syncViewportMetrics();
      });
    } catch {
      // Fallback for browser / PWA visual viewport
    }

    const onViewportChange = () => {
      this.syncViewportMetrics();
      if (this.isOpenState) {
        this.scheduleScrollFocusedElement();
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
      window.visualViewport.addEventListener('scroll', onViewportChange);
    }
    window.addEventListener('resize', onViewportChange);

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'focusin',
        (e) => {
          const target = e.target;
          if (target instanceof HTMLElement && this.isEditableTextInput(target)) {
            this.syncViewportMetrics();
            this.scheduleScrollFocusedElement(target);
          }
        },
        true
      );

      document.addEventListener(
        'focusout',
        () => {
          window.setTimeout(() => {
            this.syncViewportMetrics();
          }, 100);
        },
        true
      );
    }
  }

  private isEditableTextInput(el: Element | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type?.toLowerCase() || 'text';
      const nonKeyboardTypes = new Set([
        'button',
        'checkbox',
        'color',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit',
      ]);
      return !nonKeyboardTypes.has(type);
    }
    return false;
  }

  private syncViewportMetrics() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const innerH = window.innerHeight;
    const vv = window.visualViewport;
    const vvh = vv ? vv.height : innerH;
    const vvo = vv ? vv.offsetTop : 0;

    // Update baseline height when no keyboard is active and window expands
    if (this.nativeKeyboardHeight === 0 && vvh > this.baselineWindowHeight - 60) {
      this.baselineWindowHeight = Math.max(this.baselineWindowHeight, innerH, vvh);
    }

    // How much visual height shrunk compared to innerHeight (unshrunk layout viewport)
    const unshrunkDelta = Math.max(0, Math.round(innerH - vvh));
    // How much visual height shrunk compared to full baseline screen height (handles adjustResize where innerHeight also shrinks)
    const baselineDelta = Math.max(0, Math.round(this.baselineWindowHeight - vvh));

    const effectiveKbHeight = Math.max(
      this.nativeKeyboardHeight,
      unshrunkDelta > 80 ? unshrunkDelta : 0,
      baselineDelta > 110 ? baselineDelta : 0
    );

    const activeEl = document.activeElement;
    const hasFocusedTextInput = this.isEditableTextInput(activeEl);
    const isOpen = effectiveKbHeight > 80 || (hasFocusedTextInput && baselineDelta > 70);

    // If innerHeight did NOT shrink with the keyboard (e.g. iOS Safari or resize: none),
    // fixed inset-0 elements need an extra bottom offset equal to the unshrunk keyboard overlap.
    // If innerHeight ALREADY shrunk (Android adjustResize) or the container uses height: var(--vvh),
    // we must not double-subtract!
    const computedVvh =
      this.nativeKeyboardHeight > 0 && unshrunkDelta < 50 && baselineDelta < 50
        ? Math.max(220, innerH - this.nativeKeyboardHeight)
        : vvh;

    const root = document.documentElement;
    root.style.setProperty('--vvh', `${Math.round(computedVvh)}px`);
    root.style.setProperty('--vvo', `${Math.round(vvo)}px`);
    root.style.setProperty('--kb', `${Math.round(effectiveKbHeight)}px`);

    if (isOpen) {
      root.setAttribute('data-keyboard-open', 'true');
      document.body?.setAttribute('data-keyboard-open', 'true');
    } else {
      root.removeAttribute('data-keyboard-open');
      document.body?.removeAttribute('data-keyboard-open');
    }

    const changed =
      this.currentHeight !== effectiveKbHeight || this.isOpenState !== isOpen;
    this.currentHeight = effectiveKbHeight;
    this.isOpenState = isOpen;

    if (changed) {
      this.listeners.forEach((listener) => listener(this.currentHeight, this.isOpenState));
    }
  }

  public scheduleScrollFocusedElement(targetEl?: HTMLElement) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.scrollTimers.forEach((id) => window.clearTimeout(id));
    this.scrollTimers = [];

    const delays = [30, 140, 320];
    for (const delay of delays) {
      const timerId = window.setTimeout(() => {
        const el =
          targetEl && document.activeElement === targetEl
            ? targetEl
            : document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        if (el && el.matches(EDITABLE_SELECTOR)) {
          this.scrollElementIntoSafeView(el);
        }
      }, delay);
      this.scrollTimers.push(timerId);
    }
  }

  private findScrollableParent(el: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const isScrollable =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        current.scrollHeight > current.clientHeight + 4;
      if (isScrollable) {
        return current;
      }
      current = current.parentElement;
    }
    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }

  private scrollElementIntoSafeView(el: HTMLElement) {
    const scroller = this.findScrollableParent(el);
    if (!scroller) return;

    const elRect = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const visibleTop = vv ? vv.offsetTop : 0;
    const visibleHeight =
      parseFloat(document.documentElement.style.getPropertyValue('--vvh')) ||
      (vv ? vv.height : window.innerHeight);
    const visibleBottom = visibleTop + visibleHeight;

    if (
      scroller === document.documentElement ||
      scroller === document.body ||
      scroller === document.scrollingElement
    ) {
      const topCutoff = visibleTop + 72;
      const bottomCutoff = visibleBottom - 28;
      if (elRect.bottom > bottomCutoff) {
        window.scrollBy({
          top: elRect.bottom - bottomCutoff + 20,
          behavior: 'smooth',
        });
      } else if (elRect.top < topCutoff) {
        window.scrollBy({
          top: elRect.top - topCutoff - 16,
          behavior: 'smooth',
        });
      }
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const effectiveTop = Math.max(scrollerRect.top, visibleTop) + 16;
    const effectiveBottom = Math.min(scrollerRect.bottom, visibleBottom) - 20;

    if (elRect.bottom > effectiveBottom) {
      const delta = elRect.bottom - effectiveBottom + 16;
      scroller.scrollTo({
        top: scroller.scrollTop + delta,
        behavior: 'smooth',
      });
    } else if (elRect.top < effectiveTop) {
      const delta = elRect.top - effectiveTop - 16;
      scroller.scrollTo({
        top: Math.max(0, scroller.scrollTop + delta),
        behavior: 'smooth',
      });
    }
  }

  public getHeight(): number {
    return this.currentHeight;
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public subscribe(listener: KeyboardStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentHeight, this.isOpenState);
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
