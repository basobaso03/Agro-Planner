import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface PhotoResult {
  dataUrl?: string;
  path?: string;
  webPath?: string;
  format: string;
}

export const nativeCamera = {
  takePhoto: async (quality = 80): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      return {
        dataUrl: image.dataUrl,
        path: image.path,
        webPath: image.webPath || image.dataUrl || image.path,
        format: image.format,
      };
    } catch {
      return null;
    }
  },

  pickFromGallery: async (quality = 80): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true,
      });

      return {
        dataUrl: image.dataUrl,
        path: image.path,
        webPath: image.webPath || image.dataUrl || image.path,
        format: image.format,
      };
    } catch {
      return null;
    }
  },

  promptPhotoSource: async (quality = 80): Promise<PhotoResult | null> => {
    try {
      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        correctOrientation: true,
      });

      return {
        dataUrl: image.dataUrl,
        path: image.path,
        webPath: image.webPath || image.dataUrl || image.path,
        format: image.format,
      };
    } catch {
      return null;
    }
  },
};

export const promptPhotoSource = nativeCamera.promptPhotoSource;

