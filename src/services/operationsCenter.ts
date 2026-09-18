/**
 * مركز العمليات الموحد (Unified Operations Center)
 * المحرك المركزي الموحد لتنفيذ كافة عمليات التعديل، الإضافة، الإلغاء، والحذف
 * يضمن التنفيذ الذري (Atomic Execution)، التسوية المحاسبية الفورية، ومنع التضارب نهائياً
 * مع التحقق الصارم من توازن القيود المزدوجة ومطابقة الأعمدة الجديدة (source_module / source_id)
 */

import { DataService, localDataStore } from './dataService.ts';
import { SupabaseDataService } from './supabaseService.ts';
import { isSupabaseConfigured } from './supabaseClient.js';
import { isAccountLeaf } from '../utils/accountingTreeEngine.ts';
import type {
  Customer,
  Supplier,
  Invoice,
  PaymentVoucher,
  InventoryItem,
  JournalEntry,
  Account,
  JournalLine,
} from '../types.js';

export interface MutationResult<T> {
  success: boolean;
  entity: T | null;
  message?: string;
  error?: string;
}

export interface DoubleEntryValidationResult {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  errors: string[];
  normalizedLines?: JournalLine[];
}

export class OperationsCenter {
  /**
   * إشعار واجهة المستخدم الفوري بحدوث تعديل أو عملية
   */
  private static notifyChange(entityType: string, action: string, id?: string, data?: any) {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('ERP_DATA_CHANGED', {
        detail: { entityType, action, id, data, timestamp: Date.now() },
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * تطبيع وتأكيد سلامة الأعمدة الجديدة (source_module و source_id) بصيغتي CamelCase و Snake_case
   * لضمان توافق قاعدة البيانات وخدمات المزامنة مع الواجهة
   */
  public static normalizeSourceAttributes(
    data: any,
    defaultModule: string = 'MANUAL_JOURNAL',
    defaultId?: string
  ): { sourceModule: string; sourceId: string; source_module: string; source_id: string } {
    const rawModule =
      data?.sourceModule ||
      data?.source_module ||
      data?.source ||
      defaultModule ||
      'MANUAL_JOURNAL';

    const rawId =
      data?.sourceId ||
      data?.source_id ||
      defaultId ||
      data?.reference ||
      data?.id ||
      '';

    const strModule = String(rawModule).trim();
    const strId = String(rawId).trim();

    return {
      sourceModule: strModule,
      sourceId: strId,
      source_module: strModule,
      source_id: strId,
    };
  }

  /**
   * محرك الفحص المحاسبي الصارم للقيد المزدوج (Double-Entry Verification Guard)
   * يفحص توازن القيد، مشروعية الحسابات الطرفية، حظر القيم السالبة، وتطابق المدين والدائن بدقة 3 أرقام عشرية
   */
  public static async validateDoubleEntry(
    journal: Partial<JournalEntry>
  ): Promise<DoubleEntryValidationResult> {
    const errors: string[] = [];
    const rawLines = journal.lines || [];

    if (!Array.isArray(rawLines) || rawLines.length < 2) {
      errors.push('لا يمكن اعتماد القيد: يجب أن يتكون القيد المحاسبي من طرفين على الأقل (طرف مدين وطرف دائن).');
      return {
        isValid: false,
        totalDebit: 0,
        totalCredit: 0,
        difference: 0,
        errors,
      };
    }

    // جلب شجرة الحسابات للتأكد من أن القيود لا تسجل على حسابات تجميعية رئيسية
    let accounts: Account[] = [];
    try {
      accounts = isSupabaseConfigured
        ? await DataService.getAccounts()
        : localDataStore.getAccounts();
    } catch {
      accounts = localDataStore.getAccounts();
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const normalizedLines: JournalLine[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lineNum = i + 1;

      if (!line.accountId && !line.accountCode) {
        errors.push(`السطر رقم (${lineNum}): غير مرتبط بأي حساب محاسبي.`);
        continue;
      }

      // التحقق من الحساب وكونه حساباً تحليلياً طرفياً (Leaf Account)
      const targetAcc = accounts.find(
        (a) => a.id === line.accountId || (line.accountCode && a.code === line.accountCode)
      );

      if (targetAcc && accounts.length > 0 && !isAccountLeaf(targetAcc, accounts)) {
        errors.push(
          `[CPA Parent Guard] مخالفة محاسبية صريحة: الحساب "${targetAcc.code} - ${targetAcc.nameAr}" في السطر (${lineNum}) هو حساب تجميعي رئيسي (Parent). القيود تُسجل حصراً على الحسابات التحليلية الفرعية.`
        );
      }

      const d = Math.round((Number(line.debit) || 0) * 1000) / 1000;
      const c = Math.round((Number(line.credit) || 0) * 1000) / 1000;

      if (d < 0 || c < 0) {
        errors.push(`السطر رقم (${lineNum}): لا يُسمح بإدخال مبالغ سالبة في القيد.`);
      }

      if (d > 0 && c > 0) {
        errors.push(`السطر رقم (${lineNum}): لا يمكن للسطر أن يحتوي على مبالغ في الطرفين المدين والدائن معاً.`);
      }

      if (d === 0 && c === 0) {
        errors.push(`السطر رقم (${lineNum}): سطر فارغ لا يحتوي على أي قيمة.`);
      }

      totalDebit += d;
      totalCredit += c;

      normalizedLines.push({
        ...line,
        id: line.id || `jl-${lineNum}-${Math.random().toString(36).substr(2, 6)}`,
        debit: d,
        credit: c,
        accountId: targetAcc ? targetAcc.id : line.accountId || '',
        accountCode: targetAcc ? targetAcc.code : line.accountCode || '',
        accountNameAr: targetAcc ? targetAcc.nameAr : line.accountNameAr || '',
      });
    }

    totalDebit = Math.round(totalDebit * 1000) / 1000;
    totalCredit = Math.round(totalCredit * 1000) / 1000;
    const diff = Math.abs(Math.round((totalDebit - totalCredit) * 10000) / 10000);

    if (totalDebit <= 0 || totalCredit <= 0) {
      errors.push('لا يمكن حفظ القيد: إجمالي المبالغ المدينة والدائنة يجب أن تكون أكبر من الصفر.');
    }

    if (diff > 0.0005) {
      errors.push(
        `[CPA Balance Guard] القيد غير متوازن إطلاقاً! إجمالي الطرف المدين (${totalDebit.toFixed(3)}) يجب أن يتطابق تماماً مع إجمالي الطرف الدائن (${totalCredit.toFixed(3)}). فارق عدم التوازن: ${diff.toFixed(4)} د.ك.`
      );
    }

    return {
      isValid: errors.length === 0,
      totalDebit,
      totalCredit,
      difference: diff,
      errors,
      normalizedLines,
    };
  }

  // ==========================================================================
  // 1. عمليات العملاء (CUSTOMERS)
  // ==========================================================================
  public static async executeCustomerUpdate(id: string, data: Partial<Customer>): Promise<Customer | null> {
    try {
      const updated = await DataService.updateCustomer(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('CUSTOMER', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeCustomerUpdate failed:', err);
      throw err;
    }
  }

  public static async executeCustomerCreate(data: Partial<Customer>, explicitCompanyId?: string): Promise<Customer> {
    try {
      const activeCompanyId = explicitCompanyId || (data as any)?.companyId || (data as any)?.company_id;
      const created = await DataService.createCustomer({
        ...data,
        companyId: activeCompanyId,
        company_id: activeCompanyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, activeCompanyId);
      this.notifyChange('CUSTOMER', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeCustomerCreate failed:', err);
      throw err;
    }
  }

  public static async executeCustomerDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteCustomer(id);
      this.notifyChange('CUSTOMER', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeCustomerDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 2. عمليات الموردين (SUPPLIERS)
  // ==========================================================================
  public static async executeSupplierUpdate(id: string, data: Partial<Supplier>): Promise<Supplier | null> {
    try {
      const updated = await DataService.updateSupplier(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('SUPPLIER', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeSupplierUpdate failed:', err);
      throw err;
    }
  }

  public static async executeSupplierCreate(data: Partial<Supplier>): Promise<Supplier> {
    try {
      const created = await DataService.createSupplier({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.notifyChange('SUPPLIER', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeSupplierCreate failed:', err);
      throw err;
    }
  }

  public static async executeSupplierDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteSupplier(id);
      this.notifyChange('SUPPLIER', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeSupplierDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 3. عمليات الفواتير والترحيل (INVOICES & POSTING)
  // ==========================================================================
  public static async executeInvoiceUpdate(id: string, data: any): Promise<Invoice | null> {
    try {
      const updated = await DataService.updateInvoice(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('INVOICE', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInvoiceUpdate failed:', err);
      throw err;
    }
  }

  public static async executeInvoiceCreate(data: any): Promise<Invoice> {
    try {
      const created = await DataService.createInvoice({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.notifyChange('INVOICE', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInvoiceCreate failed:', err);
      throw err;
    }
  }

  /**
   * ترحيل الفاتورة مع ضمان إنتاج وتوازن القيد المحاسبي المزدوج وربط أعمدة المصدر
   */
  public static async executeInvoicePost(id: string): Promise<boolean> {
    try {
      const invoices = localDataStore.getInvoices();
      const inv = invoices.find((i) => i.id === id);
      if (!inv) {
        throw new Error(`تعذر ترحيل الفاتورة: المعرف (${id}) غير موجود في النظام.`);
      }

      if (inv.status === 'CANCELLED') {
        throw new Error(`لا يمكن ترحيل الفاتورة (${inv.invoiceNumber}): الفاتورة ملغاة مسبقاً.`);
      }

      // تسوية الدورة المستندية لتوليد أو ربط القيد المحاسبي
      DataService.reconcileDocumentCycles();

      // جلب القيد المرتبط بالفاتورة والتحقق الصارم من توازنه
      const journals = localDataStore.getJournals();
      const isSales = inv.type === 'SALES' || inv.type === 'SALES_RETURN';
      const expectedModule = isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE';

      let linkedJournal = journals.find(
        (j) =>
          j.id === inv.journalEntryId ||
          j.sourceId === inv.id ||
          (j as any).source_id === inv.id ||
          j.reference === inv.invoiceNumber
      );

      if (linkedJournal) {
        const validation = await this.validateDoubleEntry(linkedJournal);
        if (!validation.isValid) {
          throw new Error(
            `[فحص ترحيل الفاتورة ${inv.invoiceNumber}]: القيد المحاسبي المرتبط بالفاتورة غير متوازن:\n${validation.errors.join('\n')}`
          );
        }

        // تحديث وتثبيت الأعمدة الجديدة source_module و source_id
        linkedJournal.sourceModule = expectedModule as any;
        linkedJournal.sourceId = inv.id;
        (linkedJournal as any).source_module = expectedModule;
        (linkedJournal as any).source_id = inv.id;
        linkedJournal.status = 'POSTED';
        linkedJournal.postedAt = new Date().toISOString();
        localDataStore.saveJournals(journals);
      }

      const result = await DataService.postInvoice(id);
      await this.syncAndReconcile();
      this.notifyChange('INVOICE', 'POST', id);
      return !!result;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInvoicePost failed:', err);
      throw err;
    }
  }

  public static async executeInvoiceCancel(id: string, reason?: string): Promise<boolean> {
    try {
      const result = await DataService.cancelInvoice(id, reason);
      this.notifyChange('INVOICE', 'CANCEL', id);
      return !!result;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInvoiceCancel failed:', err);
      throw err;
    }
  }

  public static async executeInvoiceDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteInvoice(id);
      this.notifyChange('INVOICE', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInvoiceDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 4. عمليات سندات القبض والصرف (VOUCHERS)
  // ==========================================================================
  public static async executeVoucherUpdate(id: string, data: any): Promise<PaymentVoucher | null> {
    try {
      const updated = await DataService.updateVoucher(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('VOUCHER', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherUpdate failed:', err);
      throw err;
    }
  }

  /**
   * إنشاء سند قبض أو صرف مع التأكد من القيد المزدوج وأعمدة المصدر
   */
  public static async executeVoucherCreate(data: any): Promise<PaymentVoucher> {
    try {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) {
        throw new Error('لا يمكن إصدار السند: يجب أن يكون مبلغ السند أكبر من الصفر.');
      }

      const isReceipt = data.type === 'RECEIPT';
      const defaultSourceModule = isReceipt ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER';

      const created = await DataService.createVoucher({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // التحقق من تعيين source_module و source_id على القيد المتولد للسند
      if (created && created.journalEntryId) {
        const journals = localDataStore.getJournals();
        const jEntry = journals.find((j) => j.id === created.journalEntryId);
        if (jEntry) {
          jEntry.sourceModule = defaultSourceModule as any;
          jEntry.sourceId = created.id;
          (jEntry as any).source_module = defaultSourceModule;
          (jEntry as any).source_id = created.id;
          localDataStore.saveJournals(journals);
        }
      }

      this.notifyChange('VOUCHER', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherCreate failed:', err);
      throw err;
    }
  }

  /**
   * ترحيل سند قبض أو صرف والتأكد من توازن قيده المحاسبي
   */
  public static async executeVoucherPost(id: string): Promise<boolean> {
    try {
      const vouchers = localDataStore.getVouchers();
      const voucher = vouchers.find((v) => v.id === id);
      if (!voucher) {
        throw new Error(`السند ذو الرقم المعرف (${id}) غير موجود.`);
      }

      const journals = localDataStore.getJournals();
      const isReceipt = voucher.type === 'RECEIPT';
      const expectedModule = isReceipt ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER';

      const linkedJournal = journals.find(
        (j) => j.id === voucher.journalEntryId || j.sourceId === voucher.id || j.reference === voucher.voucherNumber
      );

      if (linkedJournal) {
        const validation = await this.validateDoubleEntry(linkedJournal);
        if (!validation.isValid) {
          throw new Error(
            `[فحص ترحيل السند ${voucher.voucherNumber}]: القيد غير متوازن:\n${validation.errors.join('\n')}`
          );
        }
        linkedJournal.status = 'POSTED';
        linkedJournal.postedAt = new Date().toISOString();
        linkedJournal.sourceModule = expectedModule as any;
        linkedJournal.sourceId = voucher.id;
        (linkedJournal as any).source_module = expectedModule;
        (linkedJournal as any).source_id = voucher.id;
        localDataStore.saveJournals(journals);
      }

      await this.syncAndReconcile();
      this.notifyChange('VOUCHER', 'POST', id);
      return true;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherPost failed:', err);
      throw err;
    }
  }

  public static async executeVoucherCancel(id: string, reason: string): Promise<boolean> {
    try {
      const result = await DataService.cancelVoucher(id, reason);
      this.notifyChange('VOUCHER', 'CANCEL', id);
      return !!result;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherCancel failed:', err);
      throw err;
    }
  }

  public static async executeVoucherDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteVoucher(id);
      this.notifyChange('VOUCHER', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 5. عمليات المخزون والأصناف (INVENTORY)
  // ==========================================================================
  public static async executeInventoryUpdate(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | null> {
    try {
      const updated = await DataService.updateInventoryItem(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('INVENTORY', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInventoryUpdate failed:', err);
      throw err;
    }
  }

  public static async executeInventoryCreate(data: Partial<InventoryItem>, explicitCompanyId?: string): Promise<InventoryItem> {
    try {
      const activeCompanyId = explicitCompanyId || (data as any)?.companyId || (data as any)?.company_id;
      const created = await DataService.createInventoryItem({
        ...data,
        companyId: activeCompanyId,
        company_id: activeCompanyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, activeCompanyId);
      this.notifyChange('INVENTORY', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInventoryCreate failed:', err);
      throw err;
    }
  }

  public static async executeInventoryDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteInventoryItem(id);
      this.notifyChange('INVENTORY', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeInventoryDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 6. عمليات القيود اليومية والقيد المزدوج (JOURNALS & DOUBLE-ENTRY)
  // ==========================================================================
  public static async executeJournalUpdate(id: string, data: Partial<JournalEntry>): Promise<JournalEntry | null> {
    try {
      let normalizedLines = data.lines;
      let totalDebit = data.totalDebit;
      let totalCredit = data.totalCredit;

      // إذا تضمن التعديل أسطر القيد، نقوم بالتحقق الصارم من التوازن قبل الحفظ
      if (data.lines && data.lines.length > 0) {
        const validation = await this.validateDoubleEntry(data);
        if (!validation.isValid) {
          throw new Error(`[فشل تعديل القيد المحاسبي]:\n${validation.errors.join('\n')}`);
        }
        normalizedLines = validation.normalizedLines;
        totalDebit = validation.totalDebit;
        totalCredit = validation.totalCredit;
      }

      // ضبط الأعمدة الجديدة
      const sourceAttrs = this.normalizeSourceAttributes(data, undefined, data.reference);

      const payload: Partial<JournalEntry> = {
        ...data,
        ...sourceAttrs,
        ...(normalizedLines ? { lines: normalizedLines, totalDebit, totalCredit } : {}),
        updatedAt: new Date().toISOString(),
      };

      const updated = await DataService.updateJournal(id, payload);
      if (updated) {
        this.notifyChange('JOURNAL', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalUpdate failed:', err);
      throw err;
    }
  }

  /**
   * إنشاء قيد يومية مع فحص توازن القيد المزدوج وتعيين أعمدة المصدر
   */
  public static async executeJournalCreate(data: Partial<JournalEntry>): Promise<JournalEntry> {
    try {
      // 1. الفحص الصارم لتوازن القيد المحاسبي المزدوج قبل أي عملية حفظ
      const validation = await this.validateDoubleEntry(data);
      if (!validation.isValid) {
        throw new Error(`[فشل التحقق من توازن القيد المحاسبي]:\n${validation.errors.join('\n')}`);
      }

      // 2. تطبيع الأعمدة الجديدة (source_module و source_id)
      const sourceAttrs = this.normalizeSourceAttributes(data, 'MANUAL_JOURNAL', data.reference);

      const payload: Partial<JournalEntry> = {
        ...data,
        ...sourceAttrs,
        lines: validation.normalizedLines || data.lines,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        status: data.status || 'POSTED',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await DataService.createJournal(payload);
      this.notifyChange('JOURNAL', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalCreate failed:', err);
      throw err;
    }
  }

  /**
   * ترحيل واعتماد قيد يومية (POSTING) مع التحقق النهائي من التوازن
   */
  public static async executeJournalPost(id: string): Promise<JournalEntry | null> {
    try {
      const journals = isSupabaseConfigured
        ? await DataService.getJournals()
        : localDataStore.getJournals();

      const target = journals.find((j) => j.id === id || j.entryNumber === id);
      if (!target) {
        throw new Error(`تعذر ترحيل القيد: القيد ذو المعرف (${id}) غير موجود.`);
      }

      // التحقق الصارم من توازن القيد قبل اعتماده وترحيله
      const validation = await this.validateDoubleEntry(target);
      if (!validation.isValid) {
        throw new Error(`[فشل ترحيل القيد ${target.entryNumber}]: القيد غير متوازن:\n${validation.errors.join('\n')}`);
      }

      const sourceAttrs = this.normalizeSourceAttributes(target, 'MANUAL_JOURNAL', target.reference);

      const posted = await DataService.updateJournal(target.id, {
        status: 'POSTED',
        postedAt: new Date().toISOString(),
        ...sourceAttrs,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        updatedAt: new Date().toISOString(),
      });

      if (posted) {
        this.notifyChange('JOURNAL', 'POST', target.id, posted);
      }
      return posted;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalPost failed:', err);
      throw err;
    }
  }

  public static async executeJournalReverse(id: string, reason: string): Promise<JournalEntry | null> {
    try {
      const reversed = await DataService.reverseJournal(id, reason);
      if (reversed) {
        const sourceAttrs = this.normalizeSourceAttributes(
          { sourceModule: 'INVOICE_REVERSAL', sourceId: id },
          'INVOICE_REVERSAL',
          id
        );
        Object.assign(reversed, sourceAttrs);
        this.notifyChange('JOURNAL', 'REVERSE', id, reversed);
      }
      return reversed;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalReverse failed:', err);
      throw err;
    }
  }

  public static async executeJournalDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteJournal(id);
      this.notifyChange('JOURNAL', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 7. عمليات الحسابات (ACCOUNTS)
  // ==========================================================================
  public static async executeAccountUpdate(id: string, data: Partial<Account>): Promise<Account | null> {
    try {
      const updated = await DataService.updateAccount(id, data);
      if (updated) {
        this.notifyChange('ACCOUNT', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeAccountUpdate failed:', err);
      throw err;
    }
  }

  public static async executeAccountCreate(data: Partial<Account>): Promise<Account> {
    try {
      const created = await DataService.createAccount(data);
      this.notifyChange('ACCOUNT', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeAccountCreate failed:', err);
      throw err;
    }
  }

  public static async executeAccountDelete(id: string): Promise<boolean> {
    try {
      const success = await DataService.deleteAccount(id);
      this.notifyChange('ACCOUNT', 'DELETE', id);
      return success;
    } catch (err: any) {
      console.error('[OperationsCenter] executeAccountDelete failed:', err);
      throw err;
    }
  }

  // ==========================================================================
  // 8. الترحيل الجماعي والمزامنة الشاملة (BATCH POSTING & RECONCILIATION)
  // ==========================================================================
  public static async executeBatchPost(
    entityType: 'INVOICE' | 'VOUCHER' | 'JOURNAL',
    ids: string[]
  ): Promise<{ postedCount: number; errors: { id: string; error: string }[] }> {
    let postedCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        if (entityType === 'INVOICE') {
          await this.executeInvoicePost(id);
          postedCount++;
        } else if (entityType === 'VOUCHER') {
          await this.executeVoucherPost(id);
          postedCount++;
        } else if (entityType === 'JOURNAL') {
          await this.executeJournalPost(id);
          postedCount++;
        }
      } catch (err: any) {
        errors.push({ id, error: err?.message || 'خطأ غير معروف أثناء الترحيل' });
      }
    }

    return { postedCount, errors };
  }

  /**
   * مزامنة وحفظ فورية وضمان تماسك كامل الدورة المستندية
   */
  public static async syncAndReconcile(): Promise<void> {
    await DataService.reconcileDocumentCycles();
    DataService.syncAccountBalances();
  }
}
