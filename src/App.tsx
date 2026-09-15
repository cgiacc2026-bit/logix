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
  CreditNote,
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
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView.tsx';
import { UnifiedBackupRestoreHub } from './components/UnifiedBackupRestoreHub.tsx';
import { BranchesManagementView } from './components/BranchesManagementView.tsx';
import { WarehousesManagementView } from './components/WarehousesManagementView.tsx';
import { DedicatedReportsWorkspace, ReportWorkspaceTab } from './components/DedicatedReportsWorkspace.tsx';
import { DocumentCycleModal, DocumentCycleTarget } from './components/DocumentCycleModal.tsx';
import { PrintDocumentModal } from './components/PrintDocumentModal.tsx';
import { AccountStatementModal } from './components/AccountStatementModal.tsx';
import { SuperAdminCompanyPortalModal } from './components/SuperAdminCompanyPortalModal.tsx';
import { AutoBackupController } from './components/AutoBackupController.tsx';
import { OnboardingGuideModal, OnboardingBannerWidget, loadOnboardingState } from './components/OnboardingGuide.tsx';
import { LoginView } from './components/LoginView.tsx';
import { CompanyOnboardingWizard } from './components/CompanyOnboardingWizard.tsx';
import { CompanyProvider, useCompany } from './contexts/CompanyContext.tsx';
import { ALWALEED_CANONICAL_UUID } from './services/supabaseClient.ts';
import { DataService, localDataStore } from './services/dataService.ts';
import { OperationsCenter } from './services/operationsCenter.ts';
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
  '/offers': 'offers',
  '/promotions': 'offers',
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
  'offers': 'عروض وباقات الأصناف الترويجية',
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

