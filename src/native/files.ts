import { Filesystem, Directory } from '@capacitor/filesystem';

export const nativeFiles = {
  saveImageFile: async (base64Data: string, filename: string): Promise<string> => {
    try {
      const cleanData = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const res = await Filesystem.writeFile({
        path: `capita_photos/${filename}`,
        data: cleanData,
        directory: Directory.Data,
        recursive: true,
      });
      return res.uri;
    } catch {
      // In web fallback, return base64 data directly
      return base64Data;
    }
  },

  readImageFile: async (path: string): Promise<string> => {
    try {
      if (path.startsWith('data:') || path.startsWith('http')) {
        return path;
      }
      const file = await Filesystem.readFile({ path });
      return `data:image/jpeg;base64,${file.data}`;
    } catch {
      return path;
    }
  },

  deleteFile: async (path: string): Promise<boolean> => {
    try {
      await Filesystem.deleteFile({ path });
      return true;
    } catch {
      return false;
    }
  },
};

