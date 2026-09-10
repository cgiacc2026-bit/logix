import { Account, PaymentVoucher, Customer, Supplier, Invoice } from '../types';
import { DataService, localDataStore } from './dataService';

export interface BankOrCashAccountSummary {
  id: string;
  code: string;
  nameAr: string;
  category: 'CASH' | 'BANK';
  balance: number;
}

export interface VoucherAccountingSimulation {
  voucherType: 'RECEIPT' | 'PAYMENT';
  isEdit: boolean;
  amount: number;
  oldAmount?: number;
  deltaAmount: number;
  targetAccount: {
    id: string;
    code: string;
    nameAr: string;
    currentBalance: number;
    projectedBalance: number;
  };
  oldTargetAccount?: {
    id: string;
    code: string;
    nameAr: string;
    currentBalance: number;
    projectedBalance: number;
  };
  entity?: {
    id: string;
    nameAr: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    currentBalance: number;
    projectedBalance: number;
  };
  journalDebit: string;
  journalCredit: string;
}

export class VouchersService {
  /**
   * Retrieves all active Bank and Cash accounts from the Chart of Accounts with updated dynamic balances.
   */
  public static getBankAndCashAccounts(): BankOrCashAccountSummary[] {
    // Ensure balances are synced with latest posted journals
    const accounts = DataService.syncAccountBalances();

    const bankAndCash = accounts.filter((acc) => {
      const code = String(acc.code || '');
      const name = String(acc.nameAr || '');
      const cat = String(acc.category || '').toUpperCase();
      const subCat = String((acc as any).subCategory || '').toUpperCase();

      const isCashCode = code.startsWith('1112') || code.startsWith('1110') || code === '111' || code === '1113';
      const isBankCode = code.startsWith('1111') || code.startsWith('1101');
      const isBankOrCashByName =
        name.includes('بنك') ||
        name.includes('مصرف') ||
        name.includes('خزينة') ||
        name.includes('صندوق') ||
        name.includes('نقدية');

      return (
        acc.category === 'ASSET' &&
        (isCashCode ||
          isBankCode ||
          isBankOrCashByName ||
          subCat.includes('BANK') ||
          subCat.includes('CASH'))
      );
    });

    // If none found, provide defaults with real accounts
    if (bankAndCash.length === 0) {
      const fallback = accounts.filter((a) => a.category === 'ASSET').slice(0, 2);
      return fallback.map((a) => ({
        id: a.id,
        code: a.code,
        nameAr: a.nameAr,
        category: a.code === '1112' || a.nameAr.includes('خزينة') || a.nameAr.includes('صندوق') ? 'CASH' : 'BANK',
        balance: a.balance || 0,
      }));
    }

    return bankAndCash.map((acc) => ({
      id: acc.id,
      code: acc.code,
      nameAr: acc.nameAr,
      category: acc.code.startsWith('1112') || acc.nameAr.includes('صندوق') || acc.nameAr.includes('خزينة') ? 'CASH' : 'BANK',
      balance: acc.balance || 0,
    }));
  }

