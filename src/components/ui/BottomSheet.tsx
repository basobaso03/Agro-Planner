import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useKeyboardInset } from '../../hooks/useKeyboardInset.ts';
import { useBackHandler } from '../../navigation/useBackHandler.ts';
import { nativeHaptics } from '../../native/haptics.ts';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dirty?: boolean;
  size?: 'auto' | 'half' | 'full';
  maxHeight?: string;
  headerAccessory?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  dirty = false,
  size = 'auto',
  maxHeight,
  headerAccessory,
  footer,
  children,
}) => {
  const keyboardHeight = useKeyboardInset();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  const handleRequestClose = useCallback(() => {
    if (dirty && !showDiscardConfirm) {
      void nativeHaptics.warning();
      setShowDiscardConfirm(true);
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setShowDiscardConfirm(false);
      setDragOffset(0);
      onClose();
    }, 200);
  }, [dirty, showDiscardConfirm, onClose]);

  // Register with BackHandlerRegistry (Priority 100: Top-level overlay sheets)
  useBackHandler(100, () => {
    if (isOpen) {
      handleRequestClose();
      return true;
    }
    return false;
  }, [isOpen, handleRequestClose]);

  // Handle hardware Back button and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);

  // Touch drag-to-dismiss on header and grab handle
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffset(delta);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const currentY = e.changedTouches[0].clientY;
    const delta = currentY - dragStartYRef.current;
    const sheetHeight = sheetContentRef.current?.offsetHeight || 400;

    if (delta > sheetHeight * 0.25 || delta > 120) {
      handleRequestClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!isOpen && !isClosing) return null;

  const portalTarget = typeof document !== 'undefined' ? document.getElementById('sheet-root') || document.body : null;
  if (!portalTarget) return null;

  const maxDvh = size === 'half' ? '55dvh' : '88dvh';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto"
    >
      {/* Backdrop Scrim */}
      <div
        onClick={handleRequestClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Sheet Modal Container */}
      <div
        ref={sheetContentRef}
        style={{
          transform: `translateY(${isClosing ? '100%' : `${dragOffset}px`})`,
          bottom: `${keyboardHeight}px`,
          maxHeight: maxHeight || `min(${maxDvh}, calc(var(--vvh, 100vh) - var(--sat, 0px) - 16px))`,
        }}
        className="relative z-10 w-full max-w-xl mx-auto flex flex-col rounded-t-[28px] bg-white border-t border-x border-[#E8DFCE] shadow-2xl overflow-hidden transition-transform duration-200 ease-out"
      >
        {/* Grab Handle Header Bar */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full pt-3 pb-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Sticky Sheet Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#F0EBE1] shrink-0 bg-white">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate flex items-center gap-2">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerAccessory}
            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Discard In-Progress Confirmation Overlay */}
        {showDiscardConfirm && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between animate-fade-in shrink-0">
            <div className="text-xs text-rose-900 font-medium">Discard unsaved changes?</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white rounded-lg border border-slate-200"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setIsClosing(true);
                  setTimeout(() => {
                    setIsClosing(false);
                    onClose();
                  }, 200);
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg shadow-xs"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Sheet Content Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-slate-900">
          {children}
        </div>

        {/* Sticky Action Footer */}
        {footer && (
          <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[#F0EBE1] shadow-xs">
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
};

