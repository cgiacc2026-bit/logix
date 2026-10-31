import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, getDocs, collection } from 'firebase/firestore';

const configPath = path.resolve('firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: firebase-applet-config.json not found!');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const COMPANY_ID = '20000000-0000-0000-0000-000000000001';
const basePath = `companies/${COMPANY_ID}`;

// Helper to remove any undefined or circular properties for Firestore
function sanitizeDoc(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

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

async function runUnifiedMigration() {
  console.log('=== Uploading Unified Partners & Documents Schema to Firestore ===');

  const b1Path = './public/assets/aistudio/LOGIX_BACKUP______________________2026-10-31__1__927f6726.json';
  const b2Path = './public/assets/aistudio/LOGIX_Backup______________________2026-10-31_91e647da.json';

  const b1 = JSON.parse(fs.readFileSync(b1Path, 'utf8'));
  const b2 = JSON.parse(fs.readFileSync(b2Path, 'utf8'));

  // 1. Build Partners
  const partnerMap = new Map();

  // Add customers
  const customers = [...(b1.customers || []), ...(b2.customers || [])];
  customers.forEach(c => {
    partnerMap.set(c.id, {
      id: c.id,
      company_id: COMPANY_ID,
      type: 'CUSTOMER',
      code: c.code,
      nameAr: c.nameAr || c.name,
      nameEn: c.nameEn || '',
      taxNumber: c.taxNumber || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || 'الكويت',
      balance: c.balance || c.currentBalance || 0,
      creditLimit: c.creditLimit || 0,
      accountId: c.accountId || null,
      isActive: c.isActive !== false,
      created_at: c.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  });

  // Add suppliers
  const suppliers = [...(b2.suppliers || []), ...(b1.suppliers || [])];
  suppliers.forEach(s => {
    const existing = partnerMap.get(s.id);
    if (existing) {
      existing.type = 'BOTH';
    } else {
      partnerMap.set(s.id, {
        id: s.id,
        company_id: COMPANY_ID,
        type: 'SUPPLIER',
        code: s.code,
        nameAr: s.nameAr || s.name,
        nameEn: s.nameEn || '',
        taxNumber: s.taxNumber || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        city: s.city || 'الكويت',
        balance: s.balance || 0,
        accountId: s.accountId || s.account_id || null,
        isActive: s.isActive !== false,
        created_at: s.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  });

  const partners = Array.from(partnerMap.values());
  console.log(`Total Unified Partners: ${partners.length}`);

  // 2. Build Unified Documents from Invoices & Vouchers
  const documentMap = new Map();

  // Invoices -> Unified Documents
  const invoices = [...(b1.invoices || []), ...(b2.invoices || [])];
  invoices.forEach(inv => {
    let docType = 'SALES_INVOICE';
    if (inv.type === 'SALES_RETURN') docType = 'SALES_RETURN';
    else if (inv.type === 'PURCHASE') docType = 'PURCHASE_INVOICE';
    else if (inv.type === 'PURCHASE_RETURN') docType = 'PURCHASE_RETURN';

    let docStatus = 'DRAFT';
    if (inv.status === 'POSTED' || inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID') {
      docStatus = 'POSTED';
    } else if (inv.status === 'CANCELLED' || inv.is_void) {
      docStatus = 'CANCELLED';
    }

    const lines = (inv.lines || []).map((l, idx) => ({
      id: l.id || `line-${inv.id}-${idx}`,
      document_id: inv.id,
      item_id: l.itemId,
      item_code: l.itemSku || l.barcode,
      item_name: l.itemNameAr || l.name,
      unit: l.unit,
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unitPrice) || 0,
      subtotal: Number(l.subtotal) || (Number(l.quantity) * Number(l.unitPrice)),
      discount_amount: Number(l.discountAmount) || 0,
      vat_amount: Number(l.vatAmount) || 0,
      total: Number(l.total) || 0,
      warehouse_id: l.warehouseId || inv.warehouseId || 'wh-main-01',
      notes: l.notes || '',
    }));

    documentMap.set(inv.id, {
      id: inv.id,
      company_id: COMPANY_ID,
      branch_id: inv.branchId || inv.branch_id || 'br-main',
      doc_type: docType,
      doc_number: inv.invoiceNumber,
      status: docStatus,
      journal_entry_id: inv.journalEntryId || null,
      reverses_id: null,
      reversed_by_id: null,
      subtotal: Number(inv.subtotal) || 0,
      discount_total: Number(inv.discountTotal || inv.discountValue) || 0,
      vat_total: Number(inv.vatTotal) || 0,
      grand_total: Number(inv.grandTotal) || 0,
      paid_amount: Number(inv.paidAmount) || 0,
      due_amount: Number(inv.dueAmount) || 0,
      posted_at: inv.createdAt || (inv.date ? `${inv.date}T00:00:00.000Z` : new Date().toISOString()),
      posted_by: inv.salesPerson || 'system',
      reversed_at: null,
      reversed_by: null,
      cancelled_at: null,
      cancelled_by: null,
      entity_id: inv.entityId || null,
      warehouse_id: inv.warehouseId || 'wh-main-01',
      notes: inv.notes || '',
      created_at: inv.createdAt || (inv.date ? `${inv.date}T00:00:00.000Z` : new Date().toISOString()),
      updated_at: inv.updatedAt || new Date().toISOString(),
      lines
    });
  });

  const documents = Array.from(documentMap.values());
  console.log(`Total Unified Documents: ${documents.length}`);

  // Upload to Firestore
  const committedPartners = await batchUpload(`${basePath}/partners`, partners, p => p.id);
  const committedDocs = await batchUpload(`${basePath}/documents`, documents, d => d.id);

  console.log('\n--- Verifying Live Firestore Counts ---');
  const snapP = await getDocs(collection(db, `${basePath}/partners`));
  const snapD = await getDocs(collection(db, `${basePath}/documents`));
  console.log(`Verified live partners: ${snapP.size} docs`);
  console.log(`Verified live documents: ${snapD.size} docs`);

  console.log('\n✓ Unified Schema upload complete!');
  process.exit(0);
}

runUnifiedMigration().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
