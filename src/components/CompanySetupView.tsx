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
  Package,
  Layers,
  ArrowRight,
  Image as ImageIcon,
  Trash2,
  Plus,
  Link2,
  RotateCcw,
  CheckCheck,
  Search,
  Sliders,
  Palette,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { Account, CompanyProfile, DefaultAccountsMapping } from '../types.js';
import { DatabaseWizardModal } from './DatabaseWizardModal';
import { CompanyOnboardingWizard } from './CompanyOnboardingWizard';
import { DataService, localDataStore, getDefaultMappingForAccounts } from '../services/dataService.ts';
import { safeApiFetch } from '../utils/safeJson.ts';
import { SystemResetService } from '../services/systemResetService.ts';
import { formatCurrency, setActiveCompanyConfig } from '../utils/formatters.ts';
import { ThemeService, ERP_THEMES, THEME_PALETTES, ThemeColor, ThemeMode } from '../services/themeService.ts';
import { ERPBackupImportService } from '../services/importBackupService.js';
import { supabase, isSupabaseConfigured, resolveToSupabaseCompanyUUID, getCurrentCompanyId } from '../services/supabaseClient.js';
import { SupabaseDataService } from '../services/supabaseService.js';
import {
  COUNTRY_FINANCIAL_MATRIX,
  SUPPORTED_COUNTRIES,
  getCountryFinancialProfile,
  formatCurrencyStrict,
} from '../utils/currencyMatrix.ts';

interface CompanySetupViewProps {
  company: CompanyProfile | null;
  accounts?: Account[];
  onSaveCompany: (updated: CompanyProfile) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onResetDatabase?: () => Promise<void>;
}

