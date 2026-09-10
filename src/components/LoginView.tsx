import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Database,
  Mail,
  PlusCircle,
  Eye,
  EyeOff,
  Server,
  FileCheck,
  LockKeyhole,
  Rocket,
  LayoutDashboard,
  ShoppingBag,
  FileText,
  DollarSign,
  Users2,
  Package,
  BarChart3,
  FolderTree,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ChevronLeft,
} from 'lucide-react';
import { SystemUser, CompanyProfile } from '../types.js';
import {
  registerCompany,
  loginCompany,
} from '../services/supabaseClient.js';
import { DEFAULT_COMPANY_PROFILE } from '../server/defaultData.js';
import { DEMO_COMPANY } from '../services/demoService.js';

interface LoginViewProps {
  onLogin: (user: SystemUser, selectedCompany?: CompanyProfile) => void;
  availableUsers: SystemUser[];
  currentCompany?: CompanyProfile | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  availableUsers,
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register company state
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regOwnerEmail, setRegOwnerEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Handle Multi-Tenant Company Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanName = regCompanyName.trim();
    const cleanEmail = regOwnerEmail.trim().toLowerCase();
    const cleanPass = regPassword.trim();

    if (!cleanName) {
      setError('يرجى إدخال اسم الشركة أو المؤسسة');
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
        setSuccessMessage('تم إرسال طلب تسجيل المنشأة بنجاح! حسابك قيد التفعيل والاعتماد من قبل إدارة النظام.');
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

  // Centralized Secure Login Executor
  const executeLogin = async (rawUsername: string, rawPin: string, explicitLoginCode?: string) => {
    setError(null);
    setSuccessMessage(null);

    const cleanUsername = rawUsername.trim().toLowerCase();
    const cleanPin = rawPin.trim();

    if (!cleanUsername) {
      setError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني المعتمد');
      return;
    }

    if (!cleanPin) {
      setError('يرجى إدخال كلمة المرور أو رمز الدخول (PIN)');
      return;
    }

    setIsLoading(true);

    try {
      // 1. First check Supabase / tenant registry for multi-tenant credentials, Super Admin or Demo
      const supabaseRes = await loginCompany(cleanUsername, cleanPin, explicitLoginCode);

      if (supabaseRes.success && supabaseRes.user) {
        setIsLoading(false);
        setIsDemoLoading(false);

        const isDemo =
          explicitLoginCode === 'demo' ||
          supabaseRes.company?.type === 'demo' ||
          supabaseRes.company?.login_code === 'demo' ||
          supabaseRes.company?.id === '00000000-0000-0000-0000-000000000099' ||
          cleanUsername === 'logixdemo@logix.com';

        const compProfile: CompanyProfile =
          supabaseRes.company?.profile_data ||
          (isDemo
            ? DEMO_COMPANY
            : {
                ...DEFAULT_COMPANY_PROFILE,
                id: supabaseRes.company?.id || 'company-official-001',
                nameAr: supabaseRes.company?.company_name || 'المنشأة المعتمدة',
                email: supabaseRes.company?.owner_email || cleanUsername,
              });

        onLogin(supabaseRes.user, compProfile);
        return;
      }

      // If tenant account is pending approval
      if (supabaseRes.message === 'حسابك قيد التفعيل من قبل الإدارة') {
        setIsLoading(false);
        setIsDemoLoading(false);
        setError('حسابك قيد التفعيل والاعتماد من قبل إدارة النظام. يرجى التواصل مع الدعم أو المشرف لتفعيل الحساب.');
        return;
      }

      // 2. Check local/system users for authorized staff
      const matchedUser = availableUsers.find(
        (u) =>
          u.username.toLowerCase() === cleanUsername ||
          u.email.toLowerCase() === cleanUsername
      );

      if (matchedUser) {
        if (matchedUser.pinCode && matchedUser.pinCode !== cleanPin) {
          setIsLoading(false);
          setIsDemoLoading(false);
          setError('بيانات الاعتماد أو رمز الدخول (PIN) غير صحيح. يرجى التأكد وإعادة المحاولة.');
          return;
        }

        setIsLoading(false);
        setIsDemoLoading(false);
        onLogin(matchedUser, undefined);
        return;
      }

      // Safe Demo fallback: If demo credentials were used, grant access unconditionally
      if (cleanUsername === 'logixdemo@logix.com' || cleanUsername === 'demo' || cleanUsername === 'logixdemo') {
        setIsLoading(false);
        setIsDemoLoading(false);
        const demoUser: SystemUser = {
          id: 'user-demo-001',
          name: 'مستخدم تجريبي (Demo User)',
          username: 'logixdemo',
          email: 'logixdemo@logix.com',
          role: 'ADMIN',
          roleTitleAr: 'مدير النظام التجريبي',
          isActive: true,
          pinCode: 'P0182671648n$',
        };
        onLogin(demoUser, DEMO_COMPANY);
        return;
      }

      setIsLoading(false);
      setIsDemoLoading(false);
      setError(supabaseRes.message || 'بيانات الاعتماد غير صحيحة أو الحساب غير مسجل في النظام');
    } catch (err: any) {
      setIsLoading(false);
      setIsDemoLoading(false);
      setError(err?.message || 'حدث خطأ أثناء محاولة تسجيل الدخول');
    }
  };

  // Handle Manual Form Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(username, pinCode);
  };

