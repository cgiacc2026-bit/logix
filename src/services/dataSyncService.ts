import { supabase, getCurrentCompanyId, resolveToSupabaseCompanyUUID } from './supabaseClient';

export class DataSyncService {
  private static activeChannels: any = null;
  private static debounceTimers: Record<string, any> = {};

  /**
   * Initializes real-time listeners for Supabase to sync data automatically
   * across multiple devices for the active company without reloading.
   * Tables: invoices, invoice_items, payment_vouchers, items, chart_of_accounts,
   * journal_entries, customers, suppliers, company_accounting_settings.
   */
  public static startRealtimeSync(onUpdate: (table: string) => void) {
    if (!supabase) return;
    const rawCompanyId = getCurrentCompanyId();
    if (!rawCompanyId) return;
    const companyId = resolveToSupabaseCompanyUUID(rawCompanyId) || rawCompanyId;

    // Remove previous channel if exists
    this.stopRealtimeSync();

    const debouncedNotify = (table: string) => {
      if (this.debounceTimers[table]) {
        clearTimeout(this.debounceTimers[table]);
      }
      this.debounceTimers[table] = setTimeout(() => {
        onUpdate(table);
      }, 300);
    };

    try {
      this.activeChannels = supabase.channel(`sync-company-${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('invoices');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('invoices');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_vouchers', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('payment_vouchers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('items');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chart_of_accounts', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('chart_of_accounts');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('journal_entries');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('customers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('suppliers');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_accounting_settings', filter: `company_id=eq.${companyId}` }, () => {
          debouncedNotify('company_accounting_settings');
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
    Object.values(this.debounceTimers).forEach((t) => clearTimeout(t));
    this.debounceTimers = {};
  }
}
