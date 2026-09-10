import { useState, useEffect, useCallback } from 'react';
import { CompanyProfile } from '../types.js';

export type ThemeMode = 'light' | 'slate' | 'navy';
export type ThemeColor = 'light' | 'slate' | 'navy' | 'blue' | 'classic' | string;

export interface ThemePaletteDefinition {
  id: ThemeMode;
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
  bodyBg: string;
  surfaceBg: string;
  surfaceBorder: string;
  textMain: string;
  textMuted: string;
  activeItemGradient: string;
  activeItemGradientStyle: string;
  activeItemBorder: string;
  activeItemBorderColor: string;
  lightBg: string;
  lightBorder: string;
  badgeBg: string;
  badgeText: string;
}

export const ERP_THEMES: Record<ThemeMode, ThemePaletteDefinition> = {
  light: {
    id: 'light',
    labelAr: 'الفاتح المهني',
    labelEn: 'Clean Light',
    descriptionAr: 'خلفيات بيضاء ورمادية فاتحة ناعمة عالية التباين لمكاتب الأعمال والطباعة الرسمية',
    swatchHex: '#2563EB',
    primaryColor: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryRgb: '37, 99, 235',
    accentColor: '#38BDF8',
    headerBg: '#1E40AF',
    headerBorder: '#1D4ED8',
    sidebarBg: '#1E293B',
    sidebarBorder: '#334155',
    bodyBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    surfaceBorder: '#E2E8F0',
    textMain: '#0F172A',
    textMuted: '#64748B',
    activeItemGradient: 'from-blue-600 to-indigo-600',
    activeItemGradientStyle: 'linear-gradient(to left, #2563EB, #4F46E5)',
    activeItemBorder: 'border-blue-400/40',
    activeItemBorderColor: 'rgba(37, 99, 235, 0.4)',
    lightBg: '#EFF6FF',
    lightBorder: '#BFDBFE',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
  },
  slate: {
    id: 'slate',
    labelAr: 'الرمادي المؤسسي',
    labelEn: 'Enterprise Slate',
    descriptionAr: 'درجات رمادية أنيقة ومحترفة مستوحاة من كبرى منصات الـ ERP المالية العالمية',
    swatchHex: '#475569',
    primaryColor: '#0284C7',
    primaryHover: '#0369A1',
    primaryRgb: '2, 132, 199',
    accentColor: '#38BDF8',
    headerBg: '#182436',
    headerBorder: '#2C3E57',
    sidebarBg: '#182436',
    sidebarBorder: '#2C3E57',
    bodyBg: '#111B2B',
    surfaceBg: '#1E2D42',
    surfaceBorder: '#304562',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    activeItemGradient: 'from-slate-600 to-sky-700',
    activeItemGradientStyle: 'linear-gradient(to left, #475569, #0284C7)',
    activeItemBorder: 'border-sky-400/40',
    activeItemBorderColor: 'rgba(56, 189, 248, 0.4)',
    lightBg: '#1E2D42',
    lightBorder: '#38BDF8',
    badgeBg: '#0369A1',
    badgeText: '#E0F2FE',
  },
  navy: {
    id: 'navy',
    labelAr: 'الكحلي العميق',
    labelEn: 'Midnight Navy',
    descriptionAr: 'درجات الأزرق والكحلي الراقي والملكي كملاذ مريح وهادئ للعين بدلاً من الأسود',
    swatchHex: '#1E3A8A',
    primaryColor: '#3B82F6',
    primaryHover: '#2563EB',
    primaryRgb: '59, 130, 246',
    accentColor: '#818CF8',
    headerBg: '#0F1E38',
    headerBorder: '#1F3863',
    sidebarBg: '#0F1E38',
    sidebarBorder: '#1F3863',
    bodyBg: '#0B162C',
    surfaceBg: '#152646',
    surfaceBorder: '#243F70',
    textMain: '#F1F5F9',
    textMuted: '#94A3B8',
    activeItemGradient: 'from-indigo-600 to-blue-700',
    activeItemGradientStyle: 'linear-gradient(to left, #4F46E5, #1D4ED8)',
    activeItemBorder: 'border-indigo-400/40',
    activeItemBorderColor: 'rgba(129, 140, 248, 0.4)',
    lightBg: '#152646',
    lightBorder: '#818CF8',
    badgeBg: '#1E3A8A',
    badgeText: '#DBEAFE',
  },
};

