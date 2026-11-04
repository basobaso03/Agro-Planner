import { AppLauncher } from '@capacitor/app-launcher';

export const nativeAppLauncher = {
  dialPhone: async (phoneNumber: string): Promise<boolean> => {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanNumber}`;
    try {
      const canOpen = await AppLauncher.canOpenUrl({ url });
      if (canOpen.value) {
        await AppLauncher.openUrl({ url });
        return true;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== 'undefined') {
      window.location.href = url;
      return true;
    }
    return false;
  },

  openWhatsApp: async (phoneNumber: string, message?: string): Promise<boolean> => {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const encodedMsg = message ? encodeURIComponent(message) : '';
    const url = `https://wa.me/${cleanNumber}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
    try {
      const canOpen = await AppLauncher.canOpenUrl({ url });
      if (canOpen.value) {
        await AppLauncher.openUrl({ url });
        return true;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    return false;
  },
};

