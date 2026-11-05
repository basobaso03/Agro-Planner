import React, { useId } from 'react';
import { BottomSheet, BottomSheetProps } from './BottomSheet.tsx';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useKeyboardOpen } from '../../hooks/useKeyboardInset.ts';

export interface FormSheetProps extends Omit<BottomSheetProps, 'footer'> {
  stickyError?: string | null;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (e: React.FormEvent) => void;
  footerExtra?: React.ReactNode;
}

export const FormSheet: React.FC<FormSheetProps> = ({
  stickyError,
  isSubmitting = false,
  submitLabel = 'Save Record',
  cancelLabel = 'Cancel',
  onSubmit,
  footerExtra,
  children,
  ...sheetProps
}) => {
  const formId = useId();
  const isKeyboardOpen = useKeyboardOpen();

  return (
    <BottomSheet
      {...sheetProps}
      footer={
        <div className={isKeyboardOpen ? 'space-y-1.5' : 'space-y-2'}>
          {!isKeyboardOpen && footerExtra}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={sheetProps.onClose}
              disabled={isSubmitting}
              className={`flex-1 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer text-center ${isKeyboardOpen ? 'py-2' : 'py-3'
                }`}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={isSubmitting}
              className={`flex-[2] px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black shadow-md transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer ${isKeyboardOpen ? 'py-2' : 'py-3'
                }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        {/* Sticky Error Banner pinned at top of scroll container */}
        {stickyError && (
          <div
            role="alert"
            className="sticky top-0 z-20 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-md animate-error-shake"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1 leading-snug">{stickyError}</span>
          </div>
        )}

        {children}

        {/* Render footerExtra inside the end of the scrollable form when keyboard is open so it never blocks typing */}
        {isKeyboardOpen && footerExtra && <div className="pt-1">{footerExtra}</div>}
      </form>
    </BottomSheet>
  );
};
