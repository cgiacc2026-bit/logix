import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  Building2,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Cloud,
  ShieldCheck,
  RefreshCw,
  Boxes,
  Receipt,
  BookOpen,
  Users,
  Code2,
  Check,
  Copy,
  Info,
  Wand2,
  HelpCircle
} from 'lucide-react';
import { CompanyJsonBackupService } from '../services/companyJsonBackupService.js';
import { ERPBackupImportService, ImportProgress, FallbackStats } from '../services/importBackupService.js';
import { localDataStore } from '../services/dataService.js';
import { LOGIX_ERP_JSON_SCHEMA, getSampleStandardBackup } from '../services/standardJsonSchemaService.js';

interface JsonBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyId: string;
  currentCompanyName: string;
  isSuperAdmin: boolean;
  onDataRestored: () => void;
}

export const JsonBackupRestoreModal: React.FC<JsonBackupRestoreModalProps> = ({
  isOpen,
  onClose,
  currentCompanyId,
  currentCompanyName,
  isSuperAdmin,
  onDataRestored,
}) => {
  const [targetCompanyId, setTargetCompanyId] = useState<string>(currentCompanyId);
  const [jsonText, setJsonText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [syncDetails, setSyncDetails] = useState<{
    cloudSynced: boolean;
    stats?: {
      invoices?: number;
      inventory?: number;
      journals?: number;
      customers?: number;
      suppliers?: number;
      vouchers?: number;
      accounts?: number;
      productionOrders?: number;
    };
    fallbackStats?: FallbackStats;
    autoProvisionedDetails?: string[];
    cloudSyncNotice?: string;
  } | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'restore' | 'export' | 'schema' | 'zero'>('restore');
  const [copiedSchema, setCopiedSchema] = useState(false);

  if (!isOpen) return null;

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setSyncDetails(null);
      setFeedback({
        type: 'info',
        text: `تم تحميل الملف "${file.name}" بنجاح (${(file.size / 1024).toFixed(1)} KB). سيتكفل النظام تلقائياً بإنشاء أي بيانات ناقصة أو قيود محاسبية لازمة.`,
      });
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', text: 'فشل قراءة الملف، يرجى المحاولة مرة أخرى.' });
    };
    reader.readAsText(file);
  };

  // Perform Restore from JSON
  const handleRestore = async () => {
    if (!currentCompanyId) {
      setFeedback({ type: 'error', text: 'تنبيه أمني: لم يتم العثور على معرف الشركة في الجلسة الحالية. تم إيقاف العملية لمنع تداخل البيانات.' });
      return;
    }

    if (!jsonText.trim()) {
      setFeedback({ type: 'error', text: 'يرجى اختيار ملف JSON أو لصق محتوى الـ JSON أولاً.' });
      return;
    }

    setIsProcessing(true);
    setProcessingStage('تهيئة استيراد البيانات الذكي والاستكمال التلقائي...');
    setImportProgress(null);
    setFeedback(null);
    setSyncDetails(null);

    const activeTenantId = currentCompanyId;

    try {
      const result = await ERPBackupImportService.importCompanyJsonData(
        activeTenantId,
        jsonText,
        (progress) => {
          setImportProgress(progress);
          setProcessingStage(progress.message);
        }
      );
      setIsProcessing(false);
      setProcessingStage('');

      if (result.success) {
        setSyncDetails({
          cloudSynced: true,
          stats: result.stats,
          fallbackStats: result.fallbackStats,
          autoProvisionedDetails: result.autoProvisionedDetails,
          cloudSyncNotice: `تم حفظ ومزامنة السجلات سحابياً ومحلياً بنجاح وارتباطها بالمنشأة النشطة.`,
        });
        setFeedback({
          type: 'success',
          text: result.message,
        });
        onDataRestored();
      } else {
        setFeedback({
          type: 'error',
          text: result.message,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingStage('');
      setFeedback({
        type: 'error',
        text: `حدث خطأ أثناء الاستعادة: ${err?.message || 'خطأ غير متوقع'}`,
      });
    }
  };

  // Load Preset Al-Waleed Backup Work
  const handleLoadAlWaleedPreset = async () => {
    if (!currentCompanyId) {
      setFeedback({ type: 'error', text: 'تنبيه أمني: لم يتم العثور على معرف الشركة.' });
      return;
    }

    setIsProcessing(true);
    setProcessingStage('جاري تجهيز النسخة المرجعية لمطحنة الوليد...');
    setImportProgress(null);
    setFeedback(null);

    try {
      const res = await fetch('/data/alwaleed_mill_full_database.json');
      if (!res.ok) throw new Error('تعذر العثور على ملف النسخة الاحتياطية لمطحنة الوليد');
      const data = await res.text();
      setJsonText(data);
      setFileName('alwaleed_mill_full_database.json');

      const result = await ERPBackupImportService.importCompanyJsonData(
        currentCompanyId,
        data,
        (progress) => {
          setImportProgress(progress);
          setProcessingStage(progress.message);
        }
      );

      setIsProcessing(false);
      setProcessingStage('');

      if (result.success) {
        setSyncDetails({
          cloudSynced: true,
          stats: result.stats,
          fallbackStats: result.fallbackStats,
          autoProvisionedDetails: result.autoProvisionedDetails,
          cloudSyncNotice: `تمت استعادة وتثبيت شغل مطحنة الوليد المتحدة بنجاح (${result.acceptedTotal} سجل معتمد)`,
        });
        setFeedback({
          type: 'success',
          text: 'تمت استعادة بيانات مطحنة الوليد المتحدة بنجاح ومزامنتها سحابياً ومحلياً!',
        });
        onDataRestored();
      } else {
        setFeedback({
          type: 'error',
          text: result.message,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingStage('');
      setFeedback({
        type: 'error',
        text: `حدث خطأ أثناء تحميل البيانات المسبقة: ${err?.message || 'خطأ غير متوقع'}`,
      });
    }
  };

  // Export JSON Backup
  const handleExport = async () => {
    try {
      await CompanyJsonBackupService.exportCompanyDataAsync(targetCompanyId, currentCompanyName);
      setFeedback({
        type: 'success',
        text: 'تم توليد وتنزيل ملف النسخة الاحتياطية JSON بنجاح إلى جهازك وفق المعيار المحاسبي المعتمد!',
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: `فشل تصدير النسخة الاحتياطية: ${e?.message || 'خطأ غير معروف'}`,
      });
    }
  };

  // Download Sample Standard JSON Template
  const handleDownloadSampleTemplate = () => {
    const comp = localDataStore.getCompany();
    const sample = getSampleStandardBackup(comp);
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sample, null, 2))}`;
    const anchor = document.createElement('a');
    anchor.setAttribute('href', jsonStr);
    anchor.setAttribute('download', 'logix_erp_standard_template.json');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  // Copy Schema JSON
  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(LOGIX_ERP_JSON_SCHEMA, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  // Zero-Out Data
  const handleZeroOut = () => {
    if (!window.confirm('هل أنت متأكد من تصفير وتطهير كافة عمليات وأرصدة هذه المنشأة؟ سيتم تصفير المخزون والفواتير والقيود إلى صفر.')) {
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      CompanyJsonBackupService.zeroOutCompanyData(targetCompanyId);
      setIsProcessing(false);
      setFeedback({
        type: 'success',
        text: 'تم تصفير كافة أرصدة وعمليات المنشأة بنجاح. المنشأة الآن خالية تماماً ومصفرة (0.00).',
      });
      onDataRestored();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                منظومة النسخ والاستعادة والمعالجة الذكية لـ JSON
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                  Logix JSON Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                استيراد ذكي مرن، استكمال تلقائي للمفقودات، وتوليد قيود محاسبية متوازنة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="px-6 pt-3 flex border-b border-slate-200 gap-6 bg-slate-50/50">
          <button
            onClick={() => { setActiveTab('restore'); setFeedback(null); }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'restore'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            استعادة واستيراد ملف JSON
          </button>
          <button
            onClick={() => { setActiveTab('schema'); setFeedback(null); }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'schema'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            المخطط القياسي للبيانات (JSON Schema)
          </button>
          <button
            onClick={() => { setActiveTab('export'); setFeedback(null); }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            تصدير نسخة احتياطية JSON
          </button>
          <button
            onClick={() => { setActiveTab('zero'); setFeedback(null); }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'zero'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            تصفير المنشأة (Clean Slate)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active Processing / Cloud Sync Progress Banner */}
          {isProcessing && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                <div className="text-xs font-bold">
                  {processingStage || 'جاري المعالجة الذكية والمزامنة السحابية...'}
                </div>
              </div>
              {importProgress && importProgress.total > 0 && (
                <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, (importProgress.current / importProgress.total) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && !isProcessing && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : feedback.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-medium leading-relaxed">{feedback.text}</div>
            </div>
          )}

          {/* Cloud Sync & Fallback Breakdown Card */}
          {syncDetails && syncDetails.stats && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2.5">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  حالة الحفظ والاعتماد المحاسبي المباشر
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  محفوظ ومترابط محاسبياً
                </span>
              </div>

              {/* Standard Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Boxes className="w-3.5 h-3.5 text-blue-600" />
                    الأصناف:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.inventory}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    الفواتير:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.invoices}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    السندات:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.vouchers}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    القيود اليومية:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.journals}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    العملاء:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.customers}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-orange-600" />
                    الموردون:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.suppliers}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between col-span-2">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-700" />
                    دليل الحسابات (شجرة):
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{syncDetails.stats.accounts} حساب</span>
                </div>
              </div>

              {/* Auto-Provisioning & Fallback Values Report */}
              {syncDetails.fallbackStats && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                    <Wand2 className="w-4 h-4 text-emerald-600" />
                    تقرير المعالجة الذكية والاستكمال التلقائي (Auto-Provisioning):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">عملاء تم إنشاؤهم آلياً:</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.customersAutoCreated}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">موردين تم إنشاؤهم آلياً:</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.suppliersAutoCreated}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">أصناف تم إنشاؤها آلياً:</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.itemsAutoCreated}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">حسابات قياسية مزودة:</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.accountsAutoCreated}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">قيود متوازنة تم توليدها:</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.journalsAutoGenerated}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-emerald-900">قيود تمت موازنتها (3999):</span>
                      <span className="font-bold text-emerald-700 font-mono">{syncDetails.fallbackStats.journalsAutoBalanced}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    💡 ملاحظة: جميع الكيانات والبيانات الافتراضية أعلاه تم اعتمادها بنجاح دون رفض الملف، ويمكنك تعديل أسمائها وأسعارها وتفاصيلها في أي وقت من داخل شاشات النظام.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: RESTORE FROM JSON */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* Smart Auto-Provisioning Explainer Card */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Wand2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ميزة المعالجة الذكية والمرونة الفائقة (Smart Auto-Provisioning & Fallback Values)
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  يقبل النظام ملف JSON حتى لو كانت به بيانات ناقصة؛ إذا لم يتوفر حساب عميل أو مورد أو كود صنف، يقوم النظام تلقائياً بإنشاء كيانات افتراضية وتوليد قيود متوازنة فورياً لضمان معالجة الملف فوراً دون توقف أو رفض، مع إتاحة تعديلها لاحقاً من داخل النظام.
                </p>
              </div>

              {/* Preset Al-Waleed Quick Load Bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    استعادة قاعدة بيانات مطحنة الوليد المتحدة (أحدث نسخة كاملة)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    64 صنف بهارات ومواد غذائية، 61 قيد يومية متزن، 51 فاتورة، 10 سندات، و16 جمعية وعميل.
                  </p>
                </div>
                <button
                  onClick={handleLoadAlWaleedPreset}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  استعادة شغل مطحنة الوليد
                </button>
              </div>

              {/* Upload File Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="json-file-input"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="json-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    انقر هنا لاختيار ملف JSON (.json) من جهازك
                  </span>
                  <span className="text-[11px] text-slate-500">
                    أو اسحب وأفلت الملف داخل هذه الخانة مباشرة
                  </span>
                  {fileName && (
                    <div className="mt-1.5 text-xs bg-emerald-50 text-emerald-800 px-3 py-0.5 rounded-full border border-emerald-200 font-bold font-mono">
                      الملف المختار: {fileName}
                    </div>
                  )}
                </label>
              </div>

              {/* Textarea for JSON Paste */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>أو الصق محتوى كود JSON هنا مباشرة:</span>
                  {jsonText && (
                    <button
                      onClick={() => setJsonText('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      مسح النص
                    </button>
                  )}
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{"version": "2.5.0", "company": { ... }, "accounts": [...], "invoices": [...]}'
                  className="w-full h-28 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors resize-none leading-relaxed"
                  dir="ltr"
                />
              </div>

              {/* Restore Submit Button */}
              <button
                onClick={handleRestore}
                disabled={isProcessing || !jsonText.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    تأكيد واستعادة البيانات الذكية للمنشأة النشطة
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: SCHEMA & TEMPLATE */}
          {activeTab === 'schema' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <Code2 className="w-4 h-4 text-blue-600 shrink-0" />
                  المخطط المعياري المعتمد لبيانات لوجيكس ERP (JSON Schema Draft-07)
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  يحدد هذا المخطط الهيكل القياسي لتبادل البيانات بين الأنظمة الخارجية ونظام لوجيكس. يدعم استيراد وتصدير الحسابات، العملاء، الموردين، المخزون، الفواتير، السندات، والقيود اليومية.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadSampleTemplate}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل نموذج JSON القياسي المكتمل
                  </button>
                  <button
                    onClick={handleCopySchema}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSchema ? 'تم نسخ المخطط!' : 'نسخ كود المخطط (Schema)'}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">الإصدار: v2.5.0 Draft-07</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-100 font-mono text-[11px] p-3 max-h-64 overflow-y-auto" dir="ltr">
                <pre>{JSON.stringify(LOGIX_ERP_JSON_SCHEMA, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT JSON */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  تصدير نسخة احتياطية آمنة متكاملة
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يقوم المحرك بتجميع كامل ملفات وبيانات المنشأة المحددة (دليل الحسابات، المخزون، الفواتير، قيود اليومية، العملاء، الموردين، أوامر التصنيع، وحدات القياس) وتغليفها في ملف JSON رسمي معتمد يمكن حفظه في جهازك أو نقله لأي منشأة أخرى.
                </p>
              </div>

              <button
                onClick={handleExport}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                تحميل ملف النسخة الاحتياطية الآن (.json)
              </button>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">ملف قاعدة بيانات مطحنة الوليد المعتمدة بآخر التحديثات:</span>
                <a
                  href="/alwaleed_mill_latest_backup.json"
                  download="AlWaleed_Mill_Full_Database_2026.json"
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-300"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  تنزيل ملف مطحنة الوليد (.json)
                </a>
              </div>
            </div>
          )}

          {/* TAB 4: ZERO-OUT */}
          {activeTab === 'zero' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5 text-xs text-rose-900">
                <h4 className="font-bold text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  تصفير وتطهير شامل لبيانات المنشأة (Clean Slate / Zero-Out)
                </h4>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  هذا الإجراء يُفرغ المنشأة المحددة تماماً ويعيد أرصدتها ومخزونها وفواتيرها وأوامر تشغيلها إلى صفر (0.00). يتم الحفاظ فقط على شجرة الحسابات IFRS ووحدات القياس لتكون جاهزة لبدء العمليات النظيفة.
                </p>
              </div>

              <button
                onClick={handleZeroOut}
                disabled={isProcessing}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                تصفير المنشأة بالكامل إلى الصفر (0.00)
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">لوجيكس ERP • محرك المعالجة الذكية والترحيل المحاسبي الآمن</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
