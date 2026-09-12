import React, { useState } from 'react';
import {
  Download,
  FolderUp,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database,
  ArrowRight,
  HardDrive,
  Copy,
  CheckCheck,
  History,
  Lock,
  Sparkles,
  FileCode,
  Info,
  Check,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { CompanyProfile, SystemUser } from '../types.js';
import { ExcelBackupService } from '../services/excelBackupService.ts';
import { importBackupWithStrictAutoProvisioning, ImportReport } from '../services/importBackupService.ts';
import { CompanyJsonBackupService } from '../services/companyJsonBackupService.js';
import { getStandardErpJsonSchema, getStandardErpJsonTemplate } from '../services/standardJsonSchemaService.ts';
import { localDataStore, DataService } from '../services/dataService.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { supabase, resolveToSupabaseCompanyUUID } from '../services/supabaseClient.js';

interface UnifiedBackupRestoreHubProps {
  company: CompanyProfile;
  currentUser: SystemUser | null;
  currency: string;
  onRefreshAll: (silent?: boolean) => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

export const UnifiedBackupRestoreHub: React.FC<UnifiedBackupRestoreHubProps> = ({
  company,
  currentUser,
  currency,
  onRefreshAll,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'restore' | 'schema' | 'export' | 'reset'>('restore');

  // Export states
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Restore states
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');

  // Schema states
  const [isCopiedSchema, setIsCopiedSchema] = useState(false);
  const [isCopiedTemplate, setIsCopiedTemplate] = useState(false);

  // General feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    details?: string[];
  } | null>(null);

  // Database statistics
  const accountsCount = localDataStore.getAccounts().length;
  const journalsCount = localDataStore.getJournals().length;
  const invoicesCount = localDataStore.getInvoices().length;
  const vouchersCount = localDataStore.getVouchers().length;
  const customersCount = localDataStore.getCustomers().length;
  const suppliersCount = localDataStore.getSuppliers().length;
  const inventoryCount = localDataStore.getInventory().length;
  const warehousesCount = localDataStore.getWarehouses().length;

  // 1. Export Full System JSON Backup
  const handleExportJson = async () => {
    setIsExportingJson(true);
    setFeedback(null);
    try {
      const currentCompanyId = resolveToSupabaseCompanyUUID(company.id) || company.id;

      const [accounts, customers, suppliers, inventory, journals, invoices, vouchers] = await Promise.all([
        supabase.from('chart_of_accounts').select('*').eq('company_id', currentCompanyId),
        supabase.from('customers').select('*').eq('company_id', currentCompanyId),
        supabase.from('suppliers').select('*').eq('company_id', currentCompanyId),
        supabase.from('inventory_items').select('*').eq('company_id', currentCompanyId),
        supabase.from('journal_entries').select('*, journal_entry_lines(*)').eq('company_id', currentCompanyId),
        supabase.from('invoices').select('*, invoice_items(*)').eq('company_id', currentCompanyId),
        supabase.from('payment_vouchers').select('*').eq('company_id', currentCompanyId),
      ]);

      const fullBackup = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        company,
        users: localDataStore.getUsers(),
        accounts: (accounts.data && accounts.data.length > 0) ? accounts.data : localDataStore.getAccounts(),
        customers: (customers.data && customers.data.length > 0) ? customers.data : localDataStore.getCustomers(),
        suppliers: (suppliers.data && suppliers.data.length > 0) ? suppliers.data : localDataStore.getSuppliers(),
        inventory: (inventory.data && inventory.data.length > 0) ? inventory.data : localDataStore.getInventory(),
        journals: (journals.data && journals.data.length > 0) ? journals.data : localDataStore.getJournals(),
        invoices: (invoices.data && invoices.data.length > 0) ? invoices.data : localDataStore.getInvoices(),
        vouchers: (vouchers.data && vouchers.data.length > 0) ? vouchers.data : localDataStore.getVouchers(),
        units: localDataStore.getUnits(),
        warehouses: localDataStore.getWarehouses(),
        warehouseStocks: localDataStore.getWarehouseStocks(),
        salesReps: localDataStore.getSalesReps(),
        productionOrders: localDataStore.getProductionOrders(),
        quotations: localDataStore.getQuotations(),
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(fullBackup, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const cleanName = (company.nameAr || 'Logix_ERP').replace(/[\s/\\?%*:|"<>]+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `LOGIX_BACKUP_${cleanName}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFeedback({
        type: 'success',
        title: 'تم تصدير النسخة الاحتياطية بنجاح تام',
        message: `تم إنشاء وتحميل ملف JSON متكامل يضم ${fullBackup.journals.length} قيد يومية، و ${fullBackup.invoices.length} فاتورة، و ${fullBackup.inventory.length} صنف مخزني وفق أعلى معايير الحفظ والأمان.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'تعذر تصدير النسخة الاحتياطية',
        message: err.message || 'حدث خطأ غير متوقع أثناء استخراج البيانات.',
      });
    } finally {
      setIsExportingJson(false);
    }
  };

  // 2. Export Full System Excel Backup
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    setFeedback(null);
    try {
      await ExcelBackupService.exportFullSystemBackupToExcel();
      setFeedback({
        type: 'success',
        title: 'تم تصدير نسخة الإكسيل الشاملة بنجاح',
        message: 'تم توليد مصنف Excel متعدد أوراق العمل يضم الحسابات، القيود، الفواتير، المخزون، والعملاء والموردين.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'تعذر تصدير نسخة الإكسيل',
        message: err.message || 'حدث خطأ أثناء بناء ملف الإكسيل.',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 3. Execute Safe Smart Restore with Auto-provisioning
  const handleExecuteRestore = async (jsonStringInput?: string) => {
    const rawContent = jsonStringInput || jsonText;
    if (!rawContent || !rawContent.trim()) {
      setFeedback({
        type: 'error',
        title: 'بيانات غير متوفرة',
        message: 'يرجى اختيار ملف JSON أو لصق محتوى البيانات في الصندوق أدناه.',
      });
      return;
    }

    setIsRestoring(true);
    setRestoreProgress('بدء فحص وتدقيق بنية الملف وتطبيق معايير IFRS المحاسبية...');
    setImportReport(null);
    setFeedback(null);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr: any) {
        throw new Error(`الملف المرفق ليس بصيغة JSON صحيحة: ${parseErr.message}`);
      }

      setRestoreProgress('استيراد البيانات مع التوليد التلقائي للكيانات المفقودة وموازنة القيود...');
      const targetCompanyId = resolveToSupabaseCompanyUUID(company.id) || company.id;

      const report = await importBackupWithStrictAutoProvisioning(parsed, targetCompanyId);
      setImportReport(report);

      if (!report.success) {
        throw new Error(report.errors[0] || 'فشلت معالجة استعادة البيانات.');
      }

      setRestoreProgress('تحديث المؤشرات المالية ومزامنة شجرة الحسابات...');
      await onRefreshAll();

      setFeedback({
        type: 'success',
        title: 'تمت الاستعادة بنجاح مع الاستكمال الذكي للبيانات (Auto-provisioning Success)',
        message: report.message,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'فشلت عملية الاستعادة',
        message: err.message || 'حدث خطأ غير متوقع أثناء استعادة البيانات.',
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonText(content);
        await handleExecuteRestore(content);
      }
    };
    reader.onerror = () => {
      setFeedback({
        type: 'error',
        title: 'خطأ في قراءة الملف',
        message: 'تعذر قراءة ملف النسخة الاحتياطية من القرص المحلي.',
      });
    };
    reader.readAsText(file);
  };

  // 1-Click Restore Al-Waleed Mill Preset
  const handleRestoreAlWaleedPreset = async () => {
    setIsRestoring(true);
    setRestoreProgress('جاري جلب واستعادة قاعدة بيانات مطحنة الوليد المعتمدة...');
    setFeedback(null);
    setImportReport(null);
    try {
      const res = await CompanyJsonBackupService.restoreAlWaleedMillPreset(company.id);
      if (res.success) {
        await onRefreshAll();
        setFeedback({
          type: 'success',
          title: 'تمت استعادة قاعدة بيانات شركة مطحنة الوليد بنجاح تام',
          message: res.message,
        });
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'تعذر استعادة قاعدة بيانات مطحنة الوليد',
        message: err.message || 'حدث خطأ أثناء استعادة بيانات النموذج.',
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  // Download Standard Template
  const handleDownloadStandardTemplate = () => {
    const template = getStandardErpJsonTemplate();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(template, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'LOGIX_ERP_STANDARD_TEMPLATE.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setFeedback({
      type: 'info',
      title: 'تم تنزيل النموذج القياسي المكتمل',
      message: 'تم حفظ ملف LOGIX_ERP_STANDARD_TEMPLATE.json متضمناً كافة الجداول والحقول المطلوبة.',
    });
  };

  const copySchemaJson = () => {
    const schema = getStandardErpJsonSchema();
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    setIsCopiedSchema(true);
    setTimeout(() => setIsCopiedSchema(false), 2500);
  };

  const copyTemplateJson = () => {
    const template = getStandardErpJsonTemplate();
    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    setIsCopiedTemplate(true);
    setTimeout(() => setIsCopiedTemplate(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner - Clean Modern Light Architecture */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>المركز الموحد الحصري للنسخ والأرشفة (Single Canonical Backup Center)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            مركز النسخ الاحتياطي والاستعادة والمخطط القياسي
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            المدخل الوحيد والمعتمد في منظومة لوجيكس لإدارة كافة عمليات النسخ الاحتياطي، الاستيراد بالمعالجة الذكية والاستكمال الآلي للبيانات المفقودة، وتنزيل مخطط JSON القياسي المعتمد (Draft-07).
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-center text-xs w-full md:w-auto">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[100px]">
            <span className="text-slate-500 block text-[11px] font-medium">قيود اليومية</span>
            <span className="text-lg font-bold font-mono text-slate-900">{journalsCount}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[100px]">
            <span className="text-slate-500 block text-[11px] font-medium">الفواتير</span>
            <span className="text-lg font-bold font-mono text-slate-900">{invoicesCount}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[100px]">
            <span className="text-slate-500 block text-[11px] font-medium">الأصناف</span>
            <span className="text-lg font-bold font-mono text-slate-900">{inventoryCount}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[100px]">
            <span className="text-slate-500 block text-[11px] font-medium">الحسابات</span>
            <span className="text-lg font-bold font-mono text-slate-900">{accountsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-print">
        <button
          type="button"
          onClick={() => setActiveTab('restore')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'restore'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderUp className="w-4 h-4 text-emerald-400" />
          <span>الاستعادة الذكية (Auto-Provisioning Restore)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'schema'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-4 h-4 text-blue-400" />
          <span>مخطط JSON ونموذج البيانات القياسي (Schema & Template)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'export'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>تصدير النسخ الاحتياطية (JSON & Excel)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onNavigateTab) {
              onNavigateTab('system-reset');
            } else {
              setActiveTab('reset');
            }
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reset'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-rose-700 hover:bg-rose-50'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>تصفير وتهيئة الدورة (System Reset)</span>
        </button>
      </div>

      {/* Feedback Alert Box */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-sm">{feedback.title}</h4>
            <p className="leading-relaxed">{feedback.message}</p>
            {feedback.details && feedback.details.length > 0 && (
              <ul className="list-disc list-inside mt-2 space-y-0.5 text-[11px] font-medium">
                {feedback.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: SMART RESTORE & AUTO-PROVISIONING */}
      {activeTab === 'restore' && (
        <div className="space-y-6">
          {/* Feature highlights callout */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-2 text-xs text-emerald-950">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>المرونة الذكية والاستكمال الآلي (Smart Auto-Provisioning & Fallback Values)</span>
            </div>
            <p className="leading-relaxed text-emerald-800">
              يقبل النظام الآن أي ملف JSON لمعالجة الفواتير والقيود والسندات حتى لو كانت هناك حقول أو أكواد أو حسابات مفقودة. يقوم النظام تلقائياً بإنشاء عملاء افتراضيين، موردين افتراضيين، وأصناف افتراضية لربط العمليات فورياً وموازنة القيود غير المتوازنة عبر حساب تسويات القيود (3999) دون توقف أو رفض للملف، مع إمكانية تعديل هذه البيانات الافتراضية لاحقاً من الشاشات المخصصة.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Box */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FolderUp className="w-4 h-4 text-emerald-600" />
                  <span>تغذية ملف النسخة الاحتياطية (JSON)</span>
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      inputMode === 'file' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    رفع ملف
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      inputMode === 'text' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    لصق كود JSON
                  </button>
                </div>
              </div>

              {inputMode === 'file' ? (
                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-emerald-50/20">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-xs mb-3">
                    <FolderUp className={`w-7 h-7 ${isRestoring ? 'animate-spin' : ''}`} />
                  </div>
                  <span className="text-sm font-bold text-slate-900 mb-1">
                    {isRestoring ? (restoreProgress || 'جاري استيراد ومعالجة البيانات...') : 'اضغط لاختيار ملف JSON أو اسحبه هنا'}
                  </span>
                  <span className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    يدعم جميع ملفات JSON المصدّرة من لوجيكس أو من أي نظام محاسبي خارجي مع التدقيق المحاسبي المزدوج.
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    disabled={isRestoring}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder='{"version": "2.0.0", "accounts": [...], "invoices": [...]}'
                    className="w-full font-mono text-xs p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleExecuteRestore()}
                    disabled={isRestoring || !jsonText.trim()}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'جاري معالجة الكود...' : 'بدء الاستيراد والمعالجة الذكية'}</span>
                  </button>
                </div>
              )}

              {/* Verified Al-Waleed Mill Preset Option */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <span className="font-bold text-slate-900 block">نسخة شركة مطحنة الوليد المعتمدة:</span>
                  <span>قاعدة بيانات تجريبية متكاملة تضم شجرة الحسابات والقيود والفواتير والمخزون.</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreAlWaleedPreset}
                  disabled={isRestoring}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>استعادة قاعدة مطحنة الوليد فورياً</span>
                </button>
              </div>
            </div>

            {/* Summary & Fallback Report Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>تقرير الاستيراد والكيانات التلقائية</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    نتائج فحص البيانات والكيانات التي تم توليدها بالقيم الافتراضية.
                  </p>
                </div>

                {importReport ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">الحسابات المستوردة</span>
                        <span className="text-base font-bold font-mono text-slate-900">{importReport.stats?.accounts || 0}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">القيود اليومية</span>
                        <span className="text-base font-bold font-mono text-slate-900">{importReport.stats?.journals || 0}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">الفواتير المعالجة</span>
                        <span className="text-base font-bold font-mono text-slate-900">{importReport.stats?.invoices || 0}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">أصناف المخزون</span>
                        <span className="text-base font-bold font-mono text-slate-900">{importReport.stats?.inventory || 0}</span>
                      </div>
                    </div>

                    {importReport.fallbackStats && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px] text-amber-950">
                        <span className="font-bold flex items-center gap-1 text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>البيانات الافتراضية المنشأة تلقائياً:</span>
                        </span>
                        <div className="grid grid-cols-2 gap-1 font-semibold text-amber-900">
                          <span>• عملاء افتراضيون: {importReport.fallbackStats.customersAutoCreated}</span>
                          <span>• موردون افتراضيون: {importReport.fallbackStats.suppliersAutoCreated}</span>
                          <span>• أصناف افتراضية: {importReport.fallbackStats.itemsAutoCreated}</span>
                          <span>• قيود متوازنة آلياً: {importReport.fallbackStats.journalsAutoBalanced}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <FileJson className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs">لم يتم تنفيذ عملية استيراد في الجلسة الحالية بعد.</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                <span className="font-bold text-slate-900 block mb-1">الضمان المحاسبي المعياري:</span>
                كافة العمليات تخضع للتحقق المزدوج الفوري، وتُرحل القيود متوازنة بدقة وفق معايير المحاسبة الدولية IFRS.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STANDARD SCHEMA & TEMPLATE DOWNLOAD */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <span>مخطط بيانات JSON القياسي المعتمد (Draft-07 Schema & Template)</span>
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                المخطط الرسمي لنظام لوجيكس المحاسبي المتوافق مع معايير IFRS. يحدد مصفوفة الجداول، المفاتيح الأساسية والأجنبية، القيود المحاسبية، وتنسيق التواريخ والعملات.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadStandardTemplate}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل نموذج JSON القياسي (Template)</span>
              </button>
              <button
                type="button"
                onClick={copySchemaJson}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isCopiedSchema ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{isCopiedSchema ? 'تم نسخ المخطط!' : 'نسخ Schema'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                شجرة الحسابات (accounts)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل الحقول: code (رقم الحساب الفريد)، nameAr (اسم الحساب)، type (الأصول، الخصوم، الملكية، الإيرادات، المصروفات).
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                فواتير المبيعات والمشتريات (invoices)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل: invoiceNumber، type (SALES / PURCHASE)، customerId / supplierId، subtotal، taxTotal، totalAmount، items.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                قيود اليومية المزدوجة (journals)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل: entryNumber، date، lines (accountId، debit، credit، description)، ويشترط التوازن التام بين المدين والدائن.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                أصناف المخزون (inventory)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل: itemCode، nameAr، currentStock، averageCost، sellingPrice، unit، inventoryAccountId، cogsAccountId.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                العملاء والموردون (customers & suppliers)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل: code، nameAr، phone، currentBalance، accountId للربط المحاسبي التلقائي في الأستاذ العام.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                سندات القبض والصرف (vouchers)
              </span>
              <p className="text-[11px] text-slate-600">
                تشمل: voucherNumber، type (RECEIPT / PAYMENT)، amount، paymentMethod (CASH / BANK)، accountId.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 font-mono text-xs overflow-x-auto max-h-72 border border-slate-800">
            <pre className="whitespace-pre leading-relaxed text-cyan-300">
              {JSON.stringify(getStandardErpJsonSchema(), null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT JSON & EXCEL */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Export Full JSON */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-400 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <FileJson className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  تصدير نسخة احتياطية شاملة (JSON)
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  تنزيل ملف بيانات مشفر ومكتمل يتضمن شجرة الحسابات، قيود اليومية، الفواتير، السندات، المخزون، والعملاء والموردين.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-900 block">ضمان الجودة والسلامة:</span>
                <p>الملف متوافق مع معايير IFRS ومعتمد للاستعادة الفورية وإقفال الدورات المالية.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={isExportingJson}
              className="w-full mt-6 py-3 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-black shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <Download className={`w-4 h-4 text-amber-400 ${isExportingJson ? 'animate-bounce' : ''}`} />
              <span>{isExportingJson ? 'جاري تجهيز وتنزيل الملف...' : 'تصدير نسخة JSON الآن'}</span>
            </button>
          </div>

          {/* Card 2: Export Full Excel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-emerald-500 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  تصدير نسخة إكسيل شاملة (Excel)
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  توليد مصنف إكسيل تفصيلي متعدد الصفحات يضم كافة الجداول المحاسبية والتجارية للمراجعة والتدقيق الخارجي.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-900 block">محتويات المصنف:</span>
                <p>أوراق عمل منفصلة للأستاذ العام، ميزان المراجعة، الفواتير، كروت الأصناف، وأرصدة العملاء والموردين.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="w-full mt-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-emerald-800 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className={`w-4 h-4 text-emerald-200 ${isExportingExcel ? 'animate-bounce' : ''}`} />
              <span>{isExportingExcel ? 'جاري بناء المصنف...' : 'تصدير مصنف Excel كامل'}</span>
            </button>
          </div>

          {/* Card 3: Download SQL Script */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-blue-500 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  اسكربت ترحيل SQL السحابي (PostgreSQL)
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  تنزيل ملف SQL كامل لتنفيذه مباشرة في Supabase SQL Editor لإنشاء الجداول والفهارس وترحيل البيانات دون فقدان.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-900 block">بيانات نموذج الوليد:</span>
                <p>يتضمن ملف alwaleed_mill_import.sql المهيأ للسحابة لإنشاء البيانات والقيود بدقة.</p>
              </div>
            </div>

            <a
              href="/alwaleed_mill_import.sql"
              download="alwaleed_mill_import.sql"
              className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-900 shadow-xs cursor-pointer transition-all text-center"
            >
              <Download className="w-4 h-4 text-cyan-300" />
              <span>تنزيل ملف alwaleed_mill_import.sql</span>
            </a>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM RESET DELEGATION */}
      {activeTab === 'reset' && (
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-base">
            <RotateCcw className="w-5 h-5 text-rose-600" />
            <span>المدخل الموحد لتصفير وتهيئة دورة النظام (System Cycle Reset)</span>
          </div>
          <p className="text-slate-600 leading-relaxed max-w-2xl">
            يتم إدارة وتنفيذ كافة عمليات تصفير الحركات وإغلاق السنة المالية وبدء دورة محاسبية جديدة حصرياً عبر شاشة تهيئة وتصفير النظام الموحدة، والمؤمنة بكلمة مرور التأكيد ونسخ الأمان التلقائي.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('system-reset')}
              className="px-5 py-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الانتقال فوراً إلى شاشة تصفير دورة النظام المعتمدة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
