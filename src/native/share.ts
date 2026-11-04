import { Share } from '@capacitor/share';

export const nativeShare = {
  shareTextOrUrl: async (options: { title: string; text?: string; url?: string; dialogTitle?: string }): Promise<boolean> => {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: options.title,
          text: options.text,
          url: options.url,
          dialogTitle: options.dialogTitle || 'Share via',
        });
        return true;
      }
    } catch {
      // Fallback
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(options);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  },
};

export const shareContent = nativeShare.shareTextOrUrl;

