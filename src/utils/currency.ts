/**
 * Universal Currency & Regional Formatter
 * Supports configurable currency symbols and masking.
 */

const CURRENCY_KEY = 'capita_org_currency_code';
const PRIVACY_MASK_KEY = 'capita_privacy_mask_active';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'ZAR', symbol: 'R', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'KES', symbol: 'KSh', decimals: 2 },
  { code: 'UGX', symbol: 'USh', decimals: 0 },
  { code: 'ZWG', symbol: 'ZiG', decimals: 2 },
];

export function getActiveCurrency(): CurrencyConfig {
  if (typeof localStorage === 'undefined') return SUPPORTED_CURRENCIES[0];
  const saved = localStorage.getItem(CURRENCY_KEY);
  return SUPPORTED_CURRENCIES.find((c) => c.code === saved) || SUPPORTED_CURRENCIES[0];
}

export function setActiveCurrency(code: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CURRENCY_KEY, code);
}

export function isPrivacyMasked(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(PRIVACY_MASK_KEY) === 'true';
}

export function togglePrivacyMask(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const current = isPrivacyMasked();
  const next = !current;
  localStorage.setItem(PRIVACY_MASK_KEY, String(next));
  return next;
}

export function setPrivacyMask(masked: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PRIVACY_MASK_KEY, String(masked));
}

export function formatMoney(
  amount: number,
  options?: boolean | { mask?: boolean; currency?: CurrencyConfig }
): string {
  let mask = false;
  let customCurrency: CurrencyConfig | undefined;

  if (typeof options === 'boolean') {
    mask = !options;
  } else if (options && typeof options === 'object') {
    mask = Boolean(options.mask);
    customCurrency = options.currency;
  }

  if (mask) return '••••••';

  const curr = customCurrency || getActiveCurrency();
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: curr.decimals,
    maximumFractionDigits: curr.decimals,
  });
  const prefix = amount < 0 ? `-${curr.symbol}` : curr.symbol;
  return `${prefix}${formatted}`;
}
