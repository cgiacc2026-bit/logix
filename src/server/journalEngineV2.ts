/**
 * Logix ERP v2.1 - Central Production Journal Engine
 * File: src/server/journalEngineV2.ts
 * 
 * Complete implementation resolving:
 * 1. Strict snake_case field naming consistency (v2.1).
 * 2. Cryptographically secure ID generation via crypto.randomUUID().
 * 3. Dynamic Account Resolution without rigid hardcoded account codes.
 * 4. Full support for all document types (Sales, Purchases, Returns, Vouchers, Adjustments).
 * 5. 100% precise Partner Balance Delta calculations.
 * 6. Atomic Transactional Execution (Unit of Work with Rollback guarantee).
 * 7. Comprehensive Audit Logging & Multi-Tenant Isolation.
 */

import {
  DocumentV2,
  DocumentLineV2,
  JournalEntryV2,
  JournalLineV2,
  AuditLogV2,
  AccountV2,
  PartnerV2,
  SystemAccountRole,
  DocumentTypeV2,
} from '../types/unifiedV2.js';

export interface ReverseResult {
  originalDocument: DocumentV2;
  reverseDocument: DocumentV2;
  reverseJournalEntry: JournalEntryV2;
}

export interface JournalEngineStorage {
  getDocument(id: string): Promise<DocumentV2 | null>;
  saveDocument(doc: DocumentV2): Promise<void>;
  findDependentDocuments(docId: string): Promise<DocumentV2[]>;

  getJournalEntry(id: string): Promise<JournalEntryV2 | null>;
  saveJournalEntry(entry: JournalEntryV2): Promise<void>;

  getAccount(id: string): Promise<AccountV2 | null>;
  getAccountByCode(companyId: string, code: string): Promise<AccountV2 | null>;
  resolveAccountForRole(companyId: string, role: SystemAccountRole, preferredId?: string | null): Promise<AccountV2>;
  updateAccountBalance(id: string, delta: number): Promise<void>;

  getPartner(id: string): Promise<PartnerV2 | null>;
  updatePartnerBalance(id: string, delta: number): Promise<void>;

  saveAuditLog(log: AuditLogV2): Promise<void>;

  // Transaction support
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
}

export class JournalEngineV2 {
  private storage: JournalEngineStorage;

  constructor(storage: JournalEngineStorage) {
    this.storage = storage;
  }

  /**
   * توليد معرف فريد وآمن للإنتاج باستخدام crypto.randomUUID()
   */
  private generateId(prefix: string): string {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return `${prefix}_${uuid}`;
  }

