import React, { useState } from 'react';
import {
  X,
  Database,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Users,
  Package,
  FileCheck2,
  Scale,
  Sparkles,
  ShieldCheck,
  Upload,
  Layers
} from 'lucide-react';
import { CompanyProfile } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';

interface DatabaseWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompany: CompanyProfile;
  currency: string;
  onComplete: () => void;
}

export const DatabaseWizardModal: React.FC<DatabaseWizardModalProps> = ({
  isOpen,
  onClose,
  currentCompany,
  currency,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Company Info
  const [companyNameAr, setCompanyNameAr] = useState(currentCompany?.nameAr || '');
  const [companyNameEn, setCompanyNameEn] = useState(currentCompany?.nameEn || '');
  const [crNumber, setCrNumber] = useState(currentCompany?.commercialRegistration || '');
  const [taxNumber, setTaxNumber] = useState(currentCompany?.taxNumber || '');
  const [selectedCurrency, setSelectedCurrency] = useState(currentCompany?.currency || 'KWD');
  const [fiscalYearStart, setFiscalYearStart] = useState(
    currentCompany?.fiscalYearStart || `${new Date().getFullYear()}-01-01`
  );
  const [fiscalYearEnd, setFiscalYearEnd] = useState(
    currentCompany?.fiscalYearEnd || `${new Date().getFullYear()}-12-31`
  );

  // Step 2: Chart of Accounts & Policies
  const [chartPreset, setChartPreset] = useState<'IFRS_KUWAIT' | 'COMMERCIAL' | 'SERVICE'>('IFRS_KUWAIT');
  const [allowNegativeInventory, setAllowNegativeInventory] = useState(true);
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(true);

  // Step 3: Opening Cash & Capital
  const [openingCash, setOpeningCash] = useState<number>(5000);
  const [openingBank, setOpeningBank] = useState<number>(25000);
  const [openingCapital, setOpeningCapital] = useState<number>(30000);

  // Step 4: Quick Imports Text
  const [customersText, setCustomersText] = useState(
    `C-101\tشركة الأمل للتجارة\t96599112233\t1000.000\nC-102\tمؤسسة الشرق للمقاولات\t96566442211\t2500.000`
  );
  const [suppliersText, setSuppliersText] = useState(
    `S-201\tشركة التوريدات العامة\t96522331100\t3500.000\nS-202\tمطاحن الدقيق الوطنية\t96522448899\t4200.000`
  );
  const [inventoryText, setInventoryText] = useState(
    `SKU-1001\tطحين فاخر كويتي 10 كجم\tالمواد الغذائية\tكيس\t3.250\t4.500\t100\t15\nSKU-1002\tزيت ذرة نقي 5 لتر\tالزيوت\tحبة\t2.100\t2.950\t80\t10`
  );

  if (!isOpen) return null;

  const parseCustomers = () => {
    if (!customersText.trim()) return [];
    return customersText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line, idx) => {
        const parts = line.split('\t');
        return {
          code: parts[0] || `C-${idx + 1}`,
          nameAr: parts[1] || `عميل ${idx + 1}`,
          phone: parts[2] || '',
          openingBalance: Number(parts[3]) || 0,
        };
      });
  };

  const parseSuppliers = () => {
    if (!suppliersText.trim()) return [];
    return suppliersText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line, idx) => {
        const parts = line.split('\t');
        return {
          code: parts[0] || `S-${idx + 1}`,
          nameAr: parts[1] || `مورد ${idx + 1}`,
          phone: parts[2] || '',
          openingBalance: Number(parts[3]) || 0,
        };
      });
  };

  const parseInventory = () => {
    if (!inventoryText.trim()) return [];
    return inventoryText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line, idx) => {
        const parts = line.split('\t');
        return {
          sku: parts[0] || `SKU-${idx + 1}`,
          nameAr: parts[1] || `صنف ${idx + 1}`,
          category: parts[2] || 'عام',
          unit: parts[3] || 'حبة',
          purchasePrice: Number(parts[4]) || 0,
          salePrice: Number(parts[5]) || 0,
          quantityOnHand: Number(parts[6]) || 0,
          minQuantityAlert: Number(parts[7]) || 5,
        };
      });
  };

  const parsedCustomers = parseCustomers();
  const parsedSuppliers = parseSuppliers();
  const parsedInventory = parseInventory();

  const totalCustOpening = parsedCustomers.reduce((s, c) => s + (c.openingBalance || 0), 0);
  const totalSuppOpening = parsedSuppliers.reduce((s, c) => s + (c.openingBalance || 0), 0);
  const totalStockVal = parsedInventory.reduce((s, it) => s + (it.quantityOnHand * it.purchasePrice), 0);

  const calculatedCapital = (Number(openingCash) || 0) + (Number(openingBank) || 0) + totalCustOpening + totalStockVal - totalSuppOpening;

  const handleFinishWizard = async () => {
    if (!confirm('⚠️ هل أنت متأكد من إنشاء وتهيئة قاعدة البيانات الجديدة؟ سيتم اعتماد شجرة الحسابات وتثبيت الأرصدة الافتتاحية والقيد التأسيسي.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        company: {
          nameAr: companyNameAr,
          nameEn: companyNameEn,
          commercialRegistration: crNumber,
          taxNumber: taxNumber,
          currency: selectedCurrency,
          fiscalYearStart,
          fiscalYearEnd,
          allowNegativeInventory,
          allowNegativeBalance,
        },
        chartPreset,
        openingCash: Number(openingCash) || 0,
        openingBank: Number(openingBank) || 0,
        openingCapital: calculatedCapital,
        customers: parsedCustomers,
        suppliers: parsedSuppliers,
        inventory: parsedInventory,
      };

      const res = await fetch('/api/database/wizard-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشلت عملية إنشاء قاعدة البيانات');
      }

      const data = await res.json();
      alert('🎉 تم إنشاء وتهيئة قاعدة البيانات المحاسبية الجديدة بنجاح!');
      onComplete();
      onClose();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden text-right animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                مرشد خطوات إنشاء وتهيئة قاعدة بيانات جديدة (ERP Setup Wizard)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                دليل تفاعلي خطوة بخطوة لتأسيس دليل الحسابات وأرصدة أول المدة والأصناف
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto text-xs font-bold">
          {[
            { num: 1, title: 'هوية المنشأة' },
            { num: 2, title: 'الدليل المحاسبي' },
            { num: 3, title: 'النقدية ورأس المال' },
            { num: 4, title: 'استيراد البداية' },
            { num: 5, title: 'القيد الافتتاحي والتأكيد' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                currentStep === s.num
                  ? 'bg-blue-600 text-white shadow-xs'
                  : currentStep > s.num
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === s.num
                    ? 'bg-white text-blue-900 font-extrabold'
                    : currentStep > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {s.num}
              </span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Step Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-700 shrink-0" />
                <span>
                  الخطوة 1: أدخل بيانات وهوية المنشأة الأساسية وحدد العملة المعيارية والسنة المالية للشركة.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-800 font-bold mb-1">اسم الشركة (عربي) *</label>
                  <input
                    type="text"
                    value={companyNameAr}
                    onChange={(e) => setCompanyNameAr(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:border-blue-500"
                    placeholder="شركة التجارة العامة والمقاولات ذ.م.م"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">اسم الشركة (إنجليزي)</label>
                  <input
                    type="text"
                    value={companyNameEn}
                    onChange={(e) => setCompanyNameEn(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:border-blue-500"
                    placeholder="General Trading & Contracting Co. W.L.L"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">رقم السجل التجاري (CR Number)</label>
                  <input
                    type="text"
                    value={crNumber}
                    onChange={(e) => setCrNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:border-blue-500"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">الرقم الضريبي / المدني</label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:border-blue-500"
                    placeholder="987654321"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">العملة الأساسية (Base Currency)</label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:border-blue-500"
                  >
                    <option value="KWD">دينار كويتي (KWD) - 3 خانات عشرية</option>
                    <option value="SAR">ريال سعودي (SAR) - خانتان</option>
                    <option value="AED">درهم إماراتي (AED) - خانتان</option>
                    <option value="QAR">ريال قطري (QAR)</option>
                    <option value="BHD">دينار بحريني (BHD)</option>
                    <option value="OMR">ريال عماني (OMR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">تاريخ بداية ونهاية السنة المالية</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={fiscalYearStart}
                      onChange={(e) => setFiscalYearStart(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs"
                    />
                    <input
                      type="date"
                      value={fiscalYearEnd}
                      onChange={(e) => setFiscalYearEnd(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-700 shrink-0" />
                <span>
                  الخطوة 2: اختيار شجرة الحسابات المعيارية المعتمدة وسياسات الرقابة المالية.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  onClick={() => setChartPreset('IFRS_KUWAIT')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    chartPreset === 'IFRS_KUWAIT'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-xs mb-1">الدليل المحاسبي القياسي (الكويت)</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    شجرة متكاملة من 4 مستويات تشمل الأصول، الخصوم، حقوق الملكية، الإيرادات والمصروفات وحسابات البنوك الكويتية.
                  </p>
                </div>

                <div
                  onClick={() => setChartPreset('COMMERCIAL')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    chartPreset === 'COMMERCIAL'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-xs mb-1">دليل الشركات التجارية العامة</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    مخصص لتجارة الجملة والتجزئة وتوزيع المواد الغذائية والمنتجات الاستهلاكية.
                  </p>
                </div>

                <div
                  onClick={() => setChartPreset('SERVICE')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    chartPreset === 'SERVICE'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-xs mb-1">دليل الشركات الخدمية والمقاولات</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    مخصص لإدارة عقود الخدمات والصيانة والمشاريع والاستشارات.
                  </p>
                </div>
              </div>

              {/* Negative Control Options */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>سياسات الرقابة على الأرصدة والمخزون:</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowNegativeInventory}
                      onChange={(e) => setAllowNegativeInventory(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-slate-800">السماح بالبيع بالسالب في المخزون عند الضرورة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowNegativeBalance}
                      onChange={(e) => setAllowNegativeBalance(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-slate-800">السماح بالأرصدة السالبة المؤقتة في الصندوق والبنوك</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-700 shrink-0" />
                <span>
                  الخطوة 3: تحديد أرصدة النقدية والحساب البنكي الافتتاحي في بداية الدورة المحاسبية.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-slate-800 font-bold">رصيد الصندوق الرئيسي (الخزينة) الافتتاحي:</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 text-left text-sm"
                  />
                  <span className="text-[11px] text-slate-500 block">يتم قيده كطرف مدين بحساب الصندوق (1113)</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-slate-800 font-bold">رصيد البنك الرئيسي (NBK/KFH) الافتتاحي:</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={openingBank}
                    onChange={(e) => setOpeningBank(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 text-left text-sm"
                  />
                  <span className="text-[11px] text-slate-500 block">يتم قيده كطرف مدين بحساب البنك الرئيسي (1111)</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                <span>إجمالي السيولة النقدية الافتتاحية المدخلة:</span>
                <span className="font-mono font-extrabold text-base text-emerald-800">
                  {formatCurrency((Number(openingCash) || 0) + (Number(openingBank) || 0), selectedCurrency)}
                </span>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-700 shrink-0" />
                <span>
                  الخطوة 4: لصق واستيراد بيانات العملاء، الموردين، وبطاقات المخزون مع أسعار التكلفة والبيع وأرصدة أول المدة.
                </span>
              </div>

              {/* Customers Input */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    دليل العملاء ورصيد أول المدة (كود \t اسم \t هاتف \t رصيد أول المدة):
                  </span>
                  <span className="text-blue-700 font-bold">({parsedCustomers.length}) عميل - إجمالي: {formatCurrency(totalCustOpening, selectedCurrency)}</span>
                </div>
                <textarea
                  rows={3}
                  dir="ltr"
                  value={customersText}
                  onChange={(e) => setCustomersText(e.target.value)}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              {/* Suppliers Input */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    دليل الموردين ورصيد أول المدة (كود \t اسم \t هاتف \t رصيد أول المدة):
                  </span>
                  <span className="text-blue-700 font-bold">({parsedSuppliers.length}) مورد - إجمالي: {formatCurrency(totalSuppOpening, selectedCurrency)}</span>
                </div>
                <textarea
                  rows={3}
                  dir="ltr"
                  value={suppliersText}
                  onChange={(e) => setSuppliersText(e.target.value)}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              {/* Inventory Input */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    بطاقات المخزون (SKU \t اسم \t تصنيف \t وحدة \t تكلفة \t بيع \t كمية أول المدة \t حد الطلب):
                  </span>
                  <span className="text-blue-700 font-bold">({parsedInventory.length}) صنف - قيمة المخزون: {formatCurrency(totalStockVal, selectedCurrency)}</span>
                </div>
                <textarea
                  rows={3}
                  dir="ltr"
                  value={inventoryText}
                  onChange={(e) => setInventoryText(e.target.value)}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>
                  الخطوة 5: مراجعة القيد الافتتاحي التأسيسي وتأكيد تشغيل قاعدة البيانات الجديدة.
                </span>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">اسم الشركة:</span>
                  <span className="font-bold text-slate-900 truncate block">{companyNameAr}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">إجمالي الأصول الافتتاحية:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {formatCurrency(Number(openingCash) + Number(openingBank) + totalCustOpening + totalStockVal, selectedCurrency)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">إجمالي الخصوم (الموردين):</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatCurrency(totalSuppOpening, selectedCurrency)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">صافي رأس المال الموازن:</span>
                  <span className="font-mono font-extrabold text-emerald-700">
                    {formatCurrency(calculatedCapital, selectedCurrency)}
                  </span>
                </div>
              </div>

              {/* Master Opening Journal Entry Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 p-2.5 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                  <span>معاينة القيد الافتتاحي التأسيسي (Master Opening Journal)</span>
                  <span className="text-emerald-700 font-extrabold">القيد متوازن 100% (Balanced)</span>
                </div>
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2">رمز الحساب</th>
                      <th className="p-2">اسم الحساب</th>
                      <th className="p-2 text-left">مدين ({selectedCurrency})</th>
                      <th className="p-2 text-left">دائن ({selectedCurrency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {openingCash > 0 && (
                      <tr>
                        <td className="p-2 font-mono">1113</td>
                        <td className="p-2 font-bold">الصندوق الرئيسي (الخزينة)</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-700">{formatCurrency(openingCash, selectedCurrency)}</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                      </tr>
                    )}
                    {openingBank > 0 && (
                      <tr>
                        <td className="p-2 font-mono">1111</td>
                        <td className="p-2 font-bold">بنك الكويت الوطني (NBK) - الحساب الرئيسي</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-700">{formatCurrency(openingBank, selectedCurrency)}</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                      </tr>
                    )}
                    {totalCustOpening > 0 && (
                      <tr>
                        <td className="p-2 font-mono">1120</td>
                        <td className="p-2 font-bold">الذمم المدينة (حسابات العملاء)</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-700">{formatCurrency(totalCustOpening, selectedCurrency)}</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                      </tr>
                    )}
                    {totalStockVal > 0 && (
                      <tr>
                        <td className="p-2 font-mono">1130</td>
                        <td className="p-2 font-bold">مخزون البضائع والمنتجات</td>
                        <td className="p-2 text-left font-mono font-bold text-blue-700">{formatCurrency(totalStockVal, selectedCurrency)}</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                      </tr>
                    )}
                    {totalSuppOpening > 0 && (
                      <tr>
                        <td className="p-2 font-mono">2110</td>
                        <td className="p-2 font-bold">الذمم الدائنة (الموردين)</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                        <td className="p-2 text-left font-mono font-bold text-amber-700">{formatCurrency(totalSuppOpening, selectedCurrency)}</td>
                      </tr>
                    )}
                    {calculatedCapital > 0 && (
                      <tr className="bg-emerald-50/50">
                        <td className="p-2 font-mono font-bold">3100</td>
                        <td className="p-2 font-extrabold text-emerald-900">رأس المال المدفوع (حقوق الملكية التأسيسية)</td>
                        <td className="p-2 text-left font-mono">0.000</td>
                        <td className="p-2 text-left font-mono font-extrabold text-emerald-800">{formatCurrency(calculatedCapital, selectedCurrency)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinishWizard}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري تأسيس قاعدة البيانات...' : 'تأكيد إنشاء قاعدة البيانات وبدء التشغيل'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
