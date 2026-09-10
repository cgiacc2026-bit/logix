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
  BarChart3
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'accounts'
  | 'journals'
  | 'ledger'
  | 'trial-balance'
  | 'financials'
  | 'reports'
  | 'statements'
  | 'invoices'
  | 'inventory'
  | 'production'
  | 'vouchers'
  | 'entities'
  | 'units'
  | 'company'
  | 'users'
  | 'system-reset';

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
  // Define task-based icon groups
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
      id: 'operations',
      title: 'العمليات والإنتاج والمبيعات',
      icon: Factory,
      color: 'text-amber-300',
      badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      items: [
        {
          id: 'invoices',
          label: 'الفواتير والمبيعات',
          icon: ShoppingBag,
          badge: unpaidCount > 0 ? unpaidCount : undefined,
          subLabel: 'فواتير البيع والشراء',
        },
        {
          id: 'inventory',
          label: 'المخزون والأصناف',
          icon: Package,
          subLabel: 'الخامات والبهارات التامة',
        },
        {
          id: 'production',
          label: 'قسم التصنيع (Manufacturing Center)',
          icon: Factory,
          subLabel: 'أوامر التشغيل وخطوط الإنتاج',
        },
        {
          id: 'vouchers',
          label: 'سندات القبض والصرف',
          icon: DollarSign,
          subLabel: 'الخزينة والتحصيل والسداد',
        },
        {
          id: 'entities',
          label: 'العملاء والموردين',
          icon: Users2,
          subLabel: 'الجمعيات والمطاحن والموردين',
        },
      ],
    },
    {
      id: 'accounting',
      title: 'المحاسبة والتقارير المالية',
      icon: LineChart,
      color: 'text-emerald-300',
      badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      items: [
        {
          id: 'accounts',
          label: 'الدليل المحاسبي',
          icon: FolderTree,
          subLabel: 'شجرة الحسابات العامة',
        },
        {
          id: 'journals',
          label: 'القيود اليومية',
          icon: FileText,
          subLabel: 'الترحيل المزدوج',
        },
        {
          id: 'ledger',
          label: 'الأستاذ العام',
          icon: BookOpen,
          subLabel: 'كشوف الحسابات',
        },
        {
          id: 'trial-balance',
          label: 'ميزان المراجعة',
          icon: Scale,
          subLabel: 'المجاميع والأرصدة',
        },
        {
          id: 'financials',
          label: 'القوائم المالية الختامية',
          icon: LineChart,
          subLabel: 'الميزانية والأرباح والتدفقات',
        },
        {
          id: 'reports',
          label: 'تقارير المبيعات والعمليات',
          icon: BarChart3,
          subLabel: 'المبيعات، المشتريات، المصاريف، والعملاء',
        },
      ],
    },
    {
      id: 'settings',
      title: 'التهيئة والإدارة',
      icon: Building2,
      color: 'text-purple-300',
      badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/30',
      items: [
        {
          id: 'units',
          label: 'وحدات القياس',
          icon: Ruler,
          subLabel: 'الكيلو والكرتون والحبة',
        },
        {
          id: 'company',
          label: 'إعدادات الشركة',
          icon: Building2,
          subLabel: 'بيانات المطحنة والتراخيص',
        },
        {
          id: 'users',
          label: 'المستخدمون والصلاحيات',
          icon: Users,
          subLabel: 'الأدوار والأمان',
        },
        {
          id: 'system-reset',
          label: 'تصفير النظام وبدء دورة',
          icon: RotateCcw,
          subLabel: 'الإقفال السنوي والأرشفة (Admin)',
        },
      ],
    },
  ];

  return (
    <nav className="bg-[#0A1D30] border-b border-[#1E3E62] px-2 sm:px-4 lg:px-6 py-2 overflow-x-auto no-print scrollbar-none shadow-md sticky top-[60px] z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-start gap-3 min-w-max">
        {groups.map((group, gIdx) => {
          const GroupIcon = group.icon;
          // Check if any tab in this group is active
          const isGroupActive = group.items.some((item) => item.id === activeTab);

          return (
            <div
              key={group.id}
              className={`flex items-center gap-1.5 p-1 rounded-2xl transition-all border ${
                isGroupActive
                  ? 'bg-[#0F2942]/90 border-blue-500/40 shadow-xs'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Group Category Tag / Header */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black shrink-0 ${
                  isGroupActive
                    ? `${group.badgeBg} shadow-xs font-black`
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                }`}
              >
                <GroupIcon className={`w-3.5 h-3.5 ${group.color}`} />
                <span className="whitespace-nowrap">{group.title}</span>
              </div>

              {/* Group Buttons / Icons */}
              <div className="flex items-center gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={item.subLabel}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-blue-400/50 scale-[1.02]'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/90 border border-transparent'
                      }`}
                    >
                      <div
                        className={`p-1 rounded-lg ${
                          isActive
                            ? 'bg-white/20 text-cyan-300'
                            : 'bg-slate-800/90 text-slate-400 group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold">{item.label}</span>

                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.2 text-[10px] font-black bg-rose-600 text-white rounded-full shadow-xs">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Visual Divider between Groups */}
              {gIdx < groups.length - 1 && (
                <div className="w-[1px] h-6 bg-slate-700/50 mx-1 hidden" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
