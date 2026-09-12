import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FolderTree,
  FileText,
  BookOpen,
  Scale,
  LineChart,
  ShoppingBag,
  Package,
  Users2,
  Ruler,
  Building2,
  Users,
  Factory,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  FileBarChart,
  Settings,
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile, SystemUser } from '../types.js';
import { useCompany } from '../contexts/CompanyContext.tsx';
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

type AccordionSectionKey = 'sales' | 'purchasing' | 'inventory' | 'accounting' | 'pos' | 'settings';

interface SubMenuItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  isReport?: boolean;
}

interface AccordionSection {
  key: AccordionSectionKey;
  number: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  operationalItems: SubMenuItem[];
  reportItems: SubMenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  unpaidCount = 0,
  company,
  collapsed,
  setCollapsed,
}) => {
  let companyContext: any = null;
  try {
    companyContext = useCompany();
  } catch {
    // fallback
  }

  const { effectiveMode, activePalette } = useTheme(company);
  const isLight = effectiveMode === 'light' || activePalette.id === 'light';

  const [liveCompany, setLiveCompany] = useState<any>(null);

  useEffect(() => {
    const handleCompanyUpdate = (e: any) => {
      if (e?.detail) {
        setLiveCompany(e.detail);
      }
    };
    window.addEventListener('company_settings_changed', handleCompanyUpdate);
    return () => {
      window.removeEventListener('company_settings_changed', handleCompanyUpdate);
    };
  }, []);

  const activeCompanyName = liveCompany?.nameAr || companyContext?.currentCompany?.nameAr || company?.nameAr || 'نظام لوجيكس السحابي';
  // Map any activeTab (including legacy aliases) to its parent accordion section
  const getSectionForTab = (tab: TabType): AccordionSectionKey | null => {
    if (
      [
        'sales-invoices',
        'quotations',
        'customers',
        'receipt-vouchers',
        'customer-statements',
        'sales-reps',
        'invoices',
        'entities',
        'vouchers',
        'statements',
      ].includes(tab)
    ) {
      return 'sales';
    }
    if (
      [
        'purchase-invoices',
        'suppliers',
        'payment-vouchers',
        'supplier-statements',
      ].includes(tab)
    ) {
      return 'purchasing';
    }
    if (
      ['inventory', 'stock-ledger', 'warehouses', 'units', 'production'].includes(tab)
    ) {
      return 'inventory';
    }
    if (
      ['accounts', 'journals', 'ledger', 'trial-balance', 'financials'].includes(tab)
    ) {
      return 'accounting';
    }
    if (['pos', 'branches'].includes(tab)) {
      return 'pos';
    }
    if (
      ['company', 'users', 'backup-restore', 'reports', 'system-reset'].includes(tab)
    ) {
      return 'settings';
    }
    return null;
  };

  // State: single active accordion section
  const [openSection, setOpenSection] = useState<AccordionSectionKey | null>(() => {
    return getSectionForTab(activeTab) || 'sales';
  });

  // Automatically expand the section that contains the current activeTab
  useEffect(() => {
    const parentSection = getSectionForTab(activeTab);
    if (parentSection) {
      setOpenSection(parentSection);
    }
  }, [activeTab]);

  // Toggle single-open accordion behavior
  const handleToggleSection = (sectionKey: AccordionSectionKey) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenSection(sectionKey);
    } else {
      setOpenSection((prev) => (prev === sectionKey ? null : sectionKey));
    }
  };

  // Define the 5 primary enterprise modules + isolated sub-reports
  const sections: AccordionSection[] = useMemo(
    () => [
      {
        key: 'sales',
        number: '1',
        title: 'المبيعات والعملاء',
        icon: ShoppingBag,
        accentColor: 'text-emerald-400',
        operationalItems: [
          {
            id: 'sales-invoices',
            label: 'فواتير ومرتجعات المبيعات',
            icon: ShoppingBag,
            badge: unpaidCount > 0 ? unpaidCount : undefined,
          },
          {
            id: 'quotations',
            label: 'عروض الأسعار للعملاء',
            icon: FileText,
          },
          {
            id: 'customers',
            label: 'سجلات العملاء والجمعيات',
            icon: Users2,
          },
          {
            id: 'receipt-vouchers',
            label: 'التحصيلات (سندات القبض)',
            icon: ArrowDownLeft,
          },
          {
            id: 'sales-reps',
            label: 'مناديب المبيعات والعمولات',
            icon: UserCheck,
          },
        ],
        reportItems: [
          {
            id: 'customer-statements',
            label: 'كشوف حسابات العملاء',
            icon: BookOpen,
            isReport: true,
          },
          {
            id: 'reports',
            label: 'التقارير التحليلية للمبيعات',
            icon: BarChart3,
            isReport: true,
          },
        ],
      },
      {
        key: 'purchasing',
        number: '2',
        title: 'المشتريات والموردين',
        icon: ShoppingCart,
        accentColor: 'text-sky-400',
        operationalItems: [
          {
            id: 'purchase-invoices',
            label: 'فواتير ومردودات الشراء',
            icon: ShoppingCart,
          },
          {
            id: 'suppliers',
            label: 'سجلات الموردين والمطاحن',
            icon: Building2,
          },
          {
            id: 'payment-vouchers',
            label: 'سداد الموردين (سندات الصرف)',
            icon: ArrowUpRight,
          },
        ],
        reportItems: [
          {
            id: 'supplier-statements',
            label: 'كشوف حسابات الموردين',
            icon: BookOpen,
            isReport: true,
          },
        ],
      },
      {
        key: 'inventory',
        number: '3',
        title: 'إدارة المخازن',
        icon: Package,
        accentColor: 'text-teal-400',
        operationalItems: [
          {
            id: 'inventory',
            label: 'سجل الأصناف وكارت الصنف',
            icon: Package,
          },
          {
            id: 'warehouses',
            label: 'المستودعات ومواقع التخزين',
            icon: Warehouse,
          },
          {
            id: 'units',
            label: 'وحدات القياس والشد',
            icon: Ruler,
          },
          {
            id: 'production',
            label: 'قسم التصنيع والتشغيل',
            icon: Factory,
          },
        ],
        reportItems: [
          {
            id: 'stock-ledger',
            label: 'أذون الحركات والجرد المجمعة',
            icon: Layers,
            isReport: true,
          },
        ],
      },
      {
        key: 'accounting',
        number: '4',
        title: 'الحسابات والمالية',
        icon: Scale,
        accentColor: 'text-amber-400',
        operationalItems: [
          {
            id: 'accounts',
            label: 'دليل وشجرة الحسابات',
            icon: FolderTree,
          },
          {
            id: 'journals',
            label: 'القيود اليومية المتوازنة',
            icon: FileText,
          },
        ],
        reportItems: [
          {
            id: 'ledger',
            label: 'دفتر الأستاذ العام',
            icon: BookOpen,
            isReport: true,
          },
          {
            id: 'trial-balance',
            label: 'ميزان المراجعة بالمجاميع',
            icon: Scale,
            isReport: true,
          },
          {
            id: 'financials',
            label: 'القوائم المالية الختامية',
            icon: LineChart,
            isReport: true,
          },
        ],
      },
      {
        key: 'pos',
        number: '5',
        title: 'نقاط البيع والورديات',
        icon: Store,
        accentColor: 'text-rose-400',
        operationalItems: [
          {
            id: 'pos',
            label: 'شاشة البيع السريعة (POS)',
            icon: Store,
          },
          {
            id: 'branches',
            label: 'إدارة الفروع ومحطات البيع',
            icon: Store,
          },
        ],
        reportItems: [
          {
            id: 'reports',
            label: 'تقارير الورديات والمبيعات',
            icon: BarChart3,
            isReport: true,
          },
        ],
      },
      {
        key: 'settings',
        number: '6',
        title: 'الإدارة وإعدادات النظام',
        icon: ShieldCheck,
        accentColor: 'text-indigo-400',
        operationalItems: [
          {
            id: 'company',
            label: 'إعدادات المنشأة والعملة',
            icon: Settings,
          },
          {
            id: 'users',
            label: 'المستخدمون والصلاحيات (RBAC)',
            icon: Users,
          },
          {
            id: 'backup-restore',
            label: 'مركز النسخ والاستعادة',
            icon: FolderUp,
          },
          {
            id: 'system-reset',
            label: 'تصفير دورة النظام',
            icon: RotateCcw,
          },
        ],
        reportItems: [],
      },
    ],
    [unpaidCount]
  );

  // RBAC Filtering
  const isCashier = currentUser?.role === 'SALES';
  const isAccountant =
    currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'CHIEF_ACCOUNTANT';
  const isManager =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'GENERAL_MANAGER' ||
    !currentUser?.role;

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => {
        const filterItem = (item: SubMenuItem) => {
          if (isManager) return true;
          if (isCashier) {
            return ['pos', 'sales-invoices', 'quotations', 'receipt-vouchers'].includes(
              item.id
            );
          }
          if (isAccountant) {
            return !['company', 'users', 'system-reset', 'backup-restore'].includes(
              item.id
            );
          }
          return true;
        };

        const operationalItems = section.operationalItems.filter(filterItem);
        const reportItems = section.reportItems.filter(filterItem);

        return {
          ...section,
          operationalItems,
          reportItems,
          totalCount: operationalItems.length + reportItems.length,
        };
      })
      .filter((section) => section.totalCount > 0);
  }, [sections, isCashier, isAccountant, isManager]);

  // Helper to check if an item is active
  const isItemActive = (itemId: TabType) => {
    return (
      activeTab === itemId ||
      (activeTab === 'invoices' && itemId === 'sales-invoices') ||
      (activeTab === 'vouchers' && itemId === 'receipt-vouchers') ||
      (activeTab === 'entities' && itemId === 'customers') ||
      (activeTab === 'statements' && itemId === 'customer-statements')
    );
  };

  // Helper to check if any item inside a section is currently active
  const isSectionActive = (section: AccordionSection) => {
    return (
      section.operationalItems.some((i) => isItemActive(i.id)) ||
      section.reportItems.some((i) => isItemActive(i.id))
    );
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-screen z-40 flex flex-col transition-all duration-300 no-print font-sans ${
        isLight
          ? 'bg-white border-l border-slate-200 text-slate-800 shadow-xs'
          : 'bg-[#0F172A] border-l border-slate-800 text-white'
      } ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* 1. Header Section */}
      <div
        className={`h-[60px] flex items-center justify-between px-3 shrink-0 border-b ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0B1120] border-slate-800/80'
        }`}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black bg-emerald-600 border border-emerald-500/40 shadow-xs shrink-0">
              <span className="text-xs tracking-wider font-mono">LX</span>
            </div>
            <div className="truncate text-right">
              <div className={`text-xs font-bold leading-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeCompanyName}
              </div>
              <div className={`text-[10px] flex items-center gap-1 font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Executive ERP</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-white font-black bg-emerald-600 border border-emerald-500/40 shadow-xs">
            <span className="text-[10px] tracking-wider font-mono">LX</span>
          </div>
        )}

        <button
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
          }`}
        >
          {collapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 2. Executive Navigation & Collapsible Accordion List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {/* Pinned Executive Dashboard Button */}
        <button
          onClick={() => setActiveTab('dashboard')}
          title={collapsed ? 'لوحة التحكم' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? isLight
                ? 'bg-emerald-50 text-emerald-950 border-r-4 border-emerald-600 shadow-2xs pr-2.5 font-bold'
                : 'bg-slate-800 text-white border-r-4 border-emerald-500 shadow-md pr-2.5'
              : isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          } ${collapsed ? 'justify-center px-1' : 'justify-start'}`}
        >
          <div
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'dashboard'
                ? isLight
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-emerald-500/20 text-emerald-400'
                : isLight
                ? 'bg-slate-100 text-slate-600 group-hover:text-emerald-700'
                : 'bg-slate-800 text-slate-400 group-hover:text-emerald-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-600" />
          </div>
          {!collapsed && (
            <span className="truncate flex-1 text-right">لوحة التحكم التنفيذية</span>
          )}
        </button>

        <div className={`h-px my-2 mx-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800/80'}`} />

        {/* The Collapsible Accordion Sections */}
        {filteredSections.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = openSection === section.key;
          const hasActiveChild = isSectionActive(section);

          if (collapsed) {
            // Collapsed Mode: Clean Icon Triggers with tooltips
            return (
              <button
                key={section.key}
                onClick={() => handleToggleSection(section.key)}
                title={`${section.number}. ${section.title}`}
                className={`w-full flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer my-1 ${
                  hasActiveChild
                    ? isLight
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                      : 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-xs'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <SectionIcon className="w-4 h-4" />
              </button>
            );
          }

          return (
            <div
              key={section.key}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? isLight
                    ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                    : 'bg-slate-900/90 border-slate-700/80 shadow-sm'
                  : isLight
                  ? 'bg-transparent border-transparent hover:border-slate-200 hover:bg-slate-50/60'
                  : 'bg-transparent border-transparent hover:border-slate-800 hover:bg-slate-800/30'
              }`}
            >
              {/* Accordion Header Button */}
              <button
                type="button"
                onClick={() => handleToggleSection(section.key)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isOpen
                    ? isLight
                      ? 'text-slate-900'
                      : 'text-white'
                    : hasActiveChild
                    ? isLight
                      ? 'text-emerald-900 font-black'
                      : 'text-emerald-300 font-extrabold'
                    : isLight
                    ? 'text-slate-700 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                      isOpen
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-800 text-white'
                        : hasActiveChild
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-500/20 text-emerald-400'
                        : isLight
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <SectionIcon className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : section.accentColor}`} />
                  </div>
                  <span className="truncate text-right">
                    {section.number}. {section.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {section.key === 'sales' && unpaidCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-mono font-black rounded-full leading-none">
                      {unpaidCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen
                        ? isLight
                          ? 'rotate-180 text-emerald-700'
                          : 'rotate-180 text-emerald-400'
                        : isLight
                        ? 'text-slate-400'
                        : 'text-slate-400'
                    }`}
                  />
                </div>
              </button>

              {/* Collapsible Content (Sub-items & Isolated Reports) */}
              {isOpen && (
                <div className={`px-2 pb-2.5 pt-0.5 space-y-1 pr-3 mr-3 border-r transition-all animate-fadeIn ${
                  isLight ? 'border-slate-200' : 'border-slate-700/60'
                }`}>
                  {/* Operational Sub-items */}
                  {section.operationalItems.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isItemActive(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? isLight
                              ? 'bg-emerald-100/90 text-emerald-950 font-bold border-r-4 border-emerald-600 pr-2 shadow-2xs'
                              : 'bg-slate-800 text-white font-bold border-r-4 border-emerald-500 pr-2 shadow-xs'
                            : isLight
                            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ItemIcon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              active
                                ? isLight
                                  ? 'text-emerald-700'
                                  : 'text-emerald-400'
                                : isLight
                                ? 'text-slate-500'
                                : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate text-right">{item.label}</span>
                        </div>

                        {item.badge !== undefined && Number(item.badge) > 0 && (
                          <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full leading-none shrink-0 font-mono">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Isolated Sub-Category Reports (تقارير القسم) */}
                  {section.reportItems.length > 0 && (
                    <div className="pt-2 mt-2 space-y-1">
                      {/* Section Report Divider */}
                      <div className={`px-2 py-1 flex items-center justify-between border-t text-[10px] font-bold ${
                        isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-400'
                      }`}>
                        <span className={`flex items-center gap-1.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          <FileBarChart className="w-3 h-3" />
                          <span>تقارير القسم</span>
                        </span>
                        <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>REPORTS</span>
                      </div>

                      {section.reportItems.map((report) => {
                        const ReportIcon = report.icon;
                        const active = isItemActive(report.id);

                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => setActiveTab(report.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? isLight
                                  ? 'bg-emerald-100/90 text-emerald-950 font-bold border-r-4 border-emerald-600 pr-2 shadow-2xs'
                                  : 'bg-slate-800 text-emerald-300 font-bold border-r-4 border-emerald-500 pr-2 shadow-xs'
                                : isLight
                                ? 'text-slate-600 hover:text-emerald-800 hover:bg-slate-100'
                                : 'text-slate-300 hover:text-emerald-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <ReportIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                active
                                  ? isLight
                                    ? 'text-emerald-700'
                                    : 'text-emerald-400'
                                  : isLight
                                  ? 'text-slate-500'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate text-right">{report.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Footer Section */}
      {!collapsed && (
        <div className={`p-3 border-t text-[11px] flex flex-col gap-1 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#0B1120] border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>نظام موحد (Zero Data Loss)</span>
            </span>
            <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {company?.functionalCurrency || 'KWD'}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
