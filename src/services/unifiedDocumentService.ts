import {
  UnifiedDocument,
  DocumentLine,
  DocumentType,
  DocumentStatus,
  Partner,
  JournalEntry,
  JournalLine,
  Invoice,
  PaymentVoucher,
  Customer,
  Supplier,
} from '../types';
import { DataService, localDataStore } from './dataService';
import { AccountingEngine } from '../server/accountingEngine';

export class UnifiedDocumentService {
  private static STORAGE_KEY_DOCUMENTS = 'unified_documents_v2026';
  private static STORAGE_KEY_PARTNERS = 'unified_partners_v2026';

  /**
   * Helper to retrieve all unified documents
   */
  public static async getDocuments(companyId?: string): Promise<UnifiedDocument[]> {
    const raw = localStorage.getItem(this.STORAGE_KEY_DOCUMENTS);
    let docs: UnifiedDocument[] = raw ? JSON.parse(raw) : [];

    // If empty in local storage, bootstrap from invoices and vouchers
    if (docs.length === 0) {
      docs = this.bootstrapFromExistingData(companyId);
      this.saveDocuments(docs);
    }

    if (companyId) {
      return docs.filter((d) => !d.company_id || d.company_id === companyId);
    }
    return docs;
  }

  /**
   * Save documents to local cache
   */
  public static saveDocuments(docs: UnifiedDocument[]): void {
    localStorage.setItem(this.STORAGE_KEY_DOCUMENTS, JSON.stringify(docs));
  }

  /**
   * Get single document by ID
   */
  public static async getDocument(docId: string): Promise<UnifiedDocument | null> {
    const docs = await this.getDocuments();
    return docs.find((d) => d.id === docId) || null;
  }

  /**
   * Create document
   */
  public static async createDocument(docData: Partial<UnifiedDocument>): Promise<UnifiedDocument> {
    const docs = await this.getDocuments();
    const nowStr = new Date().toISOString();

    const newDoc: UnifiedDocument = {
      id: docData.id || 'doc-' + Math.random().toString(36).substr(2, 9),
      company_id: docData.company_id || '20000000-0000-0000-0000-000000000001',
      branch_id: docData.branch_id || 'br-main',
      doc_type: docData.doc_type || 'SALES_INVOICE',
      doc_number: docData.doc_number || `DOC-${Date.now().toString().slice(-6)}`,
      status: docData.status || 'DRAFT',
      journal_entry_id: docData.journal_entry_id,
      reverses_id: docData.reverses_id,
      reversed_by_id: docData.reversed_by_id,
      subtotal: docData.subtotal || 0,
      discount_total: docData.discount_total || 0,
      vat_total: docData.vat_total || 0,
      grand_total: docData.grand_total || 0,
      paid_amount: docData.paid_amount || 0,
      due_amount: docData.due_amount || 0,
      posted_at: docData.posted_at,
      posted_by: docData.posted_by,
      reversed_at: docData.reversed_at,
      reversed_by: docData.reversed_by,
      cancelled_at: docData.cancelled_at,
      cancelled_by: docData.cancelled_by,
      entity_id: docData.entity_id,
      warehouse_id: docData.warehouse_id,
      notes: docData.notes || '',
      created_at: docData.created_at || nowStr,
      updated_at: nowStr,
      lines: docData.lines || [],
    };

    docs.unshift(newDoc);
    this.saveDocuments(docs);
    return newDoc;
  }

