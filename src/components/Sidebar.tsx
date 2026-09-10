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
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile } from '../types.js';
import { isDemoActive } from '../services/demoService.js';
import { checkIsSupabaseConfigured } from '../services/supabaseClient.ts';
import { useTheme } from '../services/themeService.ts';

import { SystemUser } from '../types.js';

interface SidebarProps {
  currentUser?: SystemUser | null;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unpaidCount?: number;
  company: CompanyProfile | null;
  collapsed: boolean;
  setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCompanySetup: () => void;
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
  onSaveCompany,
}) => {
  const {
    themeMode,
    effectiveMode,
    activePalette,
  } = useTheme(company);

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
      id: 'sales',
      title: 'قسم المبيعات ونقاط البيع',
      items: [
        {
          id: 'quotations',
          label: 'عروض الأسعار والتحويل',
          icon: FileText,
          color: 'text-sky-400',
        },
        {
          id: 'pos',
          label: 'نقاط البيع POS',
          icon: ShoppingBag,
          color: 'text-emerald-400',
        },
        {
          id: 'invoices',
          label: 'فواتير المبيعات',
          icon: FileText,
          badge: unpaidCount > 0 ? unpaidCount : undefined,
          color: 'text-blue-400',
        },
        {
          id: 'vouchers',
          label: 'سندات القبض والصرف',
          icon: DollarSign,
          color: 'text-teal-400',
        },
      ],
    },
    {
      id: 'manufacturing',
      title: 'قسم التصنيع والإنتاج',
      items: [
        {
          id: 'production',
          label: 'أوامر التصنيع والتشغيل',
          icon: Factory,
          color: 'text-amber-400',
        },
      ],
    },
    {
      id: 'accounting',
      title: 'قسم الحسابات والمالية',
      items: [
        {
          id: 'journals',
          label: 'القيود اليومية',
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
          id: 'statements',
          label: 'كشوفات الحسابات IFRS',
          icon: FileText,
          color: 'text-amber-400',
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
        {
          id: 'accounts',
          label: 'الدليل المحاسبي',
          icon: FolderTree,
          color: 'text-teal-400',
        },
      ],
    },
    {
      id: 'inventory',
      title: 'قسم إدارة المخزون والجرد',
      items: [
        {
          id: 'inventory',
          label: 'الأصناف والمخزون',
          icon: Package,
          color: 'text-amber-400',
        },
        {
          id: 'units',
          label: 'وحدات القياس والتحويل',
          icon: Ruler,
          color: 'text-purple-400',
        },
      ],
    },
    {
      id: 'management',
      title: 'قسم الإدارة والبيانات الأساسية',
      items: [
        {
          id: 'entities',
          label: 'العملاء والموردين',
          icon: Users2,
          color: 'text-indigo-400',
        },
        {
          id: 'sales-reps',
          label: 'إدارة المناديب والعمولات',
          icon: Users,
          color: 'text-cyan-400',
        },
        {
          id: 'reports',
          label: 'التقارير التشغيلية',
          icon: BarChart3,
          color: 'text-sky-400',
        },
        {
          id: 'company',
          label: 'إعدادات المنشأة والترويسات',
          icon: Building2,
          color: 'text-violet-400',
        },
        {
          id: 'users',
          label: 'المستخدمون والصلاحيات',
          icon: Users,
          color: 'text-pink-400',
        },
        {
          id: 'system-reset',
          label: 'تصفير النظام وإقفال الدورة',
          icon: RotateCcw,
          color: 'text-rose-400',
        },
      ],
    },
  ];

  
  // [ARCHITECT] Strict RBAC Filtering
  const isCashier = currentUser?.role === 'SALES';
  const isAccountant = currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'CHIEF_ACCOUNTANT';
  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'GENERAL_MANAGER';
  

  
  const filteredGroups = sections.map(group => {
    return {
      ...group,
      items: group.items.filter(item => {
        if (isManager) return true; // Manager sees everything
        
        if (isCashier) {
          // Cashier ONLY sees POS, Invoices (basic view), and maybe their own dashboard
          return ['pos', 'dashboard', 'invoices', 'quotations'].includes(item.id);
        }
        
        if (isAccountant) {
          // Accountant sees financials, ledgers, journals, vouchers, statements, etc.
          // Probably shouldn't see system settings (users, company setup) unless authorized
          if (['users', 'system-reset'].includes(item.id)) return false;
          return true;
        }
        
        return true; // Default fallback
      })
    };
  }).filter(g => g.items.length > 0);
  
  return (
    <aside
      style={{ backgroundColor: activePalette.sidebarBg, borderColor: activePalette.sidebarBorder }}
      className={`fixed top-0 right-0 bottom-0 text-white border-l z-50 flex flex-col transition-all duration-300 shadow-2xl no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Sidebar Header Brand */}
      <div
        style={{ borderColor: activePalette.sidebarBorder }}
        className="h-14 flex items-center justify-between px-3 border-b bg-black/20 shrink-0"
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              style={{ backgroundColor: activePalette.primaryColor }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold border border-white/20 shadow-xs shrink-0"
            >
              <span className="text-xs tracking-wider">LX</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white tracking-tight truncate">
                {company?.nameAr || 'لوجيكس ERP'}
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="text-[9px] text-cyan-300 font-semibold truncate">
                  سحابي متصل
                </span>
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
              <div className="px-2.5 py-0.5 text-[10px] font-bold text-slate-400 tracking-wider">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
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
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {!collapsed && (
                      <span className="truncate flex-1 text-right font-bold text-xs">
                        {item.label}
                      </span>
                    )}

                    {!collapsed && item.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 text-[9px] font-black rounded-full shadow-2xs ${
                        item.badge === 'مقيد'
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-600 text-white'
                      }`}>
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

      {/* Supabase Cloud Sync Status Widget & Theme Switcher in Sidebar */}
      <div
        style={{ borderColor: activePalette.sidebarBorder }}
        className="p-2 border-t bg-black/20 shrink-0 space-y-1.5"
      >
        {!collapsed ? (
          <button
            type="button"
            onClick={onOpenCompanySetup}
            className="w-full text-right bg-black/30 hover:bg-black/50 p-2 rounded-lg border border-white/10 flex items-center justify-between cursor-pointer transition-colors"
            title={checkIsSupabaseConfigured() ? "قاعدة Supabase السحابية متصلة" : "النظام يعمل على التخزين المحلي (اضغط للربط بالسحابة)"}
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center border shrink-0 ${
                checkIsSupabaseConfigured() ? 'bg-blue-500/20 text-cyan-300 border-blue-400/30' : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
              }`}>
                <Cloud className={`w-3.5 h-3.5 ${checkIsSupabaseConfigured() ? 'text-cyan-400 animate-pulse' : 'text-amber-400'}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-white flex items-center gap-1 truncate">
                  <span>قاعدة Supabase</span>
                </div>
                <div className={`text-[9px] font-semibold flex items-center gap-1 ${
                  checkIsSupabaseConfigured() ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{checkIsSupabaseConfigured() ? 'متصلة سحابياً' : 'تخزين محلي مؤقت'}</span>
                </div>
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenCompanySetup}
            className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center border cursor-pointer ${
              checkIsSupabaseConfigured() ? 'bg-blue-500/20 text-cyan-300 border-blue-400/30' : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
            }`}
            title={checkIsSupabaseConfigured() ? "قاعدة Supabase السحابية متصلة" : "تخزين محلي مؤقت (اضغط للربط)"}
          >
            <Cloud className={`w-4 h-4 ${checkIsSupabaseConfigured() ? 'text-cyan-400 animate-pulse' : 'text-amber-400'}`} />
          </button>
        )}
      </div>
    </aside>
  );
};