// Aliases for backwards compatibility with previous palettes
export const THEME_PALETTES: Record<string, ThemePaletteDefinition> = {
  light: ERP_THEMES.light,
  slate: ERP_THEMES.slate,
  navy: ERP_THEMES.navy,
  blue: ERP_THEMES.light,
  classic: ERP_THEMES.light,
  emerald: ERP_THEMES.slate,
  amber: ERP_THEMES.slate,
  purple: ERP_THEMES.navy,
  dark: ERP_THEMES.navy,
};

export class ThemeService {
  private static THEME_MODE_KEY = 'logix_erp_theme_mode';
  private static THEME_COLOR_KEY = 'logix_erp_theme_color';

  /**
   * Retrieves the current saved theme mode from localStorage.
   * Restricts strictly to 'light' | 'slate' | 'navy'.
   */
  static getSavedThemeMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(this.THEME_MODE_KEY) as string;
      if (saved === 'light' || saved === 'slate' || saved === 'navy') {
        return saved;
      }
      // Migrate legacy storage modes
      if (saved === 'dark') return 'navy';
      if (saved === 'blue') return 'light';
    } catch {}
    return 'light';
  }

  static getSavedThemeColor(): ThemeColor {
    return this.getSavedThemeMode();
  }

  static getEffectiveThemeMode(mode?: ThemeMode | string): 'light' | 'dark' {
    const target = (mode as ThemeMode) || this.getSavedThemeMode();
    return target === 'light' ? 'light' : 'dark';
  }

  static getActivePalette(modeOrColor?: ThemeMode | string): ThemePaletteDefinition {
    let target = modeOrColor || this.getSavedThemeMode();
    if (target === 'dark') target = 'navy';
    if (target === 'blue' || target === 'classic') target = 'light';
    return ERP_THEMES[target as ThemeMode] || ERP_THEMES['light'];
  }

  /**
   * Applies the theme to the document root, setting CSS custom properties,
   * CSS theme classes, and persisting to localStorage.
   */
  static applyTheme(
    modeOrColor?: ThemeMode | string,
    secondaryMode?: string
  ): {
    mode: ThemeMode;
    color: ThemeColor;
    effectiveMode: 'light' | 'dark';
    palette: ThemePaletteDefinition;
  } {
    let targetMode: ThemeMode = 'light';

    if (modeOrColor === 'light' || modeOrColor === 'slate' || modeOrColor === 'navy') {
      targetMode = modeOrColor;
    } else if (secondaryMode === 'light' || secondaryMode === 'slate' || secondaryMode === 'navy') {
      targetMode = secondaryMode;
    } else if (secondaryMode === 'dark' || modeOrColor === 'dark') {
      targetMode = 'navy';
    } else if (modeOrColor && THEME_PALETTES[modeOrColor]) {
      targetMode = THEME_PALETTES[modeOrColor].id;
    } else {
      targetMode = this.getSavedThemeMode();
    }

    const effectiveMode = targetMode === 'light' ? 'light' : 'dark';
    const palette = ERP_THEMES[targetMode] || ERP_THEMES['light'];

    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Clean up previous theme classes
      root.classList.remove('theme-light', 'theme-slate', 'theme-navy');
      root.classList.add(`theme-${targetMode}`);

      // Sync dark mode class for Tailwind dark: variants (slate and navy are dark themes)
      if (targetMode === 'light') {
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
      }

      // Attributes for CSS styling & inspection
      root.setAttribute('data-theme', targetMode);
      root.setAttribute('data-theme-mode', targetMode);
      root.setAttribute('data-theme-color', targetMode);

      // CSS Custom Properties applied to root
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
      root.style.setProperty('--theme-body-bg', palette.bodyBg);
      root.style.setProperty('--theme-surface-bg', palette.surfaceBg);
      root.style.setProperty('--theme-surface-border', palette.surfaceBorder);
      root.style.setProperty('--theme-text-main', palette.textMain);
      root.style.setProperty('--theme-text-muted', palette.textMuted);
    }

    // Persist explicitly to localStorage under 'logix_erp_theme_mode'
    try {
      localStorage.setItem(this.THEME_MODE_KEY, targetMode);
      localStorage.setItem(this.THEME_COLOR_KEY, targetMode);

      // Keep company cache synchronized to avoid revert
      const rawComp = localStorage.getItem('supabase_company_info');
      if (rawComp) {
        try {
          const comp = JSON.parse(rawComp);
          comp.themeMode = targetMode;
          comp.themeColor = targetMode;
          localStorage.setItem('supabase_company_info', JSON.stringify(comp));
        } catch {}
      }
    } catch {}

    // Dispatch global event for instant reactive component updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('logix-theme-changed', {
          detail: {
            themeMode: targetMode,
            themeColor: targetMode,
            effectiveMode,
            palette,
          },
        })
      );
    }

    return { mode: targetMode, color: targetMode, effectiveMode, palette };
  }

  /**
   * Cycles sequentially between the three themes: light -> slate -> navy -> light
   */
  static toggleThemeMode(): ThemeMode {
    const current = this.getSavedThemeMode();
    let next: ThemeMode = 'light';
    if (current === 'light') {
      next = 'slate';
    } else if (current === 'slate') {
      next = 'navy';
    } else {
      next = 'light';
    }
    this.applyTheme(next);
    return next;
  }

  static setThemeMode(mode: ThemeMode) {
    this.applyTheme(mode);
  }

  static setThemeColor(color: ThemeColor) {
    if (color === 'light' || color === 'slate' || color === 'navy') {
      this.applyTheme(color as ThemeMode);
    } else if (THEME_PALETTES[color]) {
      this.applyTheme(THEME_PALETTES[color].id);
    }
  }

  static initTheme() {
    const mode = this.getSavedThemeMode();
    this.applyTheme(mode);
  }

  static syncWithCompany(company?: CompanyProfile | null) {
    if (!company) return;
    const currentSaved = this.getSavedThemeMode();
    const companyMode = company.themeMode as ThemeMode;
    if (companyMode && (companyMode === 'light' || companyMode === 'slate' || companyMode === 'navy')) {
      if (companyMode !== currentSaved) {
        this.applyTheme(companyMode);
      }
    }
  }
}

