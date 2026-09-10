import React, { useState, useEffect, useRef } from 'react';
import {
  InventoryItem,
  Customer,
  SalesRep,
  CompanyProfile,
  Invoice,
  Branch,
  PosSession,
  ParkedCart,
  CustomerCreditEvaluation,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { DataService } from '../services/dataService.ts';
import { resolveActiveCompany } from '../utils/companyResolver.ts';
import { branchService } from '../services/branchService.ts';
import { posSessionService } from '../services/posSessionService.ts';
import { auditLogService } from '../services/auditLogService.ts';
import { evaluateCustomerCredit } from '../utils/customerCreditManager.ts';
import { ReceiptPrintTemplate } from './ReceiptPrintTemplate.tsx';
import { AuditLogsModal } from './AuditLogsModal.tsx';
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
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  KeyRound,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Check,
  FileSpreadsheet,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tenant Branch State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch>(() => branchService.getActiveBranch(activeCompany.id));

  // POS Shift & Session State
  const [activeSession, setActiveSession] = useState<PosSession | null>(() => posSessionService.getActiveSession());
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionAction, setSessionAction] = useState<'OPEN' | 'STATUS' | 'CASH_IN' | 'CASH_OUT' | 'CLOSE'>('STATUS');
  const [openingCashInput, setOpeningCashInput] = useState<number>(50);
  const [cashTxAmount, setCashTxAmount] = useState<number>(0);
  const [cashTxReason, setCashTxReason] = useState<string>('');
  const [actualCashCount, setActualCashCount] = useState<number>(0);
  const [zReportData, setZReportData] = useState<PosSession | null>(null);

  // Search & Cart State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer & Sales Rep
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

  // Parked Carts (Hold / Recall F9)
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>(() => posSessionService.getParkedCarts());
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

  // Quick Manual Item Modal
  const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState<number>(1);

  // Recent Invoices / History
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  // Completed Checkout Modal
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Audit Logs Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Supervisor Override PIN Modal
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorError, setSupervisorError] = useState<string | null>(null);
  const [supervisorPendingAction, setSupervisorPendingAction] = useState<(() => void) | null>(null);
  const [supervisorActionDescription, setSupervisorActionDescription] = useState('');

  // Synchronize branch list
  useEffect(() => {
    const list = branchService.getBranchesForCurrentCompany(activeCompany.id);
    setBranches(list);
    setActiveBranch(branchService.getActiveBranch(activeCompany.id));
  }, [activeCompany.id]);

  // Load recent invoices
  useEffect(() => {
    DataService.getInvoices().then((invs) => {
      const posInvs = invs
        .filter((i) => i.type === 'SALES')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);
      setRecentInvoices(posInvs);
    });
  }, []);

  // Update session state
  const refreshSession = () => {
    setActiveSession(posSessionService.getActiveSession());
    setParkedCarts(posSessionService.getParkedCarts());
  };

  // ==========================================
  // GLOBAL KEYBOARD SHORTCUTS LAYER
  // [F2] Focus Search / Barcode
  // [F4] Quick Checkout
  // [F5] Print Receipt / Reprint
  // [F9] Park / Recall Hold Cart
  // [Escape] Close Modals / Clear Search
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input and not a function key
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          handleTriggerCheckout();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (recentInvoices.length > 0 && !isReceiptModalOpen) {
          setSelectedInvoiceForPrint(recentInvoices[0]);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) {
          handleParkCurrentCart();
        } else {
          setIsParkedModalOpen(true);
        }
      } else if (e.key === 'Escape') {
        // Close modals or blur
        setIsReceiptModalOpen(false);
        setIsHistoryModalOpen(false);
        setIsParkedModalOpen(false);
        setIsQuickItemModalOpen(false);
        setIsSessionModalOpen(false);
        setIsAuditModalOpen(false);
        setIsSupervisorModalOpen(false);
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Extract Categories
  const categories = Array.from(
    new Set(inventory.map((i) => i.category || 'عام').filter(Boolean))
  );

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Smart Customer Evaluation
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;

  // Cart Calculations
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

  const creditEvaluation: CustomerCreditEvaluation = evaluateCustomerCredit(
    selectedCustomer,
    paymentMethod === 'CREDIT' ? grandTotal : 0
  );

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
      const exactMatch = inventory.find(
        (i) =>
          (i.barcode && i.barcode.toLowerCase() === searchTerm.trim().toLowerCase()) ||
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

  // ==========================================
  // PARK / RECALL HOLD CARTS (F9)
  // ==========================================
  const handleParkCurrentCart = () => {
    if (cart.length === 0) return;
    const parked = posSessionService.parkCart({
      items: cart,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.nameAr,
      subtotal: grandTotal,
      branchId: activeBranch.id,
    });
    clearCart();
    refreshSession();
    alert(`تم تعليق الفاتورة بنجاح تحت رقم تذكرة (${parked.ticketNumber}) ويمكن استرجاعها عبر [F9]`);
  };

  const handleRecallCart = (parked: ParkedCart) => {
    setCart(
      parked.items.map((pi) => ({
        item: pi.item,
        quantity: pi.quantity,
        unitPrice: pi.unitPrice,
        discountAmount: pi.discountAmount,
      }))
    );
    if (parked.customerId) {
      setSelectedCustomerId(parked.customerId);
    }
    posSessionService.removeParkedCart(parked.id);
    refreshSession();
    setIsParkedModalOpen(false);
  };

  // ==========================================
  // SUPERVISOR PIN OVERRIDE MODAL
  // ==========================================
  const requestSupervisorOverride = (actionDescription: string, onAuthorized: () => void) => {
    setSupervisorActionDescription(actionDescription);
    setSupervisorPendingAction(() => onAuthorized);
    setSupervisorPin('');
    setSupervisorError(null);
    setIsSupervisorModalOpen(true);
  };

  const handleVerifySupervisorPin = () => {
    const res = auditLogService.verifySupervisorPin(supervisorPin, supervisorActionDescription);
    if (!res.success) {
      setSupervisorError(res.error || 'رمز PIN المشرف غير صحيح');
      return;
    }

    // Log the override
    auditLogService.logAction({
      company_id: activeCompany.id,
      branch_id: activeBranch.id,
      action: 'SUPERVISOR_AUTH',
      entity_type: 'POS_SALE',
      entity_id: 'OVERRIDE-' + Date.now().toString(36),
      reason: `موافقة وتفويض المشرف: ${supervisorActionDescription}`,
      authorized_by: res.supervisorName,
    });

    setIsSupervisorModalOpen(false);
    if (supervisorPendingAction) {
      supervisorPendingAction();
    }
  };

  // ==========================================
  // CHECKOUT LOGIC WITH AUDIT & SESSION UPDATE
  // ==========================================
  const handleTriggerCheckout = () => {
    if (cart.length === 0) {
      alert('السلة فارغة، اختر بعض الأصناف للبيع');
      return;
    }

    // Check Credit Limits if Credit sale
    if (paymentMethod === 'CREDIT' && creditEvaluation.requiresSupervisorOverride) {
      requestSupervisorOverride(
        `تجاوز سقف ائتماني للعميل (${selectedCustomer?.nameAr}): ${creditEvaluation.message}`,
        () => {
          executeCheckout('تجاوز معتمد من المشرف');
        }
      );
      return;
    }

    // Check high discount override (e.g. > 20% discount)
    if (discountType === 'PERCENT' && discountValue > 20) {
      requestSupervisorOverride(`خصم خاص مرتفع (${discountValue}%) على المبيعات`, () => {
        executeCheckout('خصم معتمد من المشرف');
      });
      return;
    }

    executeCheckout();
  };

  const executeCheckout = async (supervisorApprovalNote?: string) => {
    const cust = selectedCustomer;
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
        branch_id: activeBranch.id,
        branchId: activeBranch.id,
        pos_session_id: activeSession?.id,
        posSessionId: activeSession?.id,
        cashierName: activeSession?.user_name || 'كاشير الصالة',
        cashTendered: paymentMethod === 'CASH' ? (cashTendered > 0 ? cashTendered : grandTotal) : undefined,
        changeDue: paymentMethod === 'CASH' && cashTendered > grandTotal ? changeDue : 0,
        paymentMethod,
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
        notes: `نقطة بيع POS - فرع: ${activeBranch.nameAr} (${
          paymentMethod === 'CASH' ? 'كاش نقدي' : paymentMethod === 'CARD' ? 'بطاقة كي نت K-Net' : 'آجل ذمم'
        })${supervisorApprovalNote ? ` [${supervisorApprovalNote}]` : ''}`,
      };

      const createdInvoice = await DataService.createInvoice(invData);

      // Record in live active POS shift session
      posSessionService.recordSale(paymentMethod, grandTotal);
      refreshSession();

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
          branch_id: activeBranch.id,
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
    <div className="space-y-4 pb-16">
      {/* Top POS Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl shadow-lg">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black flex items-center gap-2">
              <span>نقطة البيع السريعة LOGIX POS</span>
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                متصل بالمخزون والخزينة
              </span>
            </h1>
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-1">
              <span className="text-slate-400">الشركة:</span>
              <span className="text-cyan-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {activeCompany.nameAr || activeCompany.headerTitle || 'المؤسسة المعتمدة'}
              </span>
              {activeCompany.crNumber && (
                <span className="text-slate-400 font-mono text-[11px]">
                  س.ت: {activeCompany.crNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions: Branch Switcher, POS Shift Register, Parked Carts, Audit Logs */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Branch Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={activeBranch.id}
              onChange={(e) => {
                branchService.setActiveBranch(e.target.value);
                setActiveBranch(branchService.getActiveBranch(activeCompany.id));
              }}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* POS Shift Register Status Button */}
          <button
            onClick={() => {
              setSessionAction('STATUS');
              setIsSessionModalOpen(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all shadow-md ${
              activeSession && activeSession.status === 'OPEN'
                ? 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>
              {activeSession && activeSession.status === 'OPEN'
                ? `وردية مفتوحة (${activeSession.expected_cash.toFixed(3)} د.ك)`
                : 'فتح وردية كاشير'}
            </span>
          </button>

          {/* Parked Carts Button */}
          <button
            onClick={() => setIsParkedModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer relative"
            title="الفواتير المعلقة (F9)"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>المعلق [F9]</span>
            {parkedCarts.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black rounded-full font-mono">
                {parkedCarts.length}
              </span>
            )}
          </button>

          {/* Audit Logs Button */}
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="سجل التدقيق والرقابة"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">سجل الرقابة</span>
          </button>

          {/* Invoices History */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>السجل [F5]</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Items Selection | Right Cart & Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Product Catalog & Search (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Barcode Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg space-y-2">
            <div className="relative">
              <Barcode className="w-5 h-5 text-emerald-400 absolute right-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="امسح الباركود أو ابحث بالاسم / الرمز SKU ثم اضغط Enter... [F2]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleBarcodeEnter}
                className="w-full pl-3 pr-10 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Pills & Quick Item Action */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  الكل ({inventory.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsQuickItemModalOpen(true)}
                className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-all shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>صنف مخصص</span>
              </button>
            </div>
          </div>

          {/* Product Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[560px] overflow-y-auto pr-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all shadow-md active:scale-98 group"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-mono">{item.sku}</span>
                    <span
                      className={`font-semibold ${
                        item.quantityOnHand <= 5 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      متاح: {item.quantityOnHand} {item.unit || 'حبة'}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {item.nameAr}
                  </h3>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="font-black text-emerald-400 font-mono text-xs sm:text-sm">
                    {formatCurrency(item.salePrice, currency)}
                  </span>
                  <div className="p-1 bg-slate-800 group-hover:bg-emerald-600 rounded-lg text-slate-300 group-hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart, Customer Credit Logic & Checkout Summary (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3">
          {/* Customer & Credit Profile Header */}
          <div className="space-y-2 border-b border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>العميل المعتمد:</span>
              </label>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>تفريغ</span>
                  </button>
                )}
              </div>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr} {c.creditLimit ? `(سقف: ${c.creditLimit} د.ك)` : ''}
                </option>
              ))}
            </select>

            {/* Smart Customer Credit Risk Badge */}
            {selectedCustomer && (
              <div
                className={`p-2 rounded-xl text-[11px] border flex items-center justify-between ${
                  creditEvaluation.status === 'EXCEEDED'
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                    : creditEvaluation.status === 'WARNING'
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                    : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {creditEvaluation.status === 'EXCEEDED' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : creditEvaluation.status === 'WARNING' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-semibold block">{creditEvaluation.message}</span>
                    <span className="text-[10px] opacity-80 font-mono">
                      الرصيد: {(selectedCustomer.balance || 0).toFixed(3)} د.ك | السقف: {(selectedCustomer.creditLimit || 0).toFixed(3)} د.ك
                    </span>
                  </div>
                </div>
                {paymentMethod === 'CREDIT' && creditEvaluation.requiresSupervisorOverride && (
                  <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold shrink-0">
                    يلزم PIN المشرف
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs">السلة فارغة. اختر أصنافاً من القائمة لإتمام البيع</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.item.id}
                  className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 max-w-[160px]">
                    <div className="font-bold text-white truncate">{item.item.nameAr}</div>
                    <div className="text-[11px] text-emerald-400 font-mono">
                      {formatCurrency(item.unitPrice, currency)} / {item.item.unit || 'حبة'}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.item.id, -1)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-white px-1.5">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.item.id, 1)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black font-mono text-white text-xs">
                      {formatCurrency(item.quantity * item.unitPrice, currency)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount & Totals Section */}
          <div className="border-t border-slate-800 pt-2.5 space-y-2 text-xs">
            {/* Quick Discount Toggle */}
            <div className="flex items-center justify-between text-[11px]">
              <button
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Percent className="w-3 h-3" />
                <span>{showDiscountInput ? 'إخفاء الخصم' : 'إضافة خصم خاص'}</span>
              </button>
              {discountAmount > 0 && (
                <span className="text-rose-400 font-mono font-bold">
                  -{formatCurrency(discountAmount, currency)}
                </span>
              )}
            </div>

            {showDiscountInput && (
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="bg-slate-900 text-white rounded-lg px-2 py-1 text-xs border border-slate-700"
                >
                  <option value="FIXED">مبلغ ثابت ({currency})</option>
                  <option value="PERCENT">نسبة مئوية (%)</option>
                </select>
                <input
                  type="number"
                  placeholder="قيمة الخصم"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-slate-300 text-xs">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{formatCurrency(grossSubtotal, currency)}</span>
              </div>
              {vatAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>ضريبة القيمة المضافة ({vatRate}%):</span>
                  <span className="font-mono">{formatCurrency(vatAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-white text-base pt-1 border-t border-slate-800">
                <span>الإجمالي النهائي المستحق:</span>
                <span className="text-emerald-400 font-mono text-lg">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-[11px]">نقدي (كاش)</span>
              </button>

              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  paymentMethod === 'CARD'
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[11px]">كي نت K-Net</span>
              </button>

              <button
                onClick={() => setPaymentMethod('CREDIT')}
                className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  paymentMethod === 'CREDIT'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-[11px]">آجل (ذمم)</span>
              </button>
            </div>

            {/* Cash Tendered Input for Cash Payment */}
            {paymentMethod === 'CASH' && (
              <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>المبلغ المستلم من العميل:</span>
                  <span>المتبقي: <b className="text-emerald-400 font-mono">{formatCurrency(changeDue, currency)}</b></span>
                </div>
                <input
                  type="number"
                  placeholder="المبلغ المدفوع كاش..."
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Primary Action Buttons: Trigger Checkout [F4] & Park [F9] */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleParkCurrentCart}
                disabled={cart.length === 0}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                title="تعليق الفاتورة الحالية مؤقتاً [F9]"
              >
                <PauseCircle className="w-4 h-4" />
                <span className="hidden sm:inline">تعليق [F9]</span>
              </button>

              <button
                onClick={handleTriggerCheckout}
                disabled={cart.length === 0 || isProcessing}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-99"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isProcessing
                    ? 'جارٍ قيد العملية...'
                    : `إتمام البيع وطباعة الإيصال [F4] (${formatCurrency(grandTotal, currency)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Keyboard Shortcuts HUD */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 py-2 px-4 flex flex-wrap items-center justify-between text-xs text-slate-300 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-500 font-bold hidden md:inline">اختصارات لوحة المفاتيح:</span>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <kbd className="font-mono font-bold text-emerald-400">F2</kbd>
            <span className="text-[11px]">بحث / باركود</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <kbd className="font-mono font-bold text-emerald-400">F4</kbd>
            <span className="text-[11px]">دفع فوري</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <kbd className="font-mono font-bold text-cyan-400">F5</kbd>
            <span className="text-[11px]">طباعة الإيصال</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <kbd className="font-mono font-bold text-amber-400">F9</kbd>
            <span className="text-[11px]">تعليق / استرجاع</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <kbd className="font-mono font-bold text-rose-400">Esc</kbd>
            <span className="text-[11px]">إلغاء / إغلاق</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>الفرع: <b className="text-white">{activeBranch.nameAr}</b></span>
          <span>•</span>
          <span>الوردية: <b className={activeSession ? 'text-teal-400' : 'text-amber-400'}>{activeSession ? activeSession.session_number : 'غير مفتوحة'}</b></span>
        </div>
      </div>

      {/* ==========================================
          MODALS SECTION
          ========================================== */}

      {/* POS Session / Register Drawer Modal */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-lg text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-sm">إدارة وردية وصندوق الكاشير (Register Shift)</h3>
              </div>
              <button
                onClick={() => setIsSessionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If no session is open: Show Open Shift Form */}
            {!activeSession || activeSession.status !== 'OPEN' ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  لا توجد وردية كاشير مفتوحة حالياً. يرجى إدخال الرصيد الافتتاحي للنقدية لبدء عمليات البيع.
                </p>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    الرصيد الافتتاحي في الدرج (Opening Cash Float):
                  </label>
                  <input
                    type="number"
                    value={openingCashInput || ''}
                    onChange={(e) => setOpeningCashInput(Number(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-teal-400"
                  />
                </div>
                <button
                  onClick={() => {
                    posSessionService.openSession({
                      opening_cash: openingCashInput,
                      company_id: activeCompany.id,
                      branch_id: activeBranch.id,
                    });
                    refreshSession();
                    setIsSessionModalOpen(false);
                  }}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl font-bold text-white text-xs cursor-pointer shadow-lg"
                >
                  فتح الوردية وبدء مبيعات الصالة
                </button>
              </div>
            ) : (
              /* Session is open: show stats & actions */
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-300 font-sans">
                    <span>رقم الوردية:</span>
                    <span className="font-bold text-teal-300">{activeSession.session_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">الرصيد الافتتاحي:</span>
                    <span>{formatCurrency(activeSession.opening_cash, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">مبيعات نقدية (كاش):</span>
                    <span className="text-emerald-400">+{formatCurrency(activeSession.total_sales_cash, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">مبيعات بطاقات (K-Net):</span>
                    <span className="text-cyan-400">{formatCurrency(activeSession.total_sales_card, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">إيداعات نقدية للدرج (Cash In):</span>
                    <span className="text-teal-400">+{formatCurrency(activeSession.total_cash_in, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">سحوبات وتوريدات (Cash Out):</span>
                    <span className="text-rose-400">-{formatCurrency(activeSession.total_cash_out, currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-white pt-1.5 border-t border-slate-700">
                    <span>النقدية المتوقعة بالدرج:</span>
                    <span className="text-emerald-300 font-bold">{formatCurrency(activeSession.expected_cash, currency)}</span>
                  </div>
                </div>

                {/* Sub-actions: Cash In, Cash Out, Close Shift */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSessionAction('CASH_IN')}
                    className={`py-1.5 rounded-lg font-bold text-[11px] border cursor-pointer ${
                      sessionAction === 'CASH_IN'
                        ? 'bg-teal-600 border-teal-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    إيداع نقدي +
                  </button>
                  <button
                    onClick={() => setSessionAction('CASH_OUT')}
                    className={`py-1.5 rounded-lg font-bold text-[11px] border cursor-pointer ${
                      sessionAction === 'CASH_OUT'
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    سحب / مصروف -
                  </button>
                  <button
                    onClick={() => setSessionAction('CLOSE')}
                    className={`py-1.5 rounded-lg font-bold text-[11px] border cursor-pointer ${
                      sessionAction === 'CLOSE'
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    إغلاق الوردية (Z-Report)
                  </button>
                </div>

                {/* Cash In Form */}
                {sessionAction === 'CASH_IN' && (
                  <div className="p-3 bg-teal-950/30 border border-teal-800/50 rounded-xl space-y-2">
                    <h4 className="font-bold text-teal-300">إيداع نقدي في الدرج (Cash In)</h4>
                    <input
                      type="number"
                      placeholder="المبلغ المراد إيداعه..."
                      value={cashTxAmount || ''}
                      onChange={(e) => setCashTxAmount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="السبب (مثل: تزويد فكة إضافية)..."
                      value={cashTxReason}
                      onChange={(e) => setCashTxReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    />
                    <button
                      onClick={() => {
                        if (cashTxAmount <= 0) return alert('الرجاء إدخال مبلغ صالح');
                        posSessionService.recordCashRegisterTransaction({
                          type: 'CASH_IN',
                          amount: cashTxAmount,
                          reason: cashTxReason || 'إيداع نقدية إضافية',
                        });
                        setCashTxAmount(0);
                        setCashTxReason('');
                        refreshSession();
                        setSessionAction('STATUS');
                      }}
                      className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg font-bold cursor-pointer"
                    >
                      تأكيد الإيداع في الدرج
                    </button>
                  </div>
                )}

                {/* Cash Out Form */}
                {sessionAction === 'CASH_OUT' && (
                  <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl space-y-2">
                    <h4 className="font-bold text-rose-300">سحب نقدي من الدرج (Cash Out)</h4>
                    <input
                      type="number"
                      placeholder="المبلغ المراد سحبه..."
                      value={cashTxAmount || ''}
                      onChange={(e) => setCashTxAmount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="السبب (مثل: مصروفات تشغيلية / توريد بنك)..."
                      value={cashTxReason}
                      onChange={(e) => setCashTxReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    />
                    <button
                      onClick={() => {
                        if (cashTxAmount <= 0) return alert('الرجاء إدخال مبلغ صالح');
                        posSessionService.recordCashRegisterTransaction({
                          type: 'CASH_OUT',
                          amount: cashTxAmount,
                          reason: cashTxReason || 'سحب نقدي من الصندوق',
                        });
                        setCashTxAmount(0);
                        setCashTxReason('');
                        refreshSession();
                        setSessionAction('STATUS');
                      }}
                      className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold cursor-pointer"
                    >
                      تأكيد السحب من الدرج
                    </button>
                  </div>
                )}

                {/* Close Session Form */}
                {sessionAction === 'CLOSE' && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-2">
                    <h4 className="font-bold text-amber-300">إغلاق الوردية وجرد النقدية الفعلي (Z-Report)</h4>
                    <label className="block text-slate-300">المبلغ الفعلي المعدود في الدرج:</label>
                    <input
                      type="number"
                      placeholder="الجرد الفعلي..."
                      value={actualCashCount || ''}
                      onChange={(e) => setActualCashCount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                    />
                    <div className="flex justify-between text-xs pt-1">
                      <span>الفارق النقدي:</span>
                      <span
                        className={`font-bold font-mono ${
                          actualCashCount - activeSession.expected_cash >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(actualCashCount - activeSession.expected_cash, currency)}
                        {actualCashCount - activeSession.expected_cash === 0
                          ? ' (مطابق)'
                          : actualCashCount - activeSession.expected_cash > 0
                          ? ' (فائض)'
                          : ' (عجز)'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const closed = posSessionService.closeSession({
                          actual_cash: actualCashCount,
                          notes: `إغلاق الوردية من قبل الكاشير`,
                        });
                        setZReportData(closed);
                        refreshSession();
                        setIsSessionModalOpen(false);
                        alert(
                          `تم إغلاق وردية الكاشير بنجاح! الفارق: ${formatCurrency(
                            closed.difference || 0,
                            currency
                          )}`
                        );
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold cursor-pointer text-black"
                    >
                      إغلاق الوردية واعتماد تقرير Z-Report
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parked Carts Modal (F9) */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-lg text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm">الفواتير المعلقة في الانتظار (Parked Carts [F9])</h3>
              </div>
              <button
                onClick={() => setIsParkedModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 text-xs">
              {parkedCarts.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <PauseCircle className="w-8 h-8 mx-auto mb-1 opacity-40" />
                  <p>لا توجد فواتير معلقة حالياً</p>
                </div>
              ) : (
                parkedCarts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-amber-300 font-mono text-sm">
                        {p.ticketNumber}
                      </div>
                      <div className="text-white font-semibold">{p.customerName}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.items.length} أصناف • {new Date(p.parkedAt).toLocaleTimeString('ar-KW')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 font-mono text-sm">
                        {formatCurrency(p.subtotal, currency)}
                      </span>
                      <button
                        onClick={() => handleRecallCart(p)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>استرجاع</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supervisor PIN Authorization Modal */}
      {isSupervisorModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-5 w-full max-w-md text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-sm">تفويض وإذن المشرف (Supervisor Override)</h3>
              </div>
              <button
                onClick={() => setIsSupervisorModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs text-purple-200">
              <p className="font-semibold mb-1">العملية المقيدة برمجياً:</p>
              <p className="text-slate-300 font-medium">{supervisorActionDescription}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رمز PIN المشرف أو المدير العام:
              </label>
              <input
                type="password"
                autoFocus
                placeholder="أدخل رمز PIN المشرف (مثال: 1234)..."
                value={supervisorPin}
                onChange={(e) => {
                  setSupervisorPin(e.target.value);
                  setSupervisorError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifySupervisorPin();
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-purple-500"
              />
              {supervisorError && (
                <p className="text-rose-400 text-xs mt-1.5 font-medium">{supervisorError}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleVerifySupervisorPin}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                <span>اعتماد العملية وتسجيلها في Audit Log</span>
              </button>
              <button
                onClick={() => setIsSupervisorModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Custom Item Modal */}
      {isQuickItemModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm">إضافة صنف سريع (مبيعات سريعة)</h3>
              </div>
              <button
                onClick={() => setIsQuickItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">اسم الصنف أو الخدمة:</label>
                <input
                  type="text"
                  placeholder="مثال: خدمة توصيل سريع، تغليف هدية..."
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  سعر البيع ({currency}):
                </label>
                <input
                  type="number"
                  value={quickItemPrice || ''}
                  onChange={(e) => setQuickItemPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddQuickCustomItem}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs cursor-pointer shadow-md"
              >
                إضافة إلى السلة
              </button>
              <button
                onClick={() => setIsQuickItemModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs cursor-pointer"
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

      {/* Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        companyId={activeCompany.id}
      />

      {/* Re-print of selected invoice from history */}
      {selectedInvoiceForPrint && (
        <ReceiptPrintTemplate
          invoice={selectedInvoiceForPrint}
          company={company}
          onClose={() => setSelectedInvoiceForPrint(null)}
          cashierName={activeSession?.user_name || 'الكاشير'}
          branchName={activeBranch.nameAr}
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
          cashierName={activeSession?.user_name || 'الكاشير'}
          branchName={activeBranch.nameAr}
          cashTendered={cashTendered > 0 ? cashTendered : undefined}
          changeDue={cashTendered > 0 ? changeDue : undefined}
          paymentMethod={paymentMethod}
          autoPrint={false}
        />
      )}
    </div>
  );
};
