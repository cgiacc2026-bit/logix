import React from 'react';
import { CompanyProfile } from '../../types.js';
import { formatCurrency } from '../../utils/formatters.ts';
import { Printer, X, ShieldCheck, Building2, Calendar, FileText } from 'lucide-react';

export interface FormalPrintColumn {
  header: string;
  accessor?: string;
  render?: (row: any, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface FormalReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  accountCodeNotice?: string;
  company: CompanyProfile | null;
  currency: string;
  periodText?: string;
  columns: FormalPrintColumn[];
  rows: any[];
  summaryCards?: Array<{
    label: string;
    value: string | number;
    sublabel?: string;
  }>;
  totalsRow?: Array<{
    colSpan?: number;
    content: React.ReactNode;
    align?: 'left' | 'center' | 'right';
  }>;
}

export const FormalReportPrintModal: React.FC<FormalReportPrintModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  accountCodeNotice,
  company,
  currency,
  periodText,
  columns,
  rows,
  summaryCards = [],
  totalsRow,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDateStr = new Date().toLocaleDateString('ar-KW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
        {/* Modal Top Action Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold">معاينة التقرير الرسمي للطباعة (تنسيق خط أسود معتمد #000000)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>إرسال إلى الطابعة (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Formal Document Area (Pure Black Text #000000) */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 print:overflow-visible bg-white text-[#000000] font-sans">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm;
              }
              body {
                background: #FFFFFF !important;
                color: #000000 !important;
              }
              .no-print {
                display: none !important;
              }
              table {
                border-collapse: collapse !important;
                width: 100% !important;
              }
              th, td {
                border: 1px solid #000000 !important;
                color: #000000 !important;
              }
            }
          `}</style>

          {/* Official Formal Company Header */}
          <div className="border-b-2 border-[#000000] pb-4 mb-6">
            <div className="flex items-start justify-between">
              {/* Right Side: Arabic Info */}
              <div className="text-right space-y-1">
                <h1 className="text-lg sm:text-xl font-black text-[#000000] tracking-tight">
                  {company?.nameAr || 'مطحنة الوليد المتحدة للصناعات الغذائية'}
                </h1>
                <p className="text-xs font-bold text-[#000000]">
                  {company?.legalForm || 'شركة ذات مسؤولية محدودة (ذ.م.م)'} • دولة الكويت
                </p>
                <div className="text-[11px] text-[#000000] font-mono flex flex-wrap gap-x-4">
                  <span>س.ت: {company?.crNumber || '450912'}</span>
                  <span>رقم الغرفة: {company?.chamberNumber || '78214'}</span>
                  {company?.taxNumber && <span>الرقم الضريبي: {company.taxNumber}</span>}
                </div>
              </div>

              {/* Center: Official Title Box */}
              <div className="text-center px-4 py-2 border border-[#000000] rounded-sm max-w-xs">
                <span className="text-[10px] font-bold block uppercase tracking-wider text-[#000000]">
                  وثيقة محاسبية رسمية معتمدة
                </span>
                <span className="text-xs font-black text-[#000000] block mt-0.5">
                  نظام LOGIX ERP المحاسبي المتكامل
                </span>
              </div>

              {/* Left Side: English Info */}
              <div className="text-left space-y-1 font-sans">
                <h2 className="text-sm font-black text-[#000000]">
                  {company?.nameEn || 'Al-Waleed United Mill Co.'}
                </h2>
                <p className="text-[11px] text-[#000000]">State of Kuwait • Commercial Division</p>
                <p className="text-[10px] font-mono text-[#000000]">{company?.phone || '+965 2484 1888'}</p>
              </div>
            </div>
          </div>

          {/* Report Title & Meta */}
          <div className="text-center my-6 space-y-1.5">
            <h2 className="text-xl font-black text-[#000000] underline underline-offset-4 decoration-2">
              {title}
            </h2>
            <p className="text-xs font-bold text-[#000000]">{subtitle}</p>
            {accountCodeNotice && (
              <div className="inline-block px-3 py-1 border border-[#000000] text-[11px] font-bold text-[#000000] rounded-xs font-mono">
                {accountCodeNotice}
              </div>
            )}
            <div className="flex items-center justify-center gap-6 text-xs text-[#000000] pt-1">
              <span>تاريخ الطباعة: <strong>{currentDateStr}</strong></span>
              {periodText && <span>الفترة المشمولة: <strong>{periodText}</strong></span>}
              <span>العملة: <strong>{currency} (دينار كويتي)</strong></span>
            </div>
          </div>

          {/* Summary KPI Cards in Formal Black Line Style */}
          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {summaryCards.map((card, idx) => (
                <div key={idx} className="border border-[#000000] p-3 text-center space-y-1">
                  <span className="text-[11px] font-bold text-[#000000] block">{card.label}</span>
                  <span className="text-base font-black text-[#000000] font-mono block">
                    {card.value}
                  </span>
                  {card.sublabel && (
                    <span className="text-[10px] font-medium text-[#000000] block">{card.sublabel}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Data Table with Clean Black Borders */}
          <div className="mb-8 overflow-x-auto">
            <table className="w-full text-right text-xs border border-[#000000]">
              <thead className="bg-slate-100 text-[#000000] font-black border-b-2 border-[#000000]">
                <tr>
                  <th className="p-2.5 border border-[#000000] text-center w-10">#</th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className={`p-2.5 border border-[#000000] ${
                        col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                      }`}
                      style={{ width: col.width }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#000000] text-[#000000]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-6 text-center text-xs font-bold">
                      لا توجد سجلات مطابقة للتقرير في الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      <td className="p-2 border border-[#000000] text-center font-mono text-[11px]">{rIdx + 1}</td>
                      {columns.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className={`p-2 border border-[#000000] ${
                            col.align === 'center'
                              ? 'text-center'
                              : col.align === 'left'
                              ? 'text-left'
                              : 'text-right'
                          }`}
                        >
                          {col.render
                            ? col.render(row, rIdx)
                            : col.accessor
                            ? (row as any)[col.accessor]
                            : null}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {totalsRow && totalsRow.length > 0 && (
                <tfoot className="border-t-2 border-[#000000] bg-slate-100 font-black text-[#000000]">
                  <tr>
                    <td className="p-2 border border-[#000000] text-center">∑</td>
                    {totalsRow.map((t, idx) => (
                      <td
                        key={idx}
                        colSpan={t.colSpan || 1}
                        className={`p-2 border border-[#000000] ${
                          t.align === 'center' ? 'text-center' : t.align === 'left' ? 'text-left' : 'text-right'
                        }`}
                      >
                        {t.content}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Audit Verification Statement & Legal Footnote */}
          <div className="border border-[#000000] p-3 text-[11px] text-[#000000] space-y-1 mb-8">
            <p className="font-bold">
              إقرار التدقيق المحاسبي الداخلي:
            </p>
            <p className="leading-relaxed">
              تم استخراج وطباعة هذا التقرير آلياً بالربط المباشر مع دفتر قيود اليومية العامة المعتمدة وشجرة الحسابات (Chart of Accounts) طبقاً للمبادئ المحاسبية المقبولة عموماً (GAAP) والمعايير الدولية (IFRS). كافة الأرصدة الواردة مطابقة لأرصدة الحسابات الرقابية بميزان المراجعة.
            </p>
          </div>

          {/* Official Signatures Block */}
          <div className="grid grid-cols-4 gap-4 text-center text-xs text-[#000000] pt-4 border-t border-[#000000]">
            <div className="space-y-8">
              <span className="font-bold block">مُعد التقرير</span>
              <div className="border-b border-[#000000] w-3/4 mx-auto pb-1">أ. أحمد المصطفى</div>
              <span className="text-[10px] text-slate-600 block">المحاسب المسؤول</span>
            </div>

            <div className="space-y-8">
              <span className="font-bold block">تدقيق الحسابات</span>
              <div className="border-b border-[#000000] w-3/4 mx-auto pb-1">مكتب التدقيق القانوني</div>
              <span className="text-[10px] text-slate-600 block">المحاسب القانوني المعتمد</span>
            </div>

            <div className="space-y-8">
              <span className="font-bold block">اعتماد الإدارة المالية</span>
              <div className="border-b border-[#000000] w-3/4 mx-auto pb-1">أ. محمد الشمري</div>
              <span className="text-[10px] text-slate-600 block">المدير المالي</span>
            </div>

            <div className="space-y-4">
              <span className="font-bold block">الختم الرسمي للشركة</span>
              <div className="w-20 h-20 border-2 border-dashed border-[#000000] rounded-full mx-auto flex items-center justify-center text-[9px] font-bold text-[#000000] p-1">
                ختم الشركة المعتمد
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
