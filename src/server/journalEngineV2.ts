/**
 * Logix ERP v2 - Central Journal Engine
 * File: src/server/journalEngineV2.ts
 * 
 * Core Engine Functions:
 * 1. postDocument(docId, userId)
 * 2. reverseDocument(docId, userId)
 * 3. cancelDocument(docId, userId, reason)
 * 
 * Compliant with IFRS double-entry accounting and strict audit trail.
 */

import {
  DocumentV2,
  DocumentLineV2,
  JournalEntryV2,
  JournalLineV2,
  AuditLogV2,
  AccountV2,
  PartnerV2,
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
  updateAccountBalance(id: string, delta: number): Promise<void>;
  getPartner(id: string): Promise<PartnerV2 | null>;
  updatePartnerBalance(id: string, delta: number): Promise<void>;
  saveAuditLog(log: AuditLogV2): Promise<void>;
}

export class JournalEngineV2 {
  private storage: JournalEngineStorage;

  constructor(storage: JournalEngineStorage) {
    this.storage = storage;
  }

  /**
   * 1. ترحيل المستند (postDocument)
   * 
   * المسار:
   * - التحقق من وجود المستند وحالته (يجب أن يكون DRAFT أو APPROVED فقط).
   * - التحقق من عزل الشركة (company_id).
   * - توليد القيد المحاسبي المزدوج المتوازن رياضياً 100% (Debit === Credit).
   * - تحديث أرصدة الحسابات والشركاء في دفتر الأستاذ.
   * - تغيير حالة المستند إلى POSTED وتوثيق تاريخ ومسؤول الترحيل.
   * - تسجيل العملية في سجل الرقابة والتدقيق (AuditLogV2).
   */
  public async postDocument(docId: string, userId: string): Promise<DocumentV2> {
    const doc = await this.storage.getDocument(docId);
    if (!doc) {
      throw new Error(`المستند برقم المعرف (${docId}) غير موجود في النظام.`);
    }

    if (!doc.company_id) {
      throw new Error('خطأ أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    // التحقق الصارم من حالة المستند
    if (doc.status === 'POSTED') {
      throw new Error(`المستند رقم (${doc.doc_number}) مرحّل مسبقاً إلى الحسابات العامة.`);
    }
    if (doc.status === 'REVERSED') {
      throw new Error(`المستند رقم (${doc.doc_number}) معكوس ولا يمكن ترحيله.`);
    }
    if (doc.status === 'CANCELLED') {
      throw new Error(`المستند رقم (${doc.doc_number}) ملغي، لا يمكن ترحيل مستند ملغي.`);
    }

    const now = new Date().toISOString();
    const journalEntryId = 'jv-' + Math.random().toString(36).substring(2, 11);

    // توليد أسطر القيد المحاسبي المزدوج حسب نوع المستند
    const journalLines = await this.buildDoubleEntryLines(doc, journalEntryId);

    // التحقق الرياضي الصارم من توازن القيد
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of journalLines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('خطأ محاسبي: لا يمكن أن تحتوي أسطر القيد على مبالغ سالبة.');
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

    // إنشاء وحفظ القيد المحاسبي العام
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

    await this.storage.saveJournalEntry(journalEntry);

    // تحديث أرصدة الحسابات العامة وأرصدة الشركاء
    for (const line of journalLines) {
      const netDelta = line.debit - line.credit;
      await this.storage.updateAccountBalance(line.account_id, netDelta);
    }

    // تحديث رصيد الشريك (Partner) إن وجد
    if (doc.entity_id) {
      const partnerDelta = this.calculatePartnerBalanceDelta(doc);
      await this.storage.updatePartnerBalance(doc.entity_id, partnerDelta);
    }

    // تحديث حالة المستند الأصلي
    const updatedDoc: DocumentV2 = {
      ...doc,
      status: 'POSTED',
      journal_entry_id: journalEntry.id,
      posted_at: now,
      posted_by: userId,
      updated_at: now,
    };

    await this.storage.saveDocument(updatedDoc);

    // تسجيل العملية في الـ Audit Log
    await this.storage.saveAuditLog({
      id: 'audit-' + Math.random().toString(36).substring(2, 11),
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

    return updatedDoc;
  }

  /**
   * 2. عكس المستند (reverseDocument)
   * 
   * المسار:
   * - التحقق من أن المستند بحالة POSTED فقط.
   * - التأكد من عدم عكس المستند مسبقاً (reversed_by_id غير مسجل).
   * - التحقق من عدم وجود مستندات تابعة أو معتمدة عليه (سندات سداد أو مردودات).
   * - إنشاء مستند عكسي جديد تماماً (عدم التعديل العشوائي على بيانات المستند الأصلي).
   * - توليد قيد محاسبي عكسي 100% (قلب المدين دائن والدائن مدين).
   * - تحديث المستند الأصلي ليصبح REVERSED مع ربط reversed_by_id وتوثيق الوقت والمستخدم.
   * - تسجيل العملية بالكامل في AuditLogV2.
   */
  public async reverseDocument(docId: string, userId: string): Promise<ReverseResult> {
    const originalDoc = await this.storage.getDocument(docId);
    if (!originalDoc) {
      throw new Error(`المستند المراد عكسه (${docId}) غير موجود.`);
    }

    if (!originalDoc.company_id) {
      throw new Error('خطأ أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    // 1. الشروط الصارمة
    if (originalDoc.status !== 'POSTED') {
      throw new Error(
        `لا يمكن عكس المستند رقم (${originalDoc.doc_number}) لأنه غير مرحّل (حالته الحالية: ${originalDoc.status}). الإلغاء هو الخيار للمستندات غير المرحلة.`
      );
    }

    if (originalDoc.reversed_by_id) {
      throw new Error(
        `المستند رقم (${originalDoc.doc_number}) معكوس مسبقاً بواسطة المستند العكسي (${originalDoc.reversed_by_id}). لا يمكن عكس المستند أكثر من مرة.`
      );
    }

    // 2. التحقق من عدم وجود مستندات معتمدة عليه (سندات قبض، صرف، أو مردودات)
    const dependentDocs = await this.storage.findDependentDocuments(docId);
    const activeDependents = dependentDocs.filter(
      (d) => d.status !== 'CANCELLED' && d.status !== 'REVERSED'
    );

    if (activeDependents.length > 0) {
      const depNumbers = activeDependents.map((d) => d.doc_number).join(', ');
      throw new Error(
        `لا يمكن عكس المستند لأن هناك (${activeDependents.length}) مستندات نشطة معتمدة عليه: [${depNumbers}]. يجب عكس أو تسوية المستندات التابعة أولاً.`
      );
    }

    const now = new Date().toISOString();
    const reverseDocId = 'doc-rev-' + Math.random().toString(36).substring(2, 11);
    const reverseJournalId = 'jv-rev-' + Math.random().toString(36).substring(2, 11);
    const reverseDocNumber = `REV-${originalDoc.doc_number}`;

    // جلب القيد الأصلي لعكسه
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
      id: `line-rev-${reverseDocId}-${index}`,
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
      reverses_id: originalDoc.id, // يشير للمستند الأصلي
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
      id: `jl-rev-${reverseJournalId}-${idx}`,
      company_id: originalDoc.company_id,
      journal_entry_id: reverseJournalId,
      account_id: origLine.account_id,
      account_code: origLine.account_code,
      account_name_ar: origLine.account_name_ar,
      debit: origLine.credit, // قلب الأطراف بدقة
      credit: origLine.debit, // قلب الأطراف بدقة
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

    // حفظ السند العكسي والقيد العكسي
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
      await this.storage.updatePartnerBalance(originalDoc.entity_id, partnerDelta);
    }

    // 5. تحديث السند الأصلي
    const updatedOriginalDoc: DocumentV2 = {
      ...originalDoc,
      status: 'REVERSED',
      reversed_by_id: reverseDocument.id,
      reversed_at: now,
      reversed_by: userId,
      updated_at: now,
    };

    await this.storage.saveDocument(updatedOriginalDoc);

    // تسجيل العملية في الـ Audit Log
    await this.storage.saveAuditLog({
      id: 'audit-' + Math.random().toString(36).substring(2, 11),
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

    return {
      originalDocument: updatedOriginalDoc,
      reverseDocument,
      reverseJournalEntry,
    };
  }

  /**
   * 3. إلغاء المستند (cancelDocument)
   * 
   * المسار:
   * - التحقق من أن المستند لم يتم ترحيله بعد (فقط DRAFT أو APPROVED).
   * - رفض إلغاء أي مستند POSTED وتوجيهه لاستخدام reverseDocument بدلاً من ذلك.
   * - إلزامية وجود سبب الإلغاء (reason).
   * - تغيير الحالة إلى CANCELLED وتوثيق المستخدم والوقت والسبب.
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

    if (!doc.company_id) {
      throw new Error('خطأ أمني: المستند غير مرتبط بشركة محددة (company_id مفقود).');
    }

    // الشروط الصارمة للإلغاء
    if (doc.status === 'POSTED') {
      throw new Error(
        `لا يمكن إلغاء المستند رقم (${doc.doc_number}) لأنه مرحّل محاسبياً إلى دفتر الأستاذ العام. يمنع القانون المحاسبي حذف أو إلغاء القيود المرحلة، ويجب استخدام عملية العكس النظامية (reverseDocument).`
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

    await this.storage.saveDocument(cancelledDoc);

    // تسجيل العملية في الـ Audit Log
    await this.storage.saveAuditLog({
      id: 'audit-' + Math.random().toString(36).substring(2, 11),
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

    return cancelledDoc;
  }

  // =============================================================
  // مساعدات بناء القيود المزدوجة (Double-Entry Builders)
  // =============================================================

  private async buildDoubleEntryLines(
    doc: DocumentV2,
    journalEntryId: string
  ): Promise<JournalLineV2[]> {
    const lines: JournalLineV2[] = [];
    const companyId = doc.company_id;
    const now = new Date().toISOString();

    // جلب الحسابات الافتراضية للشركة
    const arAccount = await this.storage.getAccountByCode(companyId, '1120') ||
                      await this.storage.getAccountByCode(companyId, '1121'); // الذمم المدينة
    const apAccount = await this.storage.getAccountByCode(companyId, '2110') ||
                      await this.storage.getAccountByCode(companyId, '2111'); // الذمم الدائنة
    const salesRevAccount = await this.storage.getAccountByCode(companyId, '4100') ||
                            await this.storage.getAccountByCode(companyId, '4110'); // إيرادات المبيعات
    const cogsAccount = await this.storage.getAccountByCode(companyId, '5100') ||
                        await this.storage.getAccountByCode(companyId, '5110'); // تكلفة البضاعة المباعة
    const inventoryAccount = await this.storage.getAccountByCode(companyId, '1130') ||
                            await this.storage.getAccountByCode(companyId, '1131'); // المخزون
    const defaultBankCash = await this.storage.getAccountByCode(companyId, '1111') ||
                            await this.storage.getAccountByCode(companyId, '1110'); // الصندوق / البنك

    const paymentAcc = doc.payment_account_id
      ? await this.storage.getAccount(doc.payment_account_id)
      : defaultBankCash;

    switch (doc.doc_type) {
      case 'SALES_INVOICE': {
        const debitAcc = doc.payment_method === 'CASH' || doc.payment_method === 'KNET' ? paymentAcc : arAccount;
        if (!debitAcc || !salesRevAccount) {
          throw new Error('تعذر إيجاد حسابات الذمم المدينة أو المبيعات لإتمام القيد المزدوج للفاتورة.');
        }

        // الطرف المدين: العميل أو الصندوق
        lines.push({
          id: `jl-${journalEntryId}-1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: debitAcc.id,
          account_code: debitAcc.code,
          account_name_ar: debitAcc.nameAr,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `استحقاق فاتورة مبيعات رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // الطرف الدائن: إيراد المبيعات
        lines.push({
          id: `jl-${journalEntryId}-2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: salesRevAccount.id,
          account_code: salesRevAccount.code,
          account_name_ar: salesRevAccount.nameAr,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `إيراد مبيعات فاتورة رقم (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }

      case 'SALES_RETURN': {
        const creditAcc = doc.payment_method === 'CASH' ? paymentAcc : arAccount;
        if (!creditAcc || !salesRevAccount) {
          throw new Error('تعذر إيجاد الحسابات المحاسبية لإتمام قيد مردود المبيعات.');
        }

        // الطرف المدين: مردودات المبيعات
        lines.push({
          id: `jl-${journalEntryId}-1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: salesRevAccount.id,
          account_code: salesRevAccount.code,
          account_name_ar: salesRevAccount.nameAr,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `مردودات مبيعات - مستند رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // الطرف الدائن: العميل أو الصندوق
        lines.push({
          id: `jl-${journalEntryId}-2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: creditAcc.id,
          account_code: creditAcc.code,
          account_name_ar: creditAcc.nameAr,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `دائنية العميل لمردود مبيعات (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }

      case 'RECEIPT_VOUCHER': {
        const cashBankAcc = paymentAcc || defaultBankCash;
        if (!cashBankAcc || !arAccount) {
          throw new Error('تعذر إيجاد حساب البنك/الصندوق أو الذمم المدينة لإتمام سند القبض.');
        }

        // الطرف المدين: البنك أو الصندوق المستلم
        lines.push({
          id: `jl-${journalEntryId}-1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: cashBankAcc.id,
          account_code: cashBankAcc.code,
          account_name_ar: cashBankAcc.nameAr,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'CUSTOMER',
          memo: `تحصيل سند قبض رقم (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // الطرف الدائن: العميل (تخفيض المديونية)
        lines.push({
          id: `jl-${journalEntryId}-2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: arAccount.id,
          account_code: arAccount.code,
          account_name_ar: arAccount.nameAr,
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

      case 'PAYMENT_VOUCHER': {
        const cashBankAcc = paymentAcc || defaultBankCash;
        if (!cashBankAcc || !apAccount) {
          throw new Error('تعذر إيجاد حساب البنك/الصندوق أو الذمم الدائنة لإتمام سند الصرف.');
        }

        // الطرف المدين: المورد (تخفيض التزاماتنا)
        lines.push({
          id: `jl-${journalEntryId}-1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: apAccount.id,
          account_code: apAccount.code,
          account_name_ar: apAccount.nameAr,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          entity_type: 'SUPPLIER',
          memo: `سداد لمورد بموجب سند صرف (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });

        // الطرف الدائن: البنك أو الصندوق المنصرف منه
        lines.push({
          id: `jl-${journalEntryId}-2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: cashBankAcc.id,
          account_code: cashBankAcc.code,
          account_name_ar: cashBankAcc.nameAr,
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

      default: {
        // للمستندات العامة: قيد توازن بسيط بين الصندوق والحساب الوسيط
        const acc1 = paymentAcc || defaultBankCash;
        const acc2 = arAccount || salesRevAccount;
        if (!acc1 || !acc2) {
          throw new Error('تعذر إنشاء القيد العام لعدم اكتمال الحسابات الافتراضية.');
        }
        lines.push({
          id: `jl-${journalEntryId}-1`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: acc1.id,
          account_code: acc1.code,
          account_name_ar: acc1.nameAr,
          debit: doc.grand_total,
          credit: 0,
          entity_id: doc.entity_id || null,
          memo: `قيد ترحيل مستند (${doc.doc_number})`,
          line_number: 1,
          created_at: now,
        });
        lines.push({
          id: `jl-${journalEntryId}-2`,
          company_id: companyId,
          journal_entry_id: journalEntryId,
          account_id: acc2.id,
          account_code: acc2.code,
          account_name_ar: acc2.nameAr,
          debit: 0,
          credit: doc.grand_total,
          entity_id: doc.entity_id || null,
          memo: `مقابل ترحيل مستند (${doc.doc_number})`,
          line_number: 2,
          created_at: now,
        });
        break;
      }
    }

    return lines;
  }

  private calculatePartnerBalanceDelta(doc: DocumentV2): number {
    switch (doc.doc_type) {
      case 'SALES_INVOICE':
        return doc.payment_method === 'CASH' ? 0 : doc.grand_total; // تزيد مديونية العميل
      case 'SALES_RETURN':
        return -doc.grand_total; // تنقص مديونية العميل
      case 'RECEIPT_VOUCHER':
        return -doc.grand_total; // تنقص مديونية العميل بالسداد
      case 'PAYMENT_VOUCHER':
        return doc.grand_total; // تسديد للمورد (يقلل رصيده الدائن)
      case 'PURCHASE_INVOICE':
        return -doc.grand_total; // يزيد دائنية المورد
      default:
        return 0;
    }
  }

  private getDocumentTypeArabicName(type: string): string {
    const map: Record<string, string> = {
      SALES_INVOICE: 'فاتورة مبيعات',
      SALES_RETURN: 'مردود مبيعات',
      PURCHASE_INVOICE: 'فاتورة مشتريات',
      PURCHASE_RETURN: 'مردود مشتريات',
      RECEIPT_VOUCHER: 'سند قبض',
      PAYMENT_VOUCHER: 'سند صرف',
      JOURNAL_VOUCHER: 'قيد يومية',
    };
    return map[type] || 'مستند مالي';
  }
}
