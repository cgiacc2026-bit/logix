const fs = require('fs');

try {
  let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');
  console.log("Check parse:", code.includes('يبدو أن كود الـ JSON غير مكتمل'));
} catch (e) {
  console.error(e);
}

