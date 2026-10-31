import fs from 'fs';

const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));

const custMap = new Map();
b1.customers.forEach(c => {
  custMap.set(c.id, {
    id: c.id,
    code: c.code,
    name: c.nameAr,
    open: Number(c.openingBalance) || 0,
    curBal: Number(c.balance) || 0,
    recordedDiff: (Number(c.balance) || 0) - (Number(c.openingBalance) || 0),
    invDebit: 0,
    journalDebit: 0,
    journalCredit: 0
  });
});

// فحص الفواتير
b1.invoices?.forEach(inv => {
  const custId = inv.customerId || inv.partnerId;
  const cust = custMap.get(custId);
  const total = Number(inv.grandTotal ?? inv.total ?? 0);
  if (cust) {
    if (inv.type === 'SALES_RETURN') {
      cust.invDebit -= total;
    } else {
      cust.invDebit += total;
    }
  }
});

// فحص القيود
b1.journals?.forEach(j => {
  // هل في partnerId أو entityId أو customerId؟
  // أو هل مسجل في السطور؟
  const headerCustId = j.customerId || j.partnerId || j.entityId;
  j.lines?.forEach(l => {
    if (l.accountId === 'acc-1121' || l.accountId === 'acc-1120') {
      const lineCustId = l.partnerId || l.customerId || headerCustId;
      const cust = custMap.get(lineCustId);
      if (cust) {
        cust.journalDebit += Number(l.debit) || 0;
        cust.journalCredit += Number(l.credit) || 0;
      }
    }
  });
});

console.log('كشف تفصيلي لحركات كل عميل:');
console.log('كود'.padEnd(8) + ' | ' + 'اسم العميل'.padEnd(35) + ' | ' + 'الحالي'.padStart(9) + ' | ' + 'الافتتاحي'.padStart(9) + ' | ' + 'الفرق (الحالي-الافتتاحي)'.padStart(12) + ' | ' + 'مدين قيود'.padStart(10) + ' | ' + 'دائن قيود'.padStart(10));
custMap.forEach(c => {
  console.log(
    c.code.padEnd(8) + ' | ' +
    c.name.padEnd(35) + ' | ' +
    c.curBal.toFixed(3).padStart(9) + ' | ' +
    c.open.toFixed(3).padStart(9) + ' | ' +
    c.recordedDiff.toFixed(3).padStart(12) + ' | ' +
    c.journalDebit.toFixed(3).padStart(10) + ' | ' +
    c.journalCredit.toFixed(3).padStart(10)
  );
});

// فحص القيود التي لم يُربط بها عميل
let unassignedDebit = 0;
let unassignedCredit = 0;
let unassignedCount = 0;

b1.journals?.forEach(j => {
  const headerCustId = j.customerId || j.partnerId || j.entityId;
  j.lines?.forEach(l => {
    if (l.accountId === 'acc-1121' || l.accountId === 'acc-1120') {
      const lineCustId = l.partnerId || l.customerId || headerCustId;
      if (!custMap.has(lineCustId)) {
        unassignedCount++;
        unassignedDebit += Number(l.debit) || 0;
        unassignedCredit += Number(l.credit) || 0;
      }
    }
  });
});

console.log('\nحركات في حساب 1121 لم يُحدد لها partnerId صريح في القيد القديم:');
console.log('عدد الأسطر:', unassignedCount, '| مدين:', unassignedDebit.toFixed(3), '| دائن:', unassignedCredit.toFixed(3));