function compressAndOptimizeLogo(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve((e.target?.result as string) || '');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png', 0.92);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve((e.target?.result as string) || '');
      };
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CompanySetupView: React.FC<CompanySetupViewProps> = ({
  company,
  accounts,
  onSaveCompany,
  onRefreshData,
  onResetDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<'legal' | 'address' | 'vat' | 'accounting' | 'mapping' | 'branding' | 'backup'>('legal');
  const [formData, setFormData] = useState<Partial<CompanyProfile>>(company || {});
  const [companyAccounts, setCompanyAccounts] = useState<Account[]>(() => {
    return accounts && accounts.length > 0 ? accounts : localDataStore.getAccounts();
  });
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoSuccessMessage, setLogoSuccessMessage] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState('');
  const [cleanGenSuccess, setCleanGenSuccess] = useState('');
  const [isGeneratingClean, setIsGeneratingClean] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Backup & Security States
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

  // Enterprise SQL Migration Script States
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [sqlScriptContent, setSqlScriptContent] = useState<string>('');
  const [isLoadingSql, setIsLoadingSql] = useState(false);
  const [isSqlCopied, setIsSqlCopied] = useState(false);

  const handleOpenSqlModal = async () => {
    setIsSqlModalOpen(true);
    if (!sqlScriptContent) {
      setIsLoadingSql(true);
      try {
        const res = await fetch('/api/database/migration-script');
        if (res.ok) {
          const text = await res.text();
          setSqlScriptContent(text);
        } else {
          setSqlScriptContent('-- تعذر جلب ملف الاسكربت من الخادم');
        }
      } catch {
        setSqlScriptContent('-- حدث خطأ أثناء الاتصال بالخادم لجلب الاسكربت');
      } finally {
        setIsLoadingSql(false);
      }
    }
  };

  /**
   * 1. Fetch Chart of Accounts for the active company strictly using activeCompanyId
   */
  const fetchAccountsForActiveCompany = async () => {
    setIsLoadingAccounts(true);
    const activeCompanyId = resolveToSupabaseCompanyUUID(company?.id || getCurrentCompanyId());

    try {
      let loadedAccounts: Account[] = [];

      if (isSupabaseConfigured) {
        // Query Supabase chart_of_accounts by company_id
        let { data, error } = await supabase
          .from('chart_of_accounts')
          .select('id, code, name, account_type')
          .eq('company_id', activeCompanyId)
          .order('code', { ascending: true });

        // Fallback if schema uses different column names (e.g. name_ar, category)
        if (error || !data || data.length === 0) {
          const fallbackRes = await supabase
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', activeCompanyId)
            .order('code', { ascending: true });

          if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
            data = fallbackRes.data;
            error = null;
          }
        }

        if (data && data.length > 0) {
          loadedAccounts = data.map((row: any) => {
            const rawName = row.name || row.name_ar || row.nameAr || row.name_en || `حساب ${row.code}`;
            const rawType = (row.account_type || row.category || row.type || '').toUpperCase();
            const codeStr = String(row.code || '').trim();
            let cat: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' = 'ASSET';

            if (rawType.includes('LIAB') || rawType.includes('خصوم') || rawType.includes('التزام') || codeStr.startsWith('2')) {
              cat = 'LIABILITY';
            } else if (rawType.includes('EQUITY') || rawType.includes('حقوق') || codeStr.startsWith('3')) {
              cat = 'EQUITY';
            } else if (rawType.includes('REV') || rawType.includes('INCOME') || rawType.includes('إيراد') || codeStr.startsWith('4')) {
              cat = 'REVENUE';
            } else if (rawType.includes('EXP') || rawType.includes('COST') || rawType.includes('مصروف') || rawType.includes('تكل') || codeStr.startsWith('5')) {
              cat = 'EXPENSE';
            } else {
              cat = 'ASSET';
            }

            return {
              id: String(row.id),
              code: codeStr,
              nameAr: rawName,
              nameEn: row.name_en || row.nameEn || '',
              category: cat,
              accountType: row.account_type || row.category || cat,
              normalBalance: row.normal_balance || (cat === 'ASSET' || cat === 'EXPENSE' ? 'DEBIT' : 'CREDIT'),
              level: Number(row.level) || 1,
              type: row.type || 'DETAIL',
              parentId: row.parent_id || null,
              isSystem: !!row.is_system,
              isActive: row.is_active ?? true,
              balance: Number(row.balance || row.current_balance) || 0,
              description: row.description || '',
            } as Account;
          });
        }
      }

      // Fallback to props or local store if remote accounts returned empty
      if (loadedAccounts.length === 0) {
        if (accounts && accounts.length > 0) {
          loadedAccounts = accounts;
        } else {
          const localAccs = localDataStore.getAccounts();
          if (localAccs && localAccs.length > 0) {
            loadedAccounts = localAccs;
          }
        }
      }

      if (loadedAccounts.length > 0) {
        setCompanyAccounts(loadedAccounts);
      }
    } catch (err) {
      console.warn('Error fetching chart of accounts in CompanySetupView:', err);
      if (accounts && accounts.length > 0) {
        setCompanyAccounts(accounts);
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  /**
   * Fetch saved default accounts mapping from company_accounting_settings / company_settings
   */
  const fetchSavedDefaultAccounts = async () => {
    const activeCompanyId = resolveToSupabaseCompanyUUID(company?.id || getCurrentCompanyId());
    if (!isSupabaseConfigured) return;

    try {
      const mapping = await SupabaseDataService.getCompanyAccountingSettings(activeCompanyId);
      if (mapping) {
        const validEntries = Object.entries(mapping).filter(([_, v]) => Boolean(v));
        if (validEntries.length > 0) {
          setFormData((prev) => ({
            ...prev,
            defaultAccounts: {
              ...(prev.defaultAccounts || {}),
              ...Object.fromEntries(validEntries),
            },
          }));
        }
      }
    } catch (err) {
      // Non-blocking if table not yet provisioned
    }
  };

  // Synchronize on mount and company change
  React.useEffect(() => {
    if (company) {
      setFormData(company);
    }
  }, [company?.id, company?.nameAr, company?.logoUrl]);

  React.useEffect(() => {
    fetchAccountsForActiveCompany();
    fetchSavedDefaultAccounts();
  }, [company?.id]);

  // Refresh accounts when user switches to mapping tab
  React.useEffect(() => {
    if (activeTab === 'mapping') {
      fetchAccountsForActiveCompany();
      fetchSavedDefaultAccounts();
    }
  }, [activeTab]);

  const handleChange = (field: keyof CompanyProfile, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setErrorMessage('');
  };

  const currentMapping: DefaultAccountsMapping = formData.defaultAccounts || (companyAccounts.length > 0 ? getDefaultMappingForAccounts(companyAccounts) : {});

  const handleMappingChange = (field: keyof DefaultAccountsMapping, accountId: string) => {
    const updatedMapping: DefaultAccountsMapping = {
      ...currentMapping,
      [field]: accountId || undefined,
    };
    setFormData((prev) => ({
      ...prev,
      defaultAccounts: updatedMapping,
    }));
    setSaveSuccess(false);
    setMappingSuccess('تم تعديل الربط. اضغط على "حفظ إعدادات الربط الآن" لاعتماد التغييرات في قاعدة البيانات.');
    setTimeout(() => setMappingSuccess(''), 4000);
  };

  /**
   * 3. Smart Auto-Map searching standard codes:
   * 1111 للصندوق/البنك، 1120 للعملاء، 2110 للموردين، 4100 للمبيعات، 1130 للمخزون
   */
  const handleAutoMapAccounts = () => {
    if (companyAccounts.length === 0) {
      setErrorMessage('لا توجد حسابات مسجلة في شجرة الحسابات للشركة النشطة للقيام بالربط التلقائي.');
      return;
    }

    const findAccount = (standardCodes: string[], keywords: string[]) => {
      // 1. Exact match by code
      for (const code of standardCodes) {
        const found = companyAccounts.find((a) => String(a.code).trim() === code);
        if (found) return found.id;
      }
      // 2. Starts with code
      for (const code of standardCodes) {
        const found = companyAccounts.find((a) => String(a.code).trim().startsWith(code));
        if (found) return found.id;
      }
      // 3. Search keywords in name
      const foundKw = companyAccounts.find((a) => {
        const ar = (a.nameAr || '').toLowerCase();
        const en = (a.nameEn || '').toLowerCase();
        return keywords.some((k) => ar.includes(k.toLowerCase()) || en.includes(k.toLowerCase()));
      });
      return foundKw ? foundKw.id : undefined;
    };

    // Standard codes resolution
    const acc1111 = companyAccounts.find((a) => String(a.code).trim() === '1111');
    let cashId: string | undefined;
    let bankId: string | undefined;

    if (acc1111) {
      const isBank = (acc1111.nameAr || '').includes('بنك') || (acc1111.nameEn || '').toLowerCase().includes('bank');
      if (isBank) {
        bankId = acc1111.id;
        cashId = findAccount(['1113', '1112', '1110', '111'], ['صندوق', 'خزينة', 'cash', 'نقد']);
      } else {
        cashId = acc1111.id;
        bankId = findAccount(['1112', '1114', '1110', '111'], ['بنك', 'مصرف', 'bank']);
      }
    } else {
      cashId = findAccount(['1111', '1113', '1112', '1110'], ['صندوق', 'خزينة', 'cash', 'نقد']);
      bankId = findAccount(['1112', '1111', '1114', '1110'], ['بنك', 'مصرف', 'bank']);
    }

    const receivableId = findAccount(['1120', '1121', '112'], ['عملاء', 'مدينون', 'ذمم مدينة', 'receivable']);
    const payableId = findAccount(['2110', '2111', '211'], ['موردين', 'دائنون', 'ذمم دائنة', 'payable']);
    const salesId = findAccount(['4100', '4110', '41'], ['مبيعات', 'إيراد', 'sales', 'revenue']);
    const inventoryId = findAccount(['1130', '1131', '113'], ['مخزون', 'بضائع', 'inventory', 'stock']);
    const cogsId = findAccount(['5100', '5110', '51'], ['تكلفة', 'cogs', 'cost']);
    const retainedEarningsId = findAccount(['3200', '3210', '32'], ['أرباح', 'retained']);
    const vatId = findAccount(['2120', '2121', '212'], ['ضريبة', 'vat', 'tax']);

    const autoMapped: DefaultAccountsMapping = {
      ...currentMapping,
      ...(cashId && { cashAccountId: cashId }),
      ...(bankId && { bankAccountId: bankId }),
      ...(receivableId && { receivableAccountId: receivableId }),
      ...(payableId && { payableAccountId: payableId }),
      ...(salesId && { salesAccountId: salesId }),
      ...(inventoryId && { inventoryAccountId: inventoryId }),
      ...(cogsId && { cogsAccountId: cogsId }),
      ...(retainedEarningsId && { retainedEarningsAccountId: retainedEarningsId }),
      ...(vatId && { vatAccountId: vatId }),
    };

    setFormData((prev) => ({
      ...prev,
      defaultAccounts: autoMapped,
    }));

    setMappingSuccess('تم التعرف التلقائي الذكي على الحسابات القياسية (1111 للصندوق والبنك، 1120 للعملاء، 2110 للموردين، 4100 للمبيعات، 1130 للمخزون) بنجاح! اضغط على "حفظ إعدادات الربط الآن" لاعتمادها.');
    setTimeout(() => setMappingSuccess(''), 6000);
  };

  const handleCountrySelect = (selectedCountryName: string) => {
    const profile = getCountryFinancialProfile(selectedCountryName);
    setFormData((prev) => ({
      ...prev,
      country: selectedCountryName,
      functionalCurrency: profile.functionalCurrency,
      currencySymbol: profile.currencySymbol,
      decimalPlaces: profile.decimalPlaces,
    }));
    setMappingSuccess(`تم ربط الدولة [${selectedCountryName}] بالعملة [${profile.currencyNameAr} - ${profile.functionalCurrency}] وعدد الكسور [${profile.decimalPlaces}] تلقائياً طبقاً لمعايير البنك المركزي.`);
    setTimeout(() => setMappingSuccess(''), 6000);
  };

  /**
   * Validation of the 6 mandatory COA accounts
   */
  const validateMandatoryAccounts = (): { valid: boolean; missingList: string[] } => {
    const missing: string[] = [];
    if (!currentMapping.cashAccountId) missing.push('الصندوق / النقدية (1111/1113)');
    if (!currentMapping.receivableAccountId) missing.push('العملاء والذمم المدينة (1120)');
    if (!currentMapping.payableAccountId) missing.push('الموردين والذمم الدائنة (2110)');
    if (!currentMapping.salesAccountId) missing.push('إيرادات المبيعات (4100)');
    if (!currentMapping.inventoryAccountId) missing.push('مخزون البضائع (1130)');
    if (!currentMapping.cogsAccountId) missing.push('تكلفة البضاعة المباعة (5100)');
    return { valid: missing.length === 0, missingList: missing };
  };

  /**
   * 2. Safe Save Default Accounts Logic: Upsert to company_settings & update companies record
   */
  const handleSaveDefaultAccounts = async () => {
    setIsSavingMapping(true);
    setMappingSuccess('');
    setErrorMessage('');

    const validation = validateMandatoryAccounts();
    if (!validation.valid) {
      setErrorMessage(`تنبيه تدقيق محاسبي إلزامي: يمنع حفظ الإعدادات دون اكتمال ربط الحسابات الستة الأساسية بالدليل المحاسبي. الحسابات غير المحددة: [${validation.missingList.join('، ')}]. يرجى الضغط على زر "الربط الذكي التلقائي" لتحديدها فوراً.`);
      setIsSavingMapping(false);
      return;
    }

    const activeCompanyId = resolveToSupabaseCompanyUUID(company?.id || getCurrentCompanyId());

    const settingsPayload = {
      company_id: activeCompanyId,
      default_cash_account_id: currentMapping.cashAccountId || null,
      default_bank_account_id: currentMapping.bankAccountId || null,
      default_receivable_account_id: currentMapping.receivableAccountId || null,
      default_payable_account_id: currentMapping.payableAccountId || null,
      default_sales_account_id: currentMapping.salesAccountId || null,
      default_cogs_account_id: currentMapping.cogsAccountId || null,
      default_inventory_account_id: currentMapping.inventoryAccountId || null,
      default_retained_earnings_account_id: currentMapping.retainedEarningsAccountId || null,
      default_vat_account_id: currentMapping.vatAccountId || null,
      updated_at: new Date().toISOString(),
    };

    try {
      // 1. Upsert into company_accounting_settings and company_settings via SupabaseDataService
      if (isSupabaseConfigured) {
        await SupabaseDataService.saveCompanyAccountingSettings(currentMapping, activeCompanyId);

        // 2. Also update companies record
        try {
          await supabase
            .from('companies')
            .update({
              default_accounts: currentMapping,
              default_cash_account_id: currentMapping.cashAccountId || null,
              default_bank_account_id: currentMapping.bankAccountId || null,
              default_receivable_account_id: currentMapping.receivableAccountId || null,
              default_payable_account_id: currentMapping.payableAccountId || null,
              default_sales_account_id: currentMapping.salesAccountId || null,
              default_cogs_account_id: currentMapping.cogsAccountId || null,
              default_inventory_account_id: currentMapping.inventoryAccountId || null,
              profile_data: { ...(company || {}), ...formData, defaultAccounts: currentMapping },
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeCompanyId);
        } catch (compErr) {
          console.warn('companies update note:', compErr);
        }
      }

      // 3. Update company profile in state and storage
      const updatedProfile: CompanyProfile = {
        ...(company || {}),
        ...formData,
        defaultAccounts: currentMapping,
      } as CompanyProfile;

      await onSaveCompany(updatedProfile);
      localDataStore.saveCompany(updatedProfile);

      setMappingSuccess('تم حفظ واعتماد ربط الحسابات الافتراضية بنجاح سحابياً ومحلياً!');
      if (onRefreshData) {
        await onRefreshData();
      }
      setTimeout(() => setMappingSuccess(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ إعدادات ربط الحسابات الافتراضية');
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleGenerateCleanChart = async () => {
    if (!window.confirm('تأكيد: هل ترغب في توليد شجرة حسابات افتتاحية نظيفة بأرصدة أصفار (0.00) لهذه المنشأة وربطها تلقائياً بالإعدادات؟')) {
      return;
    }
    setIsGeneratingClean(true);
    setCleanGenSuccess('');
    setErrorMessage('');
    try {
      const cleanAccounts = await DataService.generateCleanCompanyChartOfAccounts();
      setCompanyAccounts(cleanAccounts);
      const autoMapped = getDefaultMappingForAccounts(cleanAccounts);
      setFormData((prev) => ({
        ...prev,
        defaultAccounts: autoMapped,
      }));
      setCleanGenSuccess('تم توليد شجرة حسابات افتتاحية نظيفة بأرصدة (0.00) خالية من الأرقام الوهمية وربطها بنجاح!');
      if (onRefreshData) {
        await onRefreshData();
      }
      setTimeout(() => setCleanGenSuccess(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل توليد شجرة الحسابات الافتتاحية النظيفة');
    } finally {
      setIsGeneratingClean(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr?.trim()) {
      setErrorMessage('يرجى تعبئة اسم الشركة (باللغة العربية).');
      return;
    }

    // Auto-fill any unmapped accounts from standard accounts so saving company profile is never blocked
    let mappingToUse = { ...currentMapping };
    if (companyAccounts.length > 0) {
      const autoDefault = getDefaultMappingForAccounts(companyAccounts);
      mappingToUse = {
        ...autoDefault,
        ...mappingToUse,
      };
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const activeCompanyId = resolveToSupabaseCompanyUUID(company?.id || getCurrentCompanyId());

      const funcCurr = (formData.functionalCurrency || formData.currency || 'KWD').trim().toUpperCase();
      const currSym = formData.currencySymbol || (funcCurr === 'KWD' ? 'د.ك' : funcCurr === 'SAR' ? 'ر.س' : funcCurr === 'AED' ? 'د.إ' : funcCurr === 'BHD' ? 'د.ب' : funcCurr === 'OMR' ? 'ر.ع' : funcCurr === 'QAR' ? 'ر.ق' : funcCurr === 'JOD' ? 'د.أ' : funcCurr === 'EGP' ? 'ج.م' : funcCurr === 'USD' ? '$' : funcCurr === 'EUR' ? '€' : funcCurr);
      const decPlaces = formData.decimalPlaces !== undefined ? Number(formData.decimalPlaces) : (funcCurr === 'KWD' || funcCurr === 'BHD' || funcCurr === 'OMR' || funcCurr === 'JOD' ? 3 : 2);

      const updatedProfile: CompanyProfile = {
        ...(company || {}),
        ...formData,
        functionalCurrency: funcCurr,
        currency: funcCurr,
        currencySymbol: currSym,
        decimalPlaces: decPlaces,
        defaultAccounts: mappingToUse,
      } as CompanyProfile;

      // Upsert into company_accounting_settings and company_settings
      if (isSupabaseConfigured) {
        await SupabaseDataService.saveCompanyAccountingSettings(mappingToUse, activeCompanyId);

        try {
          await supabase.from('companies').update({
            company_name: updatedProfile.nameAr,
            name_ar: updatedProfile.nameAr,
            functional_currency: funcCurr,
            currency: funcCurr,
            currency_symbol: currSym,
            decimal_places: decPlaces,
            default_accounts: mappingToUse,
            default_cash_account_id: mappingToUse.cashAccountId || null,
            default_bank_account_id: mappingToUse.bankAccountId || null,
            default_receivable_account_id: mappingToUse.receivableAccountId || null,
            default_payable_account_id: mappingToUse.payableAccountId || null,
            default_sales_account_id: mappingToUse.salesAccountId || null,
            default_cogs_account_id: mappingToUse.cogsAccountId || null,
            default_inventory_account_id: mappingToUse.inventoryAccountId || null,
            profile_data: updatedProfile,
            updated_at: new Date().toISOString(),
          }).eq('id', activeCompanyId);
        } catch (e) {
          console.warn('companies update error:', e);
        }
      }

      // Update local single source of truth and global in-memory formatters
      setActiveCompanyConfig({
        currency: funcCurr,
        symbol: currSym,
        decimals: decPlaces,
      });
      localStorage.setItem('supabase_company_info', JSON.stringify(updatedProfile));
      localDataStore.saveCompany(updatedProfile);

      await onSaveCompany(updatedProfile);

      // Broadcast event so all components update immediately without page refresh
      window.dispatchEvent(new CustomEvent('company_settings_changed', { detail: updatedProfile }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات الشركة');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Account Filtering Helpers by Account Type:
   * الأصول للصندوق والبنك والعملاء والمخزون
   * الخصوم للموردين وأمانات الضريبة
   * الإيرادات للمبيعات
   * المصروفات والتكلفة لتكلفة المبيعات
   * حقوق الملكية للأرباح المبقاة
   */
  const isAssetAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('ASSET') || type.includes('أصول') || code.startsWith('1');
  };

  const isLiabilityAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('LIAB') || type.includes('خصوم') || type.includes('التزام') || code.startsWith('2');
  };

  const isEquityAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('EQUITY') || type.includes('حقوق') || code.startsWith('3');
  };

  const isRevenueAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('REV') || type.includes('INCOME') || type.includes('إيراد') || type.includes('ايراد') || code.startsWith('4');
  };

  const isExpenseAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('EXP') || type.includes('COST') || type.includes('مصروف') || type.includes('تكل') || code.startsWith('5');
  };

  const isInventoryAccount = (acc: Account) => {
    const type = ((acc as any).accountType || acc.category || '').toUpperCase();
    const code = String(acc.code || '').trim();
    return type.includes('ASSET') || type.includes('أصول') || code.startsWith('1');
  };

  const getAccountOptions = (filterFn: (acc: Account) => boolean, _typeName: string) => {
    const searchLower = (accountSearch || '').toLowerCase().trim();

    // 1. Strict filter by account type and search query
    const matches = companyAccounts.filter((acc) => {
      const name = (acc.nameAr || '').toLowerCase();
      const code = (acc.code || '').toLowerCase();
      const en = (acc.nameEn || '').toLowerCase();
      const matchesSearch = !searchLower || name.includes(searchLower) || code.includes(searchLower) || en.includes(searchLower);
      return matchesSearch && filterFn(acc);
    });

    // 2. Safe fallback: if strict filter returns 0 (e.g. unclassified accounts),
    // return all matching accounts so the dropdown is NEVER empty!
    if (matches.length === 0) {
      return companyAccounts.filter((acc) => {
        if (!searchLower) return true;
        const name = (acc.nameAr || '').toLowerCase();
        const code = (acc.code || '').toLowerCase();
        const en = (acc.nameEn || '').toLowerCase();
        return name.includes(searchLower) || code.includes(searchLower) || en.includes(searchLower);
      });
    }

    return matches;
  };

  const handleSaveLogoOnly = async (logoToSave?: string) => {
    const finalLogo = logoToSave !== undefined ? logoToSave : (formData.logoUrl || '');
    setIsSavingLogo(true);
    setLogoSuccessMessage('');
    setErrorMessage('');
    try {
      const updatedProfile: CompanyProfile = {
        ...(company || {}),
        ...formData,
        logoUrl: finalLogo,
      } as CompanyProfile;

      await onSaveCompany(updatedProfile);
      setFormData((prev) => ({ ...prev, logoUrl: finalLogo }));
      setLogoSuccessMessage(finalLogo ? 'تم حفظ وتثبيت الشعار بنجاح في قاعدة البيانات سحابياً ومحلياً!' : 'تم حذف الشعار بنجاح!');
      if (onRefreshData) {
        await onRefreshData();
      }
      setTimeout(() => setLogoSuccessMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل حفظ الشعار');
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportSuccess('');
    setErrorMessage('');
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
      const cleanCompanyName = (formData.nameAr || company?.nameAr || 'database').replace(/\s+/g, '_');
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


  const handleSmartImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    setIsRestoring(true);
    setErrorMessage('');
    
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const data = JSON.parse(jsonContent);
        
        // 1. [ARCHITECT FIX] Re-calculate and deduplicate invoices in the JSON
        if (data.invoices && Array.isArray(data.invoices)) {
          const uniqueInvs: any[] = [];
          const seen = new Set();
          for(const inv of data.invoices) {
              if(!seen.has(inv.invoiceNumber)) {
                  seen.add(inv.invoiceNumber);
                  
                  let grossSubtotal = 0;
                  let vatTotal = 0;
                  if(Array.isArray(inv.lines)) {
                      inv.lines = inv.lines.map((l: any) => {
                          const q = Number(l.quantity) || 1;
                          const p = Number(l.unitPrice) || 0;
                          const vRate = Number(l.vatRate) || 0;
                          l.subtotal = q * p;
                          l.vatAmount = l.subtotal * (vRate / 100);
                          l.total = l.subtotal + l.vatAmount - (Number(l.discountAmount) || 0);
                          grossSubtotal += l.subtotal;
                          vatTotal += l.vatAmount;
                          return l;
                      });
                  }
                  inv.subtotal = grossSubtotal;
                  inv.vatTotal = vatTotal;
                  
                  const discAmt = inv.discountType === 'PERCENT' ? (grossSubtotal * (Number(inv.discountValue)||0)/100) : (Number(inv.discountValue)||0);
                  inv.discountTotal = discAmt;
                  inv.grandTotal = Math.max(0, grossSubtotal - discAmt) + vatTotal;
                  inv.dueAmount = Math.max(0, inv.grandTotal - (Number(inv.paidAmount)||0));
                  
                  uniqueInvs.push(inv);
              }
          }
          data.invoices = uniqueInvs;
        }

        // Call robust ERP backup import service to safely restore and upsert data
        await ERPBackupImportService.importCompanyJsonData(company?.id || '20000000-0000-0000-0000-000000000001', JSON.stringify(data));
        if (onRefreshData) {
            await onRefreshData();
        }
        
        // Run massive repair
        const repairResult = await DataService.executeImmediateRepairAndDeduplication();
        
        setRestoreSuccess('تمت استعادة البيانات وتصحيحها محاسبياً بنجاح! ' + repairResult.message);
        setTimeout(() => setRestoreSuccess(''), 6000);
      } catch (err: any) {
        setErrorMessage(err.message || 'ملف غير صالح أو تعذر الاستعادة وتصحيح البيانات');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
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
        let parsed;
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          throw new Error('الملف المرفوع يحتوي على أخطاء برمجية أو مقطوع. الرجاء نسخ كامل كود JSON ولصقه في ملف نصي وحفظه كـ .json ثم رفعه.');
        }

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

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowOnboardingWizard(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            title="إعادة تشغيل معالج إعداد المنشأة لتهيئة البيانات خطوة بخطوة"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>معالج إعداد المنشأة (Wizard)</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 border border-[#1A1A1A] shadow-xs cursor-pointer disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4 text-[#D4AF37]" />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات العامة'}</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {saveSuccess && (
        <div className="bg-[#EBF5EE] border border-[#2D6A4F]/30 text-[#2D6A4F] p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-serif font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>تم حفظ تحديثات بيانات وإعدادات الشركة بنجاح وتفعيلها في كافة مستندات وفواتير النظام!</span>
        </div>
      )}

      {mappingSuccess && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-semibold">
          <CheckCheck className="w-5 h-5 flex-shrink-0 text-blue-600" />
          <span>{mappingSuccess}</span>
        </div>
      )}

      {cleanGenSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-semibold">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{cleanGenSuccess}</span>
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
          { id: 'mapping', label: 'الربط المحاسبي بدليل الحسابات', icon: Link2 },
          { id: 'branding', label: 'نسق النظام والمطبوعات والختم', icon: Palette },
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
                <label className="block text-[#1A1A1A] font-semibold mb-1 flex items-center justify-between">
                  <span>الدولة والولاية النقدية (Country)</span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-normal">
                    مرتبط بمصفوفة العملات والكسور الرسمية
                  </span>
                </label>
                <select
                  value={formData.country || 'الكويت'}
                  onChange={(e) => handleCountrySelect(e.target.value)}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A] cursor-pointer"
                >
                  {SUPPORTED_COUNTRIES.map((c) => {
                    const prof = COUNTRY_FINANCIAL_MATRIX[c];
                    return (
                      <option key={c} value={c}>
                        {prof.flag} {c} — {prof.currencyNameAr} ({prof.functionalCurrency} / {prof.currencySymbol})
                      </option>
                    );
                  })}
                </select>
                {(() => {
                  const prof = getCountryFinancialProfile(formData.country || 'الكويت');
                  return (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">المعيار النقدي المركزي:</span>
                        <span className="font-mono text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded">
                          {prof.centralBankStandard}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 text-[11px]">
                        <span>العملة والرمز المقترن:</span>
                        <span className="font-bold text-slate-900">{prof.currencyNameAr} ({prof.currencySymbol})</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 text-[11px]">
                        <span>دقة الكسور الإلزامية:</span>
                        <span className="font-mono font-bold text-slate-900">{prof.decimalPlaces} خانات عشرية ({prof.subUnitNameAr})</span>
                      </div>
                    </div>
                  );
                })()}
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
                <label className="block text-[#1A1A1A] font-semibold mb-1 flex items-center justify-between">
                  <span>العملة الوظيفية والأساسية (Functional Currency)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    مقترنة تلقائياً بالدولة
                  </span>
                </label>
                <select
                  value={formData.functionalCurrency || 'KWD'}
                  onChange={(e) => {
                    const newCurr = e.target.value;
                    const newSym = newCurr === 'KWD' ? 'د.ك' : newCurr === 'SAR' ? 'ر.س' : newCurr === 'AED' ? 'د.إ' : newCurr === 'BHD' ? 'د.ب' : newCurr === 'OMR' ? 'ر.ع' : newCurr === 'QAR' ? 'ر.ق' : newCurr === 'JOD' ? 'د.أ' : newCurr === 'EGP' ? 'ج.م' : newCurr === 'USD' ? '$' : newCurr === 'EUR' ? '€' : newCurr;
                    const newDec = (newCurr === 'KWD' || newCurr === 'BHD' || newCurr === 'OMR' || newCurr === 'JOD') ? 3 : 2;
                    setFormData((prev) => ({
                      ...prev,
                      functionalCurrency: newCurr,
                      currency: newCurr,
                      currencySymbol: newSym,
                      decimalPlaces: newDec,
                    }));
                    setSaveSuccess(false);
                    setErrorMessage('');
                  }}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="KWD">الدينار الكويتي (KWD / د.ك) — 3 خانات</option>
                  <option value="SAR">الريال السعودي (SAR / ر.س) — خانتان</option>
                  <option value="AED">الدرهم الإماراتي (AED / د.إ) — خانتان</option>
                  <option value="BHD">الدينار البحريني (BHD / د.ب) — 3 خانات</option>
                  <option value="OMR">الريال العماني (OMR / ر.ع) — 3 خانات</option>
                  <option value="QAR">الريال القطري (QAR / ر.ق) — خانتان</option>
                  <option value="JOD">الدينار الأردني (JOD / د.أ) — 3 خانات</option>
                  <option value="EGP">الجنيه المصري (EGP / ج.م) — خانتان</option>
                  <option value="USD">الدولار الأمريكي (USD / $) — خانتان</option>
                  <option value="EUR">اليورو الأوروبي (EUR / €) — خانتان</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  الرمز المعتمد في الفواتير والتقارير: <strong className="text-slate-800 font-mono">{formData.currencySymbol || 'د.ك'}</strong>
                </p>
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
                <label className="block text-[#1A1A1A] font-semibold mb-1 flex items-center justify-between">
                  <span>دقة التقريب للكسور العشرية (Decimal Places)</span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                    معيار البنك المركزي
                  </span>
                </label>
                <select
                  value={formData.decimalPlaces || 2}
                  onChange={(e) => handleChange('decimalPlaces', Number(e.target.value))}
                  className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value={3}>3 خانات كسر عشرية (0.000) — فلوس/بيسة/مليم</option>
                  <option value={2}>خانتي كسر عشرية (0.00) — هللة/قرش/سنت</option>
                  <option value={4}>4 خانات كسر عشرية (0.0000) — دقة تسعير متقدمة</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  مثال العرض: <span className="font-mono font-bold text-slate-800">{formatCurrencyStrict(1250.75, formData.functionalCurrency || 'KWD', formData.decimalPlaces || 3)}</span>
                </p>
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

              {/* Direct Shortcut to Default Accounts Mapping */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-xs shrink-0">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">الربط المحاسبي التلقائي بالدليل (Default Accounts Mapping)</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      اربط حساب الصندوق، البنك، العملاء، الموردين، المخزون، والأرباح المبقاة مباشرة بحسابات شجرة الشركة لتوجيه القيود آلياً.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('mapping')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors shadow-xs"
                >
                  <span>الانتقال لتبويب الربط المحاسبي</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: DEFAULT ACCOUNTS MAPPING */}
        {activeTab === 'mapping' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-blue-600" />
                  الربط المحاسبي الافتراضي (Default Accounts Mapping) مع شجرة الحسابات
                </h3>
                <p className="text-xs text-[#8C8273] mt-1 leading-relaxed">
                  ربط الحسابات الأساسية للشركة (الصندوق، البنك، العملاء، الموردين، المخزون، إيرادات المبيعات، تكلفة المبيعات، والأرباح المرحلة) بحسابات الدليل المحاسبي لضمان الدقة والترحيل الآلي.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoMapAccounts}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="البحث التلقائي عن الحسابات القياسية (1111, 1120, 2110, 4100, 1130) وربطها"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>الربط الذكي التلقائي</span>
                </button>

                <button
                  type="button"
                  onClick={fetchAccountsForActiveCompany}
                  disabled={isLoadingAccounts}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  title="إعادة جلب شجرة الحسابات للشركة النشطة من قاعدة البيانات"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-slate-600 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
                  <span>{isLoadingAccounts ? 'جاري الجلب...' : 'تحديث الحسابات'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDefaultAccounts}
                  disabled={isSavingMapping}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                  title="حفظ الربط مباشرة في جدول إعدادات الشركة company_settings"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingMapping ? 'animate-pulse' : ''}`} />
                  <span>{isSavingMapping ? 'جاري الحفظ...' : 'حفظ إعدادات الربط الآن'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateCleanChart}
                  disabled={isGeneratingClean}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="إنشاء دليل محاسبي نظيف بأرصدة أصفار 0.00 دون أي أرقام عشوائية"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${isGeneratingClean ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingClean ? 'جاري التوليد...' : 'توليد شجرة نظيفة (أصفار)'}</span>
                </button>
              </div>
            </div>

            {/* Info & Summary Bar */}
            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-[#E5E1DA] shadow-2xs text-blue-600 font-mono font-bold">
                  {companyAccounts.length}
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">
                    شجرة حسابات المنشأة النشطة {isLoadingAccounts && <span className="text-blue-600 font-normal mr-1">(جاري المزامنة...)</span>}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    الشركة: <strong className="text-slate-700">{formData.nameAr || company?.nameAr || 'الشركة الحالية'}</strong> (المعرف: <code className="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded">{company?.id || 'default'}</code>)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="تصفية الحسابات بالاسم أو الرمز..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full bg-white border border-[#E5E1DA] rounded-md pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Mandatory 6 COA Accounts Audit Banner */}
            {(() => {
              const mandatoryList = [
                { key: 'cashAccountId' as const, nameAr: 'الصندوق والنقدية', code: '1111 / 1113', id: currentMapping.cashAccountId },
                { key: 'receivableAccountId' as const, nameAr: 'العملاء والذمم المدينة', code: '1120', id: currentMapping.receivableAccountId },
                { key: 'payableAccountId' as const, nameAr: 'الموردين والذمم الدائنة', code: '2110', id: currentMapping.payableAccountId },
                { key: 'salesAccountId' as const, nameAr: 'إيرادات المبيعات', code: '4100', id: currentMapping.salesAccountId },
                { key: 'inventoryAccountId' as const, nameAr: 'مخزون البضائع', code: '1130', id: currentMapping.inventoryAccountId },
                { key: 'cogsAccountId' as const, nameAr: 'تكلفة المبيعات (COGS)', code: '5100', id: currentMapping.cogsAccountId },
              ];
              const mappedCount = mandatoryList.filter(m => !!m.id).length;
              const allComplete = mappedCount === 6;

              return (
                <div className={`p-4 rounded-xl border ${allComplete ? 'bg-emerald-50/70 border-emerald-300' : 'bg-amber-50/80 border-amber-300'} space-y-3`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-5 h-5 ${allComplete ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          تدقيق الحسابات الستة الإلزامية للدليل المحاسبي ({mappedCount}/6 مكتمل)
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          {allComplete
                            ? 'تم ربط كامل الركائز الست الأساسية للقيود الآلية في فواتير البيع، الشراء، الصرف، وتكلفة المخزون.'
                            : 'يتطلب النظام المحاسبي اكتمال تعيين الحسابات الستة لتوليد القيود الآلية بدقة ومنع الفروقات المعلقة.'}
                        </p>
                      </div>
                    </div>
                    {!allComplete && (
                      <button
                        type="button"
                        onClick={handleAutoMapAccounts}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تسكين الحسابات الستة تلقائياً</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {mandatoryList.map((item) => {
                      const isMapped = !!item.id;
                      const acc = companyAccounts.find(a => a.id === item.id);
                      return (
                        <div
                          key={item.key}
                          className={`p-2 rounded-lg border text-center text-xs transition-colors ${
                            isMapped
                              ? 'bg-white border-emerald-300 text-emerald-900'
                              : 'bg-white border-rose-300 text-rose-800'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            {isMapped ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            )}
                            <span className="font-bold text-[11px]">{item.nameAr}</span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">{item.code}</div>
                          <div className="text-[10px] font-semibold truncate mt-0.5" title={acc ? `${acc.code} - ${acc.nameAr}` : 'غير معين'}>
                            {acc ? `${acc.code} - ${acc.nameAr}` : <span className="text-rose-600 font-bold">غير محدد</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Account Mapping Groups */}
            <div className="space-y-6">
              {/* GROUP 1: CASH & LIQUIDITY */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>1. حسابات النقدية والسيولة والمصارف (Cash & Liquidity)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تستخدم في سندات القبض والصرف والتحصيل</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cash Account */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب الصندوق الرئيسي (الخزينة النقدية) *</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">أصول متداولة (1111)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف المدين التلقائي لسندات القبض وفواتير المبيعات النقدية، والطرف الدائن لسندات الصرف النقدية.
                    </p>
                    <select
                      value={currentMapping.cashAccountId || ''}
                      onChange={(e) => handleMappingChange('cashAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب الصندوق (الأصول المتداولة) --</option>
                      {getAccountOptions(isAssetAccount, 'أصول متداولة')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'ASSET' ? 'أصول' : acc.category})
                          </option>
                        ))}
                    </select>

                    {/* Mapped Badge */}
                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.cashAccountId || a.code === currentMapping.cashAccountId);
                      return acc ? (
                        <div className="mt-2 bg-emerald-50/70 border border-emerald-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          لم يتم التعيين - يرجى الاختيار أو الضغط على "الربط الذكي التلقائي".
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bank Account */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب البنك الرئيسي (الحساب الجاري) *</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">أصول متداولة (1111/1112)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف المدين لسندات القبض البنكية والتحويلات، والطرف الدائن لمدفوعات الشيكات والتحويلات للموردين.
                    </p>
                    <select
                      value={currentMapping.bankAccountId || ''}
                      onChange={(e) => handleMappingChange('bankAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار الحساب البنكي (الأصول المتداولة) --</option>
                      {getAccountOptions(isAssetAccount, 'أصول متداولة')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'ASSET' ? 'أصول' : acc.category})
                          </option>
                        ))}
                    </select>

                    {/* Mapped Badge */}
                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.bankAccountId || a.code === currentMapping.bankAccountId);
                      return acc ? (
                        <div className="mt-2 bg-emerald-50/70 border border-emerald-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          لم يتم التعيين - يرجى الاختيار أو الضغط على "الربط الذكي التلقائي".
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* GROUP 2: RECEIVABLES & PAYABLES */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>2. حسابات الذمم التجارية (العملاء والموردين)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تستخدم في فواتير المبيعات والمشتريات الآجلة والتحصيلات</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Accounts Receivable */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب العملاء والذمم المدينة (Accounts Receivable) *</span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">أصول متداولة (مدين 1120)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف المدين لفواتير المبيعات الآجلة للعملاء، والطرف الدائن عند تحصيل مبالغ سندات القبض.
                    </p>
                    <select
                      value={currentMapping.receivableAccountId || ''}
                      onChange={(e) => handleMappingChange('receivableAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب العملاء (الأصول) --</option>
                      {getAccountOptions(isAssetAccount, 'أصول متداولة')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'ASSET' ? 'أصول' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.receivableAccountId || a.code === currentMapping.receivableAccountId);
                      return acc ? (
                        <div className="mt-2 bg-blue-50/70 border border-blue-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-blue-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          لم يتم التعيين - يرجى الاختيار.
                        </div>
                      );
                    })()}
                  </div>

                  {/* Accounts Payable */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب الموردين والذمم الدائنة (Accounts Payable) *</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">خصوم والتزامات (دائن 2110)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف الدائن لفواتير المشتريات الآجلة للموردين، والطرف المدين عند إصدار سندات صرف وسداد المستحقات.
                    </p>
                    <select
                      value={currentMapping.payableAccountId || ''}
                      onChange={(e) => handleMappingChange('payableAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب الموردين (الخصوم) --</option>
                      {getAccountOptions(isLiabilityAccount, 'خصوم والتزامات')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'LIABILITY' ? 'خصوم' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.payableAccountId || a.code === currentMapping.payableAccountId);
                      return acc ? (
                        <div className="mt-2 bg-amber-50/70 border border-amber-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-amber-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          لم يتم التعيين - يرجى الاختيار.
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* GROUP 3: INVENTORY, SALES & COGS */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>3. حسابات المخزون والتكلفة والمبيعات (Inventory & Operations)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تستخدم في فواتير المبيعات، قيود التكلفة التلقائية، وأوامر التشغيل</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Inventory Account */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب مخزون البضائع والمنتجات *</span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">أصول مخزون (1130)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      يمثل قيمة بضاعة المستودع. يُخفّض بقيد التكلفة عند كل بيع ويُزاد بالإنتاج التام والمشتريات.
                    </p>
                    <select
                      value={currentMapping.inventoryAccountId || ''}
                      onChange={(e) => handleMappingChange('inventoryAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب المخزون (الأصول) --</option>
                      {getAccountOptions(isInventoryAccount, 'أصول مخزون')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'ASSET' ? 'أصول' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.inventoryAccountId || a.code === currentMapping.inventoryAccountId);
                      return acc ? (
                        <div className="mt-2 bg-indigo-50/70 border border-indigo-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-indigo-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Sales Revenue Account */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب إيرادات المبيعات *</span>
                      <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">إيرادات (4100)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف الدائن لإجمالي صافي المبيعات بدون الضريبة في فواتير المبيعات التشغيلية.
                    </p>
                    <select
                      value={currentMapping.salesAccountId || ''}
                      onChange={(e) => handleMappingChange('salesAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب المبيعات (الإيرادات) --</option>
                      {getAccountOptions(isRevenueAccount, 'إيرادات مبيعات')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'REVENUE' ? 'إيرادات' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.salesAccountId || a.code === currentMapping.salesAccountId);
                      return acc ? (
                        <div className="mt-2 bg-sky-50/70 border border-sky-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-sky-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-sky-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* COGS Account */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب تكلفة البضاعة المباعة (COGS) *</span>
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">مصروفات/تكلفة (5100)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف المدين التلقائي لقيد تكلفة المبيعات في نظام الجرد المستمر لاحتساب مجمل الربح بدقة.
                    </p>
                    <select
                      value={currentMapping.cogsAccountId || ''}
                      onChange={(e) => handleMappingChange('cogsAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب تكلفة المبيعات (المصروفات) --</option>
                      {getAccountOptions(isExpenseAccount, 'مصروفات وتكلفة')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'EXPENSE' ? 'مصروفات' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.cogsAccountId || a.code === currentMapping.cogsAccountId);
                      return acc ? (
                        <div className="mt-2 bg-rose-50/70 border border-rose-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-rose-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-rose-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* GROUP 4: RETAINED EARNINGS & TAX */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>4. حسابات حقوق الملكية والضرائب (Equity & Tax Accounts)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تستخدم في إقفال الفترات المالية والميزانية العمومية وإقرارات الضريبة</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Retained Earnings */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب الأرباح والخسائر المرحلة / المبقاة *</span>
                      <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">حقوق ملكية (3200)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الحساب المخصص لتجميع أرباح وخسائر الفترات السابقة في قائمة المركز المالي وميزان المراجعة.
                    </p>
                    <select
                      value={currentMapping.retainedEarningsAccountId || ''}
                      onChange={(e) => handleMappingChange('retainedEarningsAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب الأرباح المبقاة (حقوق ملكية) --</option>
                      {getAccountOptions(isEquityAccount, 'حقوق ملكية')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'EQUITY' ? 'حقوق ملكية' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.retainedEarningsAccountId || a.code === currentMapping.retainedEarningsAccountId);
                      return acc ? (
                        <div className="mt-2 bg-purple-50/70 border border-purple-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-purple-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-purple-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* VAT Payable */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>حساب ضريبة القيمة المضافة / أمانات الضريبة *</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">التزامات متداولة (2120)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                      الطرف الدائن لقيمة ضريبة القيمة المضافة المحصلة في فواتير المبيعات الصادرة وفق اشتراطات الفوترة.
                    </p>
                    <select
                      value={currentMapping.vatAccountId || ''}
                      onChange={(e) => handleMappingChange('vatAccountId', e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
                    >
                      <option value="">-- يرجى اختيار حساب ضريبة القيمة المضافة (الخصوم) --</option>
                      {getAccountOptions(isLiabilityAccount, 'خصوم والتزامات')
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] - {acc.nameAr} ({acc.category === 'LIABILITY' ? 'خصوم' : acc.category})
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const acc = companyAccounts.find((a) => a.id === currentMapping.vatAccountId || a.code === currentMapping.vatAccountId);
                      return acc ? (
                        <div className="mt-2 bg-amber-50/70 border border-amber-200/80 rounded-md p-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                            <CheckCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>[{acc.code}] {acc.nameAr}</span>
                          </div>
                          <span className="font-mono font-bold text-amber-800">
                            رصيد: {formatCurrency(acc.balance || 0, formData.functionalCurrency, formData.decimalPlaces)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Save Action reminder */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">اعتماد وحفظ إعدادات الربط المحاسبي الافتراضي</h4>
                  <p className="text-xs text-slate-300">
                    عند الحفظ، سيتم حفظ الربط في جدول إعدادات الشركة <code className="text-cyan-300 font-mono">company_settings</code> وتوجيه العمليات المالية آلياً.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDefaultAccounts}
                  disabled={isSavingMapping}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all whitespace-nowrap disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 text-emerald-200 ${isSavingMapping ? 'animate-pulse' : ''}`} />
                  <span>{isSavingMapping ? 'جاري الحفظ...' : 'حفظ إعدادات الربط فقط'}</span>
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all whitespace-nowrap"
                >
                  <Save className="w-4 h-4 text-cyan-200" />
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات العامة'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BRANDING & PRINTING */}
        {activeTab === 'branding' && (
          <div className="bg-white border border-[#E5E1DA] rounded-lg p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#B8860B]" /> مظهر وهوية النظام والموقّعون المفوضون وتنسيق المطبوعات
              </h3>
              <p className="text-xs text-[#8C8273] mt-0.5">
                تحديد نسق وألوان البرنامج، الوضع النهاري والليلي، رفع شعار المنشأة، وتخصيص ترويسات المطبوعات والختم الإلكتروني.
              </p>
            </div>

            {/* ERP TRI-THEME SYSTEM (نظام الثيمات الاحترافي الثلاثي) */}
            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1DA] pb-3">
                <div>
                  <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-600" />
                    أنظمة الثيمات الاحترافية لبرنامج لوجيكس ERP (System Theme System)
                  </h4>
                  <p className="text-[11px] text-[#6E6659] mt-0.5">
                    تخصيص الهوية البصرية للبرنامج بالاختيار بين ثلاثة أنظمة ألوان احترافية خالية تماماً من السواد الثقيل المجهد للعين.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-lg self-start sm:self-auto">
                  تطبيق فوري وحفظ دائم
                </span>
              </div>

              {/* Three Professional Themes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['light', 'slate', 'navy'] as ThemeMode[]).map((modeKey) => {
                  const p = ERP_THEMES[modeKey];
                  const isSelected = (formData.themeMode || 'light') === modeKey;
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => {
                        handleChange('themeMode', modeKey);
                        handleChange('themeColor', modeKey);
                        ThemeService.applyTheme(modeKey);
                      }}
                      className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-white border-blue-600 ring-2 ring-blue-500/30 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 shadow-xs shrink-0"
                              style={{ backgroundColor: p.primaryColor }}
                            />
                            <span className="font-bold text-xs text-slate-900">{p.labelAr}</span>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              مفعّل
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed min-h-[38px]">
                          {p.descriptionAr}
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {/* Visual Swatch Bar */}
                        <div className="h-6 rounded-md overflow-hidden flex border border-slate-200 shadow-2xs">
                          <div
                            className="flex-1 flex items-center justify-center text-[9px] font-bold text-white px-1 truncate"
                            style={{ backgroundColor: p.headerBg }}
                          >
                            الترويسة
                          </div>
                          <div
                            className="w-1/3 flex items-center justify-center text-[9px] font-bold text-white px-1 truncate"
                            style={{ backgroundColor: p.primaryColor }}
                          >
                            الأساسي
                          </div>
                          <div
                            className="w-1/4 flex items-center justify-center text-[9px] font-bold text-slate-700 px-1 truncate"
                            style={{ backgroundColor: p.surfaceBg }}
                          >
                            البطاقة
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono text-left dir-ltr">
                          {p.labelEn}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                    رفع لوجو المنشأة بدقة عالية ومحسنة ليحفظ في قاعدة البيانات المركزية ويطبع في ترويسة الفواتير، بطاقات حركة المخزون، وسندات الصرف والقبض.
                  </p>
                </div>
                {formData.logoUrl && (
                  <button
                    type="button"
                    disabled={isSavingLogo}
                    onClick={async () => {
                      if (window.confirm('تأكيد: هل ترغب في حذف شعار المنشأة وحفظ التعديل في قاعدة البيانات؟')) {
                        await handleSaveLogoOnly('');
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف الشعار
                  </button>
                )}
              </div>

              {logoSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold animate-in fade-in">
                  <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{logoSuccessMessage}</span>
                </div>
              )}

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
                  {isSavingLogo && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-1">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-[9px] font-bold text-blue-800">جاري التثبيت...</span>
                    </div>
                  )}
                </div>

                {/* Upload Buttons & Options */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>{isSavingLogo ? 'جاري معالجة وحفظ الشعار...' : 'اختيار ملف لوجو من جهازك (PNG / JPG / SVG / WebP)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isSavingLogo}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsSavingLogo(true);
                            try {
                              const optimized = await compressAndOptimizeLogo(file);
                              handleChange('logoUrl', optimized);
                              await handleSaveLogoOnly(optimized);
                            } catch (uploadErr: any) {
                              setErrorMessage('فشل معالجة الشعار: ' + (uploadErr?.message || ''));
                            } finally {
                              setIsSavingLogo(false);
                              e.target.value = '';
                            }
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

                    {formData.logoUrl && (
                      <button
                        type="button"
                        disabled={isSavingLogo}
                        onClick={() => handleSaveLogoOnly()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingLogo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>تثبيت وحفظ الشعار في القاعدة</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    يتم ضغط الشعار تلقائياً وتخزينه كبيانات Base64 متوافقة مع قاعدة البيانات السحابية (Supabase) والذاكرة الدائمة، ليظل محفوظاً ولا يُمسح أبداً.
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

            {/* ENTERPRISE SQL MIGRATION V2 CARD */}
            <div className="bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#0F172A] text-white rounded-2xl p-6 shadow-lg border border-slate-700 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <span>اسكربت ترقية قاعدة البيانات المؤسسية (Enterprise SQL Migration V2)</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                          v2.0 Production Ready
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        حزمة تحديث شاملة لـ PostgreSQL / Supabase تضيف 12 جدولاً وعلاقات متقدمة مع المفاتيح الأجنبية والقيود المحاسبية.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenSqlModal}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-cyan-300" />
                    <span>عرض ونسخ كود الاسكربت</span>
                  </button>
                  <a
                    href="/api/database/migration-script/download"
                    download="supabase_enterprise_upgrade_v2.sql"
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>تحميل ملف SQL المعتمد</span>
                  </a>
                </div>
              </div>

              {/* 6 Modules Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-700/80 text-xs">
                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                    <Package className="w-3.5 h-3.5" />
                    <span>المستودعات المتعددة</span>
                  </div>
                  <p className="text-[10px] text-slate-400">تحويلات مخزنية وأرصدة لكل مخزن</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                    <Layers className="w-3.5 h-3.5" />
                    <span>مراكز التكلفة</span>
                  </div>
                  <p className="text-[10px] text-slate-400">توجيه تحليلي للفواتير والقيود</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px]">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>قوائم الأسعار</span>
                  </div>
                  <p className="text-[10px] text-slate-400">تسعير شرائحي وخصومات معتمدة</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>فروع العملاء</span>
                  </div>
                  <p className="text-[10px] text-slate-400">مواقع تسليم وفواتير لكل فرع</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>الفترات المالية</span>
                  </div>
                  <p className="text-[10px] text-slate-400">إغلاق الدفاتر وحماية القيود</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-300 font-bold text-[11px]">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>أوامر البيع والشراء</span>
                  </div>
                  <p className="text-[10px] text-slate-400">دورة مستندية تجارية متكاملة</p>
                </div>
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

      {/* Render Enterprise SQL Migration Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>اسكربت ترقية قاعدة البيانات المؤسسية (Enterprise SQL Migration V2)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono border border-emerald-500/40">
                      PostgreSQL / Supabase
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    12 جدولاً جديداً مع كافة الترابطات والمفاتيح الأجنبية، المشغلات (Triggers)، والعروض التحليلية المجمعة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all cursor-pointer"
              >
                <Sliders className="w-5 h-5" />
              </button>
            </div>

            {/* Quick How-To Instructions */}
            <div className="bg-slate-800/50 p-3 px-5 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>طريقة التشغيل: افتح <b>Supabase SQL Editor</b> أو <b>pgAdmin</b>، الصق الكود، واضغط <b>Run (Ctrl + Enter)</b>.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (sqlScriptContent) {
                      await navigator.clipboard.writeText(sqlScriptContent);
                      setIsSqlCopied(true);
                      setTimeout(() => setIsSqlCopied(false), 3000);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    isSqlCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{isSqlCopied ? 'تم نسخ الاسكربت بالكامل!' : 'نسخ كود الاسكربت'}</span>
                </button>
                <a
                  href="/api/database/migration-script/download"
                  download="supabase_enterprise_upgrade_v2.sql"
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل (.sql)</span>
                </a>
              </div>
            </div>

            {/* Script Code Viewer */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-[#0B1120] select-all leading-relaxed whitespace-pre" dir="ltr">
              {isLoadingSql ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>جاري تحميل نص الاسكربت...</span>
                </div>
              ) : (
                sqlScriptContent || '-- اضغط زر التحميل أو النسخ للبدء'
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <BadgeCheck className="w-4 h-4" />
                <span>آمن 100% ولا يحذف أي جداول أو بيانات قديمة (Non-Destructive Safe Schema)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Wizard Modal */}
      {showOnboardingWizard && company && (
        <CompanyOnboardingWizard
          company={company}
          onComplete={(updatedCompany) => {
            setShowOnboardingWizard(false);
            if (onSaveCompany) onSaveCompany(updatedCompany);
            if (onRefreshData) onRefreshData();
          }}
          onCancel={() => setShowOnboardingWizard(false)}
        />
      )}
    </div>
  );
};
