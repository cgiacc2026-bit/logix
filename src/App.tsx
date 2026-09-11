import { isSupabaseConfigured } from './services/supabaseClient.ts';
import React, { useState, useEffect } from 'react';
import {
  Account,
  JournalEntry,
  Invoice,
  PaymentVoucher,
  Customer,
  Supplier,
  InventoryItem,
  FinancialKPIs,
  CompanyProfile,
  UnitDefinition,
  ProductionOrder,
  SystemUser,
  Quotation,
  SalesRep,
  Warehouse,
} from './types.js';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TabType } from './components/Navigation.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { ChartOfAccountsView } from './components/ChartOfAccountsView.tsx';
import { JournalEntriesView } from './components/JournalEntriesView.tsx';
import { GeneralLedgerView } from './components/GeneralLedgerView.tsx';
import { TrialBalanceView } from './components/TrialBalanceView.tsx';
import { StockLedgerAndAuditView } from './components/StockLedgerAndAuditView.tsx';
import { FinancialStatementsView } from './components/FinancialStatementsView.tsx';
import { InvoicesAndInventoryView } from './components/InvoicesAndInventoryView.tsx';
import { ProductionOrdersView } from './components/ProductionOrdersView.tsx';
import { AccountStatementView } from './components/AccountStatementView.tsx';
import { QuotationsView } from './components/QuotationsView.tsx';
import { PosTerminalView } from './components/PosTerminalView.tsx';
import { SalesRepsView } from './components/SalesRepsView.tsx';
import { CompanySetupView } from './components/CompanySetupView.tsx';
import { UsersView } from './components/UsersView.tsx';
import { SystemResetPanel } from './components/SystemResetPanel.tsx';
import { AccountingCycleBar } from './components/AccountingCycleBar.tsx';
import { OperationalReportsView } from './components/OperationalReportsView.tsx';
import { UnifiedBackupRestoreHub } from './components/UnifiedBackupRestoreHub.tsx';
import { BranchesManagementView } from './components/BranchesManagementView.tsx';
import { WarehousesManagementView } from './components/WarehousesManagementView.tsx';
import { EnterpriseAccordionHub } from './components/EnterpriseAccordionHub.tsx';
import { PrintDocumentModal } from './components/PrintDocumentModal.tsx';
import { AccountStatementModal } from './components/AccountStatementModal.tsx';
import { SuperAdminCompanyPortalModal } from './components/SuperAdminCompanyPortalModal.tsx';
import { JsonBackupRestoreModal } from './components/JsonBackupRestoreModal.tsx';
import { AutoBackupController } from './components/AutoBackupController.tsx';
import { OnboardingGuideModal, OnboardingBannerWidget, loadOnboardingState } from './components/OnboardingGuide.tsx';
import { LoginView } from './components/LoginView.tsx';
import { DataService } from './services/dataService.ts';
import { DataSyncService } from './services/dataSyncService.ts';
import { ThemeService, ThemeColor, ThemeMode } from './services/themeService.ts';
import {
  DEFAULT_COMPANY_PROFILE,
} from './server/defaultData.js';
import { Lock } from 'lucide-react';

const DEFAULT_COMPANY: CompanyProfile = DEFAULT_COMPANY_PROFILE;

const ROUTE_TO_TAB: Record<string, TabType> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/pos': 'pos',
  '/invoices': 'sales-invoices',
  '/sales-invoices': 'sales-invoices',
  '/purchase-invoices': 'purchase-invoices',
  '/invoices/sales': 'sales-invoices',
  '/invoices/purchases': 'purchase-invoices',
  '/quotations': 'quotations',
  '/ledger': 'ledger',
  '/journal-entries': 'journals',
  '/journals': 'journals',
  '/trial-balance': 'trial-balance',
  '/financials': 'financials',
  '/coa': 'accounts',
  '/accounts': 'accounts',
  '/inventory': 'inventory',
  '/stock-movement': 'stock-ledger',
  '/stock-ledger': 'stock-ledger',
  '/warehouses': 'warehouses',
  '/vouchers': 'receipt-vouchers',
  '/receipt-vouchers': 'receipt-vouchers',
  '/payment-vouchers': 'payment-vouchers',
  '/vouchers/receipt': 'receipt-vouchers',
  '/vouchers/payment': 'payment-vouchers',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/customer-statements': 'customer-statements',
  '/supplier-statements': 'supplier-statements',
  '/sales-reps': 'sales-reps',
  '/production': 'production',
  '/settings': 'company',
  '/settings/company': 'company',
  '/settings/pos': 'branches',
  '/settings/users': 'users',
  '/settings/backup': 'backup-restore',
  '/settings/reset': 'system-reset',
  '/branches': 'branches',
  '/company': 'company',
  '/users': 'users',
  '/backup-restore': 'backup-restore',
  '/reports': 'reports',
  '/system-reset': 'system-reset',
};

