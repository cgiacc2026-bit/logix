import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderTree,
  FileText,
  BookOpen,
  Scale,
  LineChart,
  ShoppingBag,
  Package,
  DollarSign,
  Users2,
  Ruler,
  Building2,
  Users,
  Factory,
  ChevronRight,
  ChevronLeft,
  Cloud,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  BarChart3,
  FolderUp,
  Warehouse,
  ShoppingCart,
  UserCheck,
  Store,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile, SystemUser } from '../types.js';
import { isDemoActive } from '../services/demoService.js';
import { checkIsSupabaseConfigured } from '../services/supabaseClient.ts';
import { useTheme } from '../services/themeService.ts';

interface SidebarProps {
  currentUser?: SystemUser | null;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unpaidCount?: number;
  company: CompanyProfile | null;
  collapsed: boolean;
  setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCompanySetup: () => void;
  onOpenJsonBackup?: () => void;
  onSaveCompany?: (updated: CompanyProfile) => Promise<void> | void;
}

interface NavSection {
  id: string;
  title: string;
  items: {
    id: TabType;
    label: string;
    icon: any;
    badge?: number | string;
    color?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  unpaidCount = 0,
  company,
  collapsed,
  setCollapsed,
  onOpenCompanySetup,
  onOpenJsonBackup,
  onSaveCompany,
}) => {
  const {
    themeMode,
    effectiveMode,
    activePalette,
  } = useTheme(company);

  // Define the 6 clean enterprise modules
  const sections: NavSection[] = [
    {
      id: 'main',
      title: 'الرئيسية',
      items: [
        {
          id: 'dashboard',
          label: 'لوحة التحكم',
          icon: LayoutDashboard,
          color: 'text-cyan-400',
        },
      ],
    },
    {
      id: 'accounting',
      title: '1. المحاسبة المالية (Accounting)',
      items: [
        {
          id: 'accounts',
          label: 'دليل الحسابات',
          icon: FolderTree,
          color: 'text-teal-400',
        },
        {
          id: 'journals',
          label: 'القيود اليومية المتوازنة',
          icon: FileText,
          color: 'text-cyan-400',
        },
        {
          id: 'ledger',
          label: 'دفتر الأستاذ العام',
          icon: BookOpen,
          color: 'text-indigo-400',
        },
        {
          id: 'trial-balance',
          label: 'ميزان المراجعة',
          icon: Scale,
          color: 'text-emerald-400',
        },
        {
          id: 'financials',
          label: 'القوائم المالية الختامية',
          icon: LineChart,
          color: 'text-green-400',
        },
      ],
    },
    {
      id: 'sales',
      title: '2. المبيعات والعملاء (Sales)',
      items: [
        {
          id: 'sales-invoices',
          label: 'فواتير ومرتجعات المبيعات',
          icon: ShoppingBag,
          badge: unpaidCount > 0 ? unpaidCount : undefined,
          color: 'text-blue-400',
        },
        {
          id: 'quotations',
          label: 'عروض الأسعار',
          icon: FileText,
          color: 'text-sky-400',
        },
        {
          id: 'customers',
          label: 'سجلات العملاء والجمعيات',
          icon: Users2,
          color: 'text-indigo-400',
        },
        {
          id: 'receipt-vouchers',
          label: 'التحصيلات (سندات القبض)',
          icon: ArrowDownLeft,
          color: 'text-teal-400',
        },
        {
          id: 'customer-statements',
          label: 'كشوف حسابات العملاء',
          icon: BookOpen,
          color: 'text-amber-400',
        },
        {
          id: 'sales-reps',
          label: 'مناديب المبيعات والعمولات',
          icon: UserCheck,
          color: 'text-cyan-400',
        },
      ],
    },
    {
      id: 'purchasing',
      title: '3. المشتريات والموردين (Purchasing)',
      items: [
        {
          id: 'purchase-invoices',
          label: 'فواتير ومردودات الشراء',
          icon: ShoppingCart,
          color: 'text-amber-400',
        },
        {
          id: 'suppliers',
          label: 'سجلات الموردين والمطاحن',
          icon: Building2,
          color: 'text-orange-400',
        },
        {
          id: 'payment-vouchers',
          label: 'سداد الموردين (سندات الصرف)',
          icon: ArrowUpRight,
          color: 'text-rose-400',
        },
        {
          id: 'supplier-statements',
          label: 'كشوف حسابات الموردين',
          icon: BookOpen,
          color: 'text-amber-300',
        },
      ],
    },
    {
      id: 'inventory',
      title: '4. إدارة المخازن (Inventory)',
      items: [
        {
          id: 'inventory',
          label: 'سجل الأصناف وكارت الصنف',
          icon: Package,
          color: 'text-emerald-400',
        },
        {
          id: 'stock-ledger',
          label: 'أذون الحركات والجرد',
          icon: Layers,
          color: 'text-teal-400',
        },
        {
          id: 'warehouses',
          label: 'المستودعات ومواقع التخزين',
          icon: Warehouse,
          color: 'text-amber-400',
        },
        {
          id: 'units',
          label: 'وحدات القياس والشد',
          icon: Ruler,
          color: 'text-purple-400',
        },
        {
          id: 'production',
          label: 'قسم التصنيع والتشغيل',
          icon: Factory,
          color: 'text-amber-400',
        },
      ],
    },
    {
      id: 'pos',
      title: '5. نقاط البيع (POS)',
      items: [
        {
          id: 'pos',
          label: 'شاشة البيع السريعة والشفتات',
          icon: Store,
          color: 'text-purple-400',
        },
      ],
    },
    {
      id: 'settings',
      title: '6. الإدارة والإعدادات (Settings)',
      items: [
        {
          id: 'company',
          label: 'إعدادات الشركة والعملة',
          icon: Building2,
          color: 'text-violet-400',
        },
        {
          id: 'branches',
          label: 'إدارة الفروع ومحطات البيع',
          icon: Store,
          color: 'text-cyan-400',
        },
        {
          id: 'users',
          label: 'المستخدمون والصلاحيات (RBAC)',
          icon: Users,
          color: 'text-pink-400',
        },
        {
          id: 'backup-restore',
          label: 'مركز النسخ والاستعادة الموحد',
          icon: FolderUp,
          color: 'text-amber-300',
        },
        {
          id: 'reports',
          label: 'التقارير التشغيلية المجمعة',
          icon: BarChart3,
          color: 'text-sky-400',
        },
        {
          id: 'system-reset',
          label: 'تصفير النظام وبدء دورة',
          icon: RotateCcw,
          color: 'text-rose-400',
        },
      ],
    },
  ];

  // RBAC Filtering
  const isCashier = currentUser?.role === 'SALES';
  const isAccountant = currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'CHIEF_ACCOUNTANT';
  const isManager =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'GENERAL_MANAGER' ||
    !currentUser?.role;

  const filteredGroups = sections.map((group) => {
    return {
      ...group,
      items: group.items.filter((item) => {
        if (isManager) return true;
        if (isCashier) {
          return ['pos', 'dashboard', 'sales-invoices', 'quotations', 'receipt-vouchers'].includes(item.id);
        }
        if (isAccountant) {
          return !['company', 'users', 'system-reset', 'backup-restore'].includes(item.id);
        }
        return true;
      }),
    };
  });

  return (
    <aside
      className={`fixed top-0 right-0 h-screen z-40 flex flex-col transition-all duration-300 no-print border-l font-sans ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      style={{
        background: activePalette.sidebarBg,
        borderColor: activePalette.sidebarBorder,
      }}
    >
      {/* Sidebar Header */}
      <div className="h-[60px] flex items-center justify-between px-3 border-b border-white/10 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <div
              style={{ backgroundColor: activePalette.primaryColor }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold border border-white/20 shadow-xs shrink-0"
            >
              <span className="text-xs tracking-wider font-mono">LX</span>
            </div>
            <div className="truncate text-right">
              <div className="text-xs font-bold text-white leading-tight truncate font-serif">
                {company?.nameAr || 'نظام لوجيكس السحابي'}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Enterprise ERP v2026</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{ backgroundColor: activePalette.primaryColor }}
            className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-white font-bold border border-white/20 shadow-xs"
          >
            <span className="text-[10px] tracking-wider">LX</span>
          </div>
        )}

        <button
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
        {filteredGroups.map((section) => (
          <div key={section.id} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2.5 py-0.5 text-[10px] font-bold text-slate-400 tracking-wider border-b border-white/5 mb-1 pb-0.5">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id ||
                  (activeTab === 'invoices' && item.id === 'sales-invoices') ||
                  (activeTab === 'vouchers' && item.id === 'receipt-vouchers') ||
                  (activeTab === 'entities' && item.id === 'customers') ||
                  (activeTab === 'statements' && item.id === 'customer-statements');

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                    }}
                    title={collapsed ? item.label : undefined}
                    style={
                      isActive
                        ? {
                            background: activePalette.activeItemGradientStyle,
                            borderColor: activePalette.activeItemBorderColor,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer group ${
                      isActive
                        ? `text-white shadow-md border translate-x-[-1px]`
                        : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                    } ${collapsed ? 'justify-center px-1.5' : 'justify-start'}`}
                  >
                    <div
                      className={`p-1 rounded-md transition-colors shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-slate-400 group-hover:text-cyan-300'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${item.color || 'text-cyan-400'}`} />
                    </div>

                    {!collapsed && (
                      <span className="truncate flex-1 text-right">{item.label}</span>
                    )}

                    {!collapsed && item.badge !== undefined && Number(item.badge) > 0 && (
                      <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-extrabold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-white/10 bg-black/20 text-[11px] text-slate-400 flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>نظام موحد (Zero Data Loss)</span>
            </span>
            <span className="font-mono text-cyan-400">{company?.functionalCurrency || 'KWD'}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
