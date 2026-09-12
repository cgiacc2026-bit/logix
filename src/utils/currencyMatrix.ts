// Geographic Financial Matrix (مصفوفة المطابقة الجغرافية/المالية الإلزامية)
// Strictly binds Country -> Functional Currency -> Currency Symbol -> Decimal Places (Sub-unit)

export interface CountryFinancialProfile {
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
  currencyCode: string;
  functionalCurrency: string; // Alias for currencyCode
  currencyNameAr: string;
  currencySymbolAr: string;
  currencySymbol: string;     // Alias for currencySymbolAr
  subUnitAr: string;
  subUnitNameAr: string;      // Alias for subUnitAr
  decimalPlaces: number;
  isLocked: boolean; // Locked decimals according to Central Bank monetary standards
  notesAr: string;
  centralBankStandard: string; // Alias for notesAr
  flag: string;
}

export const COUNTRY_FINANCIAL_MATRIX: Record<string, CountryFinancialProfile> = {
  'الكويت': {
    countryCode: 'KW',
    countryNameAr: 'دولة الكويت',
    countryNameEn: 'Kuwait',
    currencyCode: 'KWD',
    functionalCurrency: 'KWD',
    currencyNameAr: 'الدينار الكويتي',
    currencySymbolAr: 'د.ك',
    currencySymbol: 'د.ك',
    subUnitAr: 'فلس (Fils)',
    subUnitNameAr: 'فلس (Fils)',
    decimalPlaces: 3,
    isLocked: true,
    notesAr: 'معيار بنك الكويت المركزي: 3 خانات كسرية إلزامية (1 دينار = 1000 فلس)',
    centralBankStandard: 'معايير بنك الكويت المركزي (CBK Standard)',
    flag: '🇰🇼',
  },
  'المملكة العربية السعودية': {
    countryCode: 'SA',
    countryNameAr: 'المملكة العربية السعودية',
    countryNameEn: 'Saudi Arabia',
    currencyCode: 'SAR',
    functionalCurrency: 'SAR',
    currencyNameAr: 'الريال السعودي',
    currencySymbolAr: 'ر.س',
    currencySymbol: 'ر.س',
    subUnitAr: 'هللة (Halala)',
    subUnitNameAr: 'هللة (Halala)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'معيار البنك المركزي السعودي (ساما): خانتان عشريتان (1 ريال = 100 هللة)',
    centralBankStandard: 'معايير البنك المركزي السعودي (SAMA Standard)',
    flag: '🇸🇦',
  },
  'الإمارات العربية المتحدة': {
    countryCode: 'AE',
    countryNameAr: 'الإمارات العربية المتحدة',
    countryNameEn: 'United Arab Emirates',
    currencyCode: 'AED',
    functionalCurrency: 'AED',
    currencyNameAr: 'الدرهم الإماراتي',
    currencySymbolAr: 'د.إ',
    currencySymbol: 'د.إ',
    subUnitAr: 'فلس (Fils)',
    subUnitNameAr: 'فلس (Fils)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'معيار مصرف الإمارات المركزي: خانتان عشريتان (1 درهم = 100 فلس)',
    centralBankStandard: 'معايير مصرف الإمارات المركزي (CBUAE Standard)',
    flag: '🇦🇪',
  },
  'مملكة البحرين': {
    countryCode: 'BH',
    countryNameAr: 'مملكة البحرين',
    countryNameEn: 'Bahrain',
    currencyCode: 'BHD',
    functionalCurrency: 'BHD',
    currencyNameAr: 'الدينار البحريني',
    currencySymbolAr: 'د.ب',
    currencySymbol: 'د.ب',
    subUnitAr: 'فلس (Fils)',
    subUnitNameAr: 'فلس (Fils)',
    decimalPlaces: 3,
    isLocked: true,
    notesAr: 'معيار مصرف البحرين المركزي: 3 خانات كسرية إلزامية (1 دينار = 1000 فلس)',
    centralBankStandard: 'معايير مصرف البحرين المركزي (CBB Standard)',
    flag: '🇧🇭',
  },
  'سلطنة عمان': {
    countryCode: 'OM',
    countryNameAr: 'سلطنة عمان',
    countryNameEn: 'Oman',
    currencyCode: 'OMR',
    functionalCurrency: 'OMR',
    currencyNameAr: 'الريال العماني',
    currencySymbolAr: 'ر.ع',
    currencySymbol: 'ر.ع',
    subUnitAr: 'بيسة (Baisa)',
    subUnitNameAr: 'بيسة (Baisa)',
    decimalPlaces: 3,
    isLocked: true,
    notesAr: 'معيار البنك المركزي العماني: 3 خانات كسرية إلزامية (1 ريال = 1000 بيسة)',
    centralBankStandard: 'معايير البنك المركزي العماني (CBO Standard)',
    flag: '🇴🇲',
  },
  'دولة قطر': {
    countryCode: 'QA',
    countryNameAr: 'دولة قطر',
    countryNameEn: 'Qatar',
    currencyCode: 'QAR',
    functionalCurrency: 'QAR',
    currencyNameAr: 'الريال القطري',
    currencySymbolAr: 'ر.ق',
    currencySymbol: 'ر.ق',
    subUnitAr: 'درهم (Dirham)',
    subUnitNameAr: 'درهم (Dirham)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'معيار مصرف قطر المركزي: خانتان عشريتان (1 ريال = 100 درهم)',
    centralBankStandard: 'معايير مصرف قطر المركزي (QCB Standard)',
    flag: '🇶🇦',
  },
  'جمهورية مصر العربية': {
    countryCode: 'EG',
    countryNameAr: 'جمهورية مصر العربية',
    countryNameEn: 'Egypt',
    currencyCode: 'EGP',
    functionalCurrency: 'EGP',
    currencyNameAr: 'الجنيه المصري',
    currencySymbolAr: 'ج.م',
    currencySymbol: 'ج.م',
    subUnitAr: 'قرش (Piastre)',
    subUnitNameAr: 'قرش (Piastre)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'معيار البنك المركزي المصري: خانتان عشريتان (1 جنيه = 100 قرش)',
    centralBankStandard: 'معايير البنك المركزي المصري (CBE Standard)',
    flag: '🇪🇬',
  },
  'المملكة الأردنية الهاشمية': {
    countryCode: 'JO',
    countryNameAr: 'المملكة الأردنية الهاشمية',
    countryNameEn: 'Jordan',
    currencyCode: 'JOD',
    functionalCurrency: 'JOD',
    currencyNameAr: 'الدينار الأردني',
    currencySymbolAr: 'د.أ',
    currencySymbol: 'د.أ',
    subUnitAr: 'فلس (Fils)',
    subUnitNameAr: 'فلس (Fils)',
    decimalPlaces: 3,
    isLocked: true,
    notesAr: 'معيار البنك المركزي الأردني: 3 خانات كسرية إلزامية (1 دينار = 1000 فلس)',
    centralBankStandard: 'معايير البنك المركزي الأردني (CBJ Standard)',
    flag: '🇯🇴',
  },
  'الولايات المتحدة الأمريكية': {
    countryCode: 'US',
    countryNameAr: 'الولايات المتحدة الأمريكية',
    countryNameEn: 'United States',
    currencyCode: 'USD',
    functionalCurrency: 'USD',
    currencyNameAr: 'الدولار الأمريكي',
    currencySymbolAr: '$',
    currencySymbol: '$',
    subUnitAr: 'سنت (Cent)',
    subUnitNameAr: 'سنت (Cent)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'المعايير الفيدرالية الأمريكية: خانتان عشريتان (1 دولار = 100 سنت)',
    centralBankStandard: 'معايير البنك الاحتياطي الفيدرالي (US Fed Standard)',
    flag: '🇺🇸',
  },
  'الاتحاد الأوروبي': {
    countryCode: 'EU',
    countryNameAr: 'الاتحاد الأوروبي',
    countryNameEn: 'European Union',
    currencyCode: 'EUR',
    functionalCurrency: 'EUR',
    currencyNameAr: 'اليورو الأوروبي',
    currencySymbolAr: '€',
    currencySymbol: '€',
    subUnitAr: 'سنت (Cent)',
    subUnitNameAr: 'سنت (Cent)',
    decimalPlaces: 2,
    isLocked: true,
    notesAr: 'معيار البنك المركزي الأوروبي: خانتان عشريتان (1 يورو = 100 سنت)',
    centralBankStandard: 'معايير البنك المركزي الأوروبي (ECB Standard)',
    flag: '🇪🇺',
  },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_FINANCIAL_MATRIX);

