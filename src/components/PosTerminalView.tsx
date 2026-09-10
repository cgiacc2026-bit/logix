import React, { useState } from 'react';
import {
  InventoryItem,
  Customer,
  SalesRep,
  CompanyProfile,
  Invoice,
  PaymentVoucher,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { DataService } from '../services/dataService.ts';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  User,
  CreditCard,
  DollarSign,
  Barcode,
  Package,
  Sparkles,
  Layers,
  Clock,
  Building2,
  XCircle,
} from 'lucide-react';

interface PosTerminalViewProps {
  inventory: InventoryItem[];
  customers: Customer[];
  salesReps: SalesRep[];
  company: CompanyProfile | null;
  currency: string;
  onRefreshAll: () => Promise<void> | void;
}

interface CartItem {
  item: InventoryItem;
  quantity: number;
  unitPrice: number;
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  inventory,
  customers,
  salesReps,
  company,
  currency,
  onRefreshAll,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    return customers.length > 0 ? customers[0].id : '';
  });
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Extract Categories
  const categories = Array.from(
    new Set(inventory.map((i) => i.category || 'عام').filter(Boolean))
  );

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { item, quantity: 1, unitPrice: item.salePrice }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const vatRate = company?.vatRate || 0;
  const vatAmount = (subtotal * vatRate) / 100;
  const grandTotal = subtotal + vatAmount;

  const changeDue = Math.max(0, cashTendered - grandTotal);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('السلة فارغة، اختر بعض المنتجات للبيع');
      return;
    }

    const cust = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const rep = salesReps.find((r) => r.id === selectedSalesRepId);

    setIsProcessing(true);
    try {
      const invData = {
        type: 'SALES',
        status: 'POSTED',
        paymentTerms: paymentMethod === 'CREDIT' ? 'CREDIT' : 'CASH',
        entityId: cust ? cust.id : '',
        entityNameAr: cust ? cust.nameAr : 'عميل كاش نقدي',
        salesPerson: rep ? rep.nameAr : undefined,
        salesRepId: rep ? rep.id : undefined,
        salesRepName: rep ? rep.nameAr : undefined,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        lines: cart.map((c) => ({
          itemId: c.item.id,
          itemSku: c.item.sku,
          itemNameAr: c.item.nameAr,
          unit: c.item.unit || 'حبة',
          unitsPerPack: c.item.unitsPerPack || 1,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discountType: 'FIXED',
          discountValue: 0,
        })),
        notes: `عملية بيع نقطة بيع POS (${paymentMethod === 'CASH' ? 'كاش' : paymentMethod === 'CARD' ? 'بطاقة كي نت' : 'آجل ذمم'})`,
      };

      const createdInvoice = await DataService.createInvoice(invData);

      // Create Receipt Voucher if paid cash or card
      if (paymentMethod !== 'CREDIT') {
        await DataService.createVoucher({
          type: 'RECEIPT',
          entityType: 'CUSTOMER',
          entityId: cust ? cust.id : '',
          entityNameAr: cust ? cust.nameAr : 'عميل كاش نقدي',
          salesRepId: rep ? rep.id : undefined,
          salesRepName: rep ? rep.nameAr : undefined,
          amount: grandTotal,
          paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'BANK',
          invoiceId: createdInvoice.id,
          reference: `POS-${createdInvoice.invoiceNumber}`,
          notes: `تحصيل مباشر من نقطة البيع POS - الفاتورة ${createdInvoice.invoiceNumber}`,
        });
      }

      setCompletedInvoice(createdInvoice);
      setIsReceiptModalOpen(true);
      clearCart();
      setCashTendered(0);
      await onRefreshAll();
    } catch (err: any) {
      alert('حدث خطأ أثناء إتمام عملية البيع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top POS Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl shadow-lg">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black flex items-center gap-2">
              نقطة البيع السريعة POS Terminal
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                متصل بالمخزون والخزينة
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              الشركة النشطة: <span className="text-cyan-300 font-bold">{company?.nameAr || 'مطحنة الوليد'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700">
          <div className="flex items-center gap-1.5 text-slate-300">
            <User className="w-4 h-4 text-cyan-400" />
            <span>الكاشير: أ. محمد الكندري</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-slate-300 font-mono">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{new Date().toLocaleDateString('ar-KW')}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Products on Right, Cart on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Product Catalog Section (Right) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Category Pills */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="مسح باركود الأصناف أو البحث بالاسم/الكود..."
                className="w-full pr-9 pl-3 py-2 bg-slate-800 text-white text-xs border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                جميع الأصناف ({inventory.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const inStock = item.quantityOnHand > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-3 text-right flex flex-col justify-between h-32 transition-all cursor-pointer group shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-white text-xs group-hover:text-cyan-300 line-clamp-2">
                        {item.nameAr}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {item.sku}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-sm font-black text-emerald-400">
                      {formatCurrency(item.salePrice, currency)}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inStock
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {inStock ? `${item.quantityOnHand} ${item.unit || 'حبة'}` : 'نفذت'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart & Payment Checkout Section (Left) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 flex flex-col justify-between shadow-2xl">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-cyan-400" />
                <span>سلة المبيعات الحالية ({cart.length})</span>
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  تفروغ السلة
                </button>
              )}
            </div>

            {/* Cart Items Table */}
            <div className="max-h-56 overflow-y-auto space-y-2 py-2 pr-1 my-2">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  السلة فارغة. انقر على الأصناف لإضافتها إلى الفاتورة.
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs text-white"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold">{c.item.nameAr}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatCurrency(c.unitPrice, currency)} / {c.item.unit || 'حبة'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700">
                        <button
                          onClick={() => updateQuantity(c.item.id, -1)}
                          className="p-1 hover:bg-slate-700 rounded-r-lg cursor-pointer"
                        >
                          <Minus className="w-3 h-3 text-slate-300" />
                        </button>
                        <span className="px-2 font-bold font-mono text-cyan-300">{c.quantity}</span>
                        <button
                          onClick={() => updateQuantity(c.item.id, 1)}
                          className="p-1 hover:bg-slate-700 rounded-l-lg cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-slate-300" />
                        </button>
                      </div>

                      <span className="font-bold text-emerald-400 font-mono w-16 text-left">
                        {formatCurrency(c.quantity * c.unitPrice, currency)}
                      </span>

                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer & Rep Selectors */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">العميل</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-1.5 focus:outline-none focus:border-cyan-400"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">المندوب</label>
                  <select
                    value={selectedSalesRepId}
                    onChange={(e) => setSelectedSalesRepId(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-1.5 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- بدون مندوب --</option>
                    {salesReps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">طريقة الدفع</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs cursor-pointer transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>نقدي كاش</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs cursor-pointer transition-all ${
                      paymentMethod === 'CARD'
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>بطاقة K-Net</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT')}
                    className={`py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs cursor-pointer transition-all ${
                      paymentMethod === 'CREDIT'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>آجل ذمم</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Totals & Checkout Button */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{formatCurrency(subtotal, currency)}</span>
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>الضريبة ({vatRate}%):</span>
                  <span className="font-mono">{formatCurrency(vatAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-white pt-1 border-t border-slate-800">
                <span>المبلغ الإجمالي المستحق:</span>
                <span className="text-emerald-400 font-mono">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>

            <button
              disabled={isProcessing || cart.length === 0}
              onClick={handleCheckout}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إتمام عملية البيع وطباعة الفاتورة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Thermal Receipt Modal */}
      {isReceiptModalOpen && completedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <h3 className="font-black text-lg text-slate-900">
                {company?.nameAr || 'مطحنة الوليد المتحدة'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                فاتورة مبيعات - نقطة بيع POS
              </p>
              <div className="text-xs font-mono text-slate-600 pt-1">
                رقم الفاتورة: {completedInvoice.invoiceNumber}
              </div>
            </div>

            {/* Invoice Info */}
            <div className="text-xs space-y-1 text-slate-700 border-b border-slate-200 pb-3">
              <div className="flex justify-between">
                <span>العميل:</span>
                <span className="font-bold">{completedInvoice.entityNameAr}</span>
              </div>
              {completedInvoice.salesRepName && (
                <div className="flex justify-between">
                  <span>المندوب:</span>
                  <span className="font-bold">{completedInvoice.salesRepName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span className="font-mono">{completedInvoice.date}</span>
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2 border-b border-slate-200 pb-3">
              <div className="text-xs font-bold text-slate-800 grid grid-cols-12">
                <span className="col-span-6">الصنف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-4 text-left">المبلغ</span>
              </div>
              {completedInvoice.lines.map((l) => (
                <div key={l.id} className="text-xs grid grid-cols-12 text-slate-700">
                  <span className="col-span-6 font-semibold">{l.itemNameAr}</span>
                  <span className="col-span-2 text-center font-mono">{l.quantity}</span>
                  <span className="col-span-4 text-left font-mono font-bold">
                    {formatCurrency(l.total || l.subtotal, currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1">
              <span>الإجمالي المدفوع:</span>
              <span className="text-emerald-700 text-base font-mono">
                {formatCurrency(completedInvoice.grandTotal, currency)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة الفاتورة
              </button>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
