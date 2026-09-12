// Unified TabType Definition for LOGIX ERP Navigation
export type TabType =
  | 'dashboard'
  // 1. Accounting Module
  | 'accounts'
  | 'journals'
  | 'ledger'
  | 'trial-balance'
  | 'financials'
  // 2. Sales & Customers Module
  | 'sales-invoices'
  | 'quotations'
  | 'customers'
  | 'receipt-vouchers'
  | 'customer-statements'
  | 'sales-reps'
  // 3. Purchasing & Suppliers Module
  | 'purchase-invoices'
  | 'suppliers'
  | 'payment-vouchers'
  | 'supplier-statements'
  // 4. Inventory Module
  | 'inventory'
  | 'stock-ledger'
  | 'warehouses'
  | 'units'
  | 'production'
  // 5. POS Module
  | 'pos'
  // 6. Core System Settings Module
  | 'company'
  | 'branches'
  | 'users'
  | 'backup-restore'
  | 'reports'
  | 'system-reset'
  // Legacy Aliases
  | 'invoices'
  | 'vouchers'
  | 'entities'
  | 'statements';
