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
  Warehouse,
  CreditNote,
  SalesRep,
} from '../types.js';
import {
  FileBarChart,
  Scale,
  BookOpen,
  LineChart,
  Users,
  Building2,
  Package,
  TrendingUp,
  Sparkles,
  Printer,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
} from 'lucide-react';

// Report Views
import { OneClickExecutiveReportHub } from './OneClickExecutiveReportHub.tsx';
import { TrialBalanceView } from './TrialBalanceView.tsx';
import { GeneralLedgerView } from './GeneralLedgerView.tsx';
import { FinancialStatementsView } from './FinancialStatementsView.tsx';
import { AccountStatementView } from './AccountStatementView.tsx';
import { InventoryReportsView } from './subreports/InventoryReportsView.tsx';
import { SalesReportsView } from './subreports/SalesReportsView.tsx';

export type ReportWorkspaceTab =
  | 'one-click'
  | 'trial-balance'
  | 'general-ledger'
  | 'financials'
  | 'customer-statements'
  | 'supplier-statements'
  | 'inventory-reports'
  | 'sales-reports';

interface DedicatedReportsWorkspaceProps {
  company: CompanyProfile | null;
  currency: string;
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  accounts: Account[];
  journals: JournalEntry[];
  warehouses: Warehouse[];
  creditNotes?: CreditNote[];
  salesReps?: SalesRep[];
  initialSubTab?: ReportWorkspaceTab;
  onViewAccountStatement?: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER') => void;
  onViewInvoice?: (inv: Invoice) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DedicatedReportsWorkspace: React.FC<DedicatedReportsWorkspaceProps> = ({
  company,
  currency,
  customers,
  suppliers,
  inventory,
  invoices,
  vouchers,
  accounts,
  journals,
  warehouses,
  creditNotes = [],
  salesReps = [],
  initialSubTab = 'one-click',
  onViewAccountStatement,
  onViewInvoice,
  onNavigateTab,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<ReportWorkspaceTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveReportTab(initialSubTab);
    }
  }, [initialSubTab]);

  const reportTabs = [
    {
      id: 'one-click' as ReportWorkspaceTab,
      label: 'التقارير المجمعة بنقرة واحدة',
      shortLabel: 'التقارير المجمعة (One-Click)',
      icon: Sparkles,
      badge: 'فوري',
      accentColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'trial-balance' as ReportWorkspaceTab,
      label: 'ميزان المراجعة بالمجاميع والأرصدة',
      shortLabel: 'ميزان المراجعة',
      icon: Scale,
      badge: 'IFRS',
      accentColor: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      id: 'general-ledger' as ReportWorkspaceTab,
      label: 'دفتر الأستاذ العام والقيود اليومية',
      shortLabel: 'الأستاذ العام',
      icon: BookOpen,
      accentColor: 'text-sky-700 bg-sky-50 border-sky-200',
    },
    {
      id: 'financials' as ReportWorkspaceTab,
      label: 'القوائم المالية الختامية (الدخل والمركز المالي)',
      shortLabel: 'القوائم الختامية',
      icon: LineChart,
      accentColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'customer-statements' as ReportWorkspaceTab,
      label: 'كشوف حسابات العملاء والجمعيات التعاونية',
      shortLabel: 'كشوف العملاء',
      icon: Users,
      accentColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'supplier-statements' as ReportWorkspaceTab,
      label: 'كشوف حسابات الموردين ومطاحن البهارات',
      shortLabel: 'كشوف الموردين',
      icon: Building2,
      accentColor: 'text-rose-700 bg-rose-50 border-rose-200',
    },
    {
      id: 'inventory-reports' as ReportWorkspaceTab,
      label: 'حركة وتقييم المخزون وبطاقة الصنف',
      shortLabel: 'تقارير المخزون',
      icon: Package,
      accentColor: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      id: 'sales-reports' as ReportWorkspaceTab,
      label: 'التحليلات البيعية والتشغيلية',
      shortLabel: 'تحليلات المبيعات',
      icon: TrendingUp,
      accentColor: 'text-purple-700 bg-purple-50 border-purple-200',
    },
  ];

  return (
    <div className="space-y-4 pb-12 dir-rtl text-right font-sans">
      {/* 1. Header Banner for Dedicated Reports Hub */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileBarChart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  مركز التقارير والقوائم المالية المعتمدة
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  بيئة مخصصة ومستقلة
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                مساحة عمل معزولة للتحليل المالي، المراجعة والتدقيق، طباعة وتصدير الكشوفات بدون تداخل مع شاشات الإدخال
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs text-slate-600 self-stretch sm:self-auto justify-end">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">تقارير فورية ودقيقة (IFRS)</span>
            </div>
          </div>
        </div>

        {/* 2. Top Ergonomic Horizontal Tabs - Eye-Comfortable Styling */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReportTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReportTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.shortLabel}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.accentColor
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Dedicated Report Body: Active Selected View */}
      <div className="transition-all animate-fadeIn">
        {activeReportTab === 'one-click' && (
          <OneClickExecutiveReportHub
            company={company}
            currency={currency}
            customers={customers}
            suppliers={suppliers}
            inventory={inventory}
            invoices={invoices}
            vouchers={vouchers}
            accounts={accounts}
            journals={journals}
            warehouses={warehouses}
            onViewAccountStatement={(entityId, entityType) => {
              if (onViewAccountStatement) {
                onViewAccountStatement(entityId, entityType);
              } else {
                setActiveReportTab(entityType === 'CUSTOMER' ? 'customer-statements' : 'supplier-statements');
              }
            }}
            onViewInvoice={onViewInvoice}
          />
        )}

        {activeReportTab === 'trial-balance' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <TrialBalanceView currency={currency} />
          </div>
        )}

        {activeReportTab === 'general-ledger' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <GeneralLedgerView
              accounts={accounts}
              journals={journals}
              currency={currency}
              selectedAccountId=""
            />
          </div>
        )}

        {activeReportTab === 'financials' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <FinancialStatementsView currency={currency} />
          </div>
        )}

        {activeReportTab === 'customer-statements' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <AccountStatementView
              customers={customers}
              suppliers={suppliers}
              invoices={invoices}
              vouchers={vouchers}
              journals={journals}
              creditNotes={creditNotes}
              company={company}
              currency={currency}
              initialEntityType="CUSTOMER"
            />
          </div>
        )}

        {activeReportTab === 'supplier-statements' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <AccountStatementView
              customers={customers}
              suppliers={suppliers}
              invoices={invoices}
              vouchers={vouchers}
              journals={journals}
              creditNotes={creditNotes}
              company={company}
              currency={currency}
              initialEntityType="SUPPLIER"
            />
          </div>
        )}

        {activeReportTab === 'inventory-reports' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <InventoryReportsView
              inventory={inventory}
              invoices={invoices}
              salesReps={salesReps}
              warehouses={warehouses}
              journals={journals}
              accounts={accounts}
              company={company}
              currency={currency}
            />
          </div>
        )}

        {activeReportTab === 'sales-reports' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <SalesReportsView
              invoices={invoices}
              customers={customers}
              inventory={inventory}
              journals={journals}
              accounts={accounts}
              vouchers={vouchers}
              creditNotes={creditNotes}
              company={company}
              currency={currency}
              onViewInvoice={onViewInvoice}
              onViewAccountStatement={(id) => {
                if (onViewAccountStatement) {
                  onViewAccountStatement(id, 'CUSTOMER');
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
