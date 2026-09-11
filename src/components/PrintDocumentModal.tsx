import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CompanyProfile, Invoice, PaymentVoucher, JournalEntry } from '../types';
import {
  Printer,
  X,
  CheckCircle2,
  QrCode,
  Eye,
  EyeOff,
  FileText,
  DollarSign,
  Calendar,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Type,
  RotateCcw,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';

interface PrintDocumentModalProps {
  documentType: 'INVOICE' | 'VOUCHER' | 'JOURNAL' | 'STATEMENT';
  data: any;
  company: CompanyProfile;
  onClose: () => void;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  documentType,
  data,
  company,
  onClose,
}) => {
  if (!data) return null;

  const activeCompany = resolveActiveCompany(company, data?.companyId || data?.company_id);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState<boolean>(true);

  // Zoom & Font Size Control State
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 70% to 200%
  const [fontScale, setFontScale] = useState<'NORMAL' | 'LARGE' | 'XLARGE'>('NORMAL');
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');

  const formattedCurrency = (val: number) => {
    return formatCurrency(val, activeCompany.functionalCurrency || 'KWD');
  };

  const getDocTitle = () => {
    if (documentType === 'INVOICE') {
      const inv = data as Invoice;
      const isCash = inv.paymentTerms === 'CASH' || (inv.paidAmount >= inv.grandTotal && inv.grandTotal > 0);
      if (inv.type === 'SALES_RETURN') return 'إشعار دائن (مرتجع مبيعات)';
      if (inv.type === 'PURCHASE_RETURN') return 'إشعار مدين (مرتجع مشتريات)';
      if (inv.type === 'PURCHASE') return isCash ? 'فاتورة مشتريات نقدية (كاش)' : 'فاتورة مشتريات آجلة (ذمم)';
      return isCash ? 'فاتورة مبيعات نقدية (كاش)' : 'فاتورة مبيعات آجلة (على الحساب)';
    }
    if (documentType === 'VOUCHER') {
      return (data as PaymentVoucher).type === 'RECEIPT' ? 'سند قبض مالي' : 'سند صرف مالي';
    }
    if (documentType === 'JOURNAL') return 'قيد يومية محاسبي معتمد';
    if (documentType === 'STATEMENT') return 'كشف حساب مالي تفصيلي';
    return 'مستند مالي رسمي';
  };

  // Generate Real QR Code
  useEffect(() => {
    if (documentType === 'INVOICE') {
      const inv = data as Invoice;
      const paymentTermText =
        inv.paymentTerms === 'CASH' || (inv.paidAmount >= inv.grandTotal && inv.grandTotal > 0)
          ? 'نقدي (كاش)'
          : 'آجل (على الحساب)';

      const qrPayloadText = [
        `المورد: ${activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}`,
        `س.ت: ${activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}`,
        `المستند: ${getDocTitle()} - ${inv.invoiceNumber}`,
        `التاريخ: ${inv.date}`,
        `الطرف: ${inv.entityNameAr || '-'}`,
        `طريقة الدفع: ${paymentTermText}`,
        `الصافي المستحق: ${formattedCurrency(inv.grandTotal)}`,
        `عدد البنود: ${inv.lines?.length || 0}`,
      ].join('\n');

      QRCode.toDataURL(qrPayloadText, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generating invoice QR Code', err));
    } else if (documentType === 'VOUCHER') {
      const v = data as PaymentVoucher;
      const qrPayloadText = [
        `الجهة: ${activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}`,
        `السند: ${v.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} (${v.voucherNumber})`,
        `التاريخ: ${v.date}`,
        `المبلغ: ${formattedCurrency(v.amount)}`,
        `الطرف: ${v.entityNameAr}`,
      ].join('\n');

      QRCode.toDataURL(qrPayloadText, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR Error', err));
    }
  }, [documentType, data, activeCompany]);

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

  // Font Scale Multiplier classes
  const getFontScaleClass = () => {
    if (fontScale === 'XLARGE') return 'text-[15px] leading-relaxed';
    if (fontScale === 'LARGE') return 'text-[13.5px] leading-normal';
    return 'text-xs leading-normal';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:backdrop-blur-none">
      {/* Injected Print Stylesheet for High-DPI Crisp Vector Printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${printFormat === 'THERMAL' ? '80mm auto' : 'A4 portrait'};
            margin: ${printFormat === 'THERMAL' ? '2mm 2mm 2mm 2mm' : '10mm 8mm 10mm 8mm'};
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000000 !important;
          }
          body {
            background: white !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-scalable-container {
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            page-break-inside: auto;
            border-color: #000000 !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
            border-color: #000000 !important;
          }
          th, td {
            border-color: #000000 !important;
            color: #000000 !important;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      ` }} />

      <div className="bg-white rounded-2xl max-w-5xl w-full my-auto shadow-2xl dir-rtl text-right overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none print:border-none print:w-full print:m-0 print:p-0">
        
        {/* ========================================================================= */}
        {/* Top Control Action Bar with Zoom In / Zoom Out & Font Scaling */}
        {/* ========================================================================= */}
        <div className="bg-[#1A1A1A] text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print border-b border-black shrink-0">
          
          {/* Title & Document Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-black text-white block leading-tight">
                معاينة وطباعة {getDocTitle()}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {activeCompany.nameAr || activeCompany.headerTitle || 'لوجيكس ERP'} • معاينة عالية الوضوح
              </span>
            </div>
          </div>

          {/* Interactive Zoom & Visual Toolset */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Zoom Controls Pill */}
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="تصغير المعاينة (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <div className="px-2 text-xs font-mono font-bold text-[#D4AF37] min-w-[52px] text-center select-none">
                {zoomLevel}%
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="تكبير المعاينة (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-md transition-colors border-r border-neutral-800 cursor-pointer"
                title="إعادة ضبط الحجم الافتراضي 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Size Preset Selector */}
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg p-0.5 text-[11px] font-bold">
              <span className="px-2 text-neutral-400 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-[#D4AF37]" /> الخط:
              </span>
              <button
                type="button"
                onClick={() => setFontScale('NORMAL')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'NORMAL' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                عادي
              </button>
              <button
                type="button"
                onClick={() => setFontScale('LARGE')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'LARGE' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                كبير (+15%)
              </button>
              <button
                type="button"
                onClick={() => setFontScale('XLARGE')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  fontScale === 'XLARGE' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                واضح جداً (+30%)
              </button>
            </div>

            {/* Invoice Print Format Selector (A4 vs Thermal) */}
            {documentType === 'INVOICE' && (
              <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    printFormat === 'A4' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                  }`}
                  title="طباعة على ورق قياسي عريض A4"
                >
                  <FileText className="w-3.5 h-3.5" />
                  قالب A4 قياسي
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('THERMAL')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    printFormat === 'THERMAL' ? 'bg-[#D4AF37] text-black font-black' : 'text-neutral-300 hover:text-white'
                  }`}
                  title="طباعة على طابعة حرارية للكاشير 80mm / 58mm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  قالب حراري (Thermal)
                </button>
              </div>
            )}

            {/* QR Toggle Button */}
            {documentType === 'INVOICE' && (
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  showQr
                    ? 'bg-neutral-800 text-[#D4AF37] border-[#D4AF37]/50 hover:bg-neutral-700'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
                title="إظهار أو إلغاء رمز الـ QR على الفاتورة"
              >
                {showQr ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                <span>{showQr ? 'رمز QR: مفعل' : 'رمز QR: ملغي'}</span>
              </button>
            )}

            {/* Print Instant Action Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#b8952b] text-black font-black text-xs rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              طباعة فورية (Print)
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Printable View Container with Zoom & Font Sizing Applied */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-auto bg-neutral-100 p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible flex justify-center">
          <div
            className={`bg-white text-black shadow-lg border border-neutral-300 print:border-none print:shadow-none print:p-0 w-full transition-transform duration-150 origin-top print-scalable-container ${
              printFormat === 'THERMAL' && documentType === 'INVOICE'
                ? 'max-w-[360px] p-3 sm:p-4'
                : 'max-w-4xl p-6 sm:p-10'
            } ${getFontScaleClass()}`}
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top center',
              marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 8}px` : undefined,
            }}
            id="printable-document"
          >
            {/* Standard Header Section: Used for A4 or Non-Thermal Documents */}
            {!(printFormat === 'THERMAL' && documentType === 'INVOICE') && (
              <div className="flex items-start justify-between border-b-2 border-black pb-5 gap-4">
                {/* Right: Company Information */}
                <div className="space-y-1 text-right max-w-md">
                  <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                    {activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}
                  </h1>
                  <p className="text-xs text-black font-black uppercase tracking-wider font-mono">
                    {activeCompany.nameEn || activeCompany.tradeName || 'AUTHORIZED ENTERPRISE'}
                  </p>
                  <div className="text-xs text-black space-y-0.5 pt-1.5 font-bold leading-relaxed">
                    <p>
                      السجل التجاري: <span className="font-black font-mono text-black">{activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}</span>
                      {activeCompany.taxNumber && (
                        <span className="mr-3">الرقم الضريبي: <span className="font-black font-mono text-black">{activeCompany.taxNumber}</span></span>
                      )}
                    </p>
                    <p>
                      {[activeCompany.streetName, activeCompany.district, activeCompany.city, activeCompany.country].filter(Boolean).join('، ') || 'المقر الرئيسي'}
                    </p>
                    <p>
                      هاتف: <span className="font-mono font-black text-black">{activeCompany.phone || activeCompany.mobile || '-'}</span>
                      {activeCompany.email && (
                        <>
                          <span className="mx-2 text-black font-black">|</span>
                          بريد: <span className="font-mono font-black text-black">{activeCompany.email}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Left: QR Code & Document Meta Identifier Badge */}
                <div className="flex items-center gap-3 text-left shrink-0">
                  {/* Real Generated QR Code (Togglable) */}
                  {showQr && (
                    <div className="flex flex-col items-center justify-center p-1.5 bg-white border-2 border-black rounded-lg shadow-2xs">
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="Invoice QR"
                          className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                        />
                      ) : (
                        <div className="w-20 h-20 flex flex-col items-center justify-center bg-white text-black border border-black">
                          <QrCode className="w-10 h-10 text-black" />
                          <span className="text-[8px] font-black text-black">QR CODE</span>
                        </div>
                      )}
                      <span className="text-[8px] font-black text-black mt-1 font-mono">E-INVOICE QR</span>
                    </div>
                  )}

                  {/* Invoice Meta Box */}
                  <div className="border-2 border-black px-4 py-3 rounded-xl text-center bg-white min-w-[190px] shadow-2xs">
                    <div className="text-xs sm:text-sm font-black text-black">
                      {getDocTitle()}
                    </div>
                    <div className="text-sm sm:text-base font-mono font-black pt-1 text-black">
                      {documentType === 'INVOICE' && (data as Invoice).invoiceNumber}
                      {documentType === 'VOUCHER' && (data as PaymentVoucher).voucherNumber}
                      {documentType === 'JOURNAL' && (data as JournalEntry).entryNumber}
                      {documentType === 'STATEMENT' && (data.customer?.code ? `كود: ${data.customer.code}` : 'STMT-2026')}
                    </div>
                    <div className="text-xs text-black font-black mt-1.5 pt-1.5 border-t-2 border-black">
                      التاريخ: <span className="font-mono font-black text-black">{data.date || new Date().toISOString().split('T')[0]}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 1. INVOICE VIEW */}
            {/* ========================================================================= */}
            {documentType === 'INVOICE' && (() => {
              const inv = data as Invoice;
              const isSales = inv.type === 'SALES' || inv.type === 'SALES_RETURN';
              const isCash = inv.paymentTerms === 'CASH' || (inv.paidAmount >= inv.grandTotal && inv.grandTotal > 0);

              // Calculate item lines gross, discounts, and nets
              let grossItemsTotal = 0;
              let lineDiscountsTotal = 0;

              const processedLines = (inv.lines || []).map((line, idx) => {
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
              if (inv.discountType === 'PERCENT' && Number(inv.discountValue) > 0) {
                invoiceDiscAmt = (overallSubtotalAfterLines * Math.min(100, Number(inv.discountValue))) / 100;
              } else if (inv.discountType === 'FIXED' && Number(inv.discountValue) > 0) {
                invoiceDiscAmt = Math.min(overallSubtotalAfterLines, Number(inv.discountValue));
              } else if (Number(inv.discountTotal) > lineDiscountsTotal) {
                invoiceDiscAmt = Number(inv.discountTotal) - lineDiscountsTotal;
              }

              const totalAllDiscounts = lineDiscountsTotal + invoiceDiscAmt;
              const finalGrandTotal =
                inv.grandTotal !== undefined && inv.grandTotal > 0
                  ? inv.grandTotal
                  : Math.max(0, grossItemsTotal - totalAllDiscounts);
              const paid = Number(inv.paidAmount) || (isCash ? finalGrandTotal : 0);
              const due = inv.dueAmount !== undefined ? inv.dueAmount : Math.max(0, finalGrandTotal - paid);

              return printFormat === 'THERMAL' ? (
                /* ========================================================================= */
                /* THERMAL POS RECEIPT FORMAT (80mm / 58mm) */
                /* ========================================================================= */
                <div className="w-full text-black font-sans dir-rtl text-right space-y-2">
                  {/* Thermal Header */}
                  <div className="text-center pb-2 border-b-2 border-black space-y-1">
                    {activeCompany.logoUrl && (
                      <div className="flex justify-center mb-1">
                        <img
                          src={activeCompany.logoUrl}
                          alt="Logo"
                          className="h-10 w-auto object-contain max-w-[120px]"
                        />
                      </div>
                    )}
                    <h2 className="text-base font-black text-black tracking-tight">
                      {activeCompany.nameAr || activeCompany.headerTitle || 'المنشأة المعتمدة'}
                    </h2>
                    {activeCompany.nameEn && (
                      <p className="text-[10px] font-black text-black uppercase font-mono">
                        {activeCompany.nameEn}
                      </p>
                    )}
                    <div className="text-[10px] font-black text-black space-y-0.5 pt-0.5">
                      {(activeCompany.crNumber || activeCompany.commercialRegNumber) && (
                        <p className="font-mono">س.ت: {activeCompany.crNumber || activeCompany.commercialRegNumber}</p>
                      )}
                      {activeCompany.taxNumber && (
                        <p className="font-mono">الرقم الضريبي: {activeCompany.taxNumber}</p>
                      )}
                      {activeCompany.phone && (
                        <p className="font-mono">هاتف: {activeCompany.phone}</p>
                      )}
                    </div>
                    <div className="pt-1">
                      <span className="inline-block px-2.5 py-0.5 border-2 border-black text-black font-black text-[10px]">
                        {getDocTitle()}
                      </span>
                    </div>
                  </div>

                  {/* Thermal Metadata */}
                  <div className="py-1.5 border-b-2 border-black space-y-1 text-[11px] font-black text-black">
                    <div className="flex justify-between font-mono">
                      <span>رقم الفاتورة:</span>
                      <span className="font-black">{inv.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>التاريخ:</span>
                      <span className="font-black">{inv.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>العميل:</span>
                      <span className="font-black truncate max-w-[200px]">{inv.entityNameAr || 'عميل نقدي'}</span>
                    </div>
                    {inv.customerBranchName && (
                      <div className="flex justify-between">
                        <span>فرع التسليم:</span>
                        <span className="font-black">{inv.customerBranchName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>طريقة السداد:</span>
                      <span className="font-black">{isCash ? 'نقدي (كاش)' : 'آجل (ذمم)'}</span>
                    </div>
                  </div>

                  {/* Thermal Items Table (Exact 9 Columns in Pure Black Bold #000000) */}
                  <div className="py-1">
                    <table className="w-full text-right border-collapse border-2 border-black text-[9px] leading-tight font-black text-black">
                      <thead>
                        <tr className="bg-neutral-100 print:bg-white text-black font-black border-b-2 border-black">
                          <th className="py-1 px-1 text-center border border-black w-5">م</th>
                          <th className="py-1 px-1 text-center border border-black font-mono w-14">رقم الصنف (SKU)</th>
                          <th className="py-1 px-1 text-right border border-black">بيان الصنف والمواصفات</th>
                          <th className="py-1 px-1 text-center border border-black font-mono w-7">الكمية</th>
                          <th className="py-1 px-1 text-center border border-black w-8">الوحدة</th>
                          <th className="py-1 px-1 text-center border border-black font-mono w-7">الشد</th>
                          <th className="py-1 px-1 text-left border border-black font-mono w-12">سعر الوحدة</th>
                          <th className="py-1 px-1 text-left border border-black font-mono w-10">الخصم</th>
                          <th className="py-1 px-1 text-left border border-black font-mono w-12">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {processedLines.map((line) => {
                          const unitsPerPack = Number(line.unitsPerPack) || 1;
                          const hasDiscount = line.lineDiscAmt > 0;
                          return (
                            <tr key={line.id || line.idx} className="border-b border-black">
                              <td className="py-1 px-1 text-center font-mono font-black border border-black">{line.idx}</td>
                              <td className="py-1 px-1 text-center font-mono font-black border border-black">{line.itemSku || line.barcode || '-'}</td>
                              <td className="py-1 px-1 font-black border border-black">
                                <div className="font-black text-black leading-tight">{line.itemNameAr}</div>
                                {line.notes && <div className="text-[8px] font-bold text-black">{line.notes}</div>}
                              </td>
                              <td className="py-1 px-1 text-center font-mono font-black border border-black">{line.quantity}</td>
                              <td className="py-1 px-1 text-center font-black border border-black">{line.unit || 'حبة'}</td>
                              <td className="py-1 px-1 text-center font-mono font-black border border-black">{unitsPerPack > 1 ? `شد ${unitsPerPack}` : '1'}</td>
                              <td className="py-1 px-1 text-left font-mono font-black border border-black">{formattedCurrency(line.unitPrice)}</td>
                              <td className="py-1 px-1 text-left font-mono font-black border border-black">
                                {hasDiscount ? `-${formattedCurrency(line.lineDiscAmt)}` : '0.00'}
                              </td>
                              <td className="py-1 px-1 text-left font-mono font-black border border-black">{formattedCurrency(line.lineNet)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-black font-black text-[9px] bg-neutral-50 print:bg-white">
                        <tr>
                          <td colSpan={3} className="py-1 px-1 border border-black">
                            عدد الأصناف: <span className="font-mono">{processedLines.length}</span> | الكمية: <span className="font-mono">{processedLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}</span>
                          </td>
                          <td colSpan={4} className="py-1 px-1 border border-black text-left">
                            المجموع قبل الخصم:
                          </td>
                          <td colSpan={2} className="py-1 px-1 border border-black text-left font-mono">
                            {formattedCurrency(grossItemsTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Thermal Financial Totals */}
                  <div className="py-1.5 border-t-2 border-black space-y-1 text-xs font-black text-black">
                    <div className="flex justify-between">
                      <span>إجمالي قيمة الأصناف:</span>
                      <span className="font-mono">{formattedCurrency(grossItemsTotal)}</span>
                    </div>
                    {totalAllDiscounts > 0 && (
                      <div className="flex justify-between border-t border-black pt-1">
                        <span>إجمالي الخصومات:</span>
                        <span className="font-mono">-{formattedCurrency(totalAllDiscounts)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline border-t-2 border-black pt-1 text-sm font-black">
                      <span>صافي القيمة المستحقة:</span>
                      <span className="text-base font-mono font-black">{formattedCurrency(finalGrandTotal)}</span>
                    </div>
                    {isCash ? (
                      <div className="flex justify-between text-[11px] pt-0.5">
                        <span>حالة السداد:</span>
                        <span>مسدد بالكامل نقداً (كاش)</span>
                      </div>
                    ) : (
                      paid > 0 && (
                        <div className="flex justify-between text-[11px] pt-0.5">
                          <span>المدفوع:</span>
                          <span className="font-mono">{formattedCurrency(paid)}</span>
                        </div>
                      )
                    )}
                    {!isCash && due > 0 && (
                      <div className="flex justify-between text-[11px] pt-0.5">
                        <span>المبلغ المتبقي (آجل):</span>
                        <span className="font-mono">{formattedCurrency(due)}</span>
                      </div>
                    )}
                  </div>

                  {/* Thermal Tafqeet */}
                  <div className="p-2 border-2 border-black text-[10px] text-center font-black text-black bg-white">
                    المبلغ تفقيطاً: {tafqeetCurrency(finalGrandTotal, activeCompany.functionalCurrency || 'KWD')}
                  </div>

                  {/* Thermal QR Code & Digital Stamp */}
                  <div className="py-2 text-center space-y-1.5 border-t-2 border-black">
                    {showQr && qrCodeDataUrl && (
                      <div className="flex justify-center">
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code"
                          className="w-24 h-24 object-contain border-2 border-black p-0.5 bg-white"
                        />
                      </div>
                    )}
                    <p className="text-[10px] font-black font-mono">فاتورة ضريبية مبسطة معتمدة</p>
                    <div className="text-[10px] font-black">
                      {activeCompany.nameAr || activeCompany.headerTitle}
                    </div>
                    <p className="text-[9px] font-bold">شكراً لتعاملكم معنا</p>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* STANDARD A4 INVOICE FORMAT (High Contrast Pure Black #000000 Bold)        */
                /* ========================================================================= */
                <div className="space-y-6 pt-4">
                  {/* Customer Details & Invoice Meta Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white border-2 border-black rounded-xl text-xs sm:text-sm text-right">
                    <div className="space-y-1">
                      <span className="text-black block text-xs font-black">
                        {isSales ? 'السادة / العميل (المشتري):' : 'السادة / المورد:'}
                      </span>
                      <span className="font-black text-base text-black block">{inv.entityNameAr || '-'}</span>
                      {inv.customerBranchName && (
                        <span className="text-xs font-black text-black bg-white px-2 py-0.5 rounded border-2 border-black inline-block mt-1">
                          فرع التسليم: {inv.customerBranchName}
                        </span>
                      )}
                      {inv.priceListApplied && (
                        <span className="text-[11px] text-black font-bold block mt-0.5">
                          قائمة الأسعار المعتمدة: {inv.priceListApplied}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-black block text-xs font-black">نوع وشروط الفاتورة:</span>
                      <span className="font-black text-xs sm:text-sm block text-black">
                        {isCash ? (
                          <span className="text-black bg-white px-2.5 py-1 rounded border-2 border-black font-black inline-block">
                            نقدي (كاش - مدفوعة)
                          </span>
                        ) : (
                          <span className="text-black bg-white px-2.5 py-1 rounded border-2 border-black font-black inline-block">
                            آجل (على الحساب / ذمم)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-black block text-xs font-black">تاريخ الاستحقاق:</span>
                      <span className="font-black text-black block font-mono text-sm">
                        {inv.dueDate || inv.date || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Items Table - Clean, precise, high readability, 9 exact columns in pure black bold */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-xs sm:text-sm text-right border-collapse border-2 border-black print:table-fixed print:w-full print:border-2 print:border-black">
                      <thead>
                        <tr className="bg-neutral-100 print:bg-white text-black font-black text-xs sm:text-sm print:text-[10px] border-b-2 border-black">
                          <th className="py-2.5 px-2 text-center w-10 print:w-[5%] border border-black font-black text-black print:text-black">
                            م
                          </th>
                          <th className="py-2.5 px-3 text-center w-28 print:w-[13%] border border-black font-black text-black print:text-black font-mono">
                            رقم الصنف (SKU)
                          </th>
                          <th className="py-2.5 px-3.5 text-right print:w-[30%] border border-black font-black text-black print:text-black">
                            بيان الصنف والمواصفات
                          </th>
                          <th className="py-2.5 px-3 text-center w-16 print:w-[8%] border border-black font-black text-black print:text-black font-mono">
                            الكمية
                          </th>
                          <th className="py-2.5 px-3 text-center w-16 print:w-[7%] border border-black font-black text-black print:text-black">
                            الوحدة
                          </th>
                          <th className="py-2.5 px-3 text-center w-16 print:w-[7%] border border-black font-black text-black print:text-black font-mono">
                            الشد
                          </th>
                          <th className="py-2.5 px-3.5 text-left w-24 print:w-[10%] border border-black font-black text-black print:text-black font-mono">
                            سعر الوحدة
                          </th>
                          <th className="py-2.5 px-3 text-left w-20 print:w-[8%] border border-black font-black text-black print:text-black font-mono">
                            الخصم
                          </th>
                          <th className="py-2.5 px-3.5 text-left w-28 print:w-[12%] border border-black font-black text-black print:text-black font-mono">
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {processedLines.map((line) => {
                          const unitsPerPack = Number(line.unitsPerPack) || 1;
                          const hasDiscount = line.lineDiscAmt > 0;

                          return (
                            <tr key={line.id || line.idx} className="border-b border-black">
                              <td className="py-2 px-2 text-center font-black font-mono text-black border border-black print:text-black">
                                {line.idx}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono font-black text-black border border-black print:text-black">
                                {line.itemSku || line.barcode || '-'}
                              </td>
                              <td className="py-2 px-3 font-black text-black border border-black print:text-black">
                                <div className="font-black text-black leading-snug">{line.itemNameAr}</div>
                                {line.notes && <div className="text-xs font-bold text-black mt-0.5">{line.notes}</div>}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono font-black text-black border border-black print:text-black">
                                {line.quantity}
                              </td>
                              <td className="py-2 px-2.5 text-center font-black text-black border border-black print:text-black">
                                {line.unit || 'حبة'}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono font-black text-black border border-black print:text-black">
                                {unitsPerPack > 1 ? `شد ${unitsPerPack}` : '1'}
                              </td>
                              <td className="py-2 px-2.5 text-left font-mono font-black text-black border border-black print:text-black">
                                {formattedCurrency(line.unitPrice)}
                              </td>
                              <td className="py-2 px-2.5 text-left font-mono font-black text-black border border-black print:text-black">
                                {hasDiscount ? `-${formattedCurrency(line.lineDiscAmt)}` : '0.00'}
                              </td>
                              <td className="py-2 px-3 text-left font-mono font-black text-black border border-black print:text-black">
                                {formattedCurrency(line.lineNet)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-black font-black bg-neutral-50 print:bg-white text-xs sm:text-sm text-black">
                        <tr className="border-t-2 border-black">
                          <td colSpan={3} className="py-2.5 px-3 text-right font-black text-black border border-black">
                            عدد الأصناف: <span className="font-mono font-black">{processedLines.length}</span> | إجمالي الكمية:{' '}
                            <span className="font-mono font-black">
                              {processedLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}
                            </span>
                          </td>
                          <td colSpan={4} className="py-2.5 px-3 text-left font-black text-black border border-black">
                            المجموع قبل الخصومات:
                          </td>
                          <td colSpan={2} className="py-2.5 px-3 text-left font-mono font-black text-black border border-black text-sm sm:text-base">
                            {formattedCurrency(grossItemsTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary Totals & Tafqeet Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch pt-2 print:pt-1.5 print:gap-2.5 print-avoid-break">
                    {/* Right: Arabic Tafqeet Box & Delivery Notes */}
                    <div className="space-y-3 flex flex-col justify-between print:space-y-1.5">
                      <div className="p-4 bg-white rounded-xl border-2 border-black space-y-1.5 print:p-2">
                        <span className="text-xs font-black text-black flex items-center gap-1.5 print:text-[10px]">
                          <CheckCircle2 className="w-4 h-4 text-black print:w-3.5 print:h-3.5" />
                          المبلغ تفقيطاً بالكلمات:
                        </span>
                        <p className="text-xs sm:text-sm font-black text-black leading-relaxed bg-white p-3 rounded-lg border-2 border-black print:p-1.5 print:text-[10px]">
                          {tafqeetCurrency(finalGrandTotal, activeCompany.functionalCurrency || 'KWD')}
                        </p>
                      </div>

                      {inv.notes && (
                        <div className="p-3 bg-white rounded-xl border-2 border-black text-xs print:p-1.5 print:rounded-lg print:text-[9.5px]">
                          <span className="font-black text-black block mb-0.5">ملاحظات الفاتورة:</span>
                          <p className="text-black font-bold leading-relaxed">{inv.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Left: Financial Calculations Card */}
                    <div className="bg-white border-2 border-black p-4 rounded-xl space-y-2 text-xs sm:text-sm print:p-2 print:space-y-1 print:border-2 print:border-black">
                      <div className="flex justify-between items-center text-black font-bold">
                        <span>إجمالي قيمة الأصناف:</span>
                        <span className="font-black font-mono text-black text-sm print:text-[11px]">
                          {formattedCurrency(grossItemsTotal)}
                        </span>
                      </div>

                      {totalAllDiscounts > 0 && (
                        <div className="flex justify-between items-center text-black font-black border-t-2 border-black pt-1.5 print:pt-1">
                          <span>إجمالي الخصومات الممنوحة:</span>
                          <span className="font-mono text-sm print:text-[11px]">
                            -{formattedCurrency(totalAllDiscounts)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-sm sm:text-base font-black text-black pt-2 border-t-2 border-black bg-neutral-50 print:bg-white p-2.5 rounded-lg border-2 border-black">
                        <span>صافي القيمة المستحقة:</span>
                        <span className="font-mono text-black text-lg font-black">
                          {formattedCurrency(finalGrandTotal)}
                        </span>
                      </div>

                      {isCash ? (
                        <div className="flex justify-between items-center text-black font-black pt-1 text-xs sm:text-sm">
                          <span>حالة السداد:</span>
                          <span className="font-black">مسدد بالكامل نقداً (كاش)</span>
                        </div>
                      ) : (
                        paid > 0 && (
                          <div className="flex justify-between items-center text-black font-bold pt-1 text-xs sm:text-sm">
                            <span>المدفوع:</span>
                            <span className="font-mono font-black text-black">{formattedCurrency(paid)}</span>
                          </div>
                        )
                      )}

                      {!isCash && due > 0 && (
                        <div className="flex justify-between items-center text-black font-black text-xs sm:text-sm pt-1">
                          <span>المبلغ المتبقي المستحق (آجل):</span>
                          <span className="font-mono font-black text-black text-sm">
                            {formattedCurrency(due)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Classic Professional Footer: Receiver Name, Receiver Signature, and Company Stamp */}
                  <div className="pt-6 border-t-2 border-black grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm print:pt-2 print:gap-2.5 print:grid-cols-3 print:text-[10px] print-avoid-break">
                    {/* 1. اسم المستلم */}
                    <div className="border-2 border-black rounded-xl p-4 bg-white space-y-2 print:p-2 print:space-y-1">
                      <div className="font-black text-black border-b-2 border-black pb-1.5 text-xs sm:text-sm">
                        اسم المستلم:
                      </div>
                      <div className="text-xs sm:text-sm pt-1 text-black font-black min-h-[35px] flex items-center">
                        {inv.receiverName || inv.entityNameAr || '...................................................'}
                      </div>
                    </div>

                    {/* 2. توقيع المستلم */}
                    <div className="border-2 border-black rounded-xl p-4 bg-white space-y-2 print:p-2 print:space-y-1">
                      <div className="font-black text-black border-b-2 border-black pb-1.5 text-xs sm:text-sm">
                        توقيع المستلم:
                      </div>
                      <div className="text-xs pt-1 text-black font-bold space-y-1.5">
                        <p>التوقيع: .......................................</p>
                        <p>التاريخ: ...... / ...... / 2026</p>
                      </div>
                    </div>

                    {/* 3. ختم وتوقيع المنشأة النشطة */}
                    <div className="border-2 border-black rounded-xl p-4 bg-white space-y-2 text-center print:p-2 print:space-y-1">
                      <div
                        className="font-black text-black border-b-2 border-black pb-1.5 text-xs sm:text-sm truncate"
                        title={activeCompany.nameAr || activeCompany.headerTitle}
                      >
                        {activeCompany.nameAr || activeCompany.headerTitle || 'ختم واعتماد المنشأة'}
                      </div>
                      <div className="text-xs pt-1 text-black font-bold space-y-1.5">
                        <p>الختم والتوقيع: .................................</p>
                        <p className="text-[10px] text-black font-mono font-black uppercase truncate">
                          {activeCompany.nameEn || activeCompany.tradeName || 'AUTHORIZED SIGNATURE & STAMP'}
                        </p>
                        {(activeCompany.generalManager || activeCompany.financialManager) && (
                          <p className="text-[9.5px] text-black font-bold truncate">
                            {activeCompany.generalManager || activeCompany.financialManager}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 2. VOUCHER VIEW */}
            {/* ========================================================================= */}
            {documentType === 'VOUCHER' && (() => {
              const v = data as PaymentVoucher;
              return (
                <div className="space-y-6 pt-4">
                  <div className="border-2 border-black p-6 rounded-2xl space-y-4 text-xs sm:text-sm bg-[#FAF9F6]">
                    <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
                      <span className="text-sm font-bold text-neutral-700">
                        {v.type === 'RECEIPT' ? 'استلمنا من السيد/الشركة:' : 'صرفنا إلى السيد/الشركة:'}
                      </span>
                      <span className="text-base sm:text-lg font-black underline text-black">{v.entityNameAr}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
                      <span className="text-sm font-bold text-neutral-700">مبلغ وقدره:</span>
                      <span className="text-lg sm:text-xl font-mono font-black bg-white px-4 py-1.5 rounded-lg border-2 border-black text-emerald-900">
                        {formattedCurrency(v.amount)}
                      </span>
                    </div>

                    {/* Tafqeet Row */}
                    <div className="p-3.5 bg-white rounded-xl border border-neutral-300">
                      <span className="text-xs font-bold text-neutral-600 block mb-0.5">المبلغ تفقيطاً بالكلمات:</span>
                      <p className="text-xs sm:text-sm font-serif font-black text-black">
                        {tafqeetCurrency(v.amount, activeCompany.functionalCurrency)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b border-neutral-300 pb-3">
                      <div>
                        <span className="font-bold block text-neutral-600 text-xs">طريقة الدفع:</span>
                        <span className="font-bold text-black">{v.paymentMethod === 'BANK' ? 'تحويل بنكي / شيك' : 'نقداً من الخزينة'}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-neutral-600 text-xs">المرجع / رقم الشيك:</span>
                        <span className="font-mono font-bold text-black">{v.reference || '-'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold block text-neutral-600 text-xs mb-1">وذلك عن (البيان):</span>
                      <p className="p-3 bg-white rounded-lg border border-neutral-200 font-semibold leading-relaxed">
                        {v.notes || 'سداد دفعة حساب فاتورة / سند رسمي'}
                      </p>
                    </div>
                  </div>

                  {/* Signatures for Voucher */}
                  <div className="pt-8 border-t-2 border-neutral-300 grid grid-cols-3 gap-6 text-center text-xs">
                    <div className="space-y-6">
                      <span className="font-bold block text-neutral-800">المسلّم / المحاسب</span>
                      <div className="border-b border-dashed border-neutral-400 w-36 mx-auto"></div>
                      <span className="text-[11px] text-neutral-500">التوقيع</span>
                    </div>
                    <div className="space-y-6">
                      <span className="font-bold block text-neutral-800">ختم الاعتماد</span>
                      <div className="w-20 h-20 border-2 border-dashed border-neutral-400 rounded-full mx-auto flex flex-col items-center justify-center p-1 text-[9px] text-neutral-600 font-bold leading-tight">
                        <span>ختم اعتماد</span>
                        <span className="truncate max-w-[65px] text-neutral-800">{activeCompany.nameAr || 'الشركة'}</span>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <span className="font-bold block text-neutral-800">المستلم</span>
                      <div className="border-b border-dashed border-neutral-400 w-36 mx-auto"></div>
                      <span className="text-[11px] text-neutral-500">التوقيع والتاريخ</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 3. JOURNAL PRINT VIEW */}
            {/* ========================================================================= */}
            {documentType === 'JOURNAL' && (() => {
              const jv = data as JournalEntry;
              return (
                <div className="space-y-6 pt-4">
                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-neutral-300 text-xs sm:text-sm grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-neutral-600 block text-xs">رقم القيد اليومي:</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-black">{jv.entryNumber}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600 block text-xs">مرجع ومستند القيد:</span>
                      <span className="font-mono font-bold text-black">{jv.reference || 'يدوي'}</span>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm bg-neutral-100 p-3.5 rounded-xl border border-neutral-300">
                    <span className="font-bold block mb-1 text-xs text-neutral-700">البيان الشامل للقيد:</span>
                    <p className="font-bold text-neutral-900 leading-relaxed">{jv.description}</p>
                  </div>

                  <table className="w-full text-xs sm:text-sm text-right border-collapse border border-neutral-400">
                    <thead>
                      <tr className="bg-neutral-900 text-white font-bold">
                        <th className="p-3 border border-neutral-400">رقم الحساب</th>
                        <th className="p-3 border border-neutral-400">اسم الحساب والطرف الفرعي</th>
                        <th className="p-3 border border-neutral-400">الشرح / البيان التفصيلي</th>
                        <th className="p-3 border border-neutral-400 text-left">مدين (Debit)</th>
                        <th className="p-3 border border-neutral-400 text-left">دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-300">
                      {jv.lines.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-neutral-50">
                          <td className="p-3 border border-neutral-300 font-mono font-bold">{line.accountCode}</td>
                          <td className="p-3 border border-neutral-300 font-bold">
                            <div>{line.accountNameAr}</div>
                            {line.entityNameAr && (
                              <span className="inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                                {line.entityType === 'SUPPLIER' ? 'المورد' : 'العميل'}: {line.entityNameAr}
                              </span>
                            )}
                          </td>
                          <td className="p-3 border border-neutral-300 text-neutral-700">{line.memo || '-'}</td>
                          <td className="p-3 border border-neutral-300 text-left font-mono font-bold text-emerald-800">
                            {line.debit > 0 ? formattedCurrency(line.debit) : '-'}
                          </td>
                          <td className="p-3 border border-neutral-300 text-left font-mono font-bold text-rose-800">
                            {line.credit > 0 ? formattedCurrency(line.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-100 font-extrabold text-sm">
                        <td colSpan={3} className="p-3 border border-neutral-400 text-left">الإجمالي المتوازن:</td>
                        <td className="p-3 border border-neutral-400 text-left font-mono text-emerald-900 font-black">{formattedCurrency(jv.totalDebit)}</td>
                        <td className="p-3 border border-neutral-400 text-left font-mono text-rose-900 font-black">{formattedCurrency(jv.totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Tafqeet Box */}
                  <div className="p-3.5 bg-neutral-100 rounded-xl border border-neutral-300">
                    <span className="text-xs font-bold text-neutral-600 block mb-0.5">إجمالي قيمة القيد تفقيطاً بالكلمات:</span>
                    <p className="text-xs sm:text-sm font-serif font-black text-black">
                      {tafqeetCurrency(jv.totalDebit, activeCompany.functionalCurrency)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 4. STATEMENT PRINT VIEW */}
            {/* ========================================================================= */}
            {documentType === 'STATEMENT' && (() => {
              const stmt = data;
              const cust = stmt.customer || stmt.supplier || {};
              const isCust = stmt.entityType !== 'SUPPLIER';
              return (
                <div className="space-y-6 pt-4">
                  {/* Customer / Supplier Meta */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#FAF9F6] p-4.5 rounded-xl border border-neutral-300 text-xs sm:text-sm">
                    <div>
                      <span className="text-neutral-600 block mb-0.5 text-xs">اسم {isCust ? 'العميل / الجمعية' : 'المورد'}:</span>
                      <span className="font-extrabold text-sm sm:text-base text-black">{cust.nameAr || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600 block mb-0.5 text-xs">الكود التعريفي:</span>
                      <span className="font-bold text-black font-mono">{cust.code || '-'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600 block mb-0.5 text-xs">الهاتف:</span>
                      <span className="font-bold text-black font-mono">{cust.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600 block mb-0.5 text-xs">المحافظة / المدينة:</span>
                      <span className="font-bold text-black">{cust.governorate || cust.city || 'الكويت'}</span>
                    </div>
                  </div>

                  {/* Account Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 text-xs sm:text-sm font-bold">
                    <div className="p-3.5 bg-neutral-100 rounded-xl border border-neutral-300">
                      <span className="text-neutral-600 block font-normal text-xs">الرصيد الافتتاحي:</span>
                      <span className="text-sm sm:text-base font-mono text-black font-black">{formattedCurrency(stmt.openingBalance || 0)}</span>
                    </div>
                    <div className="p-3.5 bg-neutral-100 rounded-xl border border-neutral-300">
                      <span className="text-neutral-600 block font-normal text-xs">إجمالي حركات المدين:</span>
                      <span className="text-sm sm:text-base font-mono text-amber-900 font-black">{formattedCurrency(stmt.totalInvoiced || stmt.totalPeriodDebit || 0)}</span>
                    </div>
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300">
                      <span className="text-emerald-800 block font-normal text-xs">الرصيد النهائي المستحق:</span>
                      <span className="text-base sm:text-lg font-mono font-black text-emerald-950">{formattedCurrency(stmt.currentBalance || stmt.closingBalance || 0)}</span>
                    </div>
                  </div>

                  {/* Statement Detailed Table */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-xs sm:text-sm text-right border-collapse border border-neutral-400 print:table-fixed print:w-full print:border print:border-black">
                      <thead>
                        <tr className="bg-neutral-900 text-white font-bold print:text-[10px]">
                          <th className="p-3 border border-neutral-400 print:w-[11%] print:border print:border-black print:py-1.5 print:px-1 text-center">التاريخ</th>
                          <th className="p-3 border border-neutral-400 print:w-[12%] print:border print:border-black print:py-1.5 print:px-1 text-center">نوع الحركة</th>
                          <th className="p-3 border border-neutral-400 print:w-[13%] print:border print:border-black print:py-1.5 print:px-1 text-center font-mono">رقم المرجع / الفاتورة</th>
                          <th className="p-3 border border-neutral-400 print:w-[32%] print:border print:border-black print:py-1.5 print:px-1.5 text-right">البيان التفصيلي</th>
                          <th className="p-3 border border-neutral-400 text-left text-emerald-300 print:text-black print:w-[10%] print:border print:border-black print:py-1.5 print:px-1 font-mono">مدين (Debit)</th>
                          <th className="p-3 border border-neutral-400 text-left text-rose-300 print:text-black print:w-[10%] print:border print:border-black print:py-1.5 print:px-1 font-mono">دائن (Credit)</th>
                          <th className="p-3 border border-neutral-400 text-left font-black print:w-[12%] print:border print:border-black print:py-1.5 print:px-1 font-mono">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-300 print:divide-neutral-400">
                        {(stmt.statementLines || stmt.transactions || []).map((line: any, idx: number) => (
                          <tr key={line.id || idx} className={`hover:bg-neutral-50 ${line.type === 'OPENING' ? 'bg-amber-50/70 font-bold print:bg-neutral-100' : ''}`}>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 font-mono whitespace-nowrap text-center print:py-1.5 print:px-1 print:border print:border-black print:text-[9.5px] print:whitespace-normal">{line.date}</td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 font-bold text-neutral-800 whitespace-nowrap text-center print:py-1.5 print:px-1 print:border print:border-black print:text-[9.5px] print:text-black print:whitespace-normal">{line.typeAr || line.docTypeLabel}</td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 font-mono font-bold text-amber-900 whitespace-nowrap text-center print:py-1.5 print:px-1 print:border print:border-black print:text-[9.5px] print:text-black print:whitespace-normal">{line.refNo || line.docNumber}</td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 text-neutral-800 print:py-1.5 print:px-1.5 print:border print:border-black print:text-[9.5px] print:text-black">{line.description}</td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 text-left font-mono font-bold text-emerald-800 whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-[9.5px] print:text-black">
                              {line.debit > 0 ? formattedCurrency(line.debit) : '-'}
                            </td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 text-left font-mono font-bold text-rose-800 whitespace-nowrap print:py-1.5 print:px-1 print:border print:border-black print:text-[9.5px] print:text-black">
                              {line.credit > 0 ? formattedCurrency(line.credit) : '-'}
                            </td>
                            <td className="p-2.5 sm:p-3 border border-neutral-300 text-left font-mono font-black bg-neutral-50 whitespace-nowrap text-sm print:py-1.5 print:px-1 print:border print:border-black print:bg-transparent print:text-[10px] print:text-black">
                              {formattedCurrency(line.runningBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-900 text-white font-extrabold print:bg-neutral-100 print:text-black print:text-[10px]">
                          <td colSpan={4} className="p-3 border border-neutral-400 text-left text-xs sm:text-sm print:py-1.5 print:px-1.5 print:border print:border-black">الرصيد الختامي المستحق:</td>
                          <td colSpan={3} className="p-3 border border-neutral-400 text-left text-sm sm:text-base font-mono text-amber-300 font-black print:py-1.5 print:px-1 print:border print:border-black print:text-black print:text-[11px]">
                            {formattedCurrency(stmt.currentBalance || stmt.closingBalance || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Tafqeet Box */}
                  <div className="p-3.5 bg-neutral-100 rounded-xl border border-neutral-300 print:p-2 print:bg-white print:border print:border-black print:rounded-lg print-avoid-break">
                    <span className="text-xs font-bold text-neutral-600 block mb-0.5 print:text-[10px] print:text-black">الرصيد المستحق تفقيطاً بالكلمات:</span>
                    <p className="text-xs sm:text-sm font-serif font-black text-black print:text-[10px]">
                      {tafqeetCurrency(stmt.currentBalance || stmt.closingBalance || 0, activeCompany.functionalCurrency)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Bottom Document Footnote */}
            <div className="text-center text-xs text-neutral-600 pt-6 border-t-2 border-neutral-300 mt-6 font-medium">
              {activeCompany.footerNotes || activeCompany.headerNotes || `مستند تجاري ومالي رسمي معتمد • ${activeCompany.nameAr || 'لوجيكس ERP'} • ${activeCompany.country || 'دولة الكويت'}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
