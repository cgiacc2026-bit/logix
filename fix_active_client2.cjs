const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const targetStr = `export function getEffectiveCompanyId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeCompanyId');
  }
  return null;
}`;

