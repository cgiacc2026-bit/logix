import React, { useState, useEffect } from 'react';
import { SystemUser, CompanyProfile } from '../types.js';
import {
  SystemResetService,
  SystemResetPreview,
  SystemResetLog,
  SystemResetResult,
} from '../services/systemResetService.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { ExcelBackupService } from '../services/excelBackupService.ts';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Archive,
  Database,
  Calendar,
  FileText,
  Clock,
  Layers,
  Users2,
  Building2,
  PackageCheck,
  Receipt,
  FileSpreadsheet,
  History,
  Check,
  XCircle,
  HelpCircle,
  FolderArchive,
  Scale,
  RefreshCw,
  Download,
} from 'lucide-react';

interface SystemResetPanelProps {
  currentUser?: SystemUser;
  company: CompanyProfile | null;
  currency?: string;
  onResetComplete?: () => Promise<void> | void;
}

const REQUIRED_CONFIRMATION_TEXT = 'أوافق على التصفير وبدء دورة محاسبية جديدة';
const MASTER_RESET_PASSWORD = '123456789';

export const SystemResetPanel: React.FC<SystemResetPanelProps> = ({
  currentUser,
  company,
  currency = 'KWD',
  onResetComplete,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Form states
  const [resetPassword, setResetPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [fiscalYearStartDate, setFiscalYearStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [bypassDailyCheck, setBypassDailyCheck] = useState<boolean>(false);

  // Loading & Data states
  const [preview, setPreview] = useState<SystemResetPreview | null>(null);
  const [resetLogs, setResetLogs] = useState<SystemResetLog[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionStep, setExecutionStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resetResult, setResetResult] = useState<SystemResetResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'PANEL' | 'AUDIT_TRAIL' | 'IFRS_GUIDE'>('PANEL');

  // Load preview data & previous logs
  const loadData = async () => {
    setIsLoadingPreview(true);
    setErrorMessage('');
    try {
      const [prevData, logs] = await Promise.all([
        SystemResetService.getSystemResetPreview(),
        SystemResetService.getResetLogs(),
      ]);
      setPreview(prevData);
      setResetLogs(logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تحميل بيانات المعاينة وسجلات التصفير');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isPasswordCorrect = resetPassword.trim() === MASTER_RESET_PASSWORD;

  const isFormValid =
    isPasswordCorrect &&
    reason.trim().length >= 5 &&
    confirmationInput.trim() === REQUIRED_CONFIRMATION_TEXT &&
    fiscalYearStartDate.length > 0;

  const handleStartReset = () => {
    if (!isPasswordCorrect) {
      setErrorMessage('كلمة مرور تصفير السيستم غير صحيحة! يرجى إدخال: 123456789');
      return;
    }
    if (!isFormValid) return;
    setShowConfirmModal(true);
  };

  const handleExecuteReset = async () => {
    if (!currentUser || !isAdmin) {
      setErrorMessage('صلاحية المدير العام (ADMIN) مطلوبة لتنفيذ هذه العملية.');
      return;
    }

    if (!isPasswordCorrect) {
      setErrorMessage('كلمة مرور تصفير السيستم غير صحيحة! يرجى إدخال كلمة المرور المعتمدة: 123456789');
      return;
    }

    setIsExecuting(true);
    setErrorMessage('');
    setExecutionStep('1/5: أخذ نسخة احتياطية وأرشفة كافة الفواتير والقيود والسندات في مجموعات آمنة...');

    try {
      // Step simulation for smooth UX
      setTimeout(() => {
        setExecutionStep('2/5: إنشاء وتوازن القيود الافتتاحية للعملاء والموردين...');
      }, 700);

      setTimeout(() => {
        setExecutionStep('3/5: ترحيل وتوثيق قيد أصول المخزون الفعلي القائم...');
      }, 1400);

      setTimeout(() => {
        setExecutionStep('4/5: تفريغ الدورة التشغيلية وتأسيس القيود الافتتاحية في الدفاتر...');
      }, 2100);

      const result = await SystemResetService.performSystemReset(
        reason,
        {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          role: currentUser.role,
        },
        fiscalYearStartDate,
        { bypassIdempotencyCheck: bypassDailyCheck }
      );

      setExecutionStep('5/5: توثيق العملية في سجل التدقيق system_reset_log...');
      setResetResult(result);
      setShowConfirmModal(false);

      // إعادة تحميل المعاينة وتحديث النظام
      await loadData();
      if (onResetComplete) {
        await onResetComplete();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية تصفير النظام');
      setShowConfirmModal(false);
    } finally {
      setIsExecuting(false);
      setExecutionStep('');
    }
  };

  // If not admin, show permission barrier
  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-4 shadow-sm dir-rtl">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-serif font-black text-[#1A1A1A]">
          صلاحية محظورة: تصفير النظام وبدء دورة محاسبية جديدة
        </h3>
        <p className="text-xs text-[#6E6659] leading-relaxed">
          هذه الشاشة مخصصة فقط للمدير العام والتنفيذي (ADMIN). لا يملك حسابك الحالي ({currentUser?.name} - {currentUser?.roleTitleAr}) الصلاحيات الكافية لتنفيذ تصفير أو إقفال سنوي.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* 1. Header & Navigation Tabs */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded text-[11px] font-black">
                إجراء محاسبي مصيري (Year-End Fresh Start)
              </span>
              <span className="text-xs text-[#8C8273]">وفق معايير المحاسبة الدولية IFRS</span>
            </div>
            <h2 className="text-xl font-serif font-black text-[#1A1A1A] flex items-center gap-2.5">
              <RotateCcw className="w-6 h-6 text-rose-700" />
              <span>تصفير البيانات التشغيلية وبدء دورة محاسبية جديدة</span>
            </h2>
          </div>

          {/* Quick Sub-tabs */}
          <div className="flex items-center bg-[#F7F5F0] p-1 rounded-xl border border-[#E5E1DA]">
            <button
              type="button"
              onClick={() => setActiveTab('PANEL')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'PANEL'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#E5E1DA]'
                  : 'text-[#8C8273] hover:text-[#1A1A1A]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>لوحة التصفير والتنفيذ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUDIT_TRAIL')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'AUDIT_TRAIL'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#E5E1DA]'
                  : 'text-[#8C8273] hover:text-[#1A1A1A]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>سجل العمليات السابقة ({resetLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('IFRS_GUIDE')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'IFRS_GUIDE'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#E5E1DA]'
                  : 'text-[#8C8273] hover:text-[#1A1A1A]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>المعايير المحاسبية المطبقة</span>
            </button>
          </div>
        </div>

        {/* 2. Danger Warning Hero Banner */}
        <div className="bg-gradient-to-r from-rose-50 to-amber-50/50 border border-rose-200 rounded-xl p-5 text-xs text-rose-950 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-serif font-black text-rose-900">
                تحذير رقابي حاسم قبل الشروع في التصفير:
              </h4>
              <p className="text-rose-800 leading-relaxed">
                هذه العملية ستقوم بأرشفة كافة الفواتير والسندات وأوامر الإنتاج والقيود اليومية التاريخية، وتفريغ الدورة التشغيلية الحالية للبدء بسنة مالية جديدة نظيفة. لن يتم حذف العملاء أو الموردين أو المخزون؛ بل سيتم إنشاء <strong>قيود افتتاحية متوازنة رسمياً</strong> لكل حساب يحمل رصيداً لضمان عدم فقدان أي حقوق مالية.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="bg-rose-100 border border-rose-300 text-rose-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-700 hover:text-rose-950 text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUCCESS BANNER */}
      {resetResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif font-black text-emerald-950">
                اكتملت عملية التصفير وتأسيس الدورة المحاسبية بنجاح!
              </h3>
              <p className="text-xs text-emerald-800 font-mono">
                رقم حزمة الأرشيف: <strong>{resetResult.resetBatchId}</strong> | تاريخ البداية: <strong>{resetResult.logEntry.fiscalYearStartDate}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-emerald-200 text-xs">
            <div>
              <span className="text-[#8C8273] block mb-0.5">فواتير تمت أرشفتها:</span>
              <span className="font-bold text-[#1A1A1A] font-mono">{resetResult.stats.invoicesArchived}</span>
            </div>
            <div>
              <span className="text-[#8C8273] block mb-0.5">قيود تمت أرشفتها:</span>
              <span className="font-bold text-[#1A1A1A] font-mono">{resetResult.stats.journalsArchived}</span>
            </div>
            <div>
              <span className="text-[#8C8273] block mb-0.5">قيود افتتاحية مُنشأة:</span>
              <span className="font-bold text-emerald-700 font-mono">{resetResult.stats.openingJournalsCreatedCount}</span>
            </div>
            <div>
              <span className="text-[#8C8273] block mb-0.5">قيمة المخزون الموثق:</span>
              <span className="font-bold text-[#1A1A1A] font-mono">{formatCurrency(resetResult.stats.totalInventoryValue, currency)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setResetResult(null)}
              className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 cursor-pointer"
            >
              إغلاق الرسالة ومتابعة العمل في النظام
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: MAIN SYSTEM RESET CONTROL PANEL */}
      {activeTab === 'PANEL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main Column: Reset Form & Confirmation */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pre-Reset Backup Quick Banner */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">أخذ نسخة احتياطية شاملة Excel قبل التصفير</h4>
                  <p className="text-[11px] text-emerald-800">
                    يُنصح بتحميل ملف Excel يحوي كافة السجلات والفواتير والقيود والعملاء والموردين والمخزون كمرجع دائم.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => ExcelBackupService.exportFullSystemBackupToExcel()}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نسخة Excel الآن</span>
              </button>
            </div>

            {/* Form Box */}
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="border-b border-[#E5E1DA] pb-3 flex items-center justify-between">
                <h3 className="text-sm font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-700" />
                  <span>بيانات وإعدادات التصفير السنوي</span>
                </h3>
                <span className="text-[11px] text-[#8C8273]">الحقول ذات النجمة (*) إلزامية</span>
              </div>

              {/* Input 1: Fiscal Year Start Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>تاريخ بدء السنة المالية / الدورة المحاسبية الجديدة *</span>
                </label>
                <input
                  type="date"
                  value={fiscalYearStartDate}
                  onChange={(e) => setFiscalYearStartDate(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
                <p className="text-[11px] text-[#8C8273]">
                  ستحمل كافة القيود الافتتاحية المنشأة (للعملاء والموردين والمخزون) هذا التاريخ المحاسبي الرسمي.
                </p>
              </div>

              {/* Input 2: Reason for Reset (Mandatory) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-rose-700" />
                  <span>سبب التصفير المحاسبي وإقفال الدورة (إلزامي للتوثيق والتدقيق) *</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: إقفال السنة المالية 2025 والبدء بدورة محاسبية جديدة لعام 2026 مع تثبيت أرصدة العملاء والموردين والمخزون الفعلي القائم..."
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl p-3 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-[#8C8273]">
                  <span>سيتم حفظ هذا السبب نهائياً في سجل الرقابة system_reset_log</span>
                  <span>{reason.length}/5 أحرف كحد أدنى</span>
                </div>
              </div>

              {/* Input 3: System Reset Master Password (Mandatory) */}
              <div className="space-y-2 bg-rose-50/60 p-4 rounded-xl border border-rose-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-700" />
                    <span>كلمة مرور تصفير السيستم (إلزامي للأمان):</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded text-rose-800 border border-rose-200">
                    الرمز المعتمد: 123456789
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => {
                      setResetPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="أدخل كلمة المرور 123456789..."
                    className="w-full bg-white border border-rose-300 rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] font-mono font-bold tracking-wider focus:outline-none focus:border-rose-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-[11px] text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
                  >
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>

                {resetPassword.trim().length > 0 && !isPasswordCorrect && (
                  <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    كلمة المرور غير صحيحة! يرجى إدخال 123456789
                  </p>
                )}
                {isPasswordCorrect && (
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    تم التحقق من كلمة المرور بنجاح (123456789)
                  </p>
                )}
              </div>

              {/* Input 4: Confirmation Phrase */}
              <div className="space-y-2 bg-[#FAF8F5] p-4 rounded-xl border border-[#E5E1DA]">
                <label className="text-xs font-bold text-[#1A1A1A] block">
                  لتأكيد العملية، يرجى كتابة العبارة التالية بدقة في الحقل أدناه:
                </label>
                <div className="p-2.5 bg-white border border-[#E5E1DA] rounded-lg text-xs font-mono font-bold text-rose-900 select-all flex items-center justify-between">
                  <span>{REQUIRED_CONFIRMATION_TEXT}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmationInput(REQUIRED_CONFIRMATION_TEXT)}
                    className="text-[10px] text-[#B8860B] hover:underline cursor-pointer"
                  >
                    نسخ النص تلقائياً
                  </button>
                </div>

                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="اكتب العبارة هنا..."
                  className="w-full bg-white border border-[#E5E1DA] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-rose-600 text-center"
                />
              </div>

              {/* Idempotency Daily Check Toggle (Optional Override) */}
              <div className="flex items-center gap-2 pt-1 text-xs text-[#6E6659]">
                <input
                  type="checkbox"
                  id="bypassDaily"
                  checked={bypassDailyCheck}
                  onChange={(e) => setBypassDailyCheck(e.target.checked)}
                  className="rounded border-[#E5E1DA] text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="bypassDaily" className="cursor-pointer select-none">
                  السماح بالتصفير حتى لو تم تصفير آخر خلال نفس اليوم (Bypass Same-Day Guard)
                </label>
              </div>

              {/* Trigger Button */}
              <button
                type="button"
                onClick={handleStartReset}
                disabled={!isFormValid || isExecuting}
                className="w-full py-3.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-rose-800"
              >
                <RotateCcw className={`w-4 h-4 text-rose-200 ${isExecuting ? 'animate-spin' : ''}`} />
                <span>{isExecuting ? executionStep || 'جاري تنفيذ التصفير المحاسبي...' : 'معاينة واعتماد تصفير النظام وبدء الدورة الجديدة'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Pre-Execution Preview Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
                <h3 className="text-sm font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#B8860B]" />
                  <span>معاينة الأثر المالي قبل التنفيذ (Live Impact)</span>
                </h3>
                <button
                  onClick={loadData}
                  disabled={isLoadingPreview}
                  className="p-1 text-[#8C8273] hover:text-[#1A1A1A] rounded transition-colors"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isLoadingPreview ? (
                <div className="py-12 text-center text-xs text-[#8C8273] space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#B8860B]" />
                  <p>جاري قراءة وتحليل كافة السجلات والأرصدة...</p>
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {/* Category 1: Operational Records to Archive */}
                  <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#1A1A1A]">
                      <span className="flex items-center gap-1.5">
                        <Archive className="w-4 h-4 text-amber-700" />
                        مستندات تشغيلية ستُنقل للأرشيف:
                      </span>
                      <span className="font-mono text-[#8C8273]">
                        {preview.invoicesCount + preview.journalsCount + preview.vouchersCount + preview.productionOrdersCount} مستند
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E6659] pt-1">
                      <div className="flex justify-between">
                        <span>فواتير ومردودات:</span>
                        <strong className="font-mono text-[#1A1A1A]">{preview.invoicesCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>قيود يومية سابقة:</span>
                        <strong className="font-mono text-[#1A1A1A]">{preview.journalsCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>سندات قبض وصرف:</span>
                        <strong className="font-mono text-[#1A1A1A]">{preview.vouchersCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>أوامر إنتاج وطحن:</span>
                        <strong className="font-mono text-[#1A1A1A]">{preview.productionOrdersCount}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Customers Opening Balance Roll-forward */}
                  <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#1A1A1A]">
                      <span className="flex items-center gap-1.5">
                        <Users2 className="w-4 h-4 text-cyan-700" />
                        أرصدة العملاء والجمعيات (الذمم المدينة):
                      </span>
                      <span className="font-mono font-black text-[#2D6A4F]">
                        {formatCurrency(preview.totalReceivables, currency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C8273]">
                      سيتم إنشاء <strong>{preview.customersWithBalance.length}</strong> قيد افتتاحي متوازن للعملاء الذين لديهم رصيد، مع الحفاظ على بطاقاتهم كاملة.
                    </p>
                  </div>

                  {/* Category 3: Suppliers Opening Balance Roll-forward */}
                  <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#1A1A1A]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-amber-700" />
                        أرصدة الموردين والشركات (الذمم الدائنة):
                      </span>
                      <span className="font-mono font-black text-[#9E2A2B]">
                        {formatCurrency(preview.totalPayables, currency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C8273]">
                      سيتم إنشاء <strong>{preview.suppliersWithBalance.length}</strong> قيد افتتاحي متوازن لالتزامات الموردين القائمة.
                    </p>
                  </div>

                  {/* Category 4: Inventory Asset Preservation */}
                  <div className="bg-white border border-[#E5E1DA] rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#1A1A1A]">
                      <span className="flex items-center gap-1.5">
                        <PackageCheck className="w-4 h-4 text-emerald-700" />
                        أصول المخزون الفعلي القائم:
                      </span>
                      <span className="font-mono font-black text-[#1A1A1A]">
                        {formatCurrency(preview.totalInventoryValue, currency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C8273]">
                      يشمل <strong>{preview.inventoryItemsWithStock.length}</strong> صنف بكمياتها الحالية، ويتم إنشاء قيد افتتاحي للأصول بقيمتها دون تصفير الكميات.
                    </p>
                  </div>

                  {/* Total Opening Entries Summary */}
                  <div className="p-3 bg-[#FAF8F5] border border-[#B8860B]/30 rounded-xl text-xs flex items-center justify-between">
                    <span className="font-bold text-[#1A1A1A]">إجمالي القيود الافتتاحية المتوقع إنشاؤها:</span>
                    <span className="px-2 py-0.5 bg-[#1A1A1A] text-white rounded font-mono font-bold text-xs">
                      {preview.estimatedOpeningJournalsCount} قيد افتتاحي
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL / LOGS */}
      {activeTab === 'AUDIT_TRAIL' && (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-4">
            <div className="space-y-1">
              <h3 className="text-base font-serif font-black text-[#1A1A1A] flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <span>سجل عمليات تصفير النظام وإقفال السنوات المالية (system_reset_log)</span>
              </h3>
              <p className="text-xs text-[#8C8273]">
                سجل رقابي غير قابل للتعديل يوثق هوية المسؤول ووقت وسبب كل عملية تصفير تاريخية وأرقام حزم الأرشيف المرتبطة بها
              </p>
            </div>

            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-lg text-xs font-bold border border-[#E5E1DA] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>تحديث السجل</span>
            </button>
          </div>

          {resetLogs.length > 0 ? (
            <div className="space-y-3">
              {resetLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1DA] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-[#1A1A1A] text-white rounded text-[11px] font-mono font-bold">
                        {log.resetBatchId}
                      </span>
                      <span className="text-xs font-bold text-[#1A1A1A]">
                        نفذها: {log.performedBy.userName} ({log.performedBy.role})
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8C8273] font-mono">
                      تاريخ التنفيذ: {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </div>
                  </div>

                  <div className="text-xs text-[#1A1A1A] leading-relaxed bg-[#FAF9F6] p-3 rounded-lg border border-[#E5E1DA]">
                    <strong>السبب الموثق:</strong> {log.reason}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#6E6659]">
                    <div>
                      <span>تاريخ الدورة الجديدة: </span>
                      <strong className="text-[#1A1A1A] font-mono">{log.fiscalYearStartDate}</strong>
                    </div>
                    <div>
                      <span>فواتير مؤرشفة: </span>
                      <strong className="text-[#1A1A1A] font-mono">{log.stats.invoicesArchived}</strong>
                    </div>
                    <div>
                      <span>قيود افتتاحية: </span>
                      <strong className="text-emerald-700 font-mono">{log.stats.openingJournalsCreatedCount}</strong>
                    </div>
                    <div>
                      <span>مخزون مثبت: </span>
                      <strong className="text-[#1A1A1A] font-mono">{formatCurrency(log.stats.totalInventoryValue, currency)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#8C8273] space-y-2">
              <FolderArchive className="w-8 h-8 mx-auto text-[#B8860B] opacity-40" />
              <p className="font-bold text-[#1A1A1A]">لا توجد أي عمليات تصفير سابقة مسجلة في النظام حتى الآن</p>
              <p className="text-[11px]">يتم تسجيل كافة العمليات المستقبلية هنا تلقائياً لغايات التدقيق والمحاسبة القانونية.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IFRS GUIDE & FINANCIAL PRINCIPLES */}
      {activeTab === 'IFRS_GUIDE' && (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-[#E5E1DA] pb-3 space-y-1">
            <h3 className="text-base font-serif font-black text-[#1A1A1A] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#B8860B]" />
              <span>المعايير المحاسبية المعتمدة لعملية تصفير النظام وبدء الدورة الجديدة</span>
            </h3>
            <p className="text-xs text-[#8C8273]">
              شرح توثيقي لمعالجة الحسابات وفق المعايير الدولية (IAS 1 & IFRS)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#1A1A1A]">
            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-[#B8860B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                1. ترحيل أرصدة العملاء (Accounts Receivable Roll-Forward):
              </h4>
              <p className="text-[#6E6659] leading-relaxed">
                إذا كان العميل مديناً (عليه مستحقات)، يُنشأ قيد:
                <br />
                <span className="font-mono text-[#2D6A4F] font-bold">من حـ/ الذمم المدينة (1120) - [اسم العميل]</span>
                <br />
                <span className="font-mono text-[#1A1A1A] font-bold">إلى حـ/ الأرباح المبقاة / رأس المال الافتتاحي (3200)</span>
              </p>
            </div>

            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-[#B8860B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                2. ترحيل أرصدة الموردين (Accounts Payable Roll-Forward):
              </h4>
              <p className="text-[#6E6659] leading-relaxed">
                إذا كان المورد دائناً (له مستحقات)، يُنشأ قيد:
                <br />
                <span className="font-mono text-[#1A1A1A] font-bold">من حـ/ الأرباح المبقاة / رأس المال الافتتاحي (3200)</span>
                <br />
                <span className="font-mono text-[#9E2A2B] font-bold">إلى حـ/ الذمم الدائنة (2110) - [اسم المورد]</span>
              </p>
            </div>

            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-[#B8860B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                3. تثبيت أصول المخزون الفعلي (Inventory Asset Preservation):
              </h4>
              <p className="text-[#6E6659] leading-relaxed">
                يتم الحفاظ على كميات المخزون الفعلي القائم، ويُنشأ قيد إجمالي بقيمة المخزون:
                <br />
                <span className="font-mono text-[#2D6A4F] font-bold">من حـ/ مخزون البضائع والبهارات (1130)</span>
                <br />
                <span className="font-mono text-[#1A1A1A] font-bold">إلى حـ/ الأرباح المبقاة / رأس المال الافتتاحي (3200)</span>
              </p>
            </div>

            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-[#B8860B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                4. الأرشفة القانونية الشاملة (Legal Audit Archive):
              </h4>
              <p className="text-[#6E6659] leading-relaxed">
                لا تُحذف أي مستندات قديمة دون نسخها بالكامل إلى مجموعات أرشيف زمنية موازية تحمل معرف الحزمة وتاريخ ووقت التصفير، التزاماً بمتطلبات الاحتفاظ بالدفاتر والسجلات التجارية.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-300 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 text-right dir-rtl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-[#E5E1DA] pb-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-serif font-black text-rose-950">
                  تأكيد نهائي: تصفير النظام وبدء الدورة الجديدة
                </h3>
                <p className="text-xs text-[#8C8273]">
                  يرجى قراءة التعهد والموافقة قبل المتابعة
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1A1A1A] bg-[#FAF8F5] p-4 rounded-xl border border-[#E5E1DA] leading-relaxed">
              <p className="font-bold text-rose-900">
                أنت على وشك تنفيذ عملية لا رجعة فيها على مستوى البيانات التشغيلية:
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-[#6E6659]">
                <li>سيتم أرشفة كافة الفواتير والسندات وأوامر الإنتاج الحالية.</li>
                <li>سيتم إنشاء قيود افتتاحية جديدة بتاريخ ({fiscalYearStartDate}).</li>
                <li>سيتم توثيق العملية باسم المسؤول: <strong>{currentUser?.name}</strong>.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isExecuting}
                className="px-4 py-2.5 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء وتراجع
              </button>

              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isExecuting}
                className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm border border-rose-800 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin text-rose-200" />
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>نعم، نفذ التصفير الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
