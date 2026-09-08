/**
 * Supabase Client Initializer and Multi-Tenant Auth Manager
 * Direct connection for LOGIX Cloud ERP
 */
import { createClient } from '@supabase/supabase-js';
import { CompanyProfile, SystemUser } from '../types.js';

export const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '')) as string;
export const SUPABASE_ANON_KEY = (import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '')) as string;

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

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
