const fs = require('fs');

let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const target = `const parsed = JSON.parse(restoreJsonStr);`;
const replace = `let parsed;
try {
  parsed = JSON.parse(restoreJsonStr);
} catch (e) {
  setErrorMessage('يبدو أن كود الـ JSON غير مكتمل (ربما لأن النص طويل جداً وتم قطعه عند النسخ). يرجى التأكد من نسخ الكود كاملاً من البداية { وحتى النهاية }');
  setIsRestoring(false);
  return;
}`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/CompanySetupView.tsx', code);
console.log("Added JSON Parse error handling");

