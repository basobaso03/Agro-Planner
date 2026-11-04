import { StatusBar, Style } from '@capacitor/status-bar';

export const nativeStatusBar = {
  setLightStyle: async () => {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#FAF8F5' });
    } catch {
      // Not supported in browser
    }
  },
  setDarkStyle: async () => {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0F172A' });
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

