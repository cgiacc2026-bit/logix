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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
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

      const [invData, vData, cData, sData, iData, uData, prdData, quoData, repsData, usersData] =
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
    await DataService.createInvoice(invoiceData);
    setInvoices(DataService.getLocalInvoices());
    setJournals(DataService.getLocalJournals());
    setCustomers(DataService.getLocalCustomers());
    setSuppliers(DataService.getLocalSuppliers());
    setInventory(DataService.getLocalInventory());
    refreshAllData(true);
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
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-row font-['Cairo',sans-serif] rtl">
      {/* Auto Backup Background Controller */}
      <AutoBackupController companyId={activeCompany.id} companyName={activeCompany.nameAr} />

      {/* Side Navigation Bar (الايقونات في الجنب) */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unpaidCount={unpaidInvoices.length}
        company={activeCompany}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenCompanySetup={() => setActiveTab('company')}
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
          onOpenCompanySetup={() => setActiveTab('company')}
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
              onNavigateTab={(tab) => setActiveTab(tab)}
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
              onNavigateTab={(tab) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              kpis={kpis}
              currency={currency}
              recentJournals={journals}
              unpaidInvoices={unpaidInvoices}
              allInvoices={invoices}
              vouchers={vouchers}
              accounts={accounts}
              inventory={inventory}
              company={activeCompany}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onNewJournal={() => setActiveTab('journals')}
              onNewInvoice={() => setActiveTab('invoices')}
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
              onSelectAccountLedger={(accountId) => {
                setSelectedLedgerAccountId(accountId);
                setActiveTab('ledger');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <OperationalReportsView
              invoices={invoices}
              vouchers={vouchers}
              customers={customers}
              suppliers={suppliers}
              accounts={accounts}
              journals={journals}
              inventory={inventory}
              company={activeCompany}
              currency={currency}
              onViewInvoice={(inv) => setSelectedPrintInvoice(inv)}
              onViewAccountStatement={(entityId, entityType) =>
                setSelectedStatementEntity({ id: entityId, type: entityType })
              }
            />
          )}

          {activeTab === 'journals' && (
            <JournalEntriesView
              journals={journals}
              accounts={accounts}
              customers={customers}
              suppliers={suppliers}
              currency={currency}
              companyName={company?.nameAr}
              onCreateJournal={handleCreateJournal}
              onUpdateJournal={handleUpdateJournal}
              onDeleteJournal={handleDeleteJournal}
              onReverseJournal={handleReverseJournal}
            />
          )}

          {activeTab === 'ledger' && (
            <GeneralLedgerView
              accounts={accounts}
              journals={journals}
              currency={currency}
              selectedAccountId={selectedLedgerAccountId}
            />
          )}

          {activeTab === 'trial-balance' && <TrialBalanceView currency={currency} />}

          {activeTab === 'financials' && <FinancialStatementsView currency={currency} />}

          {activeTab === 'statements' && (
            <AccountStatementView
              customers={customers}
              suppliers={suppliers}
              invoices={invoices}
              vouchers={vouchers}
              journals={journals}
              company={activeCompany}
              currency={currency}
            />
          )}

          {activeTab === 'quotations' && (
            <QuotationsView
              quotations={quotations}
              customers={customers}
              salesReps={salesReps}
              inventory={inventory}
              company={activeCompany}
              currency={currency}
              onRefreshAll={refreshAllData}
              onNavigateTab={(tab) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'pos' && (
            <PosTerminalView
              inventory={inventory}
              customers={customers}
              salesReps={salesReps}
              company={activeCompany}
              currency={currency}
              onRefreshAll={refreshAllData}
            />
          )}

          {activeTab === 'sales-reps' && (
            <SalesRepsView
              salesReps={salesReps}
              invoices={invoices}
              vouchers={vouchers}
              company={activeCompany}
              currency={currency}
              onRefreshAll={refreshAllData}
            />
          )}

          {activeTab === 'production' && (
            <ProductionOrdersView
              productionOrders={productionOrders}
              inventory={inventory}
              company={activeCompany}
              currency={currency}
              onCreateProductionOrder={handleCreateProductionOrder}
            />
          )}

          {activeTab === 'stock-ledger' && (
            <StockLedgerAndAuditView
              inventory={inventory}
              invoices={invoices}
              currency={currency}
              isAlwaleed={activeCompanyId === '20000000-0000-0000-0000-000000000001'}
            />
          )}

          {(activeTab === 'invoices' ||
            activeTab === 'inventory' ||
            activeTab === 'vouchers' ||
            activeTab === 'entities' ||
            activeTab === 'units') && (
            <InvoicesAndInventoryView
              company={activeCompany}
              customers={customers}
              suppliers={suppliers}
              inventory={inventory}
              invoices={invoices}
              vouchers={vouchers}
              units={units}
              currency={currency}
              activeSubTab={
                activeTab === 'inventory'
                  ? 'inventory'
                  : activeTab === 'vouchers'
                  ? 'vouchers'
                  : activeTab === 'entities'
                  ? 'entities'
                  : activeTab === 'units'
                  ? 'units'
                  : 'invoices'
              }
              onSubTabChange={(sub) => setActiveTab(sub)}
              accounts={accounts}
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
              productionOrders={productionOrders}
              onRefreshAll={refreshAllData}
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
        <footer className="bg-[#F7F5F0] border-t border-[#E5E1DA] text-center text-xs text-[#8C8273] py-4 no-print font-serif">
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
          isSuperAdmin={currentUser?.role === 'ADMIN'}
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
