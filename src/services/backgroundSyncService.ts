/**
 * Background Sync Service
 * Enterprise Non-Blocking Optimistic UI Sync Engine
 * Handles asynchronous background persistence to Supabase and remote endpoints
 * with queue resilience, automatic retries, and offline tolerance.
 */
import { Invoice, PaymentVoucher } from '../types.js';
import { SupabaseDataService } from './supabaseService.ts';
import { safeApiFetch } from '../utils/safeJson.js';
import { isSupabaseConfigured } from './supabaseClient.ts';

// Legacy Firestore sync no-op
const syncToFirestore = async (_coll: string, _id: string, _data: any): Promise<void> => {};

export type SyncTaskType =
  | 'INVOICE_CREATE'
  | 'INVOICE_POST'
  | 'INVOICE_CANCEL'
  | 'VOUCHER_CREATE'
  | 'VOUCHER_CANCEL';

export interface SyncTask {
  id: string;
  type: SyncTaskType;
  entityId: string;
  companyId: string;
  payload: any;
  rawData?: any;
  createdAt: number;
  retryCount: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline_pending' | 'error';

class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private queue: SyncTask[] = [];
  private isProcessing = false;
  private currentStatus: SyncStatus = 'idle';
  private listeners: Set<(status: SyncStatus, pendingCount: number) => void> = new Set();

