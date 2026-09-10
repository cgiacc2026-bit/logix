const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  '<GeneralLedgerView\n              accounts={accounts}\n              currency={currency}\n              selectedAccountId={selectedLedgerAccountId}\n            />',
  '<GeneralLedgerView\n              accounts={accounts}\n              journals={journals}\n              currency={currency}\n              selectedAccountId={selectedLedgerAccountId}\n            />'
);
fs.writeFileSync('src/App.tsx', appCode);

let ledgerCode = fs.readFileSync('src/components/GeneralLedgerView.tsx', 'utf8');
ledgerCode = ledgerCode.replace(
  'interface GeneralLedgerProps {\n  accounts: Account[];\n  currency: string;\n  selectedAccountId?: string;\n}',
  'interface GeneralLedgerProps {\n  accounts: Account[];\n  journals?: any[];\n  currency: string;\n  selectedAccountId?: string;\n}'
);

ledgerCode = ledgerCode.replace(
  'export const GeneralLedgerView: React.FC<GeneralLedgerProps> = ({ accounts, currency, selectedAccountId }) => {',
  'export const GeneralLedgerView: React.FC<GeneralLedgerProps> = ({ accounts, journals, currency, selectedAccountId }) => {'
);

ledgerCode = ledgerCode.replace(
  '  }, [currentAccountId, startDate, endDate]);',
  '  }, [currentAccountId, startDate, endDate, journals]);'
);

fs.writeFileSync('src/components/GeneralLedgerView.tsx', ledgerCode);
