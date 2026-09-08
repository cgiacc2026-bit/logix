import React, { useState, useRef, useEffect } from 'react';
import {
  FolderTree,
  FileSpreadsheet,
  Receipt,
  FileText,
  BookOpen,
  Scale,
  PieChart,
  ChevronLeft,
  ChevronDown,
  Factory,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  DollarSign,
  Workflow,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface AccountingCycleBarProps {
  activeTab: string;
  onNavigateTab: (tab: string) => void;
}

interface CycleStep {
  id: string;
  stepNumber: string;
  title: string;
  sub: string;
  icon: any;
  targetTab: string;
  badge?: string;
  description: string;
  inputs: string;
  outputs: string;
  accountingImpact: string;
  quickLinks: { label: string; tab: string }[];
}

export const AccountingCycleBar: React.FC<AccountingCycleBarProps> = ({
  activeTab,
  onNavigateTab,
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showFlowModal, setShowFlowModal] = useState<boolean>(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const steps: CycleStep[] = [
    {
      id: 'step-1',
      stepNumber: '١',
      title: 'التأسيس ودليل الحسابات',
      sub: 'الهيكل والترميز والعملاء',
      icon: FolderTree,
      targetTab: 'accounts',
      description: 'بناء شجرة الحسابات المالية، وتعريف الموردين، والجمعيات التعاونية والعملاء، ووحدات القياس.',
      inputs: 'بيانات الشركة، الحسابات البنكية، بطاقات العملاء والموردين، وحدات الوزن والتعبئة.',
      outputs: 'دليل محاسبي مهيكل، أكواد العملاء والموردين المترابطة مع دفتر الأستاذ العام.',
      accountingImpact: 'تحديد حسابات التوجيه التلقائي (الأصول، الخصوم، الملكية، الإيرادات، المصروفات).',
      quickLinks: [
        { label: 'دليل الحسابات المالي', tab: 'accounts' },
        { label: 'العملاء والجمعيات', tab: 'entities' },
        { label: 'موردي المواد الخام', tab: 'entities' },
        { label: 'وحدات القياس', tab: 'units' },
      ],
    },
    {
      id: 'step-2',
      stepNumber: '٢',
      title: 'المشتريات والمواد الخام',
      sub: 'فواتير ومخزون الحبوب',
      icon: Package,
      targetTab: 'invoices',
      description: 'تسجيل وتوثيق فواتير مشتريات المواد الأولية والبهارات الخام واستلامها في المستودعات.',
      inputs: 'فواتير الموردين، إيصالات الاستلام المخزني للبهارات والحبوب.',
      outputs: 'إضافة فورية لرصيد مخزون المواد الخام، وتسجيل مستحقات الموردين أو الخصم من الصندوق.',
      accountingImpact: 'قيد تلقائي: (من حـ/ مخزون المواد الخام إلى حـ/ الموردين أو الصندوق/البنك).',
      quickLinks: [
        { label: 'فواتير المشتريات', tab: 'invoices' },
        { label: 'مستودع المواد الخام', tab: 'inventory' },
        { label: 'كشوف حساب الموردين', tab: 'entities' },
      ],
    },
    {
      id: 'step-3',
      stepNumber: '٣',
      title: 'تشغيل وتصنيع المطحنة',
      sub: 'الطحن والخلط والتعبئة',
      icon: Factory,
      targetTab: 'production',
      badge: 'تصنيع',
      description: 'إصدار أوامر تشغيل المطحنة لتحويل المواد الخام إلى بهارات مطحونة ومعبأة وحساب التكلفة.',
      inputs: 'كميات المواد الخام المستهلكة، تكاليف الطحن والعمالة، تحديد خط الإنتاج.',
      outputs: 'زيادة رصيد المنتجات التامة بالمستودع وخصم المواد الخام المستهلكة وحساب تكلفة الوحدة.',
      accountingImpact: 'قيد تكاليف إنتاج آلي: (من حـ/ مخزون تام الصنع إلى حـ/ المواد الخام + حـ/ تكاليف التشغيل).',
      quickLinks: [
        { label: 'أوامر تشغيل المطحنة', tab: 'production' },
        { label: 'مخزون المنتجات التامة', tab: 'inventory' },
        { label: 'إدارة وتحديث الأسعار', tab: 'inventory' },
      ],
    },
    {
      id: 'step-4',
      stepNumber: '٤',
      title: 'فواتير المبيعات والتوزيع',
      sub: 'الجمعيات والمبيعات',
      icon: FileSpreadsheet,
      targetTab: 'invoices',
      description: 'إصدار فواتير بيع البهارات والمنتجات للجمعيات والأسواق مع طباعة الفاتورة الرسمية.',
      inputs: 'أوامر التوريد للجمعيات، الكميات المعتمدة، أسعار التوريد وقوائم الأسعار.',
      outputs: 'خصم المخزون التام، إثبات مديونية العميل أو استلام النقد، وإصدار الفواتير الرسمية.',
      accountingImpact: 'قيد مزدوج: (من حـ/ العملاء إلى حـ/ إيرادات المبيعات) وقيد (تكلفة المبيعات COGS).',
      quickLinks: [
        { label: 'فواتير المبيعات', tab: 'invoices' },
        { label: 'عروض الأسعار والتسعير', tab: 'inventory' },
        { label: 'كشف حساب الجمعيات', tab: 'entities' },
      ],
    },
    {
      id: 'step-5',
      stepNumber: '٥',
      title: 'السندات والخزينة',
      sub: 'القبض والصرف والتحصيل',
      icon: Receipt,
      targetTab: 'vouchers',
      description: 'توثيق الشيكات والنقدية المستلمة من الجمعيات، وسندات الصرف للموردين والمصروفات التشغيلية.',
      inputs: 'شيكات التحصيل، سندات الإيداع البنكي، مصروفات المطحنة، سداد الموردين.',
      outputs: 'تحديث أرصدة الخزينة والبنوك، تسوية أرصدة العملاء والموردين بشكل لحظي.',
      accountingImpact: 'قيد خزينة آلي: (من حـ/ البنك أو الصندوق إلى حـ/ العميل) أو (من حـ/ المورد إلى حـ/ البنك).',
      quickLinks: [
        { label: 'سندات القبض (تحصيل)', tab: 'vouchers' },
        { label: 'سندات الصرف (سداد)', tab: 'vouchers' },
        { label: 'حركة الصندوق والبنوك', tab: 'ledger' },
      ],
    },
    {
      id: 'step-6',
      stepNumber: '٦',
      title: 'قيود اليومية والترحيل',
      sub: 'القيد المزدوج والرقابة',
      icon: FileText,
      targetTab: 'journals',
      description: 'المراجعة المركزية لكافة القيود المولدة تلقائياً من الفواتير والإنتاج وإنشاء التسويات اليدوية.',
      inputs: 'القيود الآلية من النظام، قيود التسويات الختامية، الإهلاكات والأجور.',
      outputs: 'دفتر يومية عامة متوازن (إجمالي المدين = إجمالي الدائن) مع سجل تدقيق غير قابل للتلاعب.',
      accountingImpact: 'ترحيل الحركات إلى الحسابات المعنية بدفتر الأستاذ العام وتحديث الأرصدة فورياً.',
      quickLinks: [
        { label: 'سجل قيود اليومية', tab: 'journals' },
        { label: 'إنشاء قيد يدوي', tab: 'journals' },
      ],
    },
    {
      id: 'step-7',
      stepNumber: '٧',
      title: 'الأستاذ وميزان المراجعة',
      sub: 'حركة الحسابات والتدقيق',
      icon: BookOpen,
      targetTab: 'ledger',
      description: 'استخراج كشوف الحسابات لدفتر الأستاذ وميزان المراجعة بالمجاميع والأرصدة للتحقق من التوازن.',
      inputs: 'حركات الحسابات من القيود اليومية المرحلة خلال السنة المالية.',
      outputs: 'ميزان مراجعة معتمد بالأرصدة والتحقق الشامل من توازن معادلة المحاسبة.',
      accountingImpact: 'تدقيق الأرصدة وضمان صحة القيود قبل إعداد وإقفال القوائم المالية الختامية.',
      quickLinks: [
        { label: 'دفتر الأستاذ العام', tab: 'ledger' },
        { label: 'ميزان المراجعة', tab: 'trial-balance' },
      ],
    },
    {
      id: 'step-8',
      stepNumber: '٨',
      title: 'القوائم المالية والختامية',
      sub: 'الميزانية والأرباح والتدفقات',
      icon: PieChart,
      targetTab: 'financials',
      badge: 'ختامية',
      description: 'إصدار التقارير والقوائم المالية الختامية مع المؤشرات المالية.',
      inputs: 'أرصدة الحسابات المقفلة في ميزان المراجعة لجميع الإيرادات والمصروفات والأصول والخصوم.',
      outputs: 'قائمة الدخل، الميزانية العمومية، قائمة التدفقات النقدية، والتقارير الرقابية.',
      accountingImpact: 'تحديد صافي أرباح المطحنة، وحقوق الملكية، والمركز المالي الختامي.',
      quickLinks: [
        { label: 'قائمة الدخل (الأرباح)', tab: 'financials' },
        { label: 'المركز المالي (الميزانية)', tab: 'financials' },
        { label: 'التدفقات النقدية', tab: 'financials' },
        { label: 'لوحة المؤشرات KPIs', tab: 'dashboard' },
      ],
    },
  ];

  return (
    <div ref={barRef} className="relative mb-6 no-print">
      {/* Top Header Row of the Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-100 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/60">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                دورة المحاسبة والتشغيل المتكاملة لمطحنة الوليد
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  ترابط آلي فوري
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                تتبع مسار العمليات والترابط من المشتريات والمواد الخام وحتى القوائم المالية الختامية
              </p>
            </div>
          </div>

          {/* Flow Modal Button */}
          <button
            onClick={() => setShowFlowModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-[#0F2942] to-[#1E3E62] hover:from-blue-900 hover:to-indigo-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            خريطة الترابط الشاملة للنظام
          </button>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center justify-between min-w-[980px] gap-1.5">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isTabActive =
                activeTab === step.targetTab ||
                (step.id === 'step-1' && (activeTab === 'accounts' || activeTab === 'entities' || activeTab === 'units')) ||
                (step.id === 'step-2' && (activeTab === 'invoices' || activeTab === 'inventory')) ||
                (step.id === 'step-3' && activeTab === 'production') ||
                (step.id === 'step-4' && activeTab === 'invoices') ||
                (step.id === 'step-5' && activeTab === 'vouchers') ||
                (step.id === 'step-6' && activeTab === 'journals') ||
                (step.id === 'step-7' && (activeTab === 'ledger' || activeTab === 'trial-balance')) ||
                (step.id === 'step-8' && activeTab === 'financials');

              const isDropdownOpen = openDropdownId === step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="relative group">
                    <div
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl transition-all border select-none cursor-pointer ${
                        isTabActive
                          ? 'bg-[#0F2942] text-white shadow-md border-blue-500/50'
                          : 'bg-slate-50 hover:bg-blue-50/80 text-slate-800 border-slate-200 hover:border-blue-300'
                      }`}
                      onClick={() => {
                        onNavigateTab(step.targetTab);
                      }}
                    >
                      {/* Step Icon & Number */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${
                            isTabActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-blue-700 border border-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs whitespace-nowrap">
                              {step.title}
                            </span>
                            {step.badge && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                                  isTabActive
                                    ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {step.badge}
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[10px] whitespace-nowrap truncate max-w-[110px] ${
                              isTabActive ? 'text-blue-200' : 'text-slate-500'
                            }`}
                          >
                            {step.sub}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Toggle Arrow */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(isDropdownOpen ? null : step.id);
                        }}
                        className={`p-1 rounded-md hover:bg-black/10 transition-colors ${
                          isTabActive ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                        }`}
                        title="عرض تفاصيل وترابط المرحلة"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isDropdownOpen ? 'rotate-180 text-blue-400' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Step Details Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-right text-xs animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900">{step.title}</h4>
                              <span className="text-[10px] text-slate-500 font-bold">المرحلة رقم {step.stepNumber} في الدورة</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setOpenDropdownId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-slate-600 text-[11px] mb-3 leading-relaxed">
                          {step.description}
                        </p>

                        {/* Interconnection Info */}
                        <div className="space-y-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block">المدخلات المترابطة:</span>
                            <span className="text-[11px] text-slate-800 font-semibold">{step.inputs}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block">المخرجات والتحديث:</span>
                            <span className="text-[11px] text-slate-800 font-semibold">{step.outputs}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-blue-700 block">الأثر المحاسبي التلقائي:</span>
                            <span className="text-[11px] text-blue-900 font-mono font-bold">{step.accountingImpact}</span>
                          </div>
                        </div>

                        {/* Quick Navigation Links */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 block px-1">الشاشات والوظائف المرتبطة:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {step.quickLinks.map((link, lIdx) => (
                              <button
                                key={lIdx}
                                onClick={() => {
                                  onNavigateTab(link.tab);
                                  setOpenDropdownId(null);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-[11px] font-bold text-slate-700 text-right transition-all flex items-center justify-between cursor-pointer"
                              >
                                <span>{link.label}</span>
                                <ChevronLeft className="w-3 h-3 opacity-60" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {idx < steps.length - 1 && (
                    <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comprehensive Flowchart & System Interconnection Modal */}
      {showFlowModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right">
            {/* Modal Header */}
            <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-2xl text-cyan-300">
                  <Workflow className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    خريطة تدفق وترابط العمليات المحاسبية والتشغيلية
                    <span className="text-xs bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 px-2.5 py-0.5 rounded-full font-bold">
                      مطحنة الوليد المتحده
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    هيكل الترابط المتكامل للبيانات والترحيل التلقائي لقيود اليومية للحسابات
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFlowModal(false)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: The Interconnected System Architecture Diagram */}
            <div className="p-6 overflow-y-auto space-y-6 bg-slate-50 text-xs text-slate-800">
              {/* Flowchart Visual Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Stage 1 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <div className="flex items-center gap-2 text-blue-700 font-black">
                    <Package className="w-5 h-5" />
                    <span>١. المشتريات والخامات</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    شراء الحبوب والبهارات الخام من الموردين وتسجيل الفواتير.
                  </p>
                  <div className="bg-blue-50 p-2 rounded-xl text-[10px] text-blue-900 font-bold">
                    + زيادة مخزون المواد الخام<br />+ إثبات مستحقات الموردين
                  </div>
                  <button
                    onClick={() => {
                      onNavigateTab('invoices');
                      setShowFlowModal(false);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg font-black text-center transition-colors cursor-pointer"
                  >
                    الانتقال للمشتريات
                  </button>
                </div>

                {/* Stage 2 */}
                <div className="bg-white p-4 rounded-2xl border border-cyan-300 shadow-xs space-y-3 relative ring-2 ring-cyan-500/20">
                  <div className="flex items-center gap-2 text-cyan-800 font-black">
                    <Factory className="w-5 h-5" />
                    <span>٢. تشغيل المطحنة</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    تحويل الخامات لمنتج تام، خلط، طحن، وتعبئة مع احتساب التكاليف.
                  </p>
                  <div className="bg-cyan-50 p-2 rounded-xl text-[10px] text-cyan-900 font-bold">
                    - خصم خامات مستهلكة<br />+ إضافة مخزون بضاعة تامة
                  </div>
                  <button
                    onClick={() => {
                      onNavigateTab('production');
                      setShowFlowModal(false);
                    }}
                    className="w-full py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg font-black text-center transition-colors cursor-pointer"
                  >
                    الانتقال لأوامر التشغيل
                  </button>
                </div>

                {/* Stage 3 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <div className="flex items-center gap-2 text-emerald-700 font-black">
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>٣. المبيعات والجمعيات</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    توريد البضاعة التامة للجمعيات التعاونية وإصدار فواتير المبيعات.
                  </p>
                  <div className="bg-emerald-50 p-2 rounded-xl text-[10px] text-emerald-900 font-bold">
                    - خصم المخزون التام<br />+ إثبات إيراد ومديونية العميل
                  </div>
                  <button
                    onClick={() => {
                      onNavigateTab('invoices');
                      setShowFlowModal(false);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-lg font-black text-center transition-colors cursor-pointer"
                  >
                    الانتقال للمبيعات
                  </button>
                </div>

                {/* Stage 4 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <div className="flex items-center gap-2 text-amber-700 font-black">
                    <Receipt className="w-5 h-5" />
                    <span>٤. التحصيل والخزينة</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    استلام شيكات الجمعيات والتحصيل وسداد الموردين والمصروفات.
                  </p>
                  <div className="bg-amber-50 p-2 rounded-xl text-[10px] text-amber-900 font-bold">
                    + زيادة رصيد البنك/الصندوق<br />- تسوية مديونية العميل
                  </div>
                  <button
                    onClick={() => {
                      onNavigateTab('vouchers');
                      setShowFlowModal(false);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-amber-600 hover:text-white rounded-lg font-black text-center transition-colors cursor-pointer"
                  >
                    الانتقال للسندات
                  </button>
                </div>
              </div>

              {/* Automatic Accounting Core Integration Card */}
              <div className="bg-[#0F2942] text-white p-5 rounded-2xl shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-blue-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-black text-sm text-white">محرك القيود والترحيل الآلي المركزي (Double-Entry Engine)</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-600/50 text-blue-200 px-3 py-1 rounded-full">
                    توليد وترحيل فوري
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="font-bold text-cyan-300 block">١. قيود اليومية العامة:</span>
                    <p className="text-slate-300 text-[11px]">
                      تستقبل كافة الحركات من الفواتير والإنتاج وتنشئ قيود مزدوجة (مدين / دائن) متوازنة لحظياً.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="font-bold text-cyan-300 block">٢. دفتر الأستاذ العام وميزان المراجعة:</span>
                    <p className="text-slate-300 text-[11px]">
                      ترحيل الأرصدة فورياً لكل حساب شجرة، وتحديث ميزان المراجعة بالمجاميع والأرصدة دون تدخل يدوي.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="font-bold text-cyan-300 block">٣. القوائم المالية الختامية:</span>
                    <p className="text-slate-300 text-[11px]">
                      استخراج قائمة الدخل، الميزانية العمومية، والتدفقات النقدية بدقة متناهية.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Links to Reports */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="font-black text-slate-800 text-xs">
                  الوصول السريع للتقارير الختامية:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      onNavigateTab('journals');
                      setShowFlowModal(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    دفتر القيود
                  </button>
                  <button
                    onClick={() => {
                      onNavigateTab('ledger');
                      setShowFlowModal(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    الأستاذ العام
                  </button>
                  <button
                    onClick={() => {
                      onNavigateTab('trial-balance');
                      setShowFlowModal(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    ميزان المراجعة
                  </button>
                  <button
                    onClick={() => {
                      onNavigateTab('financials');
                      setShowFlowModal(false);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    القوائم المالية الختامية
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
