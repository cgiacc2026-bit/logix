import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./data/database.json', 'utf8'));
const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));

// 1. العملاء والأرصدة الافتتاحية
const customers = db.partners.filter(p => p.type === 'CUSTOMER');
let totalOpeningBalance = 0;
let totalSubledgerBalance = 0;

const customerStats = {};
customers.forEach(c => {
  const op = Number(c.opening_balance) || 0;
  const bal = Number(c.balance) || 0;
  totalOpeningBalance += op;
  totalSubledgerBalance += bal;
  customerStats[c.id] = {
    code: c.code,
    name: c.name_ar,
    opening: op,
    current: bal,
    invoicesDebit: 0,
    receiptsCredit: 0,
    returnsCredit: 0,
    journalDebit: 0,
    journalCredit: 0
  };
});

// 2 & 3. حركات الحساب 1121 و 1120 في القيود اليومية (التي تمثل الفواتير والسندات والمردودات)
let totalSalesInvoicesDebit = 0;
let totalReceiptsCredit = 0;
let totalSalesReturnsCredit = 0;
let otherCredits = 0;

const receiptEntries = [];
const returnEntries = [];
const salesEntries = [];

db.journals.forEach(j => {
  (j.lines || []).forEach(l => {
    const accId = l.account_id || l.accountId;
    // فحص إذا كان السطر لحساب الذمم المدينة 1121 أو 1120
    const acc = db.accounts.find(a => a.id === accId);
    if (acc && (acc.code === '1121' || acc.code === '1120')) {
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;

      if (debit > 0) {
        totalSalesInvoicesDebit += debit;
        salesEntries.push({ jNum: j.entry_number || j.journal_number, date: j.entry_date || j.date, amount: debit, desc: j.narration || j.description });
      }

      if (credit > 0) {
        const desc = (j.narration || j.description || '').toLowerCase();
        const type = j.source_module || j.sourceModule || j.journal_type || '';

        if (type === 'SALES_RETURN' || desc.includes('مرتجع') || desc.includes('مردود')) {
          totalSalesReturnsCredit += credit;
          returnEntries.push({ jNum: j.entry_number || j.journal_number, date: j.entry_date || j.date, amount: credit, desc: j.narration || j.description });
        } else {
          totalReceiptsCredit += credit;
          receiptEntries.push({ jNum: j.entry_number || j.journal_number, date: j.entry_date || j.date, amount: credit, desc: j.narration || j.description });
        }
      }
    }
  });
});

console.log('--- النتائج الدقيقة للتشخيص ---');
console.log('1. مجموع الأرصدة الافتتاحية للعملاء (Opening Balance):', totalOpeningBalance.toFixed(3));
console.log('2. مجموع الحركات المدينة (فواتير المبيعات POSTED):', totalSalesInvoicesDebit.toFixed(3));
console.log('3. أ. مجموع الحركات الدائنة (سندات القبض والتحصيلات):', totalReceiptsCredit.toFixed(3));
console.log('3. ب. مجموع الحركات الدائنة (مردودات المبيعات):', totalSalesReturnsCredit.toFixed(3));
const totalCredits = totalReceiptsCredit + totalSalesReturnsCredit;
console.log('3. ج. إجمالي الحركات الدائنة (سندات قبض + مردودات):', totalCredits.toFixed(3));

const netMovement = totalSalesInvoicesDebit - totalCredits;
console.log('صافي حركات القيود للذمم المدينة (مدين - دائن):', netMovement.toFixed(3));

// 4. مقارنة مع حساب 1121 في جدول accounts
const acc1121 = db.accounts.find(a => a.code === '1121');
console.log('4. رصيد حساب 1121 في شجرة الحسابات:', Number(acc1121.balance).toFixed(3));

console.log('\n--- مقارنة المعادلة المحاسبية ---');
console.log('المعادلة النظرية: رصيد افتتاحي + مبيعات مدينة - (قبض + مردودات) = رصيد ختامي متوقع');
const theoreticalSubledger = totalOpeningBalance + netMovement;
console.log(`${totalOpeningBalance.toFixed(3)} + ${totalSalesInvoicesDebit.toFixed(3)} - ${totalCredits.toFixed(3)} = ${theoreticalSubledger.toFixed(3)} د.ك`);
console.log('رصيد Subledger الفعلي المسجل في كروت العملاء:', totalSubledgerBalance.toFixed(3), 'د.ك');
console.log('الفارق بين الناتج النظري والرصيد المسجل في Subledger:', (totalSubledgerBalance - theoreticalSubledger).toFixed(3), 'د.ك');
console.log('الفارق بين رصيد Subledger المسجل (20,800.810) ورصيد 1121 في الأستاذ العام (7,729.506):', (totalSubledgerBalance - Number(acc1121.balance)).toFixed(3), 'د.ك');

// تفاصيل سندات القبض
console.log('\n--- تفاصيل سندات القبض المكونة لمبلغ 2,706.270 د.ك ---');
receiptEntries.forEach(r => {
  console.log(`  - تاريخ: ${r.date} | مبلغ: ${r.amount.toFixed(3).padStart(9)} د.ك | بيان: ${r.desc}`);
});

// تفاصيل مردودات المبيعات
console.log('\n--- تفاصيل مردودات المبيعات المكونة لمبلغ 380.202 د.ك ---');
returnEntries.forEach(r => {
  console.log(`  - تاريخ: ${r.date} | مبلغ: ${r.amount.toFixed(3).padStart(9)} د.ك | بيان: ${r.desc}`);
});
