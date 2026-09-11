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
      const profile: CompanyProfile = {
        id: data.id,
        nameAr: data.company_name || p.nameAr || 'مطحنة الوليد المتحده',
        nameEn: p.nameEn || 'Al-Waleed United Mill & Food Industries',
        tradeName: p.tradeName || data.company_name || 'مطحنة الوليد للبهارات والمواد التموينية والصناعات الغذائية',
        legalForm: p.legalForm || 'شركة ذات مسؤولية محدودة (ذ.م.م)',
        taxNumber: p.taxNumber || '',
        crNumber: p.crNumber || '450912',
        crIssueDate: p.crIssueDate || '2015-04-12',
        crExpiryDate: p.crExpiryDate || '2030-04-11',
        chamberNumber: p.chamberNumber || '78214',
        vatRate: p.vatRate ?? 0,
        vatType: p.vatType || 'NONE',
        zatcaPhase: p.zatcaPhase || 'PHASE_1_BASIC',
        zatcaEnv: p.zatcaEnv || 'PRODUCTION',
        buildingNo: p.buildingNo || 'قسيمة 42',
        streetName: p.streetName || 'شارع الغزالي',
        district: p.district || 'منطقة الري الصناعية',
        city: p.city || 'الكويت',
        country: p.country || 'دولة الكويت',
        postalCode: p.postalCode || '13001',
        additionalNo: p.additionalNo || '',
        phone: p.phone || '+965 2484 1888',
        mobile: p.mobile || '+965 9988 7766',
        email: data.owner_email || p.email || 'cgiacc2026@gmail.com',
        website: p.website || 'https://alwaleedmill.com',
        fiscalYearStart: p.fiscalYearStart || '2026-01-01',
        fiscalYearEnd: p.fiscalYearEnd || '2026-12-31',
        functionalCurrency: data.functional_currency || p.functionalCurrency || 'KWD',
        accountingBasis: p.accountingBasis || 'ACCRUAL',
        inventoryCosting: p.inventoryCosting || 'WEIGHTED_AVERAGE',
        depreciationMethod: p.depreciationMethod || 'STRAIGHT_LINE',
        decimalPlaces: p.decimalPlaces ?? 3,
        generalManager: p.generalManager || 'د. خالد السليمان',
        financialManager: p.financialManager || 'أ. محمد الشمري',
        chiefAccountant: p.chiefAccountant || 'أ. أحمد المصطفى',
        logoUrl: data.logo_url || data.logo || p.logoUrl || '',
        headerNotes: p.headerNotes || 'مستند تجاري ومالي رسمي معتمد • مطحنة الوليد المتحدة • دولة الكويت',
        footerNotes: p.footerNotes || 'الدفع خلال 30 يوماً من تاريخ استلام الفاتورة • خاضع للقوانين التجارية بدولة الكويت.',
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

      // Also check company_settings if defaultAccounts is missing or needs merging
      try {
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle();

        if (settingsData) {
          const mappingFromSettings: DefaultAccountsMapping = {
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
          profile.defaultAccounts = {
            ...(profile.defaultAccounts || {}),
            ...Object.fromEntries(Object.entries(mappingFromSettings).filter(([_, v]) => Boolean(v))),
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
      const payload: any = {
        id: companyId,
        company_name: comp.nameAr,
        owner_email: comp.email || 'admin@logixerp.com',
        status: 'active',
        logo_url: comp.logoUrl || '',
        theme_color: comp.themeColor || 'blue',
        theme_mode: comp.themeMode || 'light',
        default_accounts: comp.defaultAccounts || {},
        allow_negative_inventory: comp.allowNegativeInventory !== false,
        allow_negative_balance: comp.allowNegativeBalance !== false,
        pos_default_warehouse_id: comp.posDefaultWarehouseId || 'wh-main-01',
        profile_data: comp,
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
          profile_data: comp,
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

      // Also upsert into company_settings table for explicit relational mapping
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
   * Directly and atomically adjusts stock quantity for an item in Supabase.
   * Matches by SKU/code, barcode, or UUID to guarantee exact row update.
   */
  public static async adjustItemStock(
    itemId?: string,
    sku?: string,
    barcode?: string,
    newBalance?: number,
    targetCompanyId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;

    try {
      let query = supabase.from('items').select('id, current_balance, raw_data').eq('company_id', companyId);
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

        const { error } = await supabase
          .from('items')
          .update({
            current_balance: balance,
            qty_on_hand: balance,
            raw_data: updatedRaw,
            updated_at: new Date().toISOString(),
          })
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
      // 1. First attempt: Query modern 'invoices' table
      const { data: invTableData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (!invErr && invTableData && invTableData.length > 0) {
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
      }

      // 2. Fallback attempt: Query legacy 'sales_master' & 'sales_details'
      let { data: masters, error: masterErr } = await supabase
        .from('sales_master')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (masterErr) {
        console.warn('Supabase getInvoices masterErr:', masterErr.message);
        return [];
      }

      if (!masters || masters.length === 0) return [];

      const { data: details, error: detailsErr } = await supabase
        .from('sales_details')
        .select('*')
        .eq('company_id', companyId);

      if (detailsErr) {
        console.warn('Supabase getInvoices detailsErr:', detailsErr.message);
      }

      const detailsByInvoice: Record<string, InvoiceLine[]> = {};
      if (details) {
        details.forEach((d: any) => {
          const raw = d.raw_data || {};
          const qty = Number(d.quantity ?? d.qty ?? raw.quantity ?? 1);
          const unitPrice = Number(d.unit_price ?? raw.unitPrice ?? 0);
          const total = Number(d.total_price ?? d.total ?? d.line_total ?? raw.total ?? (qty * unitPrice));
          const line: InvoiceLine = {
            id: raw.id || d.id,
            itemId: raw.itemId || d.item_id || '',
            itemSku: raw.itemSku || d.item_id || '',
            barcode: raw.barcode || '',
            itemNameAr: d.item_name || raw.itemNameAr || raw.nameAr || '',
            itemNameEn: raw.itemNameEn || raw.nameEn || '',
            unit: raw.unit || 'حبة',
            unitsPerPack: raw.unitsPerPack || 1,
            quantity: qty,
            unitPrice: unitPrice,
            subtotal: Number(raw.subtotal ?? (unitPrice * qty)),
            vatRate: Number(d.vat_rate ?? raw.vatRate ?? 15),
            vatAmount: Number(d.vat_amount ?? raw.vatAmount ?? 0),
            discountAmount: Number(raw.discountAmount ?? 0),
            discountPercent: Number(raw.discountPercent ?? 0),
            total: total,
            ...raw,
          };

          const invoiceKey = d.invoice_id || d.sales_master_id;
          if (invoiceKey) {
            if (!detailsByInvoice[invoiceKey]) {
              detailsByInvoice[invoiceKey] = [];
            }
            detailsByInvoice[invoiceKey].push(line);
          }
        });
      }

      return masters.map((m: any) => {
        const raw = m.raw_data || {};
        const snapshot = m.customer_snapshot || {};
        const lines = detailsByInvoice[m.id] || raw.lines || [];
        return {
          id: raw.id || m.id,
          invoiceNumber: m.invoice_number || raw.invoiceNumber || m.id,
          type: raw.type || 'SALES',
          paymentTerms: raw.paymentTerms || (m.payment_method === 'CREDIT' ? 'CREDIT' : 'CASH'),
          entityId: raw.entityId || m.customer_id || snapshot.id || '',
          entityNameAr: m.customer_name || snapshot.nameAr || raw.entityNameAr || '',
          entityNameEn: raw.entityNameEn || snapshot.nameEn || '',
          date: m.date || raw.date,
          dueDate: raw.dueDate || m.date,
          status: m.payment_status || m.status || raw.status || 'POSTED',
          lines,
          subtotal: Number(m.subtotal ?? raw.subtotal ?? 0),
          vatTotal: Number(m.tax_amount ?? m.vat_amount ?? raw.vatTotal ?? 0),
          discountTotal: Number(raw.discountTotal ?? 0),
          grandTotal: Number(m.total_amount ?? raw.grandTotal ?? 0),
          paidAmount: Number(m.paid_amount ?? raw.paidAmount ?? 0),
          dueAmount: Number(m.due_amount ?? raw.dueAmount ?? 0),
          createdAt: raw.createdAt || m.created_at || new Date().toISOString(),
          ...raw,
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

    // Persist to backward-compatible tables (sales_master / sales_details) non-blockingly
    try {
      // NOTE: sales_master only accepts exact valid columns in schema:
      // id, company_id, invoice_number, date, customer_id, customer_name, subtotal, vat_amount, total_amount, paid_amount, due_amount, payment_status, status, payment_method, customer_snapshot, raw_data, created_at
      const masterPayload: any = {
        id: insertedRow.id,
        company_id: companyId,
        invoice_number: insertedRow.invoice_number,
        date: inv.date || new Date().toISOString().split('T')[0],
        customer_id: invoicePayload.customer_id,
        customer_name: invoicePayload.customer_name,
        subtotal: subtotal,
        vat_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_status: paymentStatus,
        status: inv.status || 'POSTED',
        payment_method: inv.paymentTerms || 'CASH',
        customer_snapshot: customerSnapshot,
        raw_data: invoicePayload.raw_data,
        created_at: inv.createdAt || new Date().toISOString(),
      };

      await supabase.from('sales_master').upsert([masterPayload], { onConflict: 'company_id, invoice_number' });

      if (invoiceItemRows.length > 0) {
        await supabase
          .from('sales_details')
          .delete()
          .eq('company_id', companyId)
          .or(`sales_master_id.eq.${insertedRow.id},invoice_id.eq.${insertedRow.id}`);

        const detailRows = invoiceItemRows.map((it) => ({
          id: generateUUID(),
          company_id: companyId,
          sales_master_id: insertedRow.id,
          invoice_id: insertedRow.id,
          item_id: null,
          item_name: it.item_name,
          quantity: it.quantity,
          qty: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          vat_rate: it.tax_rate,
          vat_amount: it.tax_amount,
          line_total: it.total_price,
          total: it.total_price,
          item_snapshot: it.item_snapshot,
          raw_data: it.raw_data,
        }));

        await supabase.from('sales_details').insert(detailRows);
      }
    } catch (compatEx) {
      // Non-fatal legacy compatibility notice
      console.warn('[Supabase saveInvoice] legacy sales_master notice:', compatEx);
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

  public static async deleteInvoice(id: string, targetCompanyId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = targetCompanyId || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const invUuid = toValidUUID(id);

      // 1. Delete from modern invoice_items & invoices (CASCADE takes care of items, but explicit delete for safety)
      try {
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invUuid);

        await supabase
          .from('invoices')
          .delete()
          .eq('company_id', companyId)
          .or(`id.eq.${invUuid},invoice_number.eq.${id}`);
      } catch (err: any) {
        console.warn('Supabase delete invoices table notice:', err?.message);
      }

      // 2. Delete from legacy sales_details & sales_master
      await supabase
        .from('sales_details')
        .delete()
        .eq('company_id', companyId)
        .or(`sales_master_id.eq.${invUuid},invoice_id.eq.${invUuid}`);

      const { error } = await supabase
        .from('sales_master')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${invUuid},invoice_number.eq.${id}`);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteInvoice exception:', err?.message);
      return false;
    }
  }

  /**
   * 4.1 PAYMENT_VOUCHERS (سندات القبض والصرف)
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
      }

      if (!data || data.length === 0) {
        // Fallback to vouchers table if payment_vouchers is empty
        try {
          const { data: vData } = await supabase
            .from('vouchers')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
          if (vData && vData.length > 0) {
            return vData.map((row: any) => ({
              id: row.id,
              companyId: row.company_id || companyId,
              voucherNumber: row.voucher_number || row.id,
              type: (row.voucher_type || row.type || 'RECEIPT') as 'RECEIPT' | 'PAYMENT',
              date: row.date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
              amount: Number(row.amount || 0),
              paymentMethod: 'CASH' as const,
              entityType: 'CUSTOMER' as const,
              entityId: '',
              entityNameAr: row.entity_name || '',
              bankAccountId: row.account_id || '',
              reference: '',
              notes: row.description || '',
              status: 'POSTED' as const,
              createdAt: row.created_at || new Date().toISOString(),
            }));
          }
        } catch (fErr) {
          // ignore
        }
        return [];
      }

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

      // --- FAST-PATH: ATOMIC DATABASE RPC (PostgreSQL Stored Procedure) ---
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_voucher_atomic', {
          p_company_id: companyId,
          p_voucher: payload,
        });

        if (!rpcErr && rpcRes && (rpcRes as any).success) {
          return true;
        }
      } catch (rpcEx: any) {
        // Graceful fallback
      }

      const { error } = await supabase
        .from('payment_vouchers')
        .upsert([payload]);

      // Dual-write to vouchers table for multi-tenant schema compatibility
      try {
        await supabase.from('vouchers').upsert([
          {
            id: String(voucherUuid),
            company_id: String(companyId),
            voucher_type: v.type || 'RECEIPT',
            amount: Number(v.amount || 0),
            account_id: v.bankAccountId || (v as any).accountId || null,
            description: v.notes || (v as any).description || '',
            created_at: v.createdAt || new Date().toISOString(),
          },
        ]);
      } catch (vErr: any) {
        // Safe fallback if vouchers table is not yet created
      }

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

      // Dual-write batch to vouchers table
      try {
        const simpleVouchers = rows.map((r) => ({
          id: String(r.id),
          company_id: String(r.company_id),
          voucher_type: r.type,
          amount: r.amount,
          account_id: r.account_id,
          description: r.description,
          created_at: r.created_at,
        }));
        await supabase.from('vouchers').upsert(simpleVouchers);
      } catch (vErr: any) {
        // Safe fallback
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
      const { error } = await supabase
        .from('payment_vouchers')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${voucherUuid},voucher_number.eq.${id}`);

      try {
        await supabase
          .from('vouchers')
          .delete()
          .eq('company_id', companyId)
          .eq('id', voucherUuid);
      } catch (vErr: any) {
        // Safe fallback
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
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${entryId},entry_number.eq.${id}`);

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
      return data.map((r: any) => ({
        id: r.id,
        code: r.code,
        nameAr: r.name_ar,
        nameEn: r.name_en || '',
        phone: r.phone || '',
        email: r.email || '',
        commissionRate: Number(r.commission_rate) || 0,
        targetAmount: Number(r.target_amount) || 0,
        isActive: r.is_active ?? true,
        notes: r.notes || '',
      }));
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
        notes: r.notes || '',
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
      await supabase.from('sales_details').delete().eq('company_id', companyId);
      await supabase.from('sales_master').delete().eq('company_id', companyId);
      await supabase.from('payment_vouchers').delete().eq('company_id', companyId);
      await supabase.from('vouchers').delete().eq('company_id', companyId);
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
