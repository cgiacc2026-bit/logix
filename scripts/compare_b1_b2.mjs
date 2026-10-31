import fs from 'fs';

const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));
const b2 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json', 'utf8'));

console.log('=== فحص الحساب 1121 في النسختين ===');
const acc1121_b1 = b1.accounts.find(a => a.code === '1121');
const acc1121_b2 = b2.accounts.find(a => a.code === '1121');
console.log('b1 acc-1121 balance:', acc1121_b1?.balance);
console.log('b2 acc-1121 balance:', acc1121_b2?.balance);

console.log('\n=== فحص رأس المال 3110 في النسختين ===');
const acc3110_b1 = b1.accounts.find(a => a.code === '3110');
const acc3110_b2 = b2.accounts.find(a => a.code === '3110');
console.log('b1 acc-3110 balance:', acc3110_b1?.balance);
console.log('b2 acc-3110 balance:', acc3110_b2?.balance);

console.log('\n=== فحص مجموع أرصدة العملاء في النسختين ===');
const sumCust_b1 = b1.customers.reduce((s, c) => s + (Number(c.balance) || 0), 0);
const sumCust_b2 = b2.customers.reduce((s, c) => s + (Number(c.balance) || 0), 0);
console.log('b1 customers sum:', sumCust_b1);
console.log('b2 customers sum:', sumCust_b2);

const sumOpen_b1 = b1.customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
const sumOpen_b2 = b2.customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
console.log('b1 customers opening sum:', sumOpen_b1);
console.log('b2 customers opening sum:', sumOpen_b2);
