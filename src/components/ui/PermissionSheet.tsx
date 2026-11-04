import React from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { LucideIcon } from 'lucide-react';

export interface PermissionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onGrant: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel?: string;
}

export const PermissionSheet: React.FC<PermissionSheetProps> = ({
  isOpen,
  onClose,
  onGrant,
  icon: Icon,
  title,
  description,
  buttonLabel = 'Continue & Allow Permission',
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="auto"
      footer={
        <button
          type="button"
          onClick={() => {
            onClose();
            onGrant();
          }}
          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md cursor-pointer"
        >
          {buttonLabel}
        </button>
      }
    >
      <div className="flex flex-col items-center text-center p-3 space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
          <Icon className="w-7 h-7" />
        </div>
        <p className="text-xs text-slate-600 max-w-sm leading-relaxed">{description}</p>
      </div>
    </BottomSheet>
  );
};

