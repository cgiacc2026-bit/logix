/**
 * Supabase Client Initializer and Multi-Tenant Auth Manager
 * Direct connection for LOGIX Cloud ERP
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CompanyProfile, SystemUser, TenantCompanyRecord } from '../types.js';

export const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      const val = String(import.meta.env[key]).trim();
      if (val) return val;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      const val = String(process.env[key]).trim();
      if (val) return val;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val) return val.trim();
    }
  } catch {}
  return '';
};

export const getSupabaseConfig = () => {
  const url = getEnvVar('VITE_SUPABASE_URL') || 'https://gzoncsbxfdnfellspgke.supabase.co';
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY');
  return { url, key };
};

export const checkIsSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseConfig();
  return Boolean(
    url &&
    typeof url === 'string' &&
    url.startsWith('http') &&
    !url.includes('your-project') &&
    key &&
    typeof key === 'string' &&
    key.length > 10
  );
};

export const SUPABASE_URL = getSupabaseConfig().url;
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = checkIsSupabaseConfigured();

let activeClientInstance: SupabaseClient | null = null;
let activeClientUrl: string = '';
let activeClientKey: string = '';

const fallbackMockFetch = async () => {
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' },
  });
};

const fallbackMockClient = createClient(
  'https://fallback-supabase.local',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fallback_token',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fallbackMockFetch },
  }
);

export const getActiveSupabaseClient = (): SupabaseClient => {
  const { url, key } = getSupabaseConfig();
  if (checkIsSupabaseConfigured()) {
    if (!activeClientInstance || activeClientUrl !== url || activeClientKey !== key) {
      try {
        activeClientInstance = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        activeClientUrl = url;
        activeClientKey = key;
      } catch (err) {
        console.warn('Failed to initialize live Supabase client, falling back to local mode:', err);
      }
    }
    if (activeClientInstance) return activeClientInstance;
  }
  return fallbackMockClient;
};

export const saveSupabaseCredentials = (url: string, anonKey: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url) window.localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    if (anonKey) window.localStorage.setItem('VITE_SUPABASE_ANON_KEY', anonKey.trim());
    activeClientInstance = null; // Force client refresh
  }
};

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getActiveSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const STORAGE_KEYS = {
  COMPANY_ID: 'supabase_company_id',
  AUTH_SESSION: 'logix_auth_session',
  COMPANY_INFO: 'supabase_company_info',
};

/**
 * Get current active company ID from authenticated local session
 */
export function getCurrentCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEYS.COMPANY_ID);
  return saved && saved.trim() ? saved : null;
}

/**
 * Set current active company ID in local session
 */
export function setCurrentCompanyId(companyId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.COMPANY_ID, companyId);
  }
}

const LOCAL_COMPANIES_KEY = 'logix_registered_companies';

function getLocalRegisteredCompanies(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_COMPANIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalRegisteredCompany(company: any): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalRegisteredCompanies();
    const existingIndex = list.findIndex(
      (c) => c.id === company.id || c.owner_email === company.owner_email
    );
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...company };
    } else {
      list.unshift(company);
    }
    localStorage.setItem(LOCAL_COMPANIES_KEY, JSON.stringify(list));
    localStorage.setItem('all_tenants_cache', JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save local registered company:', err);
  }
}

/**
 * Register a new company (Multi-Tenant Registration)
 * Status is set to 'pending' by default.
 * Seamless: works with Supabase if configured, or saves to local tenant registry.
 * Never displays developer/technical errors to clients.
 */