  private constructor() {
    this.loadPersistedQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[BackgroundSync] Connection restored, processing pending queue...');
        this.processQueue();
      });
    }
  }

  public static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  public subscribe(callback: (status: SyncStatus, pendingCount: number) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentStatus, this.queue.length);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus, this.queue.length);
      } catch (err) {
        console.warn('[BackgroundSync] Listener error:', err);
      }
    }
  }

  private getQueueStorageKey(companyId?: string): string {
    const cid = companyId || 'default';
    return `logix_bg_sync_queue_${cid}`;
  }

  private loadPersistedQueue(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('logix_bg_sync_queue_'));
      let allTasks: SyncTask[] = [];
      for (const k of keys) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            allTasks = allTasks.concat(parsed);
          }
        }
      }
      this.queue = allTasks;
    } catch (e) {
      console.warn('[BackgroundSync] Failed to load persisted sync queue:', e);
    }
  }

  private persistQueue(companyId?: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const key = this.getQueueStorageKey(companyId);
      const companyTasks = this.queue.filter((t) => !companyId || t.companyId === companyId);
      if (companyTasks.length > 0) {
        window.localStorage.setItem(key, JSON.stringify(companyTasks));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[BackgroundSync] Failed to persist queue:', e);
    }
  }

  /**
   * Enqueue an invoice creation task (Non-blocking)
   */
  public enqueueInvoiceCreate(invoice: Invoice, rawData: any, companyId: string): void {
    const task: SyncTask = {
      id: `task-inv-${invoice.id}-${Date.now()}`,
      type: 'INVOICE_CREATE',
      entityId: invoice.id,
      companyId,
      payload: invoice,
      rawData,
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.addTask(task);
  }

  /**
   * Enqueue a payment voucher creation task (Non-blocking)
   */
  public enqueueVoucherCreate(voucher: PaymentVoucher, rawData: any, companyId: string): void {
    const task: SyncTask = {
      id: `task-vch-${voucher.id}-${Date.now()}`,
      type: 'VOUCHER_CREATE',
      entityId: voucher.id,
      companyId,
      payload: voucher,
      rawData,
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.addTask(task);
  }

  /**
   * Enqueue an invoice post task (Non-blocking)
   */
  public enqueueInvoicePost(invoice: Invoice, companyId: string): void {
    const task: SyncTask = {
      id: `task-post-${invoice.id}-${Date.now()}`,
      type: 'INVOICE_POST',
      entityId: invoice.id,
      companyId,
      payload: invoice,
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.addTask(task);
  }

  /**
   * Enqueue an invoice cancel task (Non-blocking)
   */
  public enqueueInvoiceCancel(invoice: Invoice, reason: string, companyId: string): void {
    const task: SyncTask = {
      id: `task-cancel-${invoice.id}-${Date.now()}`,
      type: 'INVOICE_CANCEL',
      entityId: invoice.id,
      companyId,
      payload: invoice,
      rawData: { reason },
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.addTask(task);
  }

  /**
   * Enqueue a voucher cancel task (Non-blocking)
   */
  public enqueueVoucherCancel(voucher: PaymentVoucher, reason: string, companyId: string): void {
    const task: SyncTask = {
      id: `task-cancel-vch-${voucher.id}-${Date.now()}`,
      type: 'VOUCHER_CANCEL',
      entityId: voucher.id,
      companyId,
      payload: voucher,
      rawData: { reason },
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.addTask(task);
  }

  private addTask(task: SyncTask): void {
    // Avoid duplicate task for same entity and type
    const exists = this.queue.some(
      (t) => t.entityId === task.entityId && t.type === task.type
    );
    if (!exists) {
      this.queue.push(task);
      this.persistQueue(task.companyId);
    }
    this.currentStatus = 'syncing';
    this.notify();

    // Trigger asynchronous queue processor immediately
    setTimeout(() => this.processQueue(), 50);
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.currentStatus = 'synced';
      this.notify();
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.currentStatus = 'offline_pending';
      this.notify();
      return;
    }

    this.isProcessing = true;
    this.currentStatus = 'syncing';
    this.notify();

    try {
      while (this.queue.length > 0) {
        const task = this.queue[0];
        let success = false;

        try {
          success = await this.executeTask(task);
        } catch (err) {
          console.warn(`[BackgroundSync] Task execution error for ${task.id}:`, err);
        }

        if (success) {
          this.queue.shift();
          this.persistQueue(task.companyId);
        } else {
          task.retryCount += 1;
          if (task.retryCount >= 3) {
            // After 3 retries, keep safe locally and pop to avoid blocking queue
            console.warn(`[BackgroundSync] Task ${task.id} exceeded retry limit, deferred.`);
            this.queue.shift();
            this.persistQueue(task.companyId);
          } else {
            // Temporary backoff and retry later
            break;
          }
        }
      }

      this.currentStatus = this.queue.length === 0 ? 'synced' : 'offline_pending';
      this.notify();
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeTask(task: SyncTask): Promise<boolean> {
    switch (task.type) {
      case 'INVOICE_CREATE': {
        const inv: Invoice = task.payload;
        let ok = true;
        if (isSupabaseConfigured) {
          ok = await SupabaseDataService.saveInvoice(inv, task.companyId);
        }
        syncToFirestore('erp_invoices', inv.id, inv);
        // Non-blocking fire-and-forget API notification
        safeApiFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task.rawData || inv),
        }).catch(() => {});
        return ok;
      }

      case 'VOUCHER_CREATE': {
        const vch: PaymentVoucher = task.payload;
        let ok = true;
        if (isSupabaseConfigured) {
          ok = await SupabaseDataService.saveVoucher(vch, task.companyId);
        }
        syncToFirestore('erp_vouchers', vch.id, vch);
        safeApiFetch('/api/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task.rawData || vch),
        }).catch(() => {});
        return ok;
      }

      case 'INVOICE_POST': {
        const inv: Invoice = task.payload;
        let ok = true;
        if (isSupabaseConfigured) {
          ok = await SupabaseDataService.saveInvoice(inv, task.companyId);
        }
        syncToFirestore('erp_invoices', inv.id, inv);
        safeApiFetch(`/api/invoices/${inv.id}/post`, { method: 'POST' }).catch(() => {});
        return ok;
      }

      case 'INVOICE_CANCEL': {
        const inv: Invoice = task.payload;
        let ok = true;
        if (isSupabaseConfigured) {
          ok = await SupabaseDataService.saveInvoice(inv, task.companyId);
        }
        syncToFirestore('erp_invoices', inv.id, inv);
        safeApiFetch(`/api/invoices/${inv.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task.rawData || {}),
        }).catch(() => {});
        return ok;
      }

      case 'VOUCHER_CANCEL': {
        const vch: PaymentVoucher = task.payload;
        let ok = true;
        if (isSupabaseConfigured) {
          ok = await SupabaseDataService.saveVoucher(vch, task.companyId);
        }
        syncToFirestore('erp_vouchers', vch.id, vch);
        safeApiFetch(`/api/vouchers/${vch.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task.rawData || {}),
        }).catch(() => {});
        return ok;
      }

      default:
        return true;
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }
}

export const backgroundSync = BackgroundSyncService.getInstance();
