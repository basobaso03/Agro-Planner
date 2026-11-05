import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useKeyboardOpen } from '../../hooks/useKeyboardInset.ts';
import { useBackHandler } from '../../navigation/useBackHandler.ts';
import { nativeHaptics } from '../../native/haptics.ts';
import { nativeKeyboard } from '../../native/keyboard.ts';

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
  const isKeyboardOpen = useKeyboardOpen();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

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

  // When keyboard opens inside the sheet, ensure the active input is scrolled into view
  useEffect(() => {
    if (isOpen && isKeyboardOpen) {
      nativeKeyboard.scheduleScrollFocusedElement();
    }
  }, [isOpen, isKeyboardOpen]);

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

  const maxDvh = size === 'half' ? '65dvh' : '92dvh';
  const computedMaxHeight = isKeyboardOpen
    ? 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 4px)'
    : maxHeight || `min(${maxDvh}, calc(var(--vvh, 100dvh) - var(--sat, 0px) - 12px))`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        top: 'var(--vvo, 0px)',
        height: 'var(--vvh, 100dvh)',
      }}
      className="fixed left-0 right-0 z-50 flex flex-col justify-end pointer-events-auto overflow-hidden"
    >
      {/* Backdrop Scrim */}
      <div
        onClick={handleRequestClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'
          }`}
      />

      {/* Sheet Modal Container */}
      <div
        ref={sheetContentRef}
        style={{
          transform: `translateY(${isClosing ? '100%' : `${dragOffset}px`})`,
          maxHeight: computedMaxHeight,
        }}
        className={`relative z-10 w-full max-w-xl mx-auto flex flex-col bg-white border-t border-x border-[#E8DFCE] shadow-2xl overflow-hidden transition-transform duration-200 ease-out ${isKeyboardOpen ? 'rounded-t-2xl' : 'rounded-t-[28px]'
          }`}
      >
        {/* Grab Handle Header Bar - Collapses when keyboard is open to maximize typing area */}
        {!isKeyboardOpen && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0"
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-300" />
          </div>
        )}

        {/* Sticky Sheet Header - Compact when keyboard is open */}
        <div
          className={`flex items-center justify-between px-4 sm:px-5 border-b border-[#F0EBE1] shrink-0 bg-white ${isKeyboardOpen ? 'py-1.5' : 'py-2.5'
            }`}
        >
          <div className="flex-1 min-w-0 pr-3">
            <h2
              className={`font-black text-slate-900 tracking-tight truncate flex items-center gap-2 ${isKeyboardOpen ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                }`}
            >
              {title}
            </h2>
            {subtitle && !isKeyboardOpen && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
            )}
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
          <div className="p-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between animate-fade-in shrink-0">
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
        <div
          ref={scrollBodyRef}
          className={`flex-1 min-h-[110px] overflow-y-auto overscroll-contain text-slate-900 ${isKeyboardOpen ? 'p-3.5 sm:p-4 space-y-3 pb-6' : 'p-4 sm:p-5 space-y-4'
            }`}
        >
          {children}
        </div>

        {/* Sticky Action Footer - Compact when keyboard is open */}
        {footer && (
          <div
            className={`shrink-0 bg-white border-t border-[#F0EBE1] shadow-xs ${isKeyboardOpen ? 'px-3.5 py-2' : 'p-3 sm:p-4 pb-safe'
              }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
};