  /**
   * Update existing document
   */
  public static async updateDocument(
    docId: string,
    updates: Partial<UnifiedDocument>
  ): Promise<UnifiedDocument> {
    const docs = await this.getDocuments();
    const index = docs.findIndex((d) => d.id === docId);
    if (index === -1) {
      throw new Error(`المستند برقم المعرف ${docId} غير موجود.`);
    }

    const updated = {
      ...docs[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    docs[index] = updated;
    this.saveDocuments(docs);
    return updated;
  }

  /**
   * Find dependent documents (e.g. vouchers, payments, returns, or downstream documents)
   */
  public static async findDependentDocuments(docId: string): Promise<UnifiedDocument[]> {
    const docs = await this.getDocuments();
    const target = docs.find((d) => d.id === docId);
    if (!target) return [];

    const dependents: UnifiedDocument[] = [];

    for (const d of docs) {
      // Ignore self and already cancelled/reversed documents
      if (d.id === docId || d.status === 'CANCELLED' || d.status === 'REVERSED') continue;

      // 1. If d reverses this doc, it is a dependent reverse doc
      if (d.reverses_id === docId) {
        dependents.push(d);
        continue;
      }

      // 2. If target is an invoice and d is a voucher or return applied to it
      if (
        target.doc_type === 'SALES_INVOICE' &&
        (d.doc_type === 'RECEIPT_VOUCHER' || d.doc_type === 'SALES_RETURN')
      ) {
        if (d.notes && d.notes.includes(target.doc_number)) {
          dependents.push(d);
          continue;
        }
      }

      // 3. If target is a purchase invoice and d is a payment voucher or return applied to it
      if (
        target.doc_type === 'PURCHASE_INVOICE' &&
        (d.doc_type === 'PAYMENT_VOUCHER' || d.doc_type === 'PURCHASE_RETURN')
      ) {
        if (d.notes && d.notes.includes(target.doc_number)) {
          dependents.push(d);
          continue;
        }
      }
    }

    // Also check active vouchers in system
    const activeVouchers = localDataStore.getVouchers();
    for (const v of activeVouchers) {
      if (v.status !== 'CANCELLED' && !v.is_void) {
        if (v.invoiceId === docId || (v.reference && v.reference.includes(target.doc_number))) {
          // Add as synthetic dependent document if not already in list
          if (!dependents.some((d) => d.id === v.id)) {
            dependents.push(this.convertVoucherToUnifiedDoc(v));
          }
        }
      }
    }

    return dependents;
  }

  /**
   * Generate clean reversed document sequence number
   */
  public static generateReverseNumber(originalDocNumber: string): string {
    if (!originalDocNumber) return `REV-${Date.now().toString().slice(-6)}`;
    if (originalDocNumber.startsWith('REV-')) {
      return `REV2-${originalDocNumber.replace('REV-', '')}`;
    }
    return `REV-${originalDocNumber}`;
  }

  /**
   * Automatically generate 100% reversed journal entry with inverted debits and credits
   */
  public static async createReverseJournalEntry(
    originalJournalId: string | undefined,
    reverseDocId: string
  ): Promise<string> {
    if (!originalJournalId) {
      console.warn('Original document has no journal_entry_id to reverse.');
      return '';
    }

    const journals = localDataStore.getJournals();
    const original = journals.find((j) => j.id === originalJournalId);
    if (!original) {
      console.warn(`Journal entry ${originalJournalId} not found for reversal.`);
      return '';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const reversalNumber = `REV-${original.entryNumber}`;

    const reversedLines: JournalLine[] = (original.lines || []).map((line) => ({
      id: 'jl-' + Math.random().toString(36).substr(2, 9),
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountNameAr: line.accountNameAr,
      debit: line.credit, // Swap debit & credit
      credit: line.debit,
      memo: `عكس قيد مستند: ${line.memo || original.description}`,
      entityType: line.entityType || 'NONE',
      entityId: line.entityId,
      entityNameAr: line.entityNameAr,
      companyId: original.companyId || '20000000-0000-0000-0000-000000000001',
    }));

    const reversalEntry: JournalEntry = {
      id: 'jv-rev-' + Math.random().toString(36).substr(2, 9),
      companyId: original.companyId || '20000000-0000-0000-0000-000000000001',
      entryNumber: reversalNumber,
      date: todayStr,
      reference: `عكس مستند: ${reverseDocId}`,
      description: `قيد عكسي آلي 100% للقيد رقم (${original.entryNumber}) ناتج عن عكس المستند`,
      status: 'POSTED',
      lines: reversedLines,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: 'INVOICE_REVERSAL',
      sourceId: reverseDocId,
    };

    // Save reversal journal
    journals.unshift(reversalEntry);
    localDataStore.saveJournals(journals);
    DataService.syncAccountBalances();

    return reversalEntry.id;
  }

  /**
   * EXACT REVERSAL FUNCTION IMPLEMENTED PER SPECIFICATION:
   * 
   * async function reverseDocument(docId: string, userId: string) {
   *   const doc = await getDocument(docId);
   *   // 1. الشروط الصارمة
   *   if (doc.status !== "POSTED") throw "لا يمكن عكس مستند غير مرحّل";
   *   if (doc.reversed_by_id) throw "المستند معكوس مسبقاً";
   *   // 2. التحقق من عدم وجود مستندات معتمدة عليه
   *   const dependent = await findDependentDocuments(docId);
   *   if (dependent.length > 0) throw `لا يمكن العكس لأن هناك ${dependent.length} مستند معتمد عليه`;
   *   // 3. إنشاء سند عكسي جديد (مش تعديل القديم)
   *   ...
   *   // 4. توليد قيد عكسي تلقائي 100%
   *   ...
   *   // 5. تحديث السند الأصلي
   *   ...
   * }
   */
  public static async reverseDocument(
    docId: string,
    userId: string = 'system_user'
  ): Promise<{
    originalDoc: UnifiedDocument;
    reverseDoc: UnifiedDocument;
    reverseJournalId: string;
  }> {
    const doc = await this.getDocument(docId);
    if (!doc) {
      throw new Error(`المستند المراد عكسه (${docId}) غير موجود.`);
    }

    // 1. الشروط الصارمة
    if (doc.status !== 'POSTED') {
      throw new Error('لا يمكن عكس مستند غير مرحّل.');
    }
    if (doc.reversed_by_id) {
      throw new Error('المستند معكوس مسبقاً.');
    }

    // 2. التحقق من عدم وجود مستندات معتمدة عليه
    const dependent = await this.findDependentDocuments(docId);
    if (dependent.length > 0) {
      const depNumbers = dependent.map((d) => d.doc_number).join(', ');
      throw new Error(
        `لا يمكن العكس لأن هناك ${dependent.length} مستند معتمد عليه (${depNumbers}). يجب إلغاء أو تسوية المستندات المرتبطة أولاً.`
      );
    }

    const now = new Date().toISOString();

    // 3. إنشاء سند عكسي جديد (مش تعديل القديم)
    const reversedLines: DocumentLine[] = (doc.lines || []).map((l) => ({
      ...l,
      id: 'dline-rev-' + Math.random().toString(36).substr(2, 9),
      quantity: -l.quantity,
      subtotal: -l.subtotal,
      total: -l.total,
      notes: `عكس بند: ${l.notes || ''}`,
    }));

    const reverseDoc = await this.createDocument({
      company_id: doc.company_id,
      branch_id: doc.branch_id,
      doc_type: doc.doc_type,
      doc_number: this.generateReverseNumber(doc.doc_number),
      status: 'POSTED',
      reverses_id: doc.id,
      subtotal: -doc.subtotal,
      discount_total: -doc.discount_total,
      vat_total: -doc.vat_total,
      grand_total: -doc.grand_total,
      paid_amount: -doc.paid_amount,
      due_amount: -doc.due_amount,
      posted_at: now,
      posted_by: userId,
      entity_id: doc.entity_id,
      warehouse_id: doc.warehouse_id,
      notes: `سند عكسي رسمي للمستند رقم (${doc.doc_number})`,
      lines: reversedLines,
    });

    // 4. توليد قيد عكسي تلقائي 100%
    const reverseJournalId = await this.createReverseJournalEntry(
      doc.journal_entry_id,
      reverseDoc.id
    );

    if (reverseJournalId) {
      await this.updateDocument(reverseDoc.id, {
        journal_entry_id: reverseJournalId,
      });
      reverseDoc.journal_entry_id = reverseJournalId;
    }

    // 5. تحديث السند الأصلي
    const updatedOriginal = await this.updateDocument(doc.id, {
      status: 'REVERSED',
      reversed_by_id: reverseDoc.id,
      reversed_at: now,
      reversed_by: userId,
    });

    // Mirror update into legacy invoices / vouchers so existing UI views reflect status
    this.syncStatusToLegacyTables(doc.id, 'REVERSED');

    return {
      originalDoc: updatedOriginal,
      reverseDoc,
      reverseJournalId,
    };
  }

  /**
   * Cancel an unposted (DRAFT/APPROVED) document
   */
  public static async cancelDocument(
    docId: string,
    userId: string = 'system_user'
  ): Promise<UnifiedDocument> {
    const doc = await this.getDocument(docId);
    if (!doc) throw new Error('المستند غير موجود');

    if (doc.status === 'POSTED') {
      throw new Error('المستند مرحل بالفعل، يجب استخدام عملية العكس (Reverse) بدلاً من الإلغاء.');
    }
    if (doc.status === 'REVERSED' || doc.status === 'CANCELLED') {
      throw new Error('المستند ملغي أو معكوس مسبقاً.');
    }

    const now = new Date().toISOString();
    const updated = await this.updateDocument(docId, {
      status: 'CANCELLED',
      cancelled_at: now,
      cancelled_by: userId,
    });

    this.syncStatusToLegacyTables(docId, 'CANCELLED');
    return updated;
  }

  /**
   * Sync status change to legacy invoices / vouchers store
   */
  private static syncStatusToLegacyTables(docId: string, newStatus: 'REVERSED' | 'CANCELLED') {
    // 1. Invoices
    const invoices = localDataStore.getInvoices();
    const inv = invoices.find((i) => i.id === docId);
    if (inv) {
      inv.status = newStatus === 'REVERSED' ? 'CANCELLED' : 'CANCELLED';
      inv.is_void = true;
      localDataStore.saveInvoices(invoices);
    }

    // 2. Vouchers
    const vouchers = localDataStore.getVouchers();
    const vou = vouchers.find((v) => v.id === docId);
    if (vou) {
      vou.status = 'CANCELLED';
      vou.is_void = true;
      localDataStore.saveVouchers(vouchers);
    }
  }

  /**
   * Converts a legacy Invoice into UnifiedDocument
   */
  public static convertInvoiceToUnifiedDoc(inv: Invoice): UnifiedDocument {
    let docType: DocumentType = 'SALES_INVOICE';
    if (inv.type === 'SALES_RETURN') docType = 'SALES_RETURN';
    else if (inv.type === 'PURCHASE') docType = 'PURCHASE_INVOICE';
    else if (inv.type === 'PURCHASE_RETURN') docType = 'PURCHASE_RETURN';

    let docStatus: DocumentStatus = 'DRAFT';
    if (inv.status === 'POSTED' || inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID') {
      docStatus = 'POSTED';
    } else if (inv.status === 'CANCELLED' || inv.is_void) {
      docStatus = 'CANCELLED';
    }

    const lines: DocumentLine[] = (inv.lines || []).map((l, idx) => ({
      id: l.id || `line-${inv.id}-${idx}`,
      document_id: inv.id,
      item_id: l.itemId,
      item_code: l.itemSku || l.barcode,
      item_name: l.itemNameAr || l.name,
      unit: l.unit,
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unitPrice) || 0,
      subtotal: Number(l.subtotal) || (Number(l.quantity) * Number(l.unitPrice)),
      discount_amount: Number(l.discountAmount) || 0,
      vat_amount: Number(l.vatAmount) || 0,
      total: Number(l.total) || 0,
      warehouse_id: l.warehouseId || inv.warehouseId,
      notes: l.notes,
    }));

    return {
      id: inv.id,
      company_id: inv.companyId || inv.company_id || '20000000-0000-0000-0000-000000000001',
      branch_id: inv.branchId || inv.branch_id || 'br-main',
      doc_type: docType,
      doc_number: inv.invoiceNumber,
      status: docStatus,
      journal_entry_id: inv.journalEntryId,
      subtotal: Number(inv.subtotal) || 0,
      discount_total: Number(inv.discountTotal || inv.discountValue) || 0,
      vat_total: Number(inv.vatTotal) || 0,
      grand_total: Number(inv.grandTotal) || 0,
      paid_amount: Number(inv.paidAmount) || 0,
      due_amount: Number(inv.dueAmount) || 0,
      posted_at: inv.createdAt || inv.date,
      posted_by: inv.salesPerson || 'system',
      entity_id: inv.entityId,
      warehouse_id: inv.warehouseId || inv.warehouse_id,
      notes: inv.notes || '',
      created_at: inv.createdAt || (inv.date ? `${inv.date}T00:00:00.000Z` : new Date().toISOString()),
      updated_at: inv.updatedAt || new Date().toISOString(),
      lines,
    };
  }

  /**
   * Converts a legacy PaymentVoucher into UnifiedDocument
   */
  public static convertVoucherToUnifiedDoc(v: PaymentVoucher): UnifiedDocument {
    const docType: DocumentType = v.type === 'RECEIPT' ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER';
    const docStatus: DocumentStatus = (v.status === 'CANCELLED' || v.is_void) ? 'CANCELLED' : 'POSTED';

    return {
      id: v.id,
      company_id: v.companyId || v.company_id || '20000000-0000-0000-0000-000000000001',
      branch_id: 'br-main',
      doc_type: docType,
      doc_number: v.voucherNumber,
      status: docStatus,
      journal_entry_id: v.journalEntryId,
      subtotal: Number(v.amount) || 0,
      discount_total: 0,
      vat_total: 0,
      grand_total: Number(v.amount) || 0,
      paid_amount: Number(v.amount) || 0,
      due_amount: 0,
      posted_at: v.createdAt || (v.date ? `${v.date}T00:00:00.000Z` : new Date().toISOString()),
      posted_by: v.salesRepName || 'system',
      entity_id: v.entityId || v.customerId || v.supplierId,
      notes: v.notes || (v.reference ? `مرجع: ${v.reference}` : ''),
      created_at: v.createdAt || (v.date ? `${v.date}T00:00:00.000Z` : new Date().toISOString()),
      updated_at: v.updatedAt || new Date().toISOString(),
      lines: [],
    };
  }

  /**
   * Unifies Customers & Suppliers into the Partners table
   */
  public static async getPartners(companyId?: string): Promise<Partner[]> {
    const raw = localStorage.getItem(this.STORAGE_KEY_PARTNERS);
    let partners: Partner[] = raw ? JSON.parse(raw) : [];

    if (partners.length === 0) {
      partners = this.bootstrapPartnersFromExistingData(companyId);
      localStorage.setItem(this.STORAGE_KEY_PARTNERS, JSON.stringify(partners));
    }

    if (companyId) {
      return partners.filter((p) => !p.company_id || p.company_id === companyId);
    }
    return partners;
  }

  private static bootstrapPartnersFromExistingData(companyId?: string): Partner[] {
    const compId = companyId || '20000000-0000-0000-0000-000000000001';
    const customers = localDataStore.getCustomers();
    const suppliers = localDataStore.getSuppliers();

    const partnerMap = new Map<string, Partner>();

    // 1. Customers
    customers.forEach((c) => {
      partnerMap.set(c.id, {
        id: c.id,
        company_id: compId,
        type: 'CUSTOMER',
        code: c.code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        taxNumber: c.taxNumber,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        balance: c.balance || c.currentBalance || 0,
        creditLimit: c.creditLimit,
        accountId: c.accountId,
        isActive: c.isActive !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // 2. Suppliers
    suppliers.forEach((s) => {
      const existing = partnerMap.get(s.id);
      if (existing) {
        existing.type = 'BOTH';
      } else {
        partnerMap.set(s.id, {
          id: s.id,
          company_id: compId,
          type: 'SUPPLIER',
          code: s.code,
          nameAr: s.nameAr || (s as any).name,
          nameEn: s.nameEn,
          taxNumber: s.taxNumber,
          phone: s.phone,
          email: s.email,
          address: s.address,
          city: s.city,
          balance: s.balance || 0,
          accountId: s.accountId || (s as any).account_id,
          isActive: s.isActive !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    return Array.from(partnerMap.values());
  }

  /**
   * Bootstrap documents from existing invoices and vouchers
   */
  private static bootstrapFromExistingData(companyId?: string): UnifiedDocument[] {
    const invoices = localDataStore.getInvoices();
    const vouchers = localDataStore.getVouchers();
    const list: UnifiedDocument[] = [];

    invoices.forEach((inv) => {
      list.push(this.convertInvoiceToUnifiedDoc(inv));
    });

    vouchers.forEach((v) => {
      list.push(this.convertVoucherToUnifiedDoc(v));
    });

    return list;
  }
}
