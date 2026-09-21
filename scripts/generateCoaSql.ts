import fs from 'fs';
import { COMPLETE_EXPERT_CHART_OF_ACCOUNTS } from '../src/data/completeChartOfAccounts.js';

// Existing known UUIDs from supabase_master_setup_new_db.sql
const KNOWN_UUIDS: Record<string, string> = {
  '1000': '950b66da-93f0-48d3-86a6-991d3eb6ae18',
  '1100': '38e5d104-e422-4cc0-adfa-6e7bdbfae1d7',
  '1110': '043aa211-99eb-41bf-bef7-b2ecd2880a1c',
  '1111': '84705122-1cd3-4256-b00f-485f35c88fdc',
  '1112': 'cdeeced2-2efa-40af-bfcf-81111cc456c4',
  '1113': '0bdffdf1-72b5-4483-83b8-77ce8fe1a58e',
  '1120': 'c508c1b0-fc98-4fc6-badb-7559a1f382e5',
  '1130': '7674f2a8-05ae-4212-b686-023e975107ce',
  '1200': '9fe4d708-2fe5-4821-b453-a8e697791556',
  '1210': '6a25e26e-49c0-4035-8fcc-39969f65c620',
  '1220': 'ed5f7c4a-cded-480d-baee-4c250ceab0cb',
  '2000': '744d2def-d549-46cf-9eb8-f63b109768e3',
  '2100': 'fca6ec62-13cb-4411-b7b2-861ed87ceb09',
  '2110': '98b0d148-460d-4e40-9413-5e9fc3558e81',
  '3000': '78308eda-8598-40f2-89e1-c5ade18fe657',
  '3100': 'bf25f8f9-9775-4fc5-8ff6-187c9b5306e5',
  '3110': '28d1df02-4e01-4475-ae90-c6517e4726ef',
  '3200': 'd9a280f5-b72e-48f2-a9b2-e06ad2b448f4',
  '4000': '7a7ce370-d549-4cdd-ad83-976ae0876e38',
  '4100': 'cc462151-21ba-4dfc-8a70-b9e59de86885',
  '5000': '4ddcdc00-b778-4f57-8743-8ac4930b9426',
  '5100': '79190e51-03ec-4a54-a5b5-73cd90b42610',
  '5200': 'c8bf689f-b361-4e38-a26a-357d8186cd6c',
  '5210': '9e0a2a7d-383e-4c69-b598-b0f9018b7981',
};

function getAccountUUID(code: string): string {
  if (KNOWN_UUIDS[code]) return KNOWN_UUIDS[code];
  const pad = code.padStart(4, '0');
  return `0000${pad}-0000-4000-8000-000000000000`;
}

// Sort by level ascending so parent accounts are inserted before their child accounts
const sorted = [...COMPLETE_EXPERT_CHART_OF_ACCOUNTS].sort((a, b) => a.level - b.level);

let sql = '-- ============================================================================\n';
sql += '-- الدليل المحاسبي الشجري الشامل المعتمد (114 حساب محاسبي)\n';
sql += '-- متوافق مع معايير المحاسبة الدولية IFRS والأنظمة المحاسبية المعتمدة في الكويت\n';
sql += '-- ============================================================================\n\n';
sql += 'DO $$\n';
sql += 'DECLARE\n';
sql += '    target_company_uuid UUID := \'20000000-0000-0000-0000-000000000001\'::uuid;\n';
sql += 'BEGIN\n';
sql += '    -- التأكد من وجود الشركة في جدول الشركات\n';
sql += '    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = target_company_uuid) THEN\n';
sql += '        SELECT id INTO target_company_uuid FROM public.companies LIMIT 1;\n';
sql += '    END IF;\n\n';
sql += '    IF target_company_uuid IS NULL THEN\n';
sql += '        RAISE NOTICE \'لم يتم العثور على شركة لتثبيت الدليل المحاسبي عليها.\';\n';
sql += '        RETURN;\n';
sql += '    END IF;\n\n';

sql += '    -- إدراج وتحديث شجرة الحسابات الكاملة\n';
sql += '    INSERT INTO public.chart_of_accounts (\n';
sql += '        id, company_id, code, name_ar, name_en, category, normal_balance, level, type, parent_id, balance, description, is_active, is_system, updated_at\n';
sql += '    ) VALUES\n';

const values = sorted.map((acc) => {
  const id = getAccountUUID(acc.code);
  const parentCode = acc.parentId ? acc.parentId.replace('acc-', '') : null;
  const parentUUID = parentCode ? `'${getAccountUUID(parentCode)}'::uuid` : 'NULL';
  const nameAr = acc.nameAr.replace(/'/g, "''");
  const nameEn = (acc.nameEn || '').replace(/'/g, "''");
  const desc = (acc.description || '').replace(/'/g, "''");
  const type = acc.type || (acc.level <= 2 ? 'HEADER' : 'DETAIL');

  return `        ('${id}'::uuid, target_company_uuid, '${acc.code}', '${nameAr}', '${nameEn}', '${acc.category}', '${acc.normalBalance}', ${acc.level}, '${type}', ${parentUUID}, 0, '${desc}', TRUE, TRUE, now())`;
});

sql += values.join(',\n') + '\n';
sql += '    ON CONFLICT (company_id, code) DO UPDATE SET\n';
sql += '        name_ar = EXCLUDED.name_ar,\n';
sql += '        name_en = EXCLUDED.name_en,\n';
sql += '        category = EXCLUDED.category,\n';
sql += '        normal_balance = EXCLUDED.normal_balance,\n';
sql += '        level = EXCLUDED.level,\n';
sql += '        type = EXCLUDED.type,\n';
sql += '        parent_id = EXCLUDED.parent_id,\n';
sql += '        description = EXCLUDED.description,\n';
sql += '        is_active = TRUE,\n';
sql += '        is_system = TRUE,\n';
sql += '        updated_at = now();\n\n';

sql += '    RAISE NOTICE \'تم بنجاح تحديث وتثبيت الدليل المحاسبي الشامل لشركة % (114 حساب)\', target_company_uuid;\n';
sql += 'END $$;\n';

fs.writeFileSync('comprehensive_chart_of_accounts_complete.sql', sql, 'utf8');
console.log('Successfully written comprehensive_chart_of_accounts_complete.sql with', sorted.length, 'accounts');
