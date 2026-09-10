const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');
console.log(code.includes('IFRS Compliant Automated Journal'));
