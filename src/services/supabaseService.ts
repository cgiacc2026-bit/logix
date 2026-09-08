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
} from './supabaseClient.js';

export {
  supabase,
  getCurrentCompanyId,
  isSupabaseConfigured,
  resolveToSupabaseCompanyUUID,
  ALWALEED_CANONICAL_UUID,
  toValidUUID,
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
} from '../types.js';

export class SupabaseDataService {
  /**
   * 1. COMPANIES (Fetch and Update active company profile)
   */
  public static async getCompany(): Promise<CompanyProfile | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = getCurrentCompanyId();
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

      const profile: CompanyProfile = {
        id: data.id,
        nameAr: data.company_name || data.profile_data?.nameAr || 'مجموعة لوجيكس لإدارة الموارد السحابية',
        nameEn: data.profile_data?.nameEn || 'LOGIX Cloud ERP Enterprise',
        tradeName: data.profile_data?.tradeName || data.company_name,
        legalForm: data.profile_data?.legalForm || 'شركة مساهمة مقفلة (ش.م.ك)',
        taxNumber: data.profile_data?.taxNumber || '300012345600003',
        crNumber: data.profile_data?.crNumber || '1010998877',
        crIssueDate: data.profile_data?.crIssueDate || '2020-01-01',
        crExpiryDate: data.profile_data?.crExpiryDate || '2030-01-01',
        chamberNumber: data.profile_data?.chamberNumber || '889900',
        vatRate: data.profile_data?.vatRate ?? 15,
        vatType: data.profile_data?.vatType || 'QUARTERLY',
        zatcaPhase: data.profile_data?.zatcaPhase || 'PHASE_2_INTEGRATED',
        zatcaEnv: data.profile_data?.zatcaEnv || 'PRODUCTION',
        buildingNo: data.profile_data?.buildingNo || 'برج لوجيكس للأعمال',
        streetName: data.profile_data?.streetName || 'طريق الملك فهد',
        district: data.profile_data?.district || 'حي العليا',
        city: data.profile_data?.city || 'الرياض',
        country: data.profile_data?.country || 'المملكة العربية السعودية',
        postalCode: data.profile_data?.postalCode || '11564',
        additionalNo: data.profile_data?.additionalNo || '4421',
        phone: data.profile_data?.phone || '+966 11 456 7890',
        mobile: data.profile_data?.mobile || '+966 50 123 4567',
        email: data.owner_email || data.profile_data?.email || 'info@logixerp.com',
        website: data.profile_data?.website || 'https://logixerp.com',
        fiscalYearStart: data.profile_data?.fiscalYearStart || '2026-01-01',
        fiscalYearEnd: data.profile_data?.fiscalYearEnd || '2026-12-31',
        functionalCurrency: data.profile_data?.functionalCurrency || 'SAR',
        accountingBasis: data.profile_data?.accountingBasis || 'ACCRUAL',
        inventoryCosting: data.profile_data?.inventoryCosting || 'WEIGHTED_AVERAGE',
        depreciationMethod: data.profile_data?.depreciationMethod || 'STRAIGHT_LINE',
        decimalPlaces: data.profile_data?.decimalPlaces ?? 2,
        generalManager: data.profile_data?.generalManager || 'م. عبد العزيز بن فهد',
        financialManager: data.profile_data?.financialManager || 'أ. ياسر القحطاني',
        chiefAccountant: data.profile_data?.chiefAccountant || 'أ. عبد الرحمن السعيد',
        logoUrl: data.logo_url || data.logo || data.profile_data?.logoUrl || '',
        headerNotes: data.profile_data?.headerNotes || 'نظام لوجيكس السحابي لتخطيط الموارد (LOGIX Multi-Tenant ERP)',
        footerNotes: data.profile_data?.footerNotes || 'الدفع خلال 30 يوماً من تاريخ استلام الفاتورة.',
        showDigitalStamp: data.profile_data?.showDigitalStamp ?? true,
        defaultAccounts: data.default_accounts || data.profile_data?.defaultAccounts || undefined,
      };

