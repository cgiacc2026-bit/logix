const fs = require('fs');
let code = fs.readFileSync('src/components/SystemResetPanel.tsx', 'utf8');
console.log(code.includes('handleImport'));
