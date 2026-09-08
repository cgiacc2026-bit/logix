import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Building2,
  FolderTree,
  Users,
  Package,
  FileText,
  LayoutDashboard,
  RotateCcw,
  Compass,
  Trophy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile } from '../types.js';

export interface OnboardingStep {
  id: string;
  stepNumber: number;
  title: string;
  shortDesc: string;
  fullDesc: string;
  targetTab: TabType;
  actionButtonText: string;
  icon: any;
  benefit: string;
  badge: string;
}

export interface OnboardingState {
  isDismissed: boolean;
  completedSteps: string[];
  lastUpdated: string;
}

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType) => void;
  company: CompanyProfile;
  accountsCount?: number;
  customersCount?: number;
  suppliersCount?: number;
  inventoryCount?: number;
  journalsCount?: number;
  invoicesCount?: number;
  onStateChange?: (state: OnboardingState) => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'step-company',
    stepNumber: 1,
    title: 'تهيئة هوية وبيانات المنشأة والعملة',
    shortDesc: 'ضبط الاسم التجاري، الرقم الضريبي، العملة الوظيفية، والشعار.',
    fullDesc:
      'الخطوة الأولى والأساسية لتجهيز النظام: قم بتعيين اسم المنشأة الرسمي، رقم السجل التجاري أو الرقم الضريبي، والعملة المعتمدة لحساباتك (مثل SAR أو KWD أو USD)، بالإضافة لرفع شعار الشركة ليظهر على الفواتير والسندات.',
    targetTab: 'company',
    actionButtonText: 'الانتقال إلى إعدادات المنشأة',
    icon: Building2,
    benefit: 'تضمن صدور الفواتير والمستندات بهوية قانونية متوافقة وتفادي أخطاء العملات.',
    badge: 'إلزامي للتأسيس',
  },
  {
    id: 'step-accounts',
    stepNumber: 2,
    title: 'مراجعة واعتماد شجرة الحسابات (الدليل المحاسبي)',
    shortDesc: 'التحقق من حسابات الأصول والالتزامات وإضافة حسابات البنوك والصناديق.',
    fullDesc:
      'الدليل المحاسبي هو العمود الفقري لجميع القيود والتقارير. يتيح لك النظام شجرة حسابات مرنة متوافقة مع معايير IFRS مقسمة إلى 5 أبواب رئيسية. راجع الحسابات وأضف حساب البنك الرئيسي أو الصندوق النقدي الخاص بشركتك.',
    targetTab: 'accounts',
    actionButtonText: 'استعراض الدليل المحاسبي',
    icon: FolderTree,
    benefit: 'دقة التوجيه المحاسبي وضمان توازن القوائم المالية والميزانية العمومية.',
    badge: 'أساس الحسابات',
  },
  {
    id: 'step-entities',
    stepNumber: 3,
    title: 'تسجيل الشركاء التجاريين (العملاء والموردين)',
    shortDesc: 'إضافة بيانات أول عميل أو مورد للتعامل وإصدار الفواتير.',
    fullDesc:
      'قم بتسجيل شركائك في العمل من عملاء وموردين. يمكنك إدخال الأسماء، العناوين، أرقام الهواتف، والأرقام الضريبية لكل جهة، مما يتيح لك إصدار الفواتير ومتابعة الديون والتحصيلات وسندات الصرف بسهولة.',
    targetTab: 'entities',
    actionButtonText: 'إدارة العملاء والموردين',
    icon: Users,
    benefit: 'متابعة ذمم العملاء ومستحقات الموردين وكشوف الحسابات اللحظية بدقة.',
    badge: 'حركة الأعمال',
  },
  {
    id: 'step-inventory',
    stepNumber: 4,
    title: 'تعريف الأصناف والمنتجات والوحدات بالمخزن',
    shortDesc: 'إضافة بضائعك أو خدماتك مع تحديد أسعار البيع والتكلفة والوحدات.',
    fullDesc:
      'سواء كانت منشأتك تقدم منتجات تجارية، مواد خام، أو خدمات مهنية؛ أضف أصنافك الأولى وحدد وحدات القياس (قطعة، كرتون، كيلوجرام...) وأسعار البيع والتكلفة لمراقبة رصيد المخزون وحساب تكلفة البضاعة المباعة تلقائياً.',
    targetTab: 'inventory',
    actionButtonText: 'تعريف المخزون والأصناف',
    icon: Package,
    benefit: 'ربط المبيعات والمشتريات برصيد المخزن ومنع البيع دون رصيد كافٍ.',
    badge: 'المخزون والتسعير',
  },
  {
    id: 'step-transactions',
    stepNumber: 5,
    title: 'تسجيل القيد الافتتاحي أو إصدار أول فاتورة',
    shortDesc: 'إثبات أرصدة بداية المدة أو بدء الدورة المستندية بإصدار فاتورة.',
    fullDesc:
      'ابدأ العمليات الفعلية في النظام! يمكنك إدخال القيد الافتتاحي (Opening Journal Entry) لإثبات رأس المال والأرصدة الافتتاحية للمصرف والعملاء، أو إصدار أول فاتورة مبيعات/مشتريات لإطلاق حركة الحسابات والمخزن.',
    targetTab: 'invoices',
    actionButtonText: 'إنشاء أول فاتورة أو قيد',
    icon: FileText,
    benefit: 'تشغيل الدورة المحاسبية الكاملة وانعكاس الأرقام في ميزان المراجعة.',
    badge: 'بدء العمليات',
  },
  {
    id: 'step-dashboard',
    stepNumber: 6,
    title: 'استعراض لوحة القيادة الذكية والمؤشرات المالية',
    shortDesc: 'مراقبة الأداء المالي، السيولة، صافي الأرباح، والتقارير المعتمدة.',
    fullDesc:
      'تهانينا على إكمال الخطوات الأساسية! توجه إلى لوحة القيادة الرئيسية (Dashboard) للاطلاع على التدفقات النقدية، صافي الأرباح، الذمم المدينة، وحالة الفواتير في الوقت الفعلي بأعلى معايير الإفصاح المالي.',
    targetTab: 'dashboard',
    actionButtonText: 'الانتقال إلى لوحة القيادة',
    icon: LayoutDashboard,
    benefit: 'رؤية شاملة ولحظية لموقف شركتك المالي لدعم اتخاذ القرارات السليمة.',
    badge: 'التقارير والمؤشرات',
  },
];