  // Handle Instant 1-Click Demo Login
  const handleDemoLogin = async () => {
    setAuthMode('LOGIN');
    setError(null);
    setSuccessMessage(null);
    setIsDemoLoading(true);

    const demoUser = 'logixdemo@logix.com';
    const demoPin = 'P0182671648n$';
    const demoLoginCode = 'demo';

    // 1. Auto-fill form fields visually for the user
    setUsername(demoUser);
    setPinCode(demoPin);

    // 2. Immediate direct login execution with demo login_code
    await executeLogin(demoUser, demoPin, demoLoginCode);
  };

  const scrollToLogin = () => {
    const el = document.getElementById('login-card-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#101B34] flex flex-col justify-between font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white">
      {/* Top Professional Header */}
      <header className="px-4 sm:px-8 py-3.5 border-b border-[#E3E8F2] bg-white/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 border border-blue-400/30">
            <span className="text-base tracking-wider font-mono">LX</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#101B34]">لوجيكس ERP</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                LOGIX Cloud
              </span>
            </div>
            <p className="text-[11px] text-slate-500">النظام السحابي الموحد لإدارة وتخطيط الموارد (Multi-Tenant IFRS)</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <button
            id="btn-header-demo-login"
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading || isDemoLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-300 hover:border-amber-400 text-amber-900 font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="تجربة النظام مباشرة بحساب الديمو المعتمد"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>تجربة النظام (Demo)</span>
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> نظام سحابي آمن ومعتمد
          </span>
          <span className="hidden md:inline-flex px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono">
            v4.5 Enterprise
          </span>
        </div>
      </header>

      {/* Hero Section with Inspiring Copy */}
      <section className="pt-10 sm:pt-14 pb-8 px-4 sm:px-8 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold mb-4 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>منظومة محاسبية وتشغيلية مؤسسية بمعايير عالمية</span>
        </div>

        {/* Requested H1 Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#101B34] tracking-tight leading-[1.25] mb-4">
          المحاسبة لا تحتمل التقريب. ولا نظامك أيضاً.
        </h1>

        {/* Requested Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-6 font-normal">
          من أول عملية بيع في الفرع، إلى آخر قيد في دفتر الأستاذ — لوجيكس يبقي كل رقم في مكانه الصحيح، في كل لحظة، على كل فرع.
        </p>

        {/* Value Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-700 font-semibold mb-8">
          <span className="px-3 py-1.5 rounded-full bg-white border border-[#E3E8F2] shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> قيود محاسبية مزدوجة آلية (IFRS)
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-[#E3E8F2] shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> ترحيل فوري لحسابات البنوك والخزائن
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-[#E3E8F2] shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> فواتير ضريبية ونقاط بيع POS متزامنة
          </span>
        </div>
      </section>

      {/* Main Login / Registration Section */}
      <main id="login-card-section" className="flex-1 flex items-center justify-center px-4 sm:px-8 pb-12 z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white border border-[#E3E8F2] rounded-3xl shadow-xl overflow-hidden">
          
          {/* Form Panel (col-span-7) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                  <Lock className="w-3.5 h-3.5 text-blue-600" /> بوابة تسجيل الدخول الموحدة
                </div>
                <h2 className="text-2xl font-bold text-[#101B34] tracking-tight">مرحباً بك في لوجيكس ERP</h2>
                <p className="text-sm text-slate-600 mt-1">
                  أدخل بيانات اعتماد حسابك للوصول الآمن إلى لوحة العمليات المحاسبية والتشغيلية.
                </p>
              </div>

              {/* Mode Switch Tabs (تسجيل الدخول / تسجيل شركة جديدة) */}
              <div className="flex p-1 bg-[#F5F7FB] rounded-xl border border-[#E3E8F2] mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'LOGIN'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#101B34]'
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
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#101B34]'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  تسجيل منشأة جديدة
                </button>
              </div>

              {/* Success Alert */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {authMode === 'REGISTER' ? (
                /* Multi-Tenant Registration Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>سجل منشأتك الجديدة لفتح بيئة سحابية محاسبية خاصة. سيتم تفعيل حسابك مباشرة من قبل الإدارة.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101B34] mb-1.5">
                      اسم الشركة أو المؤسسة
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        placeholder="أدخل الاسم التجاري للمنشأة"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E3E8F2] text-[#101B34] placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101B34] mb-1.5">
                      البريد الإلكتروني المعتمد لمالك المنشأة
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
                        placeholder="owner@domain.com"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E3E8F2] text-[#101B34] placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-mono text-left"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101B34] mb-1.5">
                      كلمة المرور المشفرة
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        dir="ltr"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E3E8F2] text-[#101B34] placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-mono text-left"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ملاحظة: يتم تشفير كلمات المرور وحفظ البيانات وفق أعلى معايير أمان قواعد البيانات السحابية.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
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

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      disabled={isLoading || isDemoLoading}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-bold transition-colors cursor-pointer py-1"
                    >
                      <Rocket className="w-3.5 h-3.5 text-amber-600" />
                      <span>هل تود استكشاف النظام مباشرة؟ تجربة النظام (Demo) بضغطة زر</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Secure Login Form */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#101B34] mb-1.5">
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
                        placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                        autoComplete="username"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E3E8F2] text-[#101B34] placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-mono text-left"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#101B34]">
                        كلمة المرور أو رمز الدخول (PIN)
                      </label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <LockKeyhole className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        maxLength={32}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E3E8F2] text-[#101B34] placeholder:text-slate-400 text-sm tracking-widest focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-mono text-left"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-slate-100 border-[#E3E8F2] text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>تذكر جلسة العمل</span>
                    </label>
                    <span className="text-blue-600 hover:text-blue-700 transition-colors cursor-pointer text-[11px] font-medium">
                      مساعدة في تسجيل الدخول
                    </span>
                  </div>

                  <button
                    id="btn-login-submit"
                    type="submit"
                    disabled={isLoading || isDemoLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    {isLoading && !isDemoLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحقق والمصادقة...</span>
                      </>
                    ) : (
                      <>
                        <span>تسجيل الدخول إلى لوحة العمليات</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Visual Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E3E8F2]" />
                    </div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="bg-white px-3 text-slate-500 font-medium">
                        أو استكشف النظام فوراً بضغطة زر
                      </span>
                    </div>
                  </div>

                  {/* PROMINENT DEMO ACCESS BUTTON: 1-Click Instant Demo Experience */}
                  <button
                    id="btn-quick-demo-login"
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={isLoading || isDemoLoading}
                    className="w-full group relative overflow-hidden p-3.5 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 border-2 border-amber-300 hover:border-amber-400 text-amber-900 transition-all duration-300 active:scale-[0.99] shadow-xs flex items-center justify-between cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 text-right">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
                        {isDemoLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Rocket className="w-5 h-5 animate-pulse text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-amber-950">
                            تجربة النظام (Demo)
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 border border-amber-400 text-amber-900 font-bold">
                            دخول فوري 🚀
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800/90 mt-0.5 font-mono">
                          {isDemoLoading
                            ? 'جاري تجهيز بيئة العرض التجريبي والبيانات...'
                            : 'logixdemo@logix.com • نقرة واحدة للدخول وتجربة النظام'}
                        </p>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-amber-700 group-hover:translate-x-[-4px] transition-transform shrink-0">
                      <span>{isDemoLoading ? 'جاري الدخول...' : 'دخول سريع'}</span>
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                  </button>
                </form>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#E3E8F2] text-[11px] text-slate-500 flex items-center justify-between">
              <span>تشفير اتصالات آمن SSL 256-bit</span>
              <span>معايير IFRS الدولية للمحاسبة والمراجعة</span>
            </div>
          </div>

          {/* Right/Side Panel: Enterprise Platform Security & Architectural Trust */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-6 sm:p-8 border-t lg:border-t-0 lg:border-r border-[#E3E8F2] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-xs font-semibold mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>معايير الأمان وحماية البيانات السحابية</span>
              </div>

              <h3 className="text-lg font-bold text-[#101B34] mb-2">
                لوجيكس السحابي للشركات
              </h3>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                بيئة تشغيلية ومحاسبية سحابية متعددة المنشآت (Multi-Tenant Architecture) مع ضمان عزل البيانات وسريتها التامة وفق المعايير المالية والتنظيمية.
              </p>

              {/* Security & Feature Highlights */}
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#101B34] mb-0.5">عزل تام لبيانات المنشآت</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        تشفير وعزل مستقل لكل شركة ومؤسسة، ولا يمكن لأي طرف الاطلاع على سجلات أو حسابات المنشآت الأخرى.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#101B34] mb-0.5">توافق كامل مع معايير IFRS</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        قيود محاسبية مزدوجة آلية، سندات صرف وقبض، ونظام جرد وتقييم مستمر للمخزون بدقة متناهية.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 shrink-0">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#101B34] mb-0.5">تحكم وصلاحيات دقيقة للأدوار</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        إدارة الصلاحيات بحسب الأدوار الوظيفية (مدير عام، محاسب رئيسي، أمين مستودع، مشرف تدقيق).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="mt-6 pt-4 border-t border-[#E3E8F2] space-y-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>تزامن سحابي فوري مع قواعد بيانات PostgreSQL / Supabase</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>نسخ احتياطي فوري واستعادة مرنة للبيانات بصيغ مشفرة</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Mid-Page Statement (Large Font Quote) */}
      <section className="py-12 px-4 sm:px-8 bg-white border-y border-[#E3E8F2] text-center">
        <div className="max-w-4xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600">فلسفة الدقة المحاسبية</span>
          <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#101B34] leading-tight">
            &ldquo;الأنظمة الكبرى لا تُقرِّب أرقامها. صُمِّم لوجيكس ليكون كذلك تماماً.&rdquo;
          </blockquote>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto pt-1">
            دقة لا تهاون فيها من أصغر سنتيم حتى أكبر تقرير ختامي لميزان المراجعة.
          </p>
        </div>
      </section>

      {/* Dashboard Mockup / Screenshot Showcase Section */}
      <section className="py-14 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-2.5">
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
            <span>نظرة مباشرة من الداخل</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101B34]">
            لوحة تحكم تنفيذية تجمع كل مؤشرات عملك في شاشة واحدة
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto mt-2">
            استعرض واجهة النظام الحقيقية: شريط تنقل واقعي، مؤشرات لحظية، رسم بياني لحركة المبيعات، وجدول أحدث العمليات المالية.
          </p>
        </div>

        {/* Browser Mockup Frame */}
        <div className="rounded-2xl border border-[#E3E8F2] bg-white shadow-2xl overflow-hidden">
          {/* Browser Window Header */}
          <div className="px-4 py-3 bg-[#F1F5F9] border-b border-[#E3E8F2] flex items-center justify-between gap-4">
            {/* Window Dots */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>

            {/* Address Bar */}
            <div className="flex-1 max-w-md mx-auto">
              <div className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs flex items-center justify-center gap-2 text-xs font-mono text-slate-600 select-none">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">https://</span>
                <span className="text-[#101B34] font-medium">app.logix-erp.com</span>
                <span className="text-slate-400">/dashboard</span>
              </div>
            </div>

            {/* Window Tools */}
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono hidden sm:flex">
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-sans text-[11px]">
                ERP Live
              </span>
            </div>
          </div>

          {/* Interior Mockup Dashboard Container */}
          <div className="flex bg-[#F8FAFC] min-h-[560px]">
            {/* Actual Sidebar from the System */}
            <div className="w-60 bg-white border-l border-[#E3E8F2] p-4 hidden md:flex flex-col justify-between shrink-0">
              <div className="space-y-4">
                {/* Brand */}
                <div className="flex items-center gap-2 pb-3 border-b border-[#E3E8F2]">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs font-mono">
                    LX
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#101B34]">لوجيكس السحابي</div>
                    <div className="text-[10px] text-slate-500">منظومة IFRS الموحدة</div>
                  </div>
                </div>

                {/* Navigation items matching actual system exactly */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1">الرئيسية</div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100 shadow-2xs">
                    <LayoutDashboard className="w-4 h-4 text-blue-600" />
                    <span>لوحة التحكم</span>
                  </div>

                  <div className="text-[10px] font-bold text-slate-400 px-2 pt-3 pb-1">المبيعات والفوترة</div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>نقاط البيع POS</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>فواتير المبيعات</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <span>عروض الأسعار والتحويل</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <DollarSign className="w-4 h-4 text-teal-600" />
                    <span>سندات القبض والصرف</span>
                  </div>

                  <div className="text-[10px] font-bold text-slate-400 px-2 pt-3 pb-1">الكيانات والمخازن</div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <Users2 className="w-4 h-4 text-indigo-600" />
                    <span>العملاء والموردين</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <Package className="w-4 h-4 text-amber-600" />
                    <span>الأصناف والمخزون</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <BarChart3 className="w-4 h-4 text-sky-600" />
                    <span>التقارير التشغيلية</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-medium">
                    <FolderTree className="w-4 h-4 text-teal-600" />
                    <span>الدليل المحاسبي</span>
                  </div>
                </div>
              </div>

              {/* Bottom user in mockup */}
              <div className="pt-3 border-t border-[#E3E8F2] flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[11px]">
                  م.ح
                </div>
                <div>
                  <div className="font-bold text-[#101B34] text-[11px]">محاسب رئيسي معتمد</div>
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> متصل
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Mockup Main Body */}
            <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-x-auto">
              {/* Top Banner Inside Mockup */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E3E8F2]">
                <div>
                  <h3 className="text-base font-bold text-[#101B34]">لوحة التحكم العامة • نظرة مالية وتشغيلية شاملة</h3>
                  <p className="text-xs text-slate-500">شركة لوجيكس للتجارة العامة • السنة المالية 2026</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> الدفاتر متزنة 100%
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E3E8F2] text-slate-700 text-xs font-mono">
                    KWD / SAR
                  </span>
                </div>
              </div>

              {/* 4 KPI Cards (Requested Specific KPIs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. مبيعات اليوم */}
                <div className="p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-600 font-bold">مبيعات اليوم</span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-[#101B34]">2,845.500 د.ك</div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>+12.4% مقارنة بالأمس</span>
                  </div>
                </div>

                {/* 2. فواتير آجلة مستحقة */}
                <div className="p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-600 font-bold">فواتير آجلة مستحقة</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-[#101B34]">4,120.000 د.ك</div>
                  <div className="text-[11px] text-blue-700 font-semibold mt-1">
                    3 فواتير تستحق خلال 48 ساعة
                  </div>
                </div>

                {/* 3. أصناف منخفضة المخزون */}
                <div className="p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-600 font-bold">أصناف منخفضة المخزون</span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-[#D97706]">5 أصناف</div>
                  <div className="text-[11px] text-amber-700 font-semibold mt-1">
                    وصلت لحد إعادة الطلب للتوريد
                  </div>
                </div>

                {/* 4. ورديات نشطة */}
                <div className="p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-600 font-bold">ورديات نشطة</span>
                    <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                      <ShoppingBag className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-[#101B34]">3 نقاط بيع</div>
                  <div className="text-[11px] text-purple-700 font-semibold mt-1">
                    فروع حولي والشويخ والسالمية
                  </div>
                </div>
              </div>

              {/* Chart & Summary Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 7-Day Sales Bar Chart (Requested) */}
                <div className="lg:col-span-7 p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-[#101B34]">حركة المبيعات والتحصيل (آخر 7 أيام)</h4>
                      <p className="text-[11px] text-slate-500">تحديث آلي مع كل فاتورة وسند قبض</p>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                      إجمالي: 18,945 د.ك
                    </span>
                  </div>

                  {/* Visual Bar Chart (Clean SVG/CSS) */}
                  <div className="flex items-end justify-between gap-2 h-36 pt-4 px-2 border-b border-[#E3E8F2]">
                    {[
                      { day: 'السبت', val: 1950, height: '48%' },
                      { day: 'الأحد', val: 2400, height: '58%' },
                      { day: 'الإثنين', val: 3100, height: '75%' },
                      { day: 'الثلاثاء', val: 2750, height: '65%' },
                      { day: 'الأربعاء', val: 3450, height: '82%' },
                      { day: 'الخميس', val: 4200, height: '100%' },
                      { day: 'الجمعة', val: 2100, height: '50%' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600 transition-colors">
                          {item.val}
                        </span>
                        <div
                          className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-cyan-500 transition-all shadow-2xs"
                          style={{ height: item.height }}
                        />
                        <span className="text-[10px] text-slate-600 font-medium">{item.day}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> مبيعات معتمدة ومرحّلة
                    </span>
                    <span className="text-emerald-600 font-bold">نسبة التحصيل النقدي 89%</span>
                  </div>
                </div>

                {/* Quick Status / Ledger Integrity */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#101B34] mb-1">سلامة الدفاتر والأرصدة اللحظية</h4>
                    <p className="text-[11px] text-slate-500 mb-3">مراجعة تلقائية مزدوجة لكل حركة مالية</p>
                    
                    <div className="space-y-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E3E8F2] flex items-center justify-between">
                        <span className="text-slate-600">رصيد حساب بنك الخليج:</span>
                        <span className="font-mono font-bold text-[#101B34]">14,850.000 د.ك</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E3E8F2] flex items-center justify-between">
                        <span className="text-slate-600">رصيد الخزينة الرئيسية:</span>
                        <span className="font-mono font-bold text-[#101B34]">3,240.500 د.ك</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E3E8F2] flex items-center justify-between">
                        <span className="text-slate-600">إجمالي الذمم المدينة (العملاء):</span>
                        <span className="font-mono font-bold text-[#2D6A4F]">9,620.000 د.ك</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>كافة القيود مطابقة لميزان المراجعة بدون أي فروقات.</span>
                  </div>
                </div>
              </div>

              {/* Recent Transactions Table (Requested Specific Movement Types) */}
              <div className="p-4 rounded-xl bg-white border border-[#E3E8F2] shadow-2xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E8F2]">
                  <div>
                    <h4 className="text-xs font-bold text-[#101B34]">أحدث الحركات والمعاملات المالية في النظام</h4>
                    <p className="text-[11px] text-slate-500">ترحيل فوري وربط مباشر بدفتر الأستاذ</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">سجل التدقيق الحي (Audit Trail)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-[#E3E8F2] text-[11px]">
                        <th className="pb-2 font-bold">نوع الحركة</th>
                        <th className="pb-2 font-bold">رقم المعاملة</th>
                        <th className="pb-2 font-bold">الطرف / العميل</th>
                        <th className="pb-2 font-bold">التاريخ</th>
                        <th className="pb-2 font-bold">المبلغ الإجمالي</th>
                        <th className="pb-2 font-bold text-center">الحالة المحاسبية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E8F2]">
                      {/* 1. فاتورة */}
                      <tr className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 font-bold text-blue-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> فاتورة مبيعات
                        </td>
                        <td className="py-2.5 font-mono font-bold text-slate-800">#INV-2026-0142</td>
                        <td className="py-2.5 text-[#101B34] font-medium">شركة الأفق للتجارة العامة</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">اليوم 10:45 ص</td>
                        <td className="py-2.5 font-bold font-mono text-[#101B34]">850.000 د.ك</td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            مسددة بالكامل
                          </span>
                        </td>
                      </tr>

                      {/* 2. إشعار دائن */}
                      <tr className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 font-bold text-purple-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" /> إشعار دائن
                        </td>
                        <td className="py-2.5 font-mono font-bold text-slate-800">#CN-2026-0018</td>
                        <td className="py-2.5 text-[#101B34] font-medium">مؤسسة النور الحديثة</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">أمس 04:20 م</td>
                        <td className="py-2.5 font-bold font-mono text-[#101B34]">65.000 د.ك</td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                            معتمد محاسبياً
                          </span>
                        </td>
                      </tr>

                      {/* 3. عرض سعر محوَّل */}
                      <tr className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 font-bold text-sky-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-600" /> عرض سعر محوَّل
                        </td>
                        <td className="py-2.5 font-mono font-bold text-slate-800">#QUO-2026-0094</td>
                        <td className="py-2.5 text-[#101B34] font-medium">شركة البسمة للتوريدات</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">2026-09-09</td>
                        <td className="py-2.5 font-bold font-mono text-[#101B34]">1,200.000 د.ك</td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                            تم التحويل لفاتورة
                          </span>
                        </td>
                      </tr>

                      {/* 4. فاتورة آجلة */}
                      <tr className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 font-bold text-amber-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> فاتورة آجلة
                        </td>
                        <td className="py-2.5 font-mono font-bold text-slate-800">#INV-2026-0143</td>
                        <td className="py-2.5 text-[#101B34] font-medium">مجمع الدانة التجاري</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">2026-09-08</td>
                        <td className="py-2.5 font-bold font-mono text-[#101B34]">2,450.000 د.ك</td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            استحقاق 14 يوم
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing Statement & Call to Action Before Footer */}
      <section className="py-14 px-4 sm:px-8 bg-gradient-to-b from-white to-[#F5F7FB] border-t border-[#E3E8F2] text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-2 shadow-2xs">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>

          {/* Requested Closing Statement */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101B34] tracking-tight">
            أرقامك تستحق نظاماً لا يخطئ حسابها.
          </h2>

          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            انضم إلى الشركات والمؤسسات التي تدير حساباتها، ومخازنها، وفروعها بمنتهى الدقة والموثوقية السحابية.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading || isDemoLoading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Rocket className="w-4 h-4 text-white" />
              <span>تجربة النظام التجريبي فوراً (1-Click Demo)</span>
            </button>

            <button
              type="button"
              onClick={scrollToLogin}
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-[#E3E8F2] text-[#101B34] font-bold text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>تسجيل الدخول إلى حسابك</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-[#E3E8F2] bg-white text-center text-xs text-slate-500 z-10">
        جميع الحقوق محفوظة © {new Date().getFullYear()} - منصة لوجيكس السحابية لإدارة وتخطيط الموارد LOGIX ERP (IFRS Compliant)
      </footer>
    </div>
  );
};
