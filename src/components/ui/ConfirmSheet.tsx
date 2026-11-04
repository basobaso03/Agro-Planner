import React from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDestructive = true,
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="auto"
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-black shadow-md transition-all active:scale-[0.98] cursor-pointer ${
              isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center p-2 space-y-3">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isDestructive ? <AlertTriangle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
        </div>
        <p className="text-sm text-slate-600 max-w-sm leading-relaxed">{message}</p>
      </div>
    </BottomSheet>
  );
};

