import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { Search, Check } from 'lucide-react';

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface PickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
}

export const PickerSheet: React.FC<PickerSheetProps> = ({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  searchPlaceholder = 'Search options...',
}) => {
  const [query, setQuery] = useState('');

  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} size="auto">
      <div className="space-y-3">
        {/* Search Field if > 5 options */}
        {options.length > 5 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-[#FAF8F5] text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Options List */}
        <div className="divide-y divide-[#F0EBE1] max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No matching options found</div>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  className={`w-full p-3 text-left flex items-center justify-between rounded-xl transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {opt.icon}
                    <div>
                      <div className="text-sm font-semibold">{opt.label}</div>
                      {opt.sublabel && <div className="text-xs text-slate-500 font-normal">{opt.sublabel}</div>}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

