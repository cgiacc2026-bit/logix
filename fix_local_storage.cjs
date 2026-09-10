const fs = require('fs');

let dsCode = fs.readFileSync('src/services/dataService.ts', 'utf8');

// The goal is to aggressively short-circuit all getXXX methods to return SupabaseData if it is configured.
const entities = [
  { name: 'Invoices', api: 'getInvoices', default: '[]' },
  { name: 'Vouchers', api: 'getVouchers', default: '[]' },
  { name: 'Journals', api: 'getJournals', default: '[]' },
  { name: 'Inventory', api: 'getItems', default: '[]' },
  { name: 'Customers', api: 'getCustomers', default: '[]' },
  { name: 'Suppliers', api: 'getSuppliers', default: '[]' },
  { name: 'Accounts', api: 'getAccounts', default: '[]' },
  { name: 'ProductionOrders', api: 'getProductionOrders', default: '[]' },
];

for (const e of entities) {
  const methodSig = `public static async get${e.name}(`;
  if (dsCode.includes(methodSig)) {
    // Find the start of the method
    const startIdx = dsCode.indexOf(methodSig);
    const bodyStart = dsCode.indexOf('{', startIdx) + 1;
    
    // Inject the strict Supabase return
    const injection = `
    if (isSupabaseConfigured) {
      const fromSupabase = await SupabaseDataService.${e.api}();
      if (Array.isArray(fromSupabase)) {
        return fromSupabase;
      }
    }`;
    
    dsCode = dsCode.substring(0, bodyStart) + injection + dsCode.substring(bodyStart);
  }
}

fs.writeFileSync('src/services/dataService.ts', dsCode);
