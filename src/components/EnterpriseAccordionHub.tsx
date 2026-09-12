import React, { useState, useEffect } from 'react';
import {
  CompanyProfile,
  Customer,
  Supplier,
  InventoryItem,
  Invoice,
  PaymentVoucher,
  Account,
  JournalEntry,
  ProductionOrder,
  Quotation,
  SalesRep,
  Warehouse,
  UnitDefinition,
  FinancialKPIs,
} from '../types.js';
import { TabType } from './Navigation.tsx';
import { formatCurrency } from '../utils/formatters.ts';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Scale,
  Store,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  BarChart3,
  DollarSign,
  TrendingUp,
  Layers,
  Building2,
  FileSpreadsheet,
  Receipt,
  BookOpen,
  Ruler,
  Factory,
  Warehouse as WarehouseIcon,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

// Operational Views
import { InvoicesAndInventoryView } from './InvoicesAndInventoryView.tsx';
import { QuotationsView } from './QuotationsView.tsx';
import { WarehousesManagementView } from './WarehousesManagementView.tsx';
import { SalesRepsView } from './SalesRepsView.tsx';
import { ProductionOrdersView } from './ProductionOrdersView.tsx';
import { ChartOfAccountsView } from './ChartOfAccountsView.tsx';
import { JournalEntriesView } from './JournalEntriesView.tsx';
import { PosTerminalView } from './PosTerminalView.tsx';
import { BranchesManagementView } from './BranchesManagementView.tsx';

// Sub-Reports
import { SalesReportsView } from './subreports/SalesReportsView.tsx';
import { PurchasingReportsView } from './subreports/PurchasingReportsView.tsx';
import { InventoryReportsView } from './subreports/InventoryReportsView.tsx';
import { PosReportsView } from './subreports/PosReportsView.tsx';
import { TrialBalanceView } from './TrialBalanceView.tsx';
import { GeneralLedgerView } from './GeneralLedgerView.tsx';
import { FinancialStatementsView } from './FinancialStatementsView.tsx';

export type AccordionPanelId = 'sales' | 'purchases' | 'inventory' | 'accounting' | 'pos';

interface EnterpriseAccordionHubProps {
  company: CompanyProfile | null;
  currency: string;
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  accounts: Account[];
  journals: JournalEntry[];
  productionOrders: ProductionOrder[];
  quotations: Quotation[];
  salesReps: SalesRep[];
  warehouses: Warehouse[];
  units?: UnitDefinition[];
  kpis: FinancialKPIs | null;
  activeTab: TabType;
  onNavigateTab: (tab: TabType) => void;
  onRefreshAll: () => Promise<void> | void;
  // Mutations
  onCreateInvoice: (data: any) => Promise<any>;
  onUpdateInvoice?: (id: string, data: any) => Promise<void>;
  onPostInvoice: (id: string) => Promise<void>;
  onCancelInvoice?: (id: string, reason?: string) => Promise<void>;
  onDeleteInvoice?: (id: string) => Promise<void>;
  onCreateVoucher: (data: any) => Promise<void>;
  onUpdateVoucher?: (id: string, data: any) => Promise<void>;
  onCancelVoucher?: (id: string, reason: string) => Promise<void>;
  onDeleteVoucher?: (id: string) => Promise<void>;
  onCreateCustomer: (data: any) => Promise<void>;
  onUpdateCustomer?: (id: string, data: any) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
  onCreateSupplier: (data: any) => Promise<void>;
  onUpdateSupplier?: (id: string, data: any) => Promise<void>;
  onDeleteSupplier?: (id: string) => Promise<void>;
  onCreateInventoryItem: (data: any) => Promise<void>;
  onUpdateInventoryItem?: (id: string, data: any) => Promise<void>;
  onDeleteInventoryItem?: (id: string) => Promise<void>;
  handleAddAccount: (acc: any) => Promise<void>;
  handleUpdateAccount: (id: string, acc: any) => Promise<void>;
  handleDeleteAccount: (id: string) => Promise<void>;
  handleCreateJournal: (entry: any) => Promise<void>;
  handleUpdateJournal: (id: string, entry: any) => Promise<void>;
  handleDeleteJournal: (id: string) => Promise<void>;
  handleReverseJournal: (id: string, reason: string) => Promise<void>;
  handleCreateProductionOrder: (data: any) => Promise<void>;
  onViewPrintInvoice: (inv: Invoice) => void;
  onViewAccountStatement: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER') => void;
}

