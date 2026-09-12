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
  Upload,
} from 'lucide-react';
import { CompanyProfile, SystemUser } from '../types.js';
import { ExcelBackupService } from '../services/excelBackupService.ts';
import { ThemeService, ERP_THEMES, ThemeColor, ThemeMode, useTheme } from '../services/themeService.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import { DataService, localDataStore } from '../services/dataService.ts';
import { useCompany } from '../contexts/CompanyContext.tsx';
import { supabase, resolveToSupabaseCompanyUUID } from '../services/supabaseClient.js';

interface HeaderProps {
  company: CompanyProfile | null;
  currency: string;
  setCurrency: (c: string) => void;
  onOpenCompanySetup: () => void;
  onOpenOnboardingGuide?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenSuperAdminPortal?: () => void;
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

  const [liveCompany, setLiveCompany] = useState<any>(null);

  useEffect(() => {
    const handleCompanyUpdate = (e: any) => {
      if (e?.detail) {
        setLiveCompany(e.detail);
      }
    };
    window.addEventListener('company_settings_changed', handleCompanyUpdate);
    return () => {
      window.removeEventListener('company_settings_changed', handleCompanyUpdate);
    };
  }, []);

  const activeCompany = liveCompany || companyContext?.currentCompany || resolveActiveCompany(company);
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
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteMenuRef = useRef<HTMLDivElement>(null);

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
      const currentCompanyId = resolveToSupabaseCompanyUUID(company?.id) || company?.id || '20000000-0000-0000-0000-000000000001';

      const [accounts, customers, suppliers, inventory, journals, invoices, vouchers] = await Promise.all([
        supabase.from('chart_of_accounts').select('*').eq('company_id', currentCompanyId),
        supabase.from('customers').select('*').eq('company_id', currentCompanyId),
        supabase.from('suppliers').select('*').eq('company_id', currentCompanyId),
        supabase.from('inventory_items').select('*').eq('company_id', currentCompanyId),
        supabase.from('journal_entries').select('*, journal_entry_lines(*)').eq('company_id', currentCompanyId),
        supabase.from('invoices').select('*, invoice_items(*)').eq('company_id', currentCompanyId),
        supabase.from('payment_vouchers').select('*').eq('company_id', currentCompanyId),
      ]);

      const users = localDataStore.getUsers();
      const units = localDataStore.getUnits();

