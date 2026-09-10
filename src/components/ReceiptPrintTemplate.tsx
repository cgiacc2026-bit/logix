import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Invoice, CompanyProfile } from '../types.js';
import { Printer, X, CheckCircle2, QrCode, Building2, Phone, MapPin, Receipt, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../utils/formatters.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';

interface ReceiptPrintTemplateProps {
  invoice: Invoice;
  company: CompanyProfile | null;
  cashierName?: string;
  cashTendered?: number;
  changeDue?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'CREDIT' | string;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const ReceiptPrintTemplate: React.FC<ReceiptPrintTemplateProps> = ({
  invoice,
  company,
  cashierName = 'كاشير نقطة البيع',
  cashTendered,
  changeDue,
  paymentMethod,
  onClose,
  autoPrint = false,
}) => {
  const activeCompany = resolveActiveCompany(company, invoice.companyId || (invoice as any)?.company_id);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const effectiveCurrency = activeCompany.functionalCurrency || 'KWD';
  const formatted = (val: number) => formatCurrency(val, effectiveCurrency);

  const effectivePaymentMethod = paymentMethod || invoice.paymentTerms || (invoice.paidAmount >= invoice.grandTotal ? 'CASH' : 'CREDIT');

  const getPaymentMethodLabel = (m: string) => {
    switch (m) {
      case 'CASH':
        return 'نقدي (كاش)';
      case 'CARD':
        return 'بطاقة بنكية / K-Net';
      case 'CREDIT':
        return 'آجل (ذمم مدينة)';
      default:
        return m;
    }
  };

  useEffect(() => {
    // Generate standard QR code for POS receipt
    const qrText = [
      `المنشأة: ${activeCompany.nameAr || activeCompany.headerTitle || 'المتجر المعتمد'}`,
      `س.ت: ${activeCompany.crNumber || activeCompany.commercialRegNumber || '-'}`,
      activeCompany.taxNumber ? `الرقم الضريبي: ${activeCompany.taxNumber}` : '',
      `إيصال رقم: ${invoice.invoiceNumber}`,
      `التاريخ: ${invoice.date}`,
      `الإجمالي: ${formatted(invoice.grandTotal)}`,
    ].filter(Boolean).join('\n');

    QRCode.toDataURL(qrText, {
      width: 140,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Error creating receipt QR', err));

    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [invoice, activeCompany, autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  // Calculate gross line totals
  const subtotalGross = (invoice.lines || []).reduce(
    (sum, l) => sum + (l.quantity * l.unitPrice),
    0
  );
  const discountsTotal = invoice.discountTotal || 0;
  const grandTotal = invoice.grandTotal || (subtotalGross - discountsTotal);

  const tendered = cashTendered !== undefined ? cashTendered : (effectivePaymentMethod === 'CASH' ? grandTotal : 0);
  const change = changeDue !== undefined ? changeDue : Math.max(0, tendered - grandTotal);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-900 my-auto flex flex-col">
        {/* Top Dialog Action Bar (Hidden on Print) */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-400" />
            <span className="text-xs sm:text-sm font-black">
              معاينة وطباعة إيصال نقطة البيع POS (80mm)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الإيصال الحراري</span>
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

        {/* Receipt Scrollable Body */}
        <div className="p-4 overflow-y-auto max-h-[82vh] bg-slate-200 flex justify-center print:p-0 print:m-0 print:bg-white print:max-h-none">
          {/* Thermal Receipt Paper 80mm (approx 300-340px) */}
          <div
            id="pos-thermal-receipt"
            className="w-full max-w-[340px] bg-white p-4 shadow-xl border border-slate-300 rounded-lg text-slate-900 font-sans print:shadow-none print:border-none print:w-full print:max-w-none print:p-2 text-xs leading-tight"
          >
            {/* Header: Company Profile */}
            <div className="text-center space-y-1 pb-2.5 border-b-2 border-dashed border-slate-400">
              {activeCompany.logoUrl && (
                <div className="flex justify-center mb-1">
                  <img
                    src={activeCompany.logoUrl}
                    alt="Company Logo"
                    className="h-12 w-auto object-contain max-w-[120px]"
                  />
                </div>
              )}
              <h2 className="font-black text-base text-slate-950 tracking-tight">
                {activeCompany.nameAr || activeCompany.headerTitle || 'المتجر المعتمد'}
              </h2>
              {activeCompany.nameEn && (
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider font-mono">
                  {activeCompany.nameEn}
                </p>
              )}
              {activeCompany.commercialRegNumber || activeCompany.crNumber ? (
                <p className="text-[10px] text-slate-600 font-mono">
                  س.ت: {activeCompany.crNumber || activeCompany.commercialRegNumber}
                </p>
              ) : null}
              {activeCompany.taxNumber && (
                <p className="text-[10px] text-slate-600 font-mono">
                  الرقم الضريبي: {activeCompany.taxNumber}
                </p>
              )}
              {activeCompany.phone && (
                <p className="text-[10px] text-slate-600 font-mono flex items-center justify-center gap-1">
                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                  <span>{activeCompany.phone}</span>
                </p>
              )}
              {activeCompany.city && (
                <p className="text-[10px] text-slate-500">
                  {activeCompany.city} {activeCompany.district ? ` - ${activeCompany.district}` : ''}
                </p>
              )}
              <div className="pt-1.5">
                <span className="inline-block px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black tracking-wider">
                  إيصال مبيعات كاشير معتمد
                </span>
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">رقم الفاتورة:</span>
                <span className="font-bold text-slate-950">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">التاريخ والوقت:</span>
                <span>{invoice.date} {new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">الكاشير:</span>
                <span className="font-bold">{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">العميل:</span>
                <span className="font-bold truncate max-w-[190px]">{invoice.entityNameAr || 'عميل كاش نقدي'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">طريقة السداد:</span>
                <span className="font-bold text-slate-900">
                  {getPaymentMethodLabel(effectivePaymentMethod)}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-2 border-b-2 border-dashed border-slate-400">
              <div className="grid grid-cols-12 text-[10px] font-black text-slate-800 pb-1 border-b border-slate-200">
                <span className="col-span-6 text-right">الصنف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-4 text-left">الإجمالي</span>
              </div>

              <div className="divide-y divide-slate-100 py-1 space-y-1">
                {(invoice.lines || []).map((line, idx) => {
                  const lineNet = line.total || (line.quantity * line.unitPrice);
                  return (
                    <div key={line.id || idx} className="pt-1 text-[11px]">
                      <div className="flex justify-between font-bold text-slate-950">
                        <span className="truncate max-w-[210px]">{line.itemNameAr}</span>
                        <span className="font-mono">{formatted(lineNet)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono pr-1">
                        <span>
                          {line.quantity} {line.unit || 'حبة'} × {formatted(line.unitPrice)}
                        </span>
                        {line.discountAmount && line.discountAmount > 0 ? (
                          <span className="text-rose-600">
                            خصم: {formatted(line.discountAmount)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2.5 border-b-2 border-dashed border-slate-400 space-y-1 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{formatted(subtotalGross)}</span>
              </div>

              {discountsTotal > 0 && (
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>إجمالي الخصم التجاري:</span>
                  <span className="font-mono">-{formatted(discountsTotal)}</span>
                </div>
              )}

              {invoice.vatTotal > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>ضريبة القيمة المضافة:</span>
                  <span className="font-mono">+{formatted(invoice.vatTotal)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-300 text-sm font-black text-slate-950">
                <span>الصافي المستحق:</span>
                <span className="text-base font-mono font-black text-emerald-700">
                  {formatted(grandTotal)}
                </span>
              </div>

              {/* Cash tendered & change */}
              {effectivePaymentMethod === 'CASH' && tendered > 0 && (
                <div className="pt-1.5 border-t border-slate-200 text-[11px] space-y-0.5 font-mono">
                  <div className="flex justify-between text-slate-700">
                    <span>المبلغ المستلم (نقداً):</span>
                    <span className="font-bold">{formatted(tendered)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>الباقي للمشتري:</span>
                    <span className="font-black">{formatted(change)}</span>
                  </div>
                </div>
              )}

              {/* Tafqeet in words */}
              <div className="text-[10px] text-slate-600 pt-1.5 border-t border-slate-200 text-center font-medium">
                فقط {tafqeetCurrency(grandTotal, effectiveCurrency)}
              </div>
            </div>

            {/* QR Code & Digital Seal */}
            <div className="py-3 text-center space-y-2">
              {qrCodeDataUrl && (
                <div className="flex justify-center">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code"
                    className="w-24 h-24 object-contain border border-slate-200 p-0.5 rounded"
                  />
                </div>
              )}
              
              <div className="text-[9.5px] text-slate-500 font-mono">
                فاتورة ضريبية مبسطة موثقة إلكترونياً
              </div>

              {/* Stamp of active company */}
              <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-800">
                <div className="font-black flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{activeCompany.nameAr || activeCompany.headerTitle || 'المتجر المعتمد'}</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  شكراً لتعاملكم معنا - نتشرف بزيارتكم دائماً
                </div>
              </div>

              {/* Company Custom Footer */}
              {(activeCompany.footerNotes || activeCompany.headerNotes) && (
                <p className="text-[9px] text-slate-500 pt-1">
                  {activeCompany.footerNotes || activeCompany.headerNotes}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
