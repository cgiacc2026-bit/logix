import {
  PosSession,
  CashRegisterTransaction,
  ParkedCart,
  ParkedCartItem,
  InventoryItem,
} from '../types.js';
import { auditLogService } from './auditLogService.js';
import { getCurrentCompanyId } from './supabaseClient.js';
import { localDataStore } from './dataService.js';

const POS_SESSION_STORAGE_KEY = 'logix_pos_active_session';
const POS_SESSIONS_HISTORY_KEY = 'logix_pos_sessions_history';
const CASH_TX_STORAGE_KEY = 'logix_cash_register_txs';
const PARKED_CARTS_STORAGE_KEY = 'logix_pos_parked_carts';

class PosSessionService {
  private activeSession: PosSession | null = null;
  private sessionsHistory: PosSession[] = [];
  private cashTransactions: CashRegisterTransaction[] = [];
  private parkedCarts: ParkedCart[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined') {
        const activeRaw = localStorage.getItem(POS_SESSION_STORAGE_KEY);
        if (activeRaw) {
          this.activeSession = JSON.parse(activeRaw);
        }

        const histRaw = localStorage.getItem(POS_SESSIONS_HISTORY_KEY);
        if (histRaw) {
          this.sessionsHistory = JSON.parse(histRaw);
        }

        const txRaw = localStorage.getItem(CASH_TX_STORAGE_KEY);
        if (txRaw) {
          this.cashTransactions = JSON.parse(txRaw);
        }

        const parkedRaw = localStorage.getItem(PARKED_CARTS_STORAGE_KEY);
        if (parkedRaw) {
          this.parkedCarts = JSON.parse(parkedRaw);
        }
      }
    } catch (e) {
      console.warn('Error loading pos sessions:', e);
    }
  }

  private persistActive() {
    try {
      if (typeof window !== 'undefined') {
        if (this.activeSession) {
          localStorage.setItem(POS_SESSION_STORAGE_KEY, JSON.stringify(this.activeSession));
        } else {
          localStorage.removeItem(POS_SESSION_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to persist active session:', e);
    }
  }

  private persistHistory() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(POS_SESSIONS_HISTORY_KEY, JSON.stringify(this.sessionsHistory.slice(0, 100)));
        localStorage.setItem(CASH_TX_STORAGE_KEY, JSON.stringify(this.cashTransactions.slice(0, 300)));
      }
    } catch (e) {
      console.warn('Failed to persist session history:', e);
    }
  }

  private persistParkedCarts() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PARKED_CARTS_STORAGE_KEY, JSON.stringify(this.parkedCarts));
      }
    } catch (e) {
      console.warn('Failed to persist parked carts:', e);
    }
  }

  public getActiveSession(): PosSession | null {
    return this.activeSession;
  }

  public openSession(params: {
    opening_cash: number;
    user_id?: string;
    user_name?: string;
    branch_id?: string;
    company_id?: string;
    notes?: string;
  }): PosSession {
    const compId =
      params.company_id ||
      getCurrentCompanyId() ||
      localDataStore.getEffectiveCompanyId() ||
      'default';

    const sessionNum = `POS-SESS-${Date.now().toString().slice(-6)}`;
    const session: PosSession = {
      id: 'sess-' + Date.now().toString(36),
      company_id: compId,
      branch_id: params.branch_id || 'branch-main-01',
      user_id: params.user_id || 'usr-cashier',
      user_name: params.user_name || 'كاشير الصالة الرئيسي',
      session_number: sessionNum,
      opened_at: new Date().toISOString(),
      opening_cash: Number(params.opening_cash) || 0,
      expected_cash: Number(params.opening_cash) || 0,
      status: 'OPEN',
      total_sales_cash: 0,
      total_sales_card: 0,
      total_sales_credit: 0,
      total_returns: 0,
      total_cash_in: 0,
      total_cash_out: 0,
      notes: params.notes || '',
      created_at: new Date().toISOString(),
    };

    this.activeSession = session;
    this.persistActive();

    // Audit Log opening
    auditLogService.logAction({
      company_id: compId,
      branch_id: session.branch_id,
      user_id: session.user_id,
      user_name: session.user_name,
      action: 'SESSION_OPEN',
      entity_type: 'POS_SESSION',
      entity_id: session.id,
      entity_reference: session.session_number,
      new_values: { opening_cash: session.opening_cash },
      reason: `فتح وردية كاشير برصيد افتتاحي: ${session.opening_cash.toFixed(3)} د.ك`,
    });

    return session;
  }

  public recordSale(paymentMethod: 'CASH' | 'CARD' | 'CREDIT', amount: number) {
    if (!this.activeSession || this.activeSession.status !== 'OPEN') return;

    if (paymentMethod === 'CASH') {
      this.activeSession.total_sales_cash += amount;
      this.activeSession.expected_cash += amount;
    } else if (paymentMethod === 'CARD') {
      this.activeSession.total_sales_card += amount;
    } else if (paymentMethod === 'CREDIT') {
      this.activeSession.total_sales_credit += amount;
    }

    this.persistActive();
  }

  public recordReturn(amount: number, isCashRefund: boolean = true) {
    if (!this.activeSession || this.activeSession.status !== 'OPEN') return;

    this.activeSession.total_returns += amount;
    if (isCashRefund) {
      this.activeSession.expected_cash = Math.max(0, this.activeSession.expected_cash - amount);
    }
    this.persistActive();
  }

  public recordCashRegisterTransaction(params: {
    type: 'CASH_IN' | 'CASH_OUT' | 'DROP';
    amount: number;
    reason: string;
    authorized_by?: string;
  }): CashRegisterTransaction {
    if (!this.activeSession) {
      throw new Error('لا توجد وردية كاشير مفتوحة حالياً');
    }

    const tx: CashRegisterTransaction = {
      id: 'tx-' + Date.now().toString(36),
      company_id: this.activeSession.company_id,
      branch_id: this.activeSession.branch_id,
      session_id: this.activeSession.id,
      type: params.type,
      amount: Number(params.amount) || 0,
      reason: params.reason,
      authorized_by: params.authorized_by,
      created_at: new Date().toISOString(),
    };

    if (params.type === 'CASH_IN') {
      this.activeSession.total_cash_in += tx.amount;
      this.activeSession.expected_cash += tx.amount;
    } else {
      // CASH_OUT or DROP
      this.activeSession.total_cash_out += tx.amount;
      this.activeSession.expected_cash = Math.max(0, this.activeSession.expected_cash - tx.amount);
    }

    this.cashTransactions.unshift(tx);
    this.persistActive();
    this.persistHistory();

    // Audit Log cash movement
    auditLogService.logAction({
      company_id: this.activeSession.company_id,
      branch_id: this.activeSession.branch_id,
      user_id: this.activeSession.user_id,
      user_name: this.activeSession.user_name,
      action: 'CASH_DRAWER_TRANSACTION',
      entity_type: 'POS_SESSION',
      entity_id: this.activeSession.id,
      entity_reference: this.activeSession.session_number,
      new_values: { type: tx.type, amount: tx.amount, reason: tx.reason },
      reason: `${params.type === 'CASH_IN' ? 'إيداع نقدي في الدرج' : 'سحب / توريد نقدي من الدرج'}: ${tx.amount.toFixed(3)} د.ك - ${tx.reason}`,
      authorized_by: params.authorized_by,
    });

    return tx;
  }

  public closeSession(params: {
    actual_cash: number;
    notes?: string;
    closed_by?: string;
  }): PosSession {
    if (!this.activeSession) {
      throw new Error('لا توجد وردية كاشير نشطة لإغلاقها');
    }

    const closedSession: PosSession = {
      ...this.activeSession,
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      actual_cash: Number(params.actual_cash) || 0,
      difference: (Number(params.actual_cash) || 0) - this.activeSession.expected_cash,
      notes: params.notes || this.activeSession.notes,
    };

    this.sessionsHistory.unshift(closedSession);
    this.activeSession = null;
    this.persistActive();
    this.persistHistory();

    // Audit Log close
    auditLogService.logAction({
      company_id: closedSession.company_id,
      branch_id: closedSession.branch_id,
      user_id: closedSession.user_id,
      user_name: closedSession.user_name,
      action: 'SESSION_CLOSE',
      entity_type: 'POS_SESSION',
      entity_id: closedSession.id,
      entity_reference: closedSession.session_number,
      new_values: {
        expected_cash: closedSession.expected_cash,
        actual_cash: closedSession.actual_cash,
        difference: closedSession.difference,
      },
      reason: `إغلاق وردية كاشير - الفارق النقدي: ${(closedSession.difference || 0).toFixed(3)} د.ك`,
    });

    return closedSession;
  }

  // ==========================================
  // PARKED / HOLD CARTS (تعليق واسترجاع الفواتير F9)
  // ==========================================

  public parkCart(params: {
    items: {
      item: InventoryItem;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
    }[];
    customerId?: string;
    customerName?: string;
    subtotal: number;
    notes?: string;
    branchId?: string;
  }): ParkedCart {
    const ticketNumber = `HOLD-${String(this.parkedCarts.length + 1).padStart(3, '0')}`;
    const parked: ParkedCart = {
      id: 'park-' + Date.now().toString(36),
      company_id: getCurrentCompanyId() || 'default',
      branch_id: params.branchId || 'branch-main-01',
      ticketNumber,
      customerId: params.customerId,
      customerName: params.customerName || 'عميل كاش نقدي',
      items: params.items.map((it) => ({
        itemId: it.item.id,
        itemSku: it.item.sku,
        barcode: it.item.barcode,
        itemNameAr: it.item.nameAr,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
        unit: it.item.unit,
        item: it.item,
      })),
      subtotal: params.subtotal,
      notes: params.notes,
      parkedAt: new Date().toISOString(),
      cashierName: this.activeSession?.user_name || 'الكاشير',
    };

    this.parkedCarts.unshift(parked);
    this.persistParkedCarts();
    return parked;
  }

  public getParkedCarts(): ParkedCart[] {
    return this.parkedCarts;
  }

  public removeParkedCart(id: string): boolean {
    const idx = this.parkedCarts.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.parkedCarts.splice(idx, 1);
      this.persistParkedCarts();
      return true;
    }
    return false;
  }
}

export const posSessionService = new PosSessionService();
