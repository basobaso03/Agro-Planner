import React from 'react';
import { BottomSheet } from './BottomSheet.tsx';

export interface ActionItem {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  isDestructive?: boolean;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actions: ActionItem[];
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  actions,
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} size="auto">
      <div className="space-y-1.5 divide-y divide-[#F0EBE1]">
        {actions.map((act, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              act.onClick();
              onClose();
            }}
            className={`w-full p-3.5 flex items-center gap-3 text-left rounded-xl transition-colors cursor-pointer ${
              act.isDestructive
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-slate-800 hover:bg-slate-50'
            }`}
          >
            {act.icon && <div className="shrink-0">{act.icon}</div>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{act.label}</div>
              {act.sublabel && <div className="text-xs text-slate-500 font-normal truncate">{act.sublabel}</div>}
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};

