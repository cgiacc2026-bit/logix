/**
 * Logix ERP v2.1 - Unified Enterprise Accounting Schema
 * File: src/types/unifiedV2.ts
 * 
 * Strict snake_case naming standard with complete multi-tenant isolation.
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

export type SystemAccountRole =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'SALES_REVENUE'
  | 'SALES_RETURN'
  | 'PURCHASE_EXPENSE'
  | 'PURCHASE_RETURN'
  | 'INVENTORY'
  | 'COGS'
  | 'CASH_OR_BANK'
  | 'VAT_OUTPUT'
  | 'VAT_INPUT'
  | 'INVENTORY_ADJUSTMENT_DIFF';

// -------------------------------------------------------------
// 1. الشركات (Tenants / Multi-Tenant Isolation)
// -------------------------------------------------------------
export interface CompanyV2 {
  id: string; // Canonical UUID (e.g. '20000000-0000-0000-0000-000000000001')
  name_ar: string;
  name_en: string;
  trade_name?: string;
  tax_number?: string;
  cr_number?: string;
  cr_issue_date?: string;
  cr_expiry_date?: string;
  chamber_number?: string;
  vat_rate: number;
  vat_type: 'STANDARD' | 'EXEMPT' | 'ZERO' | 'NONE';
  fiscal_year_start: string; // YYYY-MM-DD
  fiscal_year_end: string;   // YYYY-MM-DD
  functional_currency: string;
  decimal_places: number;
  accounting_basis: 'ACCRUAL' | 'CASH';
  inventory_costing: 'WEIGHTED_AVERAGE' | 'FIFO' | 'LIFO';
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Backward compatibility getters / optional aliases
  nameAr?: string;
  nameEn?: string;
}

// -------------------------------------------------------------
// 2. المستخدمين (Users & Roles)
// -------------------------------------------------------------
export interface UserV2 {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'SALES_REP' | 'VIEWER';
  company_ids: string[];
  current_company_id?: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 3. دليل الحسابات (Chart of Accounts)
// -------------------------------------------------------------
export interface AccountV2 {
  id: string;
  company_id: string;
  code: string;
  name_ar: string;
  name_en?: string;
  category: AccountCategoryV2;
  type: AccountTypeV2;
  normal_balance: NormalBalanceV2;
  parent_id: string | null;
  level: number;
  is_postable: boolean;
  balance: number;
  opening_balance: number;
  currency: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Optional aliases for legacy compatibility
  nameAr?: string;
  nameEn?: string;
}

// -------------------------------------------------------------
// 4. الشركاء (Partners: Customers & Suppliers Unified)
// -------------------------------------------------------------
export interface PartnerV2 {
  id: string;
  company_id: string;
  type: PartnerTypeV2;
  code: string;
  name_ar: string;
  name_en?: string;
  tax_number?: string;
  cr_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  governorate?: string;
  balance: number;
  opening_balance: number;
  credit_limit?: number;
  account_id?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Optional aliases
  nameAr?: string;
  nameEn?: string;
}

// -------------------------------------------------------------
// 5. بنود المستند (Document Lines)
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
// 6. المستندات الموحدة (Unified Documents Table)
// -------------------------------------------------------------
export interface DocumentV2 {
  id: string;
  company_id: string;
  branch_id: string;
  doc_type: DocumentTypeV2;
  doc_number: string;
  doc_date: string;
  due_date?: string;
  status: DocumentStatusV2;

  // العلاقات المحاسبية والرقابية الحرجة
  journal_entry_id?: string | null;
  reverses_id?: string | null;
  reversed_by_id?: string | null;

  // الشريك والمستودع
  entity_id?: string | null;
  warehouse_id?: string | null;

  // طريقة السداد والوسيط المالي
  payment_method?: PaymentMethodV2;
  payment_account_id?: string | null;
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

  // دورة الحياة والرقابة الصارمة
  posted_at?: string | null;
  posted_by?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;

  notes?: string;
  reference_no?: string;
  created_by: string;
  created_at: string;
  updated_at: string;

  lines?: DocumentLineV2[];
}

// -------------------------------------------------------------
// 7. القيود المحاسبية العامة (Double-entry Journal Entries)
// -------------------------------------------------------------
export interface JournalEntryV2 {
  id: string;
  company_id: string;
  entry_number: string;
  date: string;
  description: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | 'CANCELLED';

  source_document_id?: string | null;
  source_document_type?: DocumentTypeV2 | 'MANUAL';

  reverses_journal_id?: string | null;
  reversed_by_journal_id?: string | null;

  total_debit: number;
  total_credit: number;
  is_balanced: boolean;

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
  company_id: string;
  journal_entry_id: string;
  account_id: string;
  account_code: string;
  account_name_ar: string;
  debit: number;
  credit: number;
  entity_id?: string | null;
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
