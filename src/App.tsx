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
  SystemUser
} from './types.js';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TabType } from './components/Navigation.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { ChartOfAccountsView } from './components/ChartOfAccountsView.tsx';
import { JournalEntriesView } from './components/JournalEntriesView.tsx';
import { GeneralLedgerView } from './components/GeneralLedgerView.tsx';
import { TrialBalanceView } from './components/TrialBalanceView.tsx';
import { FinancialStatementsView } from './components/FinancialStatementsView.tsx';
import { InvoicesAndInventoryView } from './components/InvoicesAndInventoryView.tsx';
import { ProductionOrdersView } from './components/ProductionOrdersView.tsx';
import { AccountStatementView } from './components/AccountStatementView.tsx';
import { CompanySetupView } from './components/CompanySetupView.tsx';
import { UsersView } from './components/UsersView.tsx';
import { SystemResetPanel } from './components/SystemResetPanel.tsx';
import { AccountingCycleBar } from './components/AccountingCycleBar.tsx';
import { OperationalReportsView } from './components/OperationalReportsView.tsx';
import { PrintDocumentModal } from './components/PrintDocumentModal.tsx';
import { AccountStatementModal } from './components/AccountStatementModal.tsx';
import { LoginView } from './components/LoginView.tsx';
import { DataService } from './services/dataService.ts';

const DEFAULT_COMPANY: CompanyProfile = {
  id: 'company-logix-01',
  nameAr: 'مجموعة لوجيكس لإدارة الموارد السحابية',
  nameEn: 'LOGIX Cloud ERP Enterprise',
  tradeName: 'لوجيكس للحلول المالية والمحاسبية (LOGIX ERP)',
  legalForm: 'شركة مساهمة مقفلة (ش.م.ك)',
  crNumber: '1010998877',
  taxNumber: '300012345600003',
  chamberNumber: '889900',
  crIssueDate: '2020-01-01',
  crExpiryDate: '2030-01-01',
  buildingNo: 'برج لوجيكس للأعمال',
  streetName: 'طريق الملك فهد',
  district: 'حي العليا',
  city: 'الرياض',
  country: 'المملكة العربية السعودية',
  postalCode: '11564',
  additionalNo: '4421',
  phone: '+966 11 456 7890',
  mobile: '+966 50 123 4567',
  email: 'info@logixerp.com',
  website: 'https://logixerp.com',
  vatRate: 15,
  vatType: 'QUARTERLY',
  zatcaPhase: 'PHASE_2_INTEGRATED',
  zatcaEnv: 'PRODUCTION',
  fiscalYearStart: '2026-01-01',
  fiscalYearEnd: '2026-12-31',
  accountingBasis: 'ACCRUAL',
  functionalCurrency: 'SAR',
  inventoryCosting: 'WEIGHTED_AVERAGE',
  depreciationMethod: 'STRAIGHT_LINE',
  decimalPlaces: 2,
  generalManager: 'م. عبد العزيز بن فهد',
  financialManager: 'أ. ياسر القحطاني',
  chiefAccountant: 'أ. عبد الرحمن السعيد',
  headerNotes: 'نظام لوجيكس لإدارة وتخطيط الموارد السحابي (LOGIX Multi-Tenant ERP)',
  footerNotes: 'الدفع خلال 30 يوماً من تاريخ الفاتورة.',
  showDigitalStamp: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currency, setCurrency] = useState<string>('SAR');
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

  const handleLogin = (user: SystemUser, selectedCompany?: CompanyProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('logix_auth_session', JSON.stringify(user));
    if (selectedCompany) {
      setCompany(selectedCompany);
      if (selectedCompany.functionalCurrency) {
        setCurrency(selectedCompany.functionalCurrency);
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('logix_auth_session');
    localStorage.removeItem('supabase_company_id');
    localStorage.removeItem('supabase_company_info');
  };

  // Fetch all ERP system data from Supabase / DataService
  const refreshAllData = async () => {
    setIsLoadingData(true);
    try {
      const [compData, kpisData, accsData, jData, invData, vData, cData, sData, iData, uData, prdData, usersData] =
        await Promise.all([
          DataService.getCompany(),
          DataService.getKPIs(),
          DataService.getAccounts(),
          DataService.getJournals(),
          DataService.getInvoices(),
          DataService.getVouchers(),
          DataService.getCustomers(),
          DataService.getSuppliers(),
          DataService.getInventory(),
          DataService.getUnits(),
          DataService.getProductionOrders(),
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
      if (usersData && usersData.length > 0) {
        setUsers(usersData);
      }
    } catch (err) {
      console.error('Error fetching ERP data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    refreshAllData();
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
    await DataService.deleteJournal(id);
    await refreshAllData();
  };

  const handleReverseJournal = async (id: string, reason: string) => {
    await DataService.reverseJournal(id, reason);
    await refreshAllData();
  };

  const handleCreateInvoice = async (invoiceData: any) => {
    await DataService.createInvoice(invoiceData);
    await refreshAllData();
  };

  const handlePostInvoice = async (id: string) => {
    await DataService.postInvoice(id);
    await refreshAllData();
  };

  const handleDeleteInvoice = async (id: string) => {
    await DataService.deleteInvoice(id);
    await refreshAllData();
  };

  const handleCancelInvoice = async (id: string, reason?: string) => {
    await DataService.cancelInvoice(id, reason);
    await refreshAllData();
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
    await refreshAllData();
  };

  const handleCancelVoucher = async (id: string, reason: string) => {
    await DataService.cancelVoucher(id, reason);
    await refreshAllData();
  };

  const handleDeleteVoucher = async (id: string) => {
    await DataService.deleteVoucher(id);
    await refreshAllData();
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
        currentCompany={activeCompany}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-row font-['Cairo',sans-serif] rtl">
      {/* Side Navigation Bar (الايقونات في الجنب) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unpaidCount={unpaidInvoices.length}
        company={activeCompany}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenCompanySetup={() => setActiveTab('company')}
      />

      {/* Main Content Area Adjusted with Sidebar Margin */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-h-screen ${
          sidebarCollapsed ? 'mr-20' : 'mr-72'
        }`}
      >
        {/* Top Application Header */}
        <Header
          company={activeCompany}
          currency={currency}
          setCurrency={handleCurrencyChange}
          onOpenCompanySetup={() => setActiveTab('company')}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Main View Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
          {activeTab !== 'company' && (
            <AccountingCycleBar
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
              onCreateJournal={handleCreateJournal}
              onUpdateJournal={handleUpdateJournal}
              onDeleteJournal={handleDeleteJournal}
              onReverseJournal={handleReverseJournal}
            />
          )}

          {activeTab === 'ledger' && (
            <GeneralLedgerView
              accounts={accounts}
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

          {activeTab === 'production' && (
            <ProductionOrdersView
              productionOrders={productionOrders}
              inventory={inventory}
              company={activeCompany}
              currency={currency}
              onCreateProductionOrder={handleCreateProductionOrder}
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
              onCreateInvoice={handleCreateInvoice}
              onPostInvoice={handlePostInvoice}
              onCancelInvoice={handleCancelInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onCreateVoucher={handleCreateVoucher}
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
    </div>
  );
}
