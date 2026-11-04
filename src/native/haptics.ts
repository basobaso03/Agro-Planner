import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isVibrationEnabled } from '../utils/mobileHardware.ts';

export const nativeHaptics = {
  impact: async (style: ImpactStyle | 'light' | 'medium' | 'heavy' = ImpactStyle.Light): Promise<void> => {
    if (!isVibrationEnabled()) return;
    const resolvedStyle =
      style === 'heavy'
        ? ImpactStyle.Heavy
        : style === 'medium'
        ? ImpactStyle.Medium
        : style === 'light'
        ? ImpactStyle.Light
        : style;
    try {
      await Haptics.impact({ style: resolvedStyle });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    }
  },

  selectionChanged: async (): Promise<void> => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.selectionChanged();
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  },

  success: async (): Promise<void> => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 60, 20]);
      }
    }
  },

  warning: async (): Promise<void> => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 80, 30]);
      }
    }
  },

  error: async (): Promise<void> => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([50, 100, 50]);
      }
    }
  },
};

export const haptics = nativeHaptics;

