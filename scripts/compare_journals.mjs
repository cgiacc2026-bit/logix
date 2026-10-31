import fs from 'fs';

const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));
const b2 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json', 'utf8'));

console.log('--- Sample 5 from b1 ---');
b1.journals.slice(0, 5).forEach(j => {
  console.log(j.date, '|', (j.description || '').slice(0, 50), '| Debit:', j.totalDebit);
});

console.log('\n--- Sample 5 from b2 ---');
b2.journals.slice(0, 5).forEach(j => {
  console.log(j.date, '|', (j.description || '').slice(0, 50), '| Debit:', j.totalDebit);
});

// إجمالي المدين والدائن في b1 و b2
let b1Total = 0;
b1.journals.forEach(j => b1Total += Number(j.totalDebit || 0));
let b2Total = 0;
b2.journals.forEach(j => b2Total += Number(j.totalDebit || 0));

console.log(`\nb1 Total Debit: ${b1Total.toFixed(3)} KWD`);
console.log(`b2 Total Debit: ${b2Total.toFixed(3)} KWD`);