      const fullBackup = {
        exportDate: new Date().toISOString(),
        version: "2.0.0",
        company,
        users,
        accounts: accounts.data || [],
        customers: customers.data || [],
        suppliers: suppliers.data || [],
        inventory: inventory.data || [],
        journals: journals.data || [],
        invoices: invoices.data || [],
        vouchers: vouchers.data || [],
        units
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fullBackup, null, 2))}`;
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

  const isLight = effectiveMode === 'light' || activePalette.id === 'light';

  return (
    <header
      style={{
        backgroundColor: isLight ? '#FFFFFF' : activePalette.headerBg,
        borderColor: isLight ? '#E2E8F0' : activePalette.headerBorder,
      }}
      className={`${
        isLight ? 'text-slate-800 bg-white border-b border-slate-200 shadow-xs' : 'text-white border-b shadow-sm'
      } sticky top-0 z-40 px-3 sm:px-6 py-2 no-print transition-colors duration-200 font-sans`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & System Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white border shadow-2xs shrink-0"
            style={{
              backgroundColor: isLight ? '#059669' : activePalette.primaryColor,
              borderColor: isLight ? '#047857' : 'rgba(255,255,255,0.2)',
            }}
          >
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`text-sm sm:text-base font-bold tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                لوجيكس ERP | LOGIX
              </h1>
              <span className={`hidden sm:inline-flex px-2 py-0.2 text-[9px] font-bold border rounded-full items-center gap-1 ${
                isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white/10 text-white/90 border-white/20'
              }`}>
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> IFRS
              </span>
            </div>
            <p className={`text-[11px] flex items-center gap-2 truncate ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
              <span className={`flex items-center gap-1 font-medium truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{activeCompany.nameAr || activeCompany.headerTitle || 'الشركة النشطة'}</span>
              </span>
              <span className={`hidden md:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-black/40 text-slate-300 border-white/10'
              }`}>
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
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xs border ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-black/30 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>سحابي متصل</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          </div>

          {/* Super Admin Company Activation Portal - Strictly Restricted to Super Admin */}
          {onOpenSuperAdminPortal && Boolean(currentUser?.isPlatformAdmin || currentUser?.role === 'SUPER_ADMIN' || currentUser?.email === 'cgiacc2026@gmail.com') && (
            <button
              onClick={onOpenSuperAdminPortal}
              title="لوحة المشرف العام لاعتماد وتفعيل الشركات السحابية المسجلة"
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 border border-amber-500 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
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
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                  : 'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-400/40'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${isLight ? 'text-slate-600' : 'text-cyan-200'}`} />
              <span className="hidden sm:inline">دليل التهيئة</span>
            </button>
          )}

          {/* Company Setup Button */}
          <button
            onClick={onOpenCompanySetup}
            title="إعدادات المنشأة وبيانات الترخيص والضريبة"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 ${
              isLight
                ? 'bg-slate-900 hover:bg-black text-white border-slate-900'
                : 'text-white border-white/20'
            }`}
            style={!isLight ? { backgroundColor: activePalette.primaryColor } : undefined}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">الإعدادات</span>
          </button>

          {/* Unified Single Theme Selector */}
          <div className="relative" ref={paletteMenuRef}>
            <button
              type="button"
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              title={`نسق وثيم النظام: ${activePalette.labelAr} (انقر للتغيير)`}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                  : currentThemeMode === 'slate'
                  ? 'bg-slate-700/60 hover:bg-slate-700/80 text-sky-200 border-sky-400/40'
                  : 'bg-indigo-900/60 hover:bg-indigo-900/80 text-indigo-200 border-indigo-400/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {currentThemeMode === 'light' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
                {currentThemeMode === 'slate' && <Layers className="w-3.5 h-3.5 text-sky-300" />}
                {currentThemeMode === 'navy' && <Moon className="w-3.5 h-3.5 text-indigo-300" />}
                <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-xs shrink-0" style={{ backgroundColor: activePalette.primaryColor }} />
                <span>{activePalette.labelAr}</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isPaletteOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPaletteOpen && (
              <div className={`absolute left-0 mt-2 w-72 rounded-xl shadow-2xl p-2.5 z-50 text-right space-y-1.5 animate-in fade-in duration-100 ${
                isLight
                  ? 'bg-white border border-slate-200 text-slate-800'
                  : 'bg-[#142034] border border-slate-700 text-white'
              }`}>
                <div className={`text-[11px] font-bold border-b pb-1.5 px-1 flex items-center justify-between ${
                  isLight ? 'border-slate-200 text-slate-800' : 'border-slate-700/60 text-slate-200'
                }`}>
                  <span>أنظمة الثيمات المعتمدة (ERP Themes)</span>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-emerald-700' : 'text-cyan-400'}`}>3 ثيمات</span>
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
                            ? isLight
                              ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs'
                              : 'bg-blue-600/30 text-white border border-blue-400/60 shadow-xs'
                            : isLight
                            ? 'text-slate-700 hover:bg-slate-100 border border-transparent'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-xs shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: p.primaryColor }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <div>
                            <div className="font-semibold leading-tight">{p.labelAr}</div>
                            <div className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{p.labelEn}</div>
                          </div>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
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
          <div className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs shrink-0 border ${
            isLight
              ? 'bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-black/30 border-white/20 text-white'
          }`}>
            <span className={`hidden md:inline font-semibold text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>العملة:</span>
            <select
              value={effectiveCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className={`bg-transparent border-none rounded px-1 py-0.5 font-bold text-xs focus:outline-none cursor-pointer ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
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
            <div className={`flex items-center gap-1.5 border-r pr-2 mr-0.5 shrink-0 ${
              isLight ? 'border-slate-200' : 'border-slate-700'
            }`}>
              <div
                title={`${currentUser.name} - ${currentUser.roleTitleAr}`}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 border ${
                  isLight
                    ? 'bg-slate-100 border-slate-200'
                    : 'bg-slate-800/80 border-slate-700/80'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {currentUser.name.slice(0, 1)}
                </div>
                <div className="text-right leading-tight hidden lg:block">
                  <div className={`text-xs font-bold truncate max-w-[90px] ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{currentUser.name}</div>
                  <div className={`text-[9px] truncate max-w-[90px] ${isLight ? 'text-emerald-700' : 'text-cyan-400'}`}>{currentUser.roleTitleAr}</div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="تسجيل الخروج والعودة لشاشة الدخول"
                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all cursor-pointer flex items-center gap-1 text-xs"
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