export function AppContent() {
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

  // Single Source of Truth for Company Profile and Currency
  const { currentCompany, currency, setCurrency, updateCompany, reloadCompany } = useCompany();
  const activeCompany = currentCompany;

  // Separation of Concerns: Dedicated Reports Workspace vs Operations
  const isReportTab = [
    'reports',
    'trial-balance',
    'ledger',
    'financials',
    'customer-statements',
    'supplier-statements',
    'stock-ledger',
    'statements',
  ].includes(activeTab);

  const getReportWorkspaceSubTab = (tab: TabType): ReportWorkspaceTab => {
    switch (tab) {
      case 'trial-balance':
        return 'trial-balance';
      case 'ledger':
        return 'general-ledger';
      case 'financials':
        return 'financials';
      case 'customer-statements':
      case 'statements':
        return 'customer-statements';
      case 'supplier-statements':
        return 'supplier-statements';
      case 'stock-ledger':
        return 'inventory-reports';
      case 'reports':
      default:
        return 'one-click';
    }
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // ERP State Data
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
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);

  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<Invoice | null>(null);
  const [selectedStatementEntity, setSelectedStatementEntity] = useState<{ id: string; type: 'CUSTOMER' | 'SUPPLIER' } | null>(null);
  const [cycleTargetDoc, setCycleTargetDoc] = useState<DocumentCycleTarget | null>(null);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);

  const handleOpenDocumentCycle = (target: DocumentCycleTarget) => {
    setCycleTargetDoc(target);
    setIsCycleModalOpen(true);
  };

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
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const handleLogin = async (user: SystemUser, selectedCompany?: CompanyProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    localStorage.setItem('logix_auth_session', JSON.stringify(user));
    if (selectedCompany) {
      await updateCompany(selectedCompany);
      if (selectedCompany.functionalCurrency) {
        await setCurrency(selectedCompany.functionalCurrency);
      }
    } else {
      const curCompId = localStorage.getItem('supabase_company_id');
      if (!curCompId || curCompId === 'default' || curCompId === 'default_tenant') {
        localStorage.setItem('supabase_company_id', ALWALEED_CANONICAL_UUID);
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
      const activeId = activeCompany?.id || localStorage.getItem('supabase_company_id') || 'default_tenant';
      const onboarding = loadOnboardingState(activeId);
      if (!onboarding.isDismissed && onboarding.completedSteps.length < 6) {
        const timer = setTimeout(() => {
          setIsOnboardingModalOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, activeCompany?.id]);

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
      await reloadCompany();
      await DataService.reconcileDocumentCycles();
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

      await DataService.autoMigrateItemOffersToInventory(compData?.id);
      const refreshedInventory = DataService.getLocalInventory();

      setKpis(kpisData);
      setAccounts(accsData || []);
      setJournals(jData || []);
      setInvoices(invData || []);
      setVouchers(vData || []);
      setCustomers(cData || []);
      setSuppliers(sData || []);
      setInventory(refreshedInventory.length > 0 ? refreshedInventory : (iData || []));
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
    // Auto-reconcile orphaned or disparate entity IDs with master customer records
    try {
      DataService.reconcileAndLinkInvoicesToMasterCustomers();
    } catch (err) {
      console.warn('Auto-reconciliation on mount:', err);
    }

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

    const handleErpDataChanged = () => {
      setCustomers(DataService.getLocalCustomers());
      setSuppliers(DataService.getLocalSuppliers());
      setInventory(DataService.getLocalInventory());
      setInvoices(DataService.getLocalInvoices());
      setVouchers(DataService.getLocalVouchers());
      setJournals(DataService.getLocalJournals());
      setAccounts(DataService.getLocalAccounts());
    };
    window.addEventListener('ERP_DATA_CHANGED', handleErpDataChanged);

    // Periodic fallback refresh (only if tab is active, every 3 minutes instead of aggressive 10-second polling)
    // Realtime changes are already handled immediately by DataSyncService and window focus
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshAllData(true);
      }
    }, 180000);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('ERP_DATA_CHANGED', handleErpDataChanged);
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
      await updateCompany(updated);
      await refreshAllData(true);
    } catch (err) {
      console.error('Error saving company:', err);
    }
  };

  // Currency handler that syncs with Company Profile
  const handleCurrencyChange = async (newCurr: string) => {
    await setCurrency(newCurr);
  };

  // Action Mutators with DataService (Zero Crash Guarantee)
  const handleAddAccount = async (accData: Partial<Account>) => {
    await DataService.createAccount(accData);
    await refreshAllData();
  };

  const handleUpdateAccount = async (id: string, accData: Partial<Account>) => {
    await OperationsCenter.executeAccountUpdate(id, accData);
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteAccount = async (id: string) => {
    await OperationsCenter.executeAccountDelete(id);
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateJournal = async (journalData: any) => {
    await OperationsCenter.executeJournalCreate(journalData);
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleUpdateJournal = async (id: string, journalData: any) => {
    await OperationsCenter.executeJournalUpdate(id, journalData);
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteJournal = async (id: string) => {
    setJournals((prev) => prev.filter((j) => j.id !== id));
    await OperationsCenter.executeJournalDelete(id);
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleReverseJournal = async (id: string, reason: string) => {
    await OperationsCenter.executeJournalReverse(id, reason);
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateInvoice = async (invoiceData: any) => {
    const newInvoice = await OperationsCenter.executeInvoiceCreate(invoiceData);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
    return newInvoice;
  };

  const handleUpdateInvoice = async (id: string, invoiceData: any) => {
    await OperationsCenter.executeInvoiceUpdate(id, invoiceData);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
  };

  const handlePostInvoice = async (id: string) => {
    await OperationsCenter.executeInvoicePost(id);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
  };

  const handleDeleteInvoice = async (id: string) => {
    await OperationsCenter.executeInvoiceDelete(id);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setInventory(DataService.getLocalInventory());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    refreshAllData(true);
  };

  const handleCancelInvoice = async (id: string, reason?: string) => {
    await OperationsCenter.executeInvoiceCancel(id, reason);
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
    setUnits(DataService.getLocalUnits());
    refreshAllData(true);
  };

  const handleUpdateUnit = async (id: string, data: any) => {
    await DataService.updateUnit(id, data);
    setUnits(DataService.getLocalUnits());
    refreshAllData(true);
  };

  const handleDeleteUnit = async (id: string) => {
    await DataService.deleteUnit(id);
    setUnits(DataService.getLocalUnits());
    refreshAllData(true);
  };

  const handleCreateVoucher = async (voucherData: any) => {
    await OperationsCenter.executeVoucherCreate(voucherData);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleUpdateVoucher = async (id: string, voucherData: any) => {
    await OperationsCenter.executeVoucherUpdate(id, voucherData);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCancelVoucher = async (id: string, reason: string) => {
    await OperationsCenter.executeVoucherCancel(id, reason);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteVoucher = async (id: string) => {
    await OperationsCenter.executeVoucherDelete(id);
    setVouchers(DataService.getLocalVouchers());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateCustomer = async (data: any) => {
    const compId = activeCompany?.id || localDataStore.getEffectiveCompanyId();
    await OperationsCenter.executeCustomerCreate(data, compId);
    setCustomers(DataService.getLocalCustomers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleUpdateCustomer = async (id: string, data: any) => {
    await OperationsCenter.executeCustomerUpdate(id, data);
    setCustomers(DataService.getLocalCustomers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    await OperationsCenter.executeCustomerDelete(id);
    setCustomers(DataService.getLocalCustomers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateSupplier = async (data: any) => {
    await OperationsCenter.executeSupplierCreate(data);
    setSuppliers(DataService.getLocalSuppliers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleUpdateSupplier = async (id: string, data: any) => {
    await OperationsCenter.executeSupplierUpdate(id, data);
    setSuppliers(DataService.getLocalSuppliers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    await OperationsCenter.executeSupplierDelete(id);
    setSuppliers(DataService.getLocalSuppliers());
    setJournals(DataService.getLocalJournals());
    setAccounts(DataService.getLocalAccounts());
    refreshAllData(true);
  };

  const handleCreateInventoryItem = async (data: any) => {
    const compId = activeCompany?.id || localDataStore.getEffectiveCompanyId();
    await OperationsCenter.executeInventoryCreate(data, compId);
    setInventory(DataService.getLocalInventory());
    setJournals(DataService.getLocalJournals());
    refreshAllData(true);
  };

  const handleUpdateInventoryItem = async (id: string, data: any) => {
    await OperationsCenter.executeInventoryUpdate(id, data);
    setInventory(DataService.getLocalInventory());
    setJournals(DataService.getLocalJournals());
    refreshAllData(true);
  };

  const handleDeleteInventoryItem = async (id: string) => {
    await OperationsCenter.executeInventoryDelete(id);
    setInventory(DataService.getLocalInventory());
    setJournals(DataService.getLocalJournals());
    refreshAllData(true);
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

  // Render Login Interface if not authenticated
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginView
        onLogin={handleLogin}
        availableUsers={users}
        currentCompany={activeCompany}
      />
    );
  }

  // Multi-Tenancy Clean Onboarding Enforcement:
  // For any new tenant, bypass the main view and guide them through the mandatory step-by-step onboarding wizard
  const isSpecialPreconfiguredTenant =
    activeCompany.id === '20000000-0000-0000-0000-000000000001' ||
    activeCompany.id === 'company-alwaleed-client-003' ||
    activeCompany.id === '30000000-0000-0000-0000-000000000002' ||
    activeCompany.id === 'company-demo-clients-002' ||
    activeCompany.id === '10000000-0000-0000-0000-000000000001' ||
    activeCompany.id === 'company-logix-official-001';

  const isOnboardingWizardDone = Boolean(
    activeCompany.isOnboardingComplete ||
    (typeof window !== 'undefined' &&
      (window.localStorage.getItem(`onboarding_wizard_completed_${activeCompany.id}`) === 'true' ||
       window.localStorage.getItem(`onboarding_wizard_completed_${activeCompany.id.replace(/-/g, '')}`) === 'true'))
  );

  if (!isSpecialPreconfiguredTenant && !isOnboardingWizardDone) {
    return (
      <CompanyOnboardingWizard
        company={activeCompany}
        onComplete={async (updatedCompany) => {
          await updateCompany(updatedCompany);
          if (updatedCompany.functionalCurrency) {
            await setCurrency(updatedCompany.functionalCurrency);
          }
          refreshAllData(true);
        }}
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
        onOpenJsonBackup={() => navigateToTab('backup-restore')}
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
          currentUser={currentUser}
          onLogout={handleLogout}
          onSaveCompany={handleSaveCompany}
          onRefreshAll={refreshAllData}
        />

        {/* Main View Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5">
          {/* 1. Executive Modern KPI Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
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
              <ExecutiveDashboardView
                company={activeCompany}
                currency={currency}
                customers={customers}
                suppliers={suppliers}
                inventory={inventory}
                invoices={invoices}
                vouchers={vouchers}
                accounts={accounts}
                journals={journals}
                warehouses={warehouses}
                onNavigateTab={(tab) => navigateToTab(tab as any)}
                onOpenDocumentCycle={handleOpenDocumentCycle}
              />
            </div>
          )}

          {/* 2. Dedicated Reports Workspace */}
          {isReportTab && (
            <DedicatedReportsWorkspace
              company={activeCompany}
              currency={currency}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              warehouses={warehouses}
              salesReps={salesReps}
              creditNotes={creditNotes}
              initialSubTab={getReportWorkspaceSubTab(activeTab)}
              onViewAccountStatement={(entityId, entityType) =>
                setSelectedStatementEntity({ id: entityId, type: entityType })
              }
              onViewInvoice={(inv) => setSelectedPrintInvoice(inv)}
              onNavigateTab={(tab) => navigateToTab(tab as any)}
              onOpenDocumentCycle={handleOpenDocumentCycle}
            />
          )}

          {/* 3. Direct Operational & Master Data Views (Zero Redundancy) */}
          {(activeTab === 'sales-invoices' || activeTab === 'invoices') && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="invoices"
              initialInvoiceFilter="SALES"
              hideSubTabBar={true}
              customViewTitle="فواتير ومرتجعات المبيعات"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'purchase-invoices' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="invoices"
              initialInvoiceFilter="PURCHASE"
              hideSubTabBar={true}
              customViewTitle="فواتير ومردودات الشراء"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {(activeTab === 'receipt-vouchers' || activeTab === 'vouchers') && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="vouchers"
              initialVoucherFilter="RECEIPT"
              hideSubTabBar={true}
              customViewTitle="سندات القبض والتحصيل"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'payment-vouchers' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="vouchers"
              initialVoucherFilter="PAYMENT"
              hideSubTabBar={true}
              customViewTitle="سندات الصرف وسداد الموردين"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'quotations' && (
            <QuotationsView
              company={activeCompany}
              quotations={quotations}
              salesReps={salesReps}
              customers={customers}
              inventory={inventory}
              currency={currency}
              onRefreshAll={refreshAllData}
              onNavigateTab={(tab) => navigateToTab(tab as any)}
            />
          )}

          {activeTab === 'customers' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="entities"
              initialEntityFilter="CUSTOMER"
              hideSubTabBar={true}
              customViewTitle="سجلات ودليل العملاء والجمعيات"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'suppliers' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="entities"
              initialEntityFilter="SUPPLIER"
              hideSubTabBar={true}
              customViewTitle="سجلات ودليل الموردين والمطاحن"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'entities' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="entities"
              initialEntityFilter="ALL"
              hideSubTabBar={true}
              customViewTitle="دليل وسجلات العملاء والموردين"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'inventory' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="inventory"
              hideSubTabBar={true}
              customViewTitle="دليل الأصناف وكارت الصنف"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'units' && (
            <InvoicesAndInventoryView
              company={activeCompany!}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              journals={journals}
              creditNotes={creditNotes}
              units={units}
              currency={currency}
              salesReps={salesReps}
              warehouses={warehouses}
              activeSubTab="units"
              hideSubTabBar={true}
              customViewTitle="وحدات القياس والشد (Units)"
              onRefreshAll={refreshAllData}
              onOpenDocumentCycle={handleOpenDocumentCycle}
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
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeTab === 'warehouses' && (
            <WarehousesManagementView
              company={activeCompany!}
              inventory={inventory}
              currency={currency}
              onRefreshAll={refreshAllData}
              onNavigateTab={(tab) => navigateToTab(tab as any)}
            />
          )}

          {activeTab === 'branches' && (
            <BranchesManagementView
              company={activeCompany!}
              warehouses={warehouses}
              accounts={accounts}
              currency={currency}
              onRefreshAll={refreshAllData}
            />
          )}

          {activeTab === 'production' && (
            <ProductionOrdersView
              company={activeCompany!}
              productionOrders={productionOrders}
              inventory={inventory}
              currency={currency}
              onCreateProductionOrder={handleCreateProductionOrder}
            />
          )}

          {activeTab === 'sales-reps' && (
            <SalesRepsView
              company={activeCompany}
              salesReps={salesReps}
              invoices={invoices}
              vouchers={vouchers}
              inventory={inventory}
              warehouses={warehouses}
              currency={currency}
              onRefreshAll={refreshAllData}
            />
          )}

          {activeTab === 'pos' && (
            <PosTerminalView
              company={activeCompany}
              inventory={inventory}
              customers={customers}
              salesReps={salesReps}
              warehouses={warehouses}
              currency={currency}
              onRefreshAll={refreshAllData}
            />
          )}

          {activeTab === 'accounts' && (
            <ChartOfAccountsView
              accounts={accounts}
              journals={journals}
              currency={currency}
              onAddAccount={handleAddAccount}
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
              onSelectAccountLedger={(accId) => {
                setSelectedLedgerAccountId(accId);
                navigateToTab('ledger' as any);
              }}
              onOpenDocumentCycle={handleOpenDocumentCycle}
            />
          )}

          {activeTab === 'journals' && (
            <JournalEntriesView
              journals={journals}
              accounts={accounts}
              customers={customers}
              suppliers={suppliers}
              currency={currency}
              onCreateJournal={handleCreateJournal}
              onUpdateJournal={handleUpdateJournal}
              onDeleteJournal={handleDeleteJournal}
              onReverseJournal={handleReverseJournal}
              companyName={activeCompany?.nameAr}
              onOpenDocumentCycle={handleOpenDocumentCycle}
              onNavigateToAccount={(accId) => {
                setSelectedLedgerAccountId(accId);
                navigateToTab('ledger' as any);
              }}
              onNavigateToLedger={(accId) => {
                setSelectedLedgerAccountId(accId);
                navigateToTab('ledger' as any);
              }}
              onNavigateToStatement={(entityId, type) => {
                setSelectedStatementEntity({ id: entityId, type });
              }}
            />
          )}

          {activeTab === 'stock-ledger' && (
            <StockLedgerAndAuditView
              inventory={inventory}
              invoices={invoices}
              productionOrders={productionOrders}
              currency={currency}
              onRefreshData={refreshAllData}
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
              onNavigateTab={(tab) => navigateToTab(tab as any)}
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

      {/* Document Lifecycle & Traceability Modal */}
      <DocumentCycleModal
        isOpen={isCycleModalOpen}
        onClose={() => {
          setIsCycleModalOpen(false);
          setCycleTargetDoc(null);
        }}
        targetDoc={cycleTargetDoc}
        invoices={invoices}
        journals={journals}
        vouchers={vouchers}
        quotations={quotations}
        accounts={accounts}
        customers={customers}
        suppliers={suppliers}
        currency={currency}
        onNavigateToInvoice={(invId) => {
          setIsCycleModalOpen(false);
          navigateToTab('sales-invoices');
        }}
        onNavigateToJournal={(jId) => {
          setIsCycleModalOpen(false);
          navigateToTab('journals');
        }}
        onNavigateToVoucher={(vId) => {
          setIsCycleModalOpen(false);
          navigateToTab('receipt-vouchers');
        }}
        onNavigateToAccount={(accId) => {
          setIsCycleModalOpen(false);
          navigateToTab('accounts');
        }}
        onNavigateToLedger={(accId) => {
          setIsCycleModalOpen(false);
          setSelectedLedgerAccountId(accId);
          navigateToTab('ledger');
        }}
        onNavigateToStatement={(entityId, type) => {
          setIsCycleModalOpen(false);
          setSelectedStatementEntity({ id: entityId, type });
          navigateToTab(type === 'CUSTOMER' ? 'customer-statements' : 'supplier-statements');
        }}
        onPrintInvoice={(inv) => {
          setIsCycleModalOpen(false);
          setSelectedPrintInvoice(inv);
        }}
      />

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

export default function App() {
  return (
    <CompanyProvider>
      <AppContent />
    </CompanyProvider>
  );
}
