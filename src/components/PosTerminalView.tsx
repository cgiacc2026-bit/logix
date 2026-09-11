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
  Warehouse as WarehouseType,
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
  RefreshCw,
  UserCheck,
  Warehouse as WarehouseIcon,
} from 'lucide-react';

interface PosTerminalViewProps {
  inventory: InventoryItem[];
  customers: Customer[];
  salesReps: SalesRep[];
  warehouses?: WarehouseType[];
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
  warehouses,
  company,
  currency,
  onRefreshAll,
}) => {
  const activeCompany = resolveActiveCompany(company);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [availableWarehouses, setAvailableWarehouses] = useState<WarehouseType[]>(() => {
    return warehouses && warehouses.length > 0 ? warehouses : DataService.getWarehouses();
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return activeCompany.posDefaultWarehouseId || (warehouses && warehouses.length > 0 ? warehouses[0].id : 'wh-main-01');
  });

  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      setAvailableWarehouses(warehouses);
    }
  }, [warehouses]);

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
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>(() => {
    return salesReps && salesReps.length > 0 ? salesReps[0].id : '';
  });
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

    // [ZERO DATA LOSS & ERP AUDIT ENFORCEMENT] Force warehouse and sales rep selection
    if (!selectedWarehouseId || !selectedWarehouseId.trim()) {
      alert('إلزامي وفق سياسة الرقابة المخزنية: الرجاء اختيار المستودع المصدر لصرف البضاعة');
      return;
    }
    if (!selectedSalesRepId || !selectedSalesRepId.trim()) {
      alert('إلزامي وفق سياسة التدقيق المالي: الرجاء اختيار مندوب المبيعات المسؤول عن عملية البيع');
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
        warehouseId: selectedWarehouseId,
        warehouse_id: selectedWarehouseId,
        warehouseName: availableWarehouses.find((w) => w.id === selectedWarehouseId)?.nameAr || 'المستودع الرئيسي (الشويخ)',
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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-['Cairo',sans-serif] rtl overflow-hidden">
      {/* 1. Compact TopBar */}
      <header className="flex-none bg-slate-900 text-white h-12 px-4 flex items-center justify-between shadow-md z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">LOGIX POS</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={activeBranch.id}
              onChange={(e) => {
                branchService.setActiveBranch(e.target.value);
                setActiveBranch(branchService.getActiveBranch(activeCompany.id));
              }}
              className="bg-transparent text-slate-200 outline-none cursor-pointer font-semibold"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-xs" title="المستودع المصدر لصرف بضاعة نقطة البيع">
            <WarehouseIcon className="w-4 h-4 text-amber-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-amber-300 outline-none cursor-pointer font-semibold max-w-[140px] truncate"
            >
              {availableWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                  {w.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-xs" title="مندوب المبيعات المسؤول عن عملية البيع">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedSalesRepId}
              onChange={(e) => setSelectedSalesRepId(e.target.value)}
              className="bg-transparent text-emerald-300 outline-none cursor-pointer font-semibold max-w-[140px] truncate"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                -- اختر المندوب * --
              </option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                  {r.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Shift Status */}
          <button
            onClick={() => {
              setSessionAction('STATUS');
              setIsSessionModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              activeSession && activeSession.status === 'OPEN'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>
              {activeSession && activeSession.status === 'OPEN'
                ? `${activeSession.user_name} (${activeSession.expected_cash.toFixed(3)} ${currency})`
                : 'فتح وردية'}
            </span>
          </button>
          
          <div className="h-4 w-px bg-slate-700"></div>
          
          {/* Settings / Actions Dropdown - Minimalist approach (using direct buttons for now to save complexity, but icon-only) */}
          <div className="flex items-center gap-2">
            <button onClick={() => setIsParkedModalOpen(true)} className="p-1.5 hover:bg-slate-800 rounded-lg text-amber-400 transition-colors" title="الفواتير المعلقة (F9)">
              <PauseCircle className="w-4 h-4" />
            </button>
            <button onClick={() => setIsHistoryModalOpen(true)} className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400 transition-colors" title="سجل المبيعات (F5)">
              <History className="w-4 h-4" />
            </button>
            <button onClick={() => setIsAuditModalOpen(true)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="سجل التدقيق">
              <ShieldAlert className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              title="ملء الشاشة (F11)"
            >
              <Sparkles className="w-4 h-4" /> {/* Or Maximize icon */}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Right Side: Products Catalog (60%) */}
        <div className="flex-[6] flex flex-col bg-slate-50 border-l border-slate-200">
          {/* Search Bar */}
          <div className="p-4 bg-white shadow-sm z-10">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Barcode className="w-6 h-6 text-slate-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 text-lg rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block pr-12 p-3.5 transition-all font-bold placeholder:font-normal placeholder:text-slate-400"
                placeholder="ابحث بالباركود أو اسم المنتج... (F2)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="px-4 py-3 bg-white border-b border-slate-100 overflow-x-auto no-scrollbar flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`whitespace-nowrap px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredItems.map((item) => {
                const available = (item.quantity ?? 0);
                const isOutOfStock = available <= 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item, 1)}
                    disabled={isOutOfStock}
                    className={`relative flex flex-col text-right bg-white border rounded-2xl p-3 transition-all active:scale-95 ${
                      isOutOfStock 
                        ? 'opacity-50 cursor-not-allowed border-slate-200' 
                        : 'border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full mb-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {item.sku}
                      </span>
                      {available > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600">
                          {available} {item.unit}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600">
                          نفذ
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-end w-full">
                      <h3 className="text-sm font-bold text-slate-800 leading-tight line-clamp-2 mb-1.5">{item.nameAr}</h3>
                      <div className="text-emerald-600 font-black text-base flex items-baseline gap-1">
                        {formatCurrency(item.salePrice)} <span className="text-[10px] text-emerald-500 font-bold">{currency}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-12 h-12 mb-3 opacity-20" />
                  <p>لا توجد منتجات مطابقة للبحث</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Left Side: Cart & Checkout (40%) */}
        <div className="flex-[4] flex flex-col bg-white border-l border-slate-200 relative shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 min-w-[320px]">
          
          {/* Customer Selection Bar */}
          <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </select>
          </div>

          {/* Cart Table List */}
          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50">
                <ShoppingBag className="w-16 h-16" />
                <p className="font-bold">السلة فارغة</p>
              </div>
            ) : (
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm text-xs">
                  <tr>
                    <th className="py-2 px-3 font-semibold">الصنف</th>
                    <th className="py-2 px-2 font-semibold w-24">الكمية</th>
                    <th className="py-2 px-2 font-semibold text-left w-20">السعر</th>
                    <th className="py-2 px-2 font-semibold text-left w-20">الإجمالي</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((c) => (
                    <tr key={c.item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 text-sm line-clamp-1" title={c.item.nameAr}>{c.item.nameAr}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                          <button onClick={() => updateQuantity(c.item.id, c.quantity - 1)} className="p-1 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-slate-800 text-sm">{c.quantity}</span>
                          <button onClick={() => updateQuantity(c.item.id, c.quantity + 1)} className="p-1 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-left font-bold text-slate-600 text-xs">
                        {formatCurrency(c.unitPrice)}
                      </td>
                      <td className="py-3 px-2 text-left font-black text-emerald-600">
                        {formatCurrency(c.quantity * c.unitPrice)}
                      </td>
                      <td className="py-3 px-2">
                        <button onClick={() => removeFromCart(c.item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sticky Checkout Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            {/* Payment Method & Discount row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CASH' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  نقدي
                </button>
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CARD' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  كي نت
                </button>
                <button
                  onClick={() => setPaymentMethod('CREDIT')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CREDIT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  آجل
                </button>
              </div>
              <button 
                onClick={() => setDiscountValue(discountValue > 0 ? 0 : 10)} 
                className={`p-2.5 rounded-xl border transition-colors flex-shrink-0 ${discountAmount > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                title="خصم"
              >
                <Percent className="w-4 h-4" />
              </button>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="text-slate-500 font-semibold">المجموع</span>
                <span className="font-bold text-slate-700">{formatCurrency(grossSubtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center mb-1 text-sm text-emerald-600">
                  <span className="font-semibold">الخصم</span>
                  <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between items-center mb-2 text-sm text-slate-500">
                  <span className="font-semibold">الضريبة ({vatRate}%)</span>
                  <span className="font-bold">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-end">
                <span className="text-sm font-bold text-slate-800">الإجمالي النهائي</span>
                <div className="text-2xl font-black text-emerald-600 flex items-baseline gap-1">
                  {formatCurrency(grandTotal)} <span className="text-sm font-bold">{currency}</span>
                </div>
              </div>
            </div>

            {/* Cash Tendered Input (if cash) */}
            {paymentMethod === 'CASH' && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl pr-9 pl-3 py-2 text-lg font-bold text-slate-800 focus:border-emerald-500 focus:ring-emerald-500 outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
                    placeholder="المبلغ المستلم"
                  />
                </div>
                {changeDue > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex flex-col justify-center items-center text-amber-800">
                    <span className="text-[10px] font-bold">الباقي</span>
                    <span className="text-base font-black">{formatCurrency(changeDue)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={clearCart}
                className="w-14 bg-white border-2 border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-xl font-bold flex items-center justify-center transition-colors"
                title="إلغاء (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
              <button
                onClick={handleTriggerCheckout}
                disabled={cart.length === 0 || isProcessing || !activeSession || activeSession.status !== 'OPEN'}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl py-3.5 font-black text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
              >
                {isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>دفع وإصدار الفاتورة (F4)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Thin Keyboard Shortcuts Footer */}
      <footer className="h-8 flex-none bg-slate-900 text-slate-400 flex items-center justify-center text-[11px] font-semibold tracking-wide border-t border-slate-800 gap-6 z-20">
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans">F2</kbd> بحث / باركود</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-sans">F4</kbd> دفع سريع</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans">F9</kbd> تعليق السلة</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans">F5</kbd> سجل المبيعات</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans">Esc</kbd> مسح وإلغاء</span>
      </footer>
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
                      onClick={async () => {
                        const closed = posSessionService.closeSession({
                          actual_cash: actualCashCount,
                          notes: `إغلاق الوردية من قبل الكاشير`,
                        });
                        try {
                          await DataService.recordPosShiftClosingGL(closed);
                          if (onRefreshAll) await onRefreshAll();
                        } catch (err) {
                          console.warn('POS Shift GL record notice:', err);
                        }
                        setZReportData(closed);
                        refreshSession();
                        setIsSessionModalOpen(false);
                        alert(
                          `تم إغلاق وردية الكاشير بنجاح وترحيل قيود التسوية آلياً! الفارق: ${formatCurrency(
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
