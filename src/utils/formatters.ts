/**
 * Financial & Currency Formatting Utilities
 */

export function formatCurrency(amount: number, currency: string = 'KWD'): string {
  const val = Number(amount) || 0;
  
  let symbol = 'د.ك';
  let decimals = 3;

  const curr = (currency || '').trim().toUpperCase();

  if (!curr || curr === 'KWD' || curr === 'د.ك' || curr.includes('كويتي') || curr.includes('KWD')) {
    symbol = 'د.ك';
    decimals = 3;
  } else if (curr === 'SAR' || curr.includes('سعودي')) {
    symbol = 'ر.س';
    decimals = 2;
  } else if (curr === 'USD' || curr === '$') {
    symbol = '$';
    decimals = 2;
  } else if (curr === 'AED' || curr.includes('إماراتي')) {
    symbol = 'د.إ';
    decimals = 2;
  } else if (curr === 'EUR' || curr === '€') {
    symbol = '€';
    decimals = 2;
  } else if (curr === 'EGP' || curr.includes('مصري')) {
    symbol = 'ج.م';
    decimals = 2;
  } else if (curr === 'BHD' || curr.includes('بحريني')) {
    symbol = 'د.ب';
    decimals = 3;
  } else if (curr === 'OMR' || curr.includes('عماني')) {
    symbol = 'ر.ع';
    decimals = 3;
  } else if (curr === 'QAR' || curr.includes('قطري')) {
    symbol = 'ر.ق';
    decimals = 2;
  } else if (curr === 'JOD' || curr.includes('أردني')) {
    symbol = 'د.أ';
    decimals = 3;
  } else {
    symbol = 'د.ك';
    decimals = 3;
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
