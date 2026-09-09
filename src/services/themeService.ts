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
  accentColor: string;
  headerBg: string;
  headerBorder: string;
  sidebarBg: string;
  sidebarBorder: string;
  activeItemGradient: string;
  activeItemBorder: string;
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
    accentColor: '#38BDF8',
    headerBg: '#0B192C',
    headerBorder: '#1E3E62',
    sidebarBg: '#071322',
    sidebarBorder: '#162B45',
    activeItemGradient: 'from-blue-600 to-indigo-600',
    activeItemBorder: 'border-blue-400/40',
  },
  navy: {
    id: 'navy',
    labelAr: 'الكحلي المؤسسي الحصري',
    labelEn: 'Midnight Corporate Navy',
    descriptionAr: 'طابع محاسبي عميق وهادئ يركز على كفاءة التدقيق المالي',
    swatchHex: '#1E3A8A',
    primaryColor: '#3B82F6',
    primaryHover: '#2563EB',
    accentColor: '#818CF8',
    headerBg: '#070D1E',
    headerBorder: '#132247',
    sidebarBg: '#040813',
    sidebarBorder: '#0E1A36',
    activeItemGradient: 'from-indigo-600 to-blue-700',
    activeItemBorder: 'border-indigo-400/40',
  },
  slate: {
    id: 'slate',
    labelAr: 'الرمادي المالي الصلب',
    labelEn: 'Financial Slate Steel',
    descriptionAr: 'نسق مالي حديث عالي التباين مستوحى من كبريات المنصات البنكية',
    swatchHex: '#475569',
    primaryColor: '#0284C7',
    primaryHover: '#0369A1',
    accentColor: '#38BDF8',
    headerBg: '#131E2E',
    headerBorder: '#2A3F5F',
    sidebarBg: '#0D1522',
    sidebarBorder: '#21334D',
    activeItemGradient: 'from-slate-600 to-sky-700',
    activeItemBorder: 'border-sky-400/40',
  },
  emerald: {
    id: 'emerald',
    labelAr: 'الأخضر الزمردي الاستثماري',
    labelEn: 'Executive Emerald Green',
    descriptionAr: 'يرمز للنماء والربحية والاستدامة والأنشطة الغذائية والتجارية',
    swatchHex: '#059669',
    primaryColor: '#059669',
    primaryHover: '#047857',
    accentColor: '#34D399',
    headerBg: '#062419',
    headerBorder: '#0F4A34',
    sidebarBg: '#031911',
    sidebarBorder: '#0B3827',
    activeItemGradient: 'from-emerald-600 to-teal-700',
    activeItemBorder: 'border-emerald-400/40',
  },
  amber: {
    id: 'amber',
    labelAr: 'الذهبي الملكي الفاخر',
    labelEn: 'Prestige Amber & Gold',
    descriptionAr: 'مستوحى من سنابل القمح والمطاحن التراثية العريقة والذهب',
    swatchHex: '#D97706',
    primaryColor: '#D97706',
    primaryHover: '#B45309',
    accentColor: '#FBBF24',
    headerBg: '#211606',
    headerBorder: '#4E340E',
    sidebarBg: '#160E04',
    sidebarBorder: '#3B2609',
    activeItemGradient: 'from-amber-600 to-yellow-600',
    activeItemBorder: 'border-amber-400/40',
  },
  purple: {
    id: 'purple',
    labelAr: 'البنفسجي الإمبراطوري الفاخر',
    labelEn: 'Imperial Royal Purple',
    descriptionAr: 'طابع إداري راقٍ يمنح تجربة استخدام فريدة ومتميزة',
    swatchHex: '#7C3AED',
    primaryColor: '#7C3AED',
    primaryHover: '#6D28D9',
    accentColor: '#C084FC',
    headerBg: '#1D0A2B',
    headerBorder: '#441764',
    sidebarBg: '#13051C',
    sidebarBorder: '#33114B',
    activeItemGradient: 'from-purple-600 to-indigo-600',
    activeItemBorder: 'border-purple-400/40',
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

  static applyTheme(themeColor?: ThemeColor, themeMode?: ThemeMode): { color: ThemeColor; mode: ThemeMode; effectiveMode: 'light' | 'dark' } {
    const targetColor = themeColor || this.getSavedThemeColor();
    const targetMode = themeMode || this.getSavedThemeMode();
    const effectiveMode = this.getEffectiveThemeMode(targetMode);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const palette = THEME_PALETTES[targetColor] || THEME_PALETTES['blue'];

      // Apply Dark Mode Class
      if (effectiveMode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Apply Data Attributes
      root.setAttribute('data-theme-color', targetColor);
      root.setAttribute('data-theme-mode', effectiveMode);

      // Apply CSS Variables for Dynamic Theme Colors
      root.style.setProperty('--theme-primary', palette.primaryColor);
      root.style.setProperty('--theme-primary-hover', palette.primaryHover);
      root.style.setProperty('--theme-accent', palette.accentColor);
      root.style.setProperty('--theme-header-bg', palette.headerBg);
      root.style.setProperty('--theme-header-border', palette.headerBorder);
      root.style.setProperty('--theme-sidebar-bg', palette.sidebarBg);
      root.style.setProperty('--theme-sidebar-border', palette.sidebarBorder);
    }

    try {
      localStorage.setItem(this.THEME_COLOR_KEY, targetColor);
      localStorage.setItem(this.THEME_MODE_KEY, targetMode);
    } catch {}

    // Dispatch global event for reactive components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('logix-theme-changed', {
          detail: {
            themeColor: targetColor,
            themeMode: targetMode,
            effectiveMode,
          },
        })
      );
    }

    return { color: targetColor, mode: targetMode, effectiveMode };
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
}
