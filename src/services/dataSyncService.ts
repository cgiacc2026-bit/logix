import { supabase, getCurrentCompanyId, resolveToSupabaseCompanyUUID } from './supabaseClient';

export class DataSyncService {
  private static activeChannels: any = null;
  private static globalDebounceTimer: any = null;
  private static pendingTables: Set<string> = new Set();

  /**
   * Initializes real-time listeners for Supabase to sync data automatically
   * across multiple devices for the active company without reloading.
   * Uses unified 3000ms batch debouncing to avoid API storming and excessive bandwidth egress.
   */
  public static startRealtimeSync(onUpdate: (table: string) => void) {
    if (!supabase) return;
    const rawCompanyId = getCurrentCompanyId();
    if (!rawCompanyId) return;
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId) || rawCompanyId;

    // Remove previous channel if exists
    this.stopRealtimeSync();

    const batchedNotify = (table: string) => {
      this.pendingTables.add(table);
      if (this.globalDebounceTimer) {
        clearTimeout(this.globalDebounceTimer);
      }
      this.globalDebounceTimer = setTimeout(() => {
        const tables = Array.from(this.pendingTables);
        this.pendingTables.clear();
        this.globalDebounceTimer = null;
        if (tables.length > 0) {
          // Notify once with primary table or all
          onUpdate(tables[0]);
        }
      }, 3000); // 3 seconds calm batch window
    };

    try {
      this.activeChannels = supabase.channel(`sync-company-${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('invoices');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('invoices');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_vouchers', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('payment_vouchers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('items');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chart_of_accounts', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('chart_of_accounts');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('journal_entries');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('customers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('suppliers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_accounting_settings', filter: `company_id=eq.${companyId}` }, () => {
          batchedNotify('company_accounting_settings');
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[DataSyncService] Realtime WebSocket connected for company:', companyId);
          }
        });
    } catch (e: any) {
      console.warn('[DataSyncService] Failed to establish realtime channel:', e?.message);
    }
  }

  public static stopRealtimeSync() {
    if (this.activeChannels) {
      try {
        supabase.removeChannel(this.activeChannels);
      } catch {}
      this.activeChannels = null;
    }
    if (this.globalDebounceTimer) {
      clearTimeout(this.globalDebounceTimer);
      this.globalDebounceTimer = null;
    }
    this.pendingTables.clear();
  }
}