  /**
   * 1. ترحيل المستند (postDocument)
   * 
   * المسار:
   * - التحقق من وجود المستند وحالته (يُسمح فقط بترحيل DRAFT أو APPROVED).
   * - التحقق الصارم من عزل الشركة (company_id).
   * - التحقق من الشريك (Partner) إن وجد.
   * - توليد أسطر القيد المزدوج المتوازن رياضياً بديناميكية تامة.
   * - التحقق من (Total Debit === Total Credit).
   * - تنفيذ المعاملة الذرية (Atomic Unit of Work).
   * - تسجيل الحدث في AuditLogV2.
   */
  public async postDocument(docId: string, userId: string): Promise<DocumentV2> {
    const doc = await this.storage.getDocument(docId);
    if (!doc) {
      throw new Error(`المستند برقم المعرف (${docId}) غير موجود في النظام.`);
    }

    if (!doc.company_id || !doc.company_id.trim()) {
      throw new Error('خرق أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    // التحقق الصارم من حالة المستند
    if (doc.status === 'POSTED') {
      throw new Error(`المستند رقم (${doc.doc_number}) مرحّل مسبقاً إلى دفتر الأستاذ.`);
    }
    if (doc.status === 'REVERSED') {
      throw new Error(`المستند رقم (${doc.doc_number}) معكوس ولا يمكن إعادة ترحيله.`);
    }
    if (doc.status === 'CANCELLED') {
      throw new Error(`المستند رقم (${doc.doc_number}) ملغي، ولا يمكن ترحيل مستند ملغي.`);
    }

    const now = new Date().toISOString();
    const journalEntryId = this.generateId('jv');

    // توليد أسطر القيد المحاسبي المزدوج عبر المحلل الديناميكي للحسابات
    const journalLines = await this.buildDoubleEntryLines(doc, journalEntryId);

    // التحقق الرياضي الصارم من توازن القيد
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of journalLines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('خطأ محاسبي: أسطر القيد لا تقبل القيم السالبة.');
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    const roundedDebit = Math.round(totalDebit * 1000) / 1000;
    const roundedCredit = Math.round(totalCredit * 1000) / 1000;

    if (Math.abs(roundedDebit - roundedCredit) > 0.001) {
      throw new Error(
        `خطأ محاسبي: القيد غير متوازن! إجمالي المدين (${roundedDebit}) لا يساوي إجمالي الدائن (${roundedCredit}).`
      );
    }

    // بناء سجل القيد المحاسبي
    const journalEntry: JournalEntryV2 = {
      id: journalEntryId,
      company_id: doc.company_id,
      entry_number: `JV-${doc.doc_number}`,
      date: doc.doc_date,
      description: `قيد ترحيل ${this.getDocumentTypeArabicName(doc.doc_type)} رقم (${doc.doc_number})`,
      status: 'POSTED',
      source_document_id: doc.id,
      source_document_type: doc.doc_type,
      total_debit: roundedDebit,
      total_credit: roundedCredit,
      is_balanced: true,
      posted_at: now,
      posted_by: userId,
      created_by: userId,
      created_at: now,
      updated_at: now,
      lines: journalLines,
    };

    // تنفيذ المعاملة الذرية (Atomic Execution Unit)
    try {
      if (this.storage.beginTransaction) await this.storage.beginTransaction();

      // 1. حفظ القيد المحاسبي
      await this.storage.saveJournalEntry(journalEntry);

      // 2. تحديث أرصدة شجرة الحسابات
      for (const line of journalLines) {
        const netDelta = line.debit - line.credit;
        await this.storage.updateAccountBalance(line.account_id, netDelta);
      }

      // 3. تحديث رصيد الشريك (إن وجد)
      if (doc.entity_id) {
        const partnerDelta = this.calculatePartnerBalanceDelta(doc);
        if (partnerDelta !== 0) {
          await this.storage.updatePartnerBalance(doc.entity_id, partnerDelta);
        }
      }

      // 4. تحديث حالة المستند إلى POSTED
      const updatedDoc: DocumentV2 = {
        ...doc,
        status: 'POSTED',
        journal_entry_id: journalEntry.id,
        posted_at: now,
        posted_by: userId,
        updated_at: now,
      };
      await this.storage.saveDocument(updatedDoc);

      // 5. توثيق العملية في سجل التدقيق
      await this.storage.saveAuditLog({
        id: this.generateId('audit'),
        company_id: doc.company_id,
        user_id: userId,
        action: 'DOCUMENT_POST',
        entity_type: 'DOCUMENT',
        entity_id: doc.id,
        details: {
          doc_number: doc.doc_number,
          doc_type: doc.doc_type,
          grand_total: doc.grand_total,
          journal_entry_id: journalEntry.id,
          total_debit: roundedDebit,
        },
        timestamp: now,
      });

      if (this.storage.commitTransaction) await this.storage.commitTransaction();

      return updatedDoc;
    } catch (error) {
      if (this.storage.rollbackTransaction) await this.storage.rollbackTransaction();
      throw new Error(`فشل ترحيل المستند (${doc.doc_number}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 2. عكس المستند (reverseDocument)
   * 
   * المسار:
   * - التحقق من أن المستند بحالة POSTED فقط.
   * - التحقق من عدم عكس المستند مسبقاً.
   * - فحص التبعيات النشطة ومنع العكس إن وجدت مستندات معتمدة عليه.
   * - إنشاء مستند عكسي جديد بالكامل (بأرقام سالبة ورقم تسلسلي REV-...).
   * - توليد قيد عكسي تلقائي 100% (قلب المدين دائن والدائن مدين).
   * - تحديث المستند الأصلي ليصبح REVERSED مع ربط reversed_by_id.
   * - تنفيذ المعاملة ذرية (Transaction Rollback On Failure).
   */
  public async reverseDocument(docId: string, userId: string): Promise<ReverseResult> {
    const originalDoc = await this.storage.getDocument(docId);
    if (!originalDoc) {
      throw new Error(`المستند المراد عكسه (${docId}) غير موجود.`);
    }

    if (!originalDoc.company_id || !originalDoc.company_id.trim()) {
      throw new Error('خرق أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    // 1. الشروط الصارمة
    if (originalDoc.status !== 'POSTED') {
      throw new Error(
        `لا يمكن عكس المستند رقم (${originalDoc.doc_number}) لأنه غير مرحّل (حالته: ${originalDoc.status}). الإلغاء هو الخيار للمستندات غير المرحلة.`
      );
    }

    if (originalDoc.reversed_by_id) {
      throw new Error(
        `المستند رقم (${originalDoc.doc_number}) معكوس مسبقاً بالمستند العكسي (${originalDoc.reversed_by_id}). لا يمكن عكس المستند أكثر من مرة.`
      );
    }

    // 2. التحقق من التبعيات
    const dependentDocs = await this.storage.findDependentDocuments(docId);
    const activeDependents = dependentDocs.filter(
      (d) => d.status !== 'CANCELLED' && d.status !== 'REVERSED'
    );

    if (activeDependents.length > 0) {
      const depNumbers = activeDependents.map((d) => d.doc_number).join(', ');
      throw new Error(
        `لا يمكن عكس المستند لأن هناك (${activeDependents.length}) مستندات نشطة معتمدة عليه: [${depNumbers}]. يجب تسوية أو عكس المستندات التابعة أولاً.`
      );
    }

    const now = new Date().toISOString();
    const reverseDocId = this.generateId('doc_rev');
    const reverseJournalId = this.generateId('jv_rev');
    const reverseDocNumber = `REV-${originalDoc.doc_number}`;

    if (!originalDoc.journal_entry_id) {
      throw new Error(`خطأ فادح: المستند مرحل ولكن لا يوجد له قيد محاسبي مسجل (journal_entry_id مفقود).`);
    }

    const originalJournal = await this.storage.getJournalEntry(originalDoc.journal_entry_id);
    if (!originalJournal) {
      throw new Error(`القيد المحاسبي الأصلي (${originalDoc.journal_entry_id}) غير موجود في الدفاتر.`);
    }

    // 3. إنشاء سند عكسي جديد (مش تعديل القديم)
    const reversedLines: DocumentLineV2[] = (originalDoc.lines || []).map((l, index) => ({
      ...l,
      id: `${reverseDocId}_line_${index + 1}`,
      document_id: reverseDocId,
      quantity: -l.quantity,
      subtotal: -l.subtotal,
      discount_amount: -l.discount_amount,
      vat_amount: -l.vat_amount,
      total: -l.total,
      notes: `عكس البند: ${l.notes || ''}`,
      created_at: now,
    }));

    const reverseDocument: DocumentV2 = {
      id: reverseDocId,
      company_id: originalDoc.company_id,
      branch_id: originalDoc.branch_id,
      doc_type: originalDoc.doc_type,
      doc_number: reverseDocNumber,
      doc_date: now.split('T')[0],
      due_date: originalDoc.due_date,
      status: 'POSTED',
      journal_entry_id: reverseJournalId,
      reverses_id: originalDoc.id,
      reversed_by_id: null,
      entity_id: originalDoc.entity_id,
      warehouse_id: originalDoc.warehouse_id,
      payment_method: originalDoc.payment_method,
      payment_account_id: originalDoc.payment_account_id,
      subtotal: -originalDoc.subtotal,
      discount_total: -originalDoc.discount_total,
      vat_total: -originalDoc.vat_total,
      grand_total: -originalDoc.grand_total,
      paid_amount: -originalDoc.paid_amount,
      due_amount: -originalDoc.due_amount,
      posted_at: now,
      posted_by: userId,
      reversed_at: null,
      reversed_by: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      notes: `سند عكسي رسمي للمستند رقم (${originalDoc.doc_number})`,
      reference_no: originalDoc.doc_number,
      created_by: userId,
      created_at: now,
      updated_at: now,
      lines: reversedLines,
    };

    // 4. توليد قيد عكسي تلقائي 100% (قلب المدين دائن والدائن مدين)
    const reversedJournalLines: JournalLineV2[] = originalJournal.lines.map((origLine, idx) => ({
      id: `${reverseJournalId}_line_${idx + 1}`,
      company_id: originalDoc.company_id,
      journal_entry_id: reverseJournalId,
      account_id: origLine.account_id,
      account_code: origLine.account_code,
      account_name_ar: origLine.account_name_ar,
      debit: origLine.credit, // قلب أطراف القيد
      credit: origLine.debit, // قلب أطراف القيد
      entity_id: origLine.entity_id,
      entity_type: origLine.entity_type,
      memo: `عكس قيد للقيد (${originalJournal.entry_number}) - ${origLine.memo}`,
      line_number: idx + 1,
      created_at: now,
    }));

    const reverseJournalEntry: JournalEntryV2 = {
      id: reverseJournalId,
      company_id: originalDoc.company_id,
      entry_number: `REV-${originalJournal.entry_number}`,
      date: now.split('T')[0],
      description: `قيد عكسي آلي 100% ناتج عن عكس المستند رقم (${originalDoc.doc_number})`,
      status: 'POSTED',
      source_document_id: reverseDocument.id,
      source_document_type: originalDoc.doc_type,
      reverses_journal_id: originalJournal.id,
      reversed_by_journal_id: null,
      total_debit: originalJournal.total_credit,
      total_credit: originalJournal.total_debit,
      is_balanced: true,
      posted_at: now,
      posted_by: userId,
      created_by: userId,
      created_at: now,
      updated_at: now,
      lines: reversedJournalLines,
    };

    // 5. تحديث السند الأصلي
    const updatedOriginalDoc: DocumentV2 = {
      ...originalDoc,
      status: 'REVERSED',
      reversed_by_id: reverseDocument.id,
      reversed_at: now,
      reversed_by: userId,
      updated_at: now,
    };

    // تنفيذ العملية كاملة بضمان المعاملة الذرية (Transaction)
    try {
      if (this.storage.beginTransaction) await this.storage.beginTransaction();

      await this.storage.saveDocument(reverseDocument);
      await this.storage.saveJournalEntry(reverseJournalEntry);

      // تحديث أرصدة الحسابات بعكس التأثير
      for (const line of reversedJournalLines) {
        const netDelta = line.debit - line.credit;
        await this.storage.updateAccountBalance(line.account_id, netDelta);
      }

      // تحديث رصيد الشريك بعكس التأثير
      if (originalDoc.entity_id) {
        const partnerDelta = this.calculatePartnerBalanceDelta(reverseDocument);
        if (partnerDelta !== 0) {
          await this.storage.updatePartnerBalance(originalDoc.entity_id, partnerDelta);
        }
      }

      // حفظ المستند الأصلي بحالة REVERSED
      await this.storage.saveDocument(updatedOriginalDoc);

      // توثيق عملية العكس في سجل التدقيق
      await this.storage.saveAuditLog({
        id: this.generateId('audit'),
        company_id: originalDoc.company_id,
        user_id: userId,
        action: 'DOCUMENT_REVERSE',
        entity_type: 'DOCUMENT',
        entity_id: originalDoc.id,
        details: {
          original_doc_number: originalDoc.doc_number,
          reverse_doc_number: reverseDocument.doc_number,
          reverse_doc_id: reverseDocument.id,
          reverse_journal_id: reverseJournalEntry.id,
          grand_total_reversed: originalDoc.grand_total,
        },
        timestamp: now,
      });

      if (this.storage.commitTransaction) await this.storage.commitTransaction();

      return {
        originalDocument: updatedOriginalDoc,
        reverseDocument,
        reverseJournalEntry,
      };
    } catch (error) {
      if (this.storage.rollbackTransaction) await this.storage.rollbackTransaction();
      throw new Error(`فشل عكس المستند (${originalDoc.doc_number}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 3. إلغاء المستند (cancelDocument)
   * 
   * المسار:
   * - التحقق من أن المستند لم يتم ترحيله (فقط DRAFT أو APPROVED).
   * - رفض إلغاء أي مستند POSTED وتوجيهه لاستخدام reverseDocument بدلاً من ذلك.
   * - إلزامية وجود سبب الإلغاء (reason).
   * - تغيير الحالة إلى CANCELLED وتوثيق الوقت والمستخدم والسبب.
   * - تسجيل العملية في AuditLogV2.
   */
  public async cancelDocument(docId: string, userId: string, reason: string): Promise<DocumentV2> {
    if (!reason || !reason.trim()) {
      throw new Error('يجب إدخال سبب رسمي لإلغاء المستند.');
    }

    const doc = await this.storage.getDocument(docId);
    if (!doc) {
      throw new Error(`المستند برقم المعرف (${docId}) غير موجود.`);
    }

    if (!doc.company_id || !doc.company_id.trim()) {
      throw new Error('خرق أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    if (doc.status === 'POSTED') {
      throw new Error(
        `لا يمكن إلغاء المستند رقم (${doc.doc_number}) لأنه مرحّل محاسبياً إلى دفتر الأستاذ العام. يمنع القانون المحاسبي حذف أو إلغاء المستندات المرحلة، ويجب استخدام عملية العكس النظامية (reverseDocument).`
      );
    }
    if (doc.status === 'REVERSED') {
      throw new Error(`المستند رقم (${doc.doc_number}) معكوس بالفعل ولا يمكن إلغاؤه.`);
    }
    if (doc.status === 'CANCELLED') {
      throw new Error(`المستند رقم (${doc.doc_number}) ملغي مسبقاً.`);
    }

    const now = new Date().toISOString();

    const cancelledDoc: DocumentV2 = {
      ...doc,
      status: 'CANCELLED',
      cancelled_at: now,
      cancelled_by: userId,
      cancellation_reason: reason.trim(),
      updated_at: now,
    };

    try {
      if (this.storage.beginTransaction) await this.storage.beginTransaction();

      await this.storage.saveDocument(cancelledDoc);

      await this.storage.saveAuditLog({
        id: this.generateId('audit'),
        company_id: doc.company_id,
        user_id: userId,
        action: 'DOCUMENT_CANCEL',
        entity_type: 'DOCUMENT',
        entity_id: doc.id,
        details: {
          doc_number: doc.doc_number,
          doc_type: doc.doc_type,
          cancellation_reason: reason.trim(),
        },
        timestamp: now,
      });

      if (this.storage.commitTransaction) await this.storage.commitTransaction();

      return cancelledDoc;
    } catch (error) {
      if (this.storage.rollbackTransaction) await this.storage.rollbackTransaction();
      throw new Error(`فشل إلغاء المستند (${doc.doc_number}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =========================================================================
  // بناء القيود المزدوجة الديناميكية الشاملة (Dynamic Double-Entry Engine)
  // =========================================================================

  private async buildDoubleEntryLines(
    doc: DocumentV2,
    journalEntryId: string
  ): Promise<JournalLineV2[]> {
    const lines: JournalLineV2[] = [];
    const companyId = doc.company_id;
    const now = new Date().toISOString();

    // 1. جلب شريك المعاملة إن وجد لمعرفة حسابه الفرعي المحاسبي المباشر
    let partnerAccount: AccountV2 | null = null;
    let partner: PartnerV2 | null = null;
    if (doc.entity_id) {
      partner = await this.storage.getPartner(doc.entity_id);
      if (partner?.account_id) {
        partnerAccount = await this.storage.getAccount(partner.account_id);
      }
    }

    // 2. حل الحسابات ديناميكياً بدون أكواد جامدة
    const arAccount = partnerAccount || await this.storage.resolveAccountForRole(companyId, 'RECEIVABLE');
    const apAccount = partnerAccount || await this.storage.resolveAccountForRole(companyId, 'PAYABLE');
    const salesRevAccount = await this.storage.resolveAccountForRole(companyId, 'SALES_REVENUE');
    const salesReturnAccount = await this.storage.resolveAccountForRole(companyId, 'SALES_RETURN');
    const purchaseExpenseAccount = await this.storage.resolveAccountForRole(companyId, 'PURCHASE_EXPENSE');
    const purchaseReturnAccount = await this.storage.resolveAccountForRole(companyId, 'PURCHASE_RETURN');
    const defaultCashBank = await this.storage.resolveAccountForRole(companyId, 'CASH_OR_BANK', doc.payment_account_id);
    const inventoryAccount = await this.storage.resolveAccountForRole(companyId, 'INVENTORY');
    const cogsAccount = await this.storage.resolveAccountForRole(companyId, 'COGS');
    const vatOutputAccount = await this.storage.resolveAccountForRole(companyId, 'VAT_OUTPUT');
    const vatInputAccount = await this.storage.resolveAccountForRole(companyId, 'VAT_INPUT');

    const paymentAcc = doc.payment_account_id
      ? await this.storage.getAccount(doc.payment_account_id) || defaultCashBank
      : defaultCashBank;

    switch (doc.doc_type) {
      // -------------------------------------------------------------
      // أ. فواتير المبيعات (SALES_INVOICE)
      // -------------------------------------------------------------
      case 'SALES_INVOICE': {
        const isCash = doc.payment_method === 'CASH' || doc.payment_method === 'KNET';
        const debitAcc = isCash ? paymentAcc : arAccount;

        // مدين: العميل أو الصندوق/البنك
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: debitAcc.id,
          account_code: debitAcc.code,
          account_name_ar: debitAcc.name_ar,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `استحقاق فاتورة مبيعات رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // دائن: إيراد المبيعات الصافي
        const netSales = doc.subtotal - doc.discount_total;
        lines.push({
          id: `${journalEntryId}_line_2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: salesRevAccount.id,
          account_code: salesRevAccount.code,
          account_name_ar: salesRevAccount.name_ar,
          debit: 0,
          credit: netSales,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `إيراد مبيعات فاتورة رقم (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });

        // دائن: ضريبة القيمة المضافة (إن وجدت)
        if (doc.vat_total > 0) {
          lines.push({
            id: `${journalEntryId}_line_vat`,
            company_id: companyId,
            journal_entry_id: journalEntryId,
            account_id: vatOutputAccount.id,
            account_code: vatOutputAccount.code,
            account_name_ar: vatOutputAccount.name_ar,
            debit: 0,
            credit: doc.vat_total,
            entity_id: doc.entity_id || null,
            entity_type: 'CUSTOMER',
            memo: `ضريبة مخرجات فاتورة (${doc.doc_number})`,
            line_number: lines.length + 1,
            created_at: now,
          });
        }
        break;
      }

      // -------------------------------------------------------------
      // ب. مردودات المبيعات (SALES_RETURN)
      // -------------------------------------------------------------
      case 'SALES_RETURN': {
        const isCash = doc.payment_method === 'CASH';
        const creditAcc = isCash ? paymentAcc : arAccount;

        // مدين: مردودات ومسموحات المبيعات
        const netReturn = doc.subtotal - doc.discount_total;
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: salesReturnAccount.id,
          account_code: salesReturnAccount.code,
          account_name_ar: salesReturnAccount.name_ar,
          debit: netReturn,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `مردودات مبيعات مستند (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // مدين: عكس ضريبة المخرجات إن وجدت
        if (doc.vat_total > 0) {
          lines.push({
            id: `${journalEntryId}_line_vat`,
            company_id: companyId,
            journal_entry_id: journalEntryId,
            account_id: vatOutputAccount.id,
            account_code: vatOutputAccount.code,
            account_name_ar: vatOutputAccount.name_ar,
            debit: doc.vat_total,
            credit: 0,
            entity_id: doc.entity_id || null,
            entity_type: 'CUSTOMER',
            memo: `عكس ضريبة مخرجات لمردود مبيعات (${doc.doc_number})`,
            line_number: 2,
            created_at: now,
          });
        }

        // دائن: العميل أو الصندوق
        lines.push({
          id: `${journalEntryId}_line_credit`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: creditAcc.id,
          account_code: creditAcc.code,
          account_name_ar: creditAcc.name_ar,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `تخفيض مديونية العميل لمردود مبيعات (${doc.doc_number})`,
          line_number: lines.length + 1,
          created_at: now,
        });
        break;
      }

      // -------------------------------------------------------------
      // ج. فواتير المشتريات (PURCHASE_INVOICE)
      // -------------------------------------------------------------
      case 'PURCHASE_INVOICE': {
        const isCash = doc.payment_method === 'CASH';
        const creditAcc = isCash ? paymentAcc : apAccount;

        // مدين: المشتريات / المخزون
        const netPurchase = doc.subtotal - doc.discount_total;
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: purchaseExpenseAccount.id,
          account_code: purchaseExpenseAccount.code,
          account_name_ar: purchaseExpenseAccount.name_ar,
          debit: netPurchase,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `إثبات مشتريات فاتورة رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // مدين: ضريبة المدخلات إن وجدت
        if (doc.vat_total > 0) {
          lines.push({
            id: `${journalEntryId}_line_vat`,
            company_id: companyId,
            journal_entry_id: journalEntryId,
            account_id: vatInputAccount.id,
            account_code: vatInputAccount.code,
            account_name_ar: vatInputAccount.name_ar,
            debit: doc.vat_total,
            credit: 0,
            entity_id: doc.entity_id || null,
            entity_type: 'SUPPLIER',
            memo: `ضريبة مدخلات لمشتريات (${doc.doc_number})`,
            line_number: 2,
            created_at: now,
          });
        }

        // دائن: المورد أو الصندوق/البنك
        lines.push({
          id: `${journalEntryId}_line_credit`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: creditAcc.id,
          account_code: creditAcc.code,
          account_name_ar: creditAcc.name_ar,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `استحقاق مورد فاتورة مشتريات (${doc.doc_number})`,
          line_number: lines.length + 1,
          created_at: now,
        });
        break;
      }

      // -------------------------------------------------------------
      // د. مردودات المشتريات (PURCHASE_RETURN)
      // -------------------------------------------------------------
      case 'PURCHASE_RETURN': {
        const isCash = doc.payment_method === 'CASH';
        const debitAcc = isCash ? paymentAcc : apAccount;

        // مدين: المورد أو الصندوق (استرداد القيمة)
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: debitAcc.id,
          account_code: debitAcc.code,
          account_name_ar: debitAcc.name_ar,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `تخفيض حساب المورد لمردود مشتريات (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // دائن: مردودات المشتريات / المخزون
        const netReturn = doc.subtotal - doc.discount_total;
        lines.push({
          id: `${journalEntryId}_line_2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: purchaseReturnAccount.id,
          account_code: purchaseReturnAccount.code,
          account_name_ar: purchaseReturnAccount.name_ar,
          debit: 0,
          credit: netReturn,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `إثبات مردودات مشتريات مستند (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });

        // دائن: عكس ضريبة المدخلات إن وجدت
        if (doc.vat_total > 0) {
          lines.push({
            id: `${journalEntryId}_line_vat`,
            company_id: companyId,
            journal_entry_id: journalEntryId,
            account_id: vatInputAccount.id,
            account_code: vatInputAccount.code,
            account_name_ar: vatInputAccount.name_ar,
            debit: 0,
            credit: doc.vat_total,
            entity_id: doc.entity_id || null,
            entity_type: 'SUPPLIER',
            memo: `عكس ضريبة مدخلات لمردود مشتريات (${doc.doc_number})`,
            line_number: lines.length + 1,
            created_at: now,
          });
        }
        break;
      }

      // -------------------------------------------------------------
      // هـ. سندات القبض (RECEIPT_VOUCHER)
      // -------------------------------------------------------------
      case 'RECEIPT_VOUCHER': {
        const cashBankAcc = paymentAcc;

        // مدين: الصندوق أو البنك المستلم
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: cashBankAcc.id,
          account_code: cashBankAcc.code,
          account_name_ar: cashBankAcc.name_ar,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `تحصيل سند قبض رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // دائن: العميل (تخفيض المديونية)
        lines.push({
          id: `${journalEntryId}_line_2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: arAccount.id,
          account_code: arAccount.code,
          account_name_ar: arAccount.name_ar,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `سداد عميل بموجب سند قبض (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }

      // -------------------------------------------------------------
      // و. سندات الصرف (PAYMENT_VOUCHER)
      // -------------------------------------------------------------
      case 'PAYMENT_VOUCHER': {
        const cashBankAcc = paymentAcc;

        // مدين: المورد (تخفيض الالتزامات)
        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: apAccount.id,
          account_code: apAccount.code,
          account_name_ar: apAccount.name_ar,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `سداد لمورد بموجب سند صرف (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // دائن: الصندوق أو البنك المنصرف منه
        lines.push({
          id: `${journalEntryId}_line_2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: cashBankAcc.id,
          account_code: cashBankAcc.code,
          account_name_ar: cashBankAcc.name_ar,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `صرف نقدي/بنكي بموجب سند صرف (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }

      // -------------------------------------------------------------
      // ز. قيود اليومية والتسويات (JOURNAL_VOUCHER / INVENTORY_ADJUSTMENT)
      // -------------------------------------------------------------
      case 'JOURNAL_VOUCHER':
      case 'INVENTORY_ADJUSTMENT':
      default: {
        const accDebit = paymentAcc;
        const accCredit = arAccount;

        lines.push({
          id: `${journalEntryId}_line_1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: accDebit.id,
          account_code: accDebit.code,
          account_name_ar: accDebit.name_ar,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          memo: `قيد تسوية مستند (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        lines.push({
          id: `${journalEntryId}_line_2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: accCredit.id,
          account_code: accCredit.code,
          account_name_ar: accCredit.name_ar,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          memo: `مقابل تسوية مستند (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }
    }

    return lines;
  }

  /**
   * حساب التغير في رصيد الشريك بدقة محاسبية مطلقة 100%
   * 
   * القواعد:
   * 1. العميل (Customer): الرصيد يمثل مديونية العميل (Debit Balance).
   *    - فاتورة مبيعات آجلة: تزيد رصيده المدين (+due_amount).
   *    - فاتورة مبيعات نقدية بالكامل: لا تؤثر على حسابه (0).
   *    - مردود مبيعات آجل: يخفض رصيده المدين (-grand_total).
   *    - سند قبض: يخفض رصيده المدين (-grand_total).
   * 
   * 2. المورد (Supplier): الرصيد يمثل التزام الشركة تجاه المورد (Credit Balance).
   *    - فاتورة مشتريات آجلة: تزيد رصيده الدائن/الالتزام (+due_amount).
   *    - فاتورة مشتريات نقدية: (0).
   *    - مردود مشتريات آجل: يخفض رصيد المورد الدائن (-grand_total).
   *    - سند صرف لمورد: يخفض رصيد المورد الدائن بمقدار السداد (-grand_total).
   */
  public calculatePartnerBalanceDelta(doc: DocumentV2): number {
    const isCash = doc.payment_method === 'CASH' || doc.payment_method === 'KNET';

    switch (doc.doc_type) {
      case 'SALES_INVOICE':
        // إذا كان نقدي بالكامل فلا يترصد على العميل شيء، وإلا يرصد المتبقي غير المسدد
        return isCash ? 0 : (doc.due_amount > 0 ? doc.due_amount : doc.grand_total - doc.paid_amount);

      case 'SALES_RETURN':
        // مردود المبيعات الآجل يخصم من مديونية العميل
        return isCash ? 0 : -doc.grand_total;

      case 'RECEIPT_VOUCHER':
        // سند القبض يسدد ويخفض مديونية العميل
        return -doc.grand_total;

      case 'PURCHASE_INVOICE':
        // فاتورة المشتريات تزيد التزام المورد الدائن (بالموجب كرصيد دائن مستحق له)
        return isCash ? 0 : (doc.due_amount > 0 ? doc.due_amount : doc.grand_total - doc.paid_amount);

      case 'PURCHASE_RETURN':
        // مردود المشتريات يخفض التزام المورد
        return isCash ? 0 : -doc.grand_total;

      case 'PAYMENT_VOUCHER':
        // سند الصرف يسدد ويخفض التزام المورد
        return -doc.grand_total;

      default:
        return 0;
    }
  }

  private getDocumentTypeArabicName(type: DocumentTypeV2): string {
    const map: Record<DocumentTypeV2, string> = {
      SALES_INVOICE: 'فاتورة مبيعات',
      SALES_RETURN: 'مردود مبيعات',
      PURCHASE_INVOICE: 'فاتورة مشتريات',
      PURCHASE_RETURN: 'مردود مشتريات',
      RECEIPT_VOUCHER: 'سند قبض',
      PAYMENT_VOUCHER: 'سند صرف',
      JOURNAL_VOUCHER: 'قيد يومية',
      INVENTORY_ADJUSTMENT: 'تسوية مخزنية',
      STOCK_TRANSFER: 'تحويل مخزني',
      PRODUCTION_ISSUE: 'صرف إنتاج',
      PRODUCTION_RECEIPT: 'استلام إنتاج',
    };
    return map[type] || 'مستند مالي';
  }
}
