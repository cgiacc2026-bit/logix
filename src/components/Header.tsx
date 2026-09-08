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
    <header className="bg-[#0B192C] text-white border-b border-[#1E3E62] sticky top-0 z-40 px-3 sm:px-6 py-2 shadow-sm no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & System Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white border border-blue-400/40 shadow-2xs shrink-0">
            <Landmark className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                لوجيكس ERP | LOGIX
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.2 text-[9px] font-bold bg-blue-500/20 text-cyan-300 border border-blue-400/40 rounded-full items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-400" /> IFRS
              </span>
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-2 truncate">
              <span className="flex items-center gap-1 font-medium text-slate-200 truncate">
                <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="truncate">{company?.nameAr || 'مطحنة الوليد المتحده'}</span>
              </span>
              <span className="hidden md:inline-block text-[10px] font-mono bg-slate-800/80 px-1.5 py-0.2 rounded text-slate-300 border border-slate-700 shrink-0">
                س.ت: {company?.crNumber || '450912'}
              </span>
            </p>
          </div>
        </div>

        {/* System Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud Database Connected Status Badge */}
          <div
            title="سحابة Supabase متصلة ومزامنة للبيانات المحاسبية الفورية"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold shadow-2xs"
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>سحابي متصل</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>

          {/* Full System Excel Backup Export Button */}
          <button
            onClick={handleExcelBackup}
            disabled={isExcelExporting}
            title="تصدير وتحميل نسخة احتياطية شاملة لجميع بيانات النظام بالكامل في ملف Excel"
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 border border-emerald-400/40 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-100 ${isExcelExporting ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isExcelExporting ? 'جاري التجهيز...' : 'نسخة Excel'}</span>
            <span className="sm:hidden">Excel</span>
          </button>

          {/* Quick Backup Export to JSON */}
          <button
            onClick={handleQuickBackup}
            disabled={isExporting}
            title="تحميل وتصدير نسخة احتياطية كاملة من قاعدة البيانات بصيغة JSON"
            className="hidden md:flex px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold items-center gap-1 border border-slate-600 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Download className={`w-3 h-3 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>JSON</span>
          </button>

          {/* Company Setup Button */}
          <button
            onClick={onOpenCompanySetup}
            title="إعدادات المنشأة وبيانات الترخيص والضريبة"
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 border border-blue-400/40 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline">الإعدادات</span>
          </button>

          {/* Currency Selector */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-0.5 text-xs shrink-0">
            <span className="hidden md:inline text-slate-400 font-semibold text-[11px]">العملة:</span>
            <select
              value={currency || 'SAR'}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-slate-900 border-none rounded px-1 py-0.5 font-bold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="SAR">SAR (ر.س)</option>
              <option value="KWD">KWD (د.ك)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="EGP">EGP (ج.م)</option>
              <option value="QAR">QAR (ر.ق)</option>
              <option value="BHD">BHD (د.ب)</option>
              <option value="OMR">OMR (ر.ع)</option>
              <option value="JOD">JOD (د.أ)</option>
            </select>
          </div>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2 mr-0.5 shrink-0">
              <div
                title={`${currentUser.name} - ${currentUser.roleTitleAr}`}
                className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2 py-0.5"
              >
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-cyan-300 font-bold text-[10px] flex items-center justify-center border border-blue-400/30 shrink-0">
                  {currentUser.name.slice(0, 1)}
                </div>
                <div className="text-right leading-tight hidden lg:block">
                  <div className="text-xs font-bold text-slate-100 truncate max-w-[90px]">{currentUser.name}</div>
                  <div className="text-[9px] text-cyan-400 truncate max-w-[90px]">{currentUser.roleTitleAr}</div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="تسجيل الخروج والعودة لشاشة الدخول"
                  className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 transition-all cursor-pointer flex items-center gap-1 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[11px]">خروج</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
