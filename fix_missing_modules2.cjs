const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

if (!appCode.includes("<StockLedgerAndAuditView")) {
  const insertBefore = "          {(activeTab === 'invoices' ||";
  const toInsert = `          {activeTab === 'stock-ledger' && (
            <StockLedgerAndAuditView
              inventory={inventory}
              invoices={invoices}
              currency={currency}
              isAlwaleed={activeCompanyId === '20000000-0000-0000-0000-000000000001'}
            />
          )}\n\n`;
          
  appCode = appCode.replace(insertBefore, toInsert + insertBefore);
  fs.writeFileSync('src/App.tsx', appCode);
}
