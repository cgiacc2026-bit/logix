const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const t1 = `    let jLines = [];`;
const t2 = `const jEntry: JournalEntry = {`;

const i1 = code.indexOf('    let jLines = [];', 2250);
const i2 = code.indexOf(t2, i1);

console.log(i1, i2);

if (i1 > -1 && i2 > -1) {
  code = code.substring(0, i1) + newJournalLogic + code.substring(i2);
  fs.writeFileSync('src/services/dataService.ts', code);
  console.log('Done');
}
