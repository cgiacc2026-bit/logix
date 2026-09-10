const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const target = `const parsed = JSON.parse(jsonContent);`;
const replace = `let parsed;
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          throw new Error('الملف المرفوع يحتوي على أخطاء برمجية أو مقطوع. الرجاء نسخ كامل كود JSON ولصقه في ملف نصي وحفظه كـ .json ثم رفعه.');
        }`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/CompanySetupView.tsx', code);
console.log("Added parse guard.");
