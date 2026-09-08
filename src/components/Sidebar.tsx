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
  ChevronRight,
  ChevronLeft,
  Cloud,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  BarChart3
} from 'lucide-react';
import { TabType } from './Navigation.tsx';
import { CompanyProfile } from '../types.js';
import { isDemoActive } from '../services/demoService.js';
import { checkIsSupabaseConfigured } from '../services/supabaseClient.ts';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unpaidCount?: number;
  company: CompanyProfile | null;
  collapsed: boolean;
  setCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCompanySetup: () => void;
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
  activeTab,
  setActiveTab,
  unpaidCount = 0,
  company,
  collapsed,
  setCollapsed,
  onOpenCompanySetup,
}) => {
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
      id: 'operations',
      title: 'الإنتاج والعمليات التجارية',
      items: [
        {
          id: 'invoices',
          label: 'الفواتير والمبيعات',
          icon: ShoppingBag,
          badge: unpaidCount > 0 ? unpaidCount : undefined,
          color: 'text-blue-400',
        },
        {
          id: 'inventory',
          label: 'المخزون والأصناف',
          icon: Package,
          color: 'text-amber-400',
        },
        {
          id: 'production',
          label: 'تشغيل وتصنيع المطحنة',
          icon: Factory,
          color: 'text-orange-400',
        },
        {
          id: 'vouchers',
          label: 'سندات القبض والصرف',
          icon: DollarSign,
          color: 'text-emerald-400',
        },
        {
          id: 'entities',
          label: 'العملاء والموردين',
          icon: Users2,
          color: 'text-indigo-400',
        },
        {
          id: 'statements',
          label: 'كشوفات الحسابات (IFRS)',
          icon: FileText,
          color: 'text-amber-400',
        },
      ],
    },
    {
      id: 'accounting',
      title: 'المحاسبة والتقارير المالية',
      items: [
        {
          id: 'accounts',
          label: 'الدليل المحاسبي',
          icon: FolderTree,
          color: 'text-teal-400',
        },
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
          color: 'text-sky-400',
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
          id: 'reports',
          label: 'التقارير التشغيلية والتحليلية',
          icon: BarChart3,
          color: 'text-cyan-400',
        },
      ],
    },
    {
      id: 'settings',
      title: 'التهيئة وإدارة النظام',
      items: [
        {
          id: 'units',
          label: 'وحدات القياس والتحويل',
          icon: Ruler,
          color: 'text-purple-400',
        },
        {
          id: 'company',
          label: 'إعدادات المنشأة',
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
          label: 'تصفير النظام وبدء دورة',
          icon: RotateCcw,
          color: 'text-rose-400',
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 right-0 bottom-0 bg-[#0B192C] text-white border-l border-[#1E3E62] z-50 flex flex-col transition-all duration-300 shadow-2xl no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Sidebar Header Brand */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-[#1E3E62] bg-[#081322]/80 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold border border-blue-400/40 shadow-xs shrink-0">
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
          <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold border border-blue-400/40 shadow-xs">
            <span className="text-[10px] tracking-wider">LX</span>
          </div>
        )}

        <button
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
        {sections.map((section) => (
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
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-md border border-blue-400/40 translate-x-[-1px]'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                    } ${collapsed ? 'justify-center px-1.5' : 'justify-start'}`}
                  >
                    <div
                      className={`p-1 rounded-md transition-colors shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800/90 text-slate-400 group-hover:text-cyan-300'
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

      {/* Supabase Cloud Sync Status Widget in Sidebar */}
      <div className="p-2 border-t border-[#1E3E62] bg-[#081322] shrink-0">
        {!collapsed ? (
          <button
            type="button"
            onClick={onOpenCompanySetup}
            className="w-full text-right bg-slate-900/90 hover:bg-slate-800 p-2 rounded-lg border border-blue-500/30 flex items-center justify-between cursor-pointer transition-colors"
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
