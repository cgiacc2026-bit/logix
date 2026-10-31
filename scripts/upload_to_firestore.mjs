import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, getDocs, collection } from 'firebase/firestore';

// 1. Load Firebase configuration
const configPath = path.resolve('firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: firebase-applet-config.json not found!');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const COMPANY_ID = '20000000-0000-0000-0000-000000000001';

// Target 29 account codes strictly requested by user
const TARGET_ACCOUNT_CODES = [
  '1000', '1100', '1110', '1111', '1112', '1120', '1121', '1130', '1131',
  '2000', '2100', '2110', '2111', '2111001', '2120', '2122',
  '3000', '3100', '3110', '3120', '31202',
  '4000', '4100', '4110',
  '5000', '5100', '5110', '5400', '5410'
];

// Helper to remove any undefined or circular properties for Firestore
function sanitizeDoc(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

// Helper to commit an array of items in batches (e.g., 200 per batch)
async function batchUpload(collectionPath, items, getId) {
  console.log(`Starting upload for ${collectionPath} (${items.length} documents)...`);
  const BATCH_SIZE = 200;
  let totalCommitted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docId = getId(item);
      if (!docId) {
        throw new Error(`Item missing ID in ${collectionPath}: ${JSON.stringify(item)}`);
      }
      const ref = doc(db, `${collectionPath}/${docId}`);
      batch.set(ref, sanitizeDoc(item));
    }

    await batch.commit();
    totalCommitted += chunk.length;
    console.log(`  Committed ${totalCommitted}/${items.length} to ${collectionPath}`);
  }

  return totalCommitted;
}

