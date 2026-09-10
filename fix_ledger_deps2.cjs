const fs = require('fs');

let ledgerCode = fs.readFileSync('src/components/GeneralLedgerView.tsx', 'utf8');
ledgerCode = ledgerCode.replace(
  'interface GeneralLedgerProps {',
  'interface GeneralLedgerProps {\n  journals?: any[];'
);

ledgerCode = ledgerCode.replace(
  '  selectedAccountId,\n}) => {',
  '  selectedAccountId,\n  journals,\n}) => {'
);

ledgerCode = ledgerCode.replace(
  '  }, [currentAccountId, startDate, endDate]);',
  '  }, [currentAccountId, startDate, endDate, journals, accounts]);'
);

fs.writeFileSync('src/components/GeneralLedgerView.tsx', ledgerCode);
