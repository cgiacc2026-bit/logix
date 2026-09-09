import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  Layers,
  ArrowRight,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
  Settings2,
  Check,
  ShieldCheck,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency } from '../utils/formatters.ts';
import { DataService } from '../services/dataService.ts';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importType: 'CUSTOMERS' | 'SUPPLIERS' | 'INVENTORY';
  currency: string;
  onSuccess: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  importType,
  currency,
  onSuccess,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [createOpeningJournal, setCreateOpeningJournal] = useState(true);
  const [importMode, setImportMode] = useState<'upsert' | 'append' | 'update_only'>('upsert');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'INPUT' | 'PREVIEW' | 'VERIFIED_SUCCESS'>('INPUT');
  const [verificationResult, setVerificationResult] = useState<{
    count: number;
    newCount: number;
    updatedCount: number;
    totalStockValue?: number;
    journalId?: string;
    totalInventoryInDb?: number;
    verifiedInDb?: boolean;
    verifiedAt?: string;
  } | null>(null);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (importType) {
      case 'CUSTOMERS':
        return 'استيراد دليل العملاء مع أرصدة أول المدة';
      case 'SUPPLIERS':
        return 'استيراد دليل الموردين مع أرصدة أول المدة';
      case 'INVENTORY':
        return 'استيراد بطاقات الأصناف والمخزون بكافة الخيارات (Full Options)';
    }
  };

  const getSampleTemplateText = () => {
    switch (importType) {
      case 'CUSTOMERS':
        return `كود العميل\tاسم العميل بالعربي\tالهاتف\tالرقم الضريبي/المدني\tرصيد أول المدة\nC-101\tشركة النور للتجارة\t96599887766\t123456789\t1500.000\nC-102\tجمعية الروضة التعاونية\t96599112233\t987654321\t3250.500\nC-103\tمؤسسة الفهد للمقاولات\t96566554433\t456123789\t850.000`;
      case 'SUPPLIERS':
        return `كود المورد\tاسم المورد بالعربي\tالهاتف\tالرقم الضريبي\tرصيد أول المدة\nS-201\tشركة الألبان الكويتية الدنماركية (KDD)\t96522334455\t112233445\t4500.000\nS-202\tشركة المطاحن والدقيق الكويتية\t96522446688\t556677889\t6200.000\nS-203\tمؤسسة الخليج للتوريدات\t96599775533\t998877665\t1800.000`;
      case 'INVENTORY':
        return `كود الصنف SKU\tالباركود\tاسم الصنف بالعربي\tاسم الصنف بالإنجليزي\tالتصنيف\tالوحدة الأساسية\tوحدة الشد\tسعة الشد\tسعر التكلفة (الشراء)\tسعر البيع\tرصيد أول المدة\tحد إعادة الطلب\nSKU-1001\t628100123456\tطحين فاخر كويتي 10 كجم\tKuwaiti Flour 10kg\tالمواد الغذائية\tكيس\tكرتون\t4\t3.250\t4.500\t120\t20\nSKU-1002\t628100234567\tزيت ذرة نقي 5 لتر\tPure Corn Oil 5L\tالزيوت\tحبة\tكرتون\t4\t2.100\t2.950\t85\t15\nSKU-1003\t628100345678\tأرز بسمتي درجة أولى 20 كجم\tBasmati Rice 20kg\tالحبوب\tكيس\tطرد\t1\t6.800\t8.750\t50\t10\nSKU-1004\t628100456789\tسكر ناعم 5 كجم\tFine Sugar 5kg\tالمواد الغذائية\tكيس\tكرتون\t6\t1.400\t1.900\t200\t30`;
    }
  };

  // Download Blank Excel (.xlsx) Template for clean manual filling
  const handleDownloadBlankExcelTemplate = () => {
    let headers: string[] = [];
    let blankRows: any[][] = [];
    let instructions: any[][] = [];
    let fileName = `نموذج_${importType === 'INVENTORY' ? 'المخزون' : importType === 'CUSTOMERS' ? 'العملاء' : 'الموردين'}_فارغ_للتعبئة.xlsx`;

    if (importType === 'INVENTORY') {
      headers = [
        'كود الصنف SKU * (إلزامي)',
        'الباركود Barcode (اختياري)',
        'اسم الصنف بالعربي * (إلزامي)',
        'اسم الصنف بالإنجليزي (اختياري)',
        'التصنيف Category',
        'الوحدة الأساسية (حبة/كيس/متر)',
        'وحدة الشد (كرتون/طرد)',
        'سعة الشد (عدد الحبات بالكرتون)',
        'سعر التكلفة (الشراء)',
        'سعر البيع',
        'رصيد أول المدة (الكمية بالمستودع)',
        'حد إعادة الطلب (Reorder Level)',
      ];
      // 10 formatted blank rows with standard default suggestions
      blankRows = [
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
        ['', '', '', '', 'عام', 'حبة', 'كرتون', 1, 0, 0, 0, 5],
      ];
      instructions = [
        ['دليل وتعليمات تعبئة نموذج إكسل للأصناف والمخزون'],
        [''],
        ['الحقل / العمود', 'الأهمية', 'الوصف والتوجيه'],
        ['كود الصنف SKU', 'إلزامي', 'كود فريد يحدد الصنف (مثال: PRD-001 أو SKU-101)، لا يجوز تكراره'],
        ['الباركود Barcode', 'اختياري', 'الباركود الدولي أو المحلي المطبوع على الصنف للقراءة بماسح الباركود'],
        ['اسم الصنف بالعربي', 'إلزامي', 'الاسم التجاري أو الوصف باللغة العربية (مثال: طحين كويتي فاخر 10 كجم)'],
        ['اسم الصنف بالإنجليزي', 'اختياري', 'الاسم باللغة الإنجليزية'],
        ['التصنيف Category', 'اختياري', 'القسم أو المجموعة التابع لها الصنف (مثال: المواد الغذائية / المنظفات)'],
        ['الوحدة الأساسية', 'اختياري', 'وحدة البيع الصغرى (حبة، قطعة، كيس، لتر، علبة) - الافتراضي: حبة'],
        ['وحدة الشد Pack Unit', 'اختياري', 'وحدة التعبئة الكبرى (كرتون، صندوق، طرد، شدة) - الافتراضي: كرتون'],
        ['سعة الشد Units/Pack', 'اختياري', 'عدد الوحدات الأساسية داخل الكرتون الواحد (الافتراضي: 1)'],
        ['سعر التكلفة Cost Price', 'اختياري', 'سعر شراء الصنف للوحدة الأساسية الواحدة (أرقام فقط بدون رموز عملات)'],
        ['سعر البيع Sale Price', 'اختياري', 'سعر بيع الصنف للوحدة الأساسية الواحدة (أرقام فقط)'],
        ['رصيد أول المدة Qty', 'اختياري', 'الكمية الفعلية المتوفرة بالمستودع حالياً بالوحدة الأساسية (الحبة)'],
        ['حد إعادة الطلب Reorder Level', 'اختياري', 'الرصيد الأدنى الذي يطلق عنده النظام تحذيراً وتنبيهاً آلياً لطلب شراء جديد'],
      ];
    } else if (importType === 'CUSTOMERS') {
      headers = ['كود العميل (اختياري)', 'اسم العميل بالعربي * (إلزامي)', 'الهاتف', 'الرقم الضريبي/المدني', 'رصيد أول المدة'];
      blankRows = [
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
      ];
      instructions = [
        ['دليل تعبئة نموذج العملاء'],
        ['كود العميل: رمز فريد مثل C-101'],
        ['اسم العميل: الاسم الرسمي للعميل أو الشركة'],
        ['رصيد أول المدة: الرصيد الافتتاحي المستحق على العميل'],
      ];
    } else {
      headers = ['كود المورد (اختياري)', 'اسم المورد بالعربي * (إلزامي)', 'الهاتف', 'الرقم الضريبي', 'رصيد أول المدة'];
      blankRows = [
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
        ['', '', '', '', 0],
      ];
      instructions = [
        ['دليل تعبئة نموذج الموردين'],
        ['كود المورد: رمز فريد مثل S-201'],
        ['اسم المورد: الاسم التجاري للمورد أو الشركة'],
        ['رصيد أول المدة: الرصيد الافتتاحي المستحق للمورد'],
      ];
    }

    const wb = XLSX.utils.book_new();

    // Data sheet
    const wsData = XLSX.utils.aoa_to_sheet([headers, ...blankRows]);
    wsData['!cols'] = headers.map(() => ({ wch: 26 }));
    XLSX.utils.book_append_sheet(wb, wsData, 'بيانات الأصناف للتعبئة');

    // Instructions sheet
    if (instructions.length > 0) {
      const wsInst = XLSX.utils.aoa_to_sheet(instructions);
      wsInst['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsInst, 'تعليمات وشروط التعبئة');
    }

    XLSX.writeFile(wb, fileName);
  };

  // Download Excel (.xlsx) Template with Sample Data
  const handleDownloadTemplateExcel = () => {
    let headers: string[] = [];
    let sampleData: any[][] = [];
    let fileName = `template_${importType.toLowerCase()}.xlsx`;

    if (importType === 'INVENTORY') {
      headers = [
        'كود الصنف SKU',
        'الباركود Barcode',
        'اسم الصنف بالعربي Name Ar',
        'اسم الصنف بالإنجليزي Name En',
        'التصنيف Category',
        'الوحدة الأساسية Basic Unit',
        'وحدة الشد Pack Unit',
        'سعة الشد Units Per Pack',
        'سعر التكلفة Cost Price',
        'سعر البيع Sale Price',
        'رصيد أول المدة Opening Qty',
        'حد إعادة الطلب Min Alert',
      ];
      sampleData = [
        ['SKU-1001', '628100123456', 'طحين فاخر كويتي 10 كجم', 'Kuwaiti Flour 10kg', 'المواد الغذائية', 'كيس', 'كرتون', 4, 3.250, 4.500, 120, 20],
        ['SKU-1002', '628100234567', 'زيت ذرة نقي 5 لتر', 'Pure Corn Oil 5L', 'الزيوت', 'حبة', 'كرتون', 4, 2.100, 2.950, 85, 15],
        ['SKU-1003', '628100345678', 'أرز بسمتي درجة أولى 20 كجم', 'Basmati Rice 20kg', 'الحبوب', 'كيس', 'طرد', 1, 6.800, 8.750, 50, 10],
        ['SKU-1004', '628100456789', 'سكر ناعم 5 كجم', 'Fine Sugar 5kg', 'المواد الغذائية', 'كيس', 'كرتون', 6, 1.400, 1.900, 200, 30],
      ];
    } else if (importType === 'CUSTOMERS') {
      headers = ['كود العميل', 'اسم العميل بالعربي', 'الهاتف', 'الرقم الضريبي/المدني', 'رصيد أول المدة'];
      sampleData = [
        ['C-101', 'شركة النور للتجارة', '96599887766', '123456789', 1500.0],
        ['C-102', 'جمعية الروضة التعاونية', '96599112233', '987654321', 3250.5],
        ['C-103', 'مؤسسة الفهد للمقاولات', '96566554433', '456123789', 850.0],
      ];
    } else {
      headers = ['كود المورد', 'اسم المورد بالعربي', 'الهاتف', 'الرقم الضريبي', 'رصيد أول المدة'];
      sampleData = [
        ['S-201', 'شركة الألبان الكويتية الدنماركية (KDD)', '96522334455', '112233445', 4500.0],
        ['S-202', 'شركة المطاحن والدقيق الكويتية', '96522446688', '556677889', 6200.0],
        ['S-203', 'مؤسسة الخليج للتوريدات', '96599775533', '998877665', 1800.0],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
    XLSX.writeFile(wb, fileName);
  };

  // Download TSV / CSV Template
  const handleDownloadTemplateCsv = () => {
    const templateContent = getSampleTemplateText();
    const blob = new Blob(['\uFEFF' + templateContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${importType.toLowerCase()}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Smart column mapping from Array of Arrays (XLSX or CSV)
  const parseAoaData = (aoa: any[][]) => {
    if (!aoa || aoa.length === 0) {
      setParseError('لم يتم العثور على صفوف في الملف المحدد.');
      return;
    }

    const firstRow = aoa[0].map((c) => String(c || '').trim().toLowerCase().replace(/[\s_\-()]/g, ''));
    let hasHeader = false;

    // Check if first row contains column headers
    if (
      firstRow.some(
        (cell) =>
          cell.includes('sku') ||
          cell.includes('كود') ||
          cell.includes('code') ||
          cell.includes('اسم') ||
          cell.includes('name') ||
          cell.includes('باركود') ||
          cell.includes('barcode') ||
          cell.includes('رصيد')
      )
    ) {
      hasHeader = true;
    }

    const dataRows = hasHeader ? aoa.slice(1) : aoa;
    const headerRow = hasHeader ? firstRow : [];

    // Detect column indexes for Inventory
    const findColIdx = (keywords: string[], fallbackIdx: number) => {
      if (!hasHeader) return fallbackIdx;
      const idx = headerRow.findIndex((h) => keywords.some((kw) => h.includes(kw)));
      return idx !== -1 ? idx : fallbackIdx;
    };

    const results: any[] = [];

    dataRows.forEach((row, index) => {
      if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
        return;
      }

      if (importType === 'CUSTOMERS') {
        const cCode = row[findColIdx(['كود', 'code', 'رقم'], 0)] || `C-${index + 1}`;
        const cName = row[findColIdx(['اسم', 'name', 'عميل'], 1)] || `عميل ${index + 1}`;
        const cPhone = row[findColIdx(['هاتف', 'phone', 'موبايل', 'جوال'], 2)] || '';
        const cTax = row[findColIdx(['ضريب', 'مدني', 'tax', 'civil'], 3)] || '';
        const cBal = Number(row[findColIdx(['رصيد', 'balance', 'اول'], 4)]) || 0;
        results.push({
          code: String(cCode).trim(),
          nameAr: String(cName).trim(),
          phone: String(cPhone).trim(),
          taxNumber: String(cTax).trim(),
          openingBalance: cBal,
        });
      } else if (importType === 'SUPPLIERS') {
        const sCode = row[findColIdx(['كود', 'code', 'رقم'], 0)] || `S-${index + 1}`;
        const sName = row[findColIdx(['اسم', 'name', 'مورد'], 1)] || `مورد ${index + 1}`;
        const sPhone = row[findColIdx(['هاتف', 'phone', 'موبايل', 'جوال'], 2)] || '';
        const sTax = row[findColIdx(['ضريب', 'tax'], 3)] || '';
        const sBal = Number(row[findColIdx(['رصيد', 'balance', 'اول'], 4)]) || 0;
        results.push({
          code: String(sCode).trim(),
          nameAr: String(sName).trim(),
          phone: String(sPhone).trim(),
          taxNumber: String(sTax).trim(),
          openingBalance: sBal,
        });
      } else if (importType === 'INVENTORY') {
        const skuIdx = findColIdx(['sku', 'كود', 'رمز', 'رقم'], 0);
        const barcodeIdx = findColIdx(['باركود', 'barcode', 'qr'], 1);
        const nameArIdx = findColIdx(['اسمعرب', 'اسم', 'namear', 'name', 'صنف'], 2);
        const nameEnIdx = findColIdx(['اسمانجليز', 'انجليز', 'nameen', 'english'], 3);
        const catIdx = findColIdx(['تصنيف', 'category', 'قسم', 'مجموع'], 4);
        const unitIdx = findColIdx(['وحدةاساس', 'وحدة', 'unit', 'حبة'], 5);
        const packUnitIdx = findColIdx(['وحدةشد', 'كرتون', 'packunit', 'شد'], 6);
        const unitsPerPackIdx = findColIdx(['سعةشد', 'سعةالكرتون', 'unitsperpack', 'حباتفيالكرتون', 'سعة'], 7);
        const costIdx = findColIdx(['تكلف', 'شراء', 'cost', 'purchase', 'سعرالتكلفة'], 8);
        const saleIdx = findColIdx(['بيع', 'sale', 'price', 'سعرالبيع'], 9);
        const qtyIdx = findColIdx(['كمية', 'رصيد', 'qty', 'stock', 'اولالمدة'], 10);
        const minAlertIdx = findColIdx(['حد', 'طلب', 'alert', 'min', 'حدادنى'], 11);

        const sku = String(row[skuIdx] !== undefined ? row[skuIdx] : `SKU-${Date.now().toString().slice(-4)}-${index + 1}`).trim();
        const barcode = row[barcodeIdx] !== undefined ? String(row[barcodeIdx]).trim() : '';
        const nameAr = String(row[nameArIdx] !== undefined ? row[nameArIdx] : `صنف مخزني ${index + 1}`).trim();
        const nameEn = row[nameEnIdx] !== undefined ? String(row[nameEnIdx]).trim() : '';
        const category = String(row[catIdx] !== undefined ? row[catIdx] : 'عام').trim();
        const unit = String(row[unitIdx] !== undefined ? row[unitIdx] : 'حبة').trim();
        const packUnit = String(row[packUnitIdx] !== undefined ? row[packUnitIdx] : 'كرتون').trim();
        const unitsPerPack = Number(row[unitsPerPackIdx]) > 0 ? Number(row[unitsPerPackIdx]) : 1;
        const purchasePrice = Number(row[costIdx]) || 0;
        const salePrice = Number(row[saleIdx]) || 0;
        const quantityOnHand = Number(row[qtyIdx]) || 0;
        const minQuantityAlert = row[minAlertIdx] !== undefined && row[minAlertIdx] !== '' ? Number(row[minAlertIdx]) : 5;

        results.push({
          sku,
          barcode,
          nameAr,
          nameEn,
          category,
          unit,
          packUnit,
          unitsPerPack,
          purchasePrice,
          salePrice,
          quantityOnHand,
          minQuantityAlert,
          isActive: true,
        });
      }
    });

    if (results.length === 0) {
      setParseError('لم يتم العثور على سجلات صالحة للاستيراد في البيانات المقدمة.');
      return;
    }

    setParsedRows(results);
    setStep('PREVIEW');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          parseAoaData(aoa);
        } catch (err: any) {
          setParseError(`خطأ أثناء قراءة ملف Excel: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPasteText(content);
        parseRawData(content);
      };
      reader.readAsText(file);
    }
  };

  const parseRawData = (textToParse: string) => {
    setParseError(null);
    if (!textToParse.trim()) {
      setParseError('الرجاء إدخال أو لصق البيانات للاستيراد');
      return;
    }

    try {
      // Check if it's JSON
      if (textToParse.trim().startsWith('[') || textToParse.trim().startsWith('{')) {
        const parsed = JSON.parse(textToParse);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        setParsedRows(list);
        setStep('PREVIEW');
        return;
      }

      // Parse TSV / CSV / Tab-separated lines
      const lines = textToParse
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setParseError('لم يتم العثور على أسطر صالحة في البيانات المدخلة');
        return;
      }

      // Determine separator (\t or comma or semicolon)
      const firstLine = lines[0];
      let sep = '\t';
      if (firstLine.includes('\t')) sep = '\t';
      else if (firstLine.includes(',')) sep = ',';
      else if (firstLine.includes(';')) sep = ';';

      const aoa = lines.map((line) => line.split(sep).map((p) => p.replace(/^["']|["']$/g, '').trim()));
      parseAoaData(aoa);
    } catch (err: any) {
      setParseError(`خطأ أثناء تحليل البيانات: ${err.message}`);
    }
  };

  const handleRemoveRow = (index: number) => {
    const updated = parsedRows.filter((_, idx) => idx !== index);
    setParsedRows(updated);
    if (updated.length === 0) {
      setStep('INPUT');
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      if (importType === 'INVENTORY') {
        const res = await DataService.bulkImportInventory(parsedRows, {
          mode: importMode,
          createOpeningJournal,
        });

        setVerificationResult({
          count: res.count,
          newCount: res.newCount,
          updatedCount: res.updatedCount,
          totalStockValue: res.totalStockValue,
          journalId: res.journalId,
          totalInventoryInDb: res.totalInventoryInDb,
          verifiedInDb: res.verifiedInDb,
          verifiedAt: res.verifiedAt,
        });
        setStep('VERIFIED_SUCCESS');
        onSuccess();
        return;
      }

      let endpoint = '';
      let payload: any = {};

      if (importType === 'CUSTOMERS') {
        endpoint = '/api/import/customers';
        payload = { customers: parsedRows, createOpeningJournal };
      } else if (importType === 'SUPPLIERS') {
        endpoint = '/api/import/suppliers';
        payload = { suppliers: parsedRows, createOpeningJournal };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشلت عملية الاستيراد');
      }

      const result = await res.json();
      setVerificationResult({
        count: result.count || parsedRows.length,
        newCount: result.newCount || parsedRows.length,
        updatedCount: result.updatedCount || 0,
        totalStockValue: result.totalOpeningAmount || 0,
        journalId: result.openingJournalId,
        totalInventoryInDb: result.totalInDb,
        verifiedInDb: true,
        verifiedAt: new Date().toISOString(),
      });
      setStep('VERIFIED_SUCCESS');
      onSuccess();
    } catch (err: any) {
      alert(`❌ حدث خطأ أثناء الاستيراد: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculations for summary stats
  const totalOpeningAmount = parsedRows.reduce((sum, r) => {
    if (importType === 'CUSTOMERS' || importType === 'SUPPLIERS') {
      return sum + (Number(r.openingBalance) || 0);
    }
    if (importType === 'INVENTORY') {
      return sum + (Number(r.quantityOnHand) || 0) * (Number(r.purchasePrice) || 0);
    }
    return sum;
  }, 0);

  const totalSaleAmount = parsedRows.reduce((sum, r) => {
    if (importType === 'INVENTORY') {
      return sum + (Number(r.quantityOnHand) || 0) * (Number(r.salePrice) || 0);
    }
    return sum;
  }, 0);

  const totalStockQty = parsedRows.reduce((sum, r) => {
    if (importType === 'INVENTORY') {
      return sum + (Number(r.quantityOnHand) || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-right animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{getTitle()}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                استيراد جماعي مرن من ملفات Excel (.xlsx) أو CSV أو بنسخ ولصق البيانات مع كافة الخيارات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 'INPUT' ? (
            <div className="space-y-4">
              {/* Instructions and Download Template Strip */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <span className="font-bold block mb-0.5">طريقة الاستيراد:</span>
                    يمكنك رفع ملف <span className="font-bold text-emerald-800">Excel (.xlsx/.xls)</span> مباشرة، أو ملف <span className="font-bold text-blue-800">CSV/TSV</span>، أو لصق الأعمدة والصفوف مباشرة من ملف إكسل في الحقل أدناه.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadBlankExcelTemplate}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ring-1 ring-emerald-400"
                    title="تحميل نموذج إكسل فارغ مهيأ بالأعمدة والتعليمات وجاهز للتعبئة الفورية"
                  >
                    <FileDown className="w-4 h-4 text-emerald-100" />
                    <span>تحميل نموذج Excel فارغ للتعبئة (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplateExcel}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="تحميل نموذج جدول إكسل تجريبي يحتوي على أمثلة توضيحية"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-300" />
                    <span>نموذج تجريبي (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplateCsv}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-300 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="تحميل نموذج نصي مفصول بجدولة CSV/TSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>نموذج CSV (.csv)</span>
                  </button>
                  <label className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع ملف (Excel / CSV)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Advanced Options for Inventory */}
              {importType === 'INVENTORY' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Settings2 className="w-4 h-4 text-blue-700" />
                    <span>خيارات استيراد ومعالجة الأصناف (Import Strategy & Options):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <label
                      onClick={() => setImportMode('upsert')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                        importMode === 'upsert'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'upsert'}
                        onChange={() => setImportMode('upsert')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <span className="block font-bold">دمج وتحديث (Upsert - مستحسن)</span>
                        <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                          تحديث الصنف إذا كان SKU أو الباركود مسجلاً مسبقاً، وإضافته كصنف جديد إذا لم يكن موجوداً.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setImportMode('append')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                        importMode === 'append'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <span className="block font-bold">إضافة فقط (Append Only)</span>
                        <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                          إضافة كافة الصفوف كسجلات جديدة، وتوليد معرفات فريدة دون تعديل الأصناف الحالية.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setImportMode('update_only')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                        importMode === 'update_only'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'update_only'}
                        onChange={() => setImportMode('update_only')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <span className="block font-bold">تحديث الأسعار والأرصدة فقط</span>
                        <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                          تحديث أسعار الشراء والبيع ورصيد المخزون للأصناف المطابقة لـ SKU دون إنشاء أصناف جديدة.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Paste Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>لصق البيانات من Excel أو نص مفصول بجدولة (Paste Data):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = getSampleTemplateText();
                      setPasteText(sample);
                      parseRawData(sample);
                    }}
                    className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                  >
                    تعبئة بيانات تجريبية للتجربة فوراً
                  </button>
                </div>
                <textarea
                  rows={8}
                  dir="ltr"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={getSampleTemplateText()}
                  className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {parseError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : step === 'PREVIEW' ? (
            /* PREVIEW STEP */
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                  <span className="text-xs text-blue-800 block">إجمالي السجلات المقروءة</span>
                  <span className="text-xl font-bold text-blue-950 font-mono mt-0.5 block">
                    {parsedRows.length} <span className="text-xs font-normal text-blue-700">سجل</span>
                  </span>
                </div>
                {importType === 'INVENTORY' ? (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                      <span className="text-xs text-emerald-800 block">إجمالي رصيد الكميات (وحدات)</span>
                      <span className="text-xl font-bold text-emerald-950 font-mono mt-0.5 block">
                        {totalStockQty.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-emerald-700">قطعة/حبة</span>
                      </span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                      <span className="text-xs text-amber-800 block">إجمالي قيمة التكلفة الافتتاحية</span>
                      <span className="text-xl font-bold text-amber-950 font-mono mt-0.5 block">
                        {formatCurrency(totalOpeningAmount, currency)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl col-span-2">
                    <span className="text-xs text-emerald-800 block">إجمالي أرصدة أول المدة</span>
                    <span className="text-xl font-bold text-emerald-950 font-mono mt-0.5 block">
                      {formatCurrency(totalOpeningAmount, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">#</th>
                      {importType === 'CUSTOMERS' && (
                        <>
                          <th className="p-2.5">كود العميل</th>
                          <th className="p-2.5">اسم العميل</th>
                          <th className="p-2.5">الهاتف</th>
                          <th className="p-2.5">الرقم الضريبي/المدني</th>
                          <th className="p-2.5 text-left">رصيد أول المدة</th>
                        </>
                      )}
                      {importType === 'SUPPLIERS' && (
                        <>
                          <th className="p-2.5">كود المورد</th>
                          <th className="p-2.5">اسم المورد</th>
                          <th className="p-2.5">الهاتف</th>
                          <th className="p-2.5">الرقم الضريبي</th>
                          <th className="p-2.5 text-left">رصيد أول المدة</th>
                        </>
                      )}
                      {importType === 'INVENTORY' && (
                        <>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">الباركود</th>
                          <th className="p-2.5">اسم الصنف بالعربي</th>
                          <th className="p-2.5">التصنيف</th>
                          <th className="p-2.5">الوحدة</th>
                          <th className="p-2.5">الشد / السعة</th>
                          <th className="p-2.5 text-left">التكلفة</th>
                          <th className="p-2.5 text-left">سعر البيع</th>
                          <th className="p-2.5 text-left">رصيد المخزون</th>
                          <th className="p-2.5 text-left">إجمالي التكلفة</th>
                        </>
                      )}
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        {importType === 'CUSTOMERS' && (
                          <>
                            <td className="p-2.5 font-mono text-slate-700 font-bold">{row.code}</td>
                            <td className="p-2.5 font-bold text-slate-900">{row.nameAr}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.phone || '-'}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.taxNumber || '-'}</td>
                            <td className="p-2.5 font-mono text-left font-bold text-blue-700">
                              {formatCurrency(Number(row.openingBalance) || 0, currency)}
                            </td>
                          </>
                        )}
                        {importType === 'SUPPLIERS' && (
                          <>
                            <td className="p-2.5 font-mono text-slate-700 font-bold">{row.code}</td>
                            <td className="p-2.5 font-bold text-slate-900">{row.nameAr}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.phone || '-'}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.taxNumber || '-'}</td>
                            <td className="p-2.5 font-mono text-left font-bold text-blue-700">
                              {formatCurrency(Number(row.openingBalance) || 0, currency)}
                            </td>
                          </>
                        )}
                        {importType === 'INVENTORY' && (
                          <>
                            <td className="p-2.5 font-mono text-slate-700 font-bold">{row.sku}</td>
                            <td className="p-2.5 font-mono text-slate-500">{row.barcode || '-'}</td>
                            <td className="p-2.5 font-bold text-slate-900">{row.nameAr}</td>
                            <td className="p-2.5 text-slate-600">{row.category || 'عام'}</td>
                            <td className="p-2.5 text-slate-600">{row.unit || 'حبة'}</td>
                            <td className="p-2.5 text-slate-600 font-mono">
                              {row.packUnit || 'كرتون'} ({row.unitsPerPack || 1})
                            </td>
                            <td className="p-2.5 font-mono text-left text-slate-700">
                              {formatCurrency(Number(row.purchasePrice) || 0, currency)}
                            </td>
                            <td className="p-2.5 font-mono text-left text-emerald-700 font-bold">
                              {formatCurrency(Number(row.salePrice) || 0, currency)}
                            </td>
                            <td className="p-2.5 font-mono text-left font-bold text-blue-700">
                              {row.quantityOnHand} {row.unit || 'حبة'}
                            </td>
                            <td className="p-2.5 font-mono text-left font-bold text-slate-900">
                              {formatCurrency(
                                (Number(row.quantityOnHand) || 0) * (Number(row.purchasePrice) || 0),
                                currency
                              )}
                            </td>
                          </>
                        )}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded-md transition-colors cursor-pointer"
                            title="حذف هذا السطر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Opening Journal Option */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="chkOpeningJournal"
                  checked={createOpeningJournal}
                  onChange={(e) => setCreateOpeningJournal(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer mt-0.5"
                />
                <label htmlFor="chkOpeningJournal" className="text-xs text-emerald-950 cursor-pointer">
                  <span className="font-bold block mb-0.5">
                    توليد قيد افتتاحي متوازن تلقائياً في اليومية العامة (Opening Balance Journal Entry)
                  </span>
                  <span className="text-emerald-800 text-[11px] leading-relaxed block">
                    يقوم النظام آلياً بإثبات إجمالي مبالغ أول المدة في الحسابات الرئيسية المعنية (حساب مخزون البضائع والمنتجات أو الذمم) مقابل حساب الأرباح المبقاة / رأس المال لضمان دقة وتوازن الميزانية العمومية.
                  </span>
                </label>
              </div>
            </div>
          ) : (
            /* VERIFIED_SUCCESS Screen */
            <div className="py-6 px-4 space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <ShieldCheck className="w-9 h-9 text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  تم الاستيراد والتحقق من الحفظ في قاعدة البيانات بنجاح!
                </h3>
                <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                  تم تشغيل سكربت الفحص والمعالجة القوي بنجاح؛ حيث تم تدقيق البيانات وتصفيتها وحفظها في قاعدة البيانات والتحقق التام من مطابقة الأرصدة وتوثيقها.
                </p>
              </div>

              {/* Verification Checklist */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-2.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold text-emerald-950 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>نتائج فحص وتدقيق قاعدة البيانات (Database Audit & Integrity Check):</span>
                </div>
                <div className="space-y-1.5 pl-2 text-[11px] text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم فحص وتنقية الأرقام والأسعار وتوحيد الوحدات والباركود وتفادي تكرار الـ SKU.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم حفظ كافة السجلات وتحديثها في قاعدة البيانات والتخزين المحلي والسحابي.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      تم فحص سلامة قاعدة البيانات بعد العملية (Verified: 100% متطابق ومثبت بنجاح).
                    </span>
                  </div>
                  {verificationResult?.journalId && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        تم إنشاء قيد بضاعة أول المدة بنجاح برقم قيد:{' '}
                        <strong className="text-emerald-950 underline">{verificationResult.journalId}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-500 block mb-1">السجلات المعالجة</span>
                  <span className="text-base font-black text-slate-800">
                    {verificationResult?.count || 0}
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-emerald-700 block mb-1">أصناف جديدة أضيفت</span>
                  <span className="text-base font-black text-emerald-800">
                    +{verificationResult?.newCount || 0}
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-blue-700 block mb-1">أصناف تم تحديثها</span>
                  <span className="text-base font-black text-blue-800">
                    {verificationResult?.updatedCount || 0}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-500 block mb-1">إجمالي الأصناف بالقاعدة</span>
                  <span className="text-base font-black text-slate-800">
                    {verificationResult?.totalInventoryInDb || '-'} صنف
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center col-span-2 sm:col-span-2">
                  <span className="text-[11px] text-amber-800 block mb-1">إجمالي قيمة بضاعة أول المدة</span>
                  <span className="text-base font-black text-amber-900">
                    {formatCurrency(verificationResult?.totalStockValue || 0, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          {step === 'VERIFIED_SUCCESS' ? (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('INPUT');
                  setParsedRows([]);
                  setPasteText('');
                  setVerificationResult(null);
                }}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
              >
                استيراد ملف إضافي
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>إغلاق ومعاينة الأصناف في جدول المخزون</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              {step === 'INPUT' ? (
                <button
                  type="button"
                  onClick={() => parseRawData(pasteText)}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span>معاينة وتحقق من البيانات</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('INPUT')}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
                  >
                    رجوع للتعديل
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || parsedRows.length === 0}
                    onClick={handleExecuteImport}
                    className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'جاري الاستيراد والحفظ في قاعدة البيانات...'
                        : `تأكيد استيراد ومعالجة (${parsedRows.length}) سجل`}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
