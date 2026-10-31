/**
 * Logix ERP v2 - Unified Enterprise Accounting Schema
 * 
 * Architecture Principles:
 * 1. Strict Multi-Tenant Isolation (company_id on every entity and query)
 * 2. Unified Document Model (Single documents table with strict lifecycle states)
 * 3. Immutable Double-Entry General Ledger (Strong 1-to-1 link between documents and journal entries)
 * 4. Non-Destructive Reversal Engine (status: REVERSED, linked via reverses_id & reversed_by_id)
 * 5. Unified Partners Model (Customers & Suppliers unified with clean subledger routing)
 */

export type DocumentTypeV2 =
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'RECEIPT_VOUCHER'
  | 'PAYMENT_VOUCHER'
  | 'JOURNAL_VOUCHER'
  | 'INVENTORY_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'PRODUCTION_ISSUE'
  | 'PRODUCTION_RECEIPT';

export type DocumentStatusV2 =
  | 'DRAFT'
  | 'APPROVED'
  | 'POSTED'
  | 'REVERSED'
  | 'CANCELLED';

export type PartnerTypeV2 = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';

export type AccountCategoryV2 = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type AccountTypeV2 = 'ROOT' | 'HEADER' | 'DETAIL';

export type NormalBalanceV2 = 'DEBIT' | 'CREDIT';

export type PaymentMethodV2 = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'KNET' | 'CREDIT' | 'SPLIT';

// -------------------------------------------------------------
// 1. الشركات (Tenants / Multi-Tenant Isolation)
// -------------------------------------------------------------
export interface CompanyV2 {
  id: string; // Canonical UUID (e.g., '20000000-0000-0000-0000-000000000001')
  nameAr: string;
  nameEn: string;
  tradeName?: string;
  taxNumber?: string;
  crNumber?: string;
  crIssueDate?: string;
  crExpiryDate?: string;
  chamberNumber?: string;
  vatRate: number; // e.g., 0 for KWD standard
  vatType: 'STANDARD' | 'EXEMPT' | 'ZERO' | 'NONE';
  fiscalYearStart: string; // YYYY-MM-DD
  fiscalYearEnd: string;   // YYYY-MM-DD
  functionalCurrency: string; // e.g., 'KWD'
  decimalPlaces: number; // 3 for KWD, 2 for SAR/USD
  accountingBasis: 'ACCRUAL' | 'CASH';
  inventoryCosting: 'WEIGHTED_AVERAGE' | 'FIFO' | 'LIFO';
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 2. المستخدمين (مرتبطين بالشركات وصلاحيات العزل)
// -------------------------------------------------------------
export interface UserV2 {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'SALES_REP' | 'VIEWER';
  company_ids: string[]; // Companies this user is authorized to access
  current_company_id?: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 3. دليل الحسابات (شجرة الحسابات المنظمة)
// -------------------------------------------------------------
export interface AccountV2 {
  id: string;
  company_id: string; // Tenant isolation key
  code: string; // e.g. "1000", "1110", "1111", "1120", "2110", "3110", "4110", "5110"
  nameAr: string;
  nameEn?: string;
  category: AccountCategoryV2;
  type: AccountTypeV2; // ROOT (مستوى رئيسي), HEADER (حساب تجميعي), DETAIL (حساب فرعي يقبل القيود)
  normal_balance: NormalBalanceV2; // DEBIT (مدين طبيعته) | CREDIT (دائن طبيعته)
  parent_id: string | null;
  level: number; // 1: Root, 2: Group, 3: Control Header, 4: Sub-account
  is_postable: boolean; // Only DETAIL accounts are postable
  balance: number; // Dynamic calculated balance: (Debit - Credit) or (Credit - Debit) based on nature
  opening_balance: number;
  currency: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 4. الشركاء (العملاء + الموردين الموحدين)
// -------------------------------------------------------------
export interface PartnerV2 {
  id: string;
  company_id: string; // Tenant isolation key
  type: PartnerTypeV2; // CUSTOMER | SUPPLIER | BOTH
  code: string; // e.g., "00189", "SUPP-201"
  nameAr: string;
  nameEn?: string;
  taxNumber?: string;
  crNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  governorate?: string;
  balance: number; // Current outstanding balance
  opening_balance: number;
  credit_limit?: number;
  account_id?: string; // Subledger account ID in Chart of Accounts (e.g. 1121001 or 2111001)
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 5. بنود المستند (تفاصيل سطور الفاتورة / السند)
// -------------------------------------------------------------
export interface DocumentLineV2 {
  id: string;
  company_id: string;
  document_id: string;
  item_id?: string;
  item_code?: string;
  item_name_ar?: string;
  item_name_en?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  subtotal: number;
  discount_amount: number;
  discount_percent?: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  warehouse_id?: string;
  notes?: string;
  created_at: string;
}

// -------------------------------------------------------------
// 6. المستندات الموحدة (أهم جدول في بنية النظام v2)
// -------------------------------------------------------------
export interface DocumentV2 {
  id: string; // Primary Key UUID
  company_id: string; // Tenant isolation key
  branch_id: string;
  doc_type: DocumentTypeV2;
  doc_number: string; // Official sequential number (e.g. "INV-SAL-2026-0142", "RCV-2026-0001", "REV-RCV-2026-0001")
  doc_date: string; // YYYY-MM-DD
  due_date?: string; // YYYY-MM-DD
  status: DocumentStatusV2; // DRAFT | APPROVED | POSTED | REVERSED | CANCELLED

