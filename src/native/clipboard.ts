import { Clipboard } from '@capacitor/clipboard';

export const nativeClipboard = {
  copyText: async (text: string): Promise<boolean> => {
    try {
      await Clipboard.write({ string: text });
      return true;
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // Fallback via textarea
          try {
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            return true;
          } catch {
            return false;
          }
        }
      }
      return false;
    }
  },

  readText: async (): Promise<string | null> => {
    try {
      const res = await Clipboard.read();
      return res.value || null;
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return null;
        }
      }
      return null;
    }
  },
};

export const copyToClipboard = nativeClipboard.copyText;

