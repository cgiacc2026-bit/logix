const fs = require('fs');

// 1. Update Navigation.tsx
let navCode = fs.readFileSync('src/components/Navigation.tsx', 'utf8');

if (!navCode.includes("'stock-ledger'")) {
  navCode = navCode.replace(
    "| 'inventory'",
    "| 'inventory'\n  | 'stock-ledger'"
  );
  
  navCode = navCode.replace(
    "{ id: 'units', label: 'وحدات القياس', icon: Scale },",
    "{ id: 'units', label: 'وحدات القياس', icon: Scale },\n        { id: 'stock-ledger', label: 'حركة المخزون (Ledger)', icon: Box },"
  );
  
  fs.writeFileSync('src/components/Navigation.tsx', navCode);
}

// 2. Update App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

if (!appCode.includes("StockLedgerAndAuditView")) {
  appCode = appCode.replace(
    "import { TrialBalanceView } from './components/TrialBalanceView.tsx';",
    "import { TrialBalanceView } from './components/TrialBalanceView.tsx';\nimport { StockLedgerAndAuditView } from './components/StockLedgerAndAuditView.tsx';"
  );
  
  appCode = appCode.replace(
    "          {activeTab === 'inventory' && (\n            <InvoicesAndInventoryView",
    "          {activeTab === 'stock-ledger' && (\n            <StockLedgerAndAuditView\n              inventory={inventory}\n              invoices={invoices}\n              currency={currency}\n              isAlwaleed={activeCompanyId === '20000000-0000-0000-0000-000000000001'}\n            />\n          )}\n          {activeTab === 'inventory' && (\n            <InvoicesAndInventoryView"
  );
  
  fs.writeFileSync('src/App.tsx', appCode);
}
