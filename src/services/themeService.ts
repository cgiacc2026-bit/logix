import { useState, useEffect, useCallback } from 'react';
import { CompanyProfile } from '../types.js';

export type ThemeColor = 'blue' | 'navy' | 'slate' | 'emerald' | 'amber' | 'purple' | 'classic';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePaletteDefinition {
  id: ThemeColor;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  swatchHex: string;
  primaryColor: string;
  primaryHover: string;
  primaryRgb: string;
  accentColor: string;
  headerBg: string;
  headerBorder: string;
  sidebarBg: string;
  sidebarBorder: string;
  activeItemGradient: string;
  activeItemGradientStyle: string;
  activeItemBorder: string;
  activeItemBorderColor: string;
  lightBg: string;
  lightBorder: string;
  badgeBg: string;
  badgeText: string;
}

export const THEME_PALETTES: Record<string, ThemePaletteDefinition> = {
  blue: {
    id: 'blue',
    labelAr: 'الأزرق الملكي الماسي',
    labelEn: 'Royal Sapphire Blue',
    descriptionAr: 'المظهر القياسي الاحترافي المعتمد للشركات والمؤسسات المالية الكبرى',
    swatchHex: '#2563EB',
    primaryColor: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryRgb: '37, 99, 235',
    accentColor: '#38BDF8',
    headerBg: '#0B192C',
    headerBorder: '#1E3E62',
    sidebarBg: '#071322',
    sidebarBorder: '#162B45',
    activeItemGradient: 'from-blue-600 to-indigo-600',
    activeItemGradientStyle: 'linear-gradient(to left, #2563EB, #4F46E5)',
    activeItemBorder: 'border-blue-400/40',
    activeItemBorderColor: 'rgba(96, 165, 250, 0.4)',
    lightBg: '#EFF6FF',
    lightBorder: '#BFDBFE',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
  },
  navy: {
    id: 'navy',
    labelAr: 'الكحلي المؤسسي الحصري',
    labelEn: 'Midnight Corporate Navy',
    descriptionAr: 'طابع محاسبي عميق وهادئ يركز على كفاءة التدقيق المالي',
    swatchHex: '#1E3A8A',
    primaryColor: '#3B82F6',
    primaryHover: '#2563EB',
    primaryRgb: '59, 130, 246',
    accentColor: '#818CF8',
    headerBg: '#070D1E',
    headerBorder: '#132247',
    sidebarBg: '#040813',
    sidebarBorder: '#0E1A36',
    activeItemGradient: 'from-indigo-600 to-blue-700',
    activeItemGradientStyle: 'linear-gradient(to left, #4F46E5, #1D4ED8)',
    activeItemBorder: 'border-indigo-400/40',
    activeItemBorderColor: 'rgba(129, 140, 248, 0.4)',
    lightBg: '#EEF2FF',
    lightBorder: '#C7D2FE',
    badgeBg: '#E0E7FF',
    badgeText: '#3730A3',
  },
  slate: {
    id: 'slate',
    labelAr: 'الرمادي المالي الصلب',
    labelEn: 'Financial Slate Steel',
    descriptionAr: 'نسق مالي حديث عالي التباين مستوحى من كبريات المنصات البنكية',
    swatchHex: '#475569',
    primaryColor: '#0284C7',
    primaryHover: '#0369A1',
    primaryRgb: '2, 132, 199',
    accentColor: '#38BDF8',
    headerBg: '#131E2E',
    headerBorder: '#2A3F5F',
    sidebarBg: '#0D1522',
    sidebarBorder: '#21334D',
    activeItemGradient: 'from-slate-600 to-sky-700',
    activeItemGradientStyle: 'linear-gradient(to left, #475569, #0284C7)',
    activeItemBorder: 'border-sky-400/40',
    activeItemBorderColor: 'rgba(56, 189, 248, 0.4)',
    lightBg: '#F0F9FF',
    lightBorder: '#BAE6FD',
    badgeBg: '#E0F2FE',
    badgeText: '#075985',
  },
  emerald: {
    id: 'emerald',
    labelAr: 'الأخضر الزمردي الاستثماري',
    labelEn: 'Executive Emerald Green',
    descriptionAr: 'يرمز للنماء والربحية والاستدامة والأنشطة الغذائية والتجارية',
    swatchHex: '#059669',
    primaryColor: '#059669',
    primaryHover: '#047857',
    primaryRgb: '5, 150, 105',
    accentColor: '#34D399',
    headerBg: '#062419',
    headerBorder: '#0F4A34',
    sidebarBg: '#031911',
    sidebarBorder: '#0B3827',
    activeItemGradient: 'from-emerald-600 to-teal-700',
    activeItemGradientStyle: 'linear-gradient(to left, #059669, #0F766E)',
    activeItemBorder: 'border-emerald-400/40',
    activeItemBorderColor: 'rgba(52, 211, 153, 0.4)',
    lightBg: '#ECFDF5',
    lightBorder: '#A7F3D0',
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
  },
  amber: {
    id: 'amber',
    labelAr: 'الذهبي الملكي الفاخر',
    labelEn: 'Prestige Amber & Gold',
    descriptionAr: 'مستوحى من سنابل القمح والمطاحن التراثية العريقة والذهب',
    swatchHex: '#D97706',
    primaryColor: '#D97706',
    primaryHover: '#B45309',
    primaryRgb: '217, 119, 6',
    accentColor: '#FBBF24',
    headerBg: '#211606',
    headerBorder: '#4E340E',
    sidebarBg: '#160E04',
    sidebarBorder: '#3B2609',
    activeItemGradient: 'from-amber-600 to-yellow-600',
    activeItemGradientStyle: 'linear-gradient(to left, #D97706, #CA8A04)',
    activeItemBorder: 'border-amber-400/40',
    activeItemBorderColor: 'rgba(251, 191, 36, 0.4)',
    lightBg: '#FFFBEB',
    lightBorder: '#FDE68A',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
  },
  purple: {
    id: 'purple',
    labelAr: 'البنفسجي الإمبراطوري الفاخر',
    labelEn: 'Imperial Royal Purple',
    descriptionAr: 'طابع إداري راقٍ يمنح تجربة استخدام فريدة ومتميزة',
    swatchHex: '#7C3AED',
    primaryColor: '#7C3AED',
    primaryHover: '#6D28D9',
    primaryRgb: '124, 58, 237',
    accentColor: '#C084FC',
    headerBg: '#1D0A2B',
    headerBorder: '#441764',
    sidebarBg: '#13051C',
    sidebarBorder: '#33114B',
    activeItemGradient: 'from-purple-600 to-indigo-600',
    activeItemGradientStyle: 'linear-gradient(to left, #7C3AED, #4F46E5)',
    activeItemBorder: 'border-purple-400/40',
    activeItemBorderColor: 'rgba(192, 132, 252, 0.4)',
    lightBg: '#FAF5FF',
    lightBorder: '#E9D5FF',
    badgeBg: '#F3E8FF',
    badgeText: '#6B21A8',
  },
};