  /**
   * Simulates the exact double-entry accounting impact of creating or editing a voucher before committing.
   */
  public static simulateVoucherAccountingImpact(params: {
    voucherType: 'RECEIPT' | 'PAYMENT';
    isEdit: boolean;
    amount: number;
    bankAccountId: string;
    entityId?: string;
    entityType?: 'CUSTOMER' | 'SUPPLIER';
    oldVoucher?: PaymentVoucher;
  }): VoucherAccountingSimulation {
    const accounts = DataService.syncAccountBalances();
    const isReceipt = params.voucherType === 'RECEIPT';
    const newAmount = Number(params.amount) || 0;
    const oldAmount = params.oldVoucher ? Number(params.oldVoucher.amount) || 0 : 0;
    const deltaAmount = params.isEdit ? newAmount - oldAmount : newAmount;

    // Target Bank/Cash account
    const targetAcc = accounts.find((a) => a.id === params.bankAccountId || a.code === params.bankAccountId) || accounts[0];
    const currentBankBal = Number(targetAcc?.balance) || 0;

    let projectedBankBal = currentBankBal;
    let oldAccSimulation = undefined;

    if (params.isEdit && params.oldVoucher) {
      const oldBankAccId = params.oldVoucher.bankAccountId;
      if (oldBankAccId && oldBankAccId !== params.bankAccountId) {
        // Different bank account! Revert impact on old account and apply on new account
        const oldAcc = accounts.find((a) => a.id === oldBankAccId || a.code === oldBankAccId);
        if (oldAcc) {
          const oldBal = Number(oldAcc.balance) || 0;
          const restoredOldBal = isReceipt ? oldBal - oldAmount : oldBal + oldAmount;
          oldAccSimulation = {
            id: oldAcc.id,
            code: oldAcc.code,
            nameAr: oldAcc.nameAr,
            currentBalance: oldBal,
            projectedBalance: restoredOldBal,
          };
        }
        // Apply full new amount to new account
        projectedBankBal = isReceipt ? currentBankBal + newAmount : currentBankBal - newAmount;
      } else {
        // Same bank account: apply delta
        projectedBankBal = isReceipt ? currentBankBal + deltaAmount : currentBankBal - deltaAmount;
      }
    } else {
      // New voucher
      projectedBankBal = isReceipt ? currentBankBal + newAmount : currentBankBal - newAmount;
    }

    // Entity simulation
    let entitySimulation = undefined;
    if (params.entityId) {
      if (params.entityType === 'CUSTOMER' || isReceipt) {
        const cust = localDataStore.getCustomers().find((c) => c.id === params.entityId);
        if (cust) {
          const curBal = Number(cust.balance) || 0;
          const projBal = params.isEdit ? curBal - deltaAmount : curBal - newAmount;
          entitySimulation = {
            id: cust.id,
            nameAr: cust.nameAr,
            type: 'CUSTOMER' as const,
            currentBalance: curBal,
            projectedBalance: projBal,
          };
        }
      } else {
        const sup = localDataStore.getSuppliers().find((s) => s.id === params.entityId);
        if (sup) {
          const curBal = Number(sup.balance) || 0;
          const projBal = params.isEdit ? curBal - deltaAmount : curBal - newAmount;
          entitySimulation = {
            id: sup.id,
            nameAr: sup.nameAr,
            type: 'SUPPLIER' as const,
            currentBalance: curBal,
            projectedBalance: projBal,
          };
        }
      }
    }

    return {
      voucherType: params.voucherType,
      isEdit: params.isEdit,
      amount: newAmount,
      oldAmount: params.isEdit ? oldAmount : undefined,
      deltaAmount,
      targetAccount: {
        id: targetAcc ? targetAcc.id : params.bankAccountId,
        code: targetAcc ? targetAcc.code : '',
        nameAr: targetAcc ? targetAcc.nameAr : 'الحساب المالي',
        currentBalance: currentBankBal,
        projectedBalance: projectedBankBal,
      },
      oldTargetAccount: oldAccSimulation,
      entity: entitySimulation,
      journalDebit: isReceipt ? `${targetAcc?.nameAr || 'البنك / الخزينة'} (زيادة رصيد الإيداع)` : `حساب الذمم الدائنة للمورد`,
      journalCredit: isReceipt ? `حساب الذمم المدينة للعميل (تخفيض المديونية)` : `${targetAcc?.nameAr || 'البنك / الخزينة'} (خصم رصيد المنصرف)`,
    };
  }

  /**
   * Creates a new receipt or payment voucher with automatic bank posting.
   */
  public static async createVoucher(data: any): Promise<PaymentVoucher> {
    return DataService.createVoucher(data);
  }

  /**
   * Updates an existing voucher with immediate journal reversal, new entry, and balance sync.
   */
  public static async updateVoucher(id: string, data: any): Promise<PaymentVoucher | null> {
    return DataService.updateVoucher(id, data);
  }

  /**
   * Cancels a voucher and restores both the bank account balance and entity balance.
   */
  public static async cancelVoucher(id: string, reason: string): Promise<PaymentVoucher | null> {
    return DataService.cancelVoucher(id, reason);
  }

  /**
   * Deletes a voucher and guarantees all accounting balances are restored.
   */
  public static async deleteVoucher(id: string): Promise<boolean> {
    return DataService.deleteVoucher(id);
  }
}
