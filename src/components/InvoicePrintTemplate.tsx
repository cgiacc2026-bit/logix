import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Invoice, CompanyProfile } from '../types';
import {
  Printer,
  Eye,
  EyeOff,
  CheckCircle2,
  UserCheck,
  QrCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Type,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';

interface InvoicePrintTemplateProps {
  invoice: Invoice;
  company: CompanyProfile;
  onClose?: () => void;
  showControls?: boolean;
}

export const InvoicePrintTemplate: React.FC<InvoicePrintTemplateProps> = ({
  invoice,
  company,
  onClose,
  showControls = true,
}) => {
  const activeCompany = resolveActiveCompany(company, (invoice as any)?.companyId);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [fontScale, setFontScale] = useState<'NORMAL' | 'LARGE' | 'XLARGE'>('NORMAL');

  const isSales = invoice.type === 'SALES' || invoice.type === 'SALES_RETURN';
  const isReturn = invoice.type === 'SALES_RETURN' || invoice.type === 'PURCHASE_RETURN';
  const isCash = invoice.paymentTerms === 'CASH' || (invoice.paidAmount >= invoice.grandTotal && invoice.grandTotal > 0);

  const formattedCurrency = (val: number) => {
    return formatCurrency(val, activeCompany.functionalCurrency || 'KWD');
  };

  const getInvoiceTitle = () => {
    if (invoice.type === 'SALES_RETURN') return 'إشعار دائن (مرتجع مبيعات)';
    if (invoice.type === 'PURCHASE_RETURN') return 'إشعار مدين (مرتجع مشتريات)';
    if (invoice.type === 'PURCHASE') {
      return isCash ? 'فاتورة مشتريات نقدية (كاش)' : 'فاتورة مشتريات آجلة (ذمم)';
    }
    return isCash ? 'فاتورة مبيعات نقدية (كاش)' : 'فاتورة مبيعات آجلة (على الحساب)';
  };

  useEffect(() => {
    const paymentTermText = isCash ? 'نقدي (كاش)' : 'آجل (على الحساب)';
    const qrPayloadText = [
      `المورد: ${activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}`,
      `س.ت: ${activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}`,
      `المستند: ${getInvoiceTitle()} - ${invoice.invoiceNumber}`,
      `التاريخ: ${invoice.date}`,
      `الطرف: ${invoice.entityNameAr || '-'}`,
      `طريقة الدفع: ${paymentTermText}`,
      `الصافي المستحق: ${formattedCurrency(invoice.grandTotal)}`,
      `عدد البنود: ${invoice.lines?.length || 0}`,
    ].join('\n');

    QRCode.toDataURL(qrPayloadText, {
      width: 180,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Error generating invoice QR Code', err));
  }, [invoice, activeCompany, isCash]);

  // Calculate gross and line-level discounts
  let grossItemsTotal = 0;
  let lineDiscountsTotal = 0;

  const processedLines = (invoice.lines || []).map((line, idx) => {
    const qty = Number(line.quantity) || 1;
    const price = Number(line.unitPrice) || 0;
    const lineGross = qty * price;
    grossItemsTotal += lineGross;

    let lineDiscAmt = 0;
    if (line.discountType === 'PERCENT' && Number(line.discountValue) > 0) {
      lineDiscAmt = (lineGross * Math.min(100, Math.max(0, Number(line.discountValue)))) / 100;
    } else if (line.discountType === 'FIXED' && Number(line.discountValue) > 0) {
      lineDiscAmt = Math.min(lineGross, Number(line.discountValue));
    } else if (Number(line.discountAmount) > 0) {
      lineDiscAmt = Math.min(lineGross, Number(line.discountAmount));
    } else if (Number(line.discountValue) > 0) {
      lineDiscAmt = Math.min(lineGross, Number(line.discountValue));
    }

    lineDiscountsTotal += lineDiscAmt;
    const lineNet = Math.max(0, lineGross - lineDiscAmt);

    return {
      ...line,
      lineGross,
      lineDiscAmt,
      lineNet,
      idx: idx + 1,
    };
  });

  const overallSubtotalAfterLines = Math.max(0, grossItemsTotal - lineDiscountsTotal);
  let invoiceDiscAmt = 0;
  if (invoice.discountType === 'PERCENT' && Number(invoice.discountValue) > 0) {
    invoiceDiscAmt = (overallSubtotalAfterLines * Math.min(100, Number(invoice.discountValue))) / 100;
  } else if (invoice.discountType === 'FIXED' && Number(invoice.discountValue) > 0) {
    invoiceDiscAmt = Math.min(overallSubtotalAfterLines, Number(invoice.discountValue));
  } else if (Number(invoice.discountTotal) > lineDiscountsTotal) {
    invoiceDiscAmt = Number(invoice.discountTotal) - lineDiscountsTotal;
  }

  const totalAllDiscounts = lineDiscountsTotal + invoiceDiscAmt;
  const finalGrandTotal =
    invoice.grandTotal !== undefined && invoice.grandTotal > 0
      ? invoice.grandTotal
      : Math.max(0, grossItemsTotal - totalAllDiscounts);
  const paid = Number(invoice.paidAmount) || (isCash ? finalGrandTotal : 0);
  const due = invoice.dueAmount !== undefined ? invoice.dueAmount : Math.max(0, finalGrandTotal - paid);

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(200, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(70, prev - 10));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    setFontScale('NORMAL');
  };

  const getFontScaleClass = () => {
    if (fontScale === 'XLARGE') return 'text-[15px] leading-relaxed';
    if (fontScale === 'LARGE') return 'text-[13.5px] leading-normal';
    return 'text-xs leading-normal';
  };

  return (
    <div className="bg-white text-black font-sans dir-rtl text-right w-full">
      {/* Control Bar (hidden on print) */}
      {showControls && (
        <div className="bg-[#1A1A1A] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 no-print border-b border-black rounded-t-xl mb-4">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#D4AF37]" />
            <span className="text-sm font-extrabold text-white">
              نموذج طباعة الفاتورة المحاسبية الرسمية
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Zoom Controls */}
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 cursor-pointer"
                title="تصغير الفاتورة (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <div className="px-2 text-xs font-mono font-bold text-[#D4AF37] min-w-[45px] text-center select-none">
                {zoomLevel}%
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 cursor-pointer"
                title="تكبير الفاتورة (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 text-neutral-400 hover:text-[#D4AF37] hover:bg-neutral-800 rounded transition-colors border-r border-neutral-700 cursor-pointer"
                title="إعادة ضبط الحجم الافتراضي"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Scale Buttons */}
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg p-0.5 text-xs font-bold">
              <span className="px-2 text-neutral-400 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-[#D4AF37]" /> الخط:
              </span>
              <button
                type="button"
                onClick={() => setFontScale('NORMAL')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  fontScale === 'NORMAL' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                عادي
              </button>
              <button
                type="button"
                onClick={() => setFontScale('LARGE')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  fontScale === 'LARGE' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                كبير (+15%)
              </button>
              <button
                type="button"
                onClick={() => setFontScale('XLARGE')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  fontScale === 'XLARGE' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                واضح جداً (+30%)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                showQr
                  ? 'bg-neutral-800 text-[#D4AF37] border-[#D4AF37]/50 hover:bg-neutral-700'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
              title="إظهار أو إلغاء رمز الـ QR"
            >
              {showQr ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-rose-400" />}
              <span>{showQr ? 'رمز QR: مفعل' : 'رمز QR: ملغي'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#b8952b] text-black font-black text-xs rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              طباعة (Print A4)
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Sheet */}
      <div
        className={`p-6 sm:p-8 space-y-6 bg-white print:p-0 transition-transform duration-150 origin-top ${getFontScaleClass()}`}
        id="printable-invoice"
        style={{
          transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
          transformOrigin: 'top center',
          marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 8}px` : undefined,
        }}
      >
        {/* Header Section */}
        <div className="flex items-start justify-between border-b-2 border-black pb-5 gap-4">
          <div className="flex items-start gap-4 text-right max-w-md">
            {activeCompany.logoUrl && (
              <img
                src={activeCompany.logoUrl}
                alt="Logo"
                className="w-20 h-20 object-contain rounded-lg border border-neutral-300 p-1 bg-white shrink-0"
              />
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-black tracking-tight">
                {activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}
              </h1>
              <p className="text-xs text-neutral-600 font-bold uppercase tracking-wider">
                {activeCompany.nameEn || activeCompany.tradeName || 'AUTHORIZED ENTERPRISE'}
              </p>
              
              {/* Customer specific co-branded header and customer logo if applicable */}
              {(() => {
                const matchedHeader = activeCompany.customerBrandHeaders?.find(
                  (h) => (invoice.entityId && h.customerId === invoice.entityId) || 
                         (invoice.entityNameAr && h.customerNameAr?.trim() === invoice.entityNameAr?.trim())
                );
                if (matchedHeader) {
                  return (
                    <div className="mt-1.5 p-1.5 rounded bg-neutral-50 border border-neutral-300 text-[10px] text-neutral-900 flex items-center gap-2">
                      {matchedHeader.coBrandLogoUrl && (
                        <img
                          src={matchedHeader.coBrandLogoUrl}
                          alt="Customer Co-Brand Logo"
                          className="w-12 h-12 object-contain rounded border border-neutral-300 bg-white p-0.5 shrink-0"
                        />
                      )}
                      <div>
                        {matchedHeader.customHeaderTitle && (
                          <div className="font-bold text-neutral-900">
                            🏷️ {matchedHeader.customHeaderTitle}
                          </div>
                        )}
                        <span className="text-[9px] text-neutral-500 font-semibold block">
                          اعتماد التوريد والشراكة: {matchedHeader.customerNameAr}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="text-xs text-neutral-800 space-y-0.5 pt-1 font-medium leading-tight">
                <p>
                  السجل التجاري: <span className="font-bold font-mono text-black">{activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}</span>
                  {activeCompany.taxNumber && (
                    <span className="mr-3">الرقم الضريبي: <span className="font-bold font-mono text-black">{activeCompany.taxNumber}</span></span>
                  )}
                </p>
                <p>
                  {[activeCompany.streetName, activeCompany.district, activeCompany.city, activeCompany.country].filter(Boolean).join('، ') || 'المقر الرئيسي'}
                </p>
                <p>
                  هاتف: <span className="font-mono font-bold">{activeCompany.phone || activeCompany.mobile || '-'}</span>
                  {activeCompany.email && (
                    <>
                      <span className="mx-2 text-neutral-400">|</span>
                      بريد: <span className="font-mono font-bold">{activeCompany.email}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left">
            {showQr && (
              <div className="flex flex-col items-center justify-center p-1 bg-white border border-black rounded-md">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="Invoice QR" className="w-20 h-20 object-contain" />
                ) : (
                  <div className="w-20 h-20 flex flex-col items-center justify-center bg-neutral-50 text-neutral-400">
                    <QrCode className="w-10 h-10" />
                  </div>
                )}
                <span className="text-[7px] font-bold text-neutral-700 mt-0.5 font-mono">E-INVOICE QR</span>
              </div>
            )}

            <div className="border-2 border-black px-4 py-2.5 rounded-lg text-center bg-neutral-50 min-w-[170px]">
              <div className="text-xs font-black text-black">{getInvoiceTitle()}</div>
              <div className="text-sm font-mono font-black pt-1 text-black">{invoice.invoiceNumber}</div>
              <div className="text-[10px] text-neutral-700 font-bold mt-1 pt-1 border-t border-neutral-300">
                التاريخ: <span className="font-mono font-black text-black">{invoice.date}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Invoice Meta Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#FAF9F6] border border-neutral-400 rounded-lg text-xs sm:text-sm text-right">
          <div className="space-y-1">
            <span className="text-neutral-500 block text-xs font-bold">
              {isSales ? 'السادة / العميل (المشتري):' : 'السادة / المورد:'}
            </span>
            <span className="font-black text-sm sm:text-base text-black block">{invoice.entityNameAr || '-'}</span>
          </div>

          <div className="space-y-1">
            <span className="text-neutral-500 block text-xs font-bold">نوع وشروط الفاتورة:</span>
            <span className="font-extrabold text-xs sm:text-sm block text-black">
              {isCash ? (
                <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                  نقدي (كاش - مدفوعة)
                </span>
              ) : (
                <span className="text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300 font-bold">
                  آجل (على الحساب / ذمم)
                </span>
              )}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-neutral-500 block text-xs font-bold">تاريخ الاستحقاق:</span>
            <span className="font-bold text-black block font-mono">
              {invoice.dueDate || invoice.date || '-'}
            </span>
          </div>
        </div>

        {/* Table of Items - Clean and responsive */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-xs sm:text-sm text-right border-collapse border border-neutral-300 print:table-fixed print:w-full print:border print:border-black">
            <thead>
              <tr className="bg-[#1A1A1A] print:bg-neutral-900 text-white text-xs font-bold print:text-[10px]">
                <th className="py-2.5 px-2 text-center w-8 print:w-[4%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1">م</th>
                <th className="py-2.5 px-2.5 text-center w-24 print:w-[13%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">رقم الصنف (SKU)</th>
                <th className="py-2.5 px-3 text-right print:w-[31%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1.5">بيان الصنف والمواصفات</th>
                <th className="py-2.5 px-2 text-center w-16 print:w-[8%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">الكمية</th>
                <th className="py-2.5 px-2 text-center w-14 print:w-[7%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1">الوحدة</th>
                <th className="py-2.5 px-2 text-center w-14 print:w-[7%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">الشد</th>
                <th className="py-2.5 px-2.5 text-left w-24 print:w-[10%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">سعر الوحدة</th>
                <th className="py-2.5 px-2.5 text-left w-20 print:w-[8%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">الخصم</th>
                <th className="py-2.5 px-3 text-left w-24 print:w-[12%] border-b border-neutral-300 print:border print:border-black print:py-1.5 print:px-1 font-mono">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 print:divide-neutral-300">
              {processedLines.map((line) => {
                const unitsPerPack = Number(line.unitsPerPack) || 1;
                const hasDiscount = line.lineDiscAmt > 0;

                return (
                  <tr key={line.id || line.idx} className="hover:bg-neutral-50 print:hover:bg-transparent">
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-600 print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                      {line.idx}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-mono font-bold text-black print:py-1.5 print:px-1 print:border print:border-black print:text-[10px]">
                      {line.itemSku || line.barcode || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-black print:py-1.5 print:px-1.5 print:border print:border-black print:text-[10px]">
                      <div className="print:leading-tight">{line.itemNameAr}</div>
                      {line.notes && <div className="text-[11px] text-neutral-500 print:text-[8.5px] font-normal mt-0.5">{line.notes}</div>}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-black text-black print:py-1.5 print:px-1 print:border print:border-black print:text-[10px]">
                      {line.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-neutral-800 print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                      {line.unit || 'حبة'}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-neutral-800 print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                      {unitsPerPack > 1 ? `شد ${unitsPerPack}` : '1'}
                    </td>
                    <td className="py-2.5 px-2.5 text-left font-mono font-bold text-[#1A1A1A] print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                      {formattedCurrency(line.unitPrice)}
                    </td>
                    <td className="py-2.5 px-2.5 text-left font-mono text-neutral-700 print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[10px]">
                      {hasDiscount ? (
                        <span className="font-bold text-amber-900 print:text-black">
                          -{formattedCurrency(line.lineDiscAmt)}
                        </span>
                      ) : (
                        <span className="text-neutral-400 print:text-neutral-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono font-black text-black print:py-1.5 print:px-1 print:border print:border-black print:text-[10px]">
                      {formattedCurrency(line.lineNet)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#FAF9F6] border-t-2 border-black text-xs sm:text-sm font-bold print:bg-neutral-100 print:text-[10px]">
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-right print:py-1.5 print:px-1.5 print:border print:border-black">
                  عدد الأصناف: <span className="font-black font-mono">{processedLines.length}</span> | إجمالي الكمية:{' '}
                  <span className="font-black font-mono">
                    {processedLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}
                  </span>
                </td>
                <td colSpan={4} className="py-2.5 px-3 text-left text-neutral-700 print:py-1.5 print:px-1 print:border print:border-black print:text-black">
                  المجموع قبل الخصومات:
                </td>
                <td colSpan={2} className="py-2.5 px-3 text-left font-mono text-black font-black print:py-1.5 print:px-1 print:border print:border-black print:text-[11px]">
                  {formattedCurrency(grossItemsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Totals & Arabic Tafqeet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <div className="space-y-3 flex flex-col justify-between">
            <div className="p-3.5 bg-[#FAF9F6] rounded-lg border border-neutral-300 space-y-1.5">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                المبلغ تفقيطاً بالكلمات والعملة الرسمية (Tafqeet):
              </span>
              <p className="text-xs sm:text-sm font-serif font-black text-black leading-relaxed bg-white p-2.5 rounded border border-neutral-200 shadow-2xs">
                {tafqeetCurrency(finalGrandTotal, activeCompany.functionalCurrency || 'KWD')}
              </p>
            </div>

            {invoice.notes && (
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
                <span className="font-bold text-neutral-700 block mb-0.5">ملاحظات والتسليم:</span>
                <p className="text-neutral-600 leading-relaxed">{invoice.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-[#FAF9F6] border border-neutral-400 p-3.5 rounded-lg space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-neutral-700">
              <span>إجمالي قيمة الأصناف:</span>
              <span className="font-bold font-mono text-black">{formattedCurrency(grossItemsTotal)}</span>
            </div>

            {totalAllDiscounts > 0 && (
              <div className="flex justify-between items-center text-amber-900 font-bold border-t border-neutral-200 pt-1.5">
                <span>إجمالي الخصومات:</span>
                <span className="font-mono">-{formattedCurrency(totalAllDiscounts)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm sm:text-base font-black text-black pt-2 border-t-2 border-black bg-white p-2 rounded border">
              <span>صافي القيمة المستحقة:</span>
              <span className="font-mono text-emerald-900 text-base sm:text-lg font-black">{formattedCurrency(finalGrandTotal)}</span>
            </div>

            {isCash ? (
              <div className="flex justify-between items-center text-emerald-800 font-bold pt-1">
                <span>حالة السداد:</span>
                <span className="font-bold">مسدد بالكامل نقداً (كاش)</span>
              </div>
            ) : (
              paid > 0 && (
                <div className="flex justify-between items-center text-neutral-700 pt-1">
                  <span>المدفوع:</span>
                  <span className="font-mono font-bold text-emerald-700">{formattedCurrency(paid)}</span>
                </div>
              )
            )}

            {!isCash && due > 0 && (
              <div className="flex justify-between items-center text-neutral-900 font-bold">
                <span>المبلغ المستحق (آجل):</span>
                <span className="font-mono font-black text-rose-800">{formattedCurrency(due)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Professional Footer: Receiver Name, Receiver Signature, and Active Company Stamp */}
        <div className="pt-6 border-t-2 border-black grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          {/* 1. اسم المستلم */}
          <div className="border border-neutral-300 rounded-lg p-3.5 bg-[#FAF9F6] space-y-2">
            <div className="font-black text-black border-b border-neutral-300 pb-1.5 text-xs">
              اسم المستلم:
            </div>
            <div className="text-xs sm:text-sm pt-1 text-neutral-900 font-bold min-h-[35px] flex items-center">
              {invoice.receiverName || invoice.entityNameAr || '...................................................'}
            </div>
          </div>

          {/* 2. توقيع المستلم */}
          <div className="border border-neutral-300 rounded-lg p-3.5 bg-[#FAF9F6] space-y-2">
            <div className="font-black text-black border-b border-neutral-300 pb-1.5 text-xs">
              توقيع المستلم:
            </div>
            <div className="text-xs pt-1 text-neutral-900 space-y-1.5">
              <p>التوقيع: .......................................</p>
              <p>التاريخ: ...... / ...... / 2026</p>
            </div>
          </div>

          {/* 3. ختم وتوقيع المنشأة النشطة حصرياً */}
          <div className="border border-neutral-300 rounded-lg p-3.5 bg-[#FAF9F6] space-y-2 text-center">
            <div className="font-black text-black border-b border-neutral-300 pb-1.5 text-xs truncate" title={activeCompany.nameAr || activeCompany.headerTitle}>
              {activeCompany.nameAr || activeCompany.headerTitle || 'ختم واعتماد المنشأة'}
            </div>
            <div className="text-xs pt-1 text-neutral-800 space-y-1.5">
              <p>الختم والتوقيع: .................................</p>
              <p className="text-[10px] text-neutral-500 font-mono uppercase truncate">
                {activeCompany.nameEn || activeCompany.tradeName || 'AUTHORIZED SIGNATURE & STAMP'}
              </p>
              {(activeCompany.generalManager || activeCompany.financialManager) && (
                <p className="text-[9.5px] text-neutral-700 font-semibold truncate">
                  {activeCompany.generalManager || activeCompany.financialManager}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Footer Note */}
        {(activeCompany.footerNotes || activeCompany.headerNotes) && (
          <div className="text-center text-[10px] text-neutral-500 pt-3 border-t border-neutral-300 font-sans">
            {activeCompany.footerNotes || activeCompany.headerNotes}
          </div>
        )}
      </div>
    </div>
  );
};
