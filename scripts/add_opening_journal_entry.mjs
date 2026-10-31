import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, getDocs, collection, getDoc } from 'firebase/firestore';

const COMPANY_ID = '20000000-0000-0000-0000-000000000001';
const DB_PATH = './data/database.json';

const customerSpecs = [
  { name: 'مشرف', code: 'CUST-014', amount: 76.932 },
  { name: 'الجليب', code: '9407', amount: 2359.782 },
  { name: 'القيروان', code: '4568', amount: 1702.393 },
  { name: 'الصباحية', code: '3124', amount: 2487.844 },
  { name: 'الاحمدي', code: '875', amount: 839.813 },
  { name: 'صباح الأحمد', code: '3900', amount: 1508.048 },
  { name: 'شمال غرب', code: '301', amount: 3047.527 },
  { name: 'بيان', code: '5563', amount: 2397.133 },
  { name: 'مدينة سعد العبدالله', code: '2035', amount: 905.944 },
  { name: 'سلوى', code: '3764', amount: 843.147 },
  { name: 'علي صباح السالم', code: '2537', amount: 631.940 },
  { name: 'صباح الناصر', code: '7575', amount: 1001.866 },
  { name: 'مبارك الكبير', code: 'CUST-01', amount: 2497.986 },
  { name: 'اشبيلية', code: '1804', amount: 702.189 },
];

