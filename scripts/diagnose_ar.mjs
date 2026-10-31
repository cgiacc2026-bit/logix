import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./data/database.json', 'utf8'));
const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));
const b2 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json', 'utf8'));

console.log('===============================================================');
console.log('          تقرير التشخيص الدقيق لحسابات العملاء والذمم المدينة');
console.log('===============================================================');

// 1. حساب opening_balance لكل العملاء
const customers = db.partners.filter(p => p.type === 'CUSTOMER');
let totalOpening = 0;
let totalCurrentBal = 0;

console.log('\n--- 1. كشف الأرصدة الافتتاحية والأرصدة الحالية للعملاء ---');
customers.forEach(c => {
  const op = Number(c.opening_balance) || 0;
  const cur = Number(c.balance) || 0;
  totalOpening += op;
  totalCurrentBal += cur;
  console.log(`${c.code.padEnd(10)} | ${c.name_ar.padEnd(35)} | افتتاحي: ${op.toFixed(3).padStart(10)} | حالي: ${cur.toFixed(3).padStart(10)} | صافي الحركة المسجل: ${(cur - op).toFixed(3).padStart(10)}`);
});

console.log('---------------------------------------------------------------');
console.log(`مجموع الأرصدة الافتتاحية (Opening Balances): ${totalOpening.toFixed(3)} د.ك`);
console.log(`مجموع الأرصدة الحالية في Subledger:          ${totalCurrentBal.toFixed(3)} د.ك`);
console.log(`صافي الفرق التراكمي في كروت العملاء:        ${(totalCurrentBal - totalOpening).toFixed(3)} د.ك`);

// 2. تحليل حركات فواتير المبيعات (POSTED) المرتبطة بالعملاء
console.log('\n--- 2. فحص فواتير المبيعات ومردوداتها وسندات القبض في النسخة الأصلية والمستندات ---');

// فحص الفواتير في النسخة الاحتياطية b1 و b2
let totalSalesInvoicesAmount = 0;
let totalSalesReturnsAmount = 0;
let invoicesCount = 0;
let returnsCount = 0;

const invoicesSource = b2.invoices || b1.invoices || [];
invoicesSource.forEach(inv => {
  const total = Number(inv.grandTotal ?? inv.total ?? 0);
  if (inv.type === 'SALES_RETURN') {
    totalSalesReturnsAmount += total;
    returnsCount++;
  } else {
    totalSalesInvoicesAmount += total;
    invoicesCount++;
  }
});

console.log(`فواتير المبيعات: ${invoicesCount} فاتورة بمجموع: ${totalSalesInvoicesAmount.toFixed(3)} د.ك`);
console.log(`مردودات المبيعات: ${returnsCount} مردود بمجموع: ${totalSalesReturnsAmount.toFixed(3)} د.ك`);

// 3. فحص سندات القبض والدفع
console.log('\n--- 3. فحص سندات القبض والدفع الحقيقية ---');
// كيف كانت مسجلة في النسخة الأصلية؟
const rawJournals = b1.journals || [];
let arDebitJournals = 0;
let arCreditJournals = 0;
let salesDebitJournals = 0;
let returnCreditJournals = 0;
let receiptCreditJournals = 0;
let otherArJournals = [];

rawJournals.forEach(j => {
  const lines = j.lines || [];
  lines.forEach(l => {
    const accId = l.accountId;
    if (accId === 'acc-1121' || accId === 'acc-1120') {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      arDebitJournals += d;
      arCreditJournals += c;

      if (d > 0) {
        salesDebitJournals += d;
      }
      if (c > 0) {
        if (j.journalType === 'SALES_RETURN' || j.sourceModule === 'SALES_RETURN' || (j.description && j.description.includes('مرتجع'))) {
          returnCreditJournals += c;
        } else {
          receiptCreditJournals += c;
          otherArJournals.push({ jNumber: j.journalNumber, desc: j.description, credit: c, date: j.date });
        }
      }
    }
  });
});

console.log(`إجمالي قيود المدين على الذمم المدينة (فواتير بيع):  ${arDebitJournals.toFixed(3)} د.ك`);
console.log(`إجمالي قيود الدائن على الذمم المدينة:              ${arCreditJournals.toFixed(3)} د.ك`);
console.log(`  - منها مردودات مبيعات:                          ${returnCreditJournals.toFixed(3)} د.ك`);
console.log(`  - منها سندات قبض وتحصيلات نقدية وبنكية:         ${receiptCreditJournals.toFixed(3)} د.ك`);
console.log(`صافي حركة حساب الذمم المدينة في القيود (دائن - مدين): ${(arDebitJournals - arCreditJournals).toFixed(3)} د.ك`);

// 4. مقارنة مع حساب 1121 في شجرة الحسابات
const acc1121 = db.accounts.find(a => a.code === '1121');
const acc1120 = db.accounts.find(a => a.code === '1120');
console.log('\n--- 4. رصيد حسابات الذمم المدينة في شجرة الحسابات ---');
console.log(`حساب 1121 (عملاء الجمعيات التعاونية): ${Number(acc1121?.balance).toFixed(3)} د.ك`);
console.log(`حساب 1120 (حساب الأب للذمم المدينة):   ${Number(acc1120?.balance).toFixed(3)} د.ك`);

console.log('\n--- 5. تفاصيل سندات القبض والتحصيلات المسجلة ---');
otherArJournals.forEach(item => {
  console.log(`  - قيد: ${item.jNumber} | تاريخ: ${item.date} | مبلغ: ${item.credit.toFixed(3)} د.ك | بيان: ${item.desc}`);
});
