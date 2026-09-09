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
} from 'lucide-react';
import { CompanyProfile, SystemUser } from '../types.js';
import { ExcelBackupService } from '../services/excelBackupService.ts';
import { ThemeService, THEME_PALETTES, ThemeColor, ThemeMode } from '../services/themeService.ts';

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
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [currentThemeColor, setCurrentThemeColor] = useState<ThemeColor>(() => (company?.themeColor as ThemeColor) || ThemeService.getSavedThemeColor());
  const [currentThemeMode, setCurrentThemeMode] = useState<ThemeMode>(() => (company?.themeMode as ThemeMode) || ThemeService.getSavedThemeMode());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteMenuRef = useRef<HTMLDivElement>(null);

  // Sync theme state with service and company
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail) {
        setCurrentThemeColor(e.detail.themeColor);
        setCurrentThemeMode(e.detail.themeMode);
      }
    };
    window.addEventListener('logix-theme-changed', handleThemeChange);
    return () => window.removeEventListener('logix-theme-changed', handleThemeChange);
  }, []);

  // Sync if company prop changes
  useEffect(() => {
    if (company?.themeColor && company.themeColor !== currentThemeColor) {
      ThemeService.setThemeColor(company.themeColor as ThemeColor);
      setCurrentThemeColor(company.themeColor as ThemeColor);
    }
    if (company?.themeMode && company.themeMode !== currentThemeMode) {
      ThemeService.applyTheme(undefined, company.themeMode as ThemeMode);
      setCurrentThemeMode(company.themeMode as ThemeMode);
    }
  }, [company?.themeColor, company?.themeMode]);

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

  const activePalette = THEME_PALETTES[currentThemeColor] || THEME_PALETTES['blue'];
  const effectiveMode = ThemeService.getEffectiveThemeMode(currentThemeMode);

  const handleToggleThemeMode = () => {
    const newMode = ThemeService.toggleThemeMode();
    setCurrentThemeMode(newMode);
  };

  const handleSelectThemeColor = (colorKey: ThemeColor) => {
    ThemeService.setThemeColor(colorKey);
    setCurrentThemeColor(colorKey);
    setIsPaletteOpen(false);
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
                <span className="truncate">{company?.nameAr || 'مطحنة الوليد المتحده'}</span>
              </span>
              <span className="hidden md:inline-block text-[10px] font-mono bg-black/40 px-1.5 py-0.2 rounded text-slate-300 border border-white/10 shrink-0">
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
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold shadow-2xs"
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

          {/* Quick Backup Export / Restore via JSON - Restricted to Super Admin Only */}
          {Boolean(currentUser?.isPlatformAdmin || currentUser?.role === 'SUPER_ADMIN' || currentUser?.email === 'cgiacc2026@gmail.com') && (
            <button
              onClick={onOpenJsonBackup || handleQuickBackup}
              disabled={isExporting}
              title="إدارة واستعادة وتصدير وتصفير بيانات المنشأة بصيغة JSON (خاص بالمشرف العام)"
              className="hidden md:flex px-2 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-bold items-center gap-1 border border-indigo-700/60 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className={`w-3 h-3 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>نسخ/استعادة JSON</span>
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

          {/* Day / Night Mode (الوضع النهاري والليلي) Toggle Button */}
          <button
            type="button"
            onClick={handleToggleThemeMode}
            title={effectiveMode === 'dark' ? 'التبديل إلى الوضع النهاري (Light Mode)' : 'التبديل إلى الوضع الليلي (Dark Mode)'}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 ${
              effectiveMode === 'dark'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/50'
                : 'bg-black/30 hover:bg-black/50 text-slate-100 border-white/20'
            }`}
          >
            {effectiveMode === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">نهاري</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden sm:inline">ليلي</span>
              </>
            )}
          </button>

          {/* ERP Theme Quick Palette Selector */}
          <div className="relative" ref={paletteMenuRef}>
            <button
              type="button"
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              title={`نسق وألوان البرنامج: ${activePalette.labelAr}`}
              className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-black/30 hover:bg-black/50 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-xs"
                style={{ backgroundColor: activePalette.primaryColor }}
              />
              <Palette className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden xl:inline text-[11px] font-medium text-slate-200 truncate max-w-[70px]">
                {activePalette.labelAr.split(' ')[0]}
              </span>
            </button>

            {isPaletteOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-[#0E1626] border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-right space-y-1 animate-in fade-in duration-100">
                <div className="text-[11px] font-bold text-slate-200 border-b border-slate-800 pb-1.5 px-1 flex items-center justify-between">
                  <span>نسق وألوان البرنامج (ERP Themes)</span>
                  <span className="text-[10px] text-cyan-400 font-mono">6 ألوان</span>
                </div>
                <div className="grid grid-cols-1 gap-1 pt-1">
                  {Object.values(THEME_PALETTES).filter((p, i, arr) => arr.findIndex(t => t.id === p.id) === i).map((p) => {
                    const isSelected = currentThemeColor === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectThemeColor(p.id as ThemeColor)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
                          isSelected
                            ? 'bg-blue-600/30 text-white border border-blue-500/50'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-white/40 shadow-xs shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: p.primaryColor }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className="truncate">{p.labelAr}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">{p.labelEn.split(' ')[0]}</span>
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
              value={currency || 'SAR'}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-transparent border-none rounded px-1 py-0.5 font-bold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="SAR" className="text-black bg-white">SAR (ر.س)</option>
              <option value="KWD" className="text-black bg-white">KWD (د.ك)</option>
              <option value="USD" className="text-black bg-white">USD ($)</option>
              <option value="EUR" className="text-black bg-white">EUR (€)</option>
              <option value="AED" className="text-black bg-white">AED (د.إ)</option>
              <option value="EGP" className="text-black bg-white">EGP (ج.م)</option>
              <option value="QAR" className="text-black bg-white">QAR (ر.ق)</option>
              <option value="BHD" className="text-black bg-white">BHD (د.ب)</option>
              <option value="OMR" className="text-black bg-white">OMR (ر.ع)</option>
              <option value="JOD" className="text-black bg-white">JOD (د.أ)</option>
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
