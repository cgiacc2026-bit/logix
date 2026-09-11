import React, { useState } from 'react';
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
  Layers,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Cpu,
  RotateCcw,
  BarChart3,
  Warehouse,
  FolderUp,
  Receipt,
  ShoppingCart,
  UserCheck,
  Store,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  // 1. Accounting Module
  | 'accounts'
  | 'journals'
  | 'ledger'
  | 'trial-balance'
  | 'financials'
  // 2. Sales & Customers Module
  | 'sales-invoices'
  | 'quotations'
  | 'customers'
  | 'receipt-vouchers'
  | 'customer-statements'
  | 'sales-reps'
  // 3. Purchasing & Suppliers Module
  | 'purchase-invoices'
  | 'suppliers'
  | 'payment-vouchers'
  | 'supplier-statements'
  // 4. Inventory Module
  | 'inventory'
  | 'stock-ledger'
  | 'warehouses'
  | 'units'
  | 'production'
  // 5. POS Module
  | 'pos'
  // 6. Core System Settings Module
  | 'company'
  | 'branches'
  | 'users'
  | 'backup-restore'
  | 'reports'
  | 'system-reset'
  // Legacy Aliases
  | 'invoices'
  | 'vouchers'
  | 'entities'
  | 'statements';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unpaidCount?: number;
}

