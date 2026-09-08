/**
 * Financial & Currency Formatting Utilities
 */

/**
 * Financial & Currency Formatting Utilities
 */

function getActiveCompanySettings(): { functionalCurrency?: string; currency?: string; decimalPlaces?: number } | null {
  try {
    const raw = localStorage.getItem('supabase_company_info');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

export function formatCurrency(
  amount: number,
  currency?: string,
  customDecimals?: number
): string {
  const val = Number(amount) || 0;
  const company = getActiveCompanySettings();

  const effectiveCurrency = (currency || company?.functionalCurrency || company?.currency || 'KWD').trim().toUpperCase();
  
  let decimals = 3;
  if (customDecimals !== undefined) {
    decimals = customDecimals;
  } else if (company?.decimalPlaces !== undefined && typeof company.decimalPlaces === 'number') {
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
  if (effectiveCurrency === 'KWD' || effectiveCurrency === 'د.ك' || effectiveCurrency.includes('كويتي') || effectiveCurrency.includes('KWD')) {
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