export const getOnboardingStorageKey = (companyId?: string) => {
  const cId = companyId || 'default_tenant';
  return `logix_onboarding_state_${cId}`;
};

export const loadOnboardingState = (companyId?: string): OnboardingState => {
  if (typeof window === 'undefined') {
    return { isDismissed: false, completedSteps: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(getOnboardingStorageKey(companyId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isDismissed: Boolean(parsed.isDismissed),
        completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error('Failed to load onboarding state:', e);
  }
  return { isDismissed: false, completedSteps: [], lastUpdated: new Date().toISOString() };
};

export const saveOnboardingState = (companyId: string | undefined, state: OnboardingState) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getOnboardingStorageKey(companyId), JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save onboarding state:', e);
  }
};

export const OnboardingGuideModal: React.FC<OnboardingGuideProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  company,
  accountsCount = 0,
  customersCount = 0,
  suppliersCount = 0,
  inventoryCount = 0,
  journalsCount = 0,
  invoicesCount = 0,
  onStateChange,
}) => {
  const companyId = company?.id || 'default_tenant';
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Load state on mount or company change
  useEffect(() => {
    const saved = loadOnboardingState(companyId);
    let steps = [...saved.completedSteps];

    // Smart auto-detection of already completed system entities
    if (company?.nameAr && company.nameAr !== 'شركة جديدة' && !steps.includes('step-company')) {
      steps.push('step-company');
    }
    if (accountsCount > 5 && !steps.includes('step-accounts')) {
      steps.push('step-accounts');
    }
    if ((customersCount > 0 || suppliersCount > 0) && !steps.includes('step-entities')) {
      steps.push('step-entities');
    }
    if (inventoryCount > 0 && !steps.includes('step-inventory')) {
      steps.push('step-inventory');
    }
    if ((journalsCount > 0 || invoicesCount > 0) && !steps.includes('step-transactions')) {
      steps.push('step-transactions');
    }

    setCompletedSteps(Array.from(new Set(steps)));
    setIsDismissed(saved.isDismissed);

    // Set active step to first uncompleted step
    const firstUnfinishedIdx = ONBOARDING_STEPS.findIndex((s) => !steps.includes(s.id));
    if (firstUnfinishedIdx !== -1) {
      setActiveStepIndex(firstUnfinishedIdx);
    }
  }, [companyId, accountsCount, customersCount, suppliersCount, inventoryCount, journalsCount, invoicesCount]);

  const updateAndPersistState = (newCompleted: string[], dismissed: boolean) => {
    setCompletedSteps(newCompleted);
    setIsDismissed(dismissed);
    const newState: OnboardingState = {
      isDismissed: dismissed,
      completedSteps: newCompleted,
      lastUpdated: new Date().toISOString(),
    };
    saveOnboardingState(companyId, newState);
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  const toggleStepCompletion = (stepId: string) => {
    let updated: string[];
    if (completedSteps.includes(stepId)) {
      updated = completedSteps.filter((id) => id !== stepId);
    } else {
      updated = [...completedSteps, stepId];
    }
    updateAndPersistState(updated, isDismissed);
  };

  const handleDismissAll = () => {
    updateAndPersistState(completedSteps, true);
    onClose();
  };

  const handleResetProgress = () => {
    if (window.confirm('هل تريد إعادة تعيين خطوات التهيئة للبدء من جديد؟')) {
      updateAndPersistState([], false);
      setActiveStepIndex(0);
    }
  };

  const handleActionClick = (step: OnboardingStep) => {
    // Mark as completed if not already marked
    if (!completedSteps.includes(step.id)) {
      const updated = [...completedSteps, step.id];
      updateAndPersistState(updated, isDismissed);
    }
    onNavigateTab(step.targetTab);
    onClose();
  };

  const progressPercent = useMemo(() => {
    return Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);
  }, [completedSteps]);

  const isAllCompleted = completedSteps.length === ONBOARDING_STEPS.length;
  const currentStep = ONBOARDING_STEPS[activeStepIndex] || ONBOARDING_STEPS[0];
  const StepIcon = currentStep.icon;

  if (!isOpen) return null;

  return (
    <div
      id="onboarding-guide-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] transition-all">
        {/* Header with Title and Progress */}
        <div className="bg-gradient-to-r from-slate-900 via-[#1E3E62] to-slate-900 text-white p-5 relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="إغلاق الدليل"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">دليل التهيئة التفاعلي للمنشأة</h2>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                  {company?.nameAr || 'المنشأة الجديدة'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                اتبع الخطوات الست التالية لإعداد نظامك المحاسبي والمالي والبدء في الفوترة ومسك الدفاتر بسهولة
              </p>
            </div>
          </div>

          {/* Progress Bar Component */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-cyan-300 flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                نسبة جاهزية وتهيئة المنشأة: {progressPercent}%
              </span>
              <span className="text-slate-300 text-[11px]">
                {completedSteps.length} من {ONBOARDING_STEPS.length} خطوات مكتملة
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-xs"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps Tab Indicators */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {ONBOARDING_STEPS.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = activeStepIndex === idx;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-emerald-600'}`} />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      isCurrent ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                )}
                <span>خطوة {step.stepNumber}</span>
              </button>
            );
          })}
        </div>

        {/* Active Step Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Main Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
                  <StepIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      الخطوة رقم {currentStep.stepNumber} من {ONBOARDING_STEPS.length}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {currentStep.badge}
                    </span>
                    {completedSteps.includes(currentStep.id) && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> تم الإنجاز
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1.5">{currentStep.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{currentStep.fullDesc}</p>
                </div>
              </div>
            </div>

            {/* Practical Benefit / Explanation Note */}
            <div className="mt-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold ml-1">الأهمية المحاسبية والنظامية:</span>
                {currentStep.benefit}
              </div>
            </div>

            {/* Step Actions: Direct Link + Manual Toggle */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleActionClick(currentStep)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>{currentStep.actionButtonText}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>

              <button
                type="button"
                onClick={() => toggleStepCompletion(currentStep.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  completedSteps.includes(currentStep.id)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {completedSteps.includes(currentStep.id) ? 'إلغاء علامة الإنجاز' : 'تحديد هذه الخطوة كمكتملة'}
                </span>
              </button>
            </div>
          </div>

          {/* Quick List Overview of All Steps */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              نظرة عامة على قائمة المهام التحضيرية:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ONBOARDING_STEPS.map((s, idx) => {
                const isDone = completedSteps.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                      activeStepIndex === idx
                        ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                        : isDone
                        ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                        : 'border-slate-200 bg-white hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className={`font-semibold truncate ${isDone ? 'text-emerald-900 line-through' : 'text-slate-800'}`}>
                        {s.stepNumber}. {s.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold shrink-0 mr-1">
                      {isDone ? 'مكتمل' : 'معلق'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Celebration when all steps are completed */}
          {isAllCompleted && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl text-emerald-900 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-black text-sm text-emerald-900">مبارك! تم إنجاز كافة خطوات التهيئة بنجاح 100%</div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  منشأتك جاهزة بالكامل لتسجيل القيود، إصدار الفواتير، ومتابعة القوائم الختامية بثقة وأمان.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDismissAll}
              className="text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
              title="تخطي الدليل بالكامل وعدم إظهاره تلقائياً مجدداً"
            >
              تخطي الدليل الإرشادي (أنا خبير بالنظام)
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleResetProgress}
              className="text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="إعادة تعيين التقدم والبدء من الصفر"
            >
              <RotateCcw className="w-3 h-3" />
              إعادة البدء
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              disabled={activeStepIndex === ONBOARDING_STEPS.length - 1}
              onClick={() => setActiveStepIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1))}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-colors cursor-pointer"
            >
              متابعة لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * OnboardingBannerWidget:
 * A non-intrusive interactive progress card rendered on the top of the dashboard or main view
 */
interface OnboardingBannerWidgetProps {
  company: CompanyProfile;
  onOpenFullGuide: () => void;
  onNavigateTab: (tab: TabType) => void;
  accountsCount?: number;
  customersCount?: number;
  suppliersCount?: number;
  inventoryCount?: number;
  journalsCount?: number;
  invoicesCount?: number;
}

export const OnboardingBannerWidget: React.FC<OnboardingBannerWidgetProps> = ({
  company,
  onOpenFullGuide,
  onNavigateTab,
  accountsCount = 0,
  customersCount = 0,
  suppliersCount = 0,
  inventoryCount = 0,
  journalsCount = 0,
  invoicesCount = 0,
}) => {
  const companyId = company?.id || 'default_tenant';
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState(companyId));

  useEffect(() => {
    const saved = loadOnboardingState(companyId);
    let steps = [...saved.completedSteps];

    if (company?.nameAr && company.nameAr !== 'شركة جديدة' && !steps.includes('step-company')) {
      steps.push('step-company');
    }
    if (accountsCount > 5 && !steps.includes('step-accounts')) {
      steps.push('step-accounts');
    }
    if ((customersCount > 0 || suppliersCount > 0) && !steps.includes('step-entities')) {
      steps.push('step-entities');
    }
    if (inventoryCount > 0 && !steps.includes('step-inventory')) {
      steps.push('step-inventory');
    }
    if ((journalsCount > 0 || invoicesCount > 0) && !steps.includes('step-transactions')) {
      steps.push('step-transactions');
    }

    const updated = Array.from(new Set(steps));
    if (updated.length !== saved.completedSteps.length) {
      const newState = { ...saved, completedSteps: updated };
      saveOnboardingState(companyId, newState);
      setState(newState);
    } else {
      setState(saved);
    }
  }, [companyId, accountsCount, customersCount, suppliersCount, inventoryCount, journalsCount, invoicesCount]);

  const progressPercent = Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100);

  // If user dismissed completely or 100% completed and minimized, we don't force it
  if (state.isDismissed && isMinimized) return null;

  const nextStep = ONBOARDING_STEPS.find((s) => !state.completedSteps.includes(s.id)) || ONBOARDING_STEPS[0];
  const NextIcon = nextStep.icon;

  return (
    <div
      id="onboarding-banner-widget"
      className="mb-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-md border border-blue-700/40 p-4 transition-all"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">إرشاد تهيئة المنشأة خطوة بخطوة</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                {progressPercent}% مكتمل ({state.completedSteps.length} من {ONBOARDING_STEPS.length})
              </span>
            </div>
            {!isMinimized && (
              <p className="text-xs text-slate-300 mt-0.5 truncate max-w-xl">
                الخطوة المقترحة حالياً:{' '}
                <strong className="text-cyan-300">
                  خطوة {nextStep.stepNumber}: {nextStep.title}
                </strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isMinimized && (
            <button
              type="button"
              onClick={() => onNavigateTab(nextStep.targetTab)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>تنفيذ الخطوة {nextStep.stepNumber}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenFullGuide}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-all border border-white/20 cursor-pointer"
          >
            <span>فتح الدليل الكامل</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isMinimized ? 'توسيع شريط التهيئة' : 'تصغير شريط التهيئة'}
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {ONBOARDING_STEPS.map((step) => {
              const isDone = state.completedSteps.includes(step.id);
              const isNext = nextStep.id === step.id;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onNavigateTab(step.targetTab)}
                  className={`p-2 rounded-xl text-right transition-all border flex flex-col justify-between cursor-pointer ${
                    isDone
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : isNext
                      ? 'bg-blue-600/40 border-cyan-400/80 text-white shadow-xs'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400">خطوة {step.stepNumber}</span>
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="text-[11px] font-bold truncate">{step.title.split(' ')[0]} {step.title.split(' ')[1]}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {isDone ? '✓ منجز' : isNext ? 'التالي' : 'معلق'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