  // العلاقات المحاسبية والرقابية الحرجة (Critical Audit Links)
  journal_entry_id?: string | null; // معرف القيد اليومي المزدوج الناتج عن الترحيل
  reverses_id?: string | null;      // في حالة كان هذا مستنداً عكسياً، يشير للمستند الأصلي
  reversed_by_id?: string | null;   // في حالة تم عكس هذا المستند، يشير للمستند العكسي الجديد

  // جهة التعامل والمستودع
  entity_id?: string | null; // معرف الشريك (Partner ID: Customer / Supplier)
  warehouse_id?: string | null;

  // طريقة السداد وحساب الوسيط المالي
  payment_method?: PaymentMethodV2;
  payment_account_id?: string | null; // حساب الصندوق أو البنك في سندات القبض/الصرف أو المبيعات النقدية
  check_number?: string;
  check_bank_name?: string;
  check_due_date?: string;

  // المبالغ المالية
  subtotal: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;

  // دورة الحياة والرقابة الصارمة (Lifecycle Audit Timestamps)
  posted_at?: string | null;
  posted_by?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;

  notes?: string;
  reference_no?: string; // رقم مرجع خارجي أو رقم فاتورة مسددة
  created_by: string;
  created_at: string;
  updated_at: string;

  // البنود التفصيلية
  lines?: DocumentLineV2[];
}

// -------------------------------------------------------------
// 7. القيود المحاسبية العامة (Double-entry Journal Entries)
// -------------------------------------------------------------
export interface JournalEntryV2 {
  id: string;
  company_id: string; // Tenant isolation key
  entry_number: string; // e.g. "JV-2026-0001", "REV-JV-2026-0001"
  date: string; // YYYY-MM-DD
  description: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | 'CANCELLED';

  // الربط القوي مع المستند المصدر
  source_document_id?: string | null; // Foreign key directly linking to documents.id
  source_document_type?: DocumentTypeV2 | 'MANUAL';

  reverses_journal_id?: string | null;
  reversed_by_journal_id?: string | null;

  total_debit: number;
  total_credit: number;
  is_balanced: boolean; // Debit === Credit validation guarantee

  posted_at?: string;
  posted_by?: string;
  reversed_at?: string;
  reversed_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;

  lines: JournalLineV2[];
}

// -------------------------------------------------------------
// 8. بنود القيد المحاسبي (Double-entry Journal Lines)
// -------------------------------------------------------------
export interface JournalLineV2 {
  id: string;
  company_id: string; // Tenant isolation key
  journal_entry_id: string;
  account_id: string; // Foreign key to AccountV2
  account_code: string;
  account_name_ar: string;
  debit: number; // >= 0
  credit: number; // >= 0
  entity_id?: string | null; // Subledger partner ID (Customer/Supplier)
  entity_type?: 'CUSTOMER' | 'SUPPLIER' | 'NONE';
  memo: string;
  line_number: number;
  created_at: string;
}

// -------------------------------------------------------------
// 9. سجل التدقيق والرقابة المالية (Audit Log)
// -------------------------------------------------------------
export interface AuditLogV2 {
  id: string;
  company_id: string;
  user_id: string;
  action:
    | 'DOCUMENT_CREATE'
    | 'DOCUMENT_POST'
    | 'DOCUMENT_REVERSE'
    | 'DOCUMENT_CANCEL'
    | 'JOURNAL_POST'
    | 'MIGRATION_EXECUTE';
  entity_type: 'DOCUMENT' | 'JOURNAL' | 'ACCOUNT' | 'PARTNER';
  entity_id: string;
  details: Record<string, any>;
  timestamp: string;
  ip_address?: string;
}
