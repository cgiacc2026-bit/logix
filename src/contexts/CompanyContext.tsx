import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CompanyProfile, DefaultAccountsMapping } from '../types.js';
import { supabase, getCurrentCompanyId, resolveToSupabaseCompanyUUID, isSupabaseConfigured } from '../services/supabaseClient.ts';
import { SupabaseDataService } from '../services/supabaseService.ts';
import { localDataStore, DataService } from '../services/dataService.ts';
import { formatCurrency as globalFormatCurrency, setActiveCompanyConfig } from '../utils/formatters.ts';

export interface ActiveCompanyData extends CompanyProfile {
  id: string;
  name: string;
  name_ar?: string;
  currency: string;
  currency_symbol: string;
  currencySymbol: string;
  decimal_places: number;
  decimalPlaces: number;
  functional_currency: string;
  functionalCurrency: string;
}

export interface CompanyContextType {
  currentCompany: ActiveCompanyData;
  company: CompanyProfile;
  currency: string;
  setCurrency: (newCurrency: string) => Promise<void>;
  updateCompany: (updated: Partial<CompanyProfile>) => Promise<CompanyProfile>;
  reloadCompany: () => Promise<CompanyProfile | null>;
  isLoading: boolean;
  formatCurrency: (amount: number, customDecimals?: number) => string;
}

const DEFAULT_ACTIVE_COMPANY: ActiveCompanyData = {
  id: '',
  name: 'الشركة الرئيسية',
  nameAr: 'الشركة الرئيسية',
  nameEn: 'Main Enterprise',
  tradeName: '',
  legalForm: '',
  taxNumber: '',
  crNumber: '',
  crIssueDate: '',
  crExpiryDate: '',
  chamberNumber: '',
  vatRate: 0,
  vatType: 'NONE',
  zatcaPhase: 'PHASE_1_BASIC',
  zatcaEnv: 'PRODUCTION',
  city: '',
  country: '',
  streetName: '',
  buildingNo: '',
  district: '',
  postalCode: '',
  phone: '',
  mobile: '',
  email: '',
  website: '',
  fiscalYearStart: '2026-01-01',
  fiscalYearEnd: '2026-12-31',
  currency: 'KWD',
  currency_symbol: 'د.ك',
  currencySymbol: 'د.ك',
  decimal_places: 3,
  decimalPlaces: 3,
  functional_currency: 'KWD',
  functionalCurrency: 'KWD',
  accountingBasis: 'ACCRUAL',
  inventoryCosting: 'WEIGHTED_AVERAGE',
  depreciationMethod: 'STRAIGHT_LINE',
  generalManager: '',
  financialManager: '',
  chiefAccountant: '',
  showDigitalStamp: false,
  allowNegativeInventory: false,
  allowNegativeBalance: false,
};

const CompanyContext = createContext<CompanyContextType | null>(null);

export function getCanonicalCurrencySymbol(currencyCode: string): string {
  const c = (currencyCode || 'KWD').trim().toUpperCase();
  if (c === 'KWD' || c === 'د.ك' || c.includes('كويتي')) return 'د.ك';
  if (c === 'SAR' || c === 'ر.س' || c.includes('سعودي')) return 'ر.س';
  if (c === 'AED' || c === 'د.إ' || c.includes('إماراتي')) return 'د.إ';
  if (c === 'BHD' || c === 'د.ب' || c.includes('بحريني')) return 'د.ب';
  if (c === 'OMR' || c === 'ر.ع' || c.includes('عماني')) return 'ر.ع';
  if (c === 'QAR' || c === 'ر.ق' || c.includes('قطري')) return 'ر.ق';
  if (c === 'JOD' || c === 'د.أ' || c.includes('أردني')) return 'د.أ';
  if (c === 'EGP' || c === 'ج.م' || c.includes('مصري')) return 'ج.م';
  if (c === 'USD' || c === '$') return '$';
  if (c === 'EUR' || c === '€') return '€';
  return c;
}

export function getCanonicalDecimals(currencyCode: string, preferredDecimals?: number): number {
  if (preferredDecimals !== undefined && typeof preferredDecimals === 'number') {
    return preferredDecimals;
  }
  const c = (currencyCode || 'KWD').trim().toUpperCase();
  if (c === 'KWD' || c === 'BHD' || c === 'OMR' || c === 'JOD' || c.includes('كويتي') || c.includes('بحريني') || c.includes('عماني') || c.includes('أردني')) {
    return 3;
  }
  return 2;
}