// Aliases
THEME_PALETTES['classic'] = THEME_PALETTES['blue'];

export class ThemeService {
  private static THEME_COLOR_KEY = 'logix_erp_theme_color';
  private static THEME_MODE_KEY = 'logix_erp_theme_mode';

  static getSavedThemeColor(): ThemeColor {
    try {
      const saved = localStorage.getItem(this.THEME_COLOR_KEY) as ThemeColor;
      if (saved && THEME_PALETTES[saved]) return saved;
    } catch {}
    return 'blue';
  }

  static getSavedThemeMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(this.THEME_MODE_KEY) as ThemeMode;
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        return saved;
      }
    } catch {}
    return 'light';
  }

  static getEffectiveThemeMode(mode?: ThemeMode): 'light' | 'dark' {
    const selected = mode || this.getSavedThemeMode();
    if (selected === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }
    return selected;
  }

  static getActivePalette(color?: ThemeColor): ThemePaletteDefinition {
    const target = color || this.getSavedThemeColor();
    return THEME_PALETTES[target] || THEME_PALETTES['blue'];
  }

  static applyTheme(themeColor?: ThemeColor, themeMode?: ThemeMode): { color: ThemeColor; mode: ThemeMode; effectiveMode: 'light' | 'dark'; palette: ThemePaletteDefinition } {
    const targetColor: ThemeColor = (themeColor && THEME_PALETTES[themeColor]) ? themeColor : this.getSavedThemeColor();
    const targetMode: ThemeMode = themeMode || this.getSavedThemeMode();
    const effectiveMode = this.getEffectiveThemeMode(targetMode);
    const palette = THEME_PALETTES[targetColor] || THEME_PALETTES['blue'];

    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Apply Dark Mode Class
      if (effectiveMode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Apply Data Attributes for CSS Selectors & DevTools inspection
      root.setAttribute('data-theme-color', targetColor);
      root.setAttribute('data-theme-mode', effectiveMode);

      // Apply CSS Variables for Dynamic Theme Colors across all components
      root.style.setProperty('--theme-primary', palette.primaryColor);
      root.style.setProperty('--theme-primary-hover', palette.primaryHover);
      root.style.setProperty('--theme-primary-rgb', palette.primaryRgb);
      root.style.setProperty('--theme-accent', palette.accentColor);
      root.style.setProperty('--theme-header-bg', palette.headerBg);
      root.style.setProperty('--theme-header-border', palette.headerBorder);
      root.style.setProperty('--theme-sidebar-bg', palette.sidebarBg);
      root.style.setProperty('--theme-sidebar-border', palette.sidebarBorder);
      root.style.setProperty('--theme-active-gradient', palette.activeItemGradientStyle);
      root.style.setProperty('--theme-active-border', palette.activeItemBorderColor);
      root.style.setProperty('--theme-light-bg', palette.lightBg);
      root.style.setProperty('--theme-light-border', palette.lightBorder);
      root.style.setProperty('--theme-badge-bg', palette.badgeBg);
      root.style.setProperty('--theme-badge-text', palette.badgeText);
      root.style.setProperty('--theme-body-bg', effectiveMode === 'dark' ? '#090E1A' : '#F8FAFC');
      root.style.setProperty('--theme-surface-bg', effectiveMode === 'dark' ? '#111A2B' : '#FFFFFF');
      root.style.setProperty('--theme-surface-border', effectiveMode === 'dark' ? '#202F47' : '#E2E8F0');
      root.style.setProperty('--theme-text-main', effectiveMode === 'dark' ? '#F8FAFC' : '#0F172A');
      root.style.setProperty('--theme-text-muted', effectiveMode === 'dark' ? '#94A3B8' : '#64748B');
    }

    try {
      localStorage.setItem(this.THEME_COLOR_KEY, targetColor);
      localStorage.setItem(this.THEME_MODE_KEY, targetMode);

      // Keep active company profile in local cache synchronized to prevent revert on re-renders
      const rawComp = localStorage.getItem('supabase_company_info');
      if (rawComp) {
        try {
          const comp = JSON.parse(rawComp);
          comp.themeColor = targetColor;
          comp.themeMode = targetMode;
          localStorage.setItem('supabase_company_info', JSON.stringify(comp));
        } catch {}
      }
    } catch {}

    // Dispatch global event for instant reactive component updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('logix-theme-changed', {
          detail: {
            themeColor: targetColor,
            themeMode: targetMode,
            effectiveMode,
            palette,
          },
        })
      );
    }

    return { color: targetColor, mode: targetMode, effectiveMode, palette };
  }

  static toggleThemeMode(): 'light' | 'dark' {
    const current = this.getEffectiveThemeMode();
    const nextMode: ThemeMode = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(undefined, nextMode);
    return nextMode;
  }

  static setThemeColor(color: ThemeColor) {
    this.applyTheme(color, undefined);
  }

  static setThemeMode(mode: ThemeMode) {
    this.applyTheme(undefined, mode);
  }

  static initTheme() {
    const color = this.getSavedThemeColor();
    const mode = this.getSavedThemeMode();
    this.applyTheme(color, mode);

    // Listen for system theme changes if mode is 'system'
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.getSavedThemeMode() === 'system') {
          this.applyTheme();
        }
      });
    }
  }

  static syncWithCompany(company?: CompanyProfile | null) {
    if (!company) return;
    const currentSavedColor = this.getSavedThemeColor();
    const currentSavedMode = this.getSavedThemeMode();

    let targetColor: ThemeColor | undefined = undefined;
    if (company.themeColor && company.themeColor !== currentSavedColor && THEME_PALETTES[company.themeColor]) {
      targetColor = company.themeColor as ThemeColor;
    }

    let targetMode: ThemeMode | undefined = undefined;
    if (company.themeMode && company.themeMode !== currentSavedMode) {
      targetMode = company.themeMode as ThemeMode;
    }

    if (targetColor || targetMode) {
      this.applyTheme(targetColor, targetMode);
    }
  }
}

