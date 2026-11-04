import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  badge?: number | string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  variant?: 'pills' | 'tabs';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'pills',
}: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl w-full">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

