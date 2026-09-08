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
  Database
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters.ts';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'INPUT' | 'PREVIEW'>('INPUT');

  if (!isOpen) return null;

  const getTitle = () => {
    switch (importType) {
      case 'CUSTOMERS':
        return 'استيراد دليل العملاء مع أرصدة أول المدة';
      case 'SUPPLIERS':
        return 'استيراد دليل الموردين مع أرصدة أول المدة';
      case 'INVENTORY':
        return 'استيراد بطاقات الأصناف والمخزون مع التكلفة وأسعار البيع ورصيد أول المدة';
    }
  };

  const getSampleTemplate = () => {
    switch (importType) {
      case 'CUSTOMERS':
        return `كود العميل\tاسم العميل بالعربي\tالهاتف\tالرقم الضريبي/المدني\tرصيد أول المدة\nC-101\tشركة النور للتجارة\t96599887766\t123456789\t1500.000\nC-102\tجمعية الروضة التعاونية\t96599112233\t987654321\t3250.500\nC-103\tمؤسسة الفهد للمقاولات\t96566554433\t456123789\t850.000`;
      case 'SUPPLIERS':
        return `كود المورد\tاسم المورد بالعربي\tالهاتف\tالرقم الضريبي\tرصيد أول المدة\nS-201\tشركة الألبان الكويتية الدنماركية (KDD)\t96522334455\t112233445\t4500.000\nS-202\tشركة المطاحن والدقيق الكويتية\t96522446688\t556677889\t6200.000\nS-203\tمؤسسة الخليج للتوريدات\t96599775533\t998877665\t1800.000`;
      case 'INVENTORY':
        return `كود الصنف SKU\tاسم الصنف بالعربي\tالتصنيف\tالوحدة\tسعر التكلفة (الشراء)\tسعر البيع\tكمية أول المدة\tحد إعادة الطلب\nSKU-1001\tطحين فاخر كويتي 10 كجم\tالمواد الغذائية\tكيس\t3.250\t4.500\t120\t20\nSKU-1002\tزيت ذرة نقي 5 لتر\tالزيوت\tحبة\t2.100\t2.950\t85\t15\nSKU-1003\tأرز بسمتي درجة أولى 20 كجم\tالحبوب\tكيس\t6.800\t8.750\t50\t10\nSKU-1004\tسكر ناعم 5 كجم\tالمواد الغذائية\tكيس\t1.400\t1.900\t200\t30`;
    }
  };

  const handleDownloadTemplate = () => {
    const templateContent = getSampleTemplate();
    const blob = new Blob(['\uFEFF' + templateContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${importType.toLowerCase()}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPasteText(content);
      parseRawData(content);
    };
    reader.readAsText(file);
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

      // Check if first line is a header
      let dataLines = lines;
      const lowerHeader = firstLine.toLowerCase();
      if (
        lowerHeader.includes('كود') ||
        lowerHeader.includes('اسم') ||
        lowerHeader.includes('sku') ||
        lowerHeader.includes('code') ||
        lowerHeader.includes('name') ||
        lowerHeader.includes('رصيد')
      ) {
        dataLines = lines.slice(1);
      }

      const results: any[] = [];

      dataLines.forEach((line, index) => {
        const parts = line.split(sep).map((p) => p.replace(/^["']|["']$/g, '').trim());
        if (parts.length === 0 || parts.every((p) => p === '')) return;

        if (importType === 'CUSTOMERS') {
          results.push({
            code: parts[0] || `C-${index + 1}`,
            nameAr: parts[1] || `عميل ${index + 1}`,
            phone: parts[2] || '',
            taxNumber: parts[3] || '',
            openingBalance: Number(parts[4]) || 0,
          });
        } else if (importType === 'SUPPLIERS') {
          results.push({
            code: parts[0] || `S-${index + 1}`,
            nameAr: parts[1] || `مورد ${index + 1}`,
            phone: parts[2] || '',
            taxNumber: parts[3] || '',
            openingBalance: Number(parts[4]) || 0,
          });
        } else if (importType === 'INVENTORY') {
          results.push({
            sku: parts[0] || `SKU-${Date.now().toString().slice(-4)}-${index + 1}`,
            nameAr: parts[1] || `صنف ${index + 1}`,
            category: parts[2] || 'عام',
            unit: parts[3] || 'حبة',
            purchasePrice: Number(parts[4]) || 0,
            salePrice: Number(parts[5]) || 0,
            quantityOnHand: Number(parts[6]) || 0,
            minQuantityAlert: Number(parts[7]) || 5,
          });
        }
      });

      if (results.length === 0) {
        setParseError('لم نتمكن من قراءة الأعمدة بشكل صحيح، تأكد من مطابقة التنسيق.');
        return;
      }

      setParsedRows(results);
      setStep('PREVIEW');
    } catch (err: any) {
      setParseError(`خطأ أثناء تحليل البيانات: ${err.message}`);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      let endpoint = '';
      let payload: any = {};

      if (importType === 'CUSTOMERS') {
        endpoint = '/api/import/customers';
        payload = { customers: parsedRows, createOpeningJournal };
      } else if (importType === 'SUPPLIERS') {
        endpoint = '/api/import/suppliers';
        payload = { suppliers: parsedRows, createOpeningJournal };
      } else if (importType === 'INVENTORY') {
        endpoint = '/api/import/inventory';
        payload = { items: parsedRows, createOpeningJournal };
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
      alert(`✅ ${result.message || 'تمت عملية الاستيراد بنجاح'}`);
      onSuccess();
      onClose();
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
      return sum + ((Number(r.quantityOnHand) || 0) * (Number(r.purchasePrice) || 0));
    }
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{getTitle()}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                استيراد جماعي مباشر من ملفات Excel أو جداول البيانات مع إثبات أرصدة أول المدة
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
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <span className="font-bold block mb-0.5">طريقة الاستيراد السريع:</span>
                    انسخ الأعمدة والصفوف مباشرة من ملف Excel أو جداول البيانات الإلكترونية والصقها في المربع أدناه، أو قم برفع ملف CSV / TSV.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-300 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل نموذج فارغ (Template)</span>
                  </button>
                  <label className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع ملف (CSV/TSV)</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Paste Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>لصق البيانات من Excel أو نص مفصول بجدولة (Paste Data):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPasteText(getSampleTemplate())}
                    className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                  >
                    تعبئة بيانات تجريبية للتجربة
                  </button>
                </div>
                <textarea
                  rows={9}
                  dir="ltr"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={getSampleTemplate()}
                  className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {parseError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW STEP */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900">
                    عدد السجلات الجاهزة للاستيراد: <span className="text-blue-700 font-extrabold text-sm">{parsedRows.length}</span>
                  </span>
                  <span className="text-slate-600">
                    إجمالي أرصدة وقيم البداية:{' '}
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      {formatCurrency(totalOpeningAmount, currency)}
                    </span>
                  </span>
                </div>
                <button
                  onClick={() => setStep('INPUT')}
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>تعديل البيانات المدخلة</span>
                </button>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
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
                          <th className="p-2.5">اسم الصنف</th>
                          <th className="p-2.5">التصنيف</th>
                          <th className="p-2.5">الوحدة</th>
                          <th className="p-2.5 text-left">سعر التكلفة</th>
                          <th className="p-2.5 text-left">سعر البيع</th>
                          <th className="p-2.5 text-left">رصيد أول المدة</th>
                          <th className="p-2.5 text-left">إجمالي القيمة</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
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
                            <td className="p-2.5 font-bold text-slate-900">{row.nameAr}</td>
                            <td className="p-2.5 text-slate-600">{row.category || 'عام'}</td>
                            <td className="p-2.5 text-slate-600">{row.unit || 'حبة'}</td>
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
                              {formatCurrency((Number(row.quantityOnHand) || 0) * (Number(row.purchasePrice) || 0), currency)}
                            </td>
                          </>
                        )}
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
                    يقوم النظام آلياً بإثبات إجمالي مبالغ أول المدة في الحسابات الرئيسية المعنية (الذمم المدينة / الدائنة / المخزون) مقابل حساب الأرباح المبقاة / رأس المال لضمان دقة وتوازن الميزانية العمومية من اللحظة الأولى.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
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
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <span>معاينة وتحقق من البيانات</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isProcessing || parsedRows.length === 0}
              onClick={handleExecuteImport}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'جاري الاستيراد والحفظ...' : `تأكيد استيراد (${parsedRows.length}) سجل`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