/**
 * Custom React Hook for components to consume theme state reactively
 */
export function useTheme(company?: CompanyProfile | null) {
  const [themeColor, setCurrentThemeColor] = useState<ThemeColor>(() => {
    return (company?.themeColor as ThemeColor) || ThemeService.getSavedThemeColor();
  });
  const [themeMode, setCurrentThemeMode] = useState<ThemeMode>(() => {
    return (company?.themeMode as ThemeMode) || ThemeService.getSavedThemeMode();
  });
  const [effectiveMode, setEffectiveMode] = useState<'light' | 'dark'>(() => {
    return ThemeService.getEffectiveThemeMode(themeMode);
  });
  const [activePalette, setActivePalette] = useState<ThemePaletteDefinition>(() => {
    return ThemeService.getActivePalette(themeColor);
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        themeColor: ThemeColor;
        themeMode: ThemeMode;
        effectiveMode: 'light' | 'dark';
        palette: ThemePaletteDefinition;
      }>;
      if (customEvent.detail) {
        setCurrentThemeColor(customEvent.detail.themeColor);
        setCurrentThemeMode(customEvent.detail.themeMode);
        setEffectiveMode(customEvent.detail.effectiveMode);
        setActivePalette(customEvent.detail.palette || ThemeService.getActivePalette(customEvent.detail.themeColor));
      }
    };

    window.addEventListener('logix-theme-changed', handleThemeChange);
    return () => window.removeEventListener('logix-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    if (company) {
      ThemeService.syncWithCompany(company);
    }
  }, [company?.id, company?.themeColor, company?.themeMode]);

  const setThemeColor = useCallback((color: ThemeColor) => {
    ThemeService.setThemeColor(color);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    ThemeService.setThemeMode(mode);
  }, []);

  const toggleThemeMode = useCallback(() => {
    return ThemeService.toggleThemeMode();
  }, []);

  const applyTheme = useCallback((color?: ThemeColor, mode?: ThemeMode) => {
    return ThemeService.applyTheme(color, mode);
  }, []);

  return {
    themeColor,
    themeMode,
    effectiveMode,
    isDark: effectiveMode === 'dark',
    activePalette,
    setThemeColor,
    setThemeMode,
    toggleThemeMode,
    applyTheme,
  };
}
