import { db } from './db.js';
import { Account, Customer, JournalEntry } from '../types.js';
import { matchesCompany } from './accountingEngine.js';

export interface CreateCustomerInput {
  nameAr: string;
  nameEn?: string;
  code?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  governorate?: string;
  city?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  branches?: any[];
  priceListId?: string;
  priceListName?: string;
  customPrices?: any[];
  defaultDiscountRate?: number;
}

// Mutex lock to strictly serialize sequential sub-account code generation under high concurrency
let subAccountCreationLock: Promise<void> = Promise.resolve();

/**
 * Unified atomic creation of Customer and linked Sub-Account under company's approved receivable account
 */
export async function createCustomerWithSubAccount(
  input: CreateCustomerInput,
  companyId: string
): Promise<{ customer: Customer; account: Account; openingJournal?: JournalEntry }> {
  if (!companyId || !companyId.trim()) {
    throw new Error('معرّف الشركة (companyId) إلزامي ومطلوب لإنشاء العميل وحسابه الفرعي');
  }

  if (!input.nameAr || !input.nameAr.trim()) {
    throw new Error('اسم العميل باللغة العربية مطلوب');
  }

  // Acquire lock to prevent race condition in sequential numbering
  let releaseLock: () => void;
  const currentLock = subAccountCreationLock;
  subAccountCreationLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  await currentLock;

  try {
    return db.executeTransaction(() => {
      const compAccounts = db.getAccounts().filter((a) => matchesCompany(a.companyId, companyId));
      const company = db.getCompany();

      // 1. Resolve approved parent receivable account for the company
      let parentAccount: Account | undefined;
      const configuredParentId = company?.defaultAccounts?.receivableAccountId || (company?.defaultAccounts as any)?.receivable;
      if (configuredParentId) {
        parentAccount = compAccounts.find((a) => a.id === configuredParentId || a.code === configuredParentId);
      }

      if (!parentAccount) {
        // Fallback to code 1120 ONLY if it actually exists in this company's accounts
        parentAccount = compAccounts.find((a) => a.code === '1120');
      }

      if (!parentAccount) {
        // Look for any approved root accounts receivable asset account
        parentAccount = compAccounts.find(
          (a) => a.category === 'ASSET' && (a.nameAr.includes('الذمم المدينة') || a.nameAr.includes('العملاء')) && (a.level || 1) <= 3
        );
      }

      if (!parentAccount) {
        throw new Error('لم يتم العثور على حساب الذمم المدينة الرئيسي المعتمد (1120) في دليل حسابات هذه الشركة');
      }

      // 2. Generate unique sub-account code sequentially under parent
      const prefix = parentAccount.code;
      const childCodes = compAccounts
        .map((a) => a.code)
        .filter((code) => code && code.startsWith(prefix) && code !== prefix);

      let maxSeq = 0;
      for (const c of childCodes) {
        const suffix = c.slice(prefix.length).replace(/^[-_]/, '');
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }

      const nextSeq = Math.max(maxSeq + 1, 1);
      let subCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      let seqCounter = nextSeq;
      while (compAccounts.some((a) => a.code === subCode)) {
        seqCounter++;
        subCode = `${prefix}${String(seqCounter).padStart(4, '0')}`;
      }

      // 3. Create sub-account object
      const newAccountId = 'acc-cust-' + Math.random().toString(36).substr(2, 9);
      const newAccount: Account = {
        id: newAccountId,
        code: subCode,
        nameAr: `عميل: ${input.nameAr.trim()}`,
        nameEn: input.nameEn ? `Customer: ${input.nameEn.trim()}` : `Customer: ${input.nameAr.trim()}`,
        category: parentAccount.category || 'ASSET',
        parentId: parentAccount.id,
        level: (parentAccount.level || 3) + 1,
        normalBalance: 'DEBIT',
        nature: 'DEBIT',
        isSystem: false,
        isActive: true,
        description: `حساب فرعي ذمم مدينة للعميل ${input.nameAr.trim()}`,
        companyId,
      };

      // 4. Handle Opening Balance validation
      const openAmount = Number(input.openingBalance) || 0;
      let openingJournal: JournalEntry | undefined;

      if (openAmount > 0) {
        if (!input.openingBalanceDate || !input.openingBalanceDate.trim()) {
          throw new Error('يجب تحديد تاريخ الرصيد الافتتاحي بشكل صريح عند إدخال رصيد افتتاحي للعميل');
        }

        // Look for approved equity / opening balance contra-account
        const configuredEquityId = company?.defaultAccounts?.retainedEarningsAccountId || (company?.defaultAccounts as any)?.retainedEarnings;
        let equityAccount = configuredEquityId
          ? compAccounts.find((a) => a.id === configuredEquityId || a.code === configuredEquityId)
          : undefined;

        if (!equityAccount) {
          equityAccount = compAccounts.find((a) => a.code === '3200');
        }

        if (!equityAccount) {
          equityAccount = compAccounts.find(
            (a) => a.category === 'EQUITY' && (a.nameAr.includes('الأرباح المرحلة') || a.nameAr.includes('أرصدة افتتاحية'))
          );
        }

        if (!equityAccount) {
          throw new Error(
            'لا يتوفر حساب حقوق ملكية / أرباح مرحلة معتمد في دليل هذه الشركة لتسجيل القيد الافتتاحي المقابل. يرجى تهيئة الحساب أو إنشاء العميل برصيد صفر.'
          );
        }

        const newCustomerId = 'cust-' + Math.random().toString(36).substr(2, 9);
        const jvId = 'jv-op-' + Math.random().toString(36).substr(2, 9);
        openingJournal = {
          id: jvId,
          companyId,
          entryNumber: `JV-OP-CUST-${newCustomerId.slice(-4)}`,
          date: input.openingBalanceDate.trim(),
          reference: `OP-${input.nameAr.trim()}`,
          description: `قيد رصيد أول المدة الافتتاحي للعميل (${input.nameAr.trim()})`,
          status: 'POSTED',
          lines: [
            {
              id: 'jl-1-' + Math.random().toString(36).substr(2, 7),
              accountId: newAccount.id,
              accountCode: newAccount.code,
              accountNameAr: newAccount.nameAr,
              debit: openAmount,
              credit: 0,
              memo: `رصيد أول المدة للعميل ${input.nameAr.trim()}`,
              entityType: 'CUSTOMER',
              entityId: newCustomerId,
              companyId,
            },
            {
              id: 'jl-2-' + Math.random().toString(36).substr(2, 7),
              accountId: equityAccount.id,
              accountCode: equityAccount.code,
              accountNameAr: equityAccount.nameAr,
              debit: 0,
              credit: openAmount,
              memo: `حقوق الملكية / أرصدة افتتاحية - ${input.nameAr.trim()}`,
              companyId,
            },
          ],
          totalDebit: openAmount,
          totalCredit: openAmount,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'CUSTOMER_OPENING_BALANCE' as any,
          sourceId: newCustomerId,
        };

        const compCustomers = db.getCustomers().filter((c) => matchesCompany(c.companyId, companyId));
        const customerCode = input.code || `CUST-${String(compCustomers.length + 1).padStart(3, '0')}`;
        const newCustomer: Customer = {
          id: newCustomerId,
          companyId,
          company_id: companyId,
          code: customerCode,
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn?.trim() || input.nameAr.trim(),
          taxNumber: input.taxNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          governorate: input.governorate || input.address || '',
          city: input.city || 'الكويت',
          balance: openAmount,
          openingBalance: openAmount,
          openingBalanceDate: input.openingBalanceDate.trim(),
          account_id: newAccount.id,
          accountId: newAccount.id,
          branches: input.branches || [],
          priceListId: input.priceListId || 'standard',
          priceListName: input.priceListName || '',
          customPrices: input.customPrices || [],
          defaultDiscountRate: input.defaultDiscountRate !== undefined ? Number(input.defaultDiscountRate) : 0,
          isActive: true,
        };

        // Atomically persist all
        db.addAccount(newAccount);
        db.addCustomer(newCustomer);
        db.addJournal(openingJournal);

        return { customer: newCustomer, account: newAccount, openingJournal };
      } else {
        // Zero balance customer
        const compCustomers = db.getCustomers().filter((c) => matchesCompany(c.companyId, companyId));
        const customerCode = input.code || `CUST-${String(compCustomers.length + 1).padStart(3, '0')}`;
        const newCustomerId = 'cust-' + Math.random().toString(36).substr(2, 9);
        const newCustomer: Customer = {
          id: newCustomerId,
          companyId,
          company_id: companyId,
          code: customerCode,
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn?.trim() || input.nameAr.trim(),
          taxNumber: input.taxNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          governorate: input.governorate || input.address || '',
          city: input.city || 'الكويت',
          balance: 0,
          openingBalance: 0,
          openingBalanceDate: input.openingBalanceDate?.trim() || undefined,
          account_id: newAccount.id,
          accountId: newAccount.id,
          branches: input.branches || [],
          priceListId: input.priceListId || 'standard',
          priceListName: input.priceListName || '',
          customPrices: input.customPrices || [],
          defaultDiscountRate: input.defaultDiscountRate !== undefined ? Number(input.defaultDiscountRate) : 0,
          isActive: true,
        };

        db.addAccount(newAccount);
        db.addCustomer(newCustomer);

        return { customer: newCustomer, account: newAccount };
      }
    });
  } finally {
    releaseLock!();
  }
}