function sanitizeDoc(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

async function execute() {
  console.log('========================================================');
  console.log('   إضافة قيد الأرصدة الافتتاحية للعملاء بتاريخ 31/8/2026');
  console.log('========================================================');

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  // 1. حساب إجمالي القيد الافتتاحي
  const totalOpening = customerSpecs.reduce((sum, c) => sum + c.amount, 0);
  console.log(`إجمالي مبالغ العملاء الـ 14 المعتمدة: ${totalOpening.toFixed(3)} د.ك`);
  if (Math.abs(totalOpening - 21002.544) > 0.001) {
    throw new Error(`خطأ في مجموع الأرصدة الافتتاحية: ${totalOpening}`);
  }

  // 2. مطابقة العملاء مع الـ partners
  const debitLines = [];
  customerSpecs.forEach((spec, idx) => {
    const partner = dbData.partners.find(p => p.code === spec.code || (p.name_ar && p.name_ar.includes(spec.name)));
    if (!partner) {
      throw new Error(`لم يتم العثور على شريك للعميل: ${spec.name} (${spec.code})`);
    }

    debitLines.push({
      id: `jl_opening_2026_0831_${idx + 1}`,
      company_id: COMPANY_ID,
      journal_entry_id: 'jv_opening_2026_0831',
      account_id: 'acc-1121',
      account_code: '1121',
      account_name_ar: 'عملاء الجمعيات التعاونية',
      debit: spec.amount,
      credit: 0,
      entity_id: partner.id,
      entity_type: 'CUSTOMER',
      memo: `الرصيد الافتتاحي: ${partner.name_ar || partner.nameAr}`,
      line_number: idx + 1,
      created_at: '2026-08-31T00:00:00.000Z'
    });
  });

  // 3. سطر الدائن لحساب رأس مال المنشأة (3110)
  const creditLine = {
    id: 'jl_opening_2026_0831_15',
    company_id: COMPANY_ID,
    journal_entry_id: 'jv_opening_2026_0831',
    account_id: 'acc-3110',
    account_code: '3110',
    account_name_ar: 'رأس مال المنشأة المدفوع',
    debit: 0,
    credit: totalOpening,
    entity_id: null,
    entity_type: 'NONE',
    memo: 'رأس مال المنشأة - الأرصدة الافتتاحية للعملاء 31/8/2026',
    line_number: 15,
    created_at: '2026-08-31T00:00:00.000Z'
  };

  const allLines = [...debitLines, creditLine];

  // 4. بناء كائن القيد المحاسبي الموحد
  const openingJournalEntry = {
    id: 'jv_opening_2026_0831',
    company_id: COMPANY_ID,
    entry_number: 'JV-OPENING-2026-0831',
    date: '2026-08-31',
    description: 'قيد الأرصدة الافتتاحية للعملاء كما في 31/8/2026 (بعد استبعاد الأرصدة المستبعدة)',
    status: 'POSTED',
    source_document_id: 'doc_opening_2026_0831',
    source_document_type: 'OPENING_BALANCE',
    reverses_journal_id: null,
    reversed_by_journal_id: null,
    total_debit: totalOpening,
    total_credit: totalOpening,
    is_balanced: true,
    posted_at: '2026-08-31T00:00:00.000Z',
    posted_by: 'system_opening',
    created_by: 'system_opening',
    created_at: '2026-08-31T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    lines: allLines
  };

  // 5. بناء كائن المستند الموحد Document
  const openingDocument = {
    id: 'doc_opening_2026_0831',
    company_id: COMPANY_ID,
    branch_id: 'br-main',
    doc_type: 'OPENING_BALANCE',
    doc_number: 'JV-OPENING-2026-0831',
    doc_date: '2026-08-31',
    due_date: '2026-08-31',
    status: 'POSTED',
    journal_entry_id: 'jv_opening_2026_0831',
    reverses_id: null,
    reversed_by_id: null,
    entity_id: null,
    warehouse_id: null,
    payment_method: 'CREDIT',
    payment_account_id: null,
    subtotal: totalOpening,
    discount_total: 0,
    vat_total: 0,
    grand_total: totalOpening,
    paid_amount: 0,
    due_amount: totalOpening,
    posted_at: '2026-08-31T00:00:00.000Z',
    posted_by: 'system_opening',
    notes: 'قيد الأرصدة الافتتاحية للعملاء كما في 31/8/2026 (بعد استبعاد الأرصدة المستبعدة)',
    created_by: 'system_opening',
    created_at: '2026-08-31T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    lines: debitLines.map((l, i) => ({
      id: `dline_opening_${i + 1}`,
      document_id: 'doc_opening_2026_0831',
      entity_id: l.entity_id,
      notes: l.memo,
      total: l.debit
    }))
  };

  // 6. تحديث الأرصدة في شجرة الحسابات accounts
  // الحساب 1121 وحسابات الأصول الأب
  const delta = totalOpening;
  const accountsToUpdate = [];

  for (const acc of dbData.accounts) {
    if (acc.code === '1121') {
      const prev = acc.balance;
      acc.opening_balance = totalOpening;
      acc.balance = Number((prev + delta).toFixed(6));
      acc.updated_at = new Date().toISOString();
      accountsToUpdate.push(acc);
      console.log(`تحديث الحساب 1121: من ${prev.toFixed(3)} إلى ${acc.balance.toFixed(3)} د.ك`);
    } else if (['1120', '1100', '1000'].includes(acc.code)) {
      const prev = acc.balance;
      acc.balance = Number((prev + delta).toFixed(6));
      acc.updated_at = new Date().toISOString();
      accountsToUpdate.push(acc);
      console.log(`تحديث حساب الأصل الأب ${acc.code} (${acc.name_ar}): من ${prev.toFixed(3)} إلى ${acc.balance.toFixed(3)} د.ك`);
    } else if (acc.code === '3110') {
      const prev = acc.balance;
      acc.opening_balance = totalOpening;
      acc.balance = Number((prev + delta).toFixed(6));
      acc.updated_at = new Date().toISOString();
      accountsToUpdate.push(acc);
      console.log(`تحديث الحساب 3110: من ${prev.toFixed(3)} إلى ${acc.balance.toFixed(3)} د.ك`);
    } else if (['3100', '3000'].includes(acc.code)) {
      const prev = acc.balance;
      acc.balance = Number((prev + delta).toFixed(6));
      acc.updated_at = new Date().toISOString();
      accountsToUpdate.push(acc);
      console.log(`تحديث حساب الملكية الأب ${acc.code} (${acc.name_ar}): من ${prev.toFixed(3)} إلى ${acc.balance.toFixed(3)} د.ك`);
    }
  }

  // 7. التأكد الصارم من عدم تعديل أرصدة العملاء الحالية (c.balance تظل 20,800.810)
  const currentCustomerBalanceSum = dbData.partners
    .filter(p => p.type === 'CUSTOMER')
    .reduce((sum, p) => sum + p.balance, 0);

  console.log(`\nمجموع أرصدة العملاء الحالية (بدون أي تعديل): ${currentCustomerBalanceSum.toFixed(3)} د.ك`);
  if (Math.abs(currentCustomerBalanceSum - 20800.810) > 0.01) {
    throw new Error(`تحذير: مجموع أرصدة العملاء تغير! ${currentCustomerBalanceSum}`);
  }

  // 8. إضافة القيد والمستند إلى قاعدة البيانات المحلية
  // إزالة القيد أو المستند إذا كانا موجودين مسبقاً لمنع التكرار
  dbData.journals = (dbData.journals || []).filter(j => j.id !== openingJournalEntry.id && j.entry_number !== openingJournalEntry.entry_number);
  dbData.journals.unshift(openingJournalEntry);

  dbData.documents = (dbData.documents || []).filter(d => d.id !== openingDocument.id && d.doc_number !== openingDocument.doc_number);
  dbData.documents.unshift(openingDocument);

  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('✓ تم حفظ القيد والمستند وتحديث شجرة الحسابات في data/database.json بنجاح.');

  // 9. رفع القيد والمستند والحسابات المحدثة إلى Cloud Firestore
  console.log('\n--- جاري المزامنة مع Firestore ---');
  const configPath = path.resolve('firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const basePath = `companies/${COMPANY_ID}`;

  const batch = writeBatch(db);

  // رفع القيد في journalEntries
  const journalRef = doc(db, `${basePath}/journalEntries/${openingJournalEntry.id}`);
  batch.set(journalRef, sanitizeDoc(openingJournalEntry));

  // رفع المستند في documents
  const docRef = doc(db, `${basePath}/documents/${openingDocument.id}`);
  batch.set(docRef, sanitizeDoc(openingDocument));

  // تحديث الحسابات المتأثرة في accounts
  for (const acc of accountsToUpdate) {
    const accRef = doc(db, `${basePath}/accounts/${acc.id}`);
    batch.set(accRef, sanitizeDoc(acc));
  }

  await batch.commit();
  console.log('✓ تم رفع القيد الافتتاحي والمستند وتحديث الحسابات على Firestore بنجاح!');

  // 10. التحقق من الحسابات والقيد
  const acc1121Final = dbData.accounts.find(a => a.code === '1121');
  const acc3110Final = dbData.accounts.find(a => a.code === '3110');

  console.log('\n========================================================');
  console.log('              نتائج التحقق والمطابقة النهائية');
  console.log('========================================================');
  console.log(`1. رصيد حساب 1121 الجديد:       ${acc1121Final.balance.toFixed(3)} د.ك (المطلوب: 28,732.050 د.ك)`);
  console.log(`2. رصيد حساب 3110 الجديد:       ${acc3110Final.balance.toFixed(3)} د.ك (المطلوب: 25,548.698 د.ك)`);
  console.log(`3. مجموع أرصدة كشوف العملاء:    ${currentCustomerBalanceSum.toFixed(3)} د.ك (مطابق 100%)`);
  console.log(`4. توازن القيد المحاسبي:        المدين (${openingJournalEntry.total_debit.toFixed(3)}) === الدائن (${openingJournalEntry.total_credit.toFixed(3)}) - متوازن 100%`);
  console.log(`5. عدد سطور القيد:              14 سطر مدين للعملاء + 1 سطر دائن لرأس المال = 15 سطر`);
  console.log('========================================================');
}

execute().catch(err => {
  console.error('خطأ أثناء التنفيذ:', err);
  process.exit(1);
});
