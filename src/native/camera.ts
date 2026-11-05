import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { compressImage } from '../utils/imageUpload.ts';

export interface PhotoResult {
  dataUrl?: string;
  path?: string;
  webPath?: string;
  format: string;
}

/**
 * Compresses raw camera / gallery image to safe dimensions and format (< 100KB)
 * to prevent exceeding Firestore 1MB document limitations.
 */
async function optimizePhotoResult(rawUrl?: string): Promise<string | undefined> {
  if (!rawUrl) return undefined;
  try {
    return await compressImage(rawUrl, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.7,
      format: 'image/jpeg',
    });
  } catch (err) {
    console.warn('Image optimization fallback to raw:', err);
    return rawUrl;
  }
}

export const nativeCamera = {
  takePhoto: async (quality = 75): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality: Math.min(quality, 75),
        width: 1024,
        height: 1024,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      const raw = image.dataUrl || image.webPath || image.path;
      const optimized = await optimizePhotoResult(raw);

      return {
        dataUrl: optimized,
        path: image.path,
        webPath: optimized,
        format: 'jpeg',
      };
    } catch {
      return null;
    }
  },

  pickFromGallery: async (quality = 75): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality: Math.min(quality, 75),
        width: 1024,
        height: 1024,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true,
      });

      const raw = image.dataUrl || image.webPath || image.path;
      const optimized = await optimizePhotoResult(raw);

      return {
        dataUrl: optimized,
        path: image.path,
        webPath: optimized,
        format: 'jpeg',
      };
    } catch {
      return null;
    }
  },

  promptPhotoSource: async (quality = 75): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality: Math.min(quality, 75),
        width: 1024,
        height: 1024,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        correctOrientation: true,
      });

      const raw = image.dataUrl || image.webPath || image.path;
      const optimized = await optimizePhotoResult(raw);

      return {
        dataUrl: optimized,
        path: image.path,
        webPath: optimized,
        format: 'jpeg',
      };
    } catch {
      return null;
    }
  },
};

export const promptPhotoSource = nativeCamera.promptPhotoSource;
