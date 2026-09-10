import {
  Account,
  InventoryItem,
  Invoice,
  JournalEntry,
  PaymentVoucher,
  Customer,
  Supplier,
} from '../types.js';
import { supabase, toValidUUID } from './supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';
import { resolveToSupabaseCompanyUUID } from './supabaseService.js';

export interface ImportProgress {
  total: number;
  current: number;
  stage: string;
  message: string;
}

export class ERPBackupImportService {
  /**
   * Imports ERP Backup JSON into Supabase with strict tenant scoping, auto-provisioning
   * missing accounts, and idempotent upserts to prevent duplications.
   */
  public static async importCompanyJsonData(
    targetCompanyId: string,
    jsonInput: string | any,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'ملف JSON غير صالح أو فارغ' };
      }

      const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const companyId = resolveToSupabaseCompanyUUID(targetCompanyId) || targetCompanyId;

      if (!companyId) {
        return { success: false, message: 'معرف الشركة (Tenant ID) مفقود أو غير صالح' };
      }

      // Extract entities
      const accounts: Account[] = data.accounts || data.chart_of_accounts || [];
      const customers: Customer[] = data.customers || [];
      const suppliers: Supplier[] = data.suppliers || [];
      const inventory: InventoryItem[] = data.inventory || data.items || data.products || [];
      const invoices: Invoice[] = data.invoices || [];
      const vouchers: PaymentVoucher[] = data.vouchers || data.payment_vouchers || [];
      const journals: JournalEntry[] = data.journals || data.journal_entries || [];

      // Calculate total steps for progress
      const totalSteps =
        accounts.length +
        customers.length +
        suppliers.length +
        inventory.length +
        invoices.length +
        vouchers.length +
        journals.length;

      let currentStep = 0;
      const updateProgress = (stage: string, message: string, increment: number = 0) => {
        currentStep += increment;
        if (onProgress) {
          onProgress({
            total: totalSteps > 0 ? totalSteps : 1,
            current: currentStep,
            stage,
            message,
          });
        }
      };

      updateProgress('START', 'بدء الاستيراد...', 0);

      // ==============================================================================
      // 1. Auto-Provision Accounts (شجرة الحسابات)
      // ==============================================================================
      const accountIdsToCreate = new Map<string, any>();
      accounts.forEach((acc) => {
        accountIdsToCreate.set(acc.id || acc.code, {
          id: acc.id || uuidv4(),
          company_id: companyId,
          code: acc.code || `ACC-${Math.floor(Math.random() * 100000)}`,
          name_ar: acc.nameAr || (acc as any).name_ar || 'حساب مستورد',
          name_en: acc.nameEn || '',
          category: acc.category || 'ASSET',
          normal_balance: acc.normalBalance || 'DEBIT',
          level: acc.level || 1,
          type: acc.type || 'DETAIL',
        });
      });

      // Extract referenced accounts from other entities
      const addMissingRefAccount = (refId: string, name: string, category: string, normal_balance: string) => {
        if (refId && !accountIdsToCreate.has(refId)) {
          accountIdsToCreate.set(refId, {
            id: refId,
            company_id: companyId,
            code: `IMP-${Math.floor(Math.random() * 100000)}`,
            name_ar: name || 'حساب نظام مستورد',
            category: category,
            normal_balance: normal_balance,
            level: 1,
            type: 'DETAIL',
          });
        }
      };

      vouchers.forEach((v) => {
        if (v.bankAccountId) addMissingRefAccount(v.bankAccountId, 'حساب الدفع - ' + v.paymentMethod, 'ASSET', 'DEBIT');
        if ((v as any).accountId) addMissingRefAccount((v as any).accountId, 'حساب الدفع', 'ASSET', 'DEBIT');
      });

      journals.forEach((j) => {
        j.lines?.forEach((line) => {
          if (line.accountId) addMissingRefAccount(line.accountId, line.accountNameAr || 'حساب قيد يومية', 'ASSET', 'DEBIT');
        });
      });

      if (accountIdsToCreate.size > 0) {
        updateProgress('ACCOUNTS', `جاري استيراد ${accountIdsToCreate.size} حساب مالي...`, 0);
        const accountsList = Array.from(accountIdsToCreate.values());
        await this.upsertInBatches('chart_of_accounts', accountsList, ['id', 'company_id']);
        updateProgress('ACCOUNTS', `تم استيراد الحسابات بنجاح`, accounts.length);
      }

      // ==============================================================================
      // 2. Customers & Suppliers (العملاء والموردين)
      // ==============================================================================
      if (customers.length > 0) {
        updateProgress('CUSTOMERS', `جاري استيراد ${customers.length} عميل...`, 0);
        const custPayload = customers.map((c) => ({
          id: toValidUUID(c.id),
          company_id: companyId,
          name_ar: c.nameAr || (c as any).name || '',
          name_en: c.nameEn || '',
          phone: c.phone || '',
          email: c.email || '',
          tax_number: c.taxNumber || '',
          address: c.address || '',
        }));
        await this.upsertInBatches('customers', custPayload, ['id', 'company_id']);
        updateProgress('CUSTOMERS', `تم استيراد العملاء بنجاح`, customers.length);
      }

      if (suppliers.length > 0) {
        updateProgress('SUPPLIERS', `جاري استيراد ${suppliers.length} مورد...`, 0);
        const suppPayload = suppliers.map((s) => ({
          id: toValidUUID(s.id),
          company_id: companyId,
          name_ar: s.nameAr || (s as any).name || '',
          name_en: s.nameEn || '',
          phone: s.phone || '',
          email: s.email || '',
          tax_number: s.taxNumber || '',
          address: s.address || '',
        }));
        await this.upsertInBatches('suppliers', suppPayload, ['id', 'company_id']);
        updateProgress('SUPPLIERS', `تم استيراد الموردين بنجاح`, suppliers.length);
      }

      // ==============================================================================
      // 3. Inventory Items (الأصناف - بدون تصفير الأرصدة)
      // ==============================================================================
      if (inventory.length > 0) {
        updateProgress('INVENTORY', `جاري استيراد ${inventory.length} صنف...`, 0);
        const itemPayload = inventory.map((item) => ({
          id: item.id,
          company_id: companyId,
          code: item.sku || (item as any).code || item.id,
          name: item.nameAr || (item as any).name || 'صنف',
          name_ar: item.nameAr,
          name_en: item.nameEn || '',
          category: item.category || 'عام',
          unit: item.unit || 'حبة',
          cost_price: item.purchasePrice || (item as any).costPrice || 0,
          sale_price: item.salePrice || 0,
          barcode: item.barcode || item.sku || null,
        }));
        
        // Upsert items, ignoring quantity fields to prevent overwriting existing balances
        await this.upsertInBatches('items', itemPayload, ['id', 'company_id']);
        updateProgress('INVENTORY', `تم استيراد الأصناف بنجاح`, inventory.length);
      }

      // ==============================================================================
      // 4. Invoices (الفواتير)
      // ==============================================================================
      if (invoices.length > 0) {
        updateProgress('INVOICES', `جاري استيراد ${invoices.length} فاتورة...`, 0);
        const invoicePayload = invoices.map((inv) => {
          const subtotal = Number(inv.subtotal || 0);
          const taxAmount = Number(inv.vatTotal ?? (inv as any).taxAmount ?? 0);
          const totalAmount = Number(inv.grandTotal ?? (inv as any).totalAmount ?? (subtotal + taxAmount));
          const paidAmount = Number(inv.paidAmount || 0);
          const paymentStatus = (paidAmount >= totalAmount && totalAmount > 0) ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : (inv.status || 'POSTED'));

          return {
            id: toValidUUID(inv.id),
            company_id: companyId,
            invoice_number: inv.invoiceNumber || inv.id,
            date: inv.date || new Date().toISOString().split('T')[0],
            invoice_date: inv.date || new Date().toISOString().split('T')[0],
            customer_id: inv.entityId ? toValidUUID(inv.entityId) : null,
            customer_name: inv.entityNameAr || (inv as any).entityName || 'عميل مستورد',
            subtotal,
            tax_amount: taxAmount,
            vat_amount: taxAmount,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            due_amount: Number(inv.dueAmount || Math.max(0, totalAmount - paidAmount)),
            payment_status: paymentStatus,
            status: paymentStatus,
            items: JSON.stringify(inv.lines || (inv as any).items || []), // Store items in JSONB column
            raw_data: inv,
          };
        });
        await this.upsertInBatches('invoices', invoicePayload, ['id', 'company_id']);
        updateProgress('INVOICES', `تم استيراد الفواتير بنجاح`, invoices.length);
      }

      // ==============================================================================
      // 5. Payment Vouchers (سندات الصرف والقبض)
      // ==============================================================================
      if (vouchers.length > 0) {
        updateProgress('VOUCHERS', `جاري استيراد ${vouchers.length} سند...`, 0);
        const voucherPayload = vouchers.map((v) => ({
          id: v.id,
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
          notes: v.notes || (v as any).description || '',
          status: v.status || 'POSTED',
          is_posted: true, // Mark imported records as posted to avoid double ledger impact
          raw_data: v,
        }));
        await this.upsertInBatches('payment_vouchers', voucherPayload, ['id', 'company_id']);
        
        // Also sync to legacy vouchers table if needed
        const legacyVoucherPayload = voucherPayload.map((v) => ({
           id: v.id,
           company_id: companyId,
           voucher_type: v.type,
           date: v.date,
           amount: v.amount,
           description: v.notes,
           account_id: v.account_id,
           status: v.status
        }));
        try { await this.upsertInBatches('vouchers', legacyVoucherPayload, ['id', 'company_id'], true); } catch(e){}
        updateProgress('VOUCHERS', `تم استيراد السندات بنجاح`, vouchers.length);
      }

      // ==============================================================================
      // 6. Journal Entries (قيود الأستاذ العام)
      // ==============================================================================
      if (journals.length > 0) {
        updateProgress('JOURNALS', `جاري استيراد ${journals.length} قيد يومية...`, 0);
        const journalPayload = journals.map((j) => ({
          id: toValidUUID(j.id),
          company_id: companyId,
          entry_number: j.entryNumber || j.id,
          date: j.date || new Date().toISOString().split('T')[0],
          description: j.description || (j as any).memo || '',
          status: j.status || 'POSTED',
          reference: j.reference || null,
          total_debit: Number(j.totalDebit || 0),
          total_credit: Number(j.totalCredit || 0),
          lines: JSON.stringify(j.lines || []),
          raw_data: j,
        }));
        await this.upsertInBatches('journal_entries', journalPayload, ['id', 'company_id']);
        updateProgress('JOURNALS', `تم استيراد قيود اليومية بنجاح`, journals.length);
      }

      // Finalize
      updateProgress('COMPLETE', 'اكتمل الاستيراد بنجاح', 0);

      // Trigger automatic recalculation of ledger balances in the backend to ensure accurate balances.
      try {
        await supabase.rpc('recalculate_company_ledger_balances', { p_company_id: companyId });
      } catch (e) {
        console.warn('Could not run auto-recalculate function', e);
      }

      return {
        success: true,
        message: 'تم استيراد النسخة الاحتياطية بنجاح إلى قاعدة البيانات.',
        stats: {
          accounts: accounts.length,
          customers: customers.length,
          suppliers: suppliers.length,
          inventory: inventory.length,
          invoices: invoices.length,
          vouchers: vouchers.length,
          journals: journals.length,
        },
      };
    } catch (error: any) {
      console.error('ERPBackupImportService error:', error);
      return { success: false, message: `فشل استيراد النسخة الاحتياطية: ${error.message || 'خطأ غير معروف'}` };
    }
  }

  /**
   * Helper to perform idempotent batched upserts without blocking the UI completely.
   */
  private static async upsertInBatches(
    tableName: string,
    payloads: any[],
    onConflict: string[],
    silentFail: boolean = false
  ) {
    const BATCH_SIZE = 100;
    const conflictKeys = onConflict.join(',');

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      
      const query = supabase.from(tableName).upsert(batch, {
        onConflict: conflictKeys,
        ignoreDuplicates: false,
      });

      const { error } = await query;
      
      if (error && !silentFail) {
        console.warn(`Supabase upsert batch error in table ${tableName}:`, error.message);
        throw new Error(`خطأ في رفع جدول ${tableName}: ${error.message}`);
      }
    }
  }
}