export function normalizeActiveCompany(raw: any, fallbackId?: string): ActiveCompanyData {
  const profile = raw?.profile_data || raw || {};
  const effectiveId = raw?.id || profile?.id || fallbackId || getCurrentCompanyId() || DEFAULT_ACTIVE_COMPANY.id;
  const nameAr = raw?.company_name || raw?.name_ar || profile?.nameAr || profile?.name || DEFAULT_ACTIVE_COMPANY.nameAr;
  const rawCurrency = raw?.functional_currency || raw?.currency || profile?.functionalCurrency || profile?.currency || 'KWD';
  const currency = rawCurrency.trim().toUpperCase();
  const currencySymbol = raw?.currency_symbol || profile?.currencySymbol || getCanonicalCurrencySymbol(currency);
  const rawDecimals = raw?.decimal_places ?? profile?.decimalPlaces;
  const decimalPlaces = getCanonicalDecimals(currency, rawDecimals);

  const normalized: ActiveCompanyData = {
    ...DEFAULT_ACTIVE_COMPANY,
    ...profile,
    id: effectiveId,
    name: nameAr,
    nameAr: nameAr,
    name_ar: nameAr,
    nameEn: profile.nameEn || raw?.name_en || DEFAULT_ACTIVE_COMPANY.nameEn,
    currency,
    currency_symbol: currencySymbol,
    currencySymbol,
    decimal_places: decimalPlaces,
    decimalPlaces,
    functional_currency: currency,
    functionalCurrency: currency,
  };

  // Sync to formatters config immediately
  setActiveCompanyConfig({
    currency: normalized.currency,
    symbol: normalized.currency_symbol,
    decimals: normalized.decimal_places,
  });

  return normalized;
}

interface CompanyProviderProps {
  children: React.ReactNode;
  initialCompany?: CompanyProfile | null;
  onCompanyChanged?: (comp: CompanyProfile) => void;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({
  children,
  initialCompany,
  onCompanyChanged,
}) => {
  const [currentCompany, setCurrentCompany] = useState<ActiveCompanyData>(() => {
    if (initialCompany && initialCompany.id) {
      return normalizeActiveCompany(initialCompany);
    }
    // Check localStorage cache
    try {
      const stored = localStorage.getItem('supabase_company_info');
      if (stored) {
        const parsed = JSON.parse(stored);
        return normalizeActiveCompany(parsed);
      }
    } catch {
      // ignore
    }
    return DEFAULT_ACTIVE_COMPANY;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch true live active company record directly from Supabase (companies & company_accounting_settings)
  const fetchLiveCompany = useCallback(async (targetCompanyId?: string): Promise<ActiveCompanyData | null> => {
    const rawId = targetCompanyId || currentCompany.id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawId);

    if (isSupabaseConfigured && companyId) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .maybeSingle();

        if (!error && data) {
          // Also fetch company_accounting_settings
          let defaultAccounts: DefaultAccountsMapping | undefined = undefined;
          try {
            const { data: casData } = await supabase
              .from('company_accounting_settings')
              .select('*')
              .eq('company_id', companyId)
              .maybeSingle();

            if (casData) {
              defaultAccounts = {
                cashAccountId: casData.default_cash_account_id,
                bankAccountId: casData.default_bank_account_id,
                receivableAccountId: casData.default_receivable_account_id,
                payableAccountId: casData.default_payable_account_id,
                inventoryAccountId: casData.default_inventory_account_id,
                salesAccountId: casData.default_sales_account_id,
                cogsAccountId: casData.default_cogs_account_id,
                retainedEarningsAccountId: casData.default_retained_earnings_account_id,
                vatAccountId: casData.default_vat_account_id,
              };
            }
          } catch {
            // non-blocking
          }

          const merged = {
            ...data,
            profile_data: {
              ...(data.profile_data || {}),
              ...(defaultAccounts ? { defaultAccounts } : {}),
            },
          };

          const normalized = normalizeActiveCompany(merged, companyId);
          setCurrentCompany(normalized);
          // Persist to local cache for instant reload
          localStorage.setItem('supabase_company_info', JSON.stringify(normalized));
          localDataStore.saveCompany(normalized);
          return normalized;
        }
      } catch (err) {
        console.warn('[CompanyContext] Error fetching company from Supabase:', err);
      }
    }

    // Fallback to DataService
    try {
      const local = localDataStore.getCompany();
      if (local && local.nameAr) {
        const normalized = normalizeActiveCompany(local, local.id || companyId);
        setCurrentCompany(normalized);
        return normalized;
      }
    } catch {
      // ignore
    }

    return null;
  }, [currentCompany.id]);

  // Initial load
  useEffect(() => {
    fetchLiveCompany();
  }, [fetchLiveCompany]);

