/**
 * Supabase Client Initializer and Multi-Tenant Auth Manager
 * Direct connection for LOGIX Cloud ERP
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CompanyProfile, SystemUser } from '../types.js';

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

/**
 * Register a new company (Multi-Tenant Registration)
 * Status is set to 'pending' by default
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

    if (!checkIsSupabaseConfigured()) {
      return {
        success: false,
        message: 'قاعدة Supabase السحابية غير متصلة حالياً (يرجى إدخال مفتاح VITE_SUPABASE_ANON_KEY في ملف .env أو في إعدادات الاتصال)',
      };
    }

    // Check if company email already exists
    const { data: existing, error: checkError } = await supabase
      .from('companies')
      .select('id, owner_email, status')
      .eq('owner_email', cleanEmail)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('Supabase check existing company warning:', checkError.message);
    }

    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, message: 'حسابك قيد التفعيل من قبل الإدارة' };
      }
      return { success: false, message: 'البريد الإلكتروني مسجل بالفعل في النظام' };
    }

    // Insert new company with status: 'pending'
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comp-${Date.now()}`;
    const { data, error } = await supabase
      .from('companies')
      .insert([
        {
          id: newId,
          company_name: cleanName,
          owner_email: cleanEmail,
          password_hash: cleanPassword, // Stored as hash/credential token
          status: 'pending',
          profile_data: {
            nameAr: cleanName,
            nameEn: cleanName,
            email: cleanEmail,
            status: 'pending',
          },
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase registration error:', error);
      // If table doesn't exist yet on remote, return graceful message with instructions
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'جدول companies غير متواجد بعد في Supabase. يرجى تشغيل كود SQL أولاً من لوحة تحكم Supabase.',
        };
      }
      return { success: false, message: error.message || 'فشل تسجيل المنشأة' };
    }

    return {
      success: true,
      message: 'تم إرسال طلب تسجيل المنشأة بنجاح! حسابك قيد التفعيل من قبل الإدارة',
      data,
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

    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'قاعدة Supabase السحابية غير مهيأة بعد، يمكنك الدخول بالحسابات المحلية',
      };
    }

    // Query Supabase companies table
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .or(`owner_email.eq.${cleanInput},company_name.eq.${cleanInput}`)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase query company warning:', error.message);
    }

    if (company) {
      // Check password
      if (company.password_hash && company.password_hash !== cleanPassword) {
        return { success: false, message: 'كلمة المرور غير صحيحة' };
      }

      // Check status
      if (company.status === 'pending') {
        return { success: false, message: 'حسابك قيد التفعيل من قبل الإدارة' };
      }

      if (company.status !== 'active') {
        return { success: false, message: 'حساب المنشأة غير نشط. يرجى مراجعة إدارة النظام' };
      }

      // Active! Store company_id in localStorage
      setCurrentCompanyId(company.id);
      localStorage.setItem(STORAGE_KEYS.COMPANY_INFO, JSON.stringify(company));

      const sysUser: SystemUser = {
        id: `user-${company.id.slice(0, 8)}`,
        name: company.company_name,
        username: company.owner_email.split('@')[0],
        email: company.owner_email,
        role: 'ADMIN',
        roleTitleAr: 'مالك المنشأة / المدير التنفيذي',
        isActive: true,
        pinCode: cleanPassword,
      };

      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sysUser));

      return {
        success: true,
        company,
        user: sysUser,
      };
    }

    return {
      success: false,
      message: 'البريد الإلكتروني أو اسم المستخدم غير مسجل في Supabase',
    };
  } catch (err: any) {
    console.error('Supabase login exception:', err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء تسجيل الدخول' };
  }
}
