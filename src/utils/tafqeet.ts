/**
 * Full Arabic Number to Words Converter (Tafqeet / تفقيط الأعداد والعملات بالكلمات)
 * Supports up to Billions with 3 decimal fraction places (Fils / Halalas / Cents).
 */

const ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
];

const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسعمائة', 'ستعمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertGroup(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones > 0 ? `${ONES[ones]} و${TENS[tens]}` : TENS[tens];
  }
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (remainder === 0) return HUNDREDS[hundreds];
  return `${HUNDREDS[hundreds]} و${convertGroup(remainder)}`;
}

export function numberToArabicWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'صفر';

  const parts: string[] = [];

  const billions = Math.floor(n / 1000000000);
  let rem = n % 1000000000;

  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;

  const thousands = Math.floor(rem / 1000);
  const ones = rem % 1000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else parts.push(`${convertGroup(billions)} مليارات`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليوناً`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألفاً`);
  }

  if (ones > 0) {
    parts.push(convertGroup(ones));
  }

  return parts.join(' و');
}

export function tafqeetCurrency(amount: number, currencyStr: string = 'KWD'): string {
  const val = Math.abs(Number(amount) || 0);
  const integerPart = Math.floor(val);
  
  // Get 3 decimal fraction part (e.g., 0.850 -> 850)
  const fractionPart = Math.round((val - integerPart) * 1000);

  const currUpper = (currencyStr || '').trim().toUpperCase();

  let mainUnit = 'دينار كويتي';
  let subUnit = 'فلس';
  let isThreeDecimals = true;

  if (currUpper.includes('SAR') || currUpper.includes('سعودي')) {
    mainUnit = 'ريال سعودي';
    subUnit = 'هللة';
    isThreeDecimals = false;
  } else if (currUpper.includes('BHD') || currUpper.includes('بحريني')) {
    mainUnit = 'دينار بحريني';
    subUnit = 'فلس';
    isThreeDecimals = true;
  } else if (currUpper.includes('OMR') || currUpper.includes('عماني')) {
    mainUnit = 'ريال عماني';
    subUnit = 'بيسة';
    isThreeDecimals = true;
  } else if (currUpper.includes('AED') || currUpper.includes('إماراتي')) {
    mainUnit = 'درهم إماراتي';
    subUnit = 'فلس';
    isThreeDecimals = false;
  } else if (currUpper.includes('USD') || currUpper === '$') {
    mainUnit = 'دولار أمريكي';
    subUnit = 'سنت';
    isThreeDecimals = false;
  } else if (currUpper.includes('EGP') || currUpper.includes('مصري')) {
    mainUnit = 'جنيه مصري';
    subUnit = 'قرش';
    isThreeDecimals = false;
  } else {
    mainUnit = 'دينار كويتي';
    subUnit = 'فلس';
    isThreeDecimals = true;
  }

  let result = 'فقط ';

  if (integerPart > 0) {
    result += `${numberToArabicWords(integerPart)} ${mainUnit}`;
  } else if (fractionPart === 0) {
    result += `صفر ${mainUnit}`;
  }

  if (fractionPart > 0) {
    const actualSubVal = isThreeDecimals ? fractionPart : Math.round(fractionPart / 10);
    const subWords = numberToArabicWords(actualSubVal);
    if (integerPart > 0) {
      result += ` و${subWords} ${subUnit}`;
    } else {
      result += `${subWords} ${subUnit}`;
    }
  }

  result += ' لا غير';

  return result;
}