export const EnterpriseAccordionHub: React.FC<EnterpriseAccordionHubProps> = ({
  company,
  currency,
  customers,
  suppliers,
  inventory,
  invoices,
  vouchers,
  accounts,
  journals,
  productionOrders,
  quotations,
  salesReps,
  warehouses,
  units = [],
  kpis,
  activeTab,
  onNavigateTab,
  onRefreshAll,
  onCreateInvoice,
  onUpdateInvoice,
  onPostInvoice,
  onCancelInvoice,
  onDeleteInvoice,
  onCreateVoucher,
  onUpdateVoucher,
  onCancelVoucher,
  onDeleteVoucher,
  onCreateCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onCreateInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  handleAddAccount,
  handleUpdateAccount,
  handleDeleteAccount,
  handleCreateJournal,
  handleUpdateJournal,
  handleDeleteJournal,
  handleReverseJournal,
  handleCreateProductionOrder,
  onViewPrintInvoice,
  onViewAccountStatement,
}) => {
  // Determine initial active panel based on activeTab
  const getPanelForTab = (tab: TabType): AccordionPanelId | null => {
    switch (tab) {
      case 'sales-invoices':
      case 'quotations':
      case 'customers':
      case 'customer-statements':
      case 'receipt-vouchers':
        return 'sales';
      case 'purchase-invoices':
      case 'suppliers':
      case 'supplier-statements':
      case 'payment-vouchers':
        return 'purchases';
      case 'inventory':
      case 'stock-ledger':
      case 'warehouses':
      case 'sales-reps':
      case 'production':
      case 'units':
        return 'inventory';
      case 'accounts':
      case 'journals':
      case 'ledger':
      case 'trial-balance':
      case 'financials':
      case 'statements':
        return 'accounting';
      case 'pos':
      case 'branches':
        return 'pos';
      default:
        return null;
    }
  };

  // State: Single Active Panel
  const [activePanel, setActivePanel] = useState<AccordionPanelId | null>(() => getPanelForTab(activeTab));

  // State: Operational Mode vs Reports Mode for each panel
  const [panelMode, setPanelMode] = useState<Record<AccordionPanelId, 'operations' | 'reports'>>({
    sales: 'operations',
    purchases: 'operations',
    inventory: 'operations',
    accounting: 'operations',
    pos: 'operations',
  });

  // State: Operational Subtab for each panel
  const [salesSubTab, setSalesSubTab] = useState<'sales-invoices' | 'quotations' | 'customers' | 'receipt-vouchers'>('sales-invoices');
  const [purchasesSubTab, setPurchasesSubTab] = useState<'purchase-invoices' | 'suppliers' | 'payment-vouchers'>('purchase-invoices');
  const [inventorySubTab, setInventorySubTab] = useState<'inventory' | 'warehouses' | 'sales-reps' | 'production' | 'units'>('inventory');
  const [accountingSubTab, setAccountingSubTab] = useState<'accounts' | 'journals'>('accounts');
  const [accountingReportSubTab, setAccountingReportSubTab] = useState<'trial-balance' | 'general-ledger' | 'financials'>('trial-balance');
  const [posSubTab, setPosSubTab] = useState<'pos-terminal' | 'branches'>('pos-terminal');
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');

  // Sync external tab navigation
  useEffect(() => {
    const targetPanel = getPanelForTab(activeTab);
    if (targetPanel) {
      setActivePanel(targetPanel);
      if (['sales-invoices', 'quotations', 'customers', 'receipt-vouchers'].includes(activeTab)) {
        setSalesSubTab(activeTab as any);
      } else if (['purchase-invoices', 'suppliers', 'payment-vouchers'].includes(activeTab)) {
        setPurchasesSubTab(activeTab as any);
      } else if (['inventory', 'warehouses', 'sales-reps', 'production', 'units'].includes(activeTab)) {
        setInventorySubTab(activeTab as any);
      } else if (['accounts', 'journals'].includes(activeTab)) {
        setAccountingSubTab(activeTab as any);
      } else if (['trial-balance', 'ledger', 'financials'].includes(activeTab)) {
        setPanelMode((prev) => ({ ...prev, accounting: 'reports' }));
        if (activeTab === 'trial-balance') setAccountingReportSubTab('trial-balance');
        if (activeTab === 'ledger') setAccountingReportSubTab('general-ledger');
        if (activeTab === 'financials') setAccountingReportSubTab('financials');
      } else if (['pos', 'branches'].includes(activeTab)) {
        setPosSubTab(activeTab === 'branches' ? 'branches' : 'pos-terminal');
      }
    }
  }, [activeTab]);

  // Handler for opening/closing accordion panels (Single Active Panel - Auto-collapse others)
  const togglePanel = (panelId: AccordionPanelId) => {
    setActivePanel((current) => (current === panelId ? null : panelId));
  };

  // Helper to toggle between operations and reports
  const setMode = (panelId: AccordionPanelId, mode: 'operations' | 'reports') => {
    setPanelMode((prev) => ({ ...prev, [panelId]: mode }));
  };

  // KPI calculations for executive summary
  const totalSalesRevenue = invoices
    .filter((i) => i.type === 'SALES')
    .reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);

  const totalPurchasesAmount = invoices
    .filter((i) => i.type === 'PURCHASE')
    .reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);

  const totalInventoryAssetValue = inventory.reduce(
    (sum, i) =>
      sum +
      (Number(i.quantityOnHand) || Number(i.quantity) || 0) *
        (Number(i.costPrice) || Number(i.purchasePrice) || 0),
    0
  );

  const totalCustomersDue = customers.reduce(
    (sum, c) => sum + (Number(c.balance) || Number(c.currentBalance) || 0),
    0
  );

  return (
    <div className="space-y-4 pb-12">
      {/* 1. EXECUTIVE SUMMARY KPI RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="border-l border-slate-200 pl-3">
          <span className="text-[11px] font-bold text-slate-500 block">إجمالي مبيعات المؤسسة</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block mt-0.5">
            {formatCurrency(totalSalesRevenue, currency)}
          </span>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            {invoices.filter((i) => i.type === 'SALES').length} فاتورة مسجلة
          </span>
        </div>

        <div className="border-l border-slate-200 pl-3">
          <span className="text-[11px] font-bold text-slate-500 block">إجمالي المشتريات والتوريد</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block mt-0.5">
            {formatCurrency(totalPurchasesAmount, currency)}
          </span>
          <span className="text-[10px] text-slate-600 block mt-0.5">
            {invoices.filter((i) => i.type === 'PURCHASE').length} فاتورة شراء
          </span>
        </div>

        <div className="border-l border-slate-200 pl-3">
          <span className="text-[11px] font-bold text-slate-500 block">قيمة أصول المخزون</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block mt-0.5">
            {formatCurrency(totalInventoryAssetValue, currency)}
          </span>
          <span className="text-[10px] text-slate-600 block mt-0.5 font-mono">
            {inventory.length} صنف نشط
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-500 block">مستحقات العملاء (الذمم)</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block mt-0.5">
            {formatCurrency(totalCustomersDue, currency)}
          </span>
          <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
            {customers.length} عميل مسجل
          </span>
        </div>
      </div>

      {/* 2. THE 5 COLLAPSIBLE ACCORDION PANELS */}
      <div className="space-y-3">
        {/* ==================================================================== */}
        {/* PANEL 1: SALES & CUSTOMERS (قسم المبيعات والعملاء) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <button
            onClick={() => togglePanel('sales')}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activePanel === 'sales' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800'
              }`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    1. قسم المبيعات والعملاء
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                    Sales & Customers
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  إدارة فواتير البيع والمرتجعات، عروض الأسعار، سجلات العملاء، وسندات القبض
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {formatCurrency(totalSalesRevenue, currency)}
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  {invoices.filter((i) => i.type === 'SALES').length} فاتورة • {customers.length} عميل
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                {activePanel === 'sales' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* LAZY RENDERING: ONLY WHEN ACTIVE */}
          {activePanel === 'sales' && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
              {/* Executive Mode Switcher: Operations vs Reports */}
              <div className="flex items-center justify-center p-1 bg-slate-200/80 rounded-xl max-w-md mx-auto">
                <button
                  onClick={() => setMode('sales', 'operations')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.sales === 'operations'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🖥️ الشاشات والعمليات التشغيلية
                </button>
                <button
                  onClick={() => setMode('sales', 'reports')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.sales === 'reports'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📊 تقارير المبيعات المعتمدة
                </button>
              </div>

              {/* OPERATIONS VIEW */}
              {panelMode.sales === 'operations' && (
                <div className="space-y-4">
                  {/* Operation Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setSalesSubTab('sales-invoices')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salesSubTab === 'sales-invoices'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      فواتير ومرتجعات المبيعات
                    </button>
                    <button
                      onClick={() => setSalesSubTab('quotations')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salesSubTab === 'quotations'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      عروض الأسعار للعملاء
                    </button>
                    <button
                      onClick={() => setSalesSubTab('customers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salesSubTab === 'customers'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      دليل وسجلات العملاء
                    </button>
                    <button
                      onClick={() => setSalesSubTab('receipt-vouchers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        salesSubTab === 'receipt-vouchers'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      سندات القبض والتحصيل
                    </button>
                  </div>

                  {/* Operation Content */}
                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {salesSubTab === 'sales-invoices' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="invoices"
                        initialInvoiceFilter="SALES"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}

                    {salesSubTab === 'quotations' && (
                      <QuotationsView
                        company={company!}
                        quotations={quotations}
                        salesReps={salesReps}
                        customers={customers}
                        inventory={inventory}
                        currency={currency}
                        onRefreshAll={onRefreshAll}
                      />
                    )}

                    {salesSubTab === 'customers' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="entities"
                        initialEntityFilter="CUSTOMER"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}

                    {salesSubTab === 'receipt-vouchers' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="vouchers"
                        initialVoucherFilter="RECEIPT"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* REPORTS VIEW */}
              {panelMode.sales === 'reports' && (
                <SalesReportsView
                  invoices={invoices}
                  customers={customers}
                  inventory={inventory}
                  journals={journals}
                  accounts={accounts}
                  vouchers={vouchers}
                  company={company}
                  currency={currency}
                  onViewInvoice={onViewPrintInvoice}
                  onViewAccountStatement={(id) => onViewAccountStatement(id, 'CUSTOMER')}
                />
              )}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PANEL 2: PURCHASING & SUPPLIERS (قسم المشتريات والموردين) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <button
            onClick={() => togglePanel('purchases')}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activePanel === 'purchases' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800'
              }`}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    2. قسم المشتريات والموردين
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                    Purchasing & Suppliers
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  إدارة فواتير التوريد، استحقاقات الموردين، سندات الصرف، وتحليل تقلبات التكلفة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {formatCurrency(totalPurchasesAmount, currency)}
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  {invoices.filter((i) => i.type === 'PURCHASE').length} فاتورة شراء • {suppliers.length} مورد
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                {activePanel === 'purchases' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* LAZY RENDERING */}
          {activePanel === 'purchases' && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
              {/* Executive Mode Switcher: Operations vs Reports */}
              <div className="flex items-center justify-center p-1 bg-slate-200/80 rounded-xl max-w-md mx-auto">
                <button
                  onClick={() => setMode('purchases', 'operations')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.purchases === 'operations'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🖥️ الشاشات والعمليات التشغيلية
                </button>
                <button
                  onClick={() => setMode('purchases', 'reports')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.purchases === 'reports'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📊 تقارير المشتريات المعتمدة
                </button>
              </div>

              {/* OPERATIONS VIEW */}
              {panelMode.purchases === 'operations' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setPurchasesSubTab('purchase-invoices')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        purchasesSubTab === 'purchase-invoices'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      فواتير ومردودات المشتريات
                    </button>
                    <button
                      onClick={() => setPurchasesSubTab('suppliers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        purchasesSubTab === 'suppliers'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      دليل وسجلات الموردين
                    </button>
                    <button
                      onClick={() => setPurchasesSubTab('payment-vouchers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        purchasesSubTab === 'payment-vouchers'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      سندات الصرف وسداد الموردين
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {purchasesSubTab === 'purchase-invoices' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="invoices"
                        initialInvoiceFilter="PURCHASE"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}

                    {purchasesSubTab === 'suppliers' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="entities"
                        initialEntityFilter="SUPPLIER"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}

                    {purchasesSubTab === 'payment-vouchers' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="vouchers"
                        initialVoucherFilter="PAYMENT"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* REPORTS VIEW */}
              {panelMode.purchases === 'reports' && (
                <PurchasingReportsView
                  invoices={invoices}
                  suppliers={suppliers}
                  inventory={inventory}
                  company={company}
                  currency={currency}
                  onViewInvoice={onViewPrintInvoice}
                />
              )}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PANEL 3: INVENTORY & STOCK (قسم المخازن والمناديب) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <button
            onClick={() => togglePanel('inventory')}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activePanel === 'inventory' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800'
              }`}>
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    3. قسم المخازن والمناديب
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                    Inventory & Stock
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  كروت الأصناف، المستودعات، المناديب، التصنيع والتشغيل، ووحدات القياس والشد
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {formatCurrency(totalInventoryAssetValue, currency)}
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  {inventory.length} صنف • {warehouses.length} مخزن • {salesReps.length} مندوب
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                {activePanel === 'inventory' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* LAZY RENDERING */}
          {activePanel === 'inventory' && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
              {/* Executive Mode Switcher: Operations vs Reports */}
              <div className="flex items-center justify-center p-1 bg-slate-200/80 rounded-xl max-w-md mx-auto">
                <button
                  onClick={() => setMode('inventory', 'operations')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.inventory === 'operations'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🖥️ الشاشات والعمليات التشغيلية
                </button>
                <button
                  onClick={() => setMode('inventory', 'reports')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.inventory === 'reports'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📊 تقارير المخازن المعتمدة
                </button>
              </div>

              {/* OPERATIONS VIEW */}
              {panelMode.inventory === 'operations' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setInventorySubTab('inventory')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inventorySubTab === 'inventory'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      سجل الأصناف وإدارة المخزون
                    </button>
                    <button
                      onClick={() => setInventorySubTab('warehouses')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inventorySubTab === 'warehouses'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      المستودعات ومواقع التخزين
                    </button>
                    <button
                      onClick={() => setInventorySubTab('sales-reps')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inventorySubTab === 'sales-reps'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      المناديب ومسؤولو التوزيع
                    </button>
                    <button
                      onClick={() => setInventorySubTab('production')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inventorySubTab === 'production'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      قسم التصنيع والتشغيل
                    </button>
                    <button
                      onClick={() => setInventorySubTab('units')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inventorySubTab === 'units'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      وحدات القياس والشد
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {inventorySubTab === 'inventory' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="inventory"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}

                    {inventorySubTab === 'warehouses' && (
                      <WarehousesManagementView
                        company={company!}
                        inventory={inventory}
                        currency={currency}
                        onRefreshAll={async () => {
                          await onRefreshAll();
                        }}
                      />
                    )}

                    {inventorySubTab === 'sales-reps' && (
                      <SalesRepsView
                        company={company!}
                        salesReps={salesReps}
                        invoices={invoices}
                        vouchers={vouchers}
                        inventory={inventory}
                        warehouses={warehouses}
                        currency={currency}
                        onRefreshAll={async () => {
                          await onRefreshAll();
                        }}
                      />
                    )}

                    {inventorySubTab === 'production' && (
                      <ProductionOrdersView
                        company={company!}
                        productionOrders={productionOrders}
                        inventory={inventory}
                        currency={currency}
                        onCreateProductionOrder={handleCreateProductionOrder}
                      />
                    )}

                    {inventorySubTab === 'units' && (
                      <InvoicesAndInventoryView
                        company={company!}
                        customers={customers}
                        suppliers={suppliers}
                        inventory={inventory}
                        invoices={invoices}
                        vouchers={vouchers}
                        accounts={accounts}
                        units={units}
                        currency={currency}
                        activeSubTab="units"
                        onRefreshAll={onRefreshAll}
                        onCreateInvoice={onCreateInvoice}
                        onUpdateInvoice={onUpdateInvoice}
                        onPostInvoice={onPostInvoice}
                        onCancelInvoice={onCancelInvoice}
                        onDeleteInvoice={onDeleteInvoice}
                        onCreateVoucher={onCreateVoucher}
                        onUpdateVoucher={onUpdateVoucher}
                        onCancelVoucher={onCancelVoucher}
                        onDeleteVoucher={onDeleteVoucher}
                        onCreateCustomer={onCreateCustomer}
                        onUpdateCustomer={onUpdateCustomer}
                        onDeleteCustomer={onDeleteCustomer}
                        onCreateSupplier={onCreateSupplier}
                        onUpdateSupplier={onUpdateSupplier}
                        onDeleteSupplier={onDeleteSupplier}
                        onCreateInventoryItem={onCreateInventoryItem}
                        onUpdateInventoryItem={onUpdateInventoryItem}
                        onDeleteInventoryItem={onDeleteInventoryItem}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* REPORTS VIEW */}
              {panelMode.inventory === 'reports' && (
                <InventoryReportsView
                  inventory={inventory}
                  invoices={invoices}
                  journals={journals}
                  accounts={accounts}
                  salesReps={salesReps}
                  warehouses={warehouses}
                  company={company}
                  currency={currency}
                />
              )}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PANEL 4: ACCOUNTING & FINANCE (قسم الحسابات والمالية) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <button
            onClick={() => togglePanel('accounting')}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activePanel === 'accounting' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800'
              }`}>
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    4. قسم الحسابات والمالية
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                    Accounting & Finance
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  دليل الحسابات، قيود اليومية، ميزان المراجعة، الأستاذ العام، والقوائم المالية الختامية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {accounts.length} حساب مالي
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  {journals.length} قيد محاسبي مسجل
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                {activePanel === 'accounting' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* LAZY RENDERING */}
          {activePanel === 'accounting' && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
              {/* Executive Mode Switcher: Operations vs Reports */}
              <div className="flex items-center justify-center p-1 bg-slate-200/80 rounded-xl max-w-md mx-auto">
                <button
                  onClick={() => setMode('accounting', 'operations')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.accounting === 'operations'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🖥️ الشاشات والعمليات التشغيلية
                </button>
                <button
                  onClick={() => setMode('accounting', 'reports')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.accounting === 'reports'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📊 تقارير الحسابات المعتمدة
                </button>
              </div>

              {/* OPERATIONS VIEW */}
              {panelMode.accounting === 'operations' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setAccountingSubTab('accounts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountingSubTab === 'accounts'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      دليل وشجرة الحسابات (COA)
                    </button>
                    <button
                      onClick={() => setAccountingSubTab('journals')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountingSubTab === 'journals'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      سجل قيود اليومية العامة
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {accountingSubTab === 'accounts' && (
                      <ChartOfAccountsView
                        accounts={accounts}
                        journals={journals}
                        currency={currency}
                        onAddAccount={handleAddAccount}
                        onUpdateAccount={handleUpdateAccount}
                        onDeleteAccount={handleDeleteAccount}
                        onSelectAccountLedger={(accId) => {
                          setSelectedLedgerAccountId(accId);
                          setPanelMode((prev) => ({ ...prev, accounting: 'reports' }));
                          setAccountingReportSubTab('general-ledger');
                        }}
                      />
                    )}

                    {accountingSubTab === 'journals' && (
                      <JournalEntriesView
                        journals={journals}
                        accounts={accounts}
                        currency={currency}
                        onCreateJournal={handleCreateJournal}
                        onUpdateJournal={handleUpdateJournal}
                        onDeleteJournal={handleDeleteJournal}
                        onReverseJournal={handleReverseJournal}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* REPORTS VIEW */}
              {panelMode.accounting === 'reports' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setAccountingReportSubTab('trial-balance')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountingReportSubTab === 'trial-balance'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ميزان المراجعة بالمجاميع والأرصدة
                    </button>
                    <button
                      onClick={() => setAccountingReportSubTab('general-ledger')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountingReportSubTab === 'general-ledger'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      دفتر الأستاذ العام
                    </button>
                    <button
                      onClick={() => setAccountingReportSubTab('financials')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountingReportSubTab === 'financials'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      قائمة الدخل والمركز المالي
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {accountingReportSubTab === 'trial-balance' && (
                      <TrialBalanceView
                        currency={currency}
                      />
                    )}

                    {accountingReportSubTab === 'general-ledger' && (
                      <GeneralLedgerView
                        accounts={accounts}
                        journals={journals}
                        currency={currency}
                        selectedAccountId={selectedLedgerAccountId}
                      />
                    )}

                    {accountingReportSubTab === 'financials' && (
                      <FinancialStatementsView
                        currency={currency}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PANEL 5: POS & SHIFTS (قسم نقاط البيع والورديات) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <button
            onClick={() => togglePanel('pos')}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activePanel === 'pos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800'
              }`}>
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    5. قسم نقاط البيع والورديات
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                    POS & Shift Management
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  شاشة الكاشير السريع، إعدادات الفروع ونقاط البيع، تقارير Z، وتدقيق الصندوق
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-emerald-700">
                  كاشير وورديات نشطة
                </span>
                <span className="text-[10px] text-slate-600 font-bold">
                  مبيعات الكاش والكي نت الفورية
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                {activePanel === 'pos' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* LAZY RENDERING */}
          {activePanel === 'pos' && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
              {/* Executive Mode Switcher: Operations vs Reports */}
              <div className="flex items-center justify-center p-1 bg-slate-200/80 rounded-xl max-w-md mx-auto">
                <button
                  onClick={() => setMode('pos', 'operations')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.pos === 'operations'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🖥️ الشاشات والعمليات التشغيلية
                </button>
                <button
                  onClick={() => setMode('pos', 'reports')}
                  className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelMode.pos === 'reports'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  📊 تقارير نقاط البيع المعتمدة
                </button>
              </div>

              {/* OPERATIONS VIEW */}
              {panelMode.pos === 'operations' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setPosSubTab('pos-terminal')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        posSubTab === 'pos-terminal'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      شاشة الكاشير ونقطة البيع السريعة
                    </button>
                    <button
                      onClick={() => setPosSubTab('branches')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        posSubTab === 'branches'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      إعدادات الفروع ونقاط البيع
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs">
                    {posSubTab === 'pos-terminal' && (
                      <PosTerminalView
                        inventory={inventory}
                        customers={customers}
                        salesReps={salesReps}
                        warehouses={warehouses}
                        company={company!}
                        currency={currency}
                        onRefreshAll={async () => {
                          await onRefreshAll();
                        }}
                      />
                    )}

                    {posSubTab === 'branches' && (
                      <BranchesManagementView
                        company={company!}
                        warehouses={warehouses}
                        accounts={accounts}
                        currency={currency}
                        onRefreshAll={async () => {
                          await onRefreshAll();
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* REPORTS VIEW */}
              {panelMode.pos === 'reports' && (
                <PosReportsView
                  invoices={invoices}
                  company={company}
                  currency={currency}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
