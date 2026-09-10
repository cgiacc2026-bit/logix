import { supabase, getCurrentCompanyId } from './supabaseClient';
import { DataService } from './dataService';

export class DataSyncService {
  private static activeChannels: any = null;

  /**
   * Initializes real-time listeners for Supabase to sync data automatically
   * across multiple devices for the same company without reloading.
   */
  public static startRealtimeSync(onUpdate: (table: string) => void) {
    if (!supabase) return;
    const companyId = getCurrentCompanyId();
    if (!companyId) return;

    // Remove previous channel if exists
    this.stopRealtimeSync();

    this.activeChannels = supabase.channel(`sync-company-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('items');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('invoices');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_vouchers', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('vouchers');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('journals');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('customers');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: `company_id=eq.${companyId}` }, () => {
        onUpdate('suppliers');
      })
      .subscribe();
      
    console.log('[DataSyncService] Realtime sync started for company:', companyId);
  }

  public static stopRealtimeSync() {
    if (this.activeChannels) {
      supabase.removeChannel(this.activeChannels);
      this.activeChannels = null;
    }
  }
}
