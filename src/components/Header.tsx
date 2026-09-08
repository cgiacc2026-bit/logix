import React, { useState } from 'react';
import {
  Building2,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Settings,
  Download,
  Cloud,
  CheckCircle2,
  FileSpreadsheet,
  LogOut,
  User,
} from 'lucide-react';
import { CompanyProfile, SystemUser } from '../types.js';
import { ExcelBackupService } from '../services/excelBackupService.ts';

interface HeaderProps {
  company: CompanyProfile | null;
  currency: string;
  setCurrency: (c: string) => void;
  onOpenCompanySetup: () => void;
  onOpenDiagnostics?: () => void;
  currentUser?: SystemUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  company,
  currency,
  setCurrency,
  onOpenCompanySetup,
  onOpenDiagnostics,
  currentUser,
  onLogout,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);

  const handleExcelBackup = async () => {
    setIsExcelExporting(true);
    try {
      await ExcelBackupService.exportFullSystemBackupToExcel();
    } catch (err: any) {
      console.error('Excel export error:', err);
      alert(err.message || 'تعذر تصدير نسخة الإكسيل الشاملة للنظام');
    } finally {
      setIsExcelExporting(false);
    }
  };

  const handleQuickBackup = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error('فشل في تصدير النسخة الاحتياطية');
      const backupData = await res.json();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const cleanName = (company?.nameAr || 'database').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `erp_backup_${cleanName}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(err.message || 'تعذر تحميل النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="bg-[#0B192C] text-white border-b border-[#1E3E62] sticky top-0 z-40 px-4 lg:px-8 py-3 shadow-md no-print">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white border border-blue-400/40 shadow-sm">
            <Landmark className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                لوجيكس ERP | LOGIX Enterprise System
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-cyan-300 border border-blue-400/40 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" /> معايير IFRS
              </span>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 font-medium text-slate-200">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                المنشأة الحالية: {company?.nameAr || 'مطحنة الوليد المتحده'}
              </span>
              <span className="text-[10px] font-mono bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                س.ت: {company?.crNumber || '450912'}
              </span>
            </p>
          </div>
        </div>

        {/* System Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Cloud Database Connected Status Badge */}
          <div
            title="سحابة Supabase متصلة ومزامنة للبيانات المحاسبية الفورية"
            className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-emerald-500/40 text-xs text-emerald-300 font-bold flex items-center gap-2 shadow-xs"
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">سحابة Supabase متصلة</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          {/* Full System Excel Backup Export Button */}
          <button
            onClick={handleExcelBackup}
            disabled={isExcelExporting}
            title="تصدير وتحميل نسخة احتياطية شاملة لجميع بيانات النظام بالكامل في ملف Excel متعدد الصفحات"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 border border-emerald-400/40 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-4 h-4 text-emerald-100 ${isExcelExporting ? 'animate-bounce' : ''}`} />
            <span>{isExcelExporting ? 'جاري تجهيز الإكسيل...' : 'نسخة احتياطية Excel (شاملة)'}</span>
          </button>

          {/* Quick Backup Export to JSON */}
          <button
            onClick={handleQuickBackup}
            disabled={isExporting}
            title="تحميل وتصدير نسخة احتياطية كاملة من قاعدة البيانات بصيغة JSON على جهاز الكمبيوتر"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-600 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isExporting ? 'جاري التنزيل...' : 'نسخة JSON'}</span>
          </button>

          {/* Company Setup Button */}
          <button
            onClick={onOpenCompanySetup}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 border border-blue-400/40 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span>إعدادات الشركة</span>
          </button>

          {/* Currency Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 font-semibold">العملة:</span>
            <select
              value={currency || 'SAR'}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-bold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="SAR">SAR (ر.س - ريال سعودي)</option>
              <option value="KWD">KWD (د.ك - دينار كويتي)</option>
              <option value="USD">USD ($ - دولار أمريكي)</option>
              <option value="EUR">EUR (€ - يورو)</option>
              <option value="AED">AED (د.إ - درهم إماراتي)</option>
              <option value="EGP">EGP (ج.م - جنيه مصري)</option>
              <option value="QAR">QAR (ر.ق - ريال قطري)</option>
              <option value="BHD">BHD (د.ب - دينار بحريني)</option>
              <option value="OMR">OMR (ر.ع - ريال عماني)</option>
              <option value="JOD">JOD (د.أ - دينار أردني)</option>
            </select>
          </div>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 border-r border-slate-700 pr-2.5 mr-1">
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center border border-blue-400/30">
                  {currentUser.name.slice(0, 1)}
                </div>
                <div className="text-right leading-tight">
                  <div className="text-xs font-bold text-slate-100">{currentUser.name}</div>
                  <div className="text-[10px] text-cyan-400">{currentUser.roleTitleAr}</div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="تسجيل الخروج والعودة لشاشة الدخول"
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 transition-all cursor-pointer flex items-center gap-1 text-xs font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">خروج</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
