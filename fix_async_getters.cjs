const fs = require('fs');

let dsCode = fs.readFileSync('src/services/dataService.ts', 'utf8');

dsCode = dsCode.replace(
  'const invoices = localDataStore.getInvoices();',
  'const invoices = isSupabaseConfigured ? await this.getInvoices() : localDataStore.getInvoices();'
);

dsCode = dsCode.replace(
  'const customers = localDataStore.getCustomers();',
  'const customers = isSupabaseConfigured ? await this.getCustomers() : localDataStore.getCustomers();'
);

dsCode = dsCode.replace(
  'const suppliers = localDataStore.getSuppliers();',
  'const suppliers = isSupabaseConfigured ? await this.getSuppliers() : localDataStore.getSuppliers();'
);

dsCode = dsCode.replace(
  'const inventory = localDataStore.getInventory();',
  'const inventory = isSupabaseConfigured ? await this.getInventory() : localDataStore.getInventory();'
);

dsCode = dsCode.replace(
  'const vouchers = localDataStore.getVouchers();',
  'const vouchers = isSupabaseConfigured ? await this.getVouchers() : localDataStore.getVouchers();'
);

dsCode = dsCode.replace(
  'const journals = localDataStore.getJournals();',
  'const journals = isSupabaseConfigured ? await this.getJournals() : localDataStore.getJournals();'
);

dsCode = dsCode.replace(
  'const productionOrders = localDataStore.getProductionOrders();',
  'const productionOrders = isSupabaseConfigured ? await this.getProductionOrders() : localDataStore.getProductionOrders();'
);

fs.writeFileSync('src/services/dataService.ts', dsCode);