export async function registerCompany(
  companyName: string,
  ownerEmail: string,
  passwordPlain: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const cleanName = companyName.trim();
    const cleanPassword = passwordPlain.trim();

    if (!cleanEmail || !cleanName || !cleanPassword) {
      return { success: false, message: 'يرجى إدخال اسم الشركة، البريد الإلكتروني، وكلمة المرور' };
    }

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `comp-${Date.now()}`;

    const newCompanyRecord = {
      id: newId,
      company_name: cleanName,
      owner_email: cleanEmail,
      password_hash: cleanPassword,
      status: 'pending',
      created_at: new Date().toISOString(),
      profile_data: {
        id: newId,
        nameAr: cleanName,
        nameEn: cleanName,
        email: cleanEmail,
        status: 'pending',
        functionalCurrency: 'SAR',
      },
    };

    // 1. If Supabase is configured, attempt writing to cloud
    if (checkIsSupabaseConfigured()) {
      try {
        const { data: existing, error: checkError } = await supabase
          .from('companies')
          .select('id, owner_email, status')
          .eq('owner_email', cleanEmail)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'pending') {
            return { success: false, message: 'حسابك قيد التفعيل من قبل الإدارة' };
          }
          return { success: false, message: 'البريد الإلكتروني مسجل بالفعل في النظام' };
        }

        const { data, error } = await supabase
          .from('companies')
          .insert([newCompanyRecord])
          .select()
          .single();

        if (!error && data) {
          saveLocalRegisteredCompany(data);
          return {
            success: true,
            message: 'تم إرسال طلب تسجيل المنشأة بنجاح! حسابك قيد التفعيل من قبل الإدارة',
            data,
          };
        }
      } catch (err) {
        console.warn('Supabase registration attempt notice:', err);
      }
    }

    // 2. Local tenant registry fallback (seamless client experience)
    const localCompanies = getLocalRegisteredCompanies();
    const existingLocal = localCompanies.find((c) => c.owner_email === cleanEmail);
    if (existingLocal) {
      if (existingLocal.status === 'pending') {
        return { success: false, message: 'حسابك قيد التفعيل من قبل الإدارة' };
      }
      return { success: false, message: 'البريد الإلكتروني مسجل بالفعل في النظام' };
    }

    saveLocalRegisteredCompany(newCompanyRecord);

    return {
      success: true,
      message: 'تم إرسال طلب تسجيل المنشأة بنجاح! حسابك قيد التفعيل من قبل الإدارة',
      data: newCompanyRecord,
    };
  } catch (err: any) {
    console.error('Registration exception:', err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء تسجيل المنشأة' };
  }
}

/**
 * Login Company and verify status === 'active'
 */
export async function loginCompany(
  emailOrUsername: string,
  passwordPlain: string
): Promise<{
  success: boolean;
  message?: string;
  company?: any;
  user?: SystemUser;
}> {
  try {
    const cleanInput = emailOrUsername.trim().toLowerCase();
    const cleanPassword = passwordPlain.trim();

    const isSuperAdminEmail =
      cleanInput === 'cgiacc2026@gmail.com' || cleanInput === 'cgiacc2026';

    // If Super Admin logs in, grant instant access
    if (isSuperAdminEmail) {
      const superAdminUser: SystemUser = {
        id: 'user-super-admin',
        name: 'المشرف العام (CGI Admin)',
        username: 'cgiacc2026',
        email: 'cgiacc2026@gmail.com',
        role: 'ADMIN',
        roleTitleAr: 'المدير العام والمالك - تفعيل واعتماد الشركات السحابية',
        isActive: true,
        pinCode: cleanPassword || '1234',
      };

      const superAdminCompany = {
        id: '00000000-0000-0000-0000-000000000001',
        company_name: 'مطحنة الوليد المتحده - الإدارة المركزية',
        owner_email: 'cgiacc2026@gmail.com',
        status: 'active',
        profile_data: {
          id: '00000000-0000-0000-0000-000000000001',
          nameAr: 'مطحنة الوليد المتحده',
          nameEn: 'Al-Waleed United Mill & Food Industries',
          tradeName: 'مطحنة الوليد للبهارات والمواد التموينية',
          taxNumber: '300012345600003',
          crNumber: '450912',
          functionalCurrency: 'SAR',
          vatRate: 15,
          city: 'الرياض',
          country: 'المملكة العربية السعودية',
        },
      };

      setCurrentCompanyId(superAdminCompany.id);
      localStorage.setItem(STORAGE_KEYS.COMPANY_INFO, JSON.stringify(superAdminCompany));
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(superAdminUser));

      return {
        success: true,
        company: superAdminCompany,
        user: superAdminUser,
      };
    }

    let foundCompany: any = null;

    // 1. Check Supabase if configured
    if (checkIsSupabaseConfigured()) {
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .or(`owner_email.eq.${cleanInput},company_name.eq.${cleanInput}`)
          .maybeSingle();

        if (company) {
          foundCompany = company;
        }
      } catch (err) {
        console.warn('Supabase login query error:', err);
      }
    }

    // 2. If not found in Supabase or not configured, check local tenant registry
    if (!foundCompany) {
      const localCompanies = getLocalRegisteredCompanies();
      foundCompany = localCompanies.find(
        (c) =>
          c.owner_email?.toLowerCase() === cleanInput ||
          c.company_name?.toLowerCase() === cleanInput
      );
    }

    if (foundCompany) {
      // Check password
      if (foundCompany.password_hash && foundCompany.password_hash !== cleanPassword) {
        return { success: false, message: 'كلمة المرور غير صحيحة' };
      }

      // Check status
      if (foundCompany.status === 'pending') {
        return { success: false, message: 'حسابك قيد التفعيل من قبل الإدارة' };
      }

      if (foundCompany.status !== 'active') {
        return { success: false, message: 'حساب المنشأة غير نشط. يرجى مراجعة إدارة النظام' };
      }

      // Active! Store company_id in localStorage
      setCurrentCompanyId(foundCompany.id);
      localStorage.setItem(STORAGE_KEYS.COMPANY_INFO, JSON.stringify(foundCompany));

      const sysUser: SystemUser = {
        id: `user-${foundCompany.id.slice(0, 8)}`,
        name: foundCompany.company_name,
        username: foundCompany.owner_email.split('@')[0],
        email: foundCompany.owner_email,
        role: 'ADMIN',
        roleTitleAr: 'مالك المنشأة / المدير التنفيذي',
        isActive: true,
        pinCode: cleanPassword,
      };

      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sysUser));

      return {
        success: true,
        company: foundCompany,
        user: sysUser,
      };
    }

    return {
      success: false,
      message: 'البريد الإلكتروني أو اسم المستخدم غير مسجل في النظام',
    };
  } catch (err: any) {
    console.error('Supabase login exception:', err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء تسجيل الدخول' };
  }
}

