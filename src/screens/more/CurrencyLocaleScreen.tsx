import React, { useState } from 'react';
import {
  SUPPORTED_CURRENCIES,
  getActiveCurrency,
  setActiveCurrency,
  isPrivacyMasked,
  setPrivacyMask,
} from '../../utils/currency.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface CurrencyLocaleScreenProps {
  activeMember: OrgMember;
}

export const CurrencyLocaleScreen: React.FC<CurrencyLocaleScreenProps> = () => {
  const { showToast } = useToast();
  const [activeCode, setActiveCode] = useState(() => getActiveCurrency().code);
  const [defaultMasked, setDefaultMasked] = useState(() => isPrivacyMasked());

  const handleSelectCurrency = (code: string) => {
    setActiveCurrency(code);
    setActiveCode(code);
    showToast({
      type: 'success',
      title: 'Currency Updated',
      message: `App numbers will format using ${code} currency.`,
    });
  };

  const handleToggleMask = (masked: boolean) => {
    setDefaultMasked(masked);
    setPrivacyMask(masked);
    showToast({
      type: 'info',
      title: 'Privacy Eye-Shield',
      message: masked ? 'Numbers hidden by default.' : 'Numbers visible by default.',
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs">
        <h1 className="text-base font-black text-slate-950">Currency & Number Formatting</h1>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          Select display currency for balances and financial ledgers across the application.
        </p>
      </div>

      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-black text-slate-950 text-sm">Base Ledger Currency</div>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = c.code === activeCode;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelectCurrency(c.code)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-[#E8DFCE] bg-white hover:bg-[#FAF8F5] text-slate-800'
                  }`}
              >
                <div className="text-base font-bold">{c.symbol} {c.code}</div>
                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                  {c.code === 'USD' ? 'US Dollar (Default)' : c.code === 'ZAR' ? 'South African Rand' : c.code === 'ZWG' ? 'Zimbabwe Gold' : c.code}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black text-slate-950 text-sm">
              Privacy Eye-Shield Masking
            </div>
            <div className="text-slate-600 font-medium mt-0.5">
              Obfuscate all financial numbers with '••••••' by default
            </div>
          </div>
          <input
            type="checkbox"
            checked={defaultMasked}
            onChange={(e) => handleToggleMask(e.target.checked)}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

