import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Quotation, CompanyProfile } from '../types.js';
import {
  Printer,
  X,
  CheckCircle2,
  FileText,
  User,
  Calendar,
  Building2,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';

interface QuotationPrintTemplateProps {
  quotation: Quotation;
  company: CompanyProfile | null;
  onClose?: () => void;
}

export const QuotationPrintTemplate: React.FC<QuotationPrintTemplateProps> = ({
  quotation,
  company,
  onClose,
}) => {
  const activeCompany = resolveActiveCompany(
    company,
    quotation.companyId || (quotation as any)?.company_id
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const effectiveCurrency = activeCompany.functionalCurrency || 'KWD';
  const formatted = (val: number) => formatCurrency(val, effectiveCurrency);

  useEffect(() => {
    const qrPayload = [
      `المنشأة: ${activeCompany.nameAr || activeCompany.headerTitle || 'الشركة المعتمدة'}`,
      `س.ت: ${activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}`,
      `عرض سعر رسمي: ${quotation.quotationNumber}`,
      `التاريخ: ${quotation.date}`,
      `العميل: ${quotation.customerNameAr}`,
      `الإجمالي العام: ${formatted(quotation.grandTotal)}`,
    ].join('\n');

    QRCode.toDataURL(qrPayload, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Error creating quotation QR', err));
  }, [quotation, activeCompany]);

  const handlePrint = () => {
    window.print();
  };

  const lineSubtotalsSum = (quotation.lines || []).reduce(
    (acc, line) => acc + (line.quantity * line.unitPrice),
    0
  );
  const discountsTotal = quotation.discountTotal || 0;
  const grandTotal = quotation.grandTotal || (lineSubtotalsSum - discountsTotal + (quotation.vatTotal || 0));

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Wrapper Box */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col text-slate-900 my-auto">
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="text-xs sm:text-sm font-black">
              معاينة وطباعة عرض الأسعار الرسمي
            </span>
            <span className="font-mono text-xs text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              {quotation.quotationNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                className="p-1 hover:bg-slate-700 rounded text-slate-300"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-300">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1 hover:bg-slate-700 rounded text-slate-300"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 ml-1 border-r border-slate-700"
                title="إعادة ضبط"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مستند عرض السعر</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[85vh] bg-slate-200 flex justify-center print:p-0 print:m-0 print:bg-white print:max-h-none">
          {/* Printable A4 Sheet */}
          <div
            id="printable-quotation-sheet"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top center',
            }}
            className="w-full max-w-[820px] bg-white p-8 sm:p-10 shadow-2xl rounded-xl border border-slate-300 text-slate-900 font-sans print:shadow-none print:border-none print:w-full print:max-w-none print:p-6 space-y-6"
          >
            {/* 1. Header with Active Company Info */}
            <div className="flex items-start justify-between border-b-2 border-black pb-5 gap-4">
              <div className="flex items-start gap-4 text-right max-w-md">
                {activeCompany.logoUrl && (
                  <img
                    src={activeCompany.logoUrl}
                    alt="Logo"
                    className="w-20 h-20 object-contain rounded-lg border border-slate-200 p-1 bg-white shrink-0"
                  />
                )}
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                    {activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}
                  </h1>
                  <p className="text-xs text-slate-600 font-bold uppercase tracking-wider font-mono">
                    {activeCompany.nameEn || activeCompany.tradeName || 'COMMERCIAL ENTERPRISE'}
                  </p>

                  <div className="text-xs text-slate-700 space-y-0.5 pt-1 font-medium leading-tight">
                    <p>
                      السجل التجاري: <span className="font-bold font-mono text-black">{activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}</span>
                      {activeCompany.taxNumber && (
                        <span className="mr-3">الرقم الضريبي: <span className="font-bold font-mono text-black">{activeCompany.taxNumber}</span></span>
                      )}
                    </p>
                    <p>
                      {[activeCompany.streetName, activeCompany.district, activeCompany.city, activeCompany.country].filter(Boolean).join('، ') || 'المقر الرئيسي'}
                    </p>
                    {activeCompany.phone && (
                      <p className="font-mono">هاتف: {activeCompany.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Title & Document Badge */}
              <div className="text-left font-mono space-y-1.5 shrink-0">
                <div className="inline-block bg-slate-950 text-white font-black text-xs px-3 py-1 rounded shadow-sm">
                  OFFICIAL PRICE QUOTATION
                </div>
                <div className="text-xl font-black text-slate-950">
                  عرض أسعار معتمد
                </div>
                <div className="text-xs font-bold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 inline-block">
                  رقم: {quotation.quotationNumber}
                </div>
                {qrCodeDataUrl && (
                  <div className="pt-1 flex justify-end">
                    <img src={qrCodeDataUrl} alt="QR" className="w-16 h-16 border border-slate-300 p-0.5 rounded" />
                  </div>
                )}
              </div>
            </div>

            {/* 2. Customer & Quotation Meta Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs">
              <div className="space-y-1.5">
                <div className="text-slate-500 font-bold text-[11px]">بيانات العميل الموجه إليه العرض:</div>
                <div className="text-sm font-black text-slate-950">{quotation.customerNameAr}</div>
                {quotation.salesRepName && (
                  <div className="text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>المندوب المسؤول: <strong>{quotation.salesRepName}</strong></span>
                  </div>
                )}
              </div>

              <div className="space-y-1 sm:text-left font-mono text-slate-800">
                <div>
                  <span className="text-slate-500 font-sans">تاريخ تحرير العرض: </span>
                  <strong className="text-slate-950">{quotation.date}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">صلاحية العرض حتى: </span>
                  <strong className="text-rose-700">{quotation.expiryDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">حالة الاعتماد: </span>
                  <strong className="text-emerald-700">
                    {quotation.status === 'CONVERTED_INVOICE'
                      ? 'تم التحويل لفاتورة مبيعات معتمدة'
                      : quotation.status === 'CONVERTED_PRODUCTION'
                      ? 'تم التحويل لأمر تصنيع وتوريد'
                      : 'عرض سعر نشط وقابل للتعميد'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. Items Table */}
            <div className="border border-black rounded-lg overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold border-b border-black">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">الصنف والمواصفات</th>
                    <th className="p-2.5 text-center w-20">الوحدة</th>
                    <th className="p-2.5 text-center w-20">الكمية</th>
                    <th className="p-2.5 text-center w-28">سعر الوحدة</th>
                    <th className="p-2.5 text-center w-28">الإجمالي الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.lines.map((line, idx) => {
                    const lineTotal = line.total || (line.quantity * line.unitPrice);
                    return (
                      <tr key={line.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-bold text-slate-950">{line.itemNameAr}</div>
                          {line.itemSku && (
                            <div className="text-[10px] text-slate-500 font-mono">كود: {line.itemSku}</div>
                          )}
                          {line.notes && (
                            <div className="text-[10px] text-slate-600 italic">{line.notes}</div>
                          )}
                        </td>
                        <td className="p-2 text-center text-slate-700">{line.unit || 'حبة'}</td>
                        <td className="p-2 text-center font-mono font-bold text-slate-950">{line.quantity}</td>
                        <td className="p-2 text-center font-mono text-slate-900">{formatted(line.unitPrice)}</td>
                        <td className="p-2 text-center font-mono font-black text-slate-950">
                          {formatted(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 4. Totals & Tafqeet */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
              {/* Tafqeet & Notes (Right) */}
              <div className="sm:col-span-7 space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-300 text-xs">
                  <div className="text-[11px] text-slate-500 font-bold mb-1">المبلغ الإجمالي كتابة بالحروف:</div>
                  <div className="font-black text-slate-950 leading-snug">
                    فقط {tafqeetCurrency(grandTotal, effectiveCurrency)}
                  </div>
                </div>

                {quotation.notes && (
                  <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-950">
                    <div className="font-bold mb-1">شروط وملاحظات التوريد:</div>
                    <div className="whitespace-pre-line leading-relaxed text-[11px]">{quotation.notes}</div>
                  </div>
                )}
              </div>

              {/* Numerical Totals (Left) */}
              <div className="sm:col-span-5 border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>المجموع الإجمالي:</span>
                  <span className="font-mono font-bold">{formatted(lineSubtotalsSum)}</span>
                </div>

                {discountsTotal > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>إجمالي الخصم الممنوح:</span>
                    <span className="font-mono font-bold">-{formatted(discountsTotal)}</span>
                  </div>
                )}

                {quotation.vatTotal > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>ضريبة القيمة المضافة:</span>
                    <span className="font-mono font-bold">+{formatted(quotation.vatTotal)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 border-t-2 border-black text-sm font-black text-slate-950">
                  <span>المبلغ الإجمالي الصافي:</span>
                  <span className="text-base font-mono font-black text-emerald-800">
                    {formatted(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Signatures and Official Stamp */}
            <div className="pt-6 border-t-2 border-black grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Customer Approval */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/80 space-y-2 text-center">
                <div className="font-black text-slate-900 border-b border-slate-300 pb-1">
                  اعتماد وقبول العميل
                </div>
                <div className="text-[11px] text-slate-700 text-right space-y-1 pt-1">
                  <p>الاسم: .......................................</p>
                  <p>التوقيع: ....................................</p>
                  <p>التاريخ: ...... / ...... / 2026</p>
                </div>
              </div>

              {/* Sales Representative */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/80 space-y-2 text-center">
                <div className="font-black text-slate-900 border-b border-slate-300 pb-1">
                  مسؤول المبيعات
                </div>
                <div className="text-[11px] text-slate-700 text-right space-y-1 pt-1">
                  <p>الاسم: {quotation.salesRepName || '.......................................'}</p>
                  <p>التوقيع: ....................................</p>
                  <p>التاريخ: {quotation.date}</p>
                </div>
              </div>

              {/* Active Company Official Stamp */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/80 space-y-2 text-center">
                <div className="font-black text-slate-900 border-b border-slate-300 pb-1 truncate" title={activeCompany.nameAr}>
                  {activeCompany.nameAr || activeCompany.headerTitle || 'ختم واعتماد المنشأة'}
                </div>
                <div className="text-[10px] text-slate-600 space-y-1 pt-1">
                  <p className="font-mono uppercase font-bold text-slate-800">
                    {activeCompany.nameEn || activeCompany.tradeName || 'AUTHORIZED SIGNATURE & STAMP'}
                  </p>
                  {(activeCompany.generalManager || activeCompany.financialManager) && (
                    <p className="font-semibold text-slate-700">
                      {activeCompany.generalManager || activeCompany.financialManager}
                    </p>
                  )}
                  <p className="text-slate-400">الختم والتوقيع الرسمي</p>
                </div>
              </div>
            </div>

            {/* Footer Notes */}
            {(activeCompany.footerNotes || activeCompany.headerNotes) && (
              <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-slate-200">
                {activeCompany.footerNotes || activeCompany.headerNotes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