/**
 * Get country financial profile by country name (Arabic or English) or code
 */
export function getCountryFinancialProfile(identifier?: string): CountryFinancialProfile {
  const defaultProfile = COUNTRY_FINANCIAL_MATRIX['الكويت'];
  if (!identifier) return defaultProfile;

  const clean = identifier.trim().toLowerCase();

  // 1. Direct key match
  if (COUNTRY_FINANCIAL_MATRIX[identifier]) {
    return COUNTRY_FINANCIAL_MATRIX[identifier];
  }

  // 2. Search all profiles
  for (const [key, profile] of Object.entries(COUNTRY_FINANCIAL_MATRIX)) {
    if (
      key.toLowerCase() === clean ||
      profile.countryCode.toLowerCase() === clean ||
      profile.countryNameAr.toLowerCase() === clean ||
      profile.countryNameEn.toLowerCase() === clean ||
      profile.currencyCode.toLowerCase() === clean ||
      clean.includes(profile.countryNameAr.toLowerCase()) ||
      profile.countryNameAr.toLowerCase().includes(clean) ||
      clean.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(clean)
    ) {
      return profile;
    }
  }

  return defaultProfile;
}

/**
 * Format currency strictly adhering to the country standard decimal places
 */
export function formatCurrencyStrict(amount: number, currency: string = 'KWD', decimals?: number): string {
  const num = Number(amount) || 0;
  const dec = decimals !== undefined ? decimals : (currency.toUpperCase() === 'KWD' || currency.toUpperCase() === 'BHD' || currency.toUpperCase() === 'OMR' || currency.toUpperCase() === 'JOD' ? 3 : 2);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return `${formatted} ${currency}`;
}

/**
 * Check if a country has locked decimal places and functional currency
 */
export function isCountryLocked(identifier?: string): boolean {
  const profile = getCountryFinancialProfile(identifier);
  return profile.isLocked;
}
