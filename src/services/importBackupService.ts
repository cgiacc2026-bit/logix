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
import { resolveToSupabaseCompanyUUID } from './supabaseService.js';

export interface ImportProgress {
  total: number;
  current: number;
  stage: string;
  message: string;
}

export interface ImportResultReport {
  success: boolean;
  message: string;
  acceptedTotal: number;
  failedTotal: number;
  companyId: string;
  stats: {
    accounts: number;
    customers: number;
    suppliers: number;
    inventory: number;
    invoices: number;
    vouchers: number;
    journals: number;
  };
  errors: string[];
}

/**
 * UUID Sanitizer and ID Mapper
 * Generates valid UUIDs for legacy string IDs (e.g., "acc-1000", "inv-101", "cust-9407")
 * while maintaining referential integrity across all entities in memory.
 */
class IdSanitizerMap {
  private map = new Map<string, string>();
  private uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  public generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public isValidUUID(id: any): boolean {
    return typeof id === 'string' && this.uuidRegex.test(id.trim());
  }

  public getOrCreateUUID(rawId?: any): string {
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return this.generateUUID();
    }
    const cleanId = rawId.trim();
    if (this.isValidUUID(cleanId)) {
      return cleanId;
    }
    if (this.map.has(cleanId)) {
      return this.map.get(cleanId)!;
    }
    const newUuid = this.generateUUID();
    this.map.set(cleanId, newUuid);
    return newUuid;
  }

  public mapExisting(rawId: any): string | null {
    if (!rawId || typeof rawId !== 'string') return null;
    const cleanId = rawId.trim();
    if (this.isValidUUID(cleanId)) return cleanId;
    return this.map.get(cleanId) || null;
  }
}

/**
 * Deduplicate an array of objects by a unique key in memory,
 * keeping the newest/latest record if duplicates exist.
 */
