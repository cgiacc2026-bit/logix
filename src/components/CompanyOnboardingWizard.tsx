import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  ShieldCheck,
  Store,
  BookOpen,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Package,
  Users,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  CompanyProfile,
  Account,
  Customer,
  InventoryItem,
  Warehouse,
  DefaultAccountsMapping,
  JournalEntry,
} from '../types';
import {
  localDataStore,
  generateCleanChartOfAccounts,
  getDefaultMappingForAccounts,
} from '../services/dataService';
import { SupabaseDataService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface CompanyOnboardingWizardProps {
  company: CompanyProfile;
  onComplete: (updatedCompany: CompanyProfile) => void;
  onCancel?: () => void;
}

interface OpeningCustomerRow {
  nameAr: string;
  phone: string;
  openingBalance: number;
}

interface OpeningInventoryRow {
  nameAr: string;
  code: string;
  unit: string;
  quantityOnHand: number;
  purchasePrice: number;
  salePrice: number;
}

export const CompanyOnboardingWizard: React.FC<CompanyOnboardingWizardProps> = ({
  company,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // STEP 1: البيانات القانونية والأساسية
  const [nameAr, setNameAr] = useState(company.nameAr || '');
  const [nameEn, setNameEn] = useState(company.nameEn || '');
  const [tradeName, setTradeName] = useState(company.tradeName || company.nameAr || '');
  const [crNumber, setCrNumber] = useState(company.crNumber || '');
  const [taxNumber, setTaxNumber] = useState(company.taxNumber || '');
  const [vatRate, setVatRate] = useState<number>(company.vatRate ?? 0);
  const [legalForm, setLegalForm] = useState(company.legalForm || 'شركة ذات مسؤولية محدودة (ذ.م.م)');
  const [currency, setCurrency] = useState(company.functionalCurrency || company.currency || 'KWD');
  const [decimalPlaces, setDecimalPlaces] = useState<number>(
    company.decimalPlaces ?? (['KWD', 'BHD', 'OMR'].includes(company.currency || 'KWD') ? 3 : 2)
  );
  const [country, setCountry] = useState(company.country || 'دولة الكويت');
  const [city, setCity] = useState(company.city || 'الكويت');
  const [phone, setPhone] = useState(company.phone || '');
  const [email, setEmail] = useState(company.email || '');
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');

  // STEP 2: الفروع ومستودع البداية
  const [branchName, setBranchName] = useState('الفرع الرئيسي');
  const [branchCode, setBranchCode] = useState('BR-01');
  const [branchAddress, setBranchAddress] = useState('المقر الرئيسي');
  const [warehouseName, setWarehouseName] = useState('المستودع المركزي العام');
  const [warehouseCode, setWarehouseCode] = useState('WH-01');
  const [warehouseKeeper, setWarehouseKeeper] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('المستودع الرئيسي');
  const [allowNegativeInventory, setAllowNegativeInventory] = useState(false);

  // STEP 3: الحسابات الافتراضية
  const cleanTemplateAccounts = React.useMemo(() => {
    return generateCleanChartOfAccounts(company.id);
  }, [company.id]);

  const defaultMapping = React.useMemo(() => {
    return getDefaultMappingForAccounts(cleanTemplateAccounts);
  }, [cleanTemplateAccounts]);

  const [accountsMapping, setAccountsMapping] = useState<DefaultAccountsMapping>({
    cashAccountId: defaultMapping.cashAccountId || 'acc-1113',
    bankAccountId: defaultMapping.bankAccountId || 'acc-1111',
    receivableAccountId: defaultMapping.receivableAccountId || 'acc-1120',
    payableAccountId: defaultMapping.payableAccountId || 'acc-2110',
    inventoryAccountId: defaultMapping.inventoryAccountId || 'acc-1130',
    salesAccountId: defaultMapping.salesAccountId || 'acc-4100',
    cogsAccountId: defaultMapping.cogsAccountId || 'acc-5100',
    retainedEarningsAccountId: defaultMapping.retainedEarningsAccountId || 'acc-3200',
    vatAccountId: defaultMapping.vatAccountId || 'acc-2120',
  });

  // STEP 4: خيارات بدء التشغيل والأرصدة الافتتاحية
  const [startMode, setStartMode] = useState<'scratch' | 'manual'>('scratch');
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [openingBank, setOpeningBank] = useState<number>(0);
  const [openingCustomers, setOpeningCustomers] = useState<OpeningCustomerRow[]>([]);
  const [openingInventory, setOpeningInventory] = useState<OpeningInventoryRow[]>([]);

  // Helpers for step validation
  const isStep1Valid = nameAr.trim().length > 2 && crNumber.trim().length > 0;
  const isStep2Valid = branchName.trim().length > 1 && warehouseName.trim().length > 1;
  const isStep3Valid = Boolean(
    accountsMapping.cashAccountId &&
    accountsMapping.salesAccountId &&
    accountsMapping.receivableAccountId &&
    accountsMapping.payableAccountId
  );

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    if (['KWD', 'BHD', 'OMR'].includes(newCurr)) {
      setDecimalPlaces(3);
    } else {
      setDecimalPlaces(2);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setLogoUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addCustomerRow = () => {
    setOpeningCustomers((prev) => [...prev, { nameAr: '', phone: '', openingBalance: 0 }]);
  };

  const updateCustomerRow = (idx: number, field: keyof OpeningCustomerRow, val: any) => {
    setOpeningCustomers((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const removeCustomerRow = (idx: number) => {
    setOpeningCustomers((prev) => prev.filter((_, i) => i !== idx));
  };

  const addInventoryRow = () => {
    const nextCode = `ITEM-${(openingInventory.length + 1).toString().padStart(3, '0')}`;
    setOpeningInventory((prev) => [
      ...prev,
      { nameAr: '', code: nextCode, unit: 'حبة', quantityOnHand: 1, purchasePrice: 0, salePrice: 0 },
    ]);
  };

  const updateInventoryRow = (idx: number, field: keyof OpeningInventoryRow, val: any) => {
    setOpeningInventory((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const removeInventoryRow = (idx: number) => {
    setOpeningInventory((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculations for Step 4
  const totalCustOpening = openingCustomers.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0);
  const totalStockOpening = openingInventory.reduce(
    (sum, item) => sum + (Number(item.quantityOnHand) || 0) * (Number(item.purchasePrice) || 0),
    0
  );
  const totalOpeningAssets = Number(openingCash) + Number(openingBank) + totalCustOpening + totalStockOpening;

  // Finalize setup
  const handleFinalizeLaunch = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const companyId = company.id;

      // 1. Build Updated Company Profile with Zero-Data-Leak guarantee
      const updatedProfile: CompanyProfile = {
        ...company,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || nameAr.trim(),
        tradeName: tradeName.trim() || nameAr.trim(),
        crNumber: crNumber.trim(),
        taxNumber: taxNumber.trim(),
        vatRate,
        legalForm,
        functionalCurrency: currency,
        currency: currency,
        decimalPlaces,
        country: country.trim(),
        city: city.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logoUrl: logoUrl.trim(),
        allowNegativeInventory,
        defaultAccounts: accountsMapping,
        isOnboardingComplete: true,
      };

      // 2. Setup Starting Branch and Warehouse
      const startingWarehouse: Warehouse = {
        id: `wh-${companyId.slice(0, 8)}-01`,
        code: warehouseCode.trim() || 'WH-01',
        nameAr: warehouseName.trim(),
        nameEn: 'Main Warehouse',
        location: warehouseLocation.trim() || city,
        keeperName: warehouseKeeper.trim(),
        isDefault: true,
        isActive: true,
      };

      // 3. Prepare Clean Chart of Accounts (IFRS Standard Template with 0 balances)
      const freshAccounts: Account[] = cleanTemplateAccounts.map((acc) => ({
        ...acc,
        balance: 0,
        companyId,
        company_id: companyId,
      }));

      // 4. Prepare Optional Opening Entities (if manual mode selected)
      const validCustomers: Customer[] = [];
      const validInventory: InventoryItem[] = [];

      if (startMode === 'manual') {
        openingCustomers.forEach((row, i) => {
          if (row.nameAr.trim()) {
            validCustomers.push({
              id: `cust-ob-${i + 1}`,
              code: `CUST-${(101 + i).toString()}`,
              nameAr: row.nameAr.trim(),
              nameEn: row.nameAr.trim(),
              phone: row.phone.trim(),
              balance: Number(row.openingBalance) || 0,
              openingBalance: Number(row.openingBalance) || 0,
              openingBalanceDate: new Date().toISOString().split('T')[0],
              isActive: true,
              companyId,
              company_id: companyId,
            } as Customer);
          }
        });

        openingInventory.forEach((row, i) => {
          if (row.nameAr.trim()) {
            const itemCode = row.code.trim() || `ITEM-${(i + 1).toString().padStart(3, '0')}`;
            validInventory.push({
              id: `inv-ob-${i + 1}`,
              sku: itemCode,
              code: itemCode,
              nameAr: row.nameAr.trim(),
              nameEn: row.nameAr.trim(),
              category: 'بضاعة عامة',
              unit: row.unit.trim() || 'حبة',
              unitsPerPack: 1,
              minQuantityAlert: 5,
              quantityOnHand: Number(row.quantityOnHand) || 0,
              purchasePrice: Number(row.purchasePrice) || 0,
              costPrice: Number(row.purchasePrice) || 0,
              salePrice: Number(row.salePrice) || Number(row.purchasePrice) * 1.25,
              defaultWarehouseId: startingWarehouse.id,
              isActive: true,
              companyId,
              company_id: companyId,
            } as unknown as InventoryItem);
          }
        });
      }

      // 5. Generate Opening Journal Entry if any manual balance was specified
      const openingJournals: JournalEntry[] = [];
      if (startMode === 'manual' && totalOpeningAssets > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const lines: any[] = [];
        let lineNo = 1;

        if (Number(openingCash) > 0) {
          lines.push({
            id: `jl-ob-${lineNo++}`,
            accountId: accountsMapping.cashAccountId || 'acc-1113',
            accountCode: '1113',
            accountNameAr: 'الخزينة النقدية الرئيسية',
            debit: Number(openingCash),
            credit: 0,
            description: 'الرصيد النقدي الافتتاحي بالخزينة',
          });
        }
        if (Number(openingBank) > 0) {
          lines.push({
            id: `jl-ob-${lineNo++}`,
            accountId: accountsMapping.bankAccountId || 'acc-1111',
            accountCode: '1111',
            accountNameAr: 'الحساب البنكي الجاري',
            debit: Number(openingBank),
            credit: 0,
            description: 'الرصيد البنكي الافتتاحي',
          });
        }
        if (totalCustOpening > 0) {
          lines.push({
            id: `jl-ob-${lineNo++}`,
            accountId: accountsMapping.receivableAccountId || 'acc-1120',
            accountCode: '1120',
            accountNameAr: 'العملاء والمدينون',
            debit: totalCustOpening,
            credit: 0,
            description: 'إجمالي الأرصدة الافتتاحية للمدينين والعملاء',
          });
        }
        if (totalStockOpening > 0) {
          lines.push({
            id: `jl-ob-${lineNo++}`,
            accountId: accountsMapping.inventoryAccountId || 'acc-1130',
            accountCode: '1130',
            accountNameAr: 'مخزون البضائع',
            debit: totalStockOpening,
            credit: 0,
            description: 'القيمة التكلفية الافتتاحية للمخزون الأولي',
          });
        }

        // Equity credit matching total assets
        lines.push({
          id: `jl-ob-${lineNo++}`,
          accountId: accountsMapping.retainedEarningsAccountId || 'acc-3200',
          accountCode: '3100',
          accountNameAr: 'رأس المال المكتتب / الأرصدة الافتتاحية',
          debit: 0,
          credit: totalOpeningAssets,
          description: 'رأس المال المقابل للأصول والأرصدة الافتتاحية',
        });

        openingJournals.push({
          id: `jv-ob-${companyId.slice(0, 8)}`,
          entryNumber: 'JV-OPENING-01',
          date: todayStr,
          reference: 'OB-INITIAL',
          description: 'القيد الافتتاحي التأسيسي للمنشأة',
          status: 'POSTED',
          totalDebit: totalOpeningAssets,
          totalCredit: totalOpeningAssets,
          createdAt: new Date().toISOString(),
          sourceModule: 'OPENING',
          lines,
        });

        // Update accounts balances matching the opening entry
        freshAccounts.forEach((acc) => {
          if (acc.id === accountsMapping.cashAccountId && Number(openingCash) > 0) {
            acc.balance = Number(openingCash);
          }
          if (acc.id === accountsMapping.bankAccountId && Number(openingBank) > 0) {
            acc.balance = Number(openingBank);
          }
          if (acc.id === accountsMapping.receivableAccountId && totalCustOpening > 0) {
            acc.balance = totalCustOpening;
          }
          if (acc.id === accountsMapping.inventoryAccountId && totalStockOpening > 0) {
            acc.balance = totalStockOpening;
          }
          if (acc.id === accountsMapping.retainedEarningsAccountId && totalOpeningAssets > 0) {
            acc.balance = totalOpeningAssets;
          }
        });
      }

      // 6. Save locally with strict isolation
      localDataStore.saveCompany(updatedProfile);
      localDataStore.saveWarehouses([startingWarehouse]);
      localDataStore.saveAccounts(freshAccounts);
      localDataStore.saveCustomers(validCustomers);
      localDataStore.saveSuppliers([]); // Zero Suppliers!
      localDataStore.saveInventory(validInventory);
      localDataStore.saveInvoices([]); // Zero Invoices!
      localDataStore.saveJournals(openingJournals);
      localDataStore.saveVouchers([]); // Zero Vouchers!
      localDataStore.markTenantInitialized();

      // Set persistence flags
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`onboarding_wizard_completed_${companyId}`, 'true');
        window.localStorage.setItem('activeCompanyId', companyId);
        window.localStorage.setItem('supabase_company_id', companyId);
      }

      // 7. Save to Cloud / Supabase if connected
      if (isSupabaseConfigured) {
        await Promise.allSettled([
          SupabaseDataService.saveCompany(updatedProfile, companyId),
          SupabaseDataService.saveWarehouses([startingWarehouse]),
          SupabaseDataService.saveAccounts(freshAccounts),
          validCustomers.length > 0 ? SupabaseDataService.saveCustomers(validCustomers) : Promise.resolve(),
          validInventory.length > 0 ? SupabaseDataService.saveInventory(validInventory) : Promise.resolve(),
          openingJournals.length > 0 ? SupabaseDataService.saveJournal(openingJournals[0]) : Promise.resolve(),
        ]);
      }

      // Notify parent to transition to clean workspace
      onComplete(updatedProfile);
    } catch (err: any) {
      console.error('Failed to complete onboarding wizard:', err);
      setSaveError(err.message || 'حدث خطأ أثناء حفظ بيانات التهيئة، الرجاء المحاولة مرة أخرى');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header with Title and Step Tracker */}
        <div className="bg-gradient-to-l from-emerald-600 to-teal-700 text-white p-6 relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white shadow-inner">
                <Sparkles className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">معالج إعداد الشركة الجديد</h1>
                  <span className="bg-emerald-500/40 text-emerald-100 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-400/30 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    عزل سحابي نظيف 100%
                  </span>
                </div>
                <p className="text-emerald-100/90 text-sm mt-0.5">
                  تهيئة بيئة العمل المؤسسية خطوة بخطوة بدون أي بيانات تجريبية سابقة
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg text-xs border border-white/10">
              <Lock className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-mono text-emerald-200">{company.id.slice(0, 13)}...</span>
            </div>
          </div>

          {/* Stepper tabs */}
          <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-white/15">
            {[
              { num: 1, label: 'البيانات الأساسية', icon: Building2 },
              { num: 2, label: 'الفروع والمستودعات', icon: Store },
              { num: 3, label: 'شجرة الحسابات', icon: BookOpen },
              { num: 4, label: 'جاهزية التشغيل', icon: Rocket },
            ].map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-emerald-900 shadow-md scale-[1.02]'
                      : isPast
                      ? 'bg-white/20 text-white'
                      : 'text-white/60'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      isActive
                        ? 'bg-emerald-700 text-white'
                        : isPast
                        ? 'bg-emerald-400 text-emerald-950 font-bold'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <span className="hidden sm:inline truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {saveError && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{saveError}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ================= STEP 1: LEGAL & CORE ================= */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold">الخطوة 1: البيانات القانونية والأساسية للمنشأة</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name Ar */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      اسم المنشأة بالعربية <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: شركة النماء للتجارة العامة"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Name En */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      اسم المنشأة بالإنجليزية (English Legal Name)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      placeholder="e.g. Al-Namaa General Trading W.L.L."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                    />
                  </div>

                  {/* Trade Name */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      الاسم التجاري / العلامة التجارية
                    </label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="الاسم المطبوع في الفواتير والمستندات"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Legal Form */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      الشكل القانوني
                    </label>
                    <select
                      value={legalForm}
                      onChange={(e) => setLegalForm(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="شركة ذات مسؤولية محدودة (ذ.م.م)">شركة ذات مسؤولية محدودة (ذ.م.م)</option>
                      <option value="مؤسسة فردية">مؤسسة فردية</option>
                      <option value="شركة مساهمة مقفلة (ش.م.ك.م)">شركة مساهمة مقفلة (ش.م.ك.م)</option>
                      <option value="شركة تضامنية">شركة تضامنية</option>
                      <option value="فرع شركة أجنبية">فرع شركة أجنبية</option>
                    </select>
                  </div>

                  {/* CR Number */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      رقم السجل التجاري (CR Number) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={crNumber}
                      onChange={(e) => setCrNumber(e.target.value)}
                      placeholder="مثال: 541092"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Tax/VAT Number */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      الرقم الضريبي (TIN / VAT Number)
                    </label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="اختياري إن وجد"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Currency Selection */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      العملة الوظيفية والافتراضية
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="BHD">دينار بحريني (BHD)</option>
                      <option value="OMR">ريال عماني (OMR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </div>

                  {/* Decimal Places */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                      عدد الخانات العشرية (Decimal Precision)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[2, 3, 4].map((dec) => (
                        <button
                          key={dec}
                          type="button"
                          onClick={() => setDecimalPlaces(dec)}
                          className={`py-2 px-3 text-xs rounded-lg font-bold border transition-colors ${
                            decimalPlaces === dec
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {dec} خانات {dec === 3 && '(مثل الدينار)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Country & City */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">الدولة</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">المدينة / المنطقة</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Logo & Identity */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-semibold mb-2 text-slate-700 dark:text-slate-300">
                    شعار المنشأة (Logo)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 overflow-hidden shrink-0 shadow-sm">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex gap-2">
                        <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          رفع ملف صورة
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="text-xs text-rose-600 hover:underline px-2"
                          >
                            حذف الشعار
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="أو أدخل رابط الشعار مباشرة (URL)"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 2: BRANCHES & WAREHOUSES ================= */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold">الخطوة 2: تهيئة الفرع والمستودع الرئيسي</h2>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                  سيتم إنشاء هذا الفرع والمستودع تلقائياً كمستودع افتراضي لمعاملات البيع والشراء الأولية. يمكنك إضافة أي عدد من الفروع والمستودعات لاحقاً من قسم إدارة المخزون.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Branch Details */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <Store className="w-4 h-4 text-emerald-600" />
                      بيانات الفرع الرئيسي
                    </h3>
                    <div>
                      <label className="block text-xs font-semibold mb-1">اسم الفرع الأول <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="مثال: الفرع الرئيسي - العاصمة"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">رمز الفرع (Code)</label>
                      <input
                        type="text"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">عنوان الفرع</label>
                      <input
                        type="text"
                        value={branchAddress}
                        onChange={(e) => setBranchAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Warehouse Details */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <Package className="w-4 h-4 text-teal-600" />
                      بيانات المستودع الافتراضي
                    </h3>
                    <div>
                      <label className="block text-xs font-semibold mb-1">اسم المستودع <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        value={warehouseName}
                        onChange={(e) => setWarehouseName(e.target.value)}
                        placeholder="مثال: المستودع المركزي الرئيسي"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">رمز المستودع (Code)</label>
                      <input
                        type="text"
                        value={warehouseCode}
                        onChange={(e) => setWarehouseCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">أمين المستودع (المسؤول)</label>
                      <input
                        type="text"
                        value={warehouseKeeper}
                        onChange={(e) => setWarehouseKeeper(e.target.value)}
                        placeholder="اسم الموظف أو أمين المستودع (اختياري)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Inventory policy setting */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">سياسة البيع بالسالب (Negative Inventory)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      السماح بإصدار فواتير بيع للأصناف حتى لو كان الرصيد المتوفر صفر أو سالب
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowNegativeInventory(!allowNegativeInventory)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      allowNegativeInventory ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        allowNegativeInventory ? 'left-1' : 'right-1'
                      }`}
                    />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 3: CHART OF ACCOUNTS ================= */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold">الخطوة 3: شجرة الحسابات النظيفة وربط الحسابات الافتراضية</h2>
                </div>

                {/* Guarantee Banner */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        شجرة حسابات قياسية معتمدة (IFRS Template)
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        تتضمن الأصول، الخصوم، حقوق الملكية، الإيرادات، والمصروفات بأرصدة صفرية بالكامل بدون أي عملاء أو موردين سابقين.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 shrink-0">
                    {cleanTemplateAccounts.length} حساب قياسي جاهز
                  </span>
                </div>

                {/* Account Mappings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'cashAccountId', label: 'حساب الخزينة / الصندوق الرئيسي', defaultCode: '1113' },
                    { key: 'bankAccountId', label: 'حساب البنك الرئيسي الجاري', defaultCode: '1111' },
                    { key: 'receivableAccountId', label: 'حساب العملاء والمدينون (الذمم المدينة)', defaultCode: '1120' },
                    { key: 'payableAccountId', label: 'حساب الموردون والدائنون (الذمم الدائنة)', defaultCode: '2110' },
                    { key: 'inventoryAccountId', label: 'حساب مخزون البضائع', defaultCode: '1130' },
                    { key: 'salesAccountId', label: 'حساب إيرادات المبيعات', defaultCode: '4100' },
                    { key: 'cogsAccountId', label: 'حساب تكلفة البضاعة المباعة', defaultCode: '5100' },
                    { key: 'retainedEarningsAccountId', label: 'حساب حقوق الملكية / رأس المال', defaultCode: '3200' },
                  ].map((mapItem) => {
                    const currentVal = (accountsMapping as any)[mapItem.key];
                    return (
                      <div key={mapItem.key} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40">
                        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          {mapItem.label}
                        </label>
                        <select
                          value={currentVal || ''}
                          onChange={(e) =>
                            setAccountsMapping((prev) => ({ ...prev, [mapItem.key]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          {cleanTemplateAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ================= STEP 4: OPERATIONAL READINESS ================= */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Rocket className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold">الخطوة 4: جاهزية التشغيل والأرصدة الافتتاحية</h2>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setStartMode('scratch')}
                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      startMode === 'scratch'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                          بدء العمل من الصفر (قاعدة بيانات نظيفة 100%)
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            startMode === 'scratch' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400'
                          }`}
                        >
                          {startMode === 'scratch' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        فتح مساحة العمل فوراً بدون أي معاملات سابقة، مع 0 عملاء، 0 موردين، 0 فواتير، و0 حركات قيد. الخيار الأمثل للمنشآت الجديدة أو عند بدء دورة مستندية من البداية.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      موصى به لضمان العزل التام
                    </div>
                  </div>

                  <div
                    onClick={() => setStartMode('manual')}
                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      startMode === 'manual'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                          إدخال أرصدة افتتاحية يدوياً (Manual Opening)
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            startMode === 'manual' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400'
                          }`}
                        >
                          {startMode === 'manual' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        إدخال الرصيد النقدي، البنكي، عملاء البداية، وأصناف المخزون الافتتاحية لإنشاء القيد التأسيسي تلقائياً.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      يتم إدخال الأرصدة يدوياً بواسطة مسؤول النظام فقط
                    </div>
                  </div>
                </div>

                {/* Manual Opening Balances Section */}
                {startMode === 'manual' && (
                  <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                    {/* Cash & Bank */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-xs font-semibold mb-1">الرصيد النقدي بالخزينة الافتتاحي ({currency})</label>
                        <input
                          type="number"
                          step="any"
                          value={openingCash || ''}
                          onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                          placeholder="0.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">الرصيد البنكي الافتتاحي ({currency})</label>
                        <input
                          type="number"
                          step="any"
                          value={openingBank || ''}
                          onChange={(e) => setOpeningBank(Number(e.target.value) || 0)}
                          placeholder="0.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                        />
                      </div>
                    </div>

                    {/* Opening Customers Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-600" />
                          أرصدة العملاء الافتتاحية (الذمم المدينة)
                        </h4>
                        <button
                          type="button"
                          onClick={addCustomerRow}
                          className="text-xs bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-200 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة عميل
                        </button>
                      </div>

                      {openingCustomers.length === 0 ? (
                        <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700">
                          لا يوجد عملاء مضافين (0 عملاء)
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {openingCustomers.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                              <input
                                type="text"
                                placeholder="اسم العميل"
                                value={row.nameAr}
                                onChange={(e) => updateCustomerRow(idx, 'nameAr', e.target.value)}
                                className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent"
                              />
                              <input
                                type="text"
                                placeholder="رقم الهاتف"
                                value={row.phone}
                                onChange={(e) => updateCustomerRow(idx, 'phone', e.target.value)}
                                className="w-28 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent"
                              />
                              <input
                                type="number"
                                step="any"
                                placeholder="الرصيد الافتتاحي"
                                value={row.openingBalance || ''}
                                onChange={(e) => updateCustomerRow(idx, 'openingBalance', Number(e.target.value) || 0)}
                                className="w-28 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent font-mono text-left"
                              />
                              <button
                                type="button"
                                onClick={() => removeCustomerRow(idx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Opening Inventory Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-teal-600" />
                          أصناف المخزون الافتتاحي
                        </h4>
                        <button
                          type="button"
                          onClick={addInventoryRow}
                          className="text-xs bg-teal-100 dark:bg-teal-950 hover:bg-teal-200 text-teal-800 dark:text-teal-200 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة صنف
                        </button>
                      </div>

                      {openingInventory.length === 0 ? (
                        <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700">
                          لا توجد أصناف مخزون مضافة (0 أصناف)
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {openingInventory.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                              <input
                                type="text"
                                placeholder="اسم الصنف"
                                value={row.nameAr}
                                onChange={(e) => updateInventoryRow(idx, 'nameAr', e.target.value)}
                                className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent"
                              />
                              <input
                                type="text"
                                placeholder="الوحدة"
                                value={row.unit}
                                onChange={(e) => updateInventoryRow(idx, 'unit', e.target.value)}
                                className="w-16 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent text-center"
                              />
                              <input
                                type="number"
                                step="any"
                                placeholder="الكمية"
                                value={row.quantityOnHand || ''}
                                onChange={(e) => updateInventoryRow(idx, 'quantityOnHand', Number(e.target.value) || 0)}
                                className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent font-mono text-center"
                              />
                              <input
                                type="number"
                                step="any"
                                placeholder="سعر التكلفة"
                                value={row.purchasePrice || ''}
                                onChange={(e) => updateInventoryRow(idx, 'purchasePrice', Number(e.target.value) || 0)}
                                className="w-24 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent font-mono text-left"
                              />
                              <button
                                type="button"
                                onClick={() => removeInventoryRow(idx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Opening Journal Summary */}
                    {totalOpeningAssets > 0 && (
                      <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        <span>إجمالي القيد الافتتاحي التأسيسي (رأس المال المقابل للأصول):</span>
                        <span className="text-base font-mono font-bold">
                          {totalOpeningAssets.toFixed(decimalPlaces)} {currency}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Final Summary Box */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ملخص جاهزية المنشأة للإطلاق:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500">اسم الشركة</div>
                      <div className="font-bold truncate">{nameAr}</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500">العملة الافتراضية</div>
                      <div className="font-bold">{currency} ({decimalPlaces} خانات)</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500">شجرة الحسابات</div>
                      <div className="font-bold text-emerald-600">{cleanTemplateAccounts.length} حساب نظيف</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500">وضع الإطلاق</div>
                      <div className="font-bold">{startMode === 'scratch' ? 'صفرية 100%' : 'أرصدة افتتاحية'}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                السابق
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && !isStep1Valid) return;
                  if (currentStep === 2 && !isStep2Valid) return;
                  if (currentStep === 3 && !isStep3Valid) return;
                  setCurrentStep((prev) => (prev + 1) as any);
                }}
                disabled={
                  (currentStep === 1 && !isStep1Valid) ||
                  (currentStep === 2 && !isStep2Valid) ||
                  (currentStep === 3 && !isStep3Valid)
                }
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalizeLaunch}
                disabled={isSaving}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري إعداد بيئة المنشأة المعزولة...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    اعتماد تهيئة المنشأة وبدء العمل
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
