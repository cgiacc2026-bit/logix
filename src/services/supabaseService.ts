/**
 * Direct Supabase Data Service for LOGIX Cloud ERP
 * Interacts with tables:
 * - companies
 * - items
 * - customers
 * - sales_master
 * - sales_details
 * - journal_entries
 * 
 * Strict Multi-Tenant isolation: All queries enforce .eq('company_id', currentCompanyId)
 */

import {
  supabase,
  getCurrentCompanyId,
  isSupabaseConfigured,
  resolveToSupabaseCompanyUUID,
  ALWALEED_CANONICAL_UUID,
  toValidUUID,
  generateUUID,
  checkIsSupabaseConfigured,
} from './supabaseClient.js';

export {
  supabase,
  getCurrentCompanyId,
  isSupabaseConfigured,
  resolveToSupabaseCompanyUUID,
  ALWALEED_CANONICAL_UUID,
  toValidUUID,
  generateUUID,
  checkIsSupabaseConfigured,
};
import {
  Account,
  InventoryItem,
  Customer,
  Supplier,
  Invoice,
  InvoiceLine,
  JournalEntry,
  CompanyProfile,
  DefaultAccountsMapping,
  PaymentVoucher,
  ProductionOrder,
  ManufacturingStandardSettings,
  Warehouse,
  SalesRep,
} from '../types.js';

export class SupabaseDataService {
  /**
   * 1. COMPANIES (Fetch and Update active company profile)
   */
  public static async getCompany(targetCompanyId?: string): Promise<CompanyProfile | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      let { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getCompany error:', error.message);
        return null;
      }

      if (!data) return null;

