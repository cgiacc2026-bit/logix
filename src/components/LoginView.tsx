import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Layers,
  Sparkles,
  Database,
  Briefcase,
  FileSpreadsheet,
  Globe2,
  Mail,
  PlusCircle,
} from 'lucide-react';
import { SystemUser, CompanyProfile } from '../types.js';
import { registerCompany, loginCompany, setCurrentCompanyId } from '../services/supabaseClient.js';

interface LoginViewProps {
  onLogin: (user: SystemUser, selectedCompany?: CompanyProfile) => void;
  availableUsers: SystemUser[];
  currentCompany: CompanyProfile | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  availableUsers,
  currentCompany,
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Register company state
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regOwnerEmail, setRegOwnerEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Quick Demo account login
  const handleQuickLogin = (user: SystemUser) => {
    setUsername(user.username);
    setPinCode(user.pinCode || '1234');
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(user, currentCompany || undefined);
    }, 350);
  };

  // Handle Multi-Tenant Company Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanName = regCompanyName.trim();
    const cleanEmail = regOwnerEmail.trim().toLowerCase();
    const cleanPass = regPassword.trim();

    if (!cleanName) {
      setError('يرجى إدخال اسم الشركة');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صالح لمالك المنشأة');
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setError('يرجى إدخال كلمة مرور مكونة من 4 خانات على الأقل');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerCompany(cleanName, cleanEmail, cleanPass);
      setIsLoading(false);

      if (res.success) {
        setSuccessMessage('تم إرسال طلب تسجيل المنشأة بنجاح! حسابك قيد التفعيل من قبل الإدارة');
        setRegCompanyName('');
        setRegOwnerEmail('');
        setRegPassword('');
      } else {
        setError(res.message || 'فشل إرسال طلب التسجيل');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'حدث خطأ غير متوقع أثناء تسجيل المنشأة');
    }
  };

  // Handle Login
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pinCode.trim();

    if (!cleanUsername) {
      setError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }

    if (!cleanPin) {
      setError('يرجى إدخال رمز الدخول (PIN / كلمة المرور)');
      return;
    }

    setIsLoading(true);

    try {
      // 1. First check Supabase companies table for multi-tenant credentials
      const supabaseRes = await loginCompany(cleanUsername, cleanPin);

      if (supabaseRes.success && supabaseRes.user) {
        setIsLoading(false);
        const compProfile: CompanyProfile = supabaseRes.company?.profile_data || {
          ...currentCompany,
          id: supabaseRes.company.id,
          nameAr: supabaseRes.company.company_name,
          email: supabaseRes.company.owner_email,
        };
        onLogin(supabaseRes.user, compProfile);
        return;
      }

      // If status is pending, show exact required message
      if (supabaseRes.message === 'حسابك قيد التفعيل من قبل الإدارة') {
        setIsLoading(false);
        setError('حسابك قيد التفعيل من قبل الإدارة');
        return;
      }

      // 2. Check local/fallback system users (for demo/admin users)
      const matchedUser = availableUsers.find(
        (u) =>
          u.username.toLowerCase() === cleanUsername ||
          u.email.toLowerCase() === cleanUsername
      );

      if (matchedUser) {
        if (matchedUser.pinCode && matchedUser.pinCode !== cleanPin) {
          setIsLoading(false);
          setError('رمز الدخول (PIN) غير صحيح. يرجى المحاولة مجدداً');
          return;
        }

        setIsLoading(false);
        onLogin(matchedUser, currentCompany || undefined);
        return;
      }

      setIsLoading(false);
      setError(supabaseRes.message || 'اسم المستخدم أو البريد الإلكتروني غير مسجل في النظام');
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'حدث خطأ أثناء محاولة تسجيل الدخول');
    }
  };

  return (
    <div className="min-h-screen bg-[#071322] text-slate-100 flex flex-col justify-between relative overflow-hidden font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white">
      {/* Background Ambience / Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[140px] pointer-events-none" />

      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#0B1A2E]/70 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 border border-blue-400/30">
            <span className="text-base tracking-wider">LX</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              لوجيكس ERP <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-mono border border-blue-500/30">LOGIX Cloud</span>
            </h1>
            <p className="text-[11px] text-slate-400">النظام السحابي الموحد لإدارة وتخطيط الموارد (Multi-Tenant IFRS)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> نظام سحابي آمن ومعتمد
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-950/70 border border-blue-800/60 text-cyan-300 text-[11px] font-mono">
            v4.5 Enterprise
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0B1D33]/90 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          
          {/* Left/Main Form Panel (col-span-7) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-cyan-300 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> بوابة تسجيل الدخول الموحدة
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">مرحباً بك في لوجيكس ERP</h2>
                <p className="text-sm text-slate-400 mt-1">
                  أدخل بيانات اعتماد حسابك للوصول إلى لوحة العمليات المحاسبية والتشغيلية.
                </p>
              </div>

              {/* Active Enterprise Banner */}
              <div className="mb-5 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center border border-blue-500/30">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">المنشأة المستهدفة:</div>
                    <div className="text-xs font-bold text-white">
                      {currentCompany?.nameAr || 'مجموعة لوجيكس لإدارة الموارد'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {currentCompany?.crNumber ? `س.ت: ${currentCompany.crNumber}` : 'حساب رئيسي'}
                </span>
              </div>

              {/* Mode Switch Tabs (تسجيل الدخول / تسجيل شركة جديدة) */}
              <div className="flex p-1 bg-slate-900/90 rounded-xl border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'LOGIN'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'REGISTER'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  تسجيل شركة جديدة
                </button>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {authMode === 'REGISTER' ? (
                /* Registration Form (Multi-Tenant Registration) */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      اسم الشركة أو المؤسسة (company_name)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        placeholder="مثال: شركة الأفق للاستشارات والحلول"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      البريد الإلكتروني لمالك المنشأة (owner_email)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        dir="ltr"
                        value={regOwnerEmail}
                        onChange={(e) => setRegOwnerEmail(e.target.value)}
                        placeholder="owner@company.com"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      كلمة المرور (password_hash)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        dir="ltr"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ملاحظة: سيتم إدراج المنشأة بحالة <span className="text-amber-400 font-mono">status: 'pending'</span> وتتطلب تفعيل الإدارة للدخول.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري إرسال طلب تسجيل المنشأة...</span>
                      </>
                    ) : (
                      <>
                        <span>إرسال طلب تسجيل المنشأة</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Login Form */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اسم المستخدم أو البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="مثال: admin أو admin@logixerp.com"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      رمز الدخول السريع (PIN) أو كلمة المرور
                    </label>
                    <span className="text-[11px] text-slate-400">الرمز الافتراضي: 1234</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      dir="ltr"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="••••"
                      maxLength={12}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm tracking-widest focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>تذكر جلسة العمل</span>
                  </label>
                  <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                    تغيير رمز الدخول؟
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري التحقق والدخول...</span>
                    </>
                  ) : (
                    <>
                      <span>دخول إلى لوحة التحكم</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>نظام محمي بتشفير SSL 256-bit</span>
              <span>معايير IFRS الدولية للتقارير المالية</span>
            </div>
          </div>

          {/* Right Panel: Quick Role Accounts & Capabilities (col-span-5) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#0F243E] to-[#0A1A2E] p-6 sm:p-8 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  حسابات الوصول السريع (تجربة بنقرة واحدة)
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                اضغط على أي دور وظيفي أدناه لتسجيل الدخول الفوري وتجربة الصلاحيات:
              </p>

              <div className="space-y-2.5">
                {availableUsers.slice(0, 5).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    type="button"
                    className="w-full p-2.5 rounded-xl bg-slate-900/60 hover:bg-blue-900/40 border border-slate-700/80 hover:border-blue-500/50 text-right transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs border border-blue-500/30 group-hover:scale-105 transition-transform">
                        {u.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span className="text-cyan-400 font-mono">@{u.username}</span>
                          <span>•</span>
                          <span className="text-slate-300">{u.roleTitleAr}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors rotate-180" />
                  </button>
                ))}
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>دورة محاسبية شاملة (شجرة الحسابات، قيود، أستاذ عام، ميزان مراجعة)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>كشف حساب تفصيلي للعملاء والموردين وتصدير Excel</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>إدارة الفواتير والمخزون وسندات القبض والصرف والتصنيع</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-slate-800/80 bg-[#0B1A2E]/50 text-center text-xs text-slate-500 z-10">
        جميع الحقوق محفوظة © {new Date().getFullYear()} - منصة لوجيكس السحابية لإدارة وتخطيط الموارد LOGIX ERP (IFRS Compliant)
      </footer>
    </div>
  );
};
