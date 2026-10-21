import React, { useState, useEffect, useMemo } from 'react';
import { TrialBalanceReport, TrialBalanceItem, CompanyProfile, Account, JournalEntry } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { formatKWD, isAccountLeaf } from '../utils/accountingTreeEngine.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  ShieldCheck,
  X,
  RefreshCw,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Search,
  SlidersHorizontal,
  Layers,
  Calendar,
  Eye,
  EyeOff,
  Building2,
  CheckSquare,
} from 'lucide-react';
import { DataService } from '../services/dataService.ts';
import * as XLSX from 'xlsx';

interface TrialBalanceProps {
  currency: string;
  company?: CompanyProfile | null;
  accounts?: Account[];
  journals?: JournalEntry[];
}

type ColumnMode = '8_COLS' | '6_COLS' | '4_COLS';
type ViewMode = 'TREE' | 'LEAF_ONLY' | 'FLAT';
type DateFilterMode = 'AS_OF' | 'PERIOD';

export const TrialBalanceView: React.FC<TrialBalanceProps> = ({
  currency,
  company,
  accounts: propAccounts,
  journals: propJournals,
}) => {
  const activeCompany = resolveActiveCompany(company);

  // Date states
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentYearStart = useMemo(() => `${new Date().getFullYear()}-01-01`, []);

  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('PERIOD');
  const [asOfDate, setAsOfDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(currentYearStart);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // View & display configuration
  const [columnMode, setColumnMode] = useState<ColumnMode>('8_COLS');
  const [viewMode, setViewMode] = useState<ViewMode>('TREE');
  const [levelFilter, setLevelFilter] = useState<'ALL' | '1' | '2' | '3' | '4'>('ALL');
  const [zeroBalanceFilter, setZeroBalanceFilter] = useState<'SHOW_ALL' | 'HIDE_ZEROS'>('SHOW_ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tree expansion state
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set<string>());

  // Data states
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<ReturnType<typeof DataService.performSelfAuditing> | null>(null);

  // Fetch report data from DataService
  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      let data: TrialBalanceReport;
      if (dateFilterMode === 'PERIOD') {
        data = await DataService.getTrialBalance(endDate, startDate);
      } else {
        data = await DataService.getTrialBalance(asOfDate);
      }
      setReport(data);

      // Auto-expand Level 1 and Level 2 accounts by default
      const defaultExpanded = new Set<string>();
      data.items.forEach((item) => {
        const lvl = item.account.level || 1;
        if (!item.account.isLeaf && lvl <= 2) {
          defaultExpanded.add(item.account.id);
        }
      });
      setExpandedKeys(defaultExpanded);
    } catch (err) {
      console.error('Error fetching trial balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, [dateFilterMode, asOfDate, startDate, endDate]);

  // Toggle single tree node
  const toggleNode = (accId: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(accId)) {
        next.delete(accId);
      } else {
        next.add(accId);
      }
      return next;
    });
  };

  // Expand all parent nodes
  const handleExpandAll = () => {
    if (!report) return;
    const allParents = new Set<string>();
    report.items.forEach((item) => {
      if (!item.account.isLeaf) {
        allParents.add(item.account.id);
      }
    });
    setExpandedKeys(allParents);
  };

  // Collapse all parent nodes
  const handleCollapseAll = () => {
    setExpandedKeys(new Set<string>());
  };

  // Self audit execution
  const handleRunAudit = () => {
    const res = DataService.performSelfAuditing();
    setAuditResult(res);
    setIsAuditModalOpen(true);
  };

  // Filter items based on active criteria
  const filteredItems = useMemo(() => {
    if (!report) return [];

    let list = [...report.items];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const code = String(item.account.code || '').toLowerCase();
        const nameAr = String(item.account.nameAr || '').toLowerCase();
        const nameEn = String((item.account as any).nameEn || '').toLowerCase();
        return code.includes(query) || nameAr.includes(query) || nameEn.includes(query);
      });
    }

    // 2. Zero-Balance Filter
    if (zeroBalanceFilter === 'HIDE_ZEROS') {
      list = list.filter((item) => {
        const hasOpen = Math.abs(item.openingBalanceDebit) > 0.0001 || Math.abs(item.openingBalanceCredit) > 0.0001;
        const hasMov = Math.abs(item.movementDebit) > 0.0001 || Math.abs(item.movementCredit) > 0.0001;
        const hasEnd = Math.abs(item.endingBalanceDebit) > 0.0001 || Math.abs(item.endingBalanceCredit) > 0.0001;
        return hasOpen || hasMov || hasEnd;
      });
    }

    // 3. Level Depth Filter
    if (levelFilter !== 'ALL') {
      const maxLvl = parseInt(levelFilter, 10);
      list = list.filter((item) => {
        const lvl = item.account.level || 1;
        return lvl <= maxLvl;
      });
    }

    // 4. View Mode: Leaf Only vs Flat vs Tree
    if (viewMode === 'LEAF_ONLY') {
      list = list.filter((item) => item.account.isLeaf);
    } else if (viewMode === 'TREE') {
      // In tree mode, hide children whose parent is collapsed (unless search query is active)
      if (!searchQuery.trim()) {
        const parentMap = new Map<string, string>();
        report.items.forEach((item) => {
          if (item.account.parentId) {
            parentMap.set(item.account.id, item.account.parentId);
          }
        });

        list = list.filter((item) => {
          let currParentId = item.account.parentId;
          while (currParentId) {
            if (!expandedKeys.has(currParentId)) {
              return false; // Parent is collapsed -> hide
            }
            currParentId = parentMap.get(currParentId);
          }
          return true;
        });
      }
    }

    return list;
  }, [report, searchQuery, zeroBalanceFilter, levelFilter, viewMode, expandedKeys]);

  // Excel Export Handler (.xlsx)
  const handleExportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();

    const rows: any[] = [];

    // Header metadata rows
    rows.push({ 'كود الحساب': activeCompany.nameAr || 'LOGIX ERP' });
    rows.push({
      'كود الحساب': 'ميزان المراجعة بالمجاميع والأرصدة (Trial Balance)',
      'اسم الحساب المحاسبي': `الفترة: ${report.startDate ? `من ${report.startDate} ` : ''}حتى ${report.asOfDate}`,
      'المستوى': `العملة: ${currency || 'KWD'}`,
    });
    rows.push({}); // Empty separator row

    // Table Data
    filteredItems.forEach((item) => {
      const isDebitNat = (item.account.normalBalance || (item.account as any).nature) === 'DEBIT';
      const rowObj: any = {
        'كود الحساب': item.account.code,
        'اسم الحساب المحاسبي': item.account.nameAr,
        'المستوى': `مستوى ${item.account.level || 1}`,
        'نوع الحساب': item.account.isLeaf ? 'طرفي تحليلي' : 'رئيسي تجميعي',
        'طبيعة الحساب': isDebitNat ? 'مدين (DEBIT)' : 'دائن (CREDIT)',
      };

      if (columnMode === '8_COLS') {
        rowObj['الرصيد الافتتاحي - مدين'] = item.openingBalanceDebit;
        rowObj['الرصيد الافتتاحي - دائن'] = item.openingBalanceCredit;
        rowObj['حركة الفترة - مدين'] = item.movementDebit;
        rowObj['حركة الفترة - دائن'] = item.movementCredit;
        rowObj['الرصيد النهائي - مدين'] = item.endingBalanceDebit;
        rowObj['الرصيد النهائي - دائن'] = item.endingBalanceCredit;
      } else if (columnMode === '6_COLS') {
        rowObj['حركة الفترة - مدين'] = item.movementDebit;
        rowObj['حركة الفترة - دائن'] = item.movementCredit;
        rowObj['الرصيد النهائي - مدين'] = item.endingBalanceDebit;
        rowObj['الرصيد النهائي - دائن'] = item.endingBalanceCredit;
      } else {
        rowObj['صافي الرصيد الافتتاحي'] = item.openingBalanceDebit - item.openingBalanceCredit;
        rowObj['الرصيد النهائي - مدين'] = item.endingBalanceDebit;
        rowObj['الرصيد النهائي - دائن'] = item.endingBalanceCredit;
      }

      rows.push(rowObj);
    });

    // Grand Totals Row (Calculated exclusively from Leaf Accounts)
    const summaryRow: any = {
      'كود الحساب': 'الإجمالي الكلي',
      'اسم الحساب المحاسبي': 'إجمالي ميزان المراجعة المعتمد (منع الازدواجية - حسابات طرفية فقط)',
      'المستوى': '',
      'نوع الحساب': report.isBalanced ? 'متوازن 100%' : 'غير متوازن',
      'طبيعة الحساب': `الفارق: ${(Math.abs(report.totalEndingDebit - report.totalEndingCredit)).toFixed(3)}`,
    };

    if (columnMode === '8_COLS') {
      summaryRow['الرصيد الافتتاحي - مدين'] = report.totalOpeningDebit;
      summaryRow['الرصيد الافتتاحي - دائن'] = report.totalOpeningCredit;
      summaryRow['حركة الفترة - مدين'] = report.totalMovementDebit;
      summaryRow['حركة الفترة - دائن'] = report.totalMovementCredit;
      summaryRow['الرصيد النهائي - مدين'] = report.totalEndingDebit;
      summaryRow['الرصيد النهائي - دائن'] = report.totalEndingCredit;
    } else if (columnMode === '6_COLS') {
      summaryRow['حركة الفترة - مدين'] = report.totalMovementDebit;
      summaryRow['حركة الفترة - دائن'] = report.totalMovementCredit;
      summaryRow['الرصيد النهائي - مدين'] = report.totalEndingDebit;
      summaryRow['الرصيد النهائي - دائن'] = report.totalEndingCredit;
    } else {
      summaryRow['صافي الرصيد الافتتاحي'] = report.totalOpeningDebit - report.totalOpeningCredit;
      summaryRow['الرصيد النهائي - مدين'] = report.totalEndingDebit;
      summaryRow['الرصيد النهائي - دائن'] = report.totalEndingCredit;
    }
    rows.push(summaryRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'ميزان المراجعة');
    const filename = `Trial_Balance_${activeCompany.nameAr || 'LOGIX'}_${report.asOfDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    if (!report) return;
    let csv = '\uFEFF';
    csv += `"${activeCompany.nameAr || 'LOGIX ERP'}"\n`;
    csv += `"ميزان المراجعة بالمجاميع والأرصدة","الفترة: ${report.startDate || 'البداية'} حتى ${report.asOfDate}","العملة: ${currency || 'KWD'}"\n\n`;

    if (columnMode === '8_COLS') {
      csv += 'كود الحساب,اسم الحساب,المستوى,نوع الحساب,الطبيعة,افتتاحي مدين,افتتاحي دائن,حركة مدين,حركة دائن,نهائي مدين,نهائي دائن\n';
      filteredItems.forEach((i) => {
        const isDebitNat = (i.account.normalBalance || (i.account as any).nature) === 'DEBIT';
        const nat = isDebitNat ? 'مدين' : 'دائن';
        const type = i.account.isLeaf ? 'طرفي' : 'تجميعي';
        csv += `"${i.account.code}","${i.account.nameAr}","مستوى ${i.account.level || 1}","${type}","${nat}",${i.openingBalanceDebit},${i.openingBalanceCredit},${i.movementDebit},${i.movementCredit},${i.endingBalanceDebit},${i.endingBalanceCredit}\n`;
      });
      csv += `"الإجمالي","إجمالي ميزان المراجعة المعتمد","","","${report.isBalanced ? 'متوازن' : 'فارق'}",${report.totalOpeningDebit},${report.totalOpeningCredit},${report.totalMovementDebit},${report.totalMovementCredit},${report.totalEndingDebit},${report.totalEndingCredit}\n`;
    } else {
      csv += 'كود الحساب,اسم الحساب,المستوى,نوع الحساب,حركة مدين,حركة دائن,نهائي مدين,نهائي دائن\n';
      filteredItems.forEach((i) => {
        const type = i.account.isLeaf ? 'طرفي' : 'تجميعي';
        csv += `"${i.account.code}","${i.account.nameAr}","مستوى ${i.account.level || 1}","${type}",${i.movementDebit},${i.movementCredit},${i.endingBalanceDebit},${i.endingBalanceCredit}\n`;
      });
      csv += `"الإجمالي","إجمالي ميزان المراجعة المعتمد","","${report.isBalanced ? 'متوازن' : 'فارق'}",${report.totalMovementDebit},${report.totalMovementCredit},${report.totalEndingDebit},${report.totalEndingCredit}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Trial_Balance_${report.asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe Print Trigger
  const handlePrint = () => {
    // Before printing, expand all nodes so paper copies contain the full chart without missing rows
    handleExpandAll();
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="space-y-6 max-w-full text-slate-800 antialiased font-sans">
      {/* 1. Header (Clean Facebook / Modern Enterprise Light UI) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-50 text-[#1877F2] rounded-xl border border-blue-100 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  ميزان المراجعة بالمجاميع والأرصدة (Trial Balance)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  IAS 1 / IFRS
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {activeCompany.nameAr}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                تجميع شجري تفاعلي ذكي لمنع الازدواجية وازدواج الجمع (Deduplicated Tree Rollup)، مع فحص مطابقة القيود وتوازن الأرصدة 100%.
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleRunAudit}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              title="فحص وتطابق الأستاذ المساعد مع حسابات المراقبة العامة وميزان المراجعة"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-100" />
              <span>التدقيق الذاتي (Self-Audit)</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              title="تصدير ميزان المراجعة بصيغة Excel مع كافة الأعمدة والصيغ الحسابية"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel (.xlsx)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              title="تصدير كملف CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>تصدير CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#1877F2] hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              title="طباعة التقرير بالترويسة والتوقيعات المحاسبية المعتمدة"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الميزان</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4 no-print">
        {/* Top Control Row: Dates & Preset Periods */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Selector Mode */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setDateFilterMode('PERIOD')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  dateFilterMode === 'PERIOD'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فترة محددة (من - إلى)
              </button>
              <button
                onClick={() => setDateFilterMode('AS_OF')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  dateFilterMode === 'AS_OF'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                حتى تاريخ معين (As Of)
              </button>
            </div>

            {dateFilterMode === 'PERIOD' ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-semibold">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">حتى تاريخ:</span>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              onClick={fetchTrialBalance}
              disabled={loading}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {/* Column Layout Mode (8 cols / 6 cols / 4 cols) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              أعمدة الميزان:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setColumnMode('8_COLS')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  columnMode === '8_COLS'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="الرصيد الافتتاحي (مدين/دائن) + حركة الفترة (مدين/دائن) + الرصيد الختامي (مدين/دائن)"
              >
                8 أعمدة (المجاميع والأرصدة)
              </button>
              <button
                onClick={() => setColumnMode('6_COLS')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  columnMode === '6_COLS'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="حركة الفترة (مدين/دائن) + الرصيد الختامي (مدين/دائن)"
              >
                6 أعمدة (الحركات والأرصدة)
              </button>
              <button
                onClick={() => setColumnMode('4_COLS')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  columnMode === '4_COLS'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="صافي الافتتاحي + الرصيد الختامي"
              >
                4 أعمدة (الأرصدة فقط)
              </button>
            </div>
          </div>
        </div>

        {/* Second Control Row: Hierarchy, Levels, Zero-Balance & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Hierarchy & View Mode */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              نمط العرض:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('TREE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewMode === 'TREE'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عرض شجري تفاعلي (Tree)
              </button>
              <button
                onClick={() => setViewMode('LEAF_ONLY')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewMode === 'LEAF_ONLY'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض الحسابات الفرعية الطرفية فقط (المعتمدة لجمع الميزان بدون تكرار)"
              >
                حسابات طرفية فقط (Leaf Only)
              </button>
              <button
                onClick={() => setViewMode('FLAT')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewMode === 'FLAT'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كافة المستويات (جدول منبسط)
              </button>
            </div>

            {/* Tree Action Buttons */}
            {viewMode === 'TREE' && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={handleExpandAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                >
                  توسيع الكل
                </button>
                <button
                  onClick={handleCollapseAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                >
                  طي الكل
                </button>
              </div>
            )}

            {/* Level Depth Filter */}
            <div className="flex items-center gap-1 mr-3">
              <span className="text-slate-500 font-semibold text-xs">المستوى:</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">كافة المستويات</option>
                <option value="1">المستوى 1 (رئيسي فقط)</option>
                <option value="2">حتى المستوى 2</option>
                <option value="3">حتى المستوى 3</option>
                <option value="4">حتى المستوى 4</option>
              </select>
            </div>

            {/* Zero Balance Filter */}
            <button
              onClick={() =>
                setZeroBalanceFilter((prev) => (prev === 'SHOW_ALL' ? 'HIDE_ZEROS' : 'SHOW_ALL'))
              }
              className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                zeroBalanceFilter === 'SHOW_ALL'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="التبديل بين إظهار كافة الحسابات بما فيها الصفرية أو إخفاء الحسابات غير النشطة"
            >
              {zeroBalanceFilter === 'SHOW_ALL' ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>عرض الكل (بما فيها الصفرية)</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>الحسابات ذات الحركة فقط</span>
                </>
              )}
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full lg:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بكود أو اسم الحساب..."
              className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Trial Balance Printable Card & Content */}
      {loading ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">جاري إعداد ميزان المراجعة الشجري وتجميع الأرصدة...</p>
          <p className="text-xs text-slate-400 mt-1">يتم التحقق من مطابقة حركة القيود واحتساب إجماليات الحسابات الطرفية لمنع الازدواجية</p>
        </div>
      ) : !report ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl text-slate-500 shadow-xs">
          لا توجد بيانات متاحة لميزان المراجعة في هذه الفترة.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs printable-card">
          {/* Printable Official Header (Shown strictly during Print) */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-950 font-serif">
                  {activeCompany.nameAr || 'شركة LOGIX العالمية'}
                </h1>
                <p className="text-xs text-slate-600 font-sans">
                  {activeCompany.nameEn || 'LOGIX ERP Enterprise Suite'}
                </p>
                <div className="text-[11px] text-slate-600 mt-1 space-x-3 space-x-reverse font-mono">
                  {activeCompany.crNumber && <span>السجل التجاري: {activeCompany.crNumber}</span>}
                  {activeCompany.taxNumber && <span>الرقم الضريبي: {activeCompany.taxNumber}</span>}
                </div>
              </div>

              <div className="text-center">
                <div className="border border-slate-800 px-4 py-1.5 rounded-lg bg-slate-50">
                  <h2 className="text-base font-bold text-slate-900">ميزان المراجعة بالمجاميع والأرصدة</h2>
                  <p className="text-[10px] text-slate-600 font-mono">TRIAL BALANCE REPORT (IAS 1 / IFRS)</p>
                </div>
              </div>

              <div className="text-left text-[11px] text-slate-600 font-mono space-y-0.5">
                <div>تاريخ الاستخراج: {todayStr}</div>
                <div>
                  الفترة: {report.startDate ? `من ${report.startDate} إلى ${report.asOfDate}` : `حتى ${report.asOfDate}`}
                </div>
                <div>العملة المعتمدة: {currency || 'KWD'}</div>
              </div>
            </div>
          </div>

          {/* Balance Status Banner (Top Status) */}
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
              report.isBalanced
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  report.isBalanced ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {report.isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm">
                    {report.isBalanced
                      ? '✅ ميزان المراجعة متوازن 100% (إجمالي المدين = إجمالي الدائن)'
                      : '❌ تنبيه: ميزان المراجعة غير متوازن! يوجد خلل في الترحيل المحاسبي.'}
                  </h3>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/80 border border-emerald-300 font-bold">
                    الفارق: {formatKWD(Math.abs(report.totalEndingDebit - report.totalEndingCredit))}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  الفترة:{' '}
                  <span className="font-mono font-semibold">
                    {report.startDate ? `من ${report.startDate} إلى ` : 'حتى '}
                    {report.asOfDate}
                  </span>{' '}
                  • إجمالي الحسابات المعروضة:{' '}
                  <span className="font-bold">{filteredItems.length}</span> حساب (من إجمالي {report.items.length})
                </p>
              </div>
            </div>

            {/* Quick KPI summary box */}
            <div className="flex items-center gap-3 bg-white/90 border border-emerald-200 px-3.5 py-2 rounded-lg font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">إجمالي حركة المدين:</span>
                <span className="font-bold text-emerald-800">{formatKWD(report.totalMovementDebit)}</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-500 block text-[10px]">إجمالي حركة الدائن:</span>
                <span className="font-bold text-rose-800">{formatKWD(report.totalMovementCredit)}</span>
              </div>
            </div>
          </div>

          {/* 4. The Unified Trial Balance Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-right text-xs border-collapse">
              {/* Header structure conforming to standard accounting layouts */}
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th
                    rowSpan={2}
                    className="py-3 px-3 border-r border-slate-200 font-mono text-center w-28 text-slate-900"
                  >
                    كود الحساب
                  </th>
                  <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 min-w-56 text-slate-900">
                    اسم الحساب المحاسبي
                  </th>
                  <th rowSpan={2} className="py-3 px-2 border-r border-slate-200 text-center w-24 text-slate-900 no-print">
                    التصنيف
                  </th>

                  {/* 8 Columns: Opening + Movements + Ending */}
                  {columnMode === '8_COLS' && (
                    <th colSpan={2} className="py-2 px-3 text-center border-b border-r border-slate-200 bg-slate-200/60 text-slate-900">
                      الرصيد الافتتاحي (Opening)
                    </th>
                  )}

                  {/* Movements (Always in 8 and 6 cols) */}
                  {(columnMode === '8_COLS' || columnMode === '6_COLS') && (
                    <th colSpan={2} className="py-2 px-3 text-center border-b border-r border-slate-200 bg-blue-100/50 text-blue-950">
                      حركات الفترة (المجاميع Movements)
                    </th>
                  )}

                  {/* Ending Balance (Always in all modes) */}
                  <th colSpan={2} className="py-2 px-3 text-center border-b border-slate-200 bg-emerald-100/40 text-emerald-950">
                    الرصيد المترصد النهائي (Ending Balance)
                  </th>
                </tr>

                {/* Sub-header for Debit / Credit */}
                <tr className="bg-slate-200/50 text-[11px] text-slate-600">
                  {columnMode === '8_COLS' && (
                    <>
                      <th className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-emerald-800">
                        مدين (Debit)
                      </th>
                      <th className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-rose-800">
                        دائن (Credit)
                      </th>
                    </>
                  )}

                  {(columnMode === '8_COLS' || columnMode === '6_COLS') && (
                    <>
                      <th className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-emerald-800">
                        مدين (Debit)
                      </th>
                      <th className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-rose-800">
                        دائن (Credit)
                      </th>
                    </>
                  )}

                  <th className="py-1.5 px-3 text-center border-r border-slate-200 font-mono font-bold text-emerald-800 bg-emerald-50/50">
                    مدين (Debit)
                  </th>
                  <th className="py-1.5 px-3 text-center font-mono font-bold text-rose-800 bg-rose-50/50">
                    دائن (Credit)
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                      لا توجد حسابات مطابقة لمعايير البحث والتصفية المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLeaf = item.account.isLeaf;
                    const level = item.account.level || 1;
                    const isDebitNat = (item.account.normalBalance || (item.account as any).nature) === 'DEBIT';
                    const isExpanded = expandedKeys.has(item.account.id);

                    // Row styling based on hierarchy level
                    let rowBg = 'bg-white hover:bg-slate-50/80';
                    let fontStyle = 'font-normal text-slate-700';

                    if (level === 1) {
                      rowBg = 'bg-slate-100/90 hover:bg-slate-200/80 font-bold text-slate-900 border-t-2 border-slate-300';
                      fontStyle = 'font-bold text-slate-950 text-[13px]';
                    } else if (level === 2) {
                      rowBg = 'bg-slate-50/70 hover:bg-slate-100 font-semibold text-slate-850';
                      fontStyle = 'font-semibold text-slate-900 text-xs';
                    } else if (!isLeaf) {
                      rowBg = 'bg-blue-50/20 hover:bg-blue-50/40 text-slate-800 font-medium';
                      fontStyle = 'font-medium text-slate-850';
                    }

                    // Dynamic indentation according to level
                    const paddingIndent =
                      viewMode === 'TREE'
                        ? level === 1
                          ? 'pr-3'
                          : level === 2
                          ? 'pr-7'
                          : level === 3
                          ? 'pr-11'
                          : level === 4
                          ? 'pr-14'
                          : 'pr-16'
                        : 'pr-3';

                    return (
                      <tr key={item.account.id} className={`${rowBg} transition-colors group`}>
                        {/* 1. Account Code */}
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-center text-blue-700">
                          {item.account.code}
                        </td>

                        {/* 2. Account Name + Hierarchy & Badges */}
                        <td className={`py-2 px-3 border-r border-slate-200 ${paddingIndent}`}>
                          <div className="flex items-center gap-2">
                            {/* Tree expand / collapse toggle */}
                            {viewMode === 'TREE' && !isLeaf ? (
                              <button
                                onClick={() => toggleNode(item.account.id)}
                                className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                title={isExpanded ? 'طي الحساب' : 'توسيع الحساب'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-blue-700" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </button>
                            ) : (
                              viewMode === 'TREE' && <div className="w-5" />
                            )}

                            {/* Node Icon */}
                            {!isLeaf ? (
                              isExpanded ? (
                                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                              )
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}

                            {/* Account Name */}
                            <span className={fontStyle}>{item.account.nameAr}</span>

                            {/* Level Badge */}
                            {!isLeaf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono no-print">
                                L{level}
                              </span>
                            )}

                            {/* Accounting Nature Badge (Normal Balance) */}
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border no-print ${
                                isDebitNat
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-purple-50 text-purple-800 border-purple-200'
                              }`}
                            >
                              {isDebitNat ? 'طبيعة: مدين' : 'طبيعة: دائن'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Account Type / Status */}
                        <td className="py-2 px-2 border-r border-slate-200 text-center no-print">
                          {isLeaf ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                              طرفي تحليلي
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                              تجميعي (Rollup)
                            </span>
                          )}
                        </td>

                        {/* 4. Opening Balance - Debit */}
                        {columnMode === '8_COLS' && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-emerald-700">
                              {item.openingBalanceDebit > 0 ? formatKWD(item.openingBalanceDebit) : '-'}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-rose-700">
                              {item.openingBalanceCredit > 0 ? formatKWD(item.openingBalanceCredit) : '-'}
                            </td>
                          </>
                        )}

                        {/* 5. Period Movement - Debit & Credit */}
                        {(columnMode === '8_COLS' || columnMode === '6_COLS') && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
                              {item.movementDebit > 0 ? formatKWD(item.movementDebit) : '-'}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
                              {item.movementCredit > 0 ? formatKWD(item.movementCredit) : '-'}
                            </td>
                          </>
                        )}

                        {/* 6. Ending Balance - Debit & Credit */}
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                          {item.endingBalanceDebit > 0 ? formatKWD(item.endingBalanceDebit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/20">
                          {item.endingBalanceCredit > 0 ? formatKWD(item.endingBalanceCredit) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* 5. Grand Totals Summary Row (Summing ONLY Leaf Accounts to prevent double-counting) */}
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-950">
                  <td className="py-3.5 px-3 border-r border-slate-800 font-mono text-center text-amber-400">
                    الإجمالي
                  </td>
                  <td className="py-3.5 px-4 border-r border-slate-800 text-right">
                    <div className="flex items-center justify-between">
                      <span>إجمالي ميزان المراجعة المعتمد (حسابات طرفية فقط لمنع الازدواجية):</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Leaf Accounts Deduplicated
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-2 border-r border-slate-800 text-center no-print">
                    <span className="text-[10px] font-mono text-emerald-400">
                      {report.isBalanced ? '✓ متوازن' : '⚠ فارق'}
                    </span>
                  </td>

                  {/* Opening Balance Totals */}
                  {columnMode === '8_COLS' && (
                    <>
                      <td className="py-3.5 px-3 border-r border-slate-800 text-center font-mono text-emerald-400 bg-slate-800/60">
                        {formatKWD(report.totalOpeningDebit)}
                      </td>
                      <td className="py-3.5 px-3 border-r border-slate-800 text-center font-mono text-rose-300 bg-slate-800/60">
                        {formatKWD(report.totalOpeningCredit)}
                      </td>
                    </>
                  )}

                  {/* Movement Totals */}
                  {(columnMode === '8_COLS' || columnMode === '6_COLS') && (
                    <>
                      <td className="py-3.5 px-3 border-r border-slate-800 text-center font-mono text-emerald-400 bg-slate-850">
                        {formatKWD(report.totalMovementDebit)}
                      </td>
                      <td className="py-3.5 px-3 border-r border-slate-800 text-center font-mono text-rose-300 bg-slate-850">
                        {formatKWD(report.totalMovementCredit)}
                      </td>
                    </>
                  )}

                  {/* Ending Balance Totals */}
                  <td className="py-3.5 px-3 border-r border-slate-800 text-center font-mono text-emerald-400 bg-emerald-950/60">
                    {formatKWD(report.totalEndingDebit)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-rose-300 bg-rose-950/60">
                    {formatKWD(report.totalEndingCredit)}
                  </td>
                </tr>

                {/* 6. Balance Verification Status Row */}
                <tr className="bg-slate-50 text-[11px] text-slate-600 border-t border-slate-200">
                  <td colSpan={3} className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">حالة التطابق المحاسبي:</span>
                      {report.isBalanced ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          متطابق تماماً 100% (إجمالي المدين = إجمالي الدائن) • الفارق المحاسبي: 0.000 د.ك
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          يوجد فارق غير متوازن:{' '}
                          {formatKWD(Math.abs(report.totalEndingDebit - report.totalEndingCredit))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    colSpan={columnMode === '8_COLS' ? 6 : columnMode === '6_COLS' ? 4 : 2}
                    className="py-2.5 px-4 text-left font-mono text-slate-500"
                  >
                    {report.isBalanced
                      ? '✓ Double-Entry Invariant Verified (Zero Variance)'
                      : '⚠ Out of Balance Warning'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 7. Official Signatures Footer (Visible in Print Mode) */}
          <div className="hidden print:block pt-8 mt-6 border-t-2 border-slate-900">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="border border-slate-300 p-3 rounded-lg">
                <span className="font-bold text-slate-900 block mb-1">إعداد / المحاسب المسؤول</span>
                <span className="text-slate-500 text-[10px] block">Prepared by</span>
                <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                <span className="text-[10px] text-slate-400 mt-1 block">التوقيع والتاريخ</span>
              </div>

              <div className="border border-slate-300 p-3 rounded-lg">
                <span className="font-bold text-slate-900 block mb-1">مراجعة / المراجع الداخلي</span>
                <span className="text-slate-500 text-[10px] block">Audited by</span>
                <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                <span className="text-[10px] text-slate-400 mt-1 block">التوقيع والتاريخ</span>
              </div>

              <div className="border border-slate-300 p-3 rounded-lg">
                <span className="font-bold text-slate-900 block mb-1">اعتماد / المدير المالي</span>
                <span className="text-slate-500 text-[10px] block">Approved by (CFO)</span>
                <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                <span className="text-[10px] text-slate-400 mt-1 block">الختم والتوقيع الرسمي</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 mt-4 font-mono">
              صفحة 1 من 1 • تم استخراج هذا التقرير آلياً عبر نظام LOGIX ERP وفق المعايير الدولية لإعداد التقارير المالية (IFRS)
            </div>
          </div>
        </div>
      )}

      {/* 8. Self-Auditing Reconciliation Modal */}
      {isAuditModalOpen && auditResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">تقرير التدقيق والمطابقة المحاسبية الذاتية</h3>
                  <p className="text-xs text-slate-400">
                    التحقق الآلي من توازن الدفاتر ومطابقة الأستاذ المساعد لحسابات المراقبة (IFRS)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Overall Status */}
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 ${
                  auditResult.isFullyAudited
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                {auditResult.isFullyAudited ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {auditResult.isFullyAudited
                      ? 'جميع الحسابات متطابقة تماماً ومتوازنة دون أي فروقات'
                      : 'تم رصد بعض الفروقات المحاسبية أو عدم التطابق التي تتطلب مراجعة القيود'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">{auditResult.statusMessage}</p>
                </div>
              </div>

              {/* 4 Pillars of Reconciliation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Trial Balance */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">1. توازن ميزان المراجعة</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.trialBalanceBalanced
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.trialBalanceBalanced ? 'متطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-600">
                    <div className="flex justify-between">
                      <span>إجمالي المدين:</span>
                      <span className="font-bold text-emerald-700">{formatKWD(auditResult.totalDebit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إجمالي الدائن:</span>
                      <span className="font-bold text-rose-700">{formatKWD(auditResult.totalCredit)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. AR (Customers) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">2. أستاذ العملاء vs مراقبة (1120)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.receivableMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.receivableMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-600">
                    <div className="flex justify-between">
                      <span>أرصدة العملاء:</span>
                      <span className="font-bold">{formatKWD(auditResult.receivableSubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.receivableControl)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. AP (Suppliers) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">3. أستاذ الموردين vs مراقبة (2110)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.payableMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.payableMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-600">
                    <div className="flex justify-between">
                      <span>أرصدة الموردين:</span>
                      <span className="font-bold">{formatKWD(auditResult.payableSubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.payableControl)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Inventory */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">4. تقييم المخزون vs مراقبة (1130)</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditResult.inventoryMatched
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {auditResult.inventoryMatched ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-600">
                    <div className="flex justify-between">
                      <span>تقييم الأصناف:</span>
                      <span className="font-bold">{formatKWD(auditResult.inventorySubledger)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب المراقبة:</span>
                      <span className="font-bold">{formatKWD(auditResult.inventoryControl)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discrepancies Details if any */}
              {auditResult.discrepancies.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <h5 className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    تفاصيل الفروقات المرصودة:
                  </h5>
                  <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
                    {auditResult.discrepancies.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                تاريخ الفحص: {auditResult.reconciledDate}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAudit}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  إعادة الفحص
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
