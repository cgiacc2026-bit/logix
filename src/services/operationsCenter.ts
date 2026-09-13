/**
 * مركز العمليات الموحد (Unified Operations Center)
 * المحرك المركزي الموحد لتنفيذ كافة عمليات التعديل، الإضافة، الإلغاء، والحذف
 * يضمن التنفيذ الذري (Atomic Execution)، التسوية المحاسبية الفورية، ومنع التضارب نهائياً
 */

import { DataService, localDataStore } from './dataService.ts';
import { SupabaseDataService } from './supabaseService.ts';
import { isSupabaseConfigured } from './supabaseClient.js';
import type {
  Customer,
  Supplier,
  Invoice,
  PaymentVoucher,
  InventoryItem,
  JournalEntry,
  Account,
} from '../types.js';

export interface MutationResult<T> {
  success: boolean;
  entity: T | null;
  message?: string;
  error?: string;
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
  // 3. عمليات الفواتير (INVOICES)
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

  public static async executeInvoicePost(id: string): Promise<boolean> {
    try {
      const result = await DataService.postInvoice(id);
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

  public static async executeVoucherCreate(data: any): Promise<PaymentVoucher> {
    try {
      const created = await DataService.createVoucher({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.notifyChange('VOUCHER', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeVoucherCreate failed:', err);
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
  // 6. عمليات القيود اليومية (JOURNALS)
  // ==========================================================================
  public static async executeJournalUpdate(id: string, data: Partial<JournalEntry>): Promise<JournalEntry | null> {
    try {
      const updated = await DataService.updateJournal(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      if (updated) {
        this.notifyChange('JOURNAL', 'UPDATE', id, updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalUpdate failed:', err);
      throw err;
    }
  }

  public static async executeJournalCreate(data: Partial<JournalEntry>): Promise<JournalEntry> {
    try {
      const created = await DataService.createJournal({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.notifyChange('JOURNAL', 'CREATE', created.id, created);
      return created;
    } catch (err: any) {
      console.error('[OperationsCenter] executeJournalCreate failed:', err);
      throw err;
    }
  }

  public static async executeJournalReverse(id: string, reason: string): Promise<JournalEntry | null> {
    try {
      const reversed = await DataService.reverseJournal(id, reason);
      if (reversed) {
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

  /**
   * مزامنة وحفظ فورية وضمان تماسك كامل الدورة المستندية
   */
  public static async syncAndReconcile(): Promise<void> {
    await DataService.reconcileDocumentCycles();
    DataService.syncAccountBalances();
  }
}