function deduplicateLatest<T>(
  items: T[],
  getKey: (item: T) => string,
  getTimestamp?: (item: T) => number
): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const rawKey = getKey(item);
    if (!rawKey) continue;
    const key = rawKey.trim().toUpperCase();
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      if (getTimestamp) {
        const prevTime = getTimestamp(map.get(key)!);
        const currTime = getTimestamp(item);
        if (currTime >= prevTime) {
          map.set(key, item);
        }
      } else {
        // Last one in the file takes precedence as latest update
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

export class ERPBackupImportService {
  /**
   * Imports ERP Backup JSON into Supabase with strict tenant scoping:
   * 1. Ignores legacy company IDs like "company-kw-01", forcing active tenant UUID.
   * 2. Sanitizes old IDs ("acc-1000", "inv-101", "cust-9407") into valid UUIDs with an in-memory mapping.
   * 3. Memory deduplication: keeps newest record for duplicate reference numbers.
   * 4. Safe sequential processing: Batches of 20 with upsert onConflict and try/catch per batch.
   */
  public static async importCompanyJsonData(
    targetCompanyId: string,
    jsonInput: string | any,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResultReport> {
    const report: ImportResultReport = {
      success: false,
      message: '',
      acceptedTotal: 0,
      failedTotal: 0,
      companyId: '',
      stats: {
        accounts: 0,
        customers: 0,
        suppliers: 0,
        inventory: 0,
        invoices: 0,
        vouchers: 0,
        journals: 0,
      },
      errors: [],
    };

    try {
      const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (!parsed || typeof parsed !== 'object') {
        report.message = 'ملف JSON غير صالح أو فارغ';
        return report;
      }

      // ==============================================================================
      // 1. Force Active Company UUID (Strict Scoping & Ignore "company-kw-01")
      // ==============================================================================
      let activeCompanyUUID = resolveToSupabaseCompanyUUID(targetCompanyId) || targetCompanyId;
      if (!activeCompanyUUID || activeCompanyUUID === 'company-kw-01') {
        const savedTenant = typeof window !== 'undefined' ? localStorage.getItem('supabase_company_id') : null;
        activeCompanyUUID = resolveToSupabaseCompanyUUID(savedTenant) || savedTenant || '20000000-0000-0000-0000-000000000001';
      }

      // Ensure activeCompanyUUID is a valid UUID
      const idSanitizer = new IdSanitizerMap();
      if (!idSanitizer.isValidUUID(activeCompanyUUID)) {
        activeCompanyUUID = toValidUUID(activeCompanyUUID);
      }
      report.companyId = activeCompanyUUID;

      const rawData = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

      // Extract and normalize raw entities
      const rawAccounts: Account[] = rawData.accounts || rawData.chart_of_accounts || [];
      const rawCustomers: Customer[] = rawData.customers || [];
      const rawSuppliers: Supplier[] = rawData.suppliers || [];
      const rawInventory: InventoryItem[] = rawData.inventory || rawData.items || rawData.products || [];
      const rawInvoices: Invoice[] = rawData.invoices || [];
      const rawVouchers: PaymentVoucher[] = rawData.vouchers || rawData.payment_vouchers || [];
      const rawJournals: JournalEntry[] = rawData.journals || rawData.journal_entries || [];

      // ==============================================================================
      // 2. In-Memory Deduplication (Deduplication in Memory)
      //    Keep newest version of any record sharing the same reference number
      // ==============================================================================
      const dedupeTimestamp = (item: any) => {
        const ts = item.updatedAt || item.updated_at || item.date || item.createdAt || item.created_at;
        return ts ? new Date(ts).getTime() : 0;
      };

      const accounts = deduplicateLatest(
        rawAccounts,
        (a) => a.code || a.id,
        dedupeTimestamp
      );

      const customers = deduplicateLatest(
        rawCustomers,
        (c: any) => c.code || c.phone || c.id,
        dedupeTimestamp
      );

      const suppliers = deduplicateLatest(
        rawSuppliers,
        (s: any) => s.code || s.phone || s.id,
        dedupeTimestamp
      );

      const inventory = deduplicateLatest(
        rawInventory,
        (item: any) => item.sku || item.code || item.barcode || item.id,
        dedupeTimestamp
      );

      const invoices = deduplicateLatest(
        rawInvoices,
        (inv: any) => inv.invoiceNumber || inv.invoice_number || inv.id,
        dedupeTimestamp
      );

      const vouchers = deduplicateLatest(
        rawVouchers,
        (v: any) => v.voucherNumber || v.voucher_number || v.id,
        dedupeTimestamp
      );

      const journals = deduplicateLatest(
        rawJournals,
        (j: any) => j.entryNumber || j.entry_number || j.id,
        dedupeTimestamp
      );

      // Pre-register IDs in ID Sanitizer Map to preserve relational links
      accounts.forEach((acc) => {
        const uuid = idSanitizer.getOrCreateUUID(acc.id || `acc-${acc.code}`);
        if (acc.code) idSanitizer.getOrCreateUUID(`code-${acc.code}`);
      });

      customers.forEach((c) => {
        idSanitizer.getOrCreateUUID(c.id);
      });

      suppliers.forEach((s) => {
        idSanitizer.getOrCreateUUID(s.id);
      });

      inventory.forEach((item) => {
        idSanitizer.getOrCreateUUID(item.id);
      });

      invoices.forEach((inv) => {
        idSanitizer.getOrCreateUUID(inv.id);
      });

      vouchers.forEach((v) => {
        idSanitizer.getOrCreateUUID(v.id);
      });

      journals.forEach((j) => {
        idSanitizer.getOrCreateUUID(j.id);
      });

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

      updateProgress('START', 'بدء فحص وتطهير البيانات...', 0);

      // ==============================================================================
      // 3. Prepare Payloads with UUID Sanitization & Relational Mapping
      // ==============================================================================

      // 3.1 Chart of Accounts
      const accountsPayload = accounts.map((acc, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(acc.id || `acc-${acc.code || index}`);
        const parentId = acc.parentId ? idSanitizer.getOrCreateUUID(acc.parentId) : null;
        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          code: acc.code || `ACC-${String(index + 1).padStart(4, '0')}`,
          name_ar: acc.nameAr || (acc as any).name_ar || 'حساب مستورد',
          name_en: acc.nameEn || '',
          category: acc.category || 'ASSET',
          normal_balance: acc.normalBalance || 'DEBIT',
          level: acc.level || 1,
          type: acc.type || 'DETAIL',
          parent_id: parentId,
          balance: Number(acc.balance || 0),
          current_balance: Number(acc.currentBalance ?? acc.balance ?? 0),
          is_active: true,
          updated_at: new Date().toISOString(),
        };
      });

      // 3.2 Customers
      const customersPayload = customers.map((c, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(c.id || `cust-${index}`);
        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          code: (c as any).code || `CUST-${String(index + 1).padStart(4, '0')}`,
          name_ar: c.nameAr || (c as any).name || 'عميل مستورد',
          name_en: c.nameEn || '',
          phone: c.phone || '',
          email: c.email || '',
          tax_number: c.taxNumber || '',
          address: c.address || '',
          balance: Number((c as any).balance || 0),
          current_balance: Number((c as any).current_balance ?? (c as any).balance ?? 0),
          updated_at: new Date().toISOString(),
        };
      });

      // 3.3 Suppliers
      const suppliersPayload = suppliers.map((s, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(s.id || `supp-${index}`);
        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          code: (s as any).code || `SUPP-${String(index + 1).padStart(4, '0')}`,
          name_ar: s.nameAr || (s as any).name || 'مورد مستورد',
          name_en: s.nameEn || '',
          phone: s.phone || '',
          email: s.email || '',
          tax_number: s.taxNumber || '',
          address: s.address || '',
          balance: Number((s as any).balance || 0),
          current_balance: Number((s as any).current_balance ?? (s as any).balance ?? 0),
          updated_at: new Date().toISOString(),
        };
      });

      // 3.4 Inventory Items
      const itemsPayload = inventory.map((item, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(item.id || `item-${index}`);
        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          code: item.sku || (item as any).code || `SKU-${String(index + 1).padStart(4, '0')}`,
          name_ar: item.nameAr || (item as any).name || 'صنف مستورد',
          name_en: item.nameEn || '',
          category: item.category || 'مواد غذائية',
          unit: item.unit || 'حبة',
          cost_price: Number(item.purchasePrice || (item as any).costPrice || (item as any).cost_price || 0),
          selling_price: Number(item.salePrice || (item as any).selling_price || 0),
          current_balance: Number(item.quantityOnHand ?? (item as any).current_balance ?? 0),
          min_limit: Number(item.minQuantityAlert ?? (item as any).min_limit ?? 10),
          updated_at: new Date().toISOString(),
        };
      });

      // 3.5 Invoices
      const invoicesPayload = invoices.map((inv, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(inv.id || `inv-${index}`);
        const customerId = inv.entityId ? idSanitizer.getOrCreateUUID(inv.entityId) : null;
        const subtotal = Number(inv.subtotal || 0);
        const taxAmount = Number(inv.vatTotal ?? (inv as any).taxAmount ?? 0);
        const totalAmount = Number(inv.grandTotal ?? (inv as any).totalAmount ?? (subtotal + taxAmount));
        const paidAmount = Number(inv.paidAmount || 0);
        const dueAmount = Number(inv.dueAmount || Math.max(0, totalAmount - paidAmount));
        const invoiceNumber = inv.invoiceNumber || (inv as any).invoice_number || `INV-${String(index + 1).padStart(4, '0')}`;

        // Sanitize item IDs inside lines
        const sanitizedLines = (inv.lines || (inv as any).items || []).map((line: any) => ({
          ...line,
          id: idSanitizer.generateUUID(),
          invoiceId: sanitizedId,
          itemId: line.itemId ? idSanitizer.getOrCreateUUID(line.itemId) : null,
        }));

        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          invoice_number: invoiceNumber,
          date: inv.date || new Date().toISOString().split('T')[0],
          invoice_date: inv.date || new Date().toISOString().split('T')[0],
          customer_id: customerId,
          customer_name: inv.entityNameAr || (inv as any).customer_name || 'عميل مستورد',
          subtotal,
          tax_amount: taxAmount,
          vat_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          payment_status: (paidAmount >= totalAmount && totalAmount > 0) ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : (inv.status || 'POSTED')),
          status: inv.status || 'POSTED',
          raw_data: { ...inv, lines: sanitizedLines },
          updated_at: new Date().toISOString(),
        };
      });

      // 3.6 Payment Vouchers
      const vouchersPayload = vouchers.map((v, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(v.id || `vch-${index}`);
        const entityId = v.entityId ? idSanitizer.getOrCreateUUID(v.entityId) : null;
        const accountId = (v.bankAccountId || (v as any).accountId)
          ? idSanitizer.getOrCreateUUID(v.bankAccountId || (v as any).accountId)
          : null;
        const voucherNumber = v.voucherNumber || (v as any).voucher_number || `VCH-${String(index + 1).padStart(4, '0')}`;

        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          voucher_number: voucherNumber,
          type: v.type || 'RECEIPT',
          date: v.date || new Date().toISOString().split('T')[0],
          amount: Number(v.amount || 0),
          payment_method: v.paymentMethod || 'CASH',
          entity_type: v.entityType || 'CUSTOMER',
          entity_id: entityId,
          entity_name: v.entityNameAr || (v as any).entity_name || '',
          account_id: accountId,
          notes: v.notes || (v as any).description || '',
          status: v.status || 'POSTED',
          updated_at: new Date().toISOString(),
        };
      });

      // 3.7 Journal Entries
      const journalsPayload = journals.map((j, index) => {
        const sanitizedId = idSanitizer.getOrCreateUUID(j.id || `jv-${index}`);
        const entryNumber = j.entryNumber || (j as any).entry_number || `JV-${String(index + 1).padStart(4, '0')}`;
        
        // Remap line account IDs to sanitized account UUIDs
        const sanitizedLines = (j.lines || []).map((line) => {
          const accId = line.accountId ? idSanitizer.getOrCreateUUID(line.accountId) : null;
          return {
            ...line,
            id: line.id ? idSanitizer.getOrCreateUUID(line.id) : idSanitizer.generateUUID(),
            accountId: accId,
          };
        });

        return {
          id: sanitizedId,
          company_id: activeCompanyUUID,
          entry_number: entryNumber,
          date: j.date || new Date().toISOString().split('T')[0],
          description: j.description || (j as any).memo || '',
          status: j.status || 'POSTED',
          reference: j.reference || null,
          reference_id: j.referenceId ? idSanitizer.getOrCreateUUID(j.referenceId) : null,
          total_debit: Number(j.totalDebit || 0),
          total_credit: Number(j.totalCredit || 0),
          lines: sanitizedLines,
          updated_at: new Date().toISOString(),
        };
      });

      // ==============================================================================
      // 4. Sequential Safe Execution in Batches of 20 with Try/Catch
      // ==============================================================================

      // 4.1 Accounts (onConflict: company_id, code)
      if (accountsPayload.length > 0) {
        updateProgress('ACCOUNTS', `جاري استيراد ${accountsPayload.length} حساب مالي بدفعات آمنة...`, 0);
        const accAccepted = await this.safeBatchedUpsert(
          'chart_of_accounts',
          accountsPayload,
          'company_id, code',
          report
        );
        report.stats.accounts = accAccepted;
        updateProgress('ACCOUNTS', `تم استيراد ${accAccepted} حساب مالي بنجاح`, accountsPayload.length);
      }

      // 4.2 Customers (onConflict: company_id, code)
      if (customersPayload.length > 0) {
        updateProgress('CUSTOMERS', `جاري استيراد ${customersPayload.length} عميل...`, 0);
        const custAccepted = await this.safeBatchedUpsert(
          'customers',
          customersPayload,
          'company_id, code',
          report
        );
        report.stats.customers = custAccepted;
        updateProgress('CUSTOMERS', `تم استيراد ${custAccepted} عميل بنجاح`, customersPayload.length);
      }

      // 4.3 Suppliers (onConflict: company_id, code)
      if (suppliersPayload.length > 0) {
        updateProgress('SUPPLIERS', `جاري استيراد ${suppliersPayload.length} مورد...`, 0);
        const suppAccepted = await this.safeBatchedUpsert(
          'suppliers',
          suppliersPayload,
          'company_id, code',
          report
        );
        report.stats.suppliers = suppAccepted;
        updateProgress('SUPPLIERS', `تم استيراد ${suppAccepted} مورد بنجاح`, suppliersPayload.length);
      }

      // 4.4 Inventory Items (onConflict: company_id, code)
      if (itemsPayload.length > 0) {
        updateProgress('INVENTORY', `جاري استيراد ${itemsPayload.length} صنف...`, 0);
        const itemAccepted = await this.safeBatchedUpsert(
          'items',
          itemsPayload,
          'company_id, code',
          report
        );
        report.stats.inventory = itemAccepted;
        updateProgress('INVENTORY', `تم استيراد ${itemAccepted} صنف بنجاح`, itemsPayload.length);
      }

      // 4.5 Invoices (onConflict: company_id, invoice_number)
      if (invoicesPayload.length > 0) {
        updateProgress('INVOICES', `جاري استيراد ${invoicesPayload.length} فاتورة...`, 0);
        const invAccepted = await this.safeBatchedUpsert(
          'invoices',
          invoicesPayload,
          'company_id, invoice_number',
          report
        );
        report.stats.invoices = invAccepted;
        updateProgress('INVOICES', `تم استيراد ${invAccepted} فاتورة بنجاح`, invoicesPayload.length);
      }

      // 4.6 Payment Vouchers (onConflict: company_id, voucher_number)
      if (vouchersPayload.length > 0) {
        updateProgress('VOUCHERS', `جاري استيراد ${vouchersPayload.length} سند قبض وصرف...`, 0);
        const vchAccepted = await this.safeBatchedUpsert(
          'payment_vouchers',
          vouchersPayload,
          'company_id, voucher_number',
          report
        );
        report.stats.vouchers = vchAccepted;
        updateProgress('VOUCHERS', `تم استيراد ${vchAccepted} سند بنجاح`, vouchersPayload.length);
      }

      // 4.7 Journal Entries (onConflict: company_id, entry_number)
      if (journalsPayload.length > 0) {
        updateProgress('JOURNALS', `جاري استيراد ${journalsPayload.length} قيد يومية...`, 0);
        const jrnAccepted = await this.safeBatchedUpsert(
          'journal_entries',
          journalsPayload,
          'company_id, entry_number',
          report
        );
        report.stats.journals = jrnAccepted;
        updateProgress('JOURNALS', `تم استيراد ${jrnAccepted} قيد يومية بنجاح`, journalsPayload.length);
      }

      // Auto-recalculate accounting balances
      try {
        await supabase.rpc('recalculate_company_ledger_balances', { p_company_id: activeCompanyUUID });
      } catch (e) {
        console.warn('Recalculate balances RPC note:', e);
      }

      report.acceptedTotal =
        report.stats.accounts +
        report.stats.customers +
        report.stats.suppliers +
        report.stats.inventory +
        report.stats.invoices +
        report.stats.vouchers +
        report.stats.journals;

      report.success = report.acceptedTotal > 0 || totalSteps === 0;
      report.message = `تمت استعادة وقبول ${report.acceptedTotal} سجل بنجاح وربطها بالشركة (${activeCompanyUUID}).`;
      
      updateProgress('COMPLETE', report.message, 0);
      return report;
    } catch (error: any) {
      console.error('ERPBackupImportService fatal error:', error);
      report.success = false;
      report.message = `فشل استيراد النسخة الاحتياطية: ${error.message || 'خطأ غير معروف'}`;
      report.errors.push(error.message || 'Fatal exception');
      return report;
    }
  }

  /**
   * Helper to perform batched upserts in chunks of 20 with fallback item-level retry
   * to guarantee that a single bad row never fails other valid rows in the batch.
   */
  private static async safeBatchedUpsert(
    tableName: string,
    payloads: any[],
    onConflict: string,
    report: ImportResultReport
  ): Promise<number> {
    const BATCH_SIZE = 20;
    let acceptedCount = 0;

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict, ignoreDuplicates: false });

        if (error) {
          console.warn(`[Batch Warning] ${tableName} batch error (${error.message}). Retrying items individually...`);
          // Item-level resilient fallback
          for (const item of batch) {
            try {
              const { error: itemError } = await supabase
                .from(tableName)
                .upsert([item], { onConflict, ignoreDuplicates: false });

              if (itemError) {
                // Secondary fallback using 'id' as onConflict if compound index is missing
                const { error: idError } = await supabase
                  .from(tableName)
                  .upsert([item], { onConflict: 'id', ignoreDuplicates: false });

                if (idError) {
                  report.failedTotal++;
                  report.errors.push(`[${tableName}] تخطي السجل ${item.code || item.invoice_number || item.voucher_number || item.id}: ${idError.message}`);
                } else {
                  acceptedCount++;
                }
              } else {
                acceptedCount++;
              }
            } catch (itemEx: any) {
              report.failedTotal++;
              report.errors.push(`[${tableName}] خطأ في السجل: ${itemEx?.message || 'غير معروف'}`);
            }
          }
        } else {
          acceptedCount += batch.length;
        }
      } catch (batchEx: any) {
        console.warn(`[Batch Exception] in ${tableName}:`, batchEx);
        // Try item by item
        for (const item of batch) {
          try {
            const { error: fallbackErr } = await supabase
              .from(tableName)
              .upsert([item], { onConflict: 'id', ignoreDuplicates: false });
            if (!fallbackErr) {
              acceptedCount++;
            } else {
              report.failedTotal++;
            }
          } catch {
            report.failedTotal++;
          }
        }
      }
    }

    return acceptedCount;
  }
}

/**
 * Main Frontend JSON Backup Restore Handler (handleJsonImport)
 * Adheres strictly to:
 * 1. Overriding legacy company IDs like "company-kw-01" with active company's authenticated UUID.
 * 2. UUID Sanitization with an in-memory mapping object to preserve foreign key relationships.
 * 3. In-memory deduplication keeping the newest record per invoice_number / voucher_number.
 * 4. Safe batched upserts (batches of 20) with onConflict and try/catch per batch.
 */
export async function handleJsonImport(
  jsonInput: string | any,
  currentCompanyId?: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResultReport> {
  const companyId =
    currentCompanyId ||
    (typeof window !== 'undefined' ? localStorage.getItem('supabase_company_id') : null) ||
    '20000000-0000-0000-0000-000000000001';
  return ERPBackupImportService.importCompanyJsonData(companyId, jsonInput, onProgress);
}