  // Listen for storage / cross-tab / window sync events
  useEffect(() => {
    const handleSyncEvent = (e: StorageEvent | CustomEvent) => {
      if ('key' in e && e.key === 'supabase_company_info' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const normalized = normalizeActiveCompany(parsed);
          setCurrentCompany(normalized);
        } catch {}
      } else if ('type' in e && e.type === 'company_settings_changed') {
        fetchLiveCompany();
      }
    };

    window.addEventListener('storage', handleSyncEvent as EventListener);
    window.addEventListener('company_settings_changed', handleSyncEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleSyncEvent as EventListener);
      window.removeEventListener('company_settings_changed', handleSyncEvent as EventListener);
    };
  }, [fetchLiveCompany]);

  // Update company profile in Supabase & Global State immediately
  const updateCompany = useCallback(async (updated: Partial<CompanyProfile>): Promise<CompanyProfile> => {
    setIsLoading(true);
    const activeCompanyId = resolveToSupabaseCompanyUUID(updated.id || currentCompany.id || getCurrentCompanyId());

    const newCurrency = (updated.functionalCurrency || updated.currency || currentCompany.currency || 'KWD').trim().toUpperCase();
    const newSymbol = updated.currencySymbol || getCanonicalCurrencySymbol(newCurrency);
    const newDecimals = updated.decimalPlaces !== undefined ? updated.decimalPlaces : getCanonicalDecimals(newCurrency);

    const mergedProfile: CompanyProfile = {
      ...currentCompany,
      ...updated,
      id: activeCompanyId,
      functionalCurrency: newCurrency,
      currency: newCurrency,
      currencySymbol: newSymbol,
      decimalPlaces: newDecimals,
    };

    const normalized = normalizeActiveCompany(mergedProfile, activeCompanyId);

    // 1. UPDATE Global Context State & Formatter IMMEDIATELY (Zero Delay!)
    setCurrentCompany(normalized);
    setActiveCompanyConfig({
      currency: newCurrency,
      symbol: newSymbol,
      decimals: newDecimals,
    });

    // 2. Update local stores synchronously
    localDataStore.saveCompany(normalized);
    localStorage.setItem('supabase_company_info', JSON.stringify(normalized));

    // 3. Direct UPDATE to Supabase `companies` and `company_accounting_settings`
    if (isSupabaseConfigured && activeCompanyId) {
      try {
        const updatePayload: any = {
          company_name: normalized.nameAr,
          functional_currency: newCurrency,
          currency: newCurrency,
          currency_symbol: newSymbol,
          decimal_places: newDecimals,
          logo_url: normalized.logoUrl || '',
          theme_color: normalized.themeColor || 'blue',
          theme_mode: normalized.themeMode || 'light',
          profile_data: normalized,
          updated_at: new Date().toISOString(),
        };

        const { error: compError } = await supabase
          .from('companies')
          .update(updatePayload)
          .eq('id', activeCompanyId);

        if (compError) {
          // Fallback if specific column does not exist
          console.warn('[CompanyContext] Primary update note:', compError.message);
          await supabase
            .from('companies')
            .update({
              company_name: normalized.nameAr,
              profile_data: normalized,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeCompanyId);
        }

        // Dual-write default accounts if updated
        if (normalized.defaultAccounts) {
          await SupabaseDataService.saveCompanyAccountingSettings(normalized.defaultAccounts, activeCompanyId);
        }
      } catch (err: any) {
        console.warn('[CompanyContext] Supabase sync error on updateCompany:', err?.message);
      }
    }

    // 4. Notify listeners and parent
    if (onCompanyChanged) {
      onCompanyChanged(normalized);
    }
    window.dispatchEvent(new CustomEvent('company_settings_changed', { detail: normalized }));
    setIsLoading(false);
    return normalized;
  }, [currentCompany, onCompanyChanged]);

  // Dedicated single-action currency switcher
  const setCurrency = useCallback(async (newCurrency: string) => {
    const cleanCurr = newCurrency.trim().toUpperCase();
    const symbol = getCanonicalCurrencySymbol(cleanCurr);
    const decimals = getCanonicalDecimals(cleanCurr);

    await updateCompany({
      functionalCurrency: cleanCurr,
      currency: cleanCurr,
      currencySymbol: symbol,
      decimalPlaces: decimals,
    });
  }, [updateCompany]);

  const reloadCompany = useCallback(async () => {
    return await fetchLiveCompany();
  }, [fetchLiveCompany]);

  // Centralized currency formatting method tied to current company
  const formatCurrency = useCallback((amount: number, customDecimals?: number): string => {
    return globalFormatCurrency(amount, currentCompany.currency, customDecimals !== undefined ? customDecimals : currentCompany.decimal_places);
  }, [currentCompany.currency, currentCompany.decimal_places]);

  const contextValue = useMemo<CompanyContextType>(() => ({
    currentCompany,
    company: currentCompany,
    currency: currentCompany.currency,
    setCurrency,
    updateCompany,
    reloadCompany,
    isLoading,
    formatCurrency,
  }), [currentCompany, setCurrency, updateCompany, reloadCompany, isLoading, formatCurrency]);

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

export const useActiveCompany = useCompany;