      const p = data.profile_data || {};
      const isAlWaleedCompany = companyId === ALWALEED_CANONICAL_UUID || companyId === 'company-alwaleed-client-003';
      const profile: CompanyProfile = {
        id: data.id,
        nameAr: data.company_name || p.nameAr || (isAlWaleedCompany ? 'مطحنة الوليد المتحده' : 'الشركة الجديدة'),
        nameEn: p.nameEn || (isAlWaleedCompany ? 'Al-Waleed United Mill & Food Industries' : (data.company_name || '')),
        tradeName: p.tradeName || data.company_name || (isAlWaleedCompany ? 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية' : ''),
        legalForm: p.legalForm || 'شركة ذات مسؤولية محدودة (ذ.م.م)',
        taxNumber: p.taxNumber || '',
        crNumber: p.crNumber || (isAlWaleedCompany ? '450912' : (data.login_code || '')),
        crIssueDate: p.crIssueDate || (isAlWaleedCompany ? '2015-04-12' : ''),
        crExpiryDate: p.crExpiryDate || (isAlWaleedCompany ? '2030-04-11' : ''),
        chamberNumber: p.chamberNumber || (isAlWaleedCompany ? '78214' : ''),
        vatRate: p.vatRate ?? 0,
        vatType: p.vatType || 'NONE',
        zatcaPhase: p.zatcaPhase || 'PHASE_1_BASIC',
        zatcaEnv: p.zatcaEnv || 'PRODUCTION',
        buildingNo: p.buildingNo || (isAlWaleedCompany ? 'قسيمة 42' : ''),
        streetName: p.streetName || (isAlWaleedCompany ? 'شارع الغزالي' : ''),
        district: p.district || (isAlWaleedCompany ? 'منطقة الري الصناعية' : ''),
        city: p.city || (isAlWaleedCompany ? 'الكويت' : ''),
        country: p.country || 'دولة الكويت',
        postalCode: p.postalCode || (isAlWaleedCompany ? '13001' : ''),
        additionalNo: p.additionalNo || '',
        phone: p.phone || (isAlWaleedCompany ? '+965 2484 1888' : ''),
        mobile: p.mobile || (isAlWaleedCompany ? '+965 9988 7766' : ''),
        email: data.owner_email || p.email || (isAlWaleedCompany ? 'cgiacc2026@gmail.com' : ''),
        website: p.website || (isAlWaleedCompany ? 'https://alwaleedmill.com' : ''),
        fiscalYearStart: p.fiscalYearStart || '2026-01-01',
        fiscalYearEnd: p.fiscalYearEnd || '2026-12-31',
        functionalCurrency: (data.functional_currency || data.currency || p.functionalCurrency || p.currency || 'KWD').trim().toUpperCase(),
        currency: (data.functional_currency || data.currency || p.functionalCurrency || p.currency || 'KWD').trim().toUpperCase(),
        currencySymbol: data.currency_symbol || p.currencySymbol || ((data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'KWD' ? 'د.ك' : (data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'SAR' ? 'ر.س' : 'د.ك'),
        accountingBasis: p.accountingBasis || 'ACCRUAL',
        inventoryCosting: p.inventoryCosting || 'WEIGHTED_AVERAGE',
        depreciationMethod: p.depreciationMethod || 'STRAIGHT_LINE',
        decimalPlaces: data.decimal_places ?? p.decimalPlaces ?? ((data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'KWD' || (data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'BHD' || (data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'OMR' || (data.functional_currency || p.functionalCurrency || 'KWD').trim().toUpperCase() === 'JOD' ? 3 : 2),
        generalManager: p.generalManager || (isAlWaleedCompany ? 'د. خالد السليمان' : ''),
        financialManager: p.financialManager || (isAlWaleedCompany ? 'أ. محمد الشمري' : ''),
        chiefAccountant: p.chiefAccountant || (isAlWaleedCompany ? 'أ. أحمد المصطفى' : ''),
        logoUrl: data.logo_url || data.logo || p.logoUrl || '',
        headerNotes: p.headerNotes || (isAlWaleedCompany ? 'مستند تجاري ومالي رسمي معتمد • مطحنة الوليد المتحدة • دولة الكويت' : ''),
        footerNotes: p.footerNotes || (isAlWaleedCompany ? 'الدفع خلال 30 يوماً من تاريخ استلام الفاتورة • خاضع للقوانين التجارية بدولة الكويت.' : ''),
        showDigitalStamp: p.showDigitalStamp ?? true,
        defaultAccounts: data.default_accounts || p.defaultAccounts || undefined,
        themeColor: p.themeColor || (data.theme_color as any) || undefined,
        themeMode: p.themeMode || (data.theme_mode as any) || undefined,
        allowNegativeInventory: p.allowNegativeInventory !== undefined ? p.allowNegativeInventory : (data.allow_negative_inventory !== undefined ? data.allow_negative_inventory : true),
        allowNegativeBalance: p.allowNegativeBalance !== undefined ? p.allowNegativeBalance : (data.allow_negative_balance !== undefined ? data.allow_negative_balance : true),
        posDefaultWarehouseId: p.posDefaultWarehouseId || 'wh-main-01',
        posDefaultWarehouseName: p.posDefaultWarehouseName || 'مستودع المعرض ونقطة البيع (الري)',
        posTerminalName: p.posTerminalName || 'نقطة بيع الصالة الرئيسية',
        posDefaultAccountId: p.posDefaultAccountId,
        posDefaultAccountName: p.posDefaultAccountName,
        headerTitle: p.headerTitle,
        customerBrandHeaders: p.customerBrandHeaders,
      };

      // Also check company_accounting_settings (Primary) and company_settings (Fallback)
      try {
        let mappingFromDb: DefaultAccountsMapping | null = null;

        // 1. Primary query: company_accounting_settings
        const { data: casData } = await supabase
          .from('company_accounting_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle();

        if (casData) {
          mappingFromDb = {
            cashAccountId: casData.default_cash_account_id || casData.cash_account_id,
            bankAccountId: casData.default_bank_account_id || casData.bank_account_id,
            receivableAccountId: casData.default_receivable_account_id || casData.receivable_account_id,
            payableAccountId: casData.default_payable_account_id || casData.payable_account_id,
            salesAccountId: casData.default_sales_account_id || casData.sales_account_id,
            cogsAccountId: casData.default_cogs_account_id || casData.cogs_account_id,
            inventoryAccountId: casData.default_inventory_account_id || casData.inventory_account_id,
            retainedEarningsAccountId: casData.default_retained_earnings_account_id || casData.retained_earnings_account_id,
            vatAccountId: casData.default_vat_account_id || casData.vat_account_id,
          };
        } else {
          // 2. Fallback query: company_settings
          const { data: settingsData } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

          if (settingsData) {
            mappingFromDb = {
              cashAccountId: settingsData.default_cash_account_id || profile.defaultAccounts?.cashAccountId,
              bankAccountId: settingsData.default_bank_account_id || profile.defaultAccounts?.bankAccountId,
              receivableAccountId: settingsData.default_receivable_account_id || profile.defaultAccounts?.receivableAccountId,
              payableAccountId: settingsData.default_payable_account_id || profile.defaultAccounts?.payableAccountId,
              salesAccountId: settingsData.default_sales_account_id || profile.defaultAccounts?.salesAccountId,
              cogsAccountId: settingsData.default_cogs_account_id || profile.defaultAccounts?.cogsAccountId,
              inventoryAccountId: settingsData.default_inventory_account_id || profile.defaultAccounts?.inventoryAccountId,
              retainedEarningsAccountId: settingsData.default_retained_earnings_account_id || profile.defaultAccounts?.retainedEarningsAccountId,
              vatAccountId: settingsData.default_vat_account_id || profile.defaultAccounts?.vatAccountId,
            };
          }
        }

        if (mappingFromDb) {
          profile.defaultAccounts = {
            ...(profile.defaultAccounts || {}),
            ...Object.fromEntries(Object.entries(mappingFromDb).filter(([_, v]) => Boolean(v))),
          };
        }
      } catch (settingsFetchErr) {
        // non-blocking
      }

      return profile;
    } catch (err: any) {
      console.warn('Supabase getCompany exception:', err?.message);
      return null;
    }
  }

  public static async saveCompany(comp: CompanyProfile, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || comp.id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const funcCurr = (comp.functionalCurrency || comp.currency || 'KWD').trim().toUpperCase();
      const currSym = comp.currencySymbol || (funcCurr === 'KWD' ? 'د.ك' : funcCurr === 'SAR' ? 'ر.س' : 'د.ك');
      const decPlaces = comp.decimalPlaces !== undefined ? comp.decimalPlaces : (funcCurr === 'KWD' || funcCurr === 'BHD' || funcCurr === 'OMR' || funcCurr === 'JOD' ? 3 : 2);

      const payload: any = {
        id: companyId,
        company_name: comp.nameAr,
        name_ar: comp.nameAr,
        owner_email: comp.email || 'admin@logixerp.com',
        status: 'active',
        logo_url: comp.logoUrl || '',
        theme_color: comp.themeColor || 'blue',
        theme_mode: comp.themeMode || 'light',
        default_accounts: comp.defaultAccounts || {},
        allow_negative_inventory: comp.allowNegativeInventory !== false,
        allow_negative_balance: comp.allowNegativeBalance !== false,
        pos_default_warehouse_id: comp.posDefaultWarehouseId || 'wh-main-01',
        functional_currency: funcCurr,
        currency: funcCurr,
        currency_symbol: currSym,
        decimal_places: decPlaces,
        profile_data: {
          ...comp,
          functionalCurrency: funcCurr,
          currency: funcCurr,
          currencySymbol: currSym,
          decimalPlaces: decPlaces,
        },
        raw_data: comp,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('companies')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        console.warn('Supabase saveCompany primary error, attempting fallback without new columns:', error.message);
        const fallbackPayload: any = {
          id: companyId,
          company_name: comp.nameAr,
          owner_email: comp.email || 'admin@logixerp.com',
          status: 'active',
          functional_currency: funcCurr,
          profile_data: {
            ...comp,
            functionalCurrency: funcCurr,
            currency: funcCurr,
            currencySymbol: currSym,
            decimalPlaces: decPlaces,
          },
          updated_at: new Date().toISOString(),
        };
        const { error: fallbackError } = await supabase
          .from('companies')
          .upsert([fallbackPayload], { onConflict: 'id' });

        if (fallbackError) {
          console.warn('Supabase saveCompany fallback error:', fallbackError.message);
          return false;
        }
      }

      // Upsert into company_accounting_settings & company_settings
      try {
        const dAcc = comp.defaultAccounts || {};
        const settingsRow: any = {
          company_id: companyId,
          default_cash_account_id: dAcc.cashAccountId || (comp as any).default_cash_account_id || null,
          default_bank_account_id: dAcc.bankAccountId || (comp as any).default_bank_account_id || null,
          default_receivable_account_id: dAcc.receivableAccountId || (comp as any).default_receivable_account_id || null,
          default_payable_account_id: dAcc.payableAccountId || (comp as any).default_payable_account_id || null,
          default_sales_account_id: dAcc.salesAccountId || (comp as any).default_sales_account_id || null,
          default_cogs_account_id: dAcc.cogsAccountId || (comp as any).default_cogs_account_id || null,
          default_inventory_account_id: dAcc.inventoryAccountId || (comp as any).default_inventory_account_id || null,
          default_retained_earnings_account_id: dAcc.retainedEarningsAccountId || (comp as any).default_retained_earnings_account_id || null,
          default_vat_account_id: dAcc.vatAccountId || (comp as any).default_vat_account_id || null,
          updated_at: new Date().toISOString(),
        };

        // 1. Primary: company_accounting_settings
        await supabase
          .from('company_accounting_settings')
          .upsert([settingsRow], { onConflict: 'company_id' });

        // 2. Dual-write: company_settings
        await supabase
          .from('company_settings')
          .upsert([settingsRow], { onConflict: 'company_id' });
      } catch (settingsSaveErr) {
        // non-blocking
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveCompany exception:', err?.message);
      return false;
    }
  }

  /**
   * 1.1 COMPANY ACCOUNTING SETTINGS (ربط الحسابات الافتراضية)
   * Single Source of Truth: company_accounting_settings table
   */
  public static async getCompanyAccountingSettings(targetCompanyId?: string): Promise<DefaultAccountsMapping | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;

    try {
      // 1. Primary query: company_accounting_settings
      const { data: casData, error: casErr } = await supabase
        .from('company_accounting_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (!casErr && casData) {
        return {
          cashAccountId: casData.cash_account_id || casData.default_cash_account_id || undefined,
          bankAccountId: casData.bank_account_id || casData.default_bank_account_id || undefined,
          receivableAccountId: casData.receivable_account_id || casData.default_receivable_account_id || undefined,
          payableAccountId: casData.payable_account_id || casData.default_payable_account_id || undefined,
          salesAccountId: casData.sales_account_id || casData.default_sales_account_id || undefined,
          cogsAccountId: casData.cogs_account_id || casData.default_cogs_account_id || undefined,
          inventoryAccountId: casData.inventory_account_id || casData.default_inventory_account_id || undefined,
          retainedEarningsAccountId: casData.retained_earnings_account_id || casData.default_retained_earnings_account_id || undefined,
          vatAccountId: casData.vat_account_id || casData.default_vat_account_id || undefined,
        };
      }

      // 2. Fallback query: companies table default_accounts or profile_data
      const { data: compData } = await supabase
        .from('companies')
        .select('default_accounts, profile_data, cash_account_id, bank_account_id, inventory_account_id, pnl_account_id')
        .eq('id', companyId)
        .maybeSingle();

      if (compData) {
        const def = compData.default_accounts || compData.profile_data?.defaultAccounts;
        if (def && typeof def === 'object') {
          return {
            cashAccountId: def.cashAccountId || compData.cash_account_id || undefined,
            bankAccountId: def.bankAccountId || compData.bank_account_id || undefined,
            receivableAccountId: def.receivableAccountId || undefined,
            payableAccountId: def.payableAccountId || undefined,
            salesAccountId: def.salesAccountId || compData.pnl_account_id || undefined,
            cogsAccountId: def.cogsAccountId || undefined,
            inventoryAccountId: def.inventoryAccountId || compData.inventory_account_id || undefined,
            retainedEarningsAccountId: def.retainedEarningsAccountId || undefined,
            vatAccountId: def.vatAccountId || undefined,
          };
        }
      }

      return null;
    } catch (err: any) {
      console.warn('Supabase getCompanyAccountingSettings exception:', err?.message);
      return null;
    }
  }

  public static async saveCompanyAccountingSettings(
    mapping: DefaultAccountsMapping,
    targetCompanyId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;

    try {
      // 1. Primary write: company_accounting_settings with verified schema columns
      const casPayload: any = {
        company_id: companyId,
        cash_account_id: mapping.cashAccountId || null,
        bank_account_id: mapping.bankAccountId || null,
        receivable_account_id: mapping.receivableAccountId || null,
        payable_account_id: mapping.payableAccountId || null,
        sales_account_id: mapping.salesAccountId || null,
        cogs_account_id: mapping.cogsAccountId || null,
        inventory_account_id: mapping.inventoryAccountId || null,
        retained_earnings_account_id: mapping.retainedEarningsAccountId || null,
        vat_account_id: mapping.vatAccountId || null,
        settings_data: {
          defaultAccounts: mapping,
          savedAt: new Date().toISOString(),
          isWired: true,
        },
        updated_at: new Date().toISOString(),
      };

      const { error: casErr } = await supabase
        .from('company_accounting_settings')
        .upsert([casPayload], { onConflict: 'company_id' });

      if (casErr) {
        console.warn('Primary company_accounting_settings upsert error:', casErr);
        // Fallback attempt with default_ prefix if columns were modified
        const altPayload = {
          ...casPayload,
          default_cash_account_id: mapping.cashAccountId || null,
          default_bank_account_id: mapping.bankAccountId || null,
          default_receivable_account_id: mapping.receivableAccountId || null,
          default_payable_account_id: mapping.payableAccountId || null,
          default_sales_account_id: mapping.salesAccountId || null,
          default_cogs_account_id: mapping.cogsAccountId || null,
          default_inventory_account_id: mapping.inventoryAccountId || null,
          default_retained_earnings_account_id: mapping.retainedEarningsAccountId || null,
          default_vat_account_id: mapping.vatAccountId || null,
        };
        await supabase.from('company_accounting_settings').upsert([altPayload], { onConflict: 'company_id' });
      }

      // 2. Dual-sync to companies table
      try {
        await supabase
          .from('companies')
          .update({
            default_accounts: mapping,
            cash_account_id: mapping.cashAccountId || null,
            bank_account_id: mapping.bankAccountId || null,
            inventory_account_id: mapping.inventoryAccountId || null,
            pnl_account_id: mapping.salesAccountId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId);
      } catch (cErr) {
        // non-blocking
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveCompanyAccountingSettings exception:', err?.message);
      return false;
    }
  }

  public static async autoSeedCompanyAccountingSettings(
    targetCompanyId?: string
  ): Promise<{ success: boolean; mapping: DefaultAccountsMapping }> {
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return { success: false, mapping: {} };

    // Fetch accounts from chart_of_accounts
    const accounts = (await this.getAccounts(companyId)) || [];

    const findAcc = (codes: string[], keywords: string[], category?: string) => {
      for (const c of codes) {
        const found = accounts.find((a) => a.code === c);
        if (found) return found.id;
      }
      for (const c of codes) {
        const found = accounts.find((a) => a.code && a.code.startsWith(c));
        if (found) return found.id;
      }
      for (const k of keywords) {
        const found = accounts.find(
          (a) =>
            ((a.nameAr && a.nameAr.includes(k)) ||
              (a.nameEn && a.nameEn.toLowerCase().includes(k.toLowerCase()))) &&
            (!category || a.category === category)
        );
        if (found) return found.id;
      }
      return undefined;
    };

    const mapping: DefaultAccountsMapping = {
      cashAccountId: findAcc(['1111', '1113', '1110', '111'], ['صندوق', 'نقدية', 'كاش', 'cash'], 'ASSET'),
      bankAccountId: findAcc(['1112', '1114', '112'], ['بنك', 'مصرف', 'bank'], 'ASSET'),
      receivableAccountId: findAcc(['1120', '1121', '112'], ['عملاء', 'مدين', 'زبائن', 'receivable', 'customer'], 'ASSET'),
      payableAccountId: findAcc(['2110', '2111', '211'], ['مورد', 'دائن', 'موردين', 'payable', 'supplier'], 'LIABILITY'),
      salesAccountId: findAcc(['4100', '4110', '41'], ['مبيعات', 'إيراد', 'sales', 'revenue'], 'REVENUE'),
      cogsAccountId: findAcc(['5100', '5110', '51'], ['تكلفة', 'بضاعة مباعة', 'cogs', 'cost'], 'EXPENSE'),
      inventoryAccountId: findAcc(['1130', '1131', '113'], ['مخزون', 'بضاعة', 'inventory', 'stock'], 'ASSET'),
      retainedEarningsAccountId: findAcc(['3200', '3210', '32'], ['أرباح مبقاة', 'أرباح مرحلة', 'retained', 'earnings'], 'EQUITY'),
      vatAccountId: findAcc(['2120', '2121', '212'], ['ضريبة', 'مضافة', 'vat', 'tax'], 'LIABILITY'),
    };

    await this.saveCompanyAccountingSettings(mapping, companyId);
    return { success: true, mapping };
  }

  /**
   * 2. ITEMS (الأصناف والمخزون)
   */
  public static async getItems(targetCompanyId?: string): Promise<InventoryItem[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      let { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase getItems error:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        return {
          id: raw.id || row.id,
          sku: row.code || raw.sku || raw.code || row.id,
          barcode: row.barcode || raw.barcode || '',
          nameAr: row.name_ar || row.name || raw.nameAr || '',
          nameEn: row.name_en || raw.nameEn || '',
          category: row.category || raw.category || 'عام',
          unit: row.unit || raw.unit || 'حبة',
          unitsPerPack: raw.unitsPerPack || 1,
          packUnit: raw.packUnit || '',
          purchasePrice: Number(row.cost_price ?? raw.purchasePrice ?? raw.costPrice ?? 0),
          costPrice: Number(row.cost_price ?? raw.costPrice ?? raw.purchasePrice ?? 0),
          salePrice: Number(row.selling_price ?? row.sale_price ?? raw.salePrice ?? 0),
          isActive: raw.isActive ?? row.is_active ?? true,
          ...raw,
          quantityOnHand: Number(row.current_balance ?? row.qty_on_hand ?? raw.quantityOnHand ?? 0),
        };
      });
    } catch (err: any) {
      console.warn('Supabase getItems exception:', err?.message);
      return [];
    }
  }

  public static async saveItem(item: InventoryItem, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || (item as any).companyId || (item as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const itemUuid = toValidUUID(item.id);
      const targetCode = item.sku || (item as any).code || item.id;

      // Check if an existing item in Supabase has matching code/SKU or UUID to avoid duplicate orphaned rows
      const { data: existingRows } = await supabase
        .from('items')
        .select('id, raw_data')
        .eq('company_id', companyId)
        .or(`code.eq.${targetCode},id.eq.${itemUuid}`)
        .limit(1);

      const targetId = (existingRows && existingRows.length > 0) ? existingRows[0].id : itemUuid;

      const { error } = await supabase
        .from('items')
        .upsert([
          {
            id: targetId,
            company_id: companyId,
            code: targetCode,
            name: item.nameAr || (item as any).name || 'صنف',
            item_name: item.nameAr || (item as any).name || 'صنف',
            name_ar: item.nameAr,
            name_en: item.nameEn || '',
            category: item.category || 'عام',
            unit: item.unit || 'حبة',
            cost_price: item.purchasePrice || (item as any).costPrice || 0,
            sale_price: item.salePrice || 0,
            selling_price: item.salePrice || 0,
            current_balance: item.quantityOnHand || 0,
            qty_on_hand: item.quantityOnHand || 0,
            min_limit: item.minQuantityAlert || 0,
            raw_data: {
              ...item,
              id: item.id,
              companyId,
              quantityOnHand: item.quantityOnHand || 0,
            },
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn('Supabase saveItem error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveItem exception:', err?.message);
      return false;
    }
  }

  /**
   * Directly and atomically adjusts stock quantity and moving average cost for an item in Supabase.
   * Matches by SKU/code, barcode, or UUID to guarantee exact row update.
   */
  public static async adjustItemStock(
    itemId?: string,
    sku?: string,
    barcode?: string,
    newBalance?: number,
    targetCompanyId?: string,
    newCostPrice?: number
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;

    try {
      let query = supabase.from('items').select('id, current_balance, cost_price, raw_data').eq('company_id', companyId);
      if (sku) {
        query = query.eq('code', sku);
      } else if (barcode) {
        query = query.eq('barcode', barcode);
      } else if (itemId) {
        query = query.eq('id', toValidUUID(itemId));
      } else {
        return false;
      }

      const { data: matched } = await query.limit(1);
      if (matched && matched.length > 0) {
        const itemRow = matched[0];
        const balance = typeof newBalance === 'number' ? newBalance : itemRow.current_balance;
        const updatedRaw = { ...(itemRow.raw_data || {}), quantityOnHand: balance };

        const updatePayload: any = {
          current_balance: balance,
          qty_on_hand: balance,
          raw_data: updatedRaw,
          updated_at: new Date().toISOString(),
        };

        if (typeof newCostPrice === 'number' && !isNaN(newCostPrice) && newCostPrice >= 0) {
          const roundedCost = Math.round(newCostPrice * 1000) / 1000;
          updatePayload.cost_price = roundedCost;
          updatedRaw.costPrice = roundedCost;
          updatedRaw.purchasePrice = roundedCost;
        }

        const { error } = await supabase
          .from('items')
          .update(updatePayload)
          .eq('id', itemRow.id);

        if (error) {
          console.warn('Supabase adjustItemStock error:', error.message);
          return false;
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Supabase adjustItemStock exception:', err?.message);
      return false;
    }
  }

  public static async saveItems(items: InventoryItem[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || items.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = items.map((item) => ({
        id: toValidUUID(item.id),
        company_id: companyId,
        code: item.sku || (item as any).code || item.id,
        name: item.nameAr || (item as any).name || 'صنف',
        item_name: item.nameAr || (item as any).name || 'صنف',
        name_ar: item.nameAr,
        name_en: item.nameEn || '',
        category: item.category || 'عام',
        unit: item.unit || 'حبة',
        cost_price: item.purchasePrice || (item as any).costPrice || 0,
        sale_price: item.salePrice || 0,
        selling_price: item.salePrice || 0,
        current_balance: item.quantityOnHand || 0,
        qty_on_hand: item.quantityOnHand || 0,
        min_limit: item.minQuantityAlert || 0,
        raw_data: {
          ...item,
          id: item.id,
          companyId,
        },
        created_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('items').upsert(batch);
        if (error) {
          console.warn('Supabase saveItems batch error:', error.message);
        }
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveItems exception:', err?.message);
      return false;
    }
  }

  public static async saveInventory(items: InventoryItem[], targetCompanyId?: string): Promise<boolean> {
    return this.saveItems(items, targetCompanyId);
  }

  public static async deleteItem(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const itemUuid = toValidUUID(id);
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${itemUuid},code.eq.${id}`);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteItem exception:', err?.message);
      return false;
    }
  }

  /**
   * 3. CUSTOMERS (العملاء)
   */
  public static async getCustomers(targetCompanyId?: string): Promise<Customer[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      let { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase getCustomers error:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      let dbBranches: any[] = [];
      try {
        const { data: brData } = await supabase
          .from('customer_branches')
          .select('*')
          .eq('company_id', companyId);
        if (brData) dbBranches = brData;
      } catch (brErr: any) {
        console.warn('Supabase customer_branches fetch notice:', brErr?.message);
      }

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        const custBranchesFromDb = dbBranches
          .filter((b: any) => b.customer_id === row.id)
          .map((b: any) => ({
            id: b.id,
            code: b.code || 'BR-01',
            nameAr: b.name_ar,
            nameEn: b.name_en || '',
            customerId: row.code || row.id,
            governorate: b.governorate || '',
            city: b.city || '',
            detailedAddress: b.detailed_address || '',
            address: b.detailed_address || '',
            contactPerson: b.contact_person || '',
            contactPhone: b.contact_phone || '',
            phone: b.contact_phone || '',
            isDefault: Boolean(b.is_default),
            isActive: Boolean(b.is_active ?? true),
          }));

        const finalBranches = custBranchesFromDb.length > 0 ? custBranchesFromDb : (raw.branches || []);

        return {
          id: raw.id || row.id,
          code: row.code || raw.code || row.id,
          nameAr: row.name_ar || row.name || raw.nameAr || '',
          nameEn: row.name_en || raw.nameEn || '',
          phone: row.phone || raw.phone || '',
          address: row.address || raw.address || '',
          city: row.city || raw.city || 'الرياض',
          balance: Number(row.balance ?? raw.balance ?? 0),
          taxNumber: row.tax_number || raw.taxNumber || '',
          creditLimit: raw.creditLimit ?? 0,
          openingBalance: Number(row.opening_balance ?? raw.openingBalance ?? 0),
          openingBalanceDate: raw.openingBalanceDate || '2026-07-01',
          isActive: raw.isActive ?? row.is_active ?? true,
          branches: finalBranches,
          priceListName: raw.priceListName || '',
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getCustomers exception:', err?.message);
      return [];
    }
  }

  public static async saveCustomer(cust: Customer, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || (cust as any).companyId || (cust as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const custUuid = toValidUUID(cust.id);
      const { error } = await supabase
        .from('customers')
        .upsert([
          {
            id: custUuid,
            company_id: companyId,
            code: cust.code || cust.id,
            name: cust.nameAr || (cust as any).name || 'عميل',
            name_ar: cust.nameAr,
            name_en: cust.nameEn || '',
            phone: cust.phone || '',
            address: cust.address || '',
            city: cust.city || '',
            balance: cust.balance || 0,
            current_balance: cust.balance || 0,
            opening_balance: Number(cust.openingBalance || 0),
            tax_number: cust.taxNumber || '',
            raw_data: {
              ...cust,
              id: cust.id,
              companyId,
            },
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn('Supabase saveCustomer error:', error.message);
        return false;
      }

      // Sync customer branches to customer_branches table if present
      if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
        const branchRows = cust.branches.map((b) => ({
          id: toValidUUID(b.id || `br-${cust.id}-${b.code}`),
          company_id: companyId,
          customer_id: custUuid,
          code: b.code || 'BR-01',
          name_ar: b.nameAr || 'فرع',
          name_en: b.nameEn || '',
          governorate: b.governorate || '',
          city: b.city || '',
          detailed_address: b.detailedAddress || b.address || '',
          contact_person: b.contactPerson || '',
          contact_phone: b.contactPhone || b.phone || '',
          is_default: !!b.isDefault,
          is_active: b.isActive !== false,
        }));
        try {
          await supabase.from('customer_branches').upsert(branchRows);
        } catch (e) {
          console.warn('Supabase branch sync notice:', e);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveCustomer exception:', err?.message);
      return false;
    }
  }

  public static async saveCustomers(customers: Customer[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || customers.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = customers.map((cust) => ({
        id: toValidUUID(cust.id),
        company_id: companyId,
        code: cust.code || cust.id,
        name: cust.nameAr || (cust as any).name || 'عميل',
        name_ar: cust.nameAr,
        name_en: cust.nameEn || '',
        phone: cust.phone || '',
        address: cust.address || '',
        city: cust.city || '',
        balance: cust.balance || 0,
        current_balance: cust.balance || 0,
        opening_balance: Number(cust.openingBalance || 0),
        tax_number: cust.taxNumber || '',
        raw_data: {
          ...cust,
          id: cust.id,
          companyId,
        },
        created_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('customers').upsert(batch);
        if (error) {
          console.warn('Supabase saveCustomers batch error:', error.message);
        }
      }

      // Sync customer branches to customer_branches table
      const allBranchRows: any[] = [];
      for (const cust of customers) {
        if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
          const custUuid = toValidUUID(cust.id);
          for (const b of cust.branches) {
            allBranchRows.push({
              id: toValidUUID(b.id || `br-${cust.id}-${b.code}`),
              company_id: companyId,
              customer_id: custUuid,
              code: b.code || 'BR-01',
              name_ar: b.nameAr || 'فرع',
              name_en: b.nameEn || '',
              governorate: b.governorate || '',
              city: b.city || '',
              detailed_address: b.detailedAddress || '',
              contact_person: b.contactPerson || '',
              contact_phone: b.contactPhone || '',
              is_default: !!b.isDefault,
              is_active: b.isActive !== false,
            });
          }
        }
      }
      if (allBranchRows.length > 0) {
        for (let i = 0; i < allBranchRows.length; i += 50) {
          const batch = allBranchRows.slice(i, i + 50);
          try {
            await supabase.from('customer_branches').upsert(batch);
          } catch (e) {
            console.warn('Supabase batch branch notice:', e);
          }
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveCustomers exception:', err?.message);
      return false;
    }
  }

  public static async deleteCustomer(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const custUuid = toValidUUID(id);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${custUuid},code.eq.${id}`);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteCustomer exception:', err?.message);
      return false;
    }
  }

  /**
   * 3.1 SUPPLIERS (الموردين)
   */
  public static async getSuppliers(targetCompanyId?: string): Promise<Supplier[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      let { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase getSuppliers error:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        return {
          id: raw.id || row.id,
          code: row.code || raw.code || row.id,
          nameAr: row.name_ar || raw.nameAr || '',
          nameEn: row.name_en || raw.nameEn || '',
          phone: row.phone || raw.phone || '',
          address: row.address || raw.address || '',
          city: row.city || raw.city || 'الرياض',
          balance: Number(row.balance ?? raw.balance ?? 0),
          openingBalance: raw.openingBalance ?? 0,
          isActive: raw.isActive ?? true,
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getSuppliers exception:', err?.message);
      return [];
    }
  }

  public static async saveSupplier(supp: Supplier, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || (supp as any).companyId || (supp as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const supUuid = toValidUUID(supp.id);
      const { error } = await supabase
        .from('suppliers')
        .upsert([
          {
            id: supUuid,
            company_id: companyId,
            code: supp.code || supp.id,
            name_ar: supp.nameAr,
            name_en: supp.nameEn || '',
            phone: supp.phone || '',
            address: supp.address || '',
            city: supp.city || '',
            balance: supp.balance || 0,
            current_balance: supp.balance || 0,
            raw_data: {
              ...supp,
              id: supp.id,
              companyId,
            },
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn('Supabase saveSupplier error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveSupplier exception:', err?.message);
      return false;
    }
  }

  public static async saveSuppliers(suppliers: Supplier[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || suppliers.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = suppliers.map((s) => ({
        id: toValidUUID(s.id),
        company_id: companyId,
        code: s.code || s.id,
        name_ar: s.nameAr,
        name_en: s.nameEn || '',
        phone: s.phone || '',
        address: s.address || '',
        city: s.city || '',
        balance: s.balance || 0,
        current_balance: s.balance || 0,
        raw_data: {
          ...s,
          id: s.id,
          companyId,
        },
        created_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('suppliers').upsert(batch);
        if (error) {
          console.warn('Supabase saveSuppliers batch error:', error.message);
        }
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveSuppliers exception:', err?.message);
      return false;
    }
  }

  public static async deleteSupplier(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const supUuid = toValidUUID(id);
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${supUuid},code.eq.${id}`);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteSupplier exception:', err?.message);
      return false;
    }
  }

  /**
   * 4. INVOICES & INVOICE_ITEMS (الفواتير وبنودها مع التوافق التبادلي الكامل)
   */
  public static async getInvoices(targetCompanyId?: string): Promise<Invoice[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];

    try {
      // 1. Single Source of Truth: Query 'invoices' table
      const { data: invTableData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (invErr) {
        console.warn('Supabase getInvoices error:', invErr.message);
        return [];
      }

      if (!invTableData || invTableData.length === 0) {
        return [];
      }

      // Query related invoice_items
      const { data: itemRows } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('company_id', companyId);

      const itemsByInvoice: Record<string, InvoiceLine[]> = {};
      if (itemRows) {
        itemRows.forEach((it: any) => {
          const raw = it.raw_data || {};
          const snapshot = it.item_snapshot || {};
          const qty = Number(it.quantity ?? raw.quantity ?? 1);
          const unitPrice = Number(it.unit_price ?? raw.unitPrice ?? 0);
          const total = Number(it.total_price ?? raw.total ?? (qty * unitPrice));
          const line: InvoiceLine = {
            id: raw.id || it.id,
            itemId: it.item_id || raw.itemId || snapshot.itemId || '',
            itemSku: raw.itemSku || snapshot.sku || '',
            barcode: raw.barcode || snapshot.barcode || '',
            itemNameAr: it.item_name || raw.itemNameAr || snapshot.nameAr || 'صنف',
            itemNameEn: raw.itemNameEn || '',
            unit: raw.unit || snapshot.unit || 'حبة',
            unitsPerPack: raw.unitsPerPack || snapshot.unitsPerPack || 1,
            quantity: qty,
            unitPrice: unitPrice,
            subtotal: Number(raw.subtotal ?? (qty * unitPrice)),
            vatRate: Number(it.tax_rate ?? raw.vatRate ?? 0),
            vatAmount: Number(it.tax_amount ?? raw.vatAmount ?? 0),
            discountAmount: Number(raw.discountAmount ?? 0),
            discountPercent: Number(raw.discountPercent ?? 0),
            total: total,
            ...raw,
          };

          const key = it.invoice_id;
          if (key) {
            if (!itemsByInvoice[key]) itemsByInvoice[key] = [];
            itemsByInvoice[key].push(line);
          }
        });
      }

      return invTableData.map((inv: any) => {
        const raw = inv.raw_data || {};
        const snapshot = inv.customer_snapshot || {};
        const rawLines = Array.isArray(raw.lines) && raw.lines.length > 0 ? raw.lines : null;
        const invLines = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : null;
        const lines = (itemsByInvoice[inv.id] && itemsByInvoice[inv.id].length > 0 ? itemsByInvoice[inv.id] : null) || rawLines || invLines || [];
        const warehouseId = inv.warehouse_id || raw.warehouseId || raw.warehouse_id || 'wh-main-01';
        const warehouseName = raw.warehouseName || raw.warehouse_name || 'المستودع الرئيسي (الشويخ)';
        const salesRepId = raw.salesRepId || raw.rep_id || raw.sales_rep_id || 'rep-01';
        const salesPerson = raw.salesPerson || raw.salesRepName || 'المندوب العام';
        const salesRepName = raw.salesRepName || raw.salesPerson || 'المندوب العام';

        // Clean ERP Status: Must be POSTED, DRAFT, or CANCELLED
        let cleanStatus: 'POSTED' | 'DRAFT' | 'CANCELLED' = 'POSTED';
        if (inv.status === 'CANCELLED' || raw.status === 'CANCELLED') cleanStatus = 'CANCELLED';
        else if (inv.status === 'DRAFT' || raw.status === 'DRAFT') cleanStatus = 'DRAFT';
        else cleanStatus = 'POSTED';

        // Clean ERP Payment Status: Must be PAID, PARTIAL, or UNPAID
        let cleanPaymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
        if (inv.payment_status === 'PAID' || raw.paymentStatus === 'PAID') cleanPaymentStatus = 'PAID';
        else if (inv.payment_status === 'PARTIAL' || raw.paymentStatus === 'PARTIAL') cleanPaymentStatus = 'PARTIAL';
        else if (Number(inv.due_amount ?? 0) <= 0 && Number(inv.total_amount ?? 0) > 0) cleanPaymentStatus = 'PAID';
        else if (Number(inv.paid_amount ?? 0) > 0) cleanPaymentStatus = 'PARTIAL';
        else cleanPaymentStatus = 'UNPAID';

        return {
          ...raw,
          id: raw.id || inv.id,
          invoiceNumber: inv.invoice_number || raw.invoiceNumber || inv.id,
          type: raw.type || inv.invoice_type || 'SALES',
          paymentTerms: raw.paymentTerms || (inv.payment_method === 'CREDIT' ? 'CREDIT' : 'CASH'),
          entityId: inv.customer_id || raw.entityId || snapshot.id || '',
          entityNameAr: inv.customer_name || raw.entityNameAr || snapshot.nameAr || '',
          entityNameEn: raw.entityNameEn || snapshot.nameEn || '',
          date: inv.invoice_date || inv.date || raw.date,
          dueDate: raw.dueDate || inv.invoice_date || inv.date,
          status: cleanStatus,
          paymentStatus: cleanPaymentStatus,
          warehouseId,
          warehouse_id: warehouseId,
          warehouseName,
          salesRepId,
          rep_id: salesRepId,
          sales_rep_id: salesRepId,
          salesPerson,
          salesRepName,
          lines,
          subtotal: Number(inv.subtotal ?? raw.subtotal ?? 0),
          vatTotal: Number(inv.tax_amount ?? inv.vat_amount ?? raw.vatTotal ?? 0),
          discountTotal: Number(raw.discountTotal ?? 0),
          grandTotal: Number(inv.total_amount ?? raw.grandTotal ?? 0),
          paidAmount: Number(inv.paid_amount ?? raw.paidAmount ?? 0),
          dueAmount: Number(inv.due_amount ?? raw.dueAmount ?? 0),
          createdAt: raw.createdAt || inv.created_at || new Date().toISOString(),
        };
      });
    } catch (err: any) {
      console.warn('Supabase getInvoices exception:', err?.message);
      return [];
    }
  }

  public static async getNextUniqueInvoiceNumber(isSales: boolean, companyId: string): Promise<string> {
    const prefix = isSales ? 'INV-SAL-2026-' : 'INV-PUR-2026-';
    try {
      const { data: rows } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', companyId)
        .ilike('invoice_number', `${prefix}%`);
      let maxNum = 0;
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const num = parseInt((r.invoice_number || '').replace(prefix, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
    } catch {
      return `${prefix}${Date.now().toString().slice(-4)}`;
    }
  }

  public static async saveInvoice(inv: Invoice, targetCompanyId?: string): Promise<boolean> {
    const rawCompanyId = targetCompanyId || (inv as any).companyId || (inv as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) {
      throw new Error('تعذر تحديد معرّف الشركة (company_id) في Supabase. يرجى التحقق من تسجيل الدخول واختيار الشركة النشطة.');
    }

    const invUuid = toValidUUID(inv.id);
    inv.id = invUuid;

    // Foreign key candidate for customer_id (must be valid UUID or null)
    let customerIdCandidate: string | null = null;
    if (inv.entityId) {
      customerIdCandidate = toValidUUID(inv.entityId);
    }

    const subtotal = Number(inv.subtotal || 0);
    const taxAmount = Number(inv.vatTotal ?? (inv as any).taxAmount ?? (inv as any).tax_amount ?? 0);
    const totalAmount = Number(inv.grandTotal ?? (inv as any).totalAmount ?? (inv as any).total_amount ?? (subtotal + taxAmount));
    const paidAmount = Number(inv.paidAmount || 0);
    const dueAmount = Number(inv.dueAmount || Math.max(0, totalAmount - paidAmount));

    const paymentStatus = (paidAmount >= totalAmount && totalAmount > 0)
      ? 'PAID'
      : (paidAmount > 0)
      ? 'PARTIAL'
      : (inv.status || 'POSTED');

    // Flexible JSONB snapshot of customer data
    const customerSnapshot = {
      id: inv.entityId || '',
      nameAr: inv.entityNameAr || (inv as any).entityName || '',
      nameEn: (inv as any).entityNameEn || '',
      phone: (inv as any).customerPhone || (inv as any).phone || '',
      address: (inv as any).customerAddress || (inv as any).address || '',
      taxNumber: (inv as any).customerTaxNumber || (inv as any).taxNumber || '',
      balance: Number((inv as any).customerBalance ?? 0),
    };

    // 1. Prepare modern invoices table payload
    const effectiveWarehouseId = inv.warehouseId || (inv as any).warehouse_id || 'wh-main-01';
    const effectiveWarehouseName = inv.warehouseName || (inv as any).warehouse_name || 'المستودع الرئيسي (الشويخ)';
    const effectiveSalesRepId = inv.salesRepId || (inv as any).rep_id || (inv as any).sales_rep_id || 'rep-01';
    const effectiveSalesPerson = inv.salesPerson || inv.salesRepName || 'المندوب العام';
    const effectiveSalesRepName = inv.salesRepName || inv.salesPerson || 'المندوب العام';

    // Ensure valid and unique invoice_number
    let finalInvoiceNumber = (inv.invoiceNumber || '').trim();
    if (!finalInvoiceNumber || finalInvoiceNumber === 'undefined') {
      finalInvoiceNumber = await this.getNextUniqueInvoiceNumber(inv.type === 'SALES' || !inv.type, companyId);
      inv.invoiceNumber = finalInvoiceNumber;
    }

    // Check for uniqueness collisions against existing invoices of other IDs
    try {
      const { data: existingRow } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('company_id', companyId)
        .eq('invoice_number', finalInvoiceNumber)
        .maybeSingle();

      if (existingRow && existingRow.id !== invUuid) {
        console.warn(`[Supabase saveInvoice] Auto-resolving collision on ${finalInvoiceNumber} (owned by ${existingRow.id})`);
        finalInvoiceNumber = await this.getNextUniqueInvoiceNumber(inv.type === 'SALES' || !inv.type, companyId);
        inv.invoiceNumber = finalInvoiceNumber;
      }
    } catch (checkErr) {
      console.warn('[Supabase saveInvoice] Collision check notice:', checkErr);
    }

    // Formatted items array for JSONB storage
    const formattedItems = (inv.lines || []).map((it, idx) => ({
      itemId: it.itemId || `item-${idx + 1}`,
      itemSku: it.itemSku || '',
      barcode: it.barcode || '',
      itemNameAr: it.itemNameAr || (it as any).itemName || 'صنف',
      unit: it.unit || 'حبة',
      unitsPerPack: it.unitsPerPack || 1,
      quantity: Number(it.quantity ?? (it as any).qty ?? 1),
      unitPrice: Number(it.unitPrice ?? (it as any).unit_price ?? 0),
      discountValue: Number(it.discountValue || 0),
      discountAmount: Number(it.discountAmount || 0),
      vatRate: Number(it.vatRate ?? (it as any).tax_rate ?? 0),
      vatAmount: Number(it.vatAmount ?? (it as any).tax_amount ?? 0),
      total: Number(it.total ?? (it as any).total_price ?? (it as any).line_total ?? 0),
      notes: it.notes || '',
    }));

    const invoicePayload: any = {
      id: invUuid,
      company_id: companyId,
      invoice_number: finalInvoiceNumber,
      invoice_date: inv.date || new Date().toISOString().split('T')[0],
      date: inv.date || new Date().toISOString().split('T')[0],
      customer_id: customerIdCandidate,
      customer_name: inv.entityNameAr || (inv as any).entityName || 'عميل نقدي',
      subtotal: subtotal,
      tax_amount: taxAmount,
      vat_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_status: paymentStatus,
      status: inv.status || 'POSTED',
      payment_method: inv.paymentTerms || 'CASH',
      invoice_type: inv.type || 'SALES',
      warehouse_id: effectiveWarehouseId,
      customer_branch_id: inv.customerBranchId || (inv as any).customer_branch_id || null,
      customer_branch_name: inv.customerBranchName || (inv as any).customer_branch_name || null,
      price_list_id: inv.priceListApplied || (inv as any).price_list_id || null,
      price_list_applied: inv.priceListApplied || (inv as any).price_list_applied || null,
      items: formattedItems,
      customer_snapshot: customerSnapshot,
      raw_data: {
        ...inv,
        id: invUuid,
        invoiceNumber: finalInvoiceNumber,
        companyId,
        customerSnapshot,
        warehouseId: effectiveWarehouseId,
        warehouse_id: effectiveWarehouseId,
        warehouseName: effectiveWarehouseName,
        salesRepId: effectiveSalesRepId,
        rep_id: effectiveSalesRepId,
        sales_rep_id: effectiveSalesRepId,
        salesPerson: effectiveSalesPerson,
        salesRepName: effectiveSalesRepName,
        items: formattedItems,
      },
      created_at: inv.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2. Prepare modern invoice_items table rows
    const invoiceItemRows = formattedItems.map((it, idx) => {
      // Always generate a guaranteed fresh UUID to eliminate invoice_items_pkey unique violations
      const detailUuid = generateUUID();
      const itemUuidCandidate = it.itemId ? toValidUUID(it.itemId) : null;

      return {
        id: detailUuid,
        invoice_id: invUuid,
        company_id: companyId,
        item_id: itemUuidCandidate,
        item_name: it.itemNameAr,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.total,
        tax_rate: it.vatRate,
        tax_amount: it.vatAmount,
        item_snapshot: {
          itemId: it.itemId || '',
          sku: it.itemSku || '',
          barcode: it.barcode || '',
          nameAr: it.itemNameAr || '',
          unit: it.unit || 'حبة',
          unitsPerPack: it.unitsPerPack || 1,
        },
        raw_data: it,
        created_at: new Date().toISOString(),
      };
    });

    // --- STRICT DIRECT PERSISTENCE WITH EXPLICIT ERROR HANDLING ---
    let insertResult = await supabase
      .from('invoices')
      .upsert([invoicePayload], { onConflict: 'company_id, invoice_number' })
      .select('id, invoice_number, company_id, created_at')
      .single();

    let invErr = insertResult.error;
    let insertedRow = insertResult.data;

    // Retry 1: If foreign key on customer_id failed, retry with customer_id set to null
    if (invErr && (invErr.message.includes('foreign key') || invErr.message.includes('fkey') || invErr.code === '23503')) {
      console.warn('[Supabase saveInvoice] Foreign key customer_id candidate failed in invoices table, retrying with null...');
      invoicePayload.customer_id = null;
      insertResult = await supabase
        .from('invoices')
        .upsert([invoicePayload], { onConflict: 'company_id, invoice_number' })
        .select('id, invoice_number, company_id, created_at')
        .single();
      invErr = insertResult.error;
      insertedRow = insertResult.data;
    }

    // Retry 2: If unique constraint conflict, advance sequence and retry
    if (invErr && (invErr.code === '23505' || invErr.message.includes('unique constraint') || invErr.message.includes('already exists'))) {
      console.warn('[Supabase saveInvoice] Unique conflict on upsert, advancing sequence and retrying...');
      finalInvoiceNumber = await this.getNextUniqueInvoiceNumber(inv.type === 'SALES' || !inv.type, companyId);
      inv.invoiceNumber = finalInvoiceNumber;
      invoicePayload.invoice_number = finalInvoiceNumber;
      if (invoicePayload.raw_data) {
        invoicePayload.raw_data.invoiceNumber = finalInvoiceNumber;
      }
      insertResult = await supabase
        .from('invoices')
        .upsert([invoicePayload], { onConflict: 'company_id, invoice_number' })
        .select('id, invoice_number, company_id, created_at')
        .single();
      invErr = insertResult.error;
      insertedRow = insertResult.data;
    }

    // ZERO TOLERANCE: If Supabase returned an error, throw it immediately!
    if (invErr) {
      console.error('[Supabase saveInvoice CRITICAL DB ERROR]:', invErr);
      throw new Error(`[Supabase Database Error]: ${invErr.message || invErr.details || 'فشل حفظ الفاتورة في جدول invoices'}`);
    }

    // Verify row was actually created and returned with an ID
    if (!insertedRow || !insertedRow.id) {
      throw new Error('فشل تأكيد الحفظ: لم تستجب قاعدة بيانات Supabase بمعرّف السجل (id) المحفوظ حديثاً.');
    }

    // Guarantee the in-memory object has the exact verified DB values
    inv.id = insertedRow.id;
    inv.invoiceNumber = insertedRow.invoice_number;

    // Persist items into invoice_items table
    if (invoiceItemRows.length > 0) {
      try {
        await supabase.from('invoice_items').delete().eq('invoice_id', insertedRow.id);
        let { error: itemErr } = await supabase.from('invoice_items').insert(invoiceItemRows);
        if (itemErr && (itemErr.message.includes('foreign key') || itemErr.message.includes('fkey') || itemErr.code === '23503')) {
          console.warn('[Supabase saveInvoice] item_id foreign key failed, retrying with item_id null...');
          const safeRows = invoiceItemRows.map((r) => ({ ...r, id: generateUUID(), item_id: null }));
          await supabase.from('invoice_items').insert(safeRows);
        }
      } catch (itemEx) {
        console.warn('[Supabase saveInvoice] invoice_items write warning:', itemEx);
      }
    }

    return true;
  }

  public static async saveInvoices(invoices: Invoice[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || invoices.length === 0) return false;
    let allOk = true;
    for (const inv of invoices) {
      const ok = await SupabaseDataService.saveInvoice(inv, targetCompanyId);
      if (!ok) allOk = false;
    }
    return allOk;
  }

  /**
   * 3.2 IFRS VOID & INVERSION ENGINE (revertInvoicePosting)
   * Standalone accounting cancellation and journal inversion service.
   */
  public static async revertInvoicePosting(
    id: string,
    reason: string = 'إلغاء وعكس الفاتورة محاسبياً بدقة IFRS',
    targetCompanyId?: string
  ): Promise<{ success: boolean; error?: string; invoice?: Invoice; reversalJournal?: JournalEntry }> {
    if (!isSupabaseConfigured) return { success: false, error: 'قاعدة البيانات غير مهيأة' };
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return { success: false, error: 'الشركة النشطة غير محددة' };

    try {
      const invUuid = toValidUUID(id);

      // 1. Fetch target invoice from invoices table
      const { data: invRow, error: fetchErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${invUuid},invoice_number.eq.${id}`)
        .maybeSingle();

      if (fetchErr || !invRow) {
        return { success: false, error: 'تعذر العثور على الفاتورة في قاعدة البيانات' };
      }

      const raw = invRow.raw_data || {};
      const invoiceNumber = invRow.invoice_number || raw.invoiceNumber || id;
      const invoiceType = invRow.invoice_type || raw.type || 'SALES';
      const actualInvId = invRow.id || invUuid;

      // 2. Fetch invoice items
      const { data: itemRows } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', actualInvId);

      const lines = (itemRows && itemRows.length > 0)
        ? itemRows.map((it: any) => ({
            itemId: it.item_id || it.raw_data?.itemId || '',
            quantity: Number(it.quantity ?? 1),
            unitPrice: Number(it.unit_price ?? 0),
            total: Number(it.total_price ?? 0),
          }))
        : (raw.lines || []);

      // 3. Update Invoice Status to 'CANCELLED' in invoices table
      const cancellationDate = new Date().toISOString().split('T')[0];
      const updatedNotes = (invRow.notes || raw.notes ? (invRow.notes || raw.notes) + '\n' : '') +
        `[ملغاة وعكس القيود IFRS بتاريخ ${cancellationDate}: ${reason}]`;

      const updatedRaw = {
        ...raw,
        status: 'CANCELLED',
        notes: updatedNotes,
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
      };

      await supabase
        .from('invoices')
        .update({
          status: 'CANCELLED',
          notes: updatedNotes,
          raw_data: updatedRaw,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actualInvId)
        .eq('company_id', companyId);

      // 4. Reverse Accounting Journal Entries (IFRS compliant)
      let origJournal: any = null;
      try {
        const { data: jRows } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('company_id', companyId)
          .or(`source_id.eq.${actualInvId},reference.eq.${invoiceNumber}`);

        if (jRows && jRows.length > 0) {
          origJournal = jRows[0];
        }
      } catch (jErr) {
        console.warn('Journal lookup notice:', jErr);
      }

      let reversalJournalEntry: JournalEntry | undefined = undefined;

      if (origJournal) {
        const origLines = Array.isArray(origJournal.lines) ? origJournal.lines : (origJournal.raw_data?.lines || []);
        const reversedLines = origLines.map((l: any, idx: number) => ({
          id: `rev-line-${idx + 1}`,
          accountId: l.accountId || l.account_id || '',
          accountCode: l.accountCode || l.account_code || '',
          accountNameAr: l.accountNameAr || l.account_name_ar || l.account_name || 'حساب',
          debit: Number(l.credit || 0),
          credit: Number(l.debit || 0),
          memo: `عكس قيد فاتورة ملغاة (${invoiceNumber}): ${l.memo || ''}`,
        }));

        const revJournalUuid = generateUUID();
        const revEntryNumber = `REV-${origJournal.entry_number || origJournal.raw_data?.entryNumber || invoiceNumber}`;

        reversalJournalEntry = {
          id: revJournalUuid,
          companyId,
          entryNumber: revEntryNumber,
          date: cancellationDate,
          reference: invoiceNumber,
          description: `عكس وإلغاء قيد الفاتورة ${invoiceNumber} - السبب: ${reason}`,
          status: 'POSTED',
          lines: reversedLines,
          totalDebit: Number(origJournal.total_credit || origJournal.totalCredit || 0),
          totalCredit: Number(origJournal.total_debit || origJournal.totalDebit || 0),
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'INVOICE_REVERSAL',
          sourceId: actualInvId,
        };

        try {
          await supabase.from('journal_entries').upsert([{
            id: revJournalUuid,
            company_id: companyId,
            entry_number: revEntryNumber,
            date: cancellationDate,
            reference: invoiceNumber,
            description: reversalJournalEntry.description,
            status: 'POSTED',
            total_debit: reversalJournalEntry.totalDebit,
            total_credit: reversalJournalEntry.totalCredit,
            lines: reversedLines,
            raw_data: reversalJournalEntry,
            created_at: new Date().toISOString(),
          }]);
          // ضبط حالة القيد الأصلي إلى REVERSED
          if (origJournal.id) {
            await supabase.from('journal_entries').update({ status: 'REVERSED' }).eq('id', origJournal.id);
          }
        } catch (saveJErr: any) {
          console.warn('Supabase save reversal journal error:', saveJErr?.message);
        }
      } else {
        // Construct IFRS reversal entry using company_accounting_settings
        const mapping = await this.getCompanyAccountingSettings(companyId);
        const subtotal = Number(invRow.subtotal || raw.subtotal || 0);
        const taxAmount = Number(invRow.tax_amount || invRow.vat_amount || raw.vatTotal || 0);
        const totalAmount = Number(invRow.total_amount || raw.grandTotal || (subtotal + taxAmount));

        if (totalAmount > 0) {
          const revJournalUuid = generateUUID();
          const revEntryNumber = `REV-${invoiceNumber}`;
          const lines: any[] = [];

          if (subtotal > 0) {
            lines.push({
              id: 'rev-line-1',
              accountId: mapping?.salesAccountId || 'acc-sales',
              accountCode: '4100',
              accountNameAr: 'المبيعات - إيراد (عكس قيد)',
              debit: subtotal,
              credit: 0,
              memo: `عكس إيراد مبيعات فاتورة ملغاة ${invoiceNumber}`,
            });
          }
          if (taxAmount > 0) {
            lines.push({
              id: 'rev-line-2',
              accountId: mapping?.vatAccountId || 'acc-vat',
              accountCode: '2120',
              accountNameAr: 'ضريبة القيمة المضافة المحصلة (عكس قيد)',
              debit: taxAmount,
              credit: 0,
              memo: `عكس ضريبة فاتورة ملغاة ${invoiceNumber}`,
            });
          }
          const isCredit = (invRow.payment_method || raw.paymentTerms) === 'CREDIT';
          lines.push({
            id: 'rev-line-3',
            accountId: isCredit ? (mapping?.receivableAccountId || 'acc-receivable') : (mapping?.cashAccountId || 'acc-cash'),
            accountCode: isCredit ? '1120' : '1111',
            accountNameAr: isCredit ? 'العملاء - ذمم مدينة (عكس قيد)' : 'الصندوق / البنك (عكس قيد)',
            debit: 0,
            credit: totalAmount,
            memo: `عكس استحقاق فاتورة ملغاة ${invoiceNumber}`,
          });

          reversalJournalEntry = {
            id: revJournalUuid,
            companyId,
            entryNumber: revEntryNumber,
            date: cancellationDate,
            reference: invoiceNumber,
            description: `عكس قيد الفاتورة ${invoiceNumber} وفق معايير IFRS - ${reason}`,
            status: 'POSTED',
            lines,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            createdAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            isAutoGenerated: true,
            sourceModule: 'INVOICE_REVERSAL',
            sourceId: actualInvId,
          };

          try {
            await supabase.from('journal_entries').upsert([{
              id: revJournalUuid,
              company_id: companyId,
              entry_number: revEntryNumber,
              date: cancellationDate,
              reference: invoiceNumber,
              description: reversalJournalEntry.description,
              status: 'POSTED',
              total_debit: totalAmount,
              total_credit: totalAmount,
              lines,
              raw_data: reversalJournalEntry,
              created_at: new Date().toISOString(),
            }]);
          } catch (createJErr: any) {
            console.warn('Create reversal journal notice:', createJErr?.message);
          }
        }
      }

      // 5. Restore Inventory Stock in items table
      for (const line of lines) {
        if (!line.itemId || !line.quantity) continue;
        const qty = Number(line.quantity);
        try {
          const { data: itm } = await supabase
            .from('items')
            .select('id, current_balance, raw_data')
            .eq('company_id', companyId)
            .or(`id.eq.${toValidUUID(line.itemId)},sku.eq.${line.itemId}`)
            .maybeSingle();

          if (itm) {
            const curBal = Number(itm.current_balance ?? 0);
            const newBal = invoiceType === 'SALES' ? (curBal + qty) : Math.max(0, curBal - qty);
            const itmRaw = itm.raw_data || {};
            itmRaw.quantityOnHand = newBal;
            itmRaw.current_balance = newBal;

            await supabase
              .from('items')
              .update({
                current_balance: newBal,
                raw_data: itmRaw,
                updated_at: new Date().toISOString(),
              })
              .eq('id', itm.id)
              .eq('company_id', companyId);
          }
        } catch (stockErr: any) {
          console.warn('Stock restoration notice for item:', line.itemId, stockErr?.message);
        }
      }

      // 6. Recalculate Customer balance in customers table
      const customerId = invRow.customer_id || raw.entityId;
      if (customerId) {
        try {
          const custUuid = toValidUUID(customerId);
          const { data: custRow } = await supabase
            .from('customers')
            .select('id, balance, raw_data')
            .eq('company_id', companyId)
            .or(`id.eq.${custUuid},code.eq.${customerId}`)
            .maybeSingle();

          if (custRow) {
            const dueAmt = Number(invRow.due_amount ?? raw.dueAmount ?? invRow.total_amount ?? 0);
            const currentCustBal = Number(custRow.balance ?? 0);
            const newCustBal = currentCustBal - dueAmt;
            const custRaw = custRow.raw_data || {};
            custRaw.balance = newCustBal;

            await supabase
              .from('customers')
              .update({
                balance: newCustBal,
                raw_data: custRaw,
                updated_at: new Date().toISOString(),
              })
              .eq('id', custRow.id)
              .eq('company_id', companyId);
          }
        } catch (custErr: any) {
          console.warn('Customer balance recalculation notice:', custErr?.message);
        }
      }

      return {
        success: true,
        invoice: {
          ...raw,
          id: actualInvId,
          invoiceNumber,
          status: 'CANCELLED',
          notes: updatedNotes,
        },
        reversalJournal: reversalJournalEntry,
      };
    } catch (err: any) {
      console.warn('Supabase revertInvoicePosting exception:', err?.message);
      return { success: false, error: err?.message || 'فشلت عملية الإلغاء وعكس القيود' };
    }
  }

  public static async deleteInvoice(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const invUuid = toValidUUID(id);

      // 1. Fetch invoice row to identify invoice number and associated records
      const { data: invRow } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${invUuid},invoice_number.eq.${id}`)
        .maybeSingle();

      const targetInvId = invRow?.id || invUuid;
      const invoiceNumber = invRow?.invoice_number || id;

      // 2. HARD PURGE: Delete associated journal entries and their lines to leave NO orphaned records
      if (invoiceNumber || targetInvId) {
        try {
          const { data: linkedJournals } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('company_id', companyId)
            .or(`reference.eq.${invoiceNumber},reference_id.eq.${targetInvId}`);

          if (linkedJournals && linkedJournals.length > 0) {
            const jIds = linkedJournals.map((j) => j.id);
            await supabase.from('journal_entry_lines').delete().in('journal_entry_id', jIds);
            await supabase.from('journal_entries').delete().in('id', jIds);
          }
        } catch (jErr) {
          console.warn('Clean purge linked journals error:', jErr);
        }
      }

      // 3. HARD PURGE: Delete invoice line items
      try {
        await supabase
          .from('invoice_items')
          .delete()
          .or(`invoice_id.eq.${targetInvId},invoice_id.eq.${invUuid}`);
      } catch (itemErr) {
        console.warn('Clean purge invoice_items error:', itemErr);
      }

      // 4. HARD PURGE: Delete invoice master record
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${targetInvId},id.eq.${invUuid},invoice_number.eq.${invoiceNumber}`);

      // 5. Recalculate GL account balances immediately
      try {
        await this.recalculateAllAccountBalances(companyId);
      } catch (balErr) {
        console.warn('Recalculate balances after invoice delete note:', balErr);
      }

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteInvoice exception:', err?.message);
      return false;
    }
  }

  /**
   * 4.1 PAYMENT_VOUCHERS (سندات القبض والصرف)
   * Single Source of Truth: payment_vouchers table
   */
  public static async getVouchers(targetCompanyId?: string): Promise<PaymentVoucher[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      const { data, error } = await supabase
        .from('payment_vouchers')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase getVouchers error:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        return {
          ...raw,
          id: raw.id || row.id,
          companyId: row.company_id || companyId,
          voucherNumber: row.voucher_number || raw.voucherNumber || row.id,
          type: (row.type || raw.type || 'RECEIPT') as 'RECEIPT' | 'PAYMENT',
          date: row.date || raw.date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          amount: Number(row.amount ?? raw.amount ?? 0),
          paymentMethod: (row.payment_method || raw.paymentMethod || 'CASH') as 'BANK' | 'CASH',
          entityType: (row.entity_type || raw.entityType || 'CUSTOMER') as 'CUSTOMER' | 'SUPPLIER',
          entityId: row.entity_id || raw.entityId || '',
          entityNameAr: row.entity_name || raw.entityNameAr || raw.entityName || '',
          bankAccountId: raw.bankAccountId || row.account_id || '',
          reference: row.reference || raw.reference || '',
          notes: raw.notes || row.notes || row.description || '',
          status: (row.status || raw.status || 'POSTED') as 'POSTED' | 'CANCELLED',
          invoiceId: raw.invoiceId || row.invoice_id || undefined,
          journalEntryId: raw.journalEntryId || undefined,
          createdAt: raw.createdAt || row.created_at || new Date().toISOString(),
        };
      });
    } catch (err: any) {
      console.warn('Supabase getVouchers exception:', err?.message);
      return [];
    }
  }

  public static async saveVoucher(v: PaymentVoucher, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || (v as any).companyId || (v as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const voucherUuid = toValidUUID(v.id);
      const payload = {
        id: voucherUuid,
        company_id: companyId,
        voucher_number: v.voucherNumber || v.id,
        type: v.type || 'RECEIPT',
        date: v.date || new Date().toISOString().split('T')[0],
        amount: Number(v.amount || 0),
        payment_method: v.paymentMethod || 'CASH',
        entity_type: v.entityType || 'CUSTOMER',
        entity_id: v.entityId || null,
        entity_name: v.entityNameAr || (v as any).entityName || '',
        account_id: v.bankAccountId || (v as any).accountId || null,
        reference: v.reference || null,
        description: v.notes || (v as any).description || '',
        status: v.status || 'POSTED',
        raw_data: {
          ...v,
          id: v.id,
          companyId,
        },
        created_at: v.createdAt || new Date().toISOString(),
      };

      const { error } = await supabase
        .from('payment_vouchers')
        .upsert([payload]);

      if (error) {
        console.warn('Supabase saveVoucher error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveVoucher exception:', err?.message);
      return false;
    }
  }

  public static async saveVouchers(vouchers: PaymentVoucher[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || vouchers.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = vouchers.map((v) => ({
        id: toValidUUID(v.id),
        company_id: companyId,
        voucher_number: v.voucherNumber || v.id,
        type: v.type || 'RECEIPT',
        date: v.date || new Date().toISOString().split('T')[0],
        amount: Number(v.amount || 0),
        payment_method: v.paymentMethod || 'CASH',
        entity_type: v.entityType || 'CUSTOMER',
        entity_id: v.entityId || null,
        entity_name: v.entityNameAr || (v as any).entityName || '',
        account_id: v.bankAccountId || (v as any).accountId || null,
        reference: v.reference || null,
        description: v.notes || (v as any).description || '',
        status: v.status || 'POSTED',
        raw_data: {
          ...v,
          id: v.id,
          companyId,
        },
        created_at: v.createdAt || new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('payment_vouchers').upsert(batch);
        if (error) {
          console.warn('Supabase saveVouchers batch error:', error.message);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveVouchers exception:', err?.message);
      return false;
    }
  }

  public static async deleteVoucher(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const voucherUuid = toValidUUID(id);

      // 1. Fetch voucher details to locate voucher number
      const { data: vRow } = await supabase
        .from('payment_vouchers')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${voucherUuid},voucher_number.eq.${id}`)
        .maybeSingle();

      const voucherNumber = vRow?.voucher_number || id;
      const targetVId = vRow?.id || voucherUuid;

      // 2. HARD PURGE: Delete associated journal entries and lines
      if (voucherNumber || targetVId) {
        try {
          const { data: linkedJournals } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('company_id', companyId)
            .or(`reference.eq.${voucherNumber},reference_id.eq.${targetVId}`);

          if (linkedJournals && linkedJournals.length > 0) {
            const jIds = linkedJournals.map((j) => j.id);
            await supabase.from('journal_entry_lines').delete().in('journal_entry_id', jIds);
            await supabase.from('journal_entries').delete().in('id', jIds);
          }
        } catch (jErr) {
          console.warn('Clean purge voucher linked journals error:', jErr);
        }
      }

      // 3. HARD PURGE: Delete voucher record
      const { error } = await supabase
        .from('payment_vouchers')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${targetVId},id.eq.${voucherUuid},voucher_number.eq.${voucherNumber}`);

      // 4. Recalculate GL account balances immediately
      try {
        await this.recalculateAllAccountBalances(companyId);
      } catch (balErr) {
        console.warn('Recalculate balances after voucher delete note:', balErr);
      }

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteVoucher exception:', err?.message);
      return false;
    }
  }

  /**
   * 5. JOURNAL_ENTRIES (قيود اليومية المحاسبية)
   */
  public static async getJournals(targetCompanyId?: string): Promise<JournalEntry[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      let { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase getJournals error:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        const lines = row.lines || raw.lines || [];
        const totalDebit =
          Number(row.total_debit) ||
          Number(raw.totalDebit) ||
          lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
        const totalCredit =
          Number(row.total_credit) ||
          Number(raw.totalCredit) ||
          lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
        return {
          id: raw.id || row.id,
          companyId: row.company_id || companyId,
          entryNumber: row.entry_number,
          date: row.date || row.entry_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          reference: row.reference || row.reference_id || raw.reference || '',
          description: row.description || raw.description || '',
          status: row.status || raw.status || 'POSTED',
          lines,
          totalDebit: Math.round(totalDebit * 1000) / 1000,
          totalCredit: Math.round(totalCredit * 1000) / 1000,
          createdAt: row.created_at || raw.createdAt || new Date().toISOString(),
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getJournals exception:', err?.message);
      return [];
    }
  }

  public static async getJournal(id: string, targetCompanyId?: string): Promise<JournalEntry | null> {
    if (!isSupabaseConfigured || !id) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const entryUuid = toValidUUID(id);
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${entryUuid},entry_number.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const raw = data.raw_data || {};
      const lines = data.lines || raw.lines || [];
      const totalDebit =
        Number(data.total_debit) ||
        Number(raw.totalDebit) ||
        lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
      const totalCredit =
        Number(data.total_credit) ||
        Number(raw.totalCredit) ||
        lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
      return {
        id: raw.id || data.id || id,
        companyId: data.company_id || companyId,
        entryNumber: data.entry_number || raw.entryNumber,
        date:
          data.date ||
          data.entry_date ||
          (data.created_at ? data.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        reference: data.reference || data.reference_id || raw.reference || '',
        description: data.description || raw.description || '',
        status: data.status || raw.status || 'POSTED',
        lines,
        totalDebit: Math.round(totalDebit * 1000) / 1000,
        totalCredit: Math.round(totalCredit * 1000) / 1000,
        createdAt: data.created_at || raw.createdAt || new Date().toISOString(),
        ...raw,
      };
    } catch (err: any) {
      console.warn('Supabase getJournal exception:', err?.message);
      return null;
    }
  }

  public static async saveJournal(j: JournalEntry, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || j.companyId || (j as any).company_id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const entryId = toValidUUID(j.id);
      const { error } = await supabase
        .from('journal_entries')
        .upsert([
          {
            id: entryId,
            company_id: companyId,
            entry_number: j.entryNumber,
            date: j.date,
            description: j.description,
            status: j.status,
            reference: j.reference || null,
            reference_type: j.sourceModule || null,
            reference_id: j.reference || j.sourceId || null,
            total_debit: j.totalDebit,
            total_credit: j.totalCredit,
            lines: j.lines,
            raw_data: {
              ...j,
              id: j.id,
              companyId,
            },
            created_at: j.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn('Supabase saveJournal error:', error.message);
        return false;
      }

      // Sync lines to relational table journal_entry_lines for strict GL queries and SQL functions
      if (j.lines && Array.isArray(j.lines) && j.lines.length > 0) {
        try {
          await supabase
            .from('journal_entry_lines')
            .delete()
            .or(`journal_entry_id.eq.${entryId},journal_id.eq.${entryId}`);
          const lineRows = j.lines.map((l: any, idx: number) => ({
            id: toValidUUID(l.id || `${entryId}-${idx}`),
            company_id: companyId,
            journal_entry_id: entryId,
            journal_id: entryId,
            account_id: l.accountId ? toValidUUID(l.accountId) : null,
            account_code: l.accountCode || '',
            account_name: l.accountName || l.accountNameAr || '',
            account_name_ar: l.accountNameAr || l.accountName || '',
            description: l.description || j.description || '',
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            line_order: idx + 1,
            cost_center_id: l.costCenterId ? toValidUUID(l.costCenterId) : null,
            raw_data: l,
            created_at: new Date().toISOString(),
          }));
          await supabase.from('journal_entry_lines').insert(lineRows);
        } catch (lEx) {
          console.warn('Supabase saveJournal journal_entry_lines sync notice:', lEx);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveJournal exception:', err?.message);
      return false;
    }
  }

  public static async saveJournals(journals: JournalEntry[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || journals.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = journals.map((j) => ({
        id: toValidUUID(j.id),
        company_id: companyId,
        entry_number: j.entryNumber,
        date: j.date,
        description: j.description,
        status: j.status,
        reference: j.reference || null,
        reference_type: j.sourceModule || null,
        reference_id: j.reference || j.sourceId || null,
        total_debit: j.totalDebit,
        total_credit: j.totalCredit,
        lines: j.lines,
        raw_data: {
          ...j,
          id: j.id,
          companyId,
        },
        created_at: j.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('journal_entries').upsert(batch);
        if (error) {
          console.warn('Supabase saveJournals batch error:', error.message);
        }
      }

      // Sync lines for all journals to journal_entry_lines in batches
      const allLines: any[] = [];
      journals.forEach((j) => {
        const jId = toValidUUID(j.id);
        if (j.lines && Array.isArray(j.lines)) {
          j.lines.forEach((l: any, idx: number) => {
            allLines.push({
              id: toValidUUID(l.id || `${jId}-${idx}`),
              company_id: companyId,
              journal_entry_id: jId,
              journal_id: jId,
              account_id: l.accountId ? toValidUUID(l.accountId) : null,
              account_code: l.accountCode || '',
              account_name: l.accountName || l.accountNameAr || '',
              account_name_ar: l.accountNameAr || l.accountName || '',
              description: l.description || j.description || '',
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
              line_order: idx + 1,
              cost_center_id: l.costCenterId ? toValidUUID(l.costCenterId) : null,
              raw_data: l,
              created_at: new Date().toISOString(),
            });
          });
        }
      });

      if (allLines.length > 0) {
        for (let i = 0; i < allLines.length; i += 100) {
          const lBatch = allLines.slice(i, i + 100);
          try {
            await supabase.from('journal_entry_lines').upsert(lBatch);
          } catch (lEx) {
            console.warn('Supabase batch journal_entry_lines sync notice:', lEx);
          }
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveJournals exception:', err?.message);
      return false;
    }
  }

  public static async deleteJournal(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const entryId = toValidUUID(id);

      // 1. Fetch journal row to get id & entry_number
      const { data: jRow } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${entryId},entry_number.eq.${id}`)
        .maybeSingle();

      const targetJId = jRow?.id || entryId;
      const entryNumber = jRow?.entry_number || id;

      // 2. HARD PURGE: Delete all lines from journal_entry_lines
      try {
        await supabase
          .from('journal_entry_lines')
          .delete()
          .or(`journal_entry_id.eq.${targetJId},journal_entry_id.eq.${entryId}`);
      } catch (lErr) {
        console.warn('Clean purge journal lines error:', lErr);
      }

      // 3. HARD PURGE: Delete journal entry master record
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${targetJId},id.eq.${entryId},entry_number.eq.${entryNumber}`);

      // 4. Recalculate GL account balances immediately
      try {
        await this.recalculateAllAccountBalances(companyId);
      } catch (balErr) {
        console.warn('Recalculate balances after journal delete note:', balErr);
      }

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteJournal exception:', err?.message);
      return false;
    }
  }

  public static async getAccounts(targetCompanyId?: string): Promise<Account[] | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('code', { ascending: true });

      if (error || !data || data.length === 0) return null;

      const codeMap = new Map<string, Account>();
      for (const row of data) {
        const code = String(row.code || row.id || '').trim();
        if (!code) continue;
        const mapped: Account = {
          id: row.id,
          code: row.code,
          nameAr: row.name_ar,
          nameEn: row.name_en || '',
          category: row.category,
          normalBalance: row.normal_balance || 'DEBIT',
          level: Number(row.level) || 1,
          type: row.type || 'DETAIL',
          parentId: row.parent_id || null,
          isSystem: !!row.is_system,
          isActive: row.is_active ?? true,
          balance: Number(row.balance) || 0,
          description: row.description || '',
        };

        if (!codeMap.has(code)) {
          codeMap.set(code, mapped);
        } else {
          const existing = codeMap.get(code)!;
          const bestBal = Math.abs(mapped.balance) > Math.abs(existing.balance) ? mapped.balance : existing.balance;
          const preferredId = existing.id.startsWith('acc-') ? existing.id : (mapped.id.startsWith('acc-') ? mapped.id : existing.id);
          codeMap.set(code, { ...existing, id: preferredId, balance: bestBal });
        }
      }

      return Array.from(codeMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    } catch (e) {
      return null;
    }
  }

  public static async saveAccounts(accounts: Account[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || accounts.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      // Deduplicate accounts before sending to Supabase
      const dedupedMap = new Map<string, Account>();
      for (const acc of accounts) {
        const code = String(acc.code || acc.id || '').trim();
        if (!code) continue;
        if (!dedupedMap.has(code)) {
          dedupedMap.set(code, acc);
        } else {
          const existing = dedupedMap.get(code)!;
          const bestBal = Math.abs(acc.balance || 0) > Math.abs(existing.balance || 0) ? acc.balance : existing.balance;
          const preferredId = existing.id.startsWith('acc-') ? existing.id : (acc.id.startsWith('acc-') ? acc.id : existing.id);
          dedupedMap.set(code, { ...existing, id: preferredId, balance: bestBal });
        }
      }

      const payload = Array.from(dedupedMap.values()).map((acc) => ({
        id: acc.id,
        company_id: companyId,
        code: acc.code,
        name_ar: acc.nameAr,
        name_en: acc.nameEn || '',
        category: acc.category,
        normal_balance: acc.normalBalance,
        level: acc.level,
        type: acc.type || 'DETAIL',
        parent_id: acc.parentId || null,
        is_system: !!acc.isSystem,
        is_active: acc.isActive ?? true,
        balance: acc.balance || 0,
        current_balance: acc.balance || 0,
        description: acc.description || '',
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < payload.length; i += 50) {
        const batch = payload.slice(i, i + 50);
        const { error } = await supabase.from('chart_of_accounts').upsert(batch);
        if (error) {
          console.warn('Supabase saveAccounts batch error:', error.message);
        }
      }
      return true;
    } catch (e) {
      console.warn('Supabase saveAccounts exception:', e);
      return false;
    }
  }

  public static async deleteAccount(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${id},code.eq.${id}`);
      return !error;
    } catch (e) {
      console.warn('Supabase deleteAccount exception:', e);
      return false;
    }
  }

  public static async recalculateAllAccountBalances(targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      // 1. Fetch all accounts
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code, opening_balance')
        .eq('company_id', companyId);

      if (!accounts || accounts.length === 0) return true;

      // 2. Fetch journal entries to aggregate balances
      const { data: journals } = await supabase
        .from('journal_entries')
        .select('id, lines')
        .eq('company_id', companyId);

      const netBalances: Record<string, number> = {};
      accounts.forEach((acc) => {
        netBalances[acc.id] = Number(acc.opening_balance || 0);
        if (acc.code) {
          netBalances[acc.code] = Number(acc.opening_balance || 0);
        }
      });

      if (journals && journals.length > 0) {
        journals.forEach((j: any) => {
          const lines = Array.isArray(j.lines) ? j.lines : [];
          lines.forEach((l: any) => {
            const accKey = l.accountId || l.account_id || l.accountCode || l.account_code;
            if (accKey) {
              const debit = Number(l.debit || 0);
              const credit = Number(l.credit || 0);
              const delta = debit - credit;
              netBalances[accKey] = (netBalances[accKey] || 0) + delta;
            }
          });
        });
      }

      // 3. Batch update accounts
      for (const acc of accounts) {
        const bal = netBalances[acc.id] ?? netBalances[acc.code] ?? 0;
        await supabase
          .from('chart_of_accounts')
          .update({
            balance: bal,
            current_balance: bal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', acc.id);
      }

      return true;
    } catch (e) {
      console.warn('Supabase recalculateAllAccountBalances exception:', e);
      return false;
    }
  }

  public static async getWarehouses(targetCompanyId?: string): Promise<Warehouse[] | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error || !data) return null;
      return data.map((r: any) => ({
        id: r.id,
        code: r.code,
        nameAr: r.name_ar,
        nameEn: r.name_en || '',
        location: r.location || '',
        keeperName: r.keeper_name || '',
        phone: r.phone || '',
        isDefault: !!r.is_default,
        isActive: r.is_active ?? true,
      }));
    } catch {
      return null;
    }
  }

  public static async saveWarehouses(warehouses: Warehouse[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || warehouses.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const payload = warehouses.map((w) => ({
        id: w.id,
        company_id: companyId,
        code: w.code,
        name_ar: w.nameAr,
        name_en: w.nameEn || '',
        location: w.location || '',
        keeper_name: w.keeperName || '',
        phone: w.phone || '',
        is_default: !!w.isDefault,
        is_active: w.isActive ?? true,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('warehouses').upsert(payload);
      return !error;
    } catch {
      return false;
    }
  }

  public static async getSalesReps(targetCompanyId?: string): Promise<SalesRep[] | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error || !data) return null;
      return data.map((r: any) => {
        let extra: any = {};
        let notesText = r.notes || '';
        if (typeof notesText === 'string' && notesText.trim().startsWith('{')) {
          try {
            extra = JSON.parse(notesText);
            notesText = extra.text || '';
          } catch {}
        }
        return {
          id: r.id,
          code: r.code,
          nameAr: r.name_ar,
          nameEn: r.name_en || '',
          phone: r.phone || '',
          email: r.email || '',
          commissionRate: Number(r.commission_rate) || 0,
          targetAmount: Number(r.target_amount) || 0,
          isActive: r.is_active ?? true,
          notes: notesText,
          vanWarehouseId: extra.vanWarehouseId || r.van_warehouse_id,
          vanWarehouseName: extra.vanWarehouseName || r.van_warehouse_name,
          vehicleNumber: extra.vehicleNumber || r.vehicle_number,
          custodyBalance: extra.custodyBalance !== undefined ? Number(extra.custodyBalance) : 0,
        };
      });
    } catch {
      return null;
    }
  }

  public static async saveSalesReps(reps: SalesRep[], targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured || reps.length === 0) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const payload = reps.map((r) => ({
        id: r.id,
        company_id: companyId,
        code: r.code,
        name_ar: r.nameAr,
        name_en: r.nameEn || '',
        phone: r.phone || '',
        email: r.email || '',
        commission_rate: r.commissionRate || 0,
        target_amount: r.targetAmount || 0,
        is_active: r.isActive ?? true,
        notes: JSON.stringify({
          text: r.notes || '',
          vanWarehouseId: r.vanWarehouseId || '',
          vanWarehouseName: r.vanWarehouseName || '',
          vehicleNumber: r.vehicleNumber || '',
          custodyBalance: r.custodyBalance || 0,
        }),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('sales_reps').upsert(payload);
      return !error;
    } catch {
      return false;
    }
  }

  public static async deleteSalesRep(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase.from('sales_reps').delete().eq('id', id).eq('company_id', companyId);
      return !error;
    } catch {
      return false;
    }
  }

  public static async deleteWarehouse(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase.from('warehouses').delete().eq('id', id).eq('company_id', companyId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Triggers the remote PostgreSQL ledger synchronization RPC for all vouchers.
   */
  public static async syncAllVouchersToLedgerRemote(targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    try {
      const { error } = await supabase.rpc('sync_all_vouchers_to_ledger', {
        p_target_company_id: companyId || null,
      });
      if (error) {
        // Safe fallback if RPC not yet created in PostgreSQL
        return false;
      }
      return true;
    } catch (err: any) {
      return false;
    }
  }

  /**
   * Universal Multi-Industry Manufacturing Production Orders
   * Strict Multi-Tenant isolation: .eq('company_id', companyId)
   */
  public static async getProductionOrders(targetCompanyId?: string): Promise<ProductionOrder[] | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase getProductionOrders error (fallback to local):', error.message);
        return null;
      }

      if (!data || data.length === 0) return null;

      return data.map((row: any) => ({
        id: row.id,
        orderNumber: row.order_number || row.orderNumber,
        date: row.date,
        targetItemId: row.target_item_id || row.targetItemId,
        targetItemNameAr: row.target_item_name_ar || row.targetItemNameAr,
        targetSku: row.target_sku || row.targetSku || '',
        targetQuantity: Number(row.target_quantity ?? row.targetQuantity) || 1,
        targetUnit: row.target_unit || row.targetUnit || 'حبة',
        rawMaterials: row.raw_materials || row.rawMaterials || [],
        overheadCost: Number(row.overhead_cost ?? row.overheadCost) || 0,
        totalProductionCost: Number(row.total_production_cost ?? row.totalProductionCost) || 0,
        unitProductionCost: Number(row.unit_production_cost ?? row.unitProductionCost) || 0,
        status: row.status || 'COMPLETED',
        notes: row.notes || '',
        millLine: row.production_line_name_ar || row.mill_line || row.millLine || 'خط الإنتاج الرئيسي',
        productionLineId: row.production_line_id || row.productionLineId,
        productionLineNameAr: row.production_line_name_ar || row.productionLineNameAr || row.mill_line,
        industryType: row.industry_type || row.industryType || 'GENERAL_ASSEMBLY',
        categoryGroup: row.category_group || row.categoryGroup,
        operatorName: row.operator_name || row.operatorName || 'مشرف التشغيل',
        journalEntryId: row.journal_entry_id || row.journalEntryId,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        completedAt: row.completed_at || row.completedAt,
        scrapQuantity: Number(row.scrap_quantity ?? row.scrapQuantity) || 0,
        scrapPercentage: Number(row.scrap_percentage ?? row.scrapPercentage) || 0,
        scrapReason: row.scrap_reason || row.scrapReason,
        byProducts: row.by_products || row.byProducts || [],
        qualityInspection: row.quality_inspection || row.qualityInspection,
        routingSteps: row.routing_steps || row.routingSteps || [],
      }));
    } catch (e) {
      console.warn('Supabase getProductionOrders exception:', e);
      return null;
    }
  }

  public static async saveProductionOrder(order: ProductionOrder, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const payload = {
        id: order.id,
        company_id: companyId,
        order_number: order.orderNumber,
        date: order.date,
        target_item_id: order.targetItemId,
        target_item_name_ar: order.targetItemNameAr,
        target_sku: order.targetSku || '',
        target_quantity: Number(order.targetQuantity) || 1,
        target_unit: order.targetUnit || 'حبة',
        raw_materials: order.rawMaterials || [],
        overhead_cost: Number(order.overheadCost) || 0,
        total_production_cost: Number(order.totalProductionCost) || 0,
        unit_production_cost: Number(order.unitProductionCost) || 0,
        status: order.status || 'COMPLETED',
        notes: order.notes || '',
        mill_line: order.productionLineNameAr || order.millLine || 'خط الإنتاج الرئيسي',
        production_line_id: order.productionLineId || null,
        production_line_name_ar: order.productionLineNameAr || order.millLine || 'خط الإنتاج الرئيسي',
        industry_type: order.industryType || 'GENERAL_ASSEMBLY',
        category_group: order.categoryGroup || null,
        operator_name: order.operatorName || 'مشرف التشغيل',
        journal_entry_id: order.journalEntryId || null,
        scrap_quantity: Number(order.scrapQuantity) || 0,
        scrap_percentage: Number(order.scrapPercentage) || 0,
        scrap_reason: order.scrapReason || null,
        by_products: order.byProducts || [],
        quality_inspection: order.qualityInspection || null,
        routing_steps: order.routingSteps || [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('production_orders').upsert([payload]);
      if (error) {
        console.warn('Supabase saveProductionOrder error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase saveProductionOrder exception:', e);
      return false;
    }
  }

  /**
   * Manufacturing Settings (Standardized Categories, Lines, and Workstations per Tenant)
   */
  public static async getManufacturingSettings(targetCompanyId?: string): Promise<ManufacturingStandardSettings | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('manufacturing_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        industryType: data.industry_type || 'GENERAL_ASSEMBLY',
        standardCategories: data.standard_categories || [],
        standardLines: data.standard_lines || [],
        standardWorkstations: data.standard_workstations || [],
      };
    } catch (e) {
      return null;
    }
  }

  public static async saveManufacturingSettings(
    settings: ManufacturingStandardSettings,
    targetCompanyId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase.from('manufacturing_settings').upsert([
        {
          company_id: companyId,
          industry_type: settings.industryType,
          standard_categories: settings.standardCategories,
          standard_lines: settings.standardLines,
          standard_workstations: settings.standardWorkstations,
          updated_at: new Date().toISOString(),
        },
      ]);
      return !error;
    } catch (e) {
      return false;
    }
  }

  public static async resetTenantData(targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;

    try {
      await supabase.from('invoice_items').delete().eq('company_id', companyId);
      await supabase.from('invoices').delete().eq('company_id', companyId);
      await supabase.from('payment_vouchers').delete().eq('company_id', companyId);
      await supabase.from('journal_entries').delete().eq('company_id', companyId);
      await supabase.from('items').delete().eq('company_id', companyId);
      await supabase.from('customers').delete().eq('company_id', companyId);
      await supabase.from('suppliers').delete().eq('company_id', companyId);
      await supabase.from('production_orders').delete().eq('company_id', companyId);
      return true;
    } catch (e) {
      console.warn('Failed to reset tenant data:', e);
      return false;
    }
  }
}
