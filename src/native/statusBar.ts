import { StatusBar, Style } from '@capacitor/status-bar';

export const nativeStatusBar = {
  syncSafeArea: async () => {
    try {
      const info = await StatusBar.getInfo();
      if (info && typeof info.height === 'number' && info.height > 0) {
        document.documentElement.style.setProperty('--safe-area-inset-top', `${info.height}px`);
      }
    } catch {
      // Browser fallback
    }
  },
  setLightStyle: async () => {
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Light });
      await nativeStatusBar.syncSafeArea();
    } catch {
      // Not supported in browser
    }
  },
  setDarkStyle: async () => {
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
      await nativeStatusBar.syncSafeArea();
    } catch {
      // Not supported in browser
    }
  },
  show: async () => {
    try {
      await StatusBar.show();
    } catch {
      // Browser fallback
    }
  },
  hide: async () => {
    try {
      await StatusBar.hide();
    } catch {
      // Browser fallback
    }
  },
};

