import React, { useState, useEffect } from 'react';
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
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import { ReceiptPrintTemplate } from './ReceiptPrintTemplate.tsx';
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
  Percent,
  History,
  Tag,
  Receipt,
  X,
  PlusCircle,
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
  discountAmount?: number;
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  inventory,
  customers,
  salesReps,
  company,
  currency,
  onRefreshAll,
}) => {
  const activeCompany = resolveActiveCompany(company);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    return customers.length > 0 ? customers[0].id : '';
  });
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Discount State
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);

  // Quick Manual Item Modal
  const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState<number>(1);

  // Recent Invoices / Re-print State
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Load recent invoices for quick reprint
  useEffect(() => {
    DataService.getInvoices().then((invs) => {
      const posInvs = invs
        .filter((i) => i.type === 'SALES')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);
      setRecentInvoices(posInvs);
    });
  }, []);

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

  const addToCart = (item: InventoryItem, qty: number = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { item, quantity: qty, unitPrice: item.salePrice }];
    });
  };

  const handleBarcodeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      // Look for exact SKU match or name match
      const exactMatch = inventory.find(
        (i) =>
          i.sku.toLowerCase() === searchTerm.trim().toLowerCase() ||
          i.nameAr.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      } else if (filteredItems.length === 1) {
        addToCart(filteredItems[0]);
        setSearchTerm('');
      }
    }
  };

  const handleAddQuickCustomItem = () => {
    if (!quickItemName.trim()) {
      alert('يرجى كتابة اسم الصنف');
      return;
    }
    const tempItem: InventoryItem = {
      id: 'custom-' + Date.now(),
      sku: 'QUICK-SALE',
      nameAr: quickItemName.trim(),
      nameEn: 'Quick Sale Item',
      purchasePrice: (Number(quickItemPrice) || 1) * 0.7,
      salePrice: Number(quickItemPrice) || 1,
      costPrice: (Number(quickItemPrice) || 1) * 0.7,
      quantityOnHand: 999,
      minQuantityAlert: 0,
      unitsPerPack: 1,
      unit: 'خدمة/حبة',
      category: 'مبيعات سريعة',
      isActive: true,
    };
    addToCart(tempItem);
    setQuickItemName('');
    setQuickItemPrice(1);
    setIsQuickItemModalOpen(false);
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

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
    setCashTendered(0);
  };

  // Accurate Calculations
  const grossSubtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  let discountAmount = 0;
  if (discountType === 'PERCENT' && discountValue > 0) {
    discountAmount = (grossSubtotal * Math.min(100, Math.max(0, discountValue))) / 100;
  } else if (discountType === 'FIXED' && discountValue > 0) {
    discountAmount = Math.min(grossSubtotal, discountValue);
  }

  const subtotalAfterDiscount = Math.max(0, grossSubtotal - discountAmount);
  const vatRate = company?.vatRate || 0;
  const vatAmount = (subtotalAfterDiscount * vatRate) / 100;
  const grandTotal = subtotalAfterDiscount + vatAmount;

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
        discountType,
        discountValue,
        discountTotal: discountAmount,
        companyId: activeCompany.id,
        company_id: activeCompany.id,
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
        notes: `عملية بيع نقطة بيع POS (${
          paymentMethod === 'CASH' ? 'كاش نقدي' : paymentMethod === 'CARD' ? 'بطاقة كي نت K-Net' : 'آجل ذمم'
        })`,
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
          companyId: activeCompany.id,
          company_id: activeCompany.id,
        });
      }

      setCompletedInvoice(createdInvoice);
      setRecentInvoices((prev) => [createdInvoice, ...prev.slice(0, 14)]);
      setIsReceiptModalOpen(true);
      clearCart();
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-white shadow-xl">
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
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <span>الشركة النشطة:</span>
              <span className="text-cyan-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {activeCompany.nameAr || activeCompany.headerTitle || 'المؤسسة المعتمدة'}
              </span>
              {activeCompany.crNumber && (
                <span className="text-slate-400 font-mono text-[11px]">
                  س.ت: {activeCompany.crNumber}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Item Addition Button */}
          <button
            onClick={() => setIsQuickItemModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>صنف يدوي سريع</span>
          </button>

          {/* Recent Invoices / Re-print Button */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span>سجل فواتير اليوم ({recentInvoices.length})</span>
          </button>

          <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-4 h-4 text-cyan-400" />
              <span>الكاشير: أ. محمد الكندري</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1 text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
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
                onKeyDown={handleBarcodeEnter}
                placeholder="مسح باركود الأصناف أو البحث بالاسم/الكود (اضغط Enter للإضافة المباشرة)..."
                className="w-full pr-9 pl-3 py-2 bg-slate-800 text-white text-xs border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-400 transition-all font-sans"
              />
            </div>

            {/* Categories scrollable pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[550px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const inStock = item.quantityOnHand > 0;
              const cartQuantity = cart.find((c) => c.item.id === item.id)?.quantity || 0;
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-3 text-right flex flex-col justify-between h-34 transition-all group shadow-lg relative"
                >
                  {cartQuantity > 0 && (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-cyan-500 text-slate-950 font-mono font-black text-[10px] rounded-full shadow-md">
                      ×{cartQuantity}
                    </span>
                  )}
                  <button
                    onClick={() => addToCart(item)}
                    className="text-right w-full flex-1 flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-white text-xs group-hover:text-cyan-300 line-clamp-2 leading-tight">
                        {item.nameAr}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {item.sku}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-sm font-black text-emerald-400 font-mono">
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

                  {/* Quick Add Modifiers (+1, +5) */}
                  <div className="pt-1.5 flex items-center justify-end gap-1 text-[10px]">
                    <button
                      onClick={() => addToCart(item, 1)}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-bold cursor-pointer"
                      title="إضافة 1"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => addToCart(item, 5)}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-bold cursor-pointer"
                      title="إضافة 5 سريعاً"
                    >
                      +5
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart & Payment Checkout Section (Left) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-2xl">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
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
                  <span>تفريغ السلة</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 py-2 max-h-[220px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-1">
                  <Package className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
                  <p className="text-xs">السلة فارغة حالياً</p>
                  <p className="text-[11px] text-slate-600">اختر الأصناف أو امسح الباركود للبدء</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="p-2 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-xs truncate">{c.item.nameAr}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatCurrency(c.unitPrice, currency)} / {c.item.unit || 'حبة'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700">
                        <button
                          onClick={() => updateQuantity(c.item.id, -1)}
                          className="p-1 hover:bg-slate-700 rounded-r-lg cursor-pointer text-slate-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold font-mono text-cyan-300 text-xs">{c.quantity}</span>
                        <button
                          onClick={() => updateQuantity(c.item.id, 1)}
                          className="p-1 hover:bg-slate-700 rounded-l-lg cursor-pointer text-slate-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Quick +5 shortcut on line */}
                      <button
                        onClick={() => updateQuantity(c.item.id, 5)}
                        className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-700 text-cyan-400 rounded text-[10px] font-mono font-bold"
                        title="زيادة 5"
                      >
                        +5
                      </button>

                      <span className="font-bold text-emerald-400 font-mono text-xs w-16 text-left">
                        {formatCurrency(c.quantity * c.unitPrice, currency)}
                      </span>

                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        title="حذف"
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
                <label className="block text-[11px] font-bold text-slate-300 mb-1">طريقة السداد</label>
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
                    <span>نقدي (كاش)</span>
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
                    <span>K-Net / بطاقة</span>
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
                    <span>آجل (ذمم)</span>
                  </button>
                </div>
              </div>

              {/* Cash Presets & Tendered Calculation (if CASH) */}
              {paymentMethod === 'CASH' && (
                <div className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span>المبلغ المستلم نقداً (KWD):</span>
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal)}
                      className="text-cyan-400 hover:underline text-[10px] cursor-pointer"
                    >
                      المبلغ بالضبط
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 20, 50].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt)}
                        className={`py-1 text-center font-mono font-bold text-xs rounded-lg border transition-all cursor-pointer ${
                          cashTendered === amt
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {amt} د.ك
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <input
                        type="number"
                        step="0.050"
                        min="0"
                        value={cashTendered || ''}
                        onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                        placeholder="المبلغ المقبوض..."
                        className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-1.5 text-xs font-mono focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between px-2 bg-slate-900 rounded-lg border border-slate-700 text-xs font-mono">
                      <span className="text-slate-400 text-[10px]">الباقي للمشتري:</span>
                      <span className="font-black text-emerald-400">{formatCurrency(changeDue, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Discount Section Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Percent className="w-3 h-3" />
                  <span>{showDiscountInput ? 'إخفاء حقل الخصم' : '+ تطبيق خصم تجاري على الفاتورة'}</span>
                </button>

                {showDiscountInput && (
                  <div className="flex items-center gap-2 mt-1.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-slate-900 text-white border border-slate-700 rounded-lg p-1 text-xs"
                    >
                      <option value="FIXED">مبلغ ثابت ({currency})</option>
                      <option value="PERCENT">نسبة مئوية (%)</option>
                    </select>
                    <input
                      type="number"
                      step={discountType === 'PERCENT' ? '1' : '0.250'}
                      min="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                      placeholder="قيمة الخصم..."
                      className="flex-1 bg-slate-900 text-white border border-slate-700 rounded-lg p-1 font-mono text-xs"
                    />
                    {discountAmount > 0 && (
                      <span className="text-rose-400 font-mono text-xs">
                        -{formatCurrency(discountAmount, currency)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Totals & Checkout Button */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{formatCurrency(grossSubtotal, currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>الخصم الممنوح:</span>
                  <span className="font-mono">-{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
              {vatRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>الضريبة ({vatRate}%):</span>
                  <span className="font-mono">{formatCurrency(vatAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-white pt-1 border-t border-slate-800">
                <span>الصافي المستحق:</span>
                <span className="text-emerald-400 font-mono text-lg">
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
              <span>
                {isProcessing ? 'جاري ترحيل الفاتورة...' : 'إتمام عملية البيع وطباعة الإيصال'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Custom Item Modal */}
      {isQuickItemModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-black text-sm flex items-center gap-1.5 text-cyan-300">
                <PlusCircle className="w-4 h-4" />
                <span>إضافة صنف يدوي سريع للبيع</span>
              </h3>
              <button
                onClick={() => setIsQuickItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم الصنف / الخدمة</label>
                <input
                  type="text"
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  placeholder="مثال: خدمة طحن خاصة، علبة هدايا..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">سعر البيع ({currency})</label>
                <input
                  type="number"
                  step="0.250"
                  min="0.100"
                  value={quickItemPrice || ''}
                  onChange={(e) => setQuickItemPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddQuickCustomItem}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs cursor-pointer shadow-md"
              >
                إضافة إلى السلة
              </button>
              <button
                onClick={() => setIsQuickItemModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Invoices History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-2xl text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="font-black text-sm">سجل فواتير وإيصالات الكاشير الأخيرة</h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-2 text-xs">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-2 font-mono">
                      <span>{inv.invoiceNumber}</span>
                      <span className="text-[10px] font-sans px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                        {inv.paymentTerms === 'CASH' ? 'نقدي' : 'آجل'}
                      </span>
                    </div>
                    <div className="text-slate-400">{inv.entityNameAr}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{inv.date}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black font-mono text-emerald-400 text-sm">
                      {formatCurrency(inv.grandTotal, currency)}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedInvoiceForPrint(inv);
                      }}
                      className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة إيصال</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Re-print of selected invoice from history */}
      {selectedInvoiceForPrint && (
        <ReceiptPrintTemplate
          invoice={selectedInvoiceForPrint}
          company={company}
          onClose={() => setSelectedInvoiceForPrint(null)}
          cashierName="أ. محمد الكندري"
        />
      )}

      {/* Completed Checkout Thermal Receipt Modal */}
      {isReceiptModalOpen && completedInvoice && (
        <ReceiptPrintTemplate
          invoice={completedInvoice}
          company={company}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setCompletedInvoice(null);
          }}
          cashierName="أ. محمد الكندري"
          cashTendered={cashTendered > 0 ? cashTendered : undefined}
          changeDue={cashTendered > 0 ? changeDue : undefined}
          paymentMethod={paymentMethod}
          autoPrint={false}
        />
      )}
    </div>
  );
};