async function runMigration() {
  console.log('=== Starting Firestore Data Upload ===');
  console.log(`Target Company ID: ${COMPANY_ID}`);

  // Load datasets
  const b1Path = './public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json';
  const b2Path = './public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json';

  const b1 = JSON.parse(fs.readFileSync(b1Path, 'utf8'));
  const b2 = JSON.parse(fs.readFileSync(b2Path, 'utf8'));

  // 1. Profile
  const companyProfile = b1.company;
  companyProfile.id = COMPANY_ID;

  // 2. Accounts (Filter strictly to the 29 codes)
  const targetCodeSet = new Set(TARGET_ACCOUNT_CODES);
  const accountsMap = new Map();
  // b1 has the exact 29 accounts with full details and balances
  for (const acc of b1.accounts) {
    const code = String(acc.code).trim();
    if (targetCodeSet.has(code)) {
      accountsMap.set(acc.id, {
        ...acc,
        companyId: COMPANY_ID,
        code
      });
    }
  }

  const accounts = Array.from(accountsMap.values());
  console.log(`Filtered accounts count: ${accounts.length} of ${TARGET_ACCOUNT_CODES.length}`);
  if (accounts.length !== TARGET_ACCOUNT_CODES.length) {
    const missing = TARGET_ACCOUNT_CODES.filter(c => !accounts.some(a => a.code === c));
    console.warn('Warning: Missing accounts for codes:', missing);
  }

  // 3. Customers
  const customerMap = new Map();
  (b1.customers || []).forEach(c => customerMap.set(c.id, { ...c, companyId: COMPANY_ID }));
  (b2.customers || []).forEach(c => customerMap.set(c.id, { ...customerMap.get(c.id), ...c, companyId: COMPANY_ID }));
  const customers = Array.from(customerMap.values());

  // 4. Suppliers
  const supplierMap = new Map();
  (b2.suppliers || []).forEach(s => supplierMap.set(s.id, { ...s, companyId: COMPANY_ID }));
  (b1.suppliers || []).forEach(s => supplierMap.set(s.id, { ...supplierMap.get(s.id), ...s, companyId: COMPANY_ID }));
  const suppliers = Array.from(supplierMap.values());

  // 5. Items (Inventory)
  const itemMap = new Map();
  (b1.inventory || []).forEach(it => itemMap.set(it.id, { ...it, companyId: COMPANY_ID }));
  (b2.inventory || []).forEach(it => itemMap.set(it.id, { ...itemMap.get(it.id), ...it, companyId: COMPANY_ID }));
  const items = Array.from(itemMap.values());

  // 6. Invoices
  const invoiceMap = new Map();
  (b1.invoices || []).forEach(inv => invoiceMap.set(inv.id, { ...inv, companyId: COMPANY_ID }));
  (b2.invoices || []).forEach(inv => invoiceMap.set(inv.id, { ...invoiceMap.get(inv.id), ...inv, companyId: COMPANY_ID }));
  const invoices = Array.from(invoiceMap.values());

  // 7. Journal Entries
  const journalMap = new Map();
  (b1.journals || []).forEach(j => journalMap.set(j.id, { ...j, companyId: COMPANY_ID }));
  (b2.journals || []).forEach(j => journalMap.set(j.id, { ...journalMap.get(j.id), ...j, companyId: COMPANY_ID }));
  const journalEntries = Array.from(journalMap.values());

  // 8. Warehouses
  const warehouseMap = new Map();
  (b1.warehouses || []).forEach(w => warehouseMap.set(w.id, { ...w, companyId: COMPANY_ID }));
  (b2.warehouses || []).forEach(w => warehouseMap.set(w.id, { ...warehouseMap.get(w.id), ...w, companyId: COMPANY_ID }));
  const warehouses = Array.from(warehouseMap.values());

  // 9. Units
  const unitMap = new Map();
  (b1.units || []).forEach(u => unitMap.set(u.id, u));
  (b2.units || []).forEach(u => unitMap.set(u.id, { ...unitMap.get(u.id), ...u }));
  const units = Array.from(unitMap.values());

  console.log('\n--- Prepared Data Counts ---');
  console.log(`meta/profile: 1`);
  console.log(`accounts: ${accounts.length}`);
  console.log(`customers: ${customers.length}`);
  console.log(`suppliers: ${suppliers.length}`);
  console.log(`items: ${items.length}`);
  console.log(`invoices: ${invoices.length}`);
  console.log(`journalEntries: ${journalEntries.length}`);
  console.log(`warehouses: ${warehouses.length}`);
  console.log(`units: ${units.length}`);

  // Base path: companies/20000000-0000-0000-0000-000000000001
  const basePath = `companies/${COMPANY_ID}`;

  // Upload meta/profile
  console.log(`\nUploading ${basePath}/meta/profile...`);
  const profileBatch = writeBatch(db);
  const profileRef = doc(db, `${basePath}/meta/profile`);
  profileBatch.set(profileRef, sanitizeDoc(companyProfile));
  await profileBatch.commit();
  console.log('✓ meta/profile uploaded successfully.');

  // Upload all other collections in batches
  const report = {
    profile: 1,
    accounts: await batchUpload(`${basePath}/accounts`, accounts, a => a.id),
    customers: await batchUpload(`${basePath}/customers`, customers, c => c.id),
    suppliers: await batchUpload(`${basePath}/suppliers`, suppliers, s => s.id),
    items: await batchUpload(`${basePath}/items`, items, i => i.id),
    invoices: await batchUpload(`${basePath}/invoices`, invoices, inv => inv.id),
    journalEntries: await batchUpload(`${basePath}/journalEntries`, journalEntries, j => j.id),
    warehouses: await batchUpload(`${basePath}/warehouses`, warehouses, w => w.id),
    units: await batchUpload(`${basePath}/units`, units, u => u.id),
  };

  console.log('\n=============================================');
  console.log('       FIRESTORE UPLOAD REPORT');
  console.log('=============================================');
  console.log(`Path: ${basePath}/`);
  console.log(`├── meta/profile:              ${report.profile} doc`);
  console.log(`├── accounts:                  ${report.accounts} docs`);
  console.log(`├── customers:                 ${report.customers} docs`);
  console.log(`├── suppliers:                 ${report.suppliers} docs`);
  console.log(`├── items:                     ${report.items} docs`);
  console.log(`├── invoices:                  ${report.invoices} docs`);
  console.log(`├── journalEntries:            ${report.journalEntries} docs`);
  console.log(`├── warehouses:                ${report.warehouses} docs`);
  console.log(`└── units:                     ${report.units} docs`);
  console.log('=============================================');

  // Verify by fetching collection counts from Firestore
  console.log('\n--- Verifying Live Firestore Collection Counts ---');
  for (const coll of ['accounts', 'customers', 'suppliers', 'items', 'invoices', 'journalEntries', 'warehouses', 'units']) {
    const snap = await getDocs(collection(db, `${basePath}/${coll}`));
    console.log(`Verified live count for ${coll}: ${snap.size} documents`);
  }

  // Update local data/database.json to also reflect the cleaned chart of accounts and preserved data
  console.log('\nUpdating local database.json with cleaned chart of accounts...');
  const currentDbPath = path.resolve('data/database.json');
  let currentDb = {};
  if (fs.existsSync(currentDbPath)) {
    try {
      currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));
    } catch (e) {
      console.warn('Could not parse database.json:', e);
    }
  }

  const updatedDb = {
    ...currentDb,
    company: companyProfile,
    accounts: accounts,
    customers: customers,
    suppliers: suppliers,
    inventory: items,
    invoices: invoices,
    journals: journalEntries,
    warehouses: warehouses,
    units: units
  };

  fs.writeFileSync(currentDbPath, JSON.stringify(updatedDb, null, 2), 'utf8');
  console.log('✓ data/database.json successfully updated.');

  console.log('\n✓ All migration steps completed successfully!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal error in migration:', err);
  process.exit(1);
});
