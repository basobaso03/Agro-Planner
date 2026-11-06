import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { jsPDF } from 'jspdf';
import { sanitizePdfFilename } from '../../utils/pdfFilename.ts';
import { nativeHaptics } from '../../native/haptics.ts';

export interface SharePdfOptions {
  doc: jsPDF;
  rawFilename: string;
  title: string;
  subject?: string;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Universal PDF Sharing & Download Coordinator
 * Automatically routes to Capacitor Android native share sheets or browser downloads,
 * strictly guaranteeing that the exported filename contains ZERO underscores.
 */
export async function shareOrDownloadPdf(options: SharePdfOptions): Promise<boolean> {
  const filename = sanitizePdfFilename(options.rawFilename);

  try {
    // 1. Native Haptic Feedback
    try {
      nativeHaptics.impact('light');
    } catch {
      // Haptics optional
    }

    // 2. Mobile Native Platform Flow (Capacitor Android)
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = options.doc.output('datauristring').split(',')[1];

        // Save to cache directory with zero underscores in path
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        // Launch Native Android Share Sheet (WhatsApp, Email, Drive, Print)
        await Share.share({
          title: options.title,
          text: options.subject || `Certified export from Agro Planner: ${filename}`,
          url: writeResult.uri,
          dialogTitle: `Share ${options.title}`,
        });

        options.onSuccess?.();
        return true;
      } catch (nativeError: any) {
        // If user simply closed the Android share sheet, treat as clean exit
        if (
          nativeError?.message?.includes('canceled') ||
          nativeError?.message?.includes('abort') ||
          nativeError?.name === 'AbortError'
        ) {
          return false;
        }
        console.warn('Native sharing failed, falling back to document save:', nativeError);
      }
    }

    // 3. Web Share API Flow (Mobile browsers / PWA)
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const pdfBlob = options.doc.output('blob');
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: options.title,
            text: options.subject || `Agro Planner Export: ${filename}`,
          });
          options.onSuccess?.();
          return true;
        }
      } catch (webShareError: any) {
        if (webShareError?.name === 'AbortError') {
          return false; // User dismissed share dialog
        }
        console.warn('Web Share API failed, falling back to direct download:', webShareError);
      }
    }

    // 4. Universal Fallback: Instant Browser Document Save
    options.doc.save(filename);
    options.onSuccess?.();
    return true;
  } catch (err: any) {
    console.error('Fatal error in PDF export coordinator:', err);
    try {
      // Ultimate attempt to save file
      options.doc.save(filename);
    } catch (saveErr) {
      options.onError?.(err);
      return false;
    }
    return true;
  }
}

