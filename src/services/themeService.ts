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
    labelAr: 'المؤسسي الفاخر (Executive Slate)',
    labelEn: 'Executive Slate & Emerald',
    descriptionAr: 'خلفية ناعمة Slate-50 وهيدر كحلي داكن فاخر #0F172A مع بطاقات بيضاء وحواف Slate-200 لراحة العين',
    swatchHex: '#0F172A',
    primaryColor: '#0F172A',
    primaryHover: '#1E293B',
    primaryRgb: '15, 23, 42',
    accentColor: '#059669',
    headerBg: '#0F172A',
    headerBorder: '#1E293B',
    sidebarBg: '#0F172A',
    sidebarBorder: '#1E293B',
    bodyBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    surfaceBorder: '#E2E8F0',
    textMain: '#0F172A',
    textMuted: '#475569',
    activeItemGradient: 'from-slate-800 to-slate-900',
    activeItemGradientStyle: 'linear-gradient(to left, #0F172A, #1E293B)',
    activeItemBorder: 'border-emerald-500/50',
    activeItemBorderColor: 'rgba(5, 150, 105, 0.5)',
    lightBg: '#F1F5F9',
    lightBorder: '#CBD5E1',
    badgeBg: '#E2E8F0',
    badgeText: '#0F172A',
  },
  slate: {
    id: 'slate',
    labelAr: 'الرمادي الهادئ',
    labelEn: 'Soft Slate Dark',
    descriptionAr: 'درجات رمادية داكنة أنيقة ومريحة للعمل الليلي المتواصل',
    swatchHex: '#1E293B',
    primaryColor: '#0F172A',
    primaryHover: '#1E293B',
    primaryRgb: '15, 23, 42',
    accentColor: '#10B981',
    headerBg: '#0F172A',
    headerBorder: '#1E293B',
    sidebarBg: '#0F172A',
    sidebarBorder: '#1E293B',
    bodyBg: '#0F172A',
    surfaceBg: '#1E293B',
    surfaceBorder: '#334155',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    activeItemGradient: 'from-slate-700 to-slate-800',
    activeItemGradientStyle: 'linear-gradient(to left, #1E293B, #334155)',
    activeItemBorder: 'border-emerald-400/40',
    activeItemBorderColor: 'rgba(16, 185, 129, 0.4)',
    lightBg: '#1E293B',
    lightBorder: '#334155',
    badgeBg: '#334155',
    badgeText: '#F8FAFC',
  },
  navy: {
    id: 'navy',
    labelAr: 'الكحلي الليلي الملكي',
    labelEn: 'Midnight Navy',
    descriptionAr: 'درجات الأزرق والكحلي الداكن الفاخر',
    swatchHex: '#0A1128',
    primaryColor: '#0A1128',
    primaryHover: '#1C2541',
    primaryRgb: '10, 17, 40',
    accentColor: '#10B981',
    headerBg: '#0A1128',
    headerBorder: '#1C2541',
    sidebarBg: '#0A1128',
    sidebarBorder: '#1C2541',
    bodyBg: '#050A19',
    surfaceBg: '#0E172F',
    surfaceBorder: '#1F2E54',
    textMain: '#F1F5F9',
    textMuted: '#94A3B8',
    activeItemGradient: 'from-slate-800 to-indigo-950',
    activeItemGradientStyle: 'linear-gradient(to left, #0A1128, #1E293B)',
    activeItemBorder: 'border-emerald-400/40',
    activeItemBorderColor: 'rgba(16, 185, 129, 0.4)',
    lightBg: '#0E172F',
    lightBorder: '#1F2E54',
    badgeBg: '#1C2541',
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
    try {
      // Only set theme from company if the user has NEVER chosen a theme on this browser
      const existing = localStorage.getItem(this.THEME_MODE_KEY);
      if (!existing) {
        const companyMode = company.themeMode as ThemeMode;
        if (companyMode && (companyMode === 'light' || companyMode === 'slate' || companyMode === 'navy')) {
          this.applyTheme(companyMode);
        }
      }
    } catch {}
  }
}

/**
 * Custom React Hook for components to consume theme state reactively
 */
export function useTheme(_company?: CompanyProfile | null) {
  const [themeMode, setCurrentThemeMode] = useState<ThemeMode>(() => {
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