const TAB_STORAGE_KEY = 'logix_erp_active_tab';

const TAB_TITLES: Partial<Record<TabType, string>> = {
  'dashboard': 'لوحة المؤشرات العامة',
  'pos': 'نقطة البيع - الكاشير السريع',
  'sales-invoices': 'فواتير المبيعات',
  'purchase-invoices': 'فواتير المشتريات',
  'quotations': 'عروض الأسعار',
  'ledger': 'الأستاذ العام',
  'journals': 'قيود اليومية العامة',
  'trial-balance': 'ميزان المراجعة بالمجاميع والأرصدة',
  'financials': 'القوائم المالية والختامية',
  'accounts': 'دليل وشجرة الحسابات (COA)',
  'inventory': 'إدارة المخزون والأصناف',
  'stock-ledger': 'حركة المخزون التفصيلية',
  'warehouses': 'المستودعات والمخازن',
  'receipt-vouchers': 'سندات القبض',
  'payment-vouchers': 'سندات الصرف',
  'customers': 'دليل العملاء والفروع',
  'suppliers': 'دليل الموردين',
  'customer-statements': 'كشوف حسابات العملاء',
  'supplier-statements': 'كشوف حسابات الموردين',
  'sales-reps': 'المناديب ومسؤولو المبيعات',
  'production': 'التصنيع وتكاليف الإنتاج',
  'branches': 'إعدادات نقاط البيع والفروع',
  'company': 'بيانات الشركة والفرع',
  'users': 'المستخدمين والصلاحيات',
  'backup-restore': 'النسخ الاحتياطي والأرشفة',
  'reports': 'التقارير التحليلية والمالية',
  'system-reset': 'تهيئة وتصفير النظام',
};

