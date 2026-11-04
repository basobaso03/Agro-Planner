import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { Calendar } from 'lucide-react';

export interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}

export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  isOpen,
  onClose,
  title = 'Select Date',
  selectedDate,
  onSelectDate,
}) => {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);

  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const str = d.toISOString().split('T')[0];
    setCurrentDate(str);
    onSelectDate(str);
    onClose();
  };

  const setEndOfMonth = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const str = end.toISOString().split('T')[0];
    setCurrentDate(str);
    onSelectDate(str);
    onClose();
  };

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
            onSelectDate(currentDate);
            onClose();
          }}
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md cursor-pointer"
        >
          Confirm Date
        </button>
      }
    >
      <div className="space-y-4">
        {/* Quick Shortcut Chips */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Quick Due Dates
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => addDays(7)}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              +7 Days
            </button>
            <button
              type="button"
              onClick={() => addDays(14)}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              +14 Days (Net 14)
            </button>
            <button
              type="button"
              onClick={() => addDays(30)}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              +30 Days (Net 30)
            </button>
            <button
              type="button"
              onClick={setEndOfMonth}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              End of Month
            </button>
          </div>
        </div>

        {/* Native Calendar Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>Custom Calendar Date</span>
          </label>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
    </BottomSheet>
  );
};