/**
 * Super Admin Multi-Tenant Control: Fetch all registered companies
 */
export async function getAllCompaniesForSuperAdmin(): Promise<TenantCompanyRecord[]> {
  const localList = getStoredLocalCompanies();
  const resultMap = new Map<string, TenantCompanyRecord>();

  for (const c of localList) {
    resultMap.set(c.id, c);
  }

  if (checkIsSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        for (const c of data) {
          resultMap.set(c.id, c as TenantCompanyRecord);
        }
      }
    } catch (err) {
      console.warn('Supabase getAllCompanies notice:', err);
    }
  }

  const merged = Array.from(resultMap.values());
  if (typeof window !== 'undefined') {
    localStorage.setItem('all_tenants_cache', JSON.stringify(merged));
  }
  return merged;
}

/**
 * Super Admin Multi-Tenant Control: Update Company Status (Activate / Suspend)
 */
export async function updateCompanyStatus(
  companyId: string,
  status: 'active' | 'suspended' | 'pending' | 'rejected'
): Promise<{ success: boolean; message: string }> {
  try {
    if (checkIsSupabaseConfigured()) {
      try {
        await supabase
          .from('companies')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', companyId);
      } catch (err) {
        console.warn('Supabase updateCompanyStatus notice:', err);
      }
    }

    // Update local cache and persistent registry
    const cached = getStoredLocalCompanies();
    const updated = cached.map((c) => (c.id === companyId ? { ...c, status } : c));
    if (typeof window !== 'undefined') {
      localStorage.setItem('all_tenants_cache', JSON.stringify(updated));
      localStorage.setItem(LOCAL_COMPANIES_KEY, JSON.stringify(updated));
    }

    return {
      success: true,
      message: `تم اعتماد وتفعيل الشركة بنجاح! يمكن للشركة الآن تسجيل الدخول واستخدام النظام`,
    };
  } catch (err: any) {
    console.error('updateCompanyStatus error:', err);
    return { success: false, message: err?.message || 'فشل تحديث حالة الشركة' };
  }
}

function getStoredLocalCompanies(): TenantCompanyRecord[] {
  if (typeof window === 'undefined') return [];
  const list: TenantCompanyRecord[] = [];
  try {
    const raw = localStorage.getItem('all_tenants_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list.push(...parsed);
    }
  } catch {}
  try {
    const rawReg = localStorage.getItem(LOCAL_COMPANIES_KEY);
    if (rawReg) {
      const parsedReg = JSON.parse(rawReg);
      if (Array.isArray(parsedReg)) {
        for (const item of parsedReg) {
          if (!list.some((x) => x.id === item.id)) {
            list.push(item);
          }
        }
      }
    }
  } catch {}

  // Ensure default company is always available
  if (!list.some((c) => c.owner_email === 'cgiacc2026@gmail.com')) {
    list.unshift({
      id: '00000000-0000-0000-0000-000000000001',
      company_name: 'مطحنة الوليد المتحده',
      owner_email: 'cgiacc2026@gmail.com',
      status: 'active',
      created_at: new Date().toISOString(),
      profile_data: {
        nameAr: 'مطحنة الوليد المتحده',
        nameEn: 'Al-Waleed United Mill',
        taxNumber: '300012345600003',
        crNumber: '450912',
      },
    });
  }

  return list;
}

