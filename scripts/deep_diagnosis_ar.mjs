import fs from 'fs';

const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));
const b2 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json', 'utf8'));
const db = JSON.parse(fs.readFileSync('./data/database.json', 'utf8'));

console.log('========================================================================');
console.log('            التشخيص المحاسبي الدقيق والمطابقة بين Subledger و GL');
console.log('========================================================================\n');

// 1. حساب مجموع opening_balance لكل الـ partners من نوع CUSTOMER
const customers = db.partners.filter(p => p.type === 'CUSTOMER');
let totalOpeningBalance = 0;
let totalSubledgerBalance = 0;

const customerRows = [];
customers.forEach(c => {
  const op = Number(c.opening_balance) || 0;
  const cur = Number(c.balance) || 0;
  totalOpeningBalance += op;
  totalSubledgerBalance += cur;
  customerRows.push({
    code: c.code,
    name: c.name_ar,
    opening: op,
    current: cur,
    diff: cur - op
  });
});

console.log('1. مجموع opening_balance لكل الـ partners من نوع CUSTOMER:');
console.log(`   الإجمالي: ${totalOpeningBalance.toFixed(3)} د.ك`);
console.log(`   إجمالي أرصدة كروت العملاء (Subledger): ${totalSubledgerBalance.toFixed(3)} د.ك`);
console.log('   تفصيل العملاء:');
customerRows.forEach(c => {
  console.log(`   - [${c.code.padEnd(8)}] ${c.name.padEnd(35)} : افتتاحي = ${c.opening.toFixed(3).padStart(9)} د.ك | رصيد حالي = ${c.current.toFixed(3).padStart(9)} د.ك | الحركة = ${c.diff.toFixed(3).padStart(9)} د.ك`);
});

// 2 & 3. حساب الحركات المدينة والحركات الدائنة من القيود الفعلية في b1 (التي ولدت رصيد 7,729.506 د.ك)
let sumDebitInvoices = 0;
let sumCreditReturns = 0;
let sumCreditReceipts = 0;
let countInvoices = 0;
let countReturns = 0;
let countReceipts = 0;

const receiptsList = [];
const returnsList = [];

b1.journals.forEach(j => {
  (j.lines || []).forEach(l => {
    if (l.accountId === 'acc-1121' || l.accountId === 'acc-1120') {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;

      if (d > 0) {
        sumDebitInvoices += d;
        countInvoices++;
      }
      if (c > 0) {
        const desc = j.description || '';
        const isReturn = j.journalType === 'SALES_RETURN' || j.sourceModule === 'SALES_RETURN' || desc.includes('مرتجع') || desc.includes('مردود');
        if (isReturn) {
          sumCreditReturns += c;
          countReturns++;
          returnsList.push({ date: j.date, amount: c, desc });
        } else {
          sumCreditReceipts += c;
          countReceipts++;
          receiptsList.push({ date: j.date, amount: c, desc });
        }
      }
    }
  });
});

console.log('\n2. مجموع الحركات المدينة (فواتير المبيعات POSTED):');
console.log(`   الإجمالي: ${sumDebitInvoices.toFixed(3)} د.ك (من واقع ${countInvoices} سطراً في قيود فواتير المبيعات)`);

console.log('\n3. مجموع الحركات الدائنة (سندات القبض + مردودات المبيعات):');
console.log(`   أ. سندات القبض والتحصيلات والخصومات: ${sumCreditReceipts.toFixed(3)} د.ك (عدد ${countReceipts})`);
receiptsList.forEach(r => console.log(`      * ${r.date} | ${r.amount.toFixed(3).padStart(8)} د.ك | ${r.desc}`));
console.log(`   ب. مردودات المبيعات (SALES_RETURN):    ${sumCreditReturns.toFixed(3)} د.ك (عدد ${countReturns})`);
console.log(`   إجمالي الحركات الدائنة (أ + ب):        ${(sumCreditReceipts + sumCreditReturns).toFixed(3)} د.ك`);

console.log('\n4. المقارنة مع رصيد حساب 1121 في جدول accounts:');
const acc1121 = db.accounts.find(a => a.code === '1121');
const netJournalMovements = sumDebitInvoices - (sumCreditReceipts + sumCreditReturns);
console.log(`   رصيد حساب 1121 في شجرة الحسابات (GL): ${Number(acc1121.balance).toFixed(3)} د.ك`);
console.log(`   صافي حركات القيود (مدين فواتير - دائن قبض ومردودات): ${netJournalMovements.toFixed(3)} د.ك`);
console.log(`   الفارق بين صافي القيود ورصيد 1121: ${(netJournalMovements - Number(acc1121.balance)).toFixed(3)} د.ك (تطابق تام = 0.000 د.ك)`);

console.log('\n5. أين يكمن الفارق بين Subledger (20,800.810) و GL (7,729.506)؟');
console.log(`   - رصيد Subledger:                 ${totalSubledgerBalance.toFixed(3)} د.ك`);
console.log(`   - رصيد الأستاذ العام (حساب 1121): ${Number(acc1121.balance).toFixed(3)} د.ك`);
console.log(`   - الفارق الإجمالي:                 ${(totalSubledgerBalance - Number(acc1121.balance)).toFixed(3)} د.ك`);
console.log('\n   تحليل مكونات الفارق:');
console.log(`   أ) الأرصدة الافتتاحية للعملاء:     ${totalOpeningBalance.toFixed(3)} د.ك`);
console.log(`   ب) صافي الحركة المسجلة في كروت العملاء (Current - Opening): ${(totalSubledgerBalance - totalOpeningBalance).toFixed(3)} د.ك`);
console.log(`   ج) صافي الحركة المسجلة في القيود المحاسبية:                  ${netJournalMovements.toFixed(3)} د.ك`);
console.log(`   د) فارق الحركة التشغيلية بين كروت العملاء والقيود:           ${(netJournalMovements - (totalSubledgerBalance - totalOpeningBalance)).toFixed(3)} د.ك`);
