import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Share2, Download } from 'lucide-react';
import { nativeShare } from '../../native/share.ts';

export interface ImageViewerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export const ImageViewerSheet: React.FC<ImageViewerSheetProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Image Preview',
  subtitle,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen || !imageUrl) return null;

  const handleZoomToggle = () => {
    setZoomLevel((prev) => (prev > 1 ? 1 : 2));
  };

  const handleShare = () => {
    void nativeShare.shareTextOrUrl({
      title,
      text: subtitle || title,
      url: imageUrl,
    });
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? document.getElementById('sheet-root') || document.body
      : null;

  if (!portalTarget) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white animate-fade-in"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md safe-top">
        <div className="min-w-0 pr-3">
          <h3 className="text-sm font-bold truncate text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleZoomToggle}
            aria-label="Toggle zoom"
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
          >
            {zoomLevel > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share image"
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo preview"
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 flex items-center justify-center p-2 overflow-auto"
        onClick={handleZoomToggle}
      >
        <img
          src={imageUrl}
          alt={title}
          style={{ transform: `scale(${zoomLevel})` }}
          className="max-h-[80dvh] max-w-full object-contain rounded-lg transition-transform duration-200 cursor-zoom-in active:cursor-zoom-out select-none shadow-2xl"
        />
      </div>

      {/* Bottom Bar Hints */}
      <div className="p-3 text-center text-[11px] text-slate-400 bg-black/40 backdrop-blur-md safe-bottom">
        Tap photo to zoom in/out • Swipe down to dismiss
      </div>
    </div>,
    portalTarget
  );
};

