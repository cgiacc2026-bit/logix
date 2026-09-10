const fs = require('fs');

let dsCode = fs.readFileSync('src/services/dataService.ts', 'utf8');
if (!dsCode.includes('public clearMemoryCache()')) {
  dsCode = dsCode.replace(
    'public getEffectiveCompanyId(): string | null {',
    'public clearMemoryCache(): void { this.memoryFallback = {}; }\n\n  public getEffectiveCompanyId(): string | null {'
  );
  
  dsCode = dsCode.replace(
    'public static async resetDatabase(): Promise<void> {',
    'public static clearLocalMemory(): void { localDataStore.clearMemoryCache(); }\n\n  public static async resetDatabase(): Promise<void> {'
  );
  fs.writeFileSync('src/services/dataService.ts', dsCode);
}

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes('DataService.clearLocalMemory()')) {
  appCode = appCode.replace(
    "localStorage.removeItem('supabase_company_info');",
    "localStorage.removeItem('supabase_company_info');\n    DataService.clearLocalMemory();\n    setInvoices([]);\n    setJournals([]);\n    setAccounts([]);\n    setCustomers([]);\n    setSuppliers([]);\n    setInventory([]);\n    setVouchers([]);\n    setProductionOrders([]);\n    setQuotations([]);\n"
  );
  fs.writeFileSync('src/App.tsx', appCode);
}
