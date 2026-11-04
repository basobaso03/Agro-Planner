import React from 'react';
import { BottomSheet, BottomSheetProps } from './BottomSheet.tsx';
import { AlertTriangle, Loader2 } from 'lucide-react';

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
  return (
    <BottomSheet
      {...sheetProps}
      footer={
        <div className="space-y-2">
          {footerExtra}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={sheetProps.onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer text-center"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              form="form-sheet-element"
              disabled={isSubmitting}
              className="flex-[2] py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black shadow-md transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
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
        id="form-sheet-element"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        {/* Sticky Error Banner pinned at top of scroll container */}
        {stickyError && (
          <div
            role="alert"
            className="sticky top-0 z-20 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-md animate-error-shake"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1 leading-snug">{stickyError}</span>
          </div>
        )}

        {children}
      </form>
    </BottomSheet>
  );
};