interface NavGroup {
  id: string;
  title: string;
  icon: any;
  color: string;
  badgeBg: string;
  items: {
    id: TabType;
    label: string;
    icon: any;
    badge?: number | string;
    subLabel?: string;
  }[];
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  unpaidCount = 0,
}) => {
  // Define 6 distinct enterprise modular groups
  const groups: NavGroup[] = [
    {
      id: 'overview',
      title: 'الرئيسية',
      icon: LayoutDashboard,
      color: 'text-cyan-300',
      badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
      items: [
        {
          id: 'dashboard',
          label: 'لوحة التحكم',
          icon: LayoutDashboard,
          subLabel: 'المؤشرات والملخص العام',
        },
      ],
    },
    {
      id: 'accounting',
      title: 'المحاسبة المالية (Accounting)',
      icon: LineChart,
      color: 'text-emerald-300',
      badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      items: [
        {
          id: 'accounts',
          label: 'دليل الحسابات',
          icon: FolderTree,
          subLabel: 'شجرة الحسابات العامة IFRS',
        },
        {
          id: 'journals',
          label: 'القيود اليومية المتوازنة',
          icon: FileText,
          subLabel: 'الترحيل المزدوج (Debit = Credit)',
        },
        {
          id: 'ledger',
          label: 'دفتر الأستاذ العام',
          icon: BookOpen,
          subLabel: 'حركات الحسابات والأرصدة',
        },
        {
          id: 'trial-balance',
          label: 'ميزان المراجعة',
          icon: Scale,
          subLabel: 'المجاميع والأرصدة المدققة',
        },
        {
          id: 'financials',
          label: 'القوائم المالية الختامية',
          icon: LineChart,
          subLabel: 'الميزانية وقائمة الدخل والأرباح',
        },
      ],
    },
    {
      id: 'sales',
      title: 'المبيعات والعملاء (Sales)',
      icon: ShoppingBag,
      color: 'text-sky-300',
      badgeBg: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
      items: [
        {
          id: 'sales-invoices',
          label: 'فواتير ومرتجعات المبيعات',
          icon: ShoppingBag,
          badge: unpaidCount > 0 ? unpaidCount : undefined,
          subLabel: 'إصدار الفواتير والمرتجعات والجمعيات',
        },
        {
          id: 'quotations',
          label: 'عروض الأسعار',
          icon: FileText,
          subLabel: 'عروض البيع والتحويل لفواتير',
        },
        {
          id: 'customers',
          label: 'سجلات العملاء والجمعيات',
          icon: Users2,
          subLabel: 'بيانات وأرصدة العملاء والأسعار',
        },
        {
          id: 'receipt-vouchers',
          label: 'التحصيلات (سندات القبض)',
          icon: ArrowDownLeft,
          subLabel: 'سندات قبض وتحصيل نقد/بنك',
        },
        {
          id: 'customer-statements',
          label: 'كشوف حسابات العملاء',
          icon: BookOpen,
          subLabel: 'كشف حساب تفصيلي ومطابقة أرصدة',
        },
        {
          id: 'sales-reps',
          label: 'مناديب المبيعات والعمولات',
          icon: UserCheck,
          subLabel: 'إسناد الفواتير والعمولات',
        },
      ],
    },
    {
      id: 'purchasing',
      title: 'المشتريات والموردين (Purchasing)',
      icon: ShoppingCart,
      color: 'text-amber-300',
      badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      items: [
        {
          id: 'purchase-invoices',
          label: 'فواتير ومردودات الشراء',
          icon: ShoppingCart,
          subLabel: 'شراء الخامات ومستلزمات التعبئة',
        },
        {
          id: 'suppliers',
          label: 'سجلات الموردين والمطاحن',
          icon: Building2,
          subLabel: 'دليل الموردين وأرصدة أول المدة',
        },
        {
          id: 'payment-vouchers',
          label: 'سداد الموردين (سندات الصرف)',
          icon: ArrowUpRight,
          subLabel: 'صرف وسداد المستحقات',
        },
        {
          id: 'supplier-statements',
          label: 'كشوف حسابات الموردين',
          icon: BookOpen,
          subLabel: 'مطابقة دفعات وحسابات الموردين',
        },
      ],
    },
    {
      id: 'inventory',
      title: 'إدارة المخازن (Inventory)',
      icon: Package,
      color: 'text-teal-300',
      badgeBg: 'bg-teal-500/20 text-teal-200 border-teal-400/30',
      items: [
        {
          id: 'inventory',
          label: 'سجل الأصناف وكارت الصنف',
          icon: Package,
          subLabel: 'الخامات والبهارات والأصناف التامة',
        },
        {
          id: 'stock-ledger',
          label: 'أذون الحركات والجرد',
          icon: Layers,
          subLabel: 'أذون الصرف والإضافة المباشرة',
        },
        {
          id: 'warehouses',
          label: 'المستودعات ومواقع التخزين',
          icon: Warehouse,
          subLabel: 'إدارة المستودعات وتوزيع المخزون',
        },
        {
          id: 'units',
          label: 'وحدات القياس والشد',
          icon: Ruler,
          subLabel: 'التحويل بين الكيلو والحبة والكرتون',
        },
        {
          id: 'production',
          label: 'قسم التصنيع والتشغيل',
          icon: Factory,
          subLabel: 'أوامر الخلط والطحن والتعبئة',
        },
      ],
    },
    {
      id: 'pos',
      title: 'نقاط البيع (POS)',
      icon: Store,
      color: 'text-purple-300',
      badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/30',
      items: [
        {
          id: 'pos',
          label: 'شاشة البيع السريعة والشفتات',
          icon: Store,
          subLabel: 'كاشير سريع، باركود، وإغلاق شفتات',
        },
      ],
    },
    {
      id: 'settings',
      title: 'الإدارة والإعدادات (Settings)',
      icon: Building2,
      color: 'text-rose-300',
      badgeBg: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
      items: [
        {
          id: 'company',
          label: 'إعدادات الشركة والعملة',
          icon: Building2,
          subLabel: 'بيانات الترخيص، العملة الوظيفية، والبلد',
        },
        {
          id: 'branches',
          label: 'إدارة الفروع ومحطات البيع',
          icon: Store,
          subLabel: 'ربط الفروع بالمستودعات ونقاط البيع',
        },
        {
          id: 'users',
          label: 'المستخدمون والصلاحيات (RBAC)',
          icon: Users,
          subLabel: 'الأدوار وحماية العمليات',
        },
        {
          id: 'backup-restore',
          label: 'مركز النسخ والاستعادة الموحد',
          icon: FolderUp,
          subLabel: 'تصدير JSON/Excel والاستعادة الآمنة',
        },
        {
          id: 'reports',
          label: 'التقارير التشغيلية المجمعة',
          icon: BarChart3,
          subLabel: 'تقارير المبيعات والأرباح الشاملة',
        },
        {
          id: 'system-reset',
          label: 'تصفير وبدء دورة محاسبية',
          icon: RotateCcw,
          subLabel: 'الإقفال المالي والتدوير السنوي',
        },
      ],
    },
  ];

  return (
    <nav className="bg-[#0A1D30] border-b border-[#1E3E62] px-2 sm:px-4 lg:px-6 py-2 overflow-x-auto no-print scrollbar-none shadow-md sticky top-[60px] z-30 font-sans">
      <div className="max-w-7xl mx-auto flex items-center justify-start gap-3 min-w-max">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          // Check if any tab in this group is active
          const isGroupActive = group.items.some((item) => {
            if (item.id === activeTab) return true;
            // Legacy aliases mapping
            if (activeTab === 'invoices' && item.id === 'sales-invoices') return true;
            if (activeTab === 'vouchers' && item.id === 'receipt-vouchers') return true;
            if (activeTab === 'entities' && item.id === 'customers') return true;
            if (activeTab === 'statements' && item.id === 'customer-statements') return true;
            return false;
          });

          return (
            <div
              key={group.id}
              className={`flex items-center gap-1.5 p-1 rounded-xl transition-all ${
                isGroupActive
                  ? 'bg-slate-900/80 border border-slate-700/80 shadow-xs'
                  : 'hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              {/* Group Title Badge */}
              <div
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                  isGroupActive ? group.badgeBg : 'text-slate-400'
                }`}
              >
                <GroupIcon className={`w-3.5 h-3.5 ${isGroupActive ? group.color : 'text-slate-400'}`} />
                <span className="hidden xl:inline text-[11px]">{group.title}</span>
              </div>

              {/* Items Buttons */}
              <div className="flex items-center gap-1">
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive =
                    activeTab === item.id ||
                    (activeTab === 'invoices' && item.id === 'sales-invoices') ||
                    (activeTab === 'vouchers' && item.id === 'receipt-vouchers') ||
                    (activeTab === 'entities' && item.id === 'customers') ||
                    (activeTab === 'statements' && item.id === 'customer-statements');

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={`${item.label} - ${item.subLabel || ''}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs scale-[1.02]'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <ItemIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>

                      {item.badge !== undefined && Number(item.badge) > 0 && (
                        <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
};
