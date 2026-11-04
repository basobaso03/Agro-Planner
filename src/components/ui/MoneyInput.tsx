import React from 'react';
import { getActiveCurrency } from '../../utils/currency.ts';

export interface MoneyInputProps {
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  hasError = false,
  disabled = false,
}) => {
  const currency = getActiveCurrency();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    onChange(val);
  };

  return (
    <div className="relative flex items-center">
      <div className="absolute left-3.5 text-sm font-bold font-mono text-slate-500 pointer-events-none select-none">
        {currency.symbol}
      </div>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.]?[0-9]*"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-9 pr-3.5 py-3 rounded-xl border text-sm font-mono font-bold text-slate-900 bg-white transition-all focus:outline-hidden focus:ring-2 ${
          hasError
            ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
            : 'border-slate-200 focus:ring-emerald-500 focus:border-emerald-500'
        } disabled:bg-slate-100 disabled:text-slate-400`}
      />
    </div>
  );
};

