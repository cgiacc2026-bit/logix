import { AuditLog, AuditLogAction, AuditLogEntityType } from '../types.js';
import { localDataStore } from './dataService.js';
import { getCurrentCompanyId } from './supabaseClient.js';

const AUDIT_STORAGE_KEY = 'logix_audit_logs';

class AuditLogService {
  private inMemoryLogs: AuditLog[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
        if (raw) {
          this.inMemoryLogs = JSON.parse(raw);
        }
      }
    } catch (err) {
      console.warn('Failed to load audit logs from localStorage:', err);
    }
  }

  private persist() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.inMemoryLogs.slice(0, 1000)));
      }
    } catch (err) {
      console.warn('Failed to persist audit logs:', err);
    }
  }

  /**
   * Non-destructive: Append an immutable audit event
   */
  public logAction(entry: {
    company_id?: string;
    branch_id?: string;
    user_id?: string;
    user_name?: string;
    action: AuditLogAction;
    entity_type: AuditLogEntityType;
    entity_id: string;
    entity_reference?: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    reason?: string;
    authorized_by?: string;
    ip_address?: string;
  }): AuditLog {
    const effectiveCompanyId =
      entry.company_id ||
      getCurrentCompanyId() ||
      localDataStore.getEffectiveCompanyId() ||
      'company-default-001';

    const newLog: AuditLog = {
      id: 'audit-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6),
      company_id: effectiveCompanyId,
      branch_id: entry.branch_id || 'branch-main-01',
      user_id: entry.user_id || 'usr-current',
      user_name: entry.user_name || 'كاشير / مستخدم النظام',
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      entity_reference: entry.entity_reference || '',
      old_values: entry.old_values,
      new_values: entry.new_values,
      reason: entry.reason || 'إجراء معتمد بالنظام',
      authorized_by: entry.authorized_by,
      ip_address: entry.ip_address || '127.0.0.1 (Local App)',
      created_at: new Date().toISOString(),
    };

    this.inMemoryLogs.unshift(newLog);
    this.persist();

    // Broadcast log event for live monitoring if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('logix-audit-logged', { detail: newLog }));
    }

    return newLog;
  }

  /**
   * Retrieve audit logs filtered by company, branch, and entity
   */
  public getLogs(filter?: {
    company_id?: string;
    branch_id?: string;
    action?: AuditLogAction;
    entity_type?: AuditLogEntityType;
    entity_id?: string;
    limit?: number;
  }): AuditLog[] {
    let result = [...this.inMemoryLogs];

    if (filter?.company_id) {
      result = result.filter((l) => l.company_id === filter.company_id);
    }
    if (filter?.branch_id && filter.branch_id !== 'ALL') {
      result = result.filter((l) => l.branch_id === filter.branch_id);
    }
    if (filter?.action) {
      result = result.filter((l) => l.action === filter.action);
    }
    if (filter?.entity_type) {
      result = result.filter((l) => l.entity_type === filter.entity_type);
    }
    if (filter?.entity_id) {
      result = result.filter((l) => l.entity_id === filter.entity_id);
    }

    return result.slice(0, filter?.limit || 200);
  }

  /**
   * Supervisor PIN Verification (for sensitive actions like credit override, voids, large discounts)
   */
  public verifySupervisorPin(
    pin: string,
    actionDesc: string = 'إجراء تدقيق'
  ): { success: boolean; supervisorName?: string; error?: string } {
    const cleanPin = String(pin).trim();
    if (!cleanPin) {
      return { success: false, error: 'الرجاء إدخال رمز PIN المشرف أو المدير' };
    }

    // Known supervisor PINs: Master '1234', Executive '9988', Admin '0000'
    const validSupervisors: Record<string, string> = {
      '1234': 'المدير العام (مشرف النظام)',
      '9988': 'المدير المالي والرقابة',
      '0000': 'مشرف الصالة ونقاط البيع',
      '2026': 'المشرف الرئيسي للمجموعة',
    };

    if (validSupervisors[cleanPin]) {
      const supervisorName = validSupervisors[cleanPin];
      return { success: true, supervisorName };
    }

    return { success: false, error: 'رمز PIN المشرف غير صحيح. يرجى مراجعة المسؤول المباشر' };
  }
}

export const auditLogService = new AuditLogService();
