import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  FileBarChart,
  FolderTree,
  Plus,
  ChevronDown,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  FileText,
  Users,
  Building2,
  Package,
  Scale,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Eye,
  Calendar,
  Building,
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';

interface ModernAccountingWorkspaceHeaderProps {
  activeTab: TabType;
  onNavigateTab: (tab: TabType) => void;
  company: CompanyProfile | null;
  currency: string;
  invoicesCount?: number;
  unpaidInvoicesCount?: number;
}

export type WorkspaceMode = 'dashboard' | 'operations' | 'reports' | 'master-data';

export const ModernAccountingWorkspaceHeader: React.FC<ModernAccountingWorkspaceHeaderProps> = ({
  activeTab,
  onNavigateTab,
  company,
  currency,
  invoicesCount = 0,
  unpaidInvoicesCount = 0,
}) => {
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  // Close Quick Create dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setIsQuickCreateOpen(false);
      }
    };
    if (isQuickCreateOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQuickCreateOpen]);

  // Determine current active workspace mode
  const currentMode: WorkspaceMode = (() => {
    if (activeTab === 'dashboard') return 'dashboard';
    if (
      [
        'reports',
        'trial-balance',
        'ledger',
        'financials',
        'customer-statements',
        'supplier-statements',
        'stock-ledger',
        'statements',
      ].includes(activeTab)
    ) {
      return 'reports';
    }
    if (
      [
        'accounts',
        'customers',
        'suppliers',
        'inventory',
        'warehouses',
        'branches',
        'units',
        'production',
        'sales-reps',
        'entities',
      ].includes(activeTab)
    ) {
      return 'master-data';
    }
    return 'operations';
  })();

  const handleModeChange = (mode: WorkspaceMode) => {
    switch (mode) {
      case 'dashboard':
        onNavigateTab('dashboard');
        break;
      case 'operations':
        onNavigateTab('sales-invoices');
        break;
      case 'reports':
        onNavigateTab('reports');
        break;
      case 'master-data':
        onNavigateTab('accounts');
        break;
    }
  };

  const handleQuickCreate = (targetTab: TabType) => {
    setIsQuickCreateOpen(false);
    onNavigateTab(targetTab);
  };

  return (
    <div className="mb-4 dir-rtl text-right font-sans">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 sm:p-2.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* 1. Scientific Accounting Workspace Mode Switcher (التقارير ليها مكان والمدخلات مكان) */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl w-full md:w-auto border border-slate-200/60 overflow-x-auto">
          {/* Dashboard Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentMode === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <LayoutDashboard className={`w-3.5 h-3.5 ${currentMode === 'dashboard' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>لوحة القيادة</span>
          </button>

          {/* Daily Operations Mode (الإدخالات والعمليات) */}
          <button
            type="button"
            onClick={() => handleModeChange('operations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentMode === 'operations'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${currentMode === 'operations' ? 'text-teal-600' : 'text-slate-500'}`} />
            <span>مركز الإدخالات والعمليات</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[9px] bg-teal-100 text-teal-800 font-mono">
              Daily
            </span>
          </button>

          {/* Master Data & Setup (البيانات الأساسية والدليل) */}
          <button
            type="button"
            onClick={() => handleModeChange('master-data')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentMode === 'master-data'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FolderTree className={`w-3.5 h-3.5 ${currentMode === 'master-data' ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>البيانات الأساسية والدليل</span>
          </button>

          {/* Reports & Statements Hub (مكان التقارير المعتمد) */}
          <button
            type="button"
            onClick={() => handleModeChange('reports')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentMode === 'reports'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 hover:text-emerald-950'
            }`}
          >
            <FileBarChart className="w-3.5 h-3.5" />
            <span>مكان التقارير والقوائم المالية</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
              currentMode === 'reports' ? 'bg-white/20 text-white' : 'bg-emerald-200/60 text-emerald-900'
            }`}>
              Reports Hub
            </span>
          </button>
        </div>

        {/* 2. Zoho Books-style Quick Actions & "+ New Transaction" Dropdown */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
          
          {/* Quick Transaction Action Button (+ معاملة جديدة) */}
          <div className="relative" ref={quickCreateRef}>
            <button
              type="button"
              onClick={() => setIsQuickCreateOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              title="إضافة وتسجيل معاملة جديدة بضغطة واحدة"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ معاملة جديدة</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isQuickCreateOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu - Zoho Books Style */}
            {isQuickCreateOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 z-50 text-right space-y-1 animate-in fade-in duration-150">
                <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>تسجيل عملية أو مستند فوري</span>
                  <span className="text-[10px] font-mono text-emerald-700">Quick Entry</span>
                </div>

                {/* Sales Section */}
                <div className="pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-bold text-slate-600">المبيعات والعملاء</div>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('sales-invoices')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>فاتورة مبيعات جديدة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('receipt-vouchers')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-teal-600" />
                    <span>سند قبض / تحصيل نقدي</span>
                  </button>
                </div>

                {/* Purchases Section */}
                <div className="pt-1 border-t border-slate-100">
                  <div className="px-2 py-0.5 text-[10px] font-bold text-slate-600">المشتريات والتوريد</div>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('purchase-invoices')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                    <span>فاتورة مشتريات مواد خام</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('payment-vouchers')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-rose-600" />
                    <span>سند صرف / دفعة للمورد</span>
                  </button>
                </div>

                {/* Accounting & Master Data */}
                <div className="pt-1 border-t border-slate-100">
                  <div className="px-2 py-0.5 text-[10px] font-bold text-slate-600">الحسابات والتعريفات</div>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('journals')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    <span>قيد يومية يدوي متوازن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('customers')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span>تسجيل عميل / جمعية جديدة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCreate('inventory')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-teal-600" />
                    <span>تعريف صنف جديد بالمخزون</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Eye-Comfort Indicator Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold">
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>ثيم مريح للعين (Zoho Standard)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
