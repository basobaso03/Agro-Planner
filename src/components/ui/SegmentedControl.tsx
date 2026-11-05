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
    <div className="w-full overflow-x-auto no-scrollbar scrollbar-none -mx-0.5 px-0.5 py-0.5">
      <div className="inline-flex items-center p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl min-w-full w-max gap-1">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 min-w-fit shrink-0 whitespace-nowrap py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isActive
                  ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {opt.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

