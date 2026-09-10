import { CompanyProfile } from '../types.ts';
import { DEMO_COMPANY, DEMO_COMPANY_ID } from '../services/demoService.ts';
import { getCurrentCompanyId } from '../services/supabaseClient.ts';
import { localDataStore } from '../services/dataService.ts';
import { DEFAULT_COMPANY_PROFILE } from '../server/defaultData.js';

/**
 * Robust Dynamic Active Company Resolver
 * Guarantees that invoices, receipts, account statements, and print templates
 * always dynamically reflect the active enterprise (company_id / getCurrentCompanyId() / localDataStore),
 * fully isolating LOGIX Demo and multi-tenant companies without any hardcoded leakages.
 */
export function resolveActiveCompany(
  providedCompany?: CompanyProfile | null,
  documentCompanyId?: string
): CompanyProfile {
  // Determine effective company ID in order of priority:
  // 1. Document's own companyId (if the invoice/statement is tagged to a specific company)
  // 2. Currently active authenticated company ID
  // 3. LocalDataStore effective company ID
  // 4. Provided company's ID
  const activeId =
    documentCompanyId ||
    getCurrentCompanyId() ||
    localDataStore.getEffectiveCompanyId() ||
    providedCompany?.id;

  const isDemo =
    activeId === DEMO_COMPANY_ID ||
    activeId === 'company-demo-clients-002' ||
    providedCompany?.id === DEMO_COMPANY_ID ||
    Boolean(
      providedCompany?.nameAr &&
        (providedCompany.nameAr.includes('LOGIX Demo') ||
          providedCompany.nameAr.includes('تجريبية'))
    );

  if (isDemo) {
    // Return the dedicated demo profile isolated from all other companies
    return {
      ...DEMO_COMPANY,
      ...(providedCompany?.id === DEMO_COMPANY_ID ? providedCompany : {}),
      id: DEMO_COMPANY_ID,
      nameAr: providedCompany?.nameAr?.includes('LOGIX Demo')
        ? providedCompany.nameAr
        : DEMO_COMPANY.nameAr,
      nameEn: providedCompany?.nameEn || DEMO_COMPANY.nameEn,
      tradeName: providedCompany?.tradeName || DEMO_COMPANY.tradeName,
      headerTitle: providedCompany?.headerTitle || 'بيئة تجريبية لعروض العملاء',
      crNumber: providedCompany?.crNumber || DEMO_COMPANY.crNumber,
      taxNumber: providedCompany?.taxNumber || DEMO_COMPANY.taxNumber,
      phone: providedCompany?.phone || DEMO_COMPANY.phone,
      email: providedCompany?.email || DEMO_COMPANY.email,
      streetName: providedCompany?.streetName || DEMO_COMPANY.streetName,
      district: providedCompany?.district || DEMO_COMPANY.district,
      city: providedCompany?.city || DEMO_COMPANY.city,
      country: providedCompany?.country || DEMO_COMPANY.country,
      generalManager:
        providedCompany?.generalManager ||
        DEMO_COMPANY.generalManager ||
        'م. فهد السالم (مدير عام تجريبي)',
      financialManager:
        providedCompany?.financialManager ||
        DEMO_COMPANY.financialManager ||
        'أ. ريم المطيري (المدير المالي)',
      chiefAccountant:
        providedCompany?.chiefAccountant ||
        DEMO_COMPANY.chiefAccountant ||
        'أ. عمر الدوسري (رئيس الحسابات)',
      headerNotes:
        providedCompany?.headerNotes ||
        DEMO_COMPANY.headerNotes ||
        'بيئة تجريبية لاختبار دورات التصنيع وإدارة سلاسل الإمداد وعروض العملاء',
      footerNotes:
        providedCompany?.footerNotes ||
        DEMO_COMPANY.footerNotes ||
        'نسخة تجريبية لعرض إمكانيات نظام لوجيكس السحابي للعملاء المحتملين',
    };
  }

  // If provided company matches activeId and has a genuine company name
  if (
    providedCompany &&
    providedCompany.nameAr &&
    (!activeId || providedCompany.id === activeId)
  ) {
    return providedCompany;
  }

  // Try to retrieve live company from localDataStore which dynamically reads active tenant profile
  try {
    const live = localDataStore.getCompany();
    if (live && live.nameAr) {
      return live;
    }
  } catch (e) {
    // ignore
  }

  if (providedCompany && providedCompany.nameAr) {
    return providedCompany;
  }

  // Fallback to default company profile
  return DEFAULT_COMPANY_PROFILE;
}