      return profile;
    } catch (err: any) {
      console.warn('Supabase getCompany exception:', err?.message);
      return null;
    }
  }

  public static async saveCompany(comp: CompanyProfile): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = comp.id || getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const payload: any = {
        id: companyId,
        company_name: comp.nameAr,
        owner_email: comp.email || 'admin@logixerp.com',
        status: 'active',
        logo_url: comp.logoUrl || '',
        default_accounts: comp.defaultAccounts || {},
        profile_data: comp,
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
      return true;
    } catch (err: any) {
      console.warn('Supabase saveCompany exception:', err?.message);
      return false;
    }
  }

  /**
   * 2. ITEMS (الأصناف والمخزون)
   */
  public static async getItems(): Promise<InventoryItem[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = getCurrentCompanyId();
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
          id: row.id,
          sku: row.code || raw.sku || row.id,
          barcode: raw.barcode || '',
          nameAr: row.name_ar,
          nameEn: row.name_en || raw.nameEn || '',
          category: row.category || raw.category || 'مواد غذائية',
          unit: row.unit || raw.unit || 'حبة',
          unitsPerPack: raw.unitsPerPack || 1,
          packUnit: raw.packUnit || '',
          purchasePrice: Number(row.cost_price ?? raw.purchasePrice ?? 0),
          salePrice: Number(row.selling_price ?? raw.salePrice ?? 0),
          quantityOnHand: Number(row.current_balance ?? raw.quantityOnHand ?? 0),
          minQuantityAlert: Number(row.min_limit ?? raw.minQuantityAlert ?? 10),
          isActive: raw.isActive ?? true,
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getItems exception:', err?.message);
      return [];
    }
  }

  public static async saveItem(item: InventoryItem): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('items')
        .upsert([
          {
            id: item.id,
            company_id: companyId,
            code: item.sku || item.id,
            name_ar: item.nameAr,
            name_en: item.nameEn || '',
            category: item.category || 'عام',
            unit: item.unit || 'حبة',
            cost_price: item.purchasePrice || item.costPrice || 0,
            selling_price: item.salePrice || 0,
            current_balance: item.quantityOnHand || 0,
            min_limit: item.minQuantityAlert || 0,
            raw_data: item,
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

  public static async deleteItem(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('company_id', companyId)
        .eq('id', id);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteItem exception:', err?.message);
      return false;
    }
  }

  /**
   * 3. CUSTOMERS (العملاء)
   */
  public static async getCustomers(): Promise<Customer[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = getCurrentCompanyId();
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

      return data.map((row: any) => {
        const raw = row.raw_data || {};
        return {
          id: row.id,
          code: row.code,
          nameAr: row.name_ar,
          nameEn: row.name_en || raw.nameEn || '',
          phone: row.phone || raw.phone || '',
          address: row.address || raw.address || '',
          city: row.city || raw.city || 'الرياض',
          balance: Number(row.balance ?? raw.balance ?? 0),
          creditLimit: raw.creditLimit ?? 0,
          openingBalance: raw.openingBalance ?? 0,
          isActive: raw.isActive ?? true,
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getCustomers exception:', err?.message);
      return [];
    }
  }

  public static async saveCustomer(cust: Customer): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('customers')
        .upsert([
          {
            id: cust.id,
            company_id: companyId,
            code: cust.code,
            name_ar: cust.nameAr,
            name_en: cust.nameEn || '',
            phone: cust.phone || '',
            address: cust.address || '',
            city: cust.city || '',
            balance: cust.balance || 0,
            raw_data: cust,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn('Supabase saveCustomer error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Supabase saveCustomer exception:', err?.message);
      return false;
    }
  }

  public static async deleteCustomer(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('company_id', companyId)
        .eq('id', id);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteCustomer exception:', err?.message);
      return false;
    }
  }

  /**
   * 3.1 SUPPLIERS (الموردين)
   */
  public static async getSuppliers(): Promise<Supplier[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = getCurrentCompanyId();
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
          id: row.id,
          code: row.code,
          nameAr: row.name_ar,
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

  public static async saveSupplier(supp: Supplier): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('suppliers')
        .upsert([
          {
            id: supp.id,
            company_id: companyId,
            code: supp.code,
            name_ar: supp.nameAr,
            name_en: supp.nameEn || '',
            phone: supp.phone || '',
            address: supp.address || '',
            city: supp.city || '',
            balance: supp.balance || 0,
            raw_data: supp,
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

  public static async saveSuppliers(suppliers: Supplier[]): Promise<boolean> {
    if (!isSupabaseConfigured || suppliers.length === 0) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const rows = suppliers.map((s) => ({
        id: s.id,
        company_id: companyId,
        code: s.code,
        name_ar: s.nameAr,
        name_en: s.nameEn || '',
        phone: s.phone || '',
        address: s.address || '',
        city: s.city || '',
        balance: s.balance || 0,
        raw_data: s,
        created_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('suppliers').upsert(rows);
      return !error;
    } catch (err: any) {
      return false;
    }
  }

  public static async deleteSupplier(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('company_id', companyId)
        .eq('id', id);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteSupplier exception:', err?.message);
      return false;
    }
  }

  /**
   * 4. SALES_MASTER & SALES_DETAILS (الفواتير والمبيعات)
   */
  public static async getInvoices(): Promise<Invoice[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return [];
    try {
      let { data: masters, error: masterErr } = await supabase
        .from('sales_master')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (masterErr) {
        console.warn('Supabase getInvoices masterErr:', masterErr.message);
        return [];
      }

      if (!masters || masters.length === 0) return [];

      // Fetch sales_details for this company
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
          const line: InvoiceLine = {
            id: d.id,
            itemId: d.item_id,
            itemSku: raw.itemSku || d.item_id,
            barcode: raw.barcode || '',
            itemNameAr: d.item_name || raw.itemNameAr || '',
            unit: raw.unit || 'حبة',
            unitsPerPack: raw.unitsPerPack || 1,
            quantity: Number(d.quantity || 1),
            unitPrice: Number(d.unit_price || 0),
            subtotal: Number((d.unit_price || 0) * (d.quantity || 1)),
            vatRate: Number(d.vat_rate || 0),
            vatAmount: Number(d.vat_amount || 0),
            total: Number(d.total || 0),
            ...raw,
          };

          if (!detailsByInvoice[d.invoice_id]) {
            detailsByInvoice[d.invoice_id] = [];
          }
          detailsByInvoice[d.invoice_id].push(line);
        });
      }

      return masters.map((m: any) => {
        const raw = m.raw_data || {};
        const lines = detailsByInvoice[m.id] || raw.lines || [];
        return {
          id: m.id,
          invoiceNumber: m.invoice_number,
          type: raw.type || 'SALES',
          paymentTerms: raw.paymentTerms || (m.payment_method === 'CREDIT' ? 'CREDIT' : 'CASH'),
          entityId: m.customer_id || raw.entityId || '',
          entityNameAr: m.customer_name || raw.entityNameAr || '',
          date: m.date,
          dueDate: raw.dueDate || m.date,
          status: m.status || raw.status || 'POSTED',
          lines,
          subtotal: Number(m.subtotal ?? raw.subtotal ?? 0),
          vatTotal: Number(m.vat_amount ?? raw.vatTotal ?? 0),
          discountTotal: Number(raw.discountTotal ?? 0),
          grandTotal: Number(m.total_amount ?? raw.grandTotal ?? 0),
          paidAmount: Number(m.paid_amount ?? raw.paidAmount ?? 0),
          dueAmount: Number(m.due_amount ?? raw.dueAmount ?? 0),
          createdAt: raw.createdAt || new Date().toISOString(),
          ...raw,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getInvoices exception:', err?.message);
      return [];
    }
  }

  public static async saveInvoice(inv: Invoice): Promise<boolean> {
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      // 1. Upsert sales_master
      const { error: masterErr } = await supabase
        .from('sales_master')
        .upsert([
          {
            id: inv.id,
            company_id: companyId,
            invoice_number: inv.invoiceNumber,
            date: inv.date,
            customer_id: inv.entityId,
            customer_name: inv.entityNameAr,
            subtotal: inv.subtotal,
            vat_amount: inv.vatTotal,
            total_amount: inv.grandTotal,
            paid_amount: inv.paidAmount,
            due_amount: inv.dueAmount,
            status: inv.status,
            payment_method: inv.paymentTerms || 'CASH',
            raw_data: inv,
            created_at: new Date().toISOString(),
          },
        ]);

      if (masterErr) {
        console.warn('Supabase saveInvoice masterErr:', masterErr.message);
        return false;
      }

      // 2. Delete existing sales_details for this invoice
      await supabase
        .from('sales_details')
        .delete()
        .eq('company_id', companyId)
        .eq('invoice_id', inv.id);

      // 3. Insert new sales_details
      if (inv.lines && inv.lines.length > 0) {
        const detailRows = inv.lines.map((it, idx) => ({
          id: it.id || `${inv.id}-item-${idx}`,
          company_id: companyId,
          invoice_id: inv.id,
          item_id: it.itemId || '',
          item_name: it.itemNameAr || '',
          quantity: it.quantity,
          unit_price: it.unitPrice,
          vat_rate: it.vatRate,
          vat_amount: it.vatAmount,
          total: it.total,
          raw_data: it,
          created_at: new Date().toISOString(),
        }));

        const { error: detailErr } = await supabase
          .from('sales_details')
          .insert(detailRows);

        if (detailErr) {
          console.warn('Supabase saveInvoice detailErr:', detailErr.message);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('Supabase saveInvoice exception:', err?.message);
      return false;
    }
  }

  public static async deleteInvoice(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      await supabase
        .from('sales_details')
        .delete()
        .eq('company_id', companyId)
        .eq('invoice_id', id);

      const { error } = await supabase
        .from('sales_master')
        .delete()
        .eq('company_id', companyId)
        .eq('id', id);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteInvoice exception:', err?.message);
      return false;
    }
  }

  /**
   * 5. JOURNAL_ENTRIES (قيود اليومية المحاسبية)
   */
  public static async getJournals(): Promise<JournalEntry[]> {
    if (!isSupabaseConfigured) return [];
    const rawCompanyId = getCurrentCompanyId();
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
          id: row.id,
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

  public static async saveJournal(j: JournalEntry): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
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
              id: entryId,
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

  public static async deleteJournal(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const entryId = toValidUUID(id);
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('company_id', companyId)
        .eq('id', entryId);

      return !error;
    } catch (err: any) {
      console.warn('Supabase deleteJournal exception:', err?.message);
      return false;
    }
  }

  public static async getAccounts(): Promise<Account[] | null> {
    if (!isSupabaseConfigured) return null;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('code', { ascending: true });

      if (error || !data || data.length === 0) return null;

      return data.map((row: any) => ({
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
      }));
    } catch (e) {
      return null;
    }
  }

  public static async saveAccounts(accounts: Account[]): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const rawCompanyId = getCurrentCompanyId();
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId);
    if (!companyId) return false;
    try {
      const payload = accounts.map((acc) => ({
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
        description: acc.description || '',
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('chart_of_accounts').upsert(payload);
      return !error;
    } catch (e) {
      return false;
    }
  }
}