function getTabFromCurrentUrl(): TabType {
  if (typeof window === 'undefined') return 'dashboard';
  
  // 1. First check persisted session tab
  try {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY) as TabType;
    if (saved && TAB_TITLES[saved]) {
      return saved;
    }
  } catch (_) {}

  // 2. Check if a legacy subpath was passed on initial entry
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  if (ROUTE_TO_TAB[path]) {
    return ROUTE_TO_TAB[path];
  }
  const rawHash = window.location.hash.replace(/^#\/?/, '/').toLowerCase().replace(/\/$/, '') || '/';
  if (ROUTE_TO_TAB[rawHash]) {
    return ROUTE_TO_TAB[rawHash];
  }
  return 'dashboard';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromCurrentUrl());

  // Radical Subpath Elimination: Always force URL bar to the clean root domain ('/')
  const navigateToTab = (newTab: TabType) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(TAB_STORAGE_KEY, newTab);
      } catch (_) {}

      // Clean away any subpaths or hashes radically, keeping strictly to root '/'
      if (window.location.pathname !== '/' || window.location.hash || window.location.search) {
        window.history.replaceState({ tab: newTab }, '', '/');
      }
      const title = TAB_TITLES[newTab] || 'نظام لوجيكس المحاسبي المتكامل';
      document.title = `${title} | LOGIX ERP`;
    }
  };

  useEffect(() => {
    // Radical Elimination of Subpaths: Immediately strip any subpath or hash from URL
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/' || window.location.hash || window.location.search) {
        window.history.replaceState({ tab: activeTab }, '', '/');
      }
      const initialTitle = TAB_TITLES[activeTab] || 'نظام لوجيكس المحاسبي المتكامل';
      document.title = `${initialTitle} | LOGIX ERP`;
    }
  }, [activeTab]);

  const [currency, setCurrency] = useState<string>('KWD');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // ERP State Data
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);

  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<Invoice | null>(null);
  const [selectedStatementEntity, setSelectedStatementEntity] = useState<{ id: string; type: 'CUSTOMER' | 'SUPPLIER' } | null>(null);

  // Authentication and Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem('logix_auth_session');
    return !!saved;
  });

  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('logix_auth_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [isJsonBackupModalOpen, setIsJsonBackupModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const handleLogin = (user: SystemUser, selectedCompany?: CompanyProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    localStorage.setItem('logix_auth_session', JSON.stringify(user));
    if (selectedCompany) {
      setCompany(selectedCompany);
      if (selectedCompany.functionalCurrency) {
        setCurrency(selectedCompany.functionalCurrency);
      }
    }
    refreshAllData();

    // Trigger onboarding guide if company hasn't completed or dismissed it
    const targetCompId = selectedCompany?.id || localStorage.getItem('supabase_company_id') || 'default_tenant';
    const onboarding = loadOnboardingState(targetCompId);
    if (!onboarding.isDismissed && onboarding.completedSteps.length < 6) {
      setTimeout(() => {
        setIsOnboardingModalOpen(true);
      }, 500);
    }
  };

  // Initialize ERP Theme and Day/Night mode on startup
  useEffect(() => {
    ThemeService.initTheme();
  }, []);

  // Check onboarding on initial authenticated load
  useEffect(() => {
    if (isAuthenticated) {
      const activeId = company?.id || localStorage.getItem('supabase_company_id') || 'default_tenant';
      const onboarding = loadOnboardingState(activeId);
      if (!onboarding.isDismissed && onboarding.completedSteps.length < 6) {
        const timer = setTimeout(() => {
          setIsOnboardingModalOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, company?.id]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('logix_auth_session');
    localStorage.removeItem('supabase_company_id');
    localStorage.removeItem('supabase_company_info');
    DataService.clearLocalMemory();
    setInvoices([]);
    setJournals([]);
    setAccounts([]);
    setCustomers([]);
    setSuppliers([]);
    setInventory([]);
    setVouchers([]);
    setProductionOrders([]);
    setQuotations([]);

  };

  // Fetch all ERP system data from Supabase / DataService
  const refreshAllData = async (silent: boolean = false) => {
    if (!silent) {
      setIsLoadingData(true);
    }
    try {
      const compData = await DataService.getCompany();
      const jData = await DataService.getJournals();
      const accsData = await DataService.getAccounts();
      const kpisData = await DataService.getKPIs();

      const [invData, vData, cData, sData, iData, uData, prdData, quoData, repsData, usersData, whData] =
        await Promise.all([
          DataService.getInvoices(),
          DataService.getVouchers(),
          DataService.getCustomers(),
          DataService.getSuppliers(),
          DataService.getInventory(),
          DataService.getUnits(),
          DataService.getProductionOrders(),
          DataService.getQuotations(),
          DataService.getSalesReps(),
          DataService.getUsers(),
          DataService.getWarehouses(),
        ]);

      setCompany(compData);
      if (compData?.functionalCurrency) {
        setCurrency(compData.functionalCurrency);
      }
      setKpis(kpisData);
      setAccounts(accsData || []);
      setJournals(jData || []);
      setInvoices(invData || []);
      setVouchers(vData || []);
      setCustomers(cData || []);
      setSuppliers(sData || []);
      setInventory(iData || []);
      setUnits(uData || []);
      setProductionOrders(prdData || []);
      setQuotations(quoData || []);
      setSalesReps(repsData || []);
      setWarehouses(whData || []);
      if (usersData && usersData.length > 0) {
        setUsers(usersData);
      }
    } catch (err) {
      console.error('Error fetching ERP data:', err);
    } finally {
      if (!silent) {
        setIsLoadingData(false);
      }
    }
  };

  useEffect(() => {
    refreshAllData();

    const handleSync = () => {
      refreshAllData(true);
    };
    
    // Start Realtime Data Sync
    if (isSupabaseConfigured) {
      DataSyncService.startRealtimeSync((tableName) => {
        // Trigger a background re-fetch for all essential data without showing the loading spinner
        console.log(`Realtime update received for ${tableName}. Refreshing data...`);
        refreshAllData(true);
      });
    }

    window.addEventListener('focus', handleSync);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('logix_erp_sync');
        bc.onmessage = (e) => {
          if (e.data && (e.data.type === 'JOURNAL_DELETED' || e.data.type === 'DATA_CHANGED')) {
            refreshAllData(true);
          }
        };
      }
    } catch {}

    const interval = setInterval(() => {
      refreshAllData(true);
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, []);

  const handleCreateProductionOrder = async (orderData: Partial<ProductionOrder>) => {
    await DataService.createProductionOrder(orderData);
    await refreshAllData();
  };

  // Company profile updater
  const handleSaveCompany = async (updated: CompanyProfile) => {
    try {
      const saved = await DataService.saveCompany(updated);
      setCompany(saved);
      if (saved.functionalCurrency) {
        setCurrency(saved.functionalCurrency);
      }
      await refreshAllData();
    } catch (err) {
      console.error('Error saving company:', err);
    }
  };

  // Currency handler that syncs with Company Profile
  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    if (company && company.functionalCurrency !== newCurr) {
      handleSaveCompany({ ...company, functionalCurrency: newCurr });
    }
  };

  // Action Mutators with DataService (Zero Crash Guarantee)
  const handleAddAccount = async (accData: Partial<Account>) => {
    await DataService.createAccount(accData);
    await refreshAllData();
  };

  const handleUpdateAccount = async (id: string, accData: Partial<Account>) => {
    await DataService.updateAccount(id, accData);
    await refreshAllData();
  };

  const handleDeleteAccount = async (id: string) => {
    await DataService.deleteAccount(id);
    await refreshAllData();
  };

  const handleCreateJournal = async (journalData: any) => {
    await DataService.createJournal(journalData);
    await refreshAllData();
  };

  const handleUpdateJournal = async (id: string, journalData: any) => {
    await DataService.updateJournal(id, journalData);
    await refreshAllData();
  };

  const handleDeleteJournal = async (id: string) => {
    setJournals((prev) => prev.filter((j) => j.id !== id));
    await DataService.deleteJournal(id);
    await refreshAllData(true);
  };

  const handleReverseJournal = async (id: string, reason: string) => {
    await DataService.reverseJournal(id, reason);
    await refreshAllData();
  };

  const handleCreateInvoice = async (invoiceData: any) => {
    const newInvoice = await DataService.createInvoice(invoiceData);
    setInvoices((prev) => [newInvoice, ...prev.filter((i) => i.id !== newInvoice.id)]);
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
    return newInvoice;
  };

  const handleUpdateInvoice = async (id: string, invoiceData: any) => {
    await DataService.updateInvoice(id, invoiceData);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
  };

  const handlePostInvoice = async (id: string) => {
    await DataService.postInvoice(id);
    setInvoices(DataService.getLocalInvoices());
    refreshAllData(true);
  };

  const handleDeleteInvoice = async (id: string) => {
    await DataService.deleteInvoice(id);
    setInvoices(DataService.getLocalInvoices());
    refreshAllData(true);
  };

  const handleCancelInvoice = async (id: string, reason?: string) => {
    await DataService.cancelInvoice(id, reason);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setInventory(DataService.getLocalInventory());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    refreshAllData(true);
  };

  // Units Handlers
  const handleCreateUnit = async (data: any) => {
    await DataService.createUnit(data);
    await refreshAllData();
  };

  const handleUpdateUnit = async (id: string, data: any) => {
    await DataService.updateUnit(id, data);
    await refreshAllData();
  };

  const handleDeleteUnit = async (id: string) => {
    await DataService.deleteUnit(id);
    await refreshAllData();
  };

  const handleCreateVoucher = async (voucherData: any) => {
    await DataService.createVoucher(voucherData);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleUpdateVoucher = async (id: string, voucherData: any) => {
    await DataService.updateVoucher(id, voucherData);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCancelVoucher = async (id: string, reason: string) => {
    await DataService.cancelVoucher(id, reason);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteVoucher = async (id: string) => {
    await DataService.deleteVoucher(id);
    setVouchers(DataService.getLocalVouchers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateCustomer = async (data: any) => {
    await DataService.createCustomer(data);
    await refreshAllData();
  };

  const handleUpdateCustomer = async (id: string, data: any) => {
    await DataService.updateCustomer(id, data);
    await refreshAllData();
  };

  const handleDeleteCustomer = async (id: string) => {
    await DataService.deleteCustomer(id);
    await refreshAllData();
  };

  const handleCreateSupplier = async (data: any) => {
    await DataService.createSupplier(data);
    await refreshAllData();
  };

  const handleUpdateSupplier = async (id: string, data: any) => {
    await DataService.updateSupplier(id, data);
    await refreshAllData();
  };

  const handleDeleteSupplier = async (id: string) => {
    await DataService.deleteSupplier(id);
    await refreshAllData();
  };

  const handleCreateInventoryItem = async (data: any) => {
    await DataService.createInventoryItem(data);
    await refreshAllData();
  };

  const handleUpdateInventoryItem = async (id: string, data: any) => {
    await DataService.updateInventoryItem(id, data);
    await refreshAllData();
  };

  const handleDeleteInventoryItem = async (id: string) => {
    await DataService.deleteInventoryItem(id);
    await refreshAllData();
  };

  const handleResetSeed = async () => {
    if (!confirm('هل أنت متأكد من تصفير وإعادة تهيئة النظام لقاعدة بيانات جديدة نظيفة وقابلة للتطوير؟')) return;
    setIsResetting(true);
    try {
      await DataService.resetDatabase();
      await DataService.ensureOpeningBalancesAndMasterData();
      await refreshAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  const unpaidInvoices = invoices.filter((i) => i.dueAmount > 0 && i.status !== 'CANCELLED');
  const activeCompany = company || DEFAULT_COMPANY;

  // Render Login Interface if not authenticated
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginView
        onLogin={handleLogin}
        availableUsers={users}
        currentCompany={null}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-row font-['Cairo',sans-serif] rtl">
      {/* Auto Backup Background Controller */}
      <AutoBackupController companyId={activeCompany.id} companyName={activeCompany.nameAr} />

      {/* Side Navigation Bar (الايقونات في الجنب) */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        unpaidCount={unpaidInvoices.length}
        company={activeCompany}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenCompanySetup={() => navigateToTab('company')}
        onOpenJsonBackup={() => setIsJsonBackupModalOpen(true)}
        onSaveCompany={handleSaveCompany}
      />

      {/* Main Content Area Adjusted with Sidebar Margin */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-h-screen ${
          sidebarCollapsed ? 'mr-16' : 'mr-64'
        }`}
      >


        {/* Top Application Header */}
        <Header
          company={activeCompany}
          currency={currency}
          setCurrency={handleCurrencyChange}
          onOpenCompanySetup={() => navigateToTab('company')}
          onOpenOnboardingGuide={() => setIsOnboardingModalOpen(true)}
          onOpenSuperAdminPortal={() => setIsSuperAdminModalOpen(true)}
          onOpenJsonBackup={() => setIsJsonBackupModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onSaveCompany={handleSaveCompany}
          onRefreshAll={refreshAllData}
        />

        {/* Main View Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5">
          {/* Step-by-Step Onboarding Interactive Banner (Prominently on Dashboard) */}
          {activeTab === 'dashboard' && (
            <OnboardingBannerWidget
              company={activeCompany}
              onOpenFullGuide={() => setIsOnboardingModalOpen(true)}
              onNavigateTab={(tab) => navigateToTab(tab)}
              accountsCount={accounts.length}
              customersCount={customers.length}
              suppliersCount={suppliers.length}
              inventoryCount={inventory.length}
              journalsCount={journals.length}
              invoicesCount={invoices.length}
            />
          )}

          {activeTab !== 'company' && (
            <AccountingCycleBar
              company={activeCompany}
              activeTab={activeTab}
              onNavigateTab={(tab) => navigateToTab(tab as any)}
            />
          )}

          {/* Enterprise 5-Section Collapsible Dynamic Accordion Architecture with Embedded Sub-Reports */}
          {!['company', 'users', 'backup-restore', 'system-reset'].includes(activeTab) && (
            <EnterpriseAccordionHub
              company={activeCompany}
              currency={currency}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              productionOrders={productionOrders}
              quotations={quotations}
              salesReps={salesReps}
              warehouses={warehouses}
              units={units}
              kpis={kpis}
              activeTab={activeTab}
              onNavigateTab={(tab) => navigateToTab(tab)}
              onRefreshAll={refreshAllData}
              onCreateInvoice={handleCreateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onPostInvoice={handlePostInvoice}
              onCancelInvoice={handleCancelInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onCreateVoucher={handleCreateVoucher}
              onUpdateVoucher={handleUpdateVoucher}
              onCancelVoucher={handleCancelVoucher}
              onDeleteVoucher={handleDeleteVoucher}
              onCreateCustomer={handleCreateCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onCreateSupplier={handleCreateSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onCreateInventoryItem={handleCreateInventoryItem}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              onDeleteInventoryItem={handleDeleteInventoryItem}
              handleAddAccount={handleAddAccount}
              handleUpdateAccount={handleUpdateAccount}
              handleDeleteAccount={handleDeleteAccount}
              handleCreateJournal={handleCreateJournal}
              handleUpdateJournal={handleUpdateJournal}
              handleDeleteJournal={handleDeleteJournal}
              handleReverseJournal={handleReverseJournal}
              handleCreateProductionOrder={handleCreateProductionOrder}
              onViewPrintInvoice={(inv) => setSelectedPrintInvoice(inv)}
              onViewAccountStatement={(entityId, entityType) =>
                setSelectedStatementEntity({ id: entityId, type: entityType })
              }
            />
          )}

          {activeTab === 'backup-restore' && (
            <UnifiedBackupRestoreHub
              company={activeCompany}
              currentUser={currentUser}
              currency={currency}
              onRefreshAll={refreshAllData}
              onNavigateTab={(tab) => navigateToTab(tab as any)}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
            />
          )}

          {activeTab === 'system-reset' && (
            <SystemResetPanel
              currentUser={currentUser}
              company={activeCompany}
              currency={currency}
              onResetComplete={refreshAllData}
            />
          )}

          {activeTab === 'company' && (
            <CompanySetupView
              company={activeCompany}
              accounts={accounts}
              onSaveCompany={handleSaveCompany}
              onRefreshData={refreshAllData}
              onResetDatabase={handleResetSeed}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 text-center text-xs text-slate-600 py-3.5 no-print font-sans">
          {activeCompany.nameAr} • نظام لوجيكس السحابي لإدارة وتخطيط الموارد LOGIX Enterprise Cloud ERP (IFRS Compliant)
        </footer>
      </div>

      {/* Invoice Quick View & Print Modal */}
      {selectedPrintInvoice && (
        <PrintDocumentModal
          documentType="INVOICE"
          data={selectedPrintInvoice}
          company={activeCompany}
          onClose={() => setSelectedPrintInvoice(null)}
        />
      )}

      {/* Entity Account Statement Modal */}
      {selectedStatementEntity && (
        <AccountStatementModal
          isOpen={true}
          onClose={() => setSelectedStatementEntity(null)}
          entityType={selectedStatementEntity.type}
          selectedEntityId={selectedStatementEntity.id}
          customers={customers}
          suppliers={suppliers}
          invoices={invoices}
          vouchers={vouchers}
          journals={journals}
          company={activeCompany}
          currency={currency}
        />
      )}

      {/* Super Admin Multi-Tenant Company Portal Modal */}
      <SuperAdminCompanyPortalModal
        isOpen={isSuperAdminModalOpen}
        onClose={() => setIsSuperAdminModalOpen(false)}
        currentUser={currentUser}
        onSwitchCompany={() => refreshAllData()}
      />

      {/* Direct JSON Backup & Restore Modal */}
      {isJsonBackupModalOpen && (
        <JsonBackupRestoreModal
          isOpen={true}
          onClose={() => setIsJsonBackupModalOpen(false)}
          currentCompanyId={activeCompany.id}
          currentCompanyName={activeCompany.nameAr}
          isSuperAdmin={Boolean(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.isPlatformAdmin || currentUser?.email === 'cgiacc2026@gmail.com')}
          onDataRestored={() => refreshAllData()}
        />
      )}

      {/* Step-by-Step Onboarding Interactive Guide Modal */}
      <OnboardingGuideModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        company={activeCompany}
        accountsCount={accounts.length}
        customersCount={customers.length}
        suppliersCount={suppliers.length}
        inventoryCount={inventory.length}
        journalsCount={journals.length}
        invoicesCount={invoices.length}
      />
    </div>
  );
}
