import React, { useState } from 'react';
import {
  Quotation,
  QuotationLine,
  Customer,
  SalesRep,
  InventoryItem,
  CompanyProfile,
  QuotationStatus,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { DataService } from '../services/dataService.ts';
import { CustomerSearchCombobox } from './CustomerSearchCombobox.tsx';
import { InvoiceItemSearchCombobox } from './InvoiceItemSearchCombobox.tsx';
import {
  FileText,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  Send,
  XCircle,
  Clock,
  ArrowRightLeft,
  Factory,
  ShoppingBag,
  Trash2,
  Edit2,
  Calendar,
  User,
  DollarSign,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface QuotationsViewProps {
  quotations: Quotation[];
  customers: Customer[];
  salesReps: SalesRep[];
  inventory: InventoryItem[];
  company: CompanyProfile | null;
  currency: string;
  onRefreshAll: () => Promise<void> | void;
  onNavigateTab?: (tab: string) => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({
  quotations,
  customers,
  salesReps,
  inventory,
  company,
  currency,
  onRefreshAll,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form State for New / Edit Quotation
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSalesRepId, setSelectedSalesRepId] = useState('');
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuotationLine[]>([]);

  // Line Item Input State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerNameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.salesRepName && q.salesRepName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddItem = () => {
    if (!selectedItem) return;
    const price = itemPrice > 0 ? itemPrice : selectedItem.salePrice;
    const subtotal = itemQty * price;

    const newLine: QuotationLine = {
      id: 'qline-' + Math.random().toString(36).substr(2, 7),
      itemId: selectedItem.id,
      itemSku: selectedItem.sku,
      itemNameAr: selectedItem.nameAr,
      unit: selectedItem.unit || 'حبة',
      unitsPerPack: selectedItem.unitsPerPack || 1,
      quantity: itemQty,
      unitPrice: price,
      subtotal,
      vatRate: company?.vatRate || 0,
      vatAmount: company?.vatRate ? (subtotal * company.vatRate) / 100 : 0,
      total: company?.vatRate ? subtotal + (subtotal * company.vatRate) / 100 : subtotal,
    };

    setLines((prev) => [...prev, newLine]);
    setSelectedItem(null);
    setItemQty(1);
    setItemPrice(0);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const formSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const formVatTotal = lines.reduce((s, l) => s + l.vatAmount, 0);
  const formGrandTotal = formSubtotal + formVatTotal;

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('يرجى اختيار العميل أولاً');
      return;
    }
    if (lines.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل في عرض السعر');
      return;
    }

    const cust = customers.find((c) => c.id === selectedCustomerId);
    const rep = salesReps.find((r) => r.id === selectedSalesRepId);

    const newQuotation: Quotation = {
      id: 'quo-' + Math.random().toString(36).substr(2, 9),
      quotationNumber: `QUO-2026-${String(quotations.length + 1).padStart(4, '0')}`,
      date: quotationDate,
      expiryDate,
      customerId: selectedCustomerId,
      customerNameAr: cust ? cust.nameAr : 'عميل غير محدد',
      salesRepId: rep ? rep.id : undefined,
      salesRepName: rep ? rep.nameAr : undefined,
      status: 'SENT',
      lines,
      subtotal: formSubtotal,
      vatTotal: formVatTotal,
      discountTotal: 0,
      grandTotal: formGrandTotal,
      notes,
      companyId: company?.id,
      createdAt: new Date().toISOString(),
    };

    await DataService.saveQuotation(newQuotation);
    setIsModalOpen(false);
    setLines([]);
    setNotes('');
    setActionSuccessMsg('تم إنشاء وتحرير عرض السعر بنجاح');
    await onRefreshAll();
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Convert Quotation directly to Approved Sales Invoice (1-Click)
  const handleConvertToInvoice = async (quotationId: string) => {
    if (!confirm('هل تريد تحويل عرض السعر هذا مباشرة إلى فاتورة مبيعات معتمدة وخصم المخزون القائم؟')) {
      return;
    }
    setIsConverting(true);
    try {
      const result = await DataService.convertQuotationToInvoice(quotationId, 'CASH');
      setActionSuccessMsg(
        `تم تحويل عرض السعر بضغطة زر إلى فاتورة مبيعات معتمدة رقم (${result.invoice.invoiceNumber}) بنجاح!`
      );
      await onRefreshAll();
      if (onNavigateTab) {
        setTimeout(() => onNavigateTab('invoices'), 1200);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء التحويل: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsConverting(false);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Convert Quotation directly to Production/Work Order (1-Click)
  const handleConvertToProduction = async (quotationId: string) => {
    if (!confirm('هل تريد تحويل عرض السعر هذا مباشرة إلى أمر توريد وتصنيع لتشغيل خطوط الإنتاج؟')) {
      return;
    }
    setIsConverting(true);
    try {
      const result = await DataService.convertQuotationToProductionOrder(quotationId);
      setActionSuccessMsg(
        `تم تحويل عرض السعر بضغطة زر إلى أمر إنتاج رقم (${result.productionOrder.orderNumber}) بنجاح!`
      );
      await onRefreshAll();
      if (onNavigateTab) {
        setTimeout(() => onNavigateTab('production'), 1200);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء التحويل: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsConverting(false);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-0.5 text-xs font-bold bg-slate-700/60 text-slate-300 rounded-full border border-slate-600">مسودة</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">مرسل للعميل</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30">مقبول</span>;
      case 'CONVERTED_INVOICE':
        return <span className="px-2 py-0.5 text-xs font-bold bg-emerald-600 text-white rounded-full shadow-xs flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> فاتورة مبيعات معتمدة</span>;
      case 'CONVERTED_PRODUCTION':
        return <span className="px-2 py-0.5 text-xs font-bold bg-amber-600 text-white rounded-full shadow-xs flex items-center gap-1"><Factory className="w-3 h-3" /> أمر توريد وتصنيع</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-500/20 text-rose-300 rounded-full border border-rose-400/30">مرفوض</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-[#0F2942] to-[#1E3E62] border border-blue-500/30 rounded-2xl p-5 shadow-xl text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-cyan-300 border border-blue-400/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                إدارة عروض الأسعار والتحويل المباشر
              </h1>
              <p className="text-xs text-slate-300">
                إنشاء وتحرير عروض الأسعار مع إمكانية تحويلها بضغطة زر واحدة إلى فواتير مبيعات معتمدة أو أوامر إنتاج
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء عرض سعر جديد</span>
        </button>
      </div>

      {/* Action Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-white space-y-1">
          <span className="text-slate-400 text-[11px] font-bold">إجمالي عروض الأسعار</span>
          <div className="text-xl font-black text-cyan-300">{quotations.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-white space-y-1">
          <span className="text-slate-400 text-[11px] font-bold">المتحولة إلى فواتير مبيعات</span>
          <div className="text-xl font-black text-emerald-400">
            {quotations.filter((q) => q.status === 'CONVERTED_INVOICE').length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-white space-y-1">
          <span className="text-slate-400 text-[11px] font-bold">المتحولة إلى أوامر تصنيع</span>
          <div className="text-xl font-black text-amber-400">
            {quotations.filter((q) => q.status === 'CONVERTED_PRODUCTION').length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-white space-y-1">
          <span className="text-slate-400 text-[11px] font-bold">إجمالي القيمة التقديرية</span>
          <div className="text-xl font-black text-white">
            {formatCurrency(quotations.reduce((s, q) => s + q.grandTotal, 0), currency)}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم عرض السعر، اسم العميل، أو المندوب..."
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="SENT">مرسل للعميل</option>
            <option value="ACCEPTED">مقبول</option>
            <option value="CONVERTED_INVOICE">متحول إلى فاتورة</option>
            <option value="CONVERTED_PRODUCTION">متحول إلى أمر إنتاج</option>
          </select>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-200">
            <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="p-3">رقم عرض السعر</th>
                <th className="p-3">العميل</th>
                <th className="p-3">المندوب المسؤول</th>
                <th className="p-3">تاريخ العرض</th>
                <th className="p-3">تاريخ الانتهاء</th>
                <th className="p-3">الإجمالي العام</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">التحويل المباشر (1-Click)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-semibold">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد عروض أسعار مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-300">{q.quotationNumber}</td>
                    <td className="p-3 font-bold text-white">{q.customerNameAr}</td>
                    <td className="p-3 text-slate-300">{q.salesRepName || 'غير محدد'}</td>
                    <td className="p-3 text-slate-400 font-mono">{q.date}</td>
                    <td className="p-3 text-slate-400 font-mono">{q.expiryDate}</td>
                    <td className="p-3 font-bold text-emerald-400">
                      {formatCurrency(q.grandTotal, currency)}
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(q.status)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {q.status !== 'CONVERTED_INVOICE' && (
                          <button
                            disabled={isConverting}
                            onClick={() => handleConvertToInvoice(q.id)}
                            title="تحويل مباشر إلى فاتورة مبيعات معتمدة"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>تحويل لفاتورة</span>
                          </button>
                        )}

                        {q.status !== 'CONVERTED_PRODUCTION' && (
                          <button
                            disabled={isConverting}
                            onClick={() => handleConvertToProduction(q.id)}
                            title="تحويل مباشر إلى أمر توريد وتصنيع"
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            <Factory className="w-3.5 h-3.5" />
                            <span>تحويل لتصنيع</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D2137] border border-blue-500/30 w-full max-w-3xl rounded-2xl p-5 text-white space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>تحرير وإنشاء عرض سعر جديد</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs">
              {/* Customer & Rep Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">اختيار العميل *</label>
                  <CustomerSearchCombobox
                    entities={customers}
                    selectedId={selectedCustomerId}
                    onSelect={(id) => setSelectedCustomerId(id)}
                    currency={currency}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">المندوب المسؤول</label>
                  <select
                    value={selectedSalesRepId}
                    onChange={(e) => setSelectedSalesRepId(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- اختر المندوب (اختياري) --</option>
                    {salesReps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameAr} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">تاريخ عرض السعر</label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">تاريخ انتهاء الصلاحية</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Add Item Row */}
              <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl space-y-2">
                <span className="font-bold text-cyan-300 block">إضافة أصناف إلى عرض السعر</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-6">
                    <InvoiceItemSearchCombobox
                      inventory={inventory}
                      selectedItemId={selectedItem ? selectedItem.id : ''}
                      onSelectItem={(it) => {
                        setSelectedItem(it);
                        if (it) setItemPrice(it.salePrice);
                      }}
                      currency={currency}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(Number(e.target.value))}
                      placeholder="الكمية"
                      className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-center"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(Number(e.target.value))}
                      placeholder="السعر"
                      className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-center"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-900/60">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800 text-slate-300 border-b border-slate-700">
                    <tr>
                      <th className="p-2">الصنف</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">سعر الوحدة</th>
                      <th className="p-2 text-center">الإجمالي</th>
                      <th className="p-2 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          لم يتم إضافة أي أصناف حتى الآن
                        </td>
                      </tr>
                    ) : (
                      lines.map((l, idx) => (
                        <tr key={l.id}>
                          <td className="p-2 font-bold text-white">{l.itemNameAr}</td>
                          <td className="p-2 text-center">{l.quantity} {l.unit}</td>
                          <td className="p-2 text-center">{formatCurrency(l.unitPrice, currency)}</td>
                          <td className="p-2 text-center font-bold text-emerald-400">
                            {formatCurrency(l.subtotal, currency)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="p-3 bg-slate-800/80 rounded-xl flex justify-between items-center font-bold text-xs">
                <span>إجمالي عرض السعر:</span>
                <span className="text-base text-cyan-300">
                  {formatCurrency(formGrandTotal, currency)}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">شروط وملاحظات عرض السعر</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات العرض، مدة التسليم، شروط الشحن والتوريد..."
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-500 cursor-pointer shadow-lg"
                >
                  حفظ واعتماد عرض السعر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
