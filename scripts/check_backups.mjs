import fs from 'fs';

const b1 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json', 'utf8'));
const b2 = JSON.parse(fs.readFileSync('./public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json', 'utf8'));

console.log('b1 journals count:', b1.journals.length);
console.log('b2 journals count:', b2.journals.length);

const b1Keys = new Set(b1.journals.map(j => `${j.date}_${j.description}_${Number(j.totalDebit || 0).toFixed(3)}`));

let duplicates = 0;
let uniqueInB2 = 0;
b2.journals.forEach(j => {
  const k = `${j.date}_${j.description}_${Number(j.totalDebit || 0).toFixed(3)}`;
  if (b1Keys.has(k)) {
    duplicates++;
  } else {
    uniqueInB2++;
  }
});

console.log('Duplicates in b2 that are identical to b1:', duplicates);
console.log('Unique to b2:', uniqueInB2);
