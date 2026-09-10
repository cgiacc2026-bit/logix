const fs = require('fs');
let code = fs.readFileSync('src/components/DataImportModal.tsx', 'utf8');
console.log("DataImportModal", code.includes('handleImport'));
let code2 = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');
console.log("CompanySetupView", code2.includes('handleImport'));