/**
 * Custom React Hook for components to consume theme state reactively
 */
export function useTheme(company?: CompanyProfile | null) {
  const [themeMode, setCurrentThemeMode] = useState<ThemeMode>(() => {
    const fromComp = company?.themeMode as ThemeMode;
    if (fromComp === 'light' || fromComp === 'slate' || fromComp === 'navy') return fromComp;
    return ThemeService.getSavedThemeMode();
  });

  const [effectiveMode, setEffectiveMode] = useState<'light' | 'dark'>(() => {
    return ThemeService.getEffectiveThemeMode(themeMode);
  });

  const [activePalette, setActivePalette] = useState<ThemePaletteDefinition>(() => {
    return ThemeService.getActivePalette(themeMode);
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        themeMode: ThemeMode;
        themeColor: ThemeColor;
        effectiveMode: 'light' | 'dark';
        palette: ThemePaletteDefinition;
      }>;
      if (customEvent.detail) {
        const mode = customEvent.detail.themeMode;
        setCurrentThemeMode(mode);
        setEffectiveMode(customEvent.detail.effectiveMode);
        setActivePalette(customEvent.detail.palette || ThemeService.getActivePalette(mode));
      }
    };

    window.addEventListener('logix-theme-changed', handleThemeChange);
    return () => window.removeEventListener('logix-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    if (company) {
      ThemeService.syncWithCompany(company);
    }
  }, [company?.id, company?.themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    ThemeService.setThemeMode(mode);
  }, []);

  const setThemeColor = useCallback((color: ThemeColor) => {
    ThemeService.setThemeColor(color);
  }, []);

  const toggleThemeMode = useCallback(() => {
    return ThemeService.toggleThemeMode();
  }, []);

  const applyTheme = useCallback((modeOrColor?: ThemeMode | ThemeColor) => {
    return ThemeService.applyTheme(modeOrColor);
  }, []);

  return {
    themeMode,
    themeColor: themeMode,
    effectiveMode,
    isDark: themeMode !== 'light',
    isSlate: themeMode === 'slate',
    isNavy: themeMode === 'navy',
    activePalette,
    setThemeMode,
    setThemeColor,
    toggleThemeMode,
    applyTheme,
  };
}
