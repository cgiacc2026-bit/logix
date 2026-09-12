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
} from 'lucide-react';
import { CompanyJsonBackupService } from '../services/companyJsonBackupService.js';
import { ERPBackupImportService, ImportProgress } from '../services/importBackupService.js';
import { localDataStore } from '../services/dataService.js';

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
    cloudSyncNotice?: string;
  } | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'restore' | 'export' | 'zero'>('restore');

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
        text: `تم تحميل الملف "${file.name}" بنجاح (${(file.size / 1024).toFixed(1)} KB). انقر على "تأكيد واستعادة البيانات" لحفظها سحابياً ومحلياً.`,
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
    setProcessingStage('تهيئة استيراد البيانات الآمن...');
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
          cloudSyncNotice: `تم رفع السجلات بنجاح وارتباطها بالشركة ${activeTenantId}`,
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
    setSyncDetails(null);

    try {
      const alwaleedJson = CompanyJsonBackupService.getAlWaleedMillPresetBackupJson();
      const activeTenantId = targetCompanyId.includes('alwaleed') ? targetCompanyId : currentCompanyId;

      const result = await ERPBackupImportService.importCompanyJsonData(
        activeTenantId,
        alwaleedJson,
        (progress) => {
          setImportProgress(progress);
          setProcessingStage(progress.message);
        }
      );

      setIsProcessing(false);
      setProcessingStage('');

      if (result.success) {
        setJsonText(alwaleedJson);
        setFileName('AlWaleed_Mill_Verified_Backup_2026.json');
        setSyncDetails({
          cloudSynced: true,
          stats: result.stats,
          cloudSyncNotice: `تم رفع السجلات المرجعية وارتباطها بالشركة ${activeTenantId}`,
        });
        setFeedback({
          type: 'success',
          text: `تمت استعادة آخر شغل مدخل لمطحنة الوليد بنجاح! السجلات متطابقة على جميع الأجهزة.`,
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
        text: 'تم توليد وتنزيل ملف النسخة الاحتياطية JSON بنجاح إلى جهازك من قاعدة البيانات سحابياً!',
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: `فشل تصدير النسخة الاحتياطية: ${e?.message || 'خطأ غير معروف'}`,
      });
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                منظومة النسخ والاستعادة السحابية عبر JSON
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono">
                  LOGIX JSON Engine
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                استعادة آخر شغل مدخل، تصدير ملفات JSON، وتصفير قواعد بيانات الشركات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Company Selector (for Admin) */}
        <div className="px-6 py-3 bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>المنشأة المستهدفة للعمليات:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTargetCompanyId('company-logix-official-001')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetCompanyId === 'company-logix-official-001'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              🏢 شركة لوجيكس الرسمية (فارغة)
            </button>
            <button
              onClick={() => setTargetCompanyId('company-demo-clients-002')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetCompanyId === 'company-demo-clients-002'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              🧪 شركة ديمو للعملاء
            </button>
            <button
              onClick={() => setTargetCompanyId('company-alwaleed-client-003')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetCompanyId === 'company-alwaleed-client-003'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              🏭 شركة مطحنة الوليد (عميل مسجل)
            </button>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="px-6 pt-4 flex border-b border-slate-800 gap-4">
          <button
            onClick={() => { setActiveTab('restore'); setFeedback(null); }}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'restore'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            استعادة من ملف JSON
          </button>
          <button
            onClick={() => { setActiveTab('export'); setFeedback(null); }}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Download className="w-4 h-4" />
            تصدير نسخة احتياطية JSON
          </button>
          <button
            onClick={() => { setActiveTab('zero'); setFeedback(null); }}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'zero'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            تصفير شامل للمنشأة
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Active Processing / Cloud Sync Progress Banner */}
          {isProcessing && (
            <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                <div className="text-sm font-medium">
                  {processingStage || 'جاري المعالجة والمزامنة السحابية...'}
                </div>
              </div>
              {importProgress && importProgress.total > 0 && (
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2.5 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, (importProgress.current / importProgress.total) * 100))}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && !isProcessing && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : feedback.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              )}
              <div className="text-sm leading-relaxed">{feedback.text}</div>
            </div>
          )}

          {/* Cloud Sync Details Breakdown Card */}
          {syncDetails && syncDetails.stats && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs border-b border-emerald-500/20 pb-2">
                <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  حالة المزامنة السحابية المباشرة (Supabase Cloud Sync)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  متطابق سحابياً مع جميع الأجهزة
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    الأصناف:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.inventory}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    الفواتير:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.invoices}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    السندات:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.vouchers}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    القيود اليومية:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.journals}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    العملاء:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.customers}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-orange-400" />
                    الموردون:
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.suppliers}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between col-span-2">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    دليل الحسابات (شجرة):
                  </span>
                  <span className="font-bold text-white font-mono">{syncDetails.stats.accounts} حساب</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: RESTORE FROM JSON */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* Highlight Box for Al-Waleed Mill work */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    استعادة جاهزة بنقرة واحدة لآخر شغل مدخل لمطحنة الوليد
                  </div>
                  <p className="text-xs text-slate-400">
                    استرجاع الأصناف الـ 22 (بهارات، فلفل أسود، قرنفل)، الموردين، الجمعيات، وفواتير التوريد والتصنيع فوراً.
                  </p>
                </div>
                <button
                  onClick={handleLoadAlWaleedPreset}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  استعادة شغل مطحنة الوليد الآن
                </button>
              </div>

              {/* Upload File Zone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center transition-colors bg-slate-950/40">
                <input
                  type="file"
                  id="json-file-input"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="json-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-200">
                    انقر هنا لاختيار ملف JSON (.json) من جهازك
                  </span>
                  <span className="text-xs text-slate-400">
                    أو اسحب وأفلت الملف داخل هذه الخانة مباشرة
                  </span>
                  {fileName && (
                    <div className="mt-2 text-xs bg-indigo-900/40 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 font-mono">
                      الملف المختار: {fileName}
                    </div>
                  )}
                </label>
              </div>

              {/* Textarea for JSON Paste */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                  <span>أو الصق محتوى كود JSON هنا مباشرة:</span>
                  {jsonText && (
                    <button
                      onClick={() => setJsonText('')}
                      className="text-[11px] text-slate-400 hover:text-rose-400"
                    >
                      مسح النص
                    </button>
                  )}
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{"format": "LOGIX_ERP_BACKUP_V2026", "data": { ... }}'
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  dir="ltr"
                />
              </div>

              {/* Restore Submit Button */}
              <button
                onClick={handleRestore}
                disabled={isProcessing || !jsonText.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    تأكيد واستعادة البيانات إلى المنشأة المحددة
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: EXPORT JSON */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2 text-sm text-slate-300">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-400" />
                  تصدير نسخة احتياطية آمنة متكاملة
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  يقوم المحرك بتجميع كامل ملفات وبيانات المنشأة المحددة (دليل الحسابات، المخزون، الفواتير، قيود اليومية، العملاء، الموردين، أوامر التصنيع، وحدات القياس) وتغليفها في ملف JSON رسمي معتمد يمكن حفظه في جهازك أو رفعه لأي خادم سحابي.
                </p>
              </div>

              <button
                onClick={handleExport}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
              >
                <Download className="w-4 h-4" />
                تحميل ملف النسخة الاحتياطية الآن (.json)
              </button>
            </div>
          )}

          {/* TAB 3: ZERO-OUT (تصفير شامل) */}
          {activeTab === 'zero' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2 text-sm text-rose-200">
                <h4 className="font-bold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  تصفير وتطهير شامل لبيانات المنشأة (Clean Slate / Zero-Out)
                </h4>
                <p className="text-xs text-rose-300/80 leading-relaxed">
                  هذا الإجراء يُفرغ المنشأة المحددة تماماً ويعيد أرصدتها ومخزونها وفواتيرها وأوامر تشغيلها إلى صفر (0.00). يتم الحفاظ فقط على شجرة الحسابات IFRS ووحدات القياس لتكون جاهزة لبدء العمليات النظيفة.
                </p>
              </div>

              <button
                onClick={handleZeroOut}
                disabled={isProcessing}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                تصفير المنشأة بالكامل إلى الصفر (0.00)
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>نظام لوجيكس السحابي • محرك الاستعادة الآمن</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
