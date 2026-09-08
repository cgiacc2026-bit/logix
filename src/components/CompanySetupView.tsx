import React, { useState } from 'react';
import {
  Building2,
  FileCheck2,
  MapPin,
  Receipt,
  Scale,
  Award,
  Save,
  CheckCircle2,
  BadgeCheck,
  ShieldCheck,
  Printer,
  PenTool,
  Upload,
  Phone,
  Mail,
  Globe,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Database,
  Download,
  FileJson,
  HardDrive,
  RefreshCw,
  FolderUp,
  Key,
  Wand2,
  Layers,
  ArrowRight,
  Image as ImageIcon,
  Trash2,
  Plus
} from 'lucide-react';
import { CompanyProfile } from '../types.js';
import { DatabaseWizardModal } from './DatabaseWizardModal';
import { localDataStore } from '../services/dataService.ts';
import { safeApiFetch } from '../utils/safeJson.ts';
import { SystemResetService } from '../services/systemResetService.ts';

interface CompanySetupViewProps {
  company: CompanyProfile | null;
  onSaveCompany: (updated: CompanyProfile) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onResetDatabase?: () => Promise<void>;
}

export const CompanySetupView: React.FC<CompanySetupViewProps> = ({
  company,
  onSaveCompany,
  onRefreshData,
  onResetDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<'legal' | 'address' | 'vat' | 'accounting' | 'branding' | 'backup'>('legal');
  const [formData, setFormData] = useState<Partial<CompanyProfile>>(company || {});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Backup & Security States
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Update internal form data when prop changes
  React.useEffect(() => {
    if (company) {
      setFormData(company);
    }
  }, [company]);

  const handleChange = (field: keyof CompanyProfile, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr || !formData.crNumber) {
      setErrorMessage('يرجى تعبئة الحقول الأساسية: اسم الشركة ورقم السجل التجاري.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSaveCompany(formData as CompanyProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات الشركة');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportSuccess('');
    setErrorMessage('');
    try {
      let backupData = await safeApiFetch<any>('/api/backup/export');
      if (!backupData) {
        backupData = {
          exportDate: new Date().toISOString(),
          version: '2.0.0',
          company: localDataStore.getCompany(),
          users: localDataStore.getUsers(),
          accounts: localDataStore.getAccounts(),
          customers: localDataStore.getCustomers(),
          suppliers: localDataStore.getSuppliers(),
          inventory: localDataStore.getInventory(),
          journals: localDataStore.getJournals(),
          invoices: localDataStore.getInvoices(),
          vouchers: localDataStore.getVouchers(),
          units: localDataStore.getUnits(),
          productionOrders: localDataStore.getProductionOrders(),
        };
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const cleanCompanyName = (formData.nameAr || 'database').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `erp_backup_${cleanCompanyName}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess('تم استخراج وتنزيل النسخة الاحتياطية بنجاح بصيغة JSON!');
      setTimeout(() => setExportSuccess(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء استخراج ملف النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ تحذير: استعادة نسخة احتياطية سيحل محل كافة البيانات الحالية في النظام (الحسابات، الفواتير، القيود، المخزون). هل ترغب في المتابعة؟')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    setRestoreSuccess('');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const parsed = JSON.parse(jsonContent);

        if (parsed.company) localDataStore.saveCompany(parsed.company);
        if (parsed.users) localDataStore.saveUsers(parsed.users);
        if (parsed.accounts) localDataStore.saveAccounts(parsed.accounts);
        if (parsed.customers) localDataStore.saveCustomers(parsed.customers);
        if (parsed.suppliers) localDataStore.saveSuppliers(parsed.suppliers);
        if (parsed.inventory) localDataStore.saveInventory(parsed.inventory);
        if (parsed.journals) localDataStore.saveJournals(parsed.journals);
        if (parsed.invoices) localDataStore.saveInvoices(parsed.invoices);
        if (parsed.vouchers) localDataStore.saveVouchers(parsed.vouchers);
        if (parsed.units) localDataStore.saveUnits(parsed.units);
        if (parsed.productionOrders) localDataStore.saveProductionOrders(parsed.productionOrders);

        // 1. Sync to Express backend DB
        await safeApiFetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });

        // 2. Direct Sync to Firestore Cloud Collections (Dual Legacy & Prefixed)
        try {
          await SystemResetService.restoreBackupToFirestore(parsed);
        } catch (firestoreErr) {
          console.warn('Firestore backup sync warning:', firestoreErr);
        }

        setRestoreSuccess('تمت استعادة قاعدة البيانات بنجاح من ملف JSON وتحديث سحابة Supabase!');
        if (onRefreshData) {
          await onRefreshData();
        }
        setTimeout(() => setRestoreSuccess(''), 6000);
      } catch (err: any) {
        setErrorMessage(err.message || 'ملف غير صالح أو تعذر استعادة البيانات');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetDatabase = async () => {
    if (!onResetDatabase) return;
    const pwd = prompt('⚠️ لتأكيد تصفير وإعادة تهيئة قاعدة بيانات النظام بالكامل، يرجى إدخال كلمة مرور تصفير السيستم (123456789):');
    if (pwd === null) return;
    if (pwd.trim() !== '123456789') {
      alert('❌ كلمة مرور تصفير السيستم غير صحيحة! العملية ملغاة.');
      return;
    }
    setIsResettingDb(true);
    setErrorMessage('');
    try {
      await onResetDatabase();
      setRestoreSuccess('تم تصفير وإعادة تهيئة قاعدة بيانات النظام بنجاح!');
      setTimeout(() => setRestoreSuccess(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تصفير وتهيئة النظام');
    } finally {
      setIsResettingDb(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-[#D4AF37] border border-[#1A1A1A] shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">
                ملف وإعدادات الشركة ERP
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5 text-[#2D6A4F]" /> نظام معتمد
              </span>
            </div>
            <p className="text-xs text-[#8C8273] mt-1 font-serif italic">
              إدارة البيانات الرسمية والعنوان والسياسات المحاسبية وأختام التوقيع والاعتماد.
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 border border-[#1A1A1A] shadow-xs cursor-pointer disabled:opacity-50 transition-all self-start md:self-auto"
        >
          <Save className="w-4 h-4 text-[#D4AF37]" />
          <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات العامة'}</span>
        </button>
      </div>

      {/* Alert Messages */}
      {saveSuccess && (
        <div className="bg-[#EBF5EE] border border-[#2D6A4F]/30 text-[#2D6A4F] p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-serif font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>تم حفظ تحديثات بيانات وإعدادات الشركة بنجاح وتفعيلها في كافة مستندات وفواتير النظام!</span>
        </div>
      )}

      {exportSuccess && (
        <div className="bg-[#EBF5EE] border border-[#2D6A4F]/30 text-[#2D6A4F] p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-serif font-semibold">
          <FileJson className="w-5 h-5 flex-shrink-0 text-[#2D6A4F]" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {restoreSuccess && (
        <div className="bg-[#EBF5EE] border border-[#2D6A4F]/30 text-[#2D6A4F] p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-serif font-semibold">
          <RefreshCw className="w-5 h-5 flex-shrink-0 text-[#2D6A4F] animate-spin" />
          <span>{restoreSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-[#FDF2F2] border border-[#9E2A2B]/30 text-[#9E2A2B] p-4 rounded-lg text-xs flex items-center gap-2 font-serif font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-xl overflow-x-auto no-print">
        {[
          { id: 'legal', label: 'الهوية والسجل التجاري', icon: FileCheck2 },
          { id: 'address', label: 'العنوان والاتصال', icon: MapPin },
          { id: 'vat', label: 'البيانات التجارية والفوترة', icon: Receipt },
          { id: 'accounting', label: 'السنة والسياسات المحاسبية', icon: Scale },
          { id: 'branding', label: 'الموقّعون والختم والمطبوعات', icon: PenTool },
          { id: 'backup', label: 'النسخ الاحتياطي (JSON)', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm border border-blue-500'
                  : 'text-slate-600 hover:text-blue-900 hover:bg-white/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-200' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* FORM CONTENT */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: LEGAL & IDENTITY */}
        {activeTab === 'legal' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#B8860B]" /> البيانات القانونية وهوية المنشأة
              </h3>
              <p className="text-xs text-[#8C8273] mt-0.5">
                تحديد الاسم الرسمي المعتمد في السجل التجاري والشكل القانوني لتضمينها في العقود والقوائم المالية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  اسم الشركة الكامل (باللغة العربية) <span className="text-[#9E2A2B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nameAr || ''}
                  onChange={(e) => handleChange('nameAr', e.target.value)}
                  placeholder="مثال: شركة الرؤية المتكاملة للحلول المالية المحدودة"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  اسم الشركة (English Name)
                </label>
                <input
                  type="text"
                  value={formData.nameEn || ''}
                  onChange={(e) => handleChange('nameEn', e.target.value)}
                  placeholder="e.g. Integrated Vision Financial Solutions Co. Ltd."
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] dir-ltr text-left"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  الاسم التجاري / العلامة التجارية (Trade Name)
                </label>
                <input
                  type="text"
                  value={formData.tradeName || ''}
                  onChange={(e) => handleChange('tradeName', e.target.value)}
                  placeholder="الرؤية المالية"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  الشكل القانوني للمنشأة
                </label>
                <select
                  value={formData.legalForm || 'شركة ذات مسؤولية محدودة (LLC)'}
                  onChange={(e) => handleChange('legalForm', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="شركة ذات مسؤولية محدودة (ذ.م.م - W.L.L)">شركة ذات مسؤولية محدودة (ذ.م.م - W.L.L)</option>
                  <option value="شركة مساهمة كويتية (ش.م.ك - K.S.C)">شركة مساهمة كويتية (ش.م.ك - K.S.C)</option>
                  <option value="شركة ذات مسؤولية محدودة (LLC)">شركة ذات مسؤولية محدودة (LLC)</option>
                  <option value="شركة مساهمة مقفلة (Closed Joint Stock)">شركة مساهمة مقفلة (Closed Joint Stock)</option>
                  <option value="شركة مساهمة عامة (Public Joint Stock)">شركة مساهمة عامة (Public Joint Stock)</option>
                  <option value="شركة الشخص الواحد (Single Person LLC)">شركة الشخص الواحد (Single Person LLC)</option>
                  <option value="مؤسسة فردية (Sole Proprietorship)">مؤسسة فردية (Sole Proprietorship)</option>
                  <option value="فرع شركة أجنبية (Foreign Branch)">فرع شركة أجنبية (Foreign Branch)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  رقم السجل التجاري (Commercial Register - CR) <span className="text-[#9E2A2B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.crNumber || ''}
                  onChange={(e) => handleChange('crNumber', e.target.value)}
                  placeholder="1010XXXXXX"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  رقم عضوية الغرفة التجارية
                </label>
                <input
                  type="text"
                  value={formData.chamberNumber || ''}
                  onChange={(e) => handleChange('chamberNumber', e.target.value)}
                  placeholder="228819"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  تاريخ إصدار السجل التجاري
                </label>
                <input
                  type="date"
                  value={formData.crIssueDate || ''}
                  onChange={(e) => handleChange('crIssueDate', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  تاريخ انتهاء السجل التجاري
                </label>
                <input
                  type="date"
                  value={formData.crExpiryDate || ''}
                  onChange={(e) => handleChange('crExpiryDate', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NATIONAL ADDRESS & CONTACTS */}
        {activeTab === 'address' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#B8860B]" /> العنوان الوطني المعتمد وسجل الاتصال
              </h3>
              <p className="text-xs text-[#8C8273] mt-0.5">
                العنوان الوطني المسجل لدى البريد والمعتمد لإصدار الفواتير الرسمية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">رقم المبنى (Building No.)</label>
                <input
                  type="text"
                  value={formData.buildingNo || ''}
                  onChange={(e) => handleChange('buildingNo', e.target.value)}
                  placeholder="7412"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[#1A1A1A] font-semibold mb-1">اسم الشارع (Street Name)</label>
                <input
                  type="text"
                  value={formData.streetName || ''}
                  onChange={(e) => handleChange('streetName', e.target.value)}
                  placeholder="طريق الملك فهد الفرعي"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الحي (District)</label>
                <input
                  type="text"
                  value={formData.district || ''}
                  onChange={(e) => handleChange('district', e.target.value)}
                  placeholder="حي العليا"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">المدينة (City)</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="الرياض"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الدولة (Country)</label>
                <input
                  type="text"
                  value={formData.country || 'المملكة العربية السعودية'}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الرمز البريدي (Postal Code)</label>
                <input
                  type="text"
                  value={formData.postalCode || ''}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  placeholder="12214"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الرقم الإضافي (Additional No.)</label>
                <input
                  type="text"
                  value={formData.additionalNo || ''}
                  onChange={(e) => handleChange('additionalNo', e.target.value)}
                  placeholder="3421"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الهاتف الثابت / المجاني</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+966 11 456 7890"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A] dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">رقم الجوال الرسمي</label>
                <input
                  type="text"
                  value={formData.mobile || ''}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  placeholder="+966 50 123 4567"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A] dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">البريد الإلكتروني الرسمي</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="info@vision-finance.sa"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] dir-ltr text-left"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الموقع الإلكتروني</label>
                <input
                  type="text"
                  value={formData.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://vision-finance.sa"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] dir-ltr text-left"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Commercial Data & Invoicing */}
        {activeTab === 'vat' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#B8860B]" /> البيانات التجارية والفوترة
                </h3>
                <p className="text-xs text-[#8C8273] mt-0.5">
                  إعدادات الفوترة والربط التجاري والسجل التجاري المعمول به بدولة الكويت.
                </p>
              </div>
              <span className="px-3 py-1 bg-[#EBF5EE] text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" /> نظام معتمد
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">
                  رقم السجل التجاري / رقم الملف
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={formData.crNumber || ''}
                  onChange={(e) => handleChange('crNumber', e.target.value)}
                  placeholder="450912"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono text-sm font-bold tracking-wider focus:outline-none focus:border-[#1A1A1A]"
                />
                <span className="text-[11px] text-[#8C8273] mt-1 block">
                  رقم السجل التجاري الصادر من وزارة التجارة والصناعة بدولة الكويت.
                </span>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">رقم عضوية غرفة التجارة والصناعة</label>
                <input
                  type="text"
                  maxLength={30}
                  value={formData.chamberNumber || ''}
                  onChange={(e) => handleChange('chamberNumber', e.target.value)}
                  placeholder="112890"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-mono text-sm font-bold tracking-wider focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">العملة الأساسية للنظام</label>
                <input
                  type="text"
                  readOnly
                  value="دينار كويتي (KWD)"
                  className="w-full bg-slate-50 border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-bold"
                />
              </div>
            </div>

            {/* Invoicing Rules Info Box */}
            <div className="bg-[#F7F5F0] border border-[#E5E1DA] p-4 rounded-lg space-y-2 text-xs">
              <div className="font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-[#B8860B]" /> معايير الفواتير والمستندات الرسمية
              </div>
              <ul className="list-disc list-inside text-[#6E6659] space-y-1 text-[11px] leading-relaxed">
                <li>يتم توليد رمز الاستجابة السريعة (QR Code) لكل فاتورة وسند صادر تلقائياً.</li>
                <li>تنسيق القيد المحاسبي المزدوج التلقائي لحسابات المبيعات والمشتريات والعملاء والموردين.</li>
                <li>حفظ واسترجاع كافة الفواتير والسندات في السجل الرقمي مع الحفاظ على تسلسل الأرقام المالية.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: ACCOUNTING POLICIES & FISCAL YEAR */}
        {activeTab === 'accounting' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#B8860B]" /> السنة المالية والسياسات المحاسبية
              </h3>
              <p className="text-xs text-[#8C8273] mt-0.5">
                تحديد القواعد المحاسبية لتقييم المخزون والإهلاك والعملة الوظيفية المعتمدة لإعداد القوائم المالية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">تاريخ بداية السنة المالية</label>
                <input
                  type="date"
                  value={formData.fiscalYearStart || '2026-01-01'}
                  onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">تاريخ نهاية السنة المالية</label>
                <input
                  type="date"
                  value={formData.fiscalYearEnd || '2026-12-31'}
                  onChange={(e) => handleChange('fiscalYearEnd', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">الأساس المحاسبي (Accounting Basis)</label>
                <select
                  value={formData.accountingBasis || 'ACCRUAL'}
                  onChange={(e) => handleChange('accountingBasis', e.target.value as any)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="ACCRUAL">أساس الاستحقاق (Accrual Basis)</option>
                  <option value="CASH">الأساس النقدي (Cash Basis)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">العملة الوظيفية والأساسية (Functional Currency)</label>
                <select
                  value={formData.functionalCurrency || 'KWD'}
                  onChange={(e) => handleChange('functionalCurrency', e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="KWD">الدينار الكويتي (KWD / د.ك)</option>
                  <option value="SAR">الريال السعودي (SAR / ر.س)</option>
                  <option value="USD">الدولار الأمريكي (USD / $)</option>
                  <option value="AED">الدرهم الإماراتي (AED / د.إ)</option>
                  <option value="EUR">اليورو الأوروبي (EUR / €)</option>
                  <option value="EGP">الجنيه المصري (EGP / ج.م)</option>
                  <option value="BHD">الدينار البحريني (BHD / د.ب)</option>
                  <option value="OMR">الريال العماني (OMR / ر.ع)</option>
                  <option value="QAR">الريال القطري (QAR / ر.ق)</option>
                  <option value="JOD">الدينار الأردني (JOD / د.أ)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">سياسة تقييم وتكلفة المخزون</label>
                <select
                  value={formData.inventoryCosting || 'WEIGHTED_AVERAGE'}
                  onChange={(e) => handleChange('inventoryCosting', e.target.value as any)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="WEIGHTED_AVERAGE">المتوسط المرجح (Weighted Average Cost)</option>
                  <option value="FIFO">الوارد أولاً يصرف أولاً (FIFO)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">طريقة إهلاك الأصول الثابتة</label>
                <select
                  value={formData.depreciationMethod || 'STRAIGHT_LINE'}
                  onChange={(e) => handleChange('depreciationMethod', e.target.value as any)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="STRAIGHT_LINE">طريقة القسط الثابت (Straight Line Method)</option>
                  <option value="DECLINING_BALANCE">طريقة القسط المتناقص (Declining Balance)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">دقة التقريب للكسور العشرية</label>
                <select
                  value={formData.decimalPlaces || 2}
                  onChange={(e) => handleChange('decimalPlaces', Number(e.target.value))}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value={2}>خانتي كسر عشرية (0.00)</option>
                  <option value={3}>3 خانات كسر عشرية (0.000)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">نسق وألوان البرنامج (ERP Theme)</label>
                <select
                  value={formData.themeColor || 'blue'}
                  onChange={(e) => handleChange('themeColor', e.target.value)}
                  className="w-full bg-white border border-blue-200 rounded-md px-3 py-2 text-[#1A1A1A] font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="blue">الأزرق الملكي الماسي (Executive Royal Sapphire Blue) - الافتراضي</option>
                  <option value="navy">الكحلي المؤسسي (Midnight Corporate Navy)</option>
                  <option value="slate">الأزرق الرمادي المالي (Financial Slate Blue)</option>
                </select>
              </div>
            </div>

            {/* Negative Values and Stock Control Section */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4 text-xs mt-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  سياسات الرقابة على القيم السالبة وإدارة المخزون
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  إعدادات الرقابة والمحاسبة
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allow Negative Inventory Toggle */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-start justify-between gap-3 shadow-xs">
                  <div>
                    <label className="font-bold text-slate-900 block mb-1">
                      السماح بالقيم السالبة في المخزون (البيع بالسالب)
                    </label>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      عند التفعيل: يسمح بإصدار فواتير المبيعات وصرف المواد حتى لو أصبحت كمية الصنف في المستودع بالسالب (أقل من الصفر) لتفادي تعطيل حركة البيع.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allowNegativeInventory ?? true}
                    onChange={(e) => handleChange('allowNegativeInventory', e.target.checked)}
                    className="w-5 h-5 accent-blue-600 cursor-pointer mt-1"
                  />
                </div>

                {/* Allow Negative Balances Toggle */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-start justify-between gap-3 shadow-xs">
                  <div>
                    <label className="font-bold text-slate-900 block mb-1">
                      السماح بالأرصدة السالبة في الحسابات (السحب على المكشوف)
                    </label>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      عند التفعيل: يسمح بترحيل سندات الصرف والقيود المالية حتى لو تحول رصيد الصندوق أو الحساب البنكي إلى رصيد دائن/سالب مؤقتاً.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allowNegativeBalance ?? true}
                    onChange={(e) => handleChange('allowNegativeBalance', e.target.checked)}
                    className="w-5 h-5 accent-blue-600 cursor-pointer mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BRANDING & PRINTING */}
        {activeTab === 'branding' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#B8860B]" /> الموقّعون المفوضون وتنسيق المطبوعات وشعار المنشأة والعملاء
              </h3>
              <p className="text-xs text-[#8C8273] mt-0.5">
                تحديد أسماء الإدارة، رفع شعار المنشأة، تخصيص ترويسات المطبوعات الرسمية وتفعيل الختم الإلكتروني.
              </p>
            </div>

            {/* LOGO UPLOAD & BRANDING SECTION */}
            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    شعار المنشأة والمطبوعات (Entity Logo)
                  </h4>
                  <p className="text-[11px] text-[#6E6659]">
                    رفع لوجو المنشأة بدقة عالية ليظهر في ترويسة الفواتير، بطاقات حركة المخزون، وسندات الصرف والقبض
                  </p>
                </div>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={() => handleChange('logoUrl', '')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف الشعار
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Logo Preview box */}
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Company Logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-bold block">لا يوجد شعار</span>
                    </div>
                  )}
                </div>

                {/* Upload Buttons & Options */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>اختيار ملف لوجو من جهازك (PNG / JPG / SVG / WebP)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (uploadEvt) => {
                              if (uploadEvt.target?.result) {
                                handleChange('logoUrl', uploadEvt.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    <span className="text-xs text-slate-400 font-bold">أو</span>

                    <input
                      type="text"
                      value={formData.logoUrl || ''}
                      onChange={(e) => handleChange('logoUrl', e.target.value)}
                      placeholder="لصق رابط مباشر لصورة الشعار (URL)..."
                      className="flex-1 min-w-[220px] bg-white border border-[#E5E1DA] rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    يتم تحويل الشعار وتخزينه كبيانات Base64 متوافقة سحابياً ومحلياً ليطبع في كل فاتورة وسند ومستند.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">المدير العام / التنفيذي</label>
                <input
                  type="text"
                  value={formData.generalManager || ''}
                  onChange={(e) => handleChange('generalManager', e.target.value)}
                  placeholder="د. خالد بن عبد العزيز السليمان"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">المدير المالي (CFO)</label>
                <input
                  type="text"
                  value={formData.financialManager || ''}
                  onChange={(e) => handleChange('financialManager', e.target.value)}
                  placeholder="أ. محمد بن عبد الله الشمري"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-semibold mb-1">المحاسب الرئيسي</label>
                <input
                  type="text"
                  value={formData.chiefAccountant || ''}
                  onChange={(e) => handleChange('chiefAccountant', e.target.value)}
                  placeholder="أ. أحمد علي المصطفى"
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[#1A1A1A] font-semibold mb-1">الترويسة المطبوعة العلوية (Header Notes)</label>
                <input
                  type="text"
                  value={formData.headerNotes || ''}
                  onChange={(e) => handleChange('headerNotes', e.target.value)}
                  placeholder="نص يظهر في ترويسة الفواتير والمستندات المطبوعة..."
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[#1A1A1A] font-semibold mb-1">الشروط والأحكام الافتراضية بالفاتورة (Footer Terms)</label>
                <textarea
                  rows={2}
                  value={formData.footerNotes || ''}
                  onChange={(e) => handleChange('footerNotes', e.target.value)}
                  placeholder="شروط الدفع والتسليم والاسترجاع على الفواتير..."
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="md:col-span-3 flex items-center justify-between bg-[#F7F5F0] p-4 rounded-md border border-[#E5E1DA]">
                <div>
                  <span className="font-serif font-bold text-[#1A1A1A] block">تفعيل الختم والاعتماد الرقمي الرسمي</span>
                  <span className="text-[11px] text-[#6E6659]">إدراج الختم والتوقيع الإلكتروني تلقائياً على سندات المقبوضات والمبيعات الصادرة</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showDigitalStamp ?? true}
                  onChange={(e) => handleChange('showDigitalStamp', e.target.checked)}
                  className="w-5 h-5 accent-[#1A1A1A] cursor-pointer"
                />
              </div>
            </div>

            {/* CUSTOMER-SPECIFIC BRAND HEADERS */}
            <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    ترويسات خاصة بأسماء العملاء والجمعيات (Customer Co-Branded Headers)
                  </h4>
                  <p className="text-[11px] text-[#6E6659]">
                    تخصيص ترويسة وشعار خاص بكل عميل (مثل جمعية الشامية، جمعية الروضة، لولو هايبر) للطباعة المشتركة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const existing = formData.customerBrandHeaders || [];
                    const updated = [
                      ...existing,
                      {
                        id: `cbh-${Date.now()}`,
                        customerId: '',
                        customerNameAr: 'جمعية تعاونية جديدة',
                        customHeaderTitle: 'توريد معتمد ومخصص لصالح الجمعية',
                        coBrandLogoUrl: '',
                        notes: 'ترويسة رسمية مخصصة لأوامر توريد الجمعيات وسلاسل التجزئة',
                      },
                    ];
                    handleChange('customerBrandHeaders', updated);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة ترويسة عميل مخصصة
                </button>
              </div>

              {(!formData.customerBrandHeaders || formData.customerBrandHeaders.length === 0) ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 font-bold">
                  لم يتم إضافة ترويسات خاصة بالعملاء بعد. انقر على «إضافة ترويسة عميل مخصصة» لتسجيل ترويسة جمعية أو موزع.
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.customerBrandHeaders.map((cbh, idx) => (
                    <div key={cbh.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">ترويسة العميل #{idx + 1}: {cbh.customerNameAr}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.customerBrandHeaders || []).filter((_, i) => i !== idx);
                            handleChange('customerBrandHeaders', updated);
                          }}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> حذف الترويسة
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">اسم العميل / الجمعية:</label>
                          <input
                            type="text"
                            value={cbh.customerNameAr}
                            onChange={(e) => {
                              const updated = [...(formData.customerBrandHeaders || [])];
                              updated[idx].customerNameAr = e.target.value;
                              handleChange('customerBrandHeaders', updated);
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                            placeholder="مثال: جمعية الروضة وحولي التعاونية"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">نص الترويسة المطبوعة بالوثائق:</label>
                          <input
                            type="text"
                            value={cbh.customHeaderTitle}
                            onChange={(e) => {
                              const updated = [...(formData.customerBrandHeaders || [])];
                              updated[idx].customHeaderTitle = e.target.value;
                              handleChange('customerBrandHeaders', updated);
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                            placeholder="مثال: التوريد الحصري لمنتجات مطحنة الوليد المتحدة"
                          />
                        </div>
                      </div>

                      {/* Customer Co-Brand Logo Upload */}
                      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-3">
                        <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          {cbh.coBrandLogoUrl ? (
                            <img
                              src={cbh.coBrandLogoUrl}
                              alt="Customer Logo"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs">
                            <Upload className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{cbh.coBrandLogoUrl ? 'تغيير لوجو العميل' : 'رفع لوجو العميل / الجمعية'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (uploadEvt) => {
                                    if (uploadEvt.target?.result) {
                                      const updated = [...(formData.customerBrandHeaders || [])];
                                      updated[idx].coBrandLogoUrl = uploadEvt.target.result as string;
                                      handleChange('customerBrandHeaders', updated);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>

                          {cbh.coBrandLogoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(formData.customerBrandHeaders || [])];
                                updated[idx].coBrandLogoUrl = '';
                                handleChange('customerBrandHeaders', updated);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
                            >
                              حذف لوجو العميل
                            </button>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400">
                          (يظهر لوجو العميل بجوار لوجو المنشأة في الفاتورة والترويسة المشتركة)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LIVE DOCUMENT LETTERHEAD PREVIEW */}
            <div className="border border-[#E5E1DA] rounded-lg p-6 bg-[#FDFCFB] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2 text-xs font-serif font-bold text-[#8C8273]">
                <span>معاينة الترويسة المطبوعة الرسمية للمنشأة (Document Letterhead Preview)</span>
                <span className="text-[#2D6A4F] flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5" /> نموذج معتمد للطباعة
                </span>
              </div>

              <div className="bg-white p-6 rounded-md border border-[#E5E1DA] shadow-xs space-y-6">
                {/* Letterhead Header */}
                <div className="flex justify-between items-start border-b-2 border-[#1A1A1A] pb-4">
                  <div className="flex items-center gap-4">
                    {formData.logoUrl && (
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        className="w-14 h-14 object-contain rounded-lg border border-slate-200 p-1 bg-white shrink-0"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="text-lg font-serif font-bold text-[#1A1A1A]">
                        {formData.nameAr || 'اسم الشركة بالعربية'}
                      </div>
                      <div className="text-xs font-mono text-[#6E6659] dir-ltr text-right">
                        {formData.nameEn || 'Company English Name'}
                      </div>
                      <div className="text-[11px] text-[#8C8273]">
                        س.ت: {formData.crNumber || '450912'} • غرفة التجارة: {formData.chamberNumber || '112890'}
                      </div>
                    </div>
                  </div>

                  <div className="text-left text-[11px] text-[#6E6659] space-y-0.5">
                    <div>{formData.city || 'الكويت'} - {formData.country || 'دولة الكويت'}</div>
                    <div>{formData.streetName || 'شارع السور'} - مبنى {formData.buildingNo || '14'}</div>
                    <div>هاتف: {formData.phone || '+965 2244 8899'}</div>
                    <div>بريد: {formData.email || 'info@alwaleed.com.kw'}</div>
                  </div>
                </div>

                {/* Sample Body Content */}
                <div className="py-4 text-center space-y-2">
                  <div className="inline-block px-4 py-1.5 bg-[#F7F5F0] border border-[#E5E1DA] text-[#1A1A1A] font-serif font-bold rounded-md text-xs">
                    فاتورة مبيعات / سند رسمي صادر
                  </div>
                  <p className="text-xs text-[#8C8273] italic">
                    هذا النموذج يعكس التنسيق المعتمد لكافة المطبوعات الرسمية الصادرة من المنشأة مع القيود المحاسبية.
                  </p>
                </div>

                {/* Stamp & Signatures */}
                <div className="flex justify-between items-center pt-6 border-t border-[#E5E1DA] text-xs">
                  <div className="text-center space-y-1">
                    <div className="text-[#8C8273]">إعداد وتدقيق:</div>
                    <div className="font-semibold text-[#1A1A1A]">{formData.chiefAccountant || 'المحاسب الرئيسي'}</div>
                  </div>

                  {formData.showDigitalStamp && (
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#B8860B]/60 p-1 flex flex-col items-center justify-center text-center rotate-[-6deg] bg-[#FFFBEB]/40">
                      <div className="text-[9px] font-bold text-[#B8860B] leading-tight">معتمد رسمياً</div>
                      <ShieldCheck className="w-6 h-6 text-[#B8860B] my-0.5" />
                      <div className="text-[8px] font-mono text-[#B8860B]">{formData.crNumber}</div>
                      <div className="text-[7px] text-[#8C8273]">{formData.city}</div>
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    <div className="text-[#8C8273]">المدير المالي والتنفيذي:</div>
                    <div className="font-semibold text-[#1A1A1A]">{formData.financialManager || 'المدير المالي'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DATABASE BACKUP & DATA SECURITY */}
        {activeTab === 'backup' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#B8860B]" />
                  إدارة النسخ الاحتياطي وأمان البيانات (System Database Backup)
                </h3>
                <p className="text-xs text-[#8C8273] mt-1 font-serif">
                  حفظ نسخة احتياطية كاملة من قاعدة بيانات النظام بصيغة JSON تحتوي على شجرة الحسابات، القيود، الفواتير، المخزون، والعملاء والموردين.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#FFFBEB] text-[#B8860B] border border-[#B8860B]/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#B8860B]" />
                  حفظ آمن ومستقل (JSON Format)
                </span>
              </div>
            </div>

            {/* HERO WIZARD CARD: INITIALIZE NEW DATABASE */}
            <div className="bg-gradient-to-r from-[#0F2942] to-[#1E3A8A] text-white rounded-2xl p-6 shadow-md border border-blue-800 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/30 flex items-center justify-center text-cyan-300">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-white">
                      مرشد خطوات إنشاء وتهيئة قاعدة بيانات جديدة (ERP Setup Wizard)
                    </h4>
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed max-w-2xl">
                    دليل شامل خطوة بخطوة لتأسيس قاعدة بيانات محاسبية معتمدة للمنشأة: تهيئة شجرة الحسابات، تحديد أرصدة النقدية ورأس المال، استيراد العملاء والموردين وبطاقات الأصناف، وتوليد القيد الافتتاحي التأسيسي تلقائياً.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>بدء مرشد إنشاء قاعدة البيانات (5 خطوات)</span>
                </button>
              </div>

              {/* 5-Steps Mini Roadmap */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-blue-800/80 text-[11px] text-blue-100">
                <div className="bg-white/10 p-2 rounded-lg text-center">1. هوية المنشأة والعملة</div>
                <div className="bg-white/10 p-2 rounded-lg text-center">2. دليل الحسابات</div>
                <div className="bg-white/10 p-2 rounded-lg text-center">3. النقدية ورأس المال</div>
                <div className="bg-white/10 p-2 rounded-lg text-center">4. استيراد العملاء والمخزون</div>
                <div className="bg-white/10 p-2 rounded-lg text-center">5. اعتماد القيد الافتتاحي</div>
              </div>
            </div>

            {/* ACTION CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Backup Card */}
              <div className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-[#B8860B]/50 transition-all">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-700">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-serif font-bold text-[#1A1A1A]">
                      تصدير نسخة احتياطية من البيانات (Export Backup JSON)
                    </h4>
                    <p className="text-xs text-[#8C8273] mt-1 leading-relaxed">
                      توليد ملف JSON محمي يضم جميع السجلات المحاسبية والعمليات التجارية لتخزينه بأمان على جهازك الشخصي أو السحابة.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-[#E5E1DA] text-[11px] text-[#6E6659] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                      <FileJson className="w-4 h-4 text-[#B8860B]" />
                      محتويات النسخة الاحتياطية المصدرة:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[#8C8273] pr-2">
                      <li>دليل الحسابات المحاسبية وقوائم قيود اليومية</li>
                      <li>فواتير المبيعات والمشتريات وسندات القبض والصرف</li>
                      <li>دليل العملاء والموردين ومنتجات المخزون والوحدات</li>
                      <li>بيانات الشركة الرسمية والسياسات المالية</li>
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full py-3 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-[#1A1A1A] shadow-xs cursor-pointer transition-all disabled:opacity-50 mt-2"
                >
                  <Download className={`w-4 h-4 text-[#D4AF37] ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? 'جاري استخراج البيانات وتجهيز الملف...' : 'تنزيل النسخة الاحتياطية (تصدير JSON Backup)'}</span>
                </button>
              </div>

              {/* Import / Restore Backup Card */}
              <div className="bg-[#FDFCFB] border border-[#E5E1DA] rounded-xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-[#9E2A2B]/40 transition-all">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-700">
                    <FolderUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-serif font-bold text-[#1A1A1A]">
                      استعادة نسخة احتياطية من ملف (Restore JSON Backup)
                    </h4>
                    <p className="text-xs text-[#8C8273] mt-1 leading-relaxed">
                      رفع ملف نسخة احتياطية سابق بصيغة JSON لاستعادة كافة البيانات والحسابات السابقة إلى النظام بشكل أوتوماتيكي.
                    </p>
                  </div>

                  <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      تنبيه هام قبل إجراء الاستعادة:
                    </div>
                    <p className="text-xs text-amber-800 leading-snug">
                      استعادة النسخة الاحتياطية ستقوم باستبدال البيانات الحالية بالكامل بالبيانات المحفوظة في ملف JSON المرفوع.
                    </p>
                  </div>
                </div>

                <label className="w-full py-3 bg-white hover:bg-[#F7F5F0] text-[#1A1A1A] border border-[#E5E1DA] text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all mt-2 text-center">
                  <FolderUp className={`w-4 h-4 text-[#B8860B] ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'جاري رفع الملف ومعالجة الاستعادة...' : 'استعادة نسخة احتياطية (اختيار ملف JSON)'}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackup}
                    disabled={isRestoring}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* DANGER ZONE: SYSTEM RESET & INITIALIZATION */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-rose-950 font-bold text-sm">
                    <RefreshCw className={`w-4 h-4 text-rose-700 ${isResettingDb ? 'animate-spin' : ''}`} />
                    <span>تصفير وإعادة تهيئة قاعدة بيانات النظام (Reset & Clean Database)</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed max-w-2xl">
                    تصفير الحسابات والقيود والفواتير للبدء بقاعدة بيانات نظيفة وجاهزة للإنتاج. يوصى بأخذ نسخة احتياطية أولاً قبل الضغط على التصفير.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetDatabase}
                  disabled={isResettingDb}
                  className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 text-rose-200 ${isResettingDb ? 'animate-spin' : ''}`} />
                  <span>{isResettingDb ? 'جاري تصفير النظام...' : 'تصفير وتهيئة قاعدة البيانات'}</span>
                </button>
              </div>
            </div>

            {/* SECURITY RECOMMENDATIONS */}
            <div className="bg-[#F7F5F0] border border-[#E5E1DA] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-serif font-bold text-[#1A1A1A]">
                <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
                توصيات الأمان والحفاظ على سلامة سجلات المنشأة (Best Practices):
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#6E6659]">
                <li className="flex items-start gap-2">
                  <span className="text-[#B8860B] font-bold">•</span>
                  <span>ينصح بتنفيذ تصدير دوري لملف JSON بنهاية كل أسبوع أو شهر وتخزينه في أقراص آمنة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B8860B] font-bold">•</span>
                  <span>صيغة JSON معتمدة ومطابقة لمعايير أرشفة البيانات المحاسبية.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B8860B] font-bold">•</span>
                  <span>يتم تسمية الملف المصدر تلقائياً باسم الشركة وتاريخ اليوم لسهولة الفهرسة والرجوع.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B8860B] font-bold">•</span>
                  <span>تتيح لك النسخ الاحتياطية سهولة إقفال السنة المالية ومشاركة البيانات مع المراجعين الخارجيين.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between bg-white border border-[#E5E1DA] p-4 rounded-lg shadow-xs">
          <div className="text-xs text-[#8C8273] font-serif italic">
            * يتم ترحيل التحديثات تلقائياً إلى كافة تقارير وفواتير وسندات النظام بعد الضغط على حفظ.
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 border border-[#1A1A1A] shadow-xs cursor-pointer disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4 text-[#D4AF37]" />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ بيانات وإعدادات الشركة'}</span>
          </button>
        </div>
      </form>

      {/* Render Database Setup Wizard Modal */}
      {isWizardOpen && (
        <DatabaseWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          currentCompany={formData as CompanyProfile}
          currency={formData.currency || 'KWD'}
          onComplete={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};
