/**
 * Financial & Currency Formatting Utilities
 * Single Source of Truth for Financial Formatting across LOGIX ERP
 */

interface ActiveCompanyFinancialConfig {
  currency: string;
  symbol: string;
  decimals: number;
}

// In-memory reactive config initialized from local storage or defaults
let activeCompanyConfig: ActiveCompanyFinancialConfig = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('supabase_company_info');
      if (raw) {
        const parsed = JSON.parse(raw);
        const p = parsed.profile_data || parsed;
        const curr = (parsed.functional_currency || parsed.currency || p.functionalCurrency || p.currency || 'KWD').trim().toUpperCase();
        const sym = parsed.currency_symbol || p.currencySymbol || (curr === 'KWD' ? 'د.ك' : curr === 'SAR' ? 'ر.س' : curr === 'AED' ? 'د.إ' : curr);
        const dec = parsed.decimal_places ?? p.decimalPlaces ?? (curr === 'KWD' || curr === 'BHD' || curr === 'OMR' || curr === 'JOD' ? 3 : 2);
        return { currency: curr, symbol: sym, decimals: dec };
      }
    }
  } catch {
    // fallback
  }
  return { currency: 'KWD', symbol: 'د.ك', decimals: 3 };
})();

if (typeof window !== 'undefined') {
  window.addEventListener('company_settings_changed', (e: any) => {
    try {
      const comp = e.detail;
      if (comp) {
        const curr = (comp.functionalCurrency || comp.currency || 'KWD').trim().toUpperCase();
        const sym = comp.currencySymbol || (curr === 'KWD' ? 'د.ك' : curr === 'SAR' ? 'ر.س' : curr === 'AED' ? 'د.إ' : curr);
        const dec = comp.decimalPlaces !== undefined ? comp.decimalPlaces : (curr === 'KWD' || curr === 'BHD' || curr === 'OMR' || curr === 'JOD' ? 3 : 2);
        setActiveCompanyConfig({ currency: curr, symbol: sym, decimals: dec });
      }
    } catch {}
  });
}

export function setActiveCompanyConfig(config: { currency?: string; symbol?: string; decimals?: number }) {
  if (config.currency) {
    activeCompanyConfig.currency = config.currency.trim().toUpperCase();
  }
  if (config.symbol) {
    activeCompanyConfig.symbol = config.symbol;
  }
  if (config.decimals !== undefined) {
    activeCompanyConfig.decimals = config.decimals;
  }
}

export function getActiveCompanySettings(): { functionalCurrency?: string; currency?: string; decimalPlaces?: number; currencySymbol?: string } | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('supabase_company_info');
      if (raw) {
        const parsed = JSON.parse(raw);
        const p = parsed.profile_data || parsed;
        return {
          functionalCurrency: parsed.functional_currency || p.functionalCurrency || activeCompanyConfig.currency,
          currency: parsed.currency || p.currency || activeCompanyConfig.currency,
          decimalPlaces: parsed.decimal_places ?? p.decimalPlaces ?? activeCompanyConfig.decimals,
          currencySymbol: parsed.currency_symbol || p.currencySymbol || activeCompanyConfig.symbol,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    functionalCurrency: activeCompanyConfig.currency,
    currency: activeCompanyConfig.currency,
    decimalPlaces: activeCompanyConfig.decimals,
    currencySymbol: activeCompanyConfig.symbol,
  };
}

/**
 * Unified Financial Formatter:
 * formatCurrency(amount: number, currency?: string, customDecimals?: number)
 * Automatically utilizes the active company's functional currency and decimals
 * unless an explicit foreign currency is requested.
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  customDecimals?: number
): string {
  const val = Number(amount) || 0;
  const company = getActiveCompanySettings();

  // If no currency passed, or if caller passed empty string or the active company currency
  const passedCurr = (currency || '').trim().toUpperCase();
  const companyCurr = (company?.functionalCurrency || company?.currency || activeCompanyConfig.currency || 'KWD').trim().toUpperCase();
  
  const effectiveCurrency = (!passedCurr || passedCurr === companyCurr) ? companyCurr : passedCurr;

  let decimals = 3;
  if (customDecimals !== undefined) {
    decimals = customDecimals;
  } else if (effectiveCurrency === companyCurr && company?.decimalPlaces !== undefined) {
    decimals = company.decimalPlaces;
  } else if (
    effectiveCurrency === 'KWD' ||
    effectiveCurrency === 'د.ك' ||
    effectiveCurrency.includes('كويتي') ||
    effectiveCurrency === 'BHD' ||
    effectiveCurrency.includes('بحريني') ||
    effectiveCurrency === 'OMR' ||
    effectiveCurrency.includes('عماني') ||
    effectiveCurrency === 'JOD' ||
    effectiveCurrency.includes('أردني')
  ) {
    decimals = 3;
  } else {
    decimals = 2;
  }

  let symbol = 'د.ك';
  if (effectiveCurrency === companyCurr && company?.currencySymbol) {
    symbol = company.currencySymbol;
  } else if (effectiveCurrency === 'KWD' || effectiveCurrency === 'د.ك' || effectiveCurrency.includes('كويتي') || effectiveCurrency.includes('KWD')) {
    symbol = 'د.ك';
  } else if (effectiveCurrency === 'SAR' || effectiveCurrency.includes('سعودي')) {
    symbol = 'ر.س';
  } else if (effectiveCurrency === 'USD' || effectiveCurrency === '$') {
    symbol = '$';
  } else if (effectiveCurrency === 'AED' || effectiveCurrency.includes('إماراتي')) {
    symbol = 'د.إ';
  } else if (effectiveCurrency === 'EUR' || effectiveCurrency === '€') {
    symbol = '€';
  } else if (effectiveCurrency === 'EGP' || effectiveCurrency.includes('مصري')) {
    symbol = 'ج.م';
  } else if (effectiveCurrency === 'BHD' || effectiveCurrency.includes('بحريني')) {
    symbol = 'د.ب';
  } else if (effectiveCurrency === 'OMR' || effectiveCurrency.includes('عماني')) {
    symbol = 'ر.ع';
  } else if (effectiveCurrency === 'QAR' || effectiveCurrency.includes('قطري')) {
    symbol = 'ر.ق';
  } else if (effectiveCurrency === 'JOD' || effectiveCurrency.includes('أردني')) {
    symbol = 'د.أ';
  } else {
    symbol = effectiveCurrency;
  }

  const formatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (val < 0) {
    return `(${formatted}) ${symbol}`;
  }
  return `${formatted} ${symbol}`;
}

export function formatCompanyCurrency(
  amount: number,
  company?: { functionalCurrency?: string; currency?: string; decimalPlaces?: number } | null,
  fallbackCurrency: string = 'KWD'
): string {
  const curr = company?.functionalCurrency || company?.currency || fallbackCurrency;
  const dec = company?.decimalPlaces;
  return formatCurrency(amount, curr, dec);
}

export function formatNumber(amount: number, decimals: number = 3): string {
  return (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function getCategoryLabelAr(category: string): string {
  switch (category) {
    case 'ASSET':
      return 'الأصول';
    case 'LIABILITY':
      return 'الخصوم';
    case 'EQUITY':
      return 'حقوق الملكية';
    case 'REVENUE':
      return 'الإيرادات';
    case 'EXPENSE':
      return 'المصروفات';
    default:
      return category;
  }
}

export function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case 'ASSET':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'LIABILITY':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'EQUITY':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'REVENUE':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'EXPENSE':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}
