import React, { useState, useEffect, useRef } from 'react';
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
  Compass,
  Sun,
  Moon,
  Palette,
  Check,
  Layers,
  ChevronDown,
  Wrench,
  FolderUp,
  Upload,
} from 'lucide-react';
import { CompanyProfile, SystemUser } from '../types.js';
import { ExcelBackupService } from '../services/excelBackupService.ts';
import { ThemeService, ERP_THEMES, ThemeColor, ThemeMode, useTheme } from '../services/themeService.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import { DataService } from '../services/dataService.ts';
import { useCompany } from '../contexts/CompanyContext.tsx';

interface HeaderProps {
  company: CompanyProfile | null;
  currency: string;
  setCurrency: (c: string) => void;
  onOpenCompanySetup: () => void;
  onOpenOnboardingGuide?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenSuperAdminPortal?: () => void;
  onOpenJsonBackup?: () => void;
  currentUser?: SystemUser | null;
  onLogout?: () => void;
  onSaveCompany?: (updated: CompanyProfile) => Promise<void> | void;
  onRefreshAll?: (silent?: boolean) => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  company,
  currency,
  setCurrency,
  onOpenCompanySetup,
  onOpenOnboardingGuide,
  onOpenDiagnostics,
  onOpenSuperAdminPortal,
  onOpenJsonBackup,
  currentUser,
  onLogout,
  onSaveCompany,
  onRefreshAll,
}) => {
  let companyContext: any = null;
  try {
    companyContext = useCompany();
  } catch {
    // fallback if rendered outside provider
  }
  const activeCompany = companyContext?.currentCompany || resolveActiveCompany(company);
  const effectiveCurrency = companyContext?.currency || activeCompany.functionalCurrency || activeCompany.currency || currency || 'KWD';

  const handleCurrencyChange = (newCurr: string) => {
    if (companyContext?.setCurrency) {
      companyContext.setCurrency(newCurr);
    }
    if (setCurrency) {
      setCurrency(newCurr);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteMenuRef = useRef<HTMLDivElement>(null);

  const handleImmediateRepair = async () => {
    setIsRepairing(true);
    try {
      const res = await DataService.executeImmediateRepairAndDeduplication();
      if (onRefreshAll) {
        await onRefreshAll(true);
      }
      setRepairNotice(res.message);
      setTimeout(() => setRepairNotice(null), 6000);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إجراء الإصلاح الفوري');
    } finally {
      setIsRepairing(false);
    }
  };

  const {
    themeColor: currentThemeColor,
    themeMode: currentThemeMode,
    effectiveMode,
    activePalette,
    setThemeColor,
    setThemeMode,
  } = useTheme(company);

  // Close palette menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paletteMenuRef.current && !paletteMenuRef.current.contains(event.target as Node)) {
        setIsPaletteOpen(false);
      }
    };
    if (isPaletteOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPaletteOpen]);

  const handleSelectTheme = (modeKey: ThemeMode) => {
    setThemeMode(modeKey);
    setIsPaletteOpen(false);
    if (company && onSaveCompany) {
      onSaveCompany({ ...company, themeMode: modeKey });
    }
  };

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
    <header
      style={{ backgroundColor: activePalette.headerBg, borderColor: activePalette.headerBorder }}
      className="text-white border-b sticky top-0 z-40 px-3 sm:px-6 py-2 shadow-sm no-print transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & System Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white border border-white/20 shadow-2xs shrink-0"
            style={{ backgroundColor: activePalette.primaryColor }}
          >
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                لوجيكس ERP | LOGIX
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.2 text-[9px] font-bold bg-white/10 text-white/90 border border-white/20 rounded-full items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-300" /> IFRS
              </span>
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-2 truncate">
              <span className="flex items-center gap-1 font-medium text-slate-200 truncate">
                <Building2 className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="truncate">{activeCompany.nameAr || activeCompany.headerTitle || 'الشركة النشطة'}</span>
              </span>
              <span className="hidden md:inline-block text-[10px] font-mono bg-black/40 px-1.5 py-0.2 rounded text-slate-300 border border-white/10 shrink-0">
                س.ت: {activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}
              </span>
            </p>
          </div>
        </div>

        {/* System Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud Database Connected Status Badge */}
          <div
            title="سحابة Supabase متصلة ومزامنة للبيانات المحاسبية الفورية"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold shadow-2xs"
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>سحابي متصل</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>

          {/* Immediate System Repair & Deduplication Button */}
          <button
            onClick={handleImmediateRepair}
            disabled={isRepairing}
            title="الإصلاح الفوري الشامل: مطابقة الأرقام المميزة لجميع الفواتير والسندات وتطهير السجلات المكررة وضبط قيود اليومية"
            className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 border border-teal-400/40 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Wrench className={`w-3.5 h-3.5 text-teal-200 ${isRepairing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRepairing ? 'جارٍ الإصلاح...' : 'الإصلاح الفوري'}</span>
            <span className="sm:hidden">إصلاح</span>
          </button>

          {/* Single Unified Backup & Restore Hub Trigger (تجميع كافة عمليات النسخ في مكان موحد) */}
          {onOpenJsonBackup && (
            <button
              onClick={onOpenJsonBackup}
              title="مركز النسخ الاحتياطي والاستعادة الموحد (JSON / Excel / Rollback)"
              className="px-2.5 py-1 rounded-lg bg-[#1E3E62] hover:bg-[#2A5485] text-cyan-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-cyan-500/30 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <FolderUp className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">مركز النسخ والاستعادة</span>
              <span className="sm:hidden">النسخ</span>
            </button>
          )}

          {/* Super Admin Company Activation Portal - Strictly Restricted to Super Admin */}
          {onOpenSuperAdminPortal && Boolean(currentUser?.isPlatformAdmin || currentUser?.role === 'SUPER_ADMIN' || currentUser?.email === 'cgiacc2026@gmail.com') && (
            <button
              onClick={onOpenSuperAdminPortal}
              title="لوحة المشرف العام لاعتماد وتفعيل الشركات السحابية المسجلة"
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 border border-amber-400/40 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
              <span className="hidden sm:inline">تفعيل الشركات</span>
            </button>
          )}

          {/* Onboarding Guide Button */}
          {onOpenOnboardingGuide && (
            <button
              onClick={onOpenOnboardingGuide}
              title="دليل الإرشاد التفاعلي لتهيئة المنشأة خطوة بخطوة"
              className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 border border-cyan-400/40 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-200" />
              <span className="hidden sm:inline">دليل التهيئة</span>
            </button>
          )}

          {/* Company Setup Button */}
          <button
            onClick={onOpenCompanySetup}
            title="إعدادات المنشأة وبيانات الترخيص والضريبة"
            className="px-2.5 py-1 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            style={{ backgroundColor: activePalette.primaryColor }}
          >
            <Settings className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">الإعدادات</span>
          </button>

          {/* Unified Single Theme Selector (خلية الثيم الموحدة في مكان واحد فقط) */}
          <div className="relative" ref={paletteMenuRef}>
            <button
              type="button"
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              title={`نسق وثيم النظام: ${activePalette.labelAr} (انقر للتغيير)`}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 ${
                currentThemeMode === 'light'
                  ? 'bg-blue-600/30 hover:bg-blue-600/40 text-blue-100 border-blue-400/50'
                  : currentThemeMode === 'slate'
                  ? 'bg-slate-700/60 hover:bg-slate-700/80 text-sky-200 border-sky-400/40'
                  : 'bg-indigo-900/60 hover:bg-indigo-900/80 text-indigo-200 border-indigo-400/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {currentThemeMode === 'light' && <Sun className="w-3.5 h-3.5 text-amber-300" />}
                {currentThemeMode === 'slate' && <Layers className="w-3.5 h-3.5 text-sky-300" />}
                {currentThemeMode === 'navy' && <Moon className="w-3.5 h-3.5 text-indigo-300" />}
                <span className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-xs shrink-0" style={{ backgroundColor: activePalette.primaryColor }} />
                <span>{activePalette.labelAr}</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-300 transition-transform duration-200 ${isPaletteOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPaletteOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-[#142034] border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-right space-y-1.5 animate-in fade-in duration-100">
                <div className="text-[11px] font-bold text-slate-200 border-b border-slate-700/60 pb-1.5 px-1 flex items-center justify-between">
                  <span>أنظمة الثيمات المعتمدة (ERP Themes)</span>
                  <span className="text-[10px] text-cyan-400 font-mono">3 ثيمات</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {(['light', 'slate', 'navy'] as ThemeMode[]).map((modeKey) => {
                    const p = ERP_THEMES[modeKey];
                    const isSelected = currentThemeMode === modeKey;
                    return (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => handleSelectTheme(modeKey)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-right ${
                          isSelected
                            ? 'bg-blue-600/30 text-white border border-blue-400/60 shadow-xs'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white/40 shadow-xs shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: p.primaryColor }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <div>
                            <div className="font-semibold leading-tight">{p.labelAr}</div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{p.labelEn}</div>
                          </div>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: p.swatchHex }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Currency Selector */}
          <div className="flex items-center gap-1 bg-black/30 border border-white/20 rounded-lg px-2 py-0.5 text-xs shrink-0">
            <span className="hidden md:inline text-slate-300 font-semibold text-[11px]">العملة:</span>
            <select
              value={effectiveCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="bg-transparent border-none rounded px-1 py-0.5 font-bold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="KWD" className="text-black bg-white">KWD (د.ك)</option>
              <option value="SAR" className="text-black bg-white">SAR (ر.س)</option>
              <option value="AED" className="text-black bg-white">AED (د.إ)</option>
              <option value="BHD" className="text-black bg-white">BHD (د.ب)</option>
              <option value="OMR" className="text-black bg-white">OMR (ر.ع)</option>
              <option value="QAR" className="text-black bg-white">QAR (ر.ق)</option>
              <option value="JOD" className="text-black bg-white">JOD (د.أ)</option>
              <option value="EGP" className="text-black bg-white">EGP (ج.م)</option>
              <option value="USD" className="text-black bg-white">USD ($)</option>
              <option value="EUR" className="text-black bg-white">EUR (€)</option>
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
      {repairNotice && (
        <div className="bg-emerald-900/95 border-t border-b border-emerald-500/50 text-emerald-100 text-xs px-4 py-2 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{repairNotice}</span>
          </div>
          <button
            onClick={() => setRepairNotice(null)}
            className="text-emerald-200 hover:text-white font-bold text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 transition-colors"
          >
            حسناً
          </button>
        </div>
      )}
    </header>
  );
};
