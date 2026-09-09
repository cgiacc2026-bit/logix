import React, { useState, useMemo } from 'react';
import {
  Customer,
  Supplier,
  InventoryItem,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
  UnitDefinition,
  ProductionOrder
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { tafqeetCurrency } from '../utils/tafqeet.ts';
import { PrintDocumentModal } from './PrintDocumentModal';
import { DataImportModal } from './DataImportModal';
import { PriceManagementModal } from './PriceManagementModal';
import { AccountStatementModal } from './AccountStatementModal';
import { NegativeStockConfirmationModal, DeficitItem } from './NegativeStockConfirmationModal';
import { StockLedgerAndAuditView } from './StockLedgerAndAuditView';
import { DataService, localDataStore } from '../services/dataService.ts';
import { calculateEntityCurrentBalance } from '../services/statementService.ts';
import { CustomerSearchCombobox } from './CustomerSearchCombobox.tsx';
import { InvoiceItemSearchCombobox } from './InvoiceItemSearchCombobox.tsx';
import { matchesSearch } from '../utils/searchUtils.ts';
import {
  ShoppingBag,
  Plus,
  Users,
  Package,
  DollarSign,
  Printer,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Layers,
  Box,
  RotateCcw,
  XCircle,
  Ruler,
  Upload,
  TrendingUp,
  Calculator,
  FileSpreadsheet,
  Calendar
} from 'lucide-react';

interface InvoicesProps {
  company: CompanyProfile;
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  units?: UnitDefinition[];
  currency: string;
  activeSubTab?: 'invoices' | 'vouchers' | 'entities' | 'inventory' | 'units';
  onSubTabChange?: (tab: 'invoices' | 'vouchers' | 'entities' | 'inventory' | 'units') => void;
  onRefreshAll?: () => Promise<void> | void;
  onCreateInvoice: (data: any) => Promise<void>;
  onPostInvoice: (id: string) => Promise<void>;
  onCancelInvoice?: (id: string, reason?: string) => Promise<void>;
  onCreateVoucher: (data: any) => Promise<void>;
  onCancelVoucher?: (id: string, reason: string) => Promise<void>;
  onDeleteVoucher?: (id: string) => Promise<void>;
  onCreateCustomer: (data: any) => Promise<void>;
  onUpdateCustomer?: (id: string, data: any) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
  onCreateSupplier: (data: any) => Promise<void>;
  onUpdateSupplier?: (id: string, data: any) => Promise<void>;
  onDeleteSupplier?: (id: string) => Promise<void>;
  onCreateInventoryItem: (data: any) => Promise<void>;
  onUpdateInventoryItem?: (id: string, data: any) => Promise<void>;
  onDeleteInventoryItem?: (id: string) => Promise<void>;
  onDeleteInvoice?: (id: string) => Promise<void>;
  onCreateUnit?: (data: any) => Promise<void>;
  onUpdateUnit?: (id: string, data: any) => Promise<void>;
  onDeleteUnit?: (id: string) => Promise<void>;
  productionOrders?: ProductionOrder[];
}

export const InvoicesAndInventoryView: React.FC<InvoicesProps> = ({
  company,
  customers,
  suppliers,
  inventory,
  invoices,
  vouchers,
  units,
  currency,
  activeSubTab,
  onSubTabChange,
  onRefreshAll,
  onCreateInvoice,
  onPostInvoice,
  onCancelInvoice,
  onCreateVoucher,
  onCancelVoucher,
  onDeleteVoucher,
  onCreateCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onCreateInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onDeleteInvoice,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
  productionOrders = [],
}) => {
  const [subTab, setSubTab] = useState<'invoices' | 'vouchers' | 'entities' | 'inventory' | 'units'>(
    activeSubTab || 'invoices'
  );
  const [inventoryViewMode, setInventoryViewMode] = useState<'catalog' | 'audit_ledger'>('catalog');
  const [selectedStockAuditItemId, setSelectedStockAuditItemId] = useState<string>('');

  React.useEffect(() => {
    if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleSwitchSubTab = (tab: 'invoices' | 'vouchers' | 'entities' | 'inventory' | 'units') => {
    setSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Search & Filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Active company ID and Multi-tenant Scoped Lists
  const activeCompanyId = company?.id || localDataStore.getEffectiveCompanyId();

  const scopedCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    const activeId = String(activeCompanyId || '').trim().toLowerCase();
    return customers.filter((c: any) => {
      if (!c) return false;
      const cCompId = String(c.company_id || c.companyId || '').trim().toLowerCase();
      if (cCompId && activeId && cCompId !== activeId) return false;
      return true;
    });
  }, [customers, activeCompanyId]);

  const scopedSuppliers = useMemo(() => {
    if (!Array.isArray(suppliers)) return [];
    const activeId = String(activeCompanyId || '').trim().toLowerCase();
    return suppliers.filter((s: any) => {
      if (!s) return false;
      const sCompId = String(s.company_id || s.companyId || '').trim().toLowerCase();
      if (sCompId && activeId && sCompId !== activeId) return false;
      return true;
    });
  }, [suppliers, activeCompanyId]);

  const scopedInventory = useMemo(() => {
    if (!Array.isArray(inventory)) return [];
    const activeId = String(activeCompanyId || '').trim().toLowerCase();
    return inventory.filter((item: any) => {
      if (!item) return false;
      const itemCompId = String(item.company_id || item.companyId || '').trim().toLowerCase();
      if (itemCompId && activeId && itemCompId !== activeId) return false;
      return true;
    });
  }, [inventory, activeCompanyId]);

  // Print Modal State
  const [printDoc, setPrintDoc] = useState<{
    type: 'INVOICE' | 'VOUCHER' | 'JOURNAL' | 'STATEMENT';
    data: any;
  } | null>(null);

  // Modals State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Invoice Form State
  const [invType, setInvType] = useState<'SALES' | 'PURCHASE' | 'SALES_RETURN' | 'PURCHASE_RETURN'>('SALES');
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invDueDate, setInvDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invPaymentTerms, setInvPaymentTerms] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [invSalesPerson, setInvSalesPerson] = useState('');
  const [invReceiverName, setInvReceiverName] = useState('');
  const [invFilterType, setInvFilterType] = useState<'ALL' | 'SALES' | 'PURCHASE' | 'RETURNS'>('ALL');
  const [invEntityId, setInvEntityId] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [invDiscountType, setInvDiscountType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [invDiscountValue, setInvDiscountValue] = useState<number>(0);
  const [invLines, setInvLines] = useState<
    {
      itemId: string;
      itemNameAr?: string;
      itemNameEn?: string;
      itemSku?: string;
      barcode?: string;
      unit: string;
      unitsPerPack: number;
      quantity: number;
      packQuantity: number;
      unitPrice: number;
      discountType?: 'PERCENT' | 'FIXED';
      discountValue?: number;
      notes?: string;
    }[]
  >([
    {
      itemId: '',
      itemNameAr: '',
      itemNameEn: '',
      itemSku: '',
      barcode: '',
      unit: 'حبة',
      unitsPerPack: 1,
      quantity: 1,
      packQuantity: 0,
      unitPrice: 0,
      discountType: 'FIXED',
      discountValue: 0,
    },
  ]);

  // Voucher Form State
  const [vouchType, setVouchType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [vouchDate, setVouchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vouchEntityId, setVouchEntityId] = useState('');
  const [vouchAmount, setVouchAmount] = useState(0);
  const [vouchBankAcc, setVouchBankAcc] = useState('acc-1111');
  const [vouchNotes, setVouchNotes] = useState('');

  // Entity Form State
  const [editingEntity, setEditingEntity] = useState<Customer | Supplier | null>(null);
  const [entityKind, setEntityKind] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [entityCode, setEntityCode] = useState('');
  const [entityNameAr, setEntityNameAr] = useState('');
  const [entityTaxNo, setEntityTaxNo] = useState('');
  const [entityPhone, setEntityPhone] = useState('');
  const [entityAddress, setEntityAddress] = useState('');
  const [entityGovernorate, setEntityGovernorate] = useState('');
  const [entityCity, setEntityCity] = useState('الكويت');
  const [entityOpeningBalance, setEntityOpeningBalance] = useState<number | string>(0);
  const [entityOpeningBalanceDate, setEntityOpeningBalanceDate] = useState('2026-07-01');
  const [entitySearch, setEntitySearch] = useState('');

  // Unit Form State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitDefinition | null>(null);
  const [unitCode, setUnitCode] = useState('');
  const [unitNameAr, setUnitNameAr] = useState('');
  const [unitNameEn, setUnitNameEn] = useState('');
  const [unitFactor, setUnitFactor] = useState(1);
  const [unitIsBase, setUnitIsBase] = useState(false);
  const [unitDescription, setUnitDescription] = useState('');

  // Bulk Import & Price Management Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'CUSTOMERS' | 'SUPPLIERS' | 'INVENTORY'>('CUSTOMERS');
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  // Dedicated Account Statement Modal
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementEntityType, setStatementEntityType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [statementSelectedEntityId, setStatementSelectedEntityId] = useState('');

  // Negative Stock Confirmation Modal State
  const [isNegativeStockModalOpen, setIsNegativeStockModalOpen] = useState(false);
  const [deficitItemsList, setDeficitItemsList] = useState<DeficitItem[]>([]);
  const [pendingAutoPost, setPendingAutoPost] = useState(true);

  const handleOpenStatement = (entityId: string, type: 'CUSTOMER' | 'SUPPLIER') => {
    setStatementSelectedEntityId(entityId);
    setStatementEntityType(type);
    setIsStatementModalOpen(true);
  };

  const handleOpenImport = (type: 'CUSTOMERS' | 'SUPPLIERS' | 'INVENTORY') => {
    setImportType(type);
    setIsImportModalOpen(true);
  };

  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitCode('');
    setUnitNameAr('');
    setUnitNameEn('');
    setUnitFactor(1);
    setUnitIsBase(false);
    setUnitDescription('');
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (u: UnitDefinition) => {
    setEditingUnit(u);
    setUnitCode(u.code);
    setUnitNameAr(u.nameAr);
    setUnitNameEn(u.nameEn || '');
    setUnitFactor(u.conversionFactor || 1);
    setUnitIsBase(!!u.isBaseUnit);
    setUnitDescription(u.description || '');
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitCode || !unitNameAr) {
      alert('الرجاء إدخال رمز واسم وحدة القياس');
      return;
    }
    const payload = {
      code: unitCode.trim(),
      nameAr: unitNameAr.trim(),
      nameEn: unitNameEn.trim() || unitNameAr.trim(),
      conversionFactor: Number(unitFactor) || 1,
      isBaseUnit: unitIsBase,
      description: unitDescription.trim(),
    };
    try {
      if (editingUnit && onUpdateUnit) {
        await onUpdateUnit(editingUnit.id, payload);
      } else if (onCreateUnit) {
        await onCreateUnit(payload);
      }
      setIsUnitModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ وحدة القياس');
    }
  };

  const handleDeleteUnitRow = async (u: UnitDefinition) => {
    if (!confirm(`هل أنت متأكد من حذف وحدة القياس "${u.nameAr}"؟`)) return;
    try {
      if (onDeleteUnit) {
        await onDeleteUnit(u.id);
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف الوحدة');
    }
  };

  // Item Form State (With Pack & Barcode)
  const [itemSku, setItemSku] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemCategory, setItemCategory] = useState('عام');
  const [itemUnit, setItemUnit] = useState('حبة');
  const [itemUnitsPerPack, setItemUnitsPerPack] = useState(1);
  const [itemPackUnit, setItemPackUnit] = useState('كرتون');
  const [itemPurchase, setItemPurchase] = useState(0);
  const [itemSale, setItemSale] = useState(0);
  const [itemQty, setItemQty] = useState(10);
  const [itemMinAlert, setItemMinAlert] = useState(5);

  // Invoices line handlers
  const handleAddInvLine = () => {
    setInvLines([
      ...invLines,
      {
        itemId: '',
        itemSku: '',
        barcode: '',
        unit: 'حبة',
        unitsPerPack: 1,
        quantity: 1,
        packQuantity: 0,
        unitPrice: 0,
        discountType: 'FIXED',
        discountValue: 0,
      },
    ]);
  };

  const handleRemoveInvLine = (index: number) => {
    if (invLines.length <= 1) {
      setInvLines([
        {
          itemId: '',
          itemSku: '',
          barcode: '',
          unit: 'حبة',
          unitsPerPack: 1,
          quantity: 1,
          packQuantity: 0,
          unitPrice: 0,
          discountType: 'FIXED',
          discountValue: 0,
        },
      ]);
      return;
    }
    setInvLines(invLines.filter((_, i) => i !== index));
  };

  const handleInvItemSelect = (index: number, itemId: string, itemObj?: InventoryItem) => {
    const item = itemObj || scopedInventory.find((i) => i.id === itemId);
    const updated = [...invLines];
    updated[index].itemId = itemId;
    if (item) {
      updated[index].itemNameAr = item.nameAr;
      updated[index].itemSku = item.sku || '';
      updated[index].barcode = item.barcode || '';
      updated[index].unit = item.unit || 'حبة';
      updated[index].unitsPerPack = item.unitsPerPack || 1;
      updated[index].unitPrice = (invType === 'SALES' || invType === 'SALES_RETURN') ? item.salePrice : item.purchasePrice;
    }
    setInvLines(updated);
  };

  const executeSaveInvoice = async (
    autoPost: boolean,
    allowNegative: boolean = false,
    reason: string = ''
  ) => {
    const validLines = invLines.filter(
      (l) => l.itemId || l.unitPrice > 0 || (l.itemNameAr && l.itemNameAr.trim())
    );
    const processedLines = validLines.map((l) => {
      const item = inventory.find((i) => i.id === l.itemId);
      const actualQty = Number(l.quantity) > 0 ? Number(l.quantity) : 1;
      const lineGross = actualQty * Number(l.unitPrice);
      const lineDiscAmt =
        l.discountType === 'PERCENT'
          ? (lineGross * Math.min(100, Math.max(0, Number(l.discountValue) || 0))) / 100
          : Math.min(lineGross, Number(l.discountValue) || 0);

      return {
        itemId: l.itemId || `custom-item-${Date.now()}`,
        itemSku: item?.sku || l.itemSku || '',
        barcode: item?.barcode || l.barcode || '',
        itemNameAr: item?.nameAr || (l.itemNameAr && l.itemNameAr.trim()) || 'منتج/خدمة',
        unit: l.unit || item?.unit || 'حبة',
        unitsPerPack: Number(l.unitsPerPack) || Number(item?.unitsPerPack) || 1,
        quantity: actualQty,
        packQuantity: Number(l.packQuantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        subtotal: lineGross,
        discountType: l.discountType || 'FIXED',
        discountValue: Number(l.discountValue) || 0,
        discountAmount: lineDiscAmt,
        vatRate: 0,
        vatAmount: 0,
        total: Math.max(0, lineGross - lineDiscAmt),
        notes: l.notes || '',
      };
    });

    await onCreateInvoice({
      type: invType,
      date: invDate || new Date().toISOString().split('T')[0],
      dueDate: invDueDate || invDate || new Date().toISOString().split('T')[0],
      paymentTerms: invPaymentTerms,
      salesPerson: invSalesPerson,
      receiverName: invReceiverName,
      entityId: invEntityId,
      lines: processedLines,
      notes: invNotes,
      discountType: invDiscountType,
      discountValue: invDiscountValue,
      autoPost: autoPost,
      allowNegativeStock: allowNegative,
      negativeStockApprovedBy: 'admin',
      negativeStockApprovedByName: 'إدارة النظام المعتمدة',
      negativeStockReason: reason,
    });
    setIsInvoiceModalOpen(false);
    setIsNegativeStockModalOpen(false);
  };

  const handleSaveInvoice = async (e: React.FormEvent, autoPost: boolean = true) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!invEntityId) return alert('الرجاء اختيار العميل أو المورد');
    
    // Check if at least one valid item is selected
    const validLines = invLines.filter((l) => l.itemId || l.unitPrice > 0);
    if (validLines.length === 0) {
      return alert('الرجاء إضافة صنف واحد على الأقل في الفاتورة');
    }

    // Check for negative stock on Sales invoices
    if (invType === 'SALES') {
      const deficits: DeficitItem[] = [];
      for (const line of validLines) {
        if (!line.itemId) continue;
        const item = inventory.find((i) => i.id === line.itemId);
        if (item) {
          const available = Number(item.quantityOnHand) || 0;
          const requested = Number(line.quantity) || 1;
          if (available < requested) {
            deficits.push({
              itemId: item.id,
              itemNameAr: item.nameAr,
              itemSku: item.sku,
              availableQty: available,
              requestedQty: requested,
              unit: item.unit || 'حبة',
            });
          }
        }
      }

      if (deficits.length > 0) {
        setDeficitItemsList(deficits);
        setPendingAutoPost(autoPost);
        setIsNegativeStockModalOpen(true);
        return;
      }
    }

    try {
      await executeSaveInvoice(autoPost, false, '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmNegativeStock = async (reason: string) => {
    try {
      await executeSaveInvoice(pendingAutoPost, true, reason);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchEntityId || vouchAmount <= 0) return alert('يرجى استكمال بيانات السند');
    try {
      await onCreateVoucher({
        type: vouchType,
        date: vouchDate || new Date().toISOString().split('T')[0],
        entityType: vouchType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER',
        entityId: vouchEntityId,
        amount: vouchAmount,
        bankAccountId: vouchBankAcc,
        notes: vouchNotes,
      });
      setIsVoucherModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openAddEntityModal = (kind: 'CUSTOMER' | 'SUPPLIER') => {
    setEntityKind(kind);
    setEditingEntity(null);
    setEntityCode('');
    setEntityNameAr('');
    setEntityTaxNo('');
    setEntityPhone('');
    setEntityAddress('');
    setEntityGovernorate('');
    setEntityCity('الكويت');
    setEntityOpeningBalance(0);
    setEntityOpeningBalanceDate('2026-07-01');
    setIsEntityModalOpen(true);
  };

  const openEditEntityModal = (entity: Customer | Supplier, kind: 'CUSTOMER' | 'SUPPLIER') => {
    setEntityKind(kind);
    setEditingEntity(entity);
    setEntityCode(entity.code || '');
    setEntityNameAr(entity.nameAr);
    setEntityTaxNo(entity.taxNumber || '');
    setEntityPhone(entity.phone || '');
    setEntityAddress(entity.address || '');
    setEntityGovernorate(entity.governorate || '');
    setEntityCity(entity.city || 'الكويت');
    setEntityOpeningBalance(entity.openingBalance || 0);
    setEntityOpeningBalanceDate(entity.openingBalanceDate || '2026-07-01');
    setIsEntityModalOpen(true);
  };

  const handleDeleteEntity = async (id: string, name: string, kind: 'CUSTOMER' | 'SUPPLIER') => {
    if (!window.confirm(`هل أنت تأكد من حذف ${kind === 'CUSTOMER' ? 'العميل' : 'المورد'} "${name}"؟`)) return;
    try {
      if (kind === 'CUSTOMER' && onDeleteCustomer) {
        await onDeleteCustomer(id);
      } else if (kind === 'SUPPLIER' && onDeleteSupplier) {
        await onDeleteSupplier(id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintCustomerStatement = async (customerId: string) => {
    try {
      const stmtData = await DataService.getStatement(customerId);
      setPrintDoc({
        type: 'STATEMENT',
        data: stmtData,
      });
    } catch (err: any) {
      alert(err.message || 'فشل جلب كشف حساب العميل');
    }
  };

  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityNameAr) return;
    try {
      const computedBalance = calculateEntityCurrentBalance(
        {
          ...(editingEntity || {}),
          id: editingEntity?.id || '',
          code: entityCode || '',
          nameAr: entityNameAr,
          openingBalance: Number(entityOpeningBalance) || 0,
        } as Customer | Supplier,
        entityKind,
        invoices,
        vouchers
      );
      const payload = {
        code: entityCode,
        nameAr: entityNameAr,
        taxNumber: entityTaxNo,
        phone: entityPhone,
        address: entityAddress,
        governorate: entityGovernorate,
        city: entityCity,
        openingBalance: Number(entityOpeningBalance) || 0,
        openingBalanceDate: entityOpeningBalanceDate || '2026-07-01',
        balance: computedBalance,
        currentBalance: computedBalance,
      };

      if (editingEntity) {
        if (entityKind === 'CUSTOMER' && onUpdateCustomer) {
          await onUpdateCustomer(editingEntity.id, payload);
        } else if (entityKind === 'SUPPLIER' && onUpdateSupplier) {
          await onUpdateSupplier(editingEntity.id, payload);
        }
      } else {
        if (entityKind === 'CUSTOMER') {
          await onCreateCustomer(payload);
        } else {
          await onCreateSupplier(payload);
        }
      }
      setIsEntityModalOpen(false);
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemSku(`SKU-${Date.now().toString().slice(-4)}`);
    setItemBarcode('');
    setItemNameAr('');
    setItemCategory('عام');
    setItemUnit('حبة');
    setItemUnitsPerPack(1);
    setItemPackUnit('حبة');
    setItemPurchase(100);
    setItemSale(150);
    setItemQty(50);
    setItemMinAlert(5);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemSku(item.sku);
    setItemBarcode(item.barcode || '');
    setItemNameAr(item.nameAr);
    setItemCategory(item.category || 'عام');
    setItemUnit(item.unit || 'حبة');
    setItemUnitsPerPack(item.unitsPerPack || 1);
    setItemPackUnit(item.packUnit || 'كرتون');
    setItemPurchase(item.purchasePrice);
    setItemSale(item.salePrice);
    setItemQty(item.quantityOnHand);
    setItemMinAlert(item.minQuantityAlert || 5);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameAr) return;
    try {
      const payload = {
        sku: itemSku,
        barcode: itemBarcode,
        nameAr: itemNameAr,
        category: itemCategory,
        unit: itemUnit,
        unitsPerPack: Number(itemUnitsPerPack) || 1,
        packUnit: itemPackUnit,
        purchasePrice: Number(itemPurchase) || 0,
        salePrice: Number(itemSale) || 0,
        quantityOnHand: Number(itemQty) || 0,
        minQuantityAlert: Number(itemMinAlert) || 5,
      };

      if (editingItem && onUpdateInventoryItem) {
        await onUpdateInventoryItem(editingItem.id, payload);
      } else {
        await onCreateInventoryItem(payload);
      }
      setIsItemModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف من دليل المنتجات والمخزون؟')) return;
    if (onDeleteInventoryItem) {
      await onDeleteInventoryItem(id);
    }
  };

  const handleDeleteInvoiceRow = async (id: string) => {
    if (!confirm('هل تأكد حذف الفاتورة؟ (المسودات فقط يمكن حذفها)')) return;
    if (onDeleteInvoice) {
      await onDeleteInvoice(id);
    }
  };

  // Dynamic accurate balance calculator for customers
  const getCustomerCurrentBalance = (c: Customer): number => {
    return calculateEntityCurrentBalance(c, 'CUSTOMER', invoices, vouchers);
  };

  // Dynamic accurate balance calculator for suppliers
  const getSupplierCurrentBalance = (s: Supplier): number => {
    return calculateEntityCurrentBalance(s, 'SUPPLIER', invoices, vouchers);
  };

  // Inventory Filtering & Categories with Multi-Tenant Scoping & Normalized Search
  const categories = useMemo(() => Array.from(new Set(scopedInventory.map((i) => i.category || 'عام'))), [scopedInventory]);
  const filteredInventory = useMemo(() => {
    return scopedInventory.filter((item) => {
      const matchesCategory = selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
      const matchesQuery =
        !inventorySearch ||
        matchesSearch(item.nameAr, inventorySearch) ||
        matchesSearch(item.nameEn, inventorySearch) ||
        matchesSearch(item.sku, inventorySearch) ||
        matchesSearch(item.barcode, inventorySearch);
      return matchesCategory && matchesQuery;
    });
  }, [scopedInventory, selectedCategoryFilter, inventorySearch]);

  const isPrintingModalOpen = !!printDoc || isStatementModalOpen;

  return (
    <div className="dir-rtl text-right">
      {/* Main Interactive Dashboard View (Hidden when a Print Modal is active) */}
      <div className={`space-y-6 ${isPrintingModalOpen ? 'no-print' : ''}`}>
        {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#D4AF37]" />
            إدارة الفواتير والمخزون وسندات القبض والصرف
          </h2>
          <p className="text-xs text-[#8C8273] mt-1 leading-relaxed">
            إدارة متكاملة لجميع الفواتير والمشتريات وتتبع حركة المخزون مع حاسبة الشد والوحدة والطباعة الفورية المعتمدة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-[#D4AF37]" /> فاتورة جديدة
          </button>
          <button
            onClick={() => setIsVoucherModalOpen(true)}
            className="px-4 py-2 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-lg text-xs font-bold flex items-center gap-1.5 border border-[#E5E1DA] shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-[#B8860B]" /> سند قبض / صرف
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-2 bg-[#F7F5F0] border border-[#E5E1DA] p-2 rounded-xl overflow-x-auto">
        {[
          { id: 'invoices', label: 'فواتير المبيعات والمشتريات', icon: ShoppingBag },
          { id: 'vouchers', label: 'سندات القبض والصرف', icon: DollarSign },
          { id: 'entities', label: 'دليل العملاء والموردين', icon: Users },
          { id: 'inventory', label: 'دليل المنتجات والشد والمخزون', icon: Package },
          { id: 'units', label: 'وحدات القياس والشد (Units)', icon: Ruler },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => handleSwitchSubTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              subTab === t.id
                ? 'bg-[#1A1A1A] text-white shadow-xs border border-[#1A1A1A]'
                : 'text-[#6E6659] hover:text-[#1A1A1A] hover:bg-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: INVOICES */}
      {subTab === 'invoices' && (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E1DA] pb-3 gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1A1A1A]">سجل الفواتير والمرتجعات والإشعارات المعتمدة</h3>
              <p className="text-[11px] text-[#8C8273]">عرض كافة المعاملات المالية وترحيلها أو طباعتها فورياً</p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-[#F7F5F0] p-1 rounded-xl border border-[#E5E1DA] text-xs font-bold">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'SALES', label: 'فواتير المبيعات' },
                { id: 'PURCHASE', label: 'فواتير المشتريات' },
                { id: 'RETURNS', label: 'مرتجعات وإشعارات' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setInvFilterType(f.id as any)}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    invFilterType === f.id
                      ? 'bg-[#1A1A1A] text-white shadow-xs'
                      : 'text-[#6E6659] hover:text-[#1A1A1A]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th className="py-3 px-4">رقم المستند</th>
                  <th className="py-3 px-4">نوع المعاملة</th>
                  <th className="py-3 px-4">الطرف (العميل / المورد)</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4 text-left">المجموع الإجمالي</th>
                  <th className="py-3 px-4 text-left">الخصم الممنوح</th>
                  <th className="py-3 px-4 text-left">صافي المستحق</th>
                  <th className="py-3 px-4 text-center">الحالة المحاسبية</th>
                  <th className="py-3 px-4 text-center">الإجراءات والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {invoices
                  .filter((inv) => {
                    if (invFilterType === 'SALES') return inv.type === 'SALES';
                    if (invFilterType === 'PURCHASE') return inv.type === 'PURCHASE';
                    if (invFilterType === 'RETURNS') return inv.type === 'SALES_RETURN' || inv.type === 'PURCHASE_RETURN';
                    return true;
                  })
                  .map((inv) => {
                    const isReturn = inv.type === 'SALES_RETURN' || inv.type === 'PURCHASE_RETURN';
                    return (
                      <tr key={inv.id} className="hover:bg-[#FDFCFB] transition-all">
                        <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-bold">
                          <div className="flex flex-col gap-1">
                            {inv.type === 'SALES' && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 inline-block w-fit">
                                فاتورة مبيعات
                              </span>
                            )}
                            {inv.type === 'PURCHASE' && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 inline-block w-fit">
                                فاتورة مشتريات
                              </span>
                            )}
                            {inv.type === 'SALES_RETURN' && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 inline-block w-fit">
                                إشعار دائن (مرتجع مبيعات)
                              </span>
                            )}
                            {inv.type === 'PURCHASE_RETURN' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 inline-block w-fit">
                                إشعار مدين (مرتجع مشتريات)
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold w-fit ${
                                inv.paymentTerms === 'CASH'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {inv.paymentTerms === 'CASH' ? '● نقدي (كاش)' : '○ آجل (ذمم)'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#1A1A1A]">{inv.entityNameAr || '-'}</td>
                        <td className="py-3 px-4 font-mono text-[#6E6659]">{inv.date}</td>
                        <td className="py-3 px-4 text-left font-mono font-semibold text-[#1A1A1A]">
                          {formatCurrency(inv.subtotal, currency)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-[#B8860B]">
                          {inv.discountTotal > 0 ? formatCurrency(inv.discountTotal, currency) : '-'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-[#2D6A4F]">
                          {formatCurrency(inv.grandTotal, currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                              inv.status === 'POSTED' || inv.status === 'PAID'
                                ? 'bg-[#EBF5EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                                : inv.status === 'CANCELLED'
                                ? 'bg-[#FDF0F0] text-[#9E2A2B] border-[#9E2A2B]/30'
                                : 'bg-[#FFFBEB] text-[#B8860B] border-[#B8860B]/30'
                            }`}
                          >
                            {inv.status === 'POSTED'
                              ? 'مرحّلة مالياً'
                              : inv.status === 'PAID'
                              ? 'مدفوعة'
                              : inv.status === 'CANCELLED'
                              ? 'ملغاة'
                              : 'مسودة غير مرحلة'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setPrintDoc({ type: 'INVOICE', data: inv })}
                              className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-black text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                              title="طباعة الفاتورة والاشعار"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                              طباعة مفقطة
                            </button>

                            {inv.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await onPostInvoice(inv.id);
                                    } catch (e: any) {
                                      alert(e.message);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-[#2D6A4F] hover:bg-[#1b4332] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                  title="ترحيل الفاتورة للدفاتر"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  ترحيل
                                </button>

                                {onDeleteInvoice && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`هل أنت متأكد من حذف المسودة (${inv.invoiceNumber})؟`)) {
                                        try {
                                          await onDeleteInvoice(inv.id);
                                        } catch (err: any) {
                                          alert(err.message);
                                        }
                                      }
                                    }}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="حذف المسودة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}

                            {(inv.status === 'POSTED' || inv.status === 'PAID') && (
                              <>
                                {onCancelInvoice && (
                                  <button
                                    onClick={async () => {
                                      const reason = prompt(
                                        `إلغاء الفاتورة (${inv.invoiceNumber}): الرجاء كتابة سبب إلغاء الفاتورة وعكس قيودها ومخزونها:`,
                                        'طلب العميل إلغاء الفاتورة'
                                      );
                                      if (reason === null) return;
                                      try {
                                        await onCancelInvoice(inv.id, reason);
                                      } catch (e: any) {
                                        alert(e.message);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-[#9E2A2B] hover:bg-[#782021] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                    title="إلغاء الفاتورة وعكس القيد بالكامل"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    إلغاء وعكس
                                  </button>
                                )}

                                {onDeleteInvoice && (
                                  <button
                                    onClick={async () => {
                                      if (
                                        confirm(
                                          `⚠️ هل أنت متأكد من حذف الفاتورة (${inv.invoiceNumber})؟ سيتم عكس قيودها واسترجاع الكميات للمخزون وحذف الفاتورة بالكامل.`
                                        )
                                      ) {
                                        try {
                                          await onDeleteInvoice(inv.id);
                                        } catch (err: any) {
                                          alert(err.message);
                                        }
                                      }
                                    }}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="حذف الفاتورة بالكامل وعكس آثارها"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VOUCHERS */}
      {subTab === 'vouchers' && (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
            <h3 className="text-sm font-bold text-[#1A1A1A]">سجل سندات القبض والصرف النقدية والبنكية وطباعتها</h3>
            <span className="text-xs text-[#8C8273] font-semibold">إجمالي السندات: {vouchers.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">نوع السند</th>
                  <th className="py-3 px-4">اسم العميل / المورد</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">المبلغ</th>
                  <th className="py-3 px-4">طريقة السداد</th>
                  <th className="py-3 px-4">البيان</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-[#FDFCFB] transition-all">
                    <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">{v.voucherNumber}</td>
                    <td className="py-3 px-4 font-bold text-[#1A1A1A]">
                      {v.type === 'RECEIPT' ? 'سند قبض (من عميل)' : 'سند صرف (لمورد)'}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1A1A1A]">{v.entityNameAr}</td>
                    <td className="py-3 px-4 text-[#8C8273]">{v.date}</td>
                    <td className="py-3 px-4 font-bold text-[#2D6A4F]">{formatCurrency(v.amount, currency)}</td>
                    <td className="py-3 px-4 text-[#6E6659]">
                      {v.paymentMethod === 'BANK' ? 'تحويل بنكي / شيك' : 'نقداً من الخزينة'}
                    </td>
                    <td className="py-3 px-4 text-[#8C8273]">{v.notes || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                          v.status === 'CANCELLED'
                            ? 'bg-[#FDF0F0] text-[#9E2A2B] border-[#9E2A2B]/30'
                            : 'bg-[#EBF5EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                        }`}
                      >
                        {v.status === 'CANCELLED' ? 'ملغى / معكوس' : 'معتمد'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setPrintDoc({ type: 'VOUCHER', data: v })}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-black text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                          title="طباعة السند"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                          طباعة
                        </button>

                        {v.status !== 'CANCELLED' && onCancelVoucher && (
                          <button
                            onClick={async () => {
                              const reason = prompt(
                                `إلغاء وعكس السند (${v.voucherNumber}): الرجاء كتابة سبب الإلغاء لتوليد قيد عكسي وإعادة احتساب الرصيد:`,
                                'إلغاء السند بطلب الإدارة'
                              );
                              if (reason === null) return;
                              try {
                                await onCancelVoucher(v.id, reason);
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                            className="px-2 py-1 bg-[#9E2A2B] hover:bg-[#782021] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            title="إلغاء السند وعكس القيد والأرصدة"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            إلغاء وعكس
                          </button>
                        )}

                        {onDeleteVoucher && (
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  `⚠️ هل أنت متأكد من حذف السند (${v.voucherNumber})؟ سيتم عكس قيوده وإعادة ضبط رصيد الحساب بالكامل.`
                                )
                              ) {
                                try {
                                  await onDeleteVoucher(v.id);
                                } catch (e: any) {
                                  alert(e.message);
                                }
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="حذف السند وعكس آثاره"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMERS & SUPPLIERS */}
      {subTab === 'entities' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F7F5F0] p-4 rounded-xl border border-[#E5E1DA]">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#1A1A1A]">سجل العملاء والموردين والجمعيات الأهلية</h3>
              <p className="text-xs text-[#8C8273]">إدارة أرقام الحسابات والأرصدة الافتتاحية والاستيراد الجماعي وطباعة كشوف الحسابات الرسمية</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenImport('CUSTOMERS')}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="استيراد دليل العملاء مع أرصدة أول المدة من ملف Excel أو نسخ ولصق مباشر"
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
                <span>استيراد العملاء + رصيد أول المدة</span>
              </button>
              <button
                onClick={() => handleOpenImport('SUPPLIERS')}
                className="px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="استيراد دليل الموردين مع أرصدة أول المدة من ملف Excel أو نسخ ولصق مباشر"
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
                <span>استيراد الموردين + رصيد أول المدة</span>
              </button>
              <button
                onClick={() => openAddEntityModal('CUSTOMER')}
                className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4 text-[#D4AF37]" /> إضافة عميل
              </button>
              <button
                onClick={() => openAddEntityModal('SUPPLIER')}
                className="px-3.5 py-2 bg-[#8B0000] hover:bg-[#660000] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4 text-white" /> إضافة مورد
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-[#8C8273]" />
            <input
              type="text"
              placeholder="البحث باسم العميل / الجمعية، المورد، الرقم الضريبي، أو رقم الهاتف..."
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-[#E5E1DA] rounded-xl text-xs text-[#1A1A1A] focus:outline-hidden focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customers List */}
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[#B8860B] flex items-center justify-between border-b pb-2">
                <span>قائمة العملاء والجمعيات التعاونية (Customers)</span>
                <span>العدد: {scopedCustomers.length}</span>
              </h4>
              <div className="divide-y divide-[#E5E1DA] max-h-[600px] overflow-y-auto">
                {scopedCustomers
                  .filter((c) =>
                    !entitySearch ||
                    matchesSearch(c.nameAr, entitySearch) ||
                    matchesSearch((c as any).nameEn, entitySearch) ||
                    matchesSearch(c.code, entitySearch) ||
                    matchesSearch(c.phone, entitySearch)
                  )
                  .map((c) => (
                    <div key={c.id} className="py-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-extrabold text-[#1A1A1A] text-sm flex items-center gap-2">
                            <span>{c.nameAr}</span>
                            {c.code && <span className="text-[10px] bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#E5E1DA] text-[#8C8273] font-mono">{c.code}</span>}
                          </div>
                          <div className="text-[11px] text-[#8C8273] mt-0.5 space-x-2 space-x-reverse">
                            <span>هاتف: {c.phone || '-'}</span>
                            <span>• الضريبي: {c.taxNumber || 'غير مدخل'}</span>
                            {c.governorate && <span>• {c.governorate}</span>}
                          </div>
                          <div className="text-[10px] text-[#9E2A2B] font-semibold mt-1">
                            الرصيد الافتتاحي ({c.openingBalanceDate || '2026-07-01'}): {formatCurrency(c.openingBalance || 0, currency)}
                          </div>
                        </div>
                        <div className="text-left font-black text-sm text-[#B8860B] bg-[#FFFDF0] px-3 py-1.5 rounded-xl border border-[#F3E5AB]">
                          <span className="text-[10px] text-[#8C8273] font-normal block">الرصيد الحالي</span>
                          {formatCurrency(getCustomerCurrentBalance(c), currency)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-dashed border-[#F0ECE1]">
                        <button
                          onClick={() => handleOpenStatement(c.id, 'CUSTOMER')}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-black text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Printer className="w-3 h-3 text-[#D4AF37]" />
                          كشف حساب تفصيلي
                        </button>
                        <button
                          onClick={() => openEditEntityModal(c, 'CUSTOMER')}
                          className="px-2.5 py-1 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-[#E5E1DA]"
                        >
                          تعديل البيانات
                        </button>
                        <button
                          onClick={() => handleDeleteEntity(c.id, c.nameAr, 'CUSTOMER')}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-red-200"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Suppliers List */}
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[#9E2A2B] flex items-center justify-between border-b pb-2">
                <span>قائمة الموردين والشركات الموردة (Suppliers)</span>
                <span>العدد: {scopedSuppliers.length}</span>
              </h4>
              <div className="divide-y divide-[#E5E1DA] max-h-[600px] overflow-y-auto">
                {scopedSuppliers
                  .filter((s) =>
                    !entitySearch ||
                    matchesSearch(s.nameAr, entitySearch) ||
                    matchesSearch((s as any).nameEn, entitySearch) ||
                    matchesSearch(s.code, entitySearch) ||
                    matchesSearch(s.phone, entitySearch)
                  )
                  .map((s) => (
                    <div key={s.id} className="py-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-extrabold text-[#1A1A1A] text-sm flex items-center gap-2">
                            <span>{s.nameAr}</span>
                            {s.code && <span className="text-[10px] bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#E5E1DA] text-[#8C8273] font-mono">{s.code}</span>}
                          </div>
                          <div className="text-[11px] text-[#8C8273] mt-0.5 space-x-2 space-x-reverse">
                            <span>هاتف: {s.phone || '-'}</span>
                            <span>• الضريبي: {s.taxNumber || 'غير مدخل'}</span>
                          </div>
                          <div className="text-[10px] text-[#2D6A4F] font-semibold mt-1">
                            الرصيد الافتتاحي ({s.openingBalanceDate || '2026-07-01'}): {formatCurrency(s.openingBalance || 0, currency)}
                          </div>
                        </div>
                        <div className="text-left font-black text-sm text-[#9E2A2B] bg-[#FFF5F5] px-3 py-1.5 rounded-xl border border-[#FFD8D8]">
                          <span className="text-[10px] text-[#8C8273] font-normal block">الرصيد المستحق</span>
                          {formatCurrency(getSupplierCurrentBalance(s), currency)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-dashed border-[#F0ECE1]">
                        <button
                          onClick={() => handleOpenStatement(s.id, 'SUPPLIER')}
                          className="px-2.5 py-1 bg-[#8B0000] hover:bg-[#660000] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Printer className="w-3 h-3 text-white" />
                          كشف حساب تفصيلي
                        </button>
                        <button
                          onClick={() => openEditEntityModal(s, 'SUPPLIER')}
                          className="px-2.5 py-1 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-[#E5E1DA]"
                        >
                          تعديل البيانات
                        </button>
                        <button
                          onClick={() => handleDeleteEntity(s.id, s.nameAr, 'SUPPLIER')}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-red-200"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INVENTORY & PACK SPECIFICATIONS */}
      {subTab === 'inventory' && (
        <div className="space-y-4">
          {/* Sub-mode switcher */}
          <div className="flex items-center justify-between bg-white border border-[#E5E1DA] p-2 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInventoryViewMode('catalog')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inventoryViewMode === 'catalog'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-[#8C8273] hover:bg-[#F7F5F0] hover:text-[#1A1A1A]'
                }`}
              >
                <Box className="w-4 h-4 text-[#D4AF37]" />
                <span>دليل بطاقات الأصناف والشد (Catalog & Packs)</span>
              </button>

              <button
                type="button"
                onClick={() => setInventoryViewMode('audit_ledger')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inventoryViewMode === 'audit_ledger'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-[#8C8273] hover:bg-[#F7F5F0] hover:text-[#1A1A1A]'
                }`}
              >
                <Layers className="w-4 h-4 text-[#D4AF37]" />
                <span>فحص وتقييم المخزون ودفتر الأستاذ IFRS (ERPNext Mode)</span>
              </button>
            </div>
          </div>

          {inventoryViewMode === 'audit_ledger' ? (
            <StockLedgerAndAuditView
              inventory={inventory}
              invoices={invoices}
              productionOrders={productionOrders}
              currency={currency}
              onRefreshData={onRefreshAll}
              initialItemId={selectedStockAuditItemId}
            />
          ) : (
            <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                    <Box className="w-5 h-5 text-[#D4AF37]" />
                    دليل الاصناف والمخزون وحاسبة الشد (Pack Units)
                  </h3>
                  <p className="text-xs text-[#8C8273]">
                    إدارة كميات المخزون بالقطعة/الحبة وبـ الشد/الكرتون مع تنبيهات مستوى الحد الأدنى والباركود.
                  </p>
                </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-[#F7F5F0] border border-[#E5E1DA] px-3 py-2 rounded-lg text-xs font-bold text-[#1A1A1A] outline-none"
              >
                <option value="ALL">جميع التصنيفات ({inventory.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-[#8C8273]" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="بحث بالاسم، الباركود، أو SKU..."
                  className="w-full pr-9 pl-3 py-2 bg-[#F7F5F0] border border-[#E5E1DA] rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <button
                onClick={() => setIsPriceModalOpen(true)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="إدارة وتعديل أسعار البيع والتكلفة وهوامش الربح والتسعير الجماعي"
              >
                <TrendingUp className="w-4 h-4 text-emerald-200" />
                <span>إدارة أسعار البيع والتكلفة</span>
              </button>

              <button
                onClick={() => handleOpenImport('INVENTORY')}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="استيراد بطاقات الأصناف مع الأسعار وأرصدة أول المدة"
              >
                <Upload className="w-4 h-4 text-cyan-200" />
                <span>استيراد الأصناف + رصيد وتكلفة</span>
              </button>

              <button
                onClick={openAddItemModal}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4 text-[#D4AF37]" /> إضافة صنف جديد
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th className="py-3 px-4">الرمز / الباركود</th>
                  <th className="py-3 px-4">اسم المنتج والصنف</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4 text-center">تفاصيل الشد والعبوة</th>
                  <th className="py-3 px-4">سعر التكلفة</th>
                  <th className="py-3 px-4">سعر البيع</th>
                  <th className="py-3 px-4 text-center">الرصيد بالمستودع</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {filteredInventory.map((item) => {
                  const isLow = item.quantityOnHand <= (item.minQuantityAlert || 5);
                  const packUnits = item.unitsPerPack > 1 ? Math.floor(item.quantityOnHand / item.unitsPerPack) : 0;
                  const packRem = item.unitsPerPack > 1 ? item.quantityOnHand % item.unitsPerPack : 0;

                  return (
                    <tr key={item.id} className="hover:bg-[#FDFCFB] transition-all">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-[#B8860B]">{item.sku}</div>
                        {item.barcode && <div className="text-[10px] text-[#8C8273]">QR: {item.barcode}</div>}
                      </td>

                      <td className="py-3 px-4 font-bold text-[#1A1A1A]">{item.nameAr}</td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-[#F7F5F0] text-[#6E6659] rounded-md font-semibold text-[11px] border">
                          {item.category || 'عام'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-semibold">
                        <div className="text-[#1A1A1A]">{item.unit || 'حبة'}</div>
                        {item.unitsPerPack > 1 && (
                          <div className="text-[10px] text-[#2D6A4F] font-bold">
                            (الشد: {item.unitsPerPack} حبة / {item.packUnit || 'كرتون'})
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">{formatCurrency(item.purchasePrice, currency)}</td>

                      <td className="py-3 px-4 font-bold text-[#2D6A4F]">
                        {formatCurrency(item.salePrice, currency)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className={`font-extrabold text-sm ${
                              isLow ? 'text-rose-600' : 'text-[#1A1A1A]'
                            }`}
                          >
                            {item.quantityOnHand} {item.unit || 'حبة'}
                          </span>
                          {isLow && (
                            <span title="تنبيه: مخزون منخفض!">
                              <AlertTriangle className="w-4 h-4 text-rose-500 inline" />
                            </span>
                          )}
                        </div>

                        {item.unitsPerPack > 1 && (
                          <div className="text-[10px] text-[#8C8273]">
                            يعادل: <span className="font-bold text-black">{packUnits}</span> {item.packUnit || 'كرتون'}
                            {packRem > 0 ? ` + ${packRem} ${item.unit}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStockAuditItemId(item.id);
                              setInventoryViewMode('audit_ledger');
                            }}
                            className="p-1.5 text-amber-700 hover:text-amber-950 hover:bg-amber-100/70 rounded-lg transition-all cursor-pointer"
                            title="عرض كارت حركة الصنف وضبط الجودة والإطلاق"
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditItemModal(item)}
                            className="p-1.5 text-[#6E6659] hover:text-[#1A1A1A] hover:bg-[#F7F5F0] rounded-lg transition-all cursor-pointer"
                            title="تعديل الصنف والشد"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
      )}

      {/* TAB 5: UNITS MANAGEMENT */}
      {subTab === 'units' && (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E1DA] pb-3 gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#B8860B]" />
                دليل ووحدات القياس والتعبئة والشد (Units & Packaging)
              </h3>
              <p className="text-xs text-[#8C8273]">
                تعريف وحدات التعبئة (كرتون، حبة، درزن، شدة، طقم، كيلو، طن) ومعاملات التحويل التلقائية بالفواتير.
              </p>
            </div>
            <button
              onClick={handleOpenAddUnit}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              إضافة وحدة قياس جديدة
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
                <tr>
                  <th className="py-3 px-4">رمز الوحدة</th>
                  <th className="py-3 px-4">اسم الوحدة (عربي)</th>
                  <th className="py-3 px-4">اسم الوحدة (إنجليزي)</th>
                  <th className="py-3 px-4 text-center">معامل التحويل (الشد)</th>
                  <th className="py-3 px-4 text-center">نوع الوحدة</th>
                  <th className="py-3 px-4">الملاحظات</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1DA]">
                {(units && units.length > 0 ? units : [
                  { id: 'u-1', code: 'PCS', nameAr: 'حبة', nameEn: 'Piece', conversionFactor: 1, isBaseUnit: true },
                  { id: 'u-2', code: 'CTN', nameAr: 'كرتون', nameEn: 'Carton', conversionFactor: 24, isBaseUnit: false },
                  { id: 'u-3', code: 'BOX', nameAr: 'علبة / صندوق', nameEn: 'Box', conversionFactor: 12, isBaseUnit: false },
                  { id: 'u-4', code: 'DOZ', nameAr: 'درزن', nameEn: 'Dozen', conversionFactor: 12, isBaseUnit: false },
                  { id: 'u-5', code: 'PKG', nameAr: 'شدة / طقم', nameEn: 'Package', conversionFactor: 6, isBaseUnit: false },
                ]).map((u) => (
                  <tr key={u.id} className="hover:bg-[#FDFCFB] transition-all">
                    <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">{u.code}</td>
                    <td className="py-3 px-4 font-bold text-[#1A1A1A]">{u.nameAr}</td>
                    <td className="py-3 px-4 text-[#8C8273] font-mono">{u.nameEn}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono">
                      {u.conversionFactor} {u.isBaseUnit ? '(وحدة أساسية)' : 'حبة'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isBaseUnit
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {u.isBaseUnit ? 'وحدة رئيسية أصغر' : 'وحدة شد / تجميعية'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#8C8273]">{u.description || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditUnit(u)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer"
                          title="تعديل الوحدة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnitRow(u)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="حذف الوحدة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Screen Invoice Creation & Posting Modal */}
      {isInvoiceModalOpen && (() => {
        const grossSubtotal = invLines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);
        const lineDiscountsTotal = invLines.reduce((acc, l) => {
          const gross = l.quantity * l.unitPrice;
          const disc = l.discountType === 'PERCENT' ? (gross * (l.discountValue || 0)) / 100 : (l.discountValue || 0);
          return acc + Math.min(gross, disc);
        }, 0);
        const subtotalAfterLines = Math.max(0, grossSubtotal - lineDiscountsTotal);
        const invDiscountAmount = invDiscountType === 'PERCENT'
          ? (subtotalAfterLines * (invDiscountValue || 0)) / 100
          : (invDiscountValue || 0);
        const totalDiscount = lineDiscountsTotal + Math.min(subtotalAfterLines, invDiscountAmount);
        const calculatedGrandTotal = Math.max(0, grossSubtotal - totalDiscount);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto dir-rtl text-right">
            <div className="bg-white border border-[#E5E1DA] w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-auto">
              {/* Header */}
              <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between border-b border-black">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/20 rounded-xl border border-[#D4AF37]/40">
                    <ShoppingBag className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      إصدار وترحيل الفواتير والإشعارات المحاسبية
                      <span className="text-[10px] bg-[#D4AF37] text-black px-2 py-0.5 rounded-full font-bold">
                        نظام معتمد بدون ضرائب (0%)
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400">إنشاء وترحيل قيود اليومية، المخزون، وحسابات الذمم المدينة والدائنة تلقائياً</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs bg-[#FAF9F6]">
                {/* Document Type Selector Bar */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-[#1A1A1A]">نوع المعاملة المالية *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'SALES', label: 'فاتورة مبيعات', color: 'border-blue-500 bg-blue-50/50 text-blue-900' },
                      { id: 'PURCHASE', label: 'فاتورة مشتريات', color: 'border-purple-500 bg-purple-50/50 text-purple-900' },
                      { id: 'SALES_RETURN', label: 'إشعار دائن (مرتجع مبيعات)', color: 'border-rose-500 bg-rose-50/50 text-rose-900' },
                      { id: 'PURCHASE_RETURN', label: 'إشعار مدين (مرتجع مشتريات)', color: 'border-amber-500 bg-amber-50/50 text-amber-900' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setInvType(t.id as any);
                          setInvEntityId('');
                        }}
                        className={`p-3 rounded-xl border-2 font-bold cursor-pointer text-center transition-all ${
                          invType === t.id
                            ? `${t.color} font-extrabold shadow-sm ring-2 ring-black/10`
                            : 'border-[#E5E1DA] bg-white text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Terms & Invoice Meta Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-[#E5E1DA]">
                  <div className="sm:col-span-2">
                    <CustomerSearchCombobox
                      entities={invType === 'SALES' || invType === 'SALES_RETURN' ? scopedCustomers : scopedSuppliers}
                      selectedId={invEntityId}
                      onSelect={(id) => setInvEntityId(id)}
                      entityType={invType === 'SALES' || invType === 'SALES_RETURN' ? 'CUSTOMER' : 'SUPPLIER'}
                      currency={currency}
                      getBalance={invType === 'SALES' || invType === 'SALES_RETURN' ? getCustomerCurrentBalance : getSupplierCurrentBalance}
                      required
                    />
                  </div>

                  {/* Manual Document Date */}
                  <div>
                    <label className="block font-bold text-[#1A1A1A] mb-1">
                      تاريخ المستند / الفاتورة *
                    </label>
                    <input
                      type="date"
                      required
                      value={invDate}
                      onChange={(e) => {
                        setInvDate(e.target.value);
                        if (!invDueDate || invDueDate < e.target.value) {
                          setInvDueDate(e.target.value);
                        }
                      }}
                      className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A] outline-none"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block font-bold text-[#1A1A1A] mb-1">
                      تاريخ الاستحقاق
                    </label>
                    <input
                      type="date"
                      value={invDueDate}
                      onChange={(e) => setInvDueDate(e.target.value)}
                      className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A] outline-none"
                    />
                  </div>

                  {/* Payment Terms (Cash / Credit) */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#1A1A1A] mb-1">طريقة الدفع وشروط السداد *</label>
                    <div className="grid grid-cols-2 gap-2 h-10">
                      <button
                        type="button"
                        onClick={() => setInvPaymentTerms('CASH')}
                        className={`rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                          invPaymentTerms === 'CASH'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-[#F9F8F6] text-neutral-700 border-[#E5E1DA] hover:bg-neutral-100'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        نقدي (كاش)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvPaymentTerms('CREDIT')}
                        className={`rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                          invPaymentTerms === 'CREDIT'
                            ? 'bg-[#1A1A1A] text-white border-black shadow-xs'
                            : 'bg-[#F9F8F6] text-neutral-700 border-[#E5E1DA] hover:bg-neutral-100'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                        آجل (ذمم / حساب)
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#1A1A1A] mb-1">البيان والشروط التعاقدية للمستند</label>
                    <input
                      type="text"
                      placeholder="بيان شروط التسليم أو رقم أمر التوريد والاعتماد المالي..."
                      value={invNotes}
                      onChange={(e) => setInvNotes(e.target.value)}
                      className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#1A1A1A] mb-1">اسم البائع / مندوب المبيعات</label>
                    <input
                      type="text"
                      placeholder="اسم مسؤول المبيعات والتسليم..."
                      value={invSalesPerson}
                      onChange={(e) => setInvSalesPerson(e.target.value)}
                      className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2 text-[#1A1A1A] font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#1A1A1A] mb-1">اسم المستلم / مندوب الاستلام (العميل)</label>
                    <input
                      type="text"
                      placeholder="اسم المستلم لدى العميل / الجمعية التعاونية..."
                      value={invReceiverName}
                      onChange={(e) => setInvReceiverName(e.target.value)}
                      className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2 text-[#1A1A1A] font-semibold"
                    />
                  </div>
                </div>

                {/* Line Items Table with Dedicated Columns */}
                <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2">
                    <h4 className="font-extrabold text-[#1A1A1A] text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#D4AF37]" />
                      جدول أصناف وبنود الفاتورة
                    </h4>
                    <span className="text-[11px] text-[#8C8273]">
                      العملة الوظيفية: <strong>{currency}</strong> (3 خانات عشرية)
                    </span>
                  </div>

                  {/* Desktop Table View */}
                  <div className="overflow-x-auto border border-[#E5E1DA] rounded-xl min-h-[280px]">
                    <table className="w-full text-xs text-right border-collapse min-w-[760px]">
                      <thead>
                        <tr className="bg-[#1A1A1A] text-white text-[11px] font-bold">
                          <th className="py-2.5 px-2 text-center w-8 border-l border-neutral-700">م</th>
                          <th className="py-2.5 px-2 w-28 border-l border-neutral-700">رقم الصنف</th>
                          <th className="py-2.5 px-2 border-l border-neutral-700">اسم الصنف والبيان</th>
                          <th className="py-2.5 px-2 text-center w-20 border-l border-neutral-700">الكمية</th>
                          <th className="py-2.5 px-2 text-center w-16 border-l border-neutral-700">الوحدة</th>
                          <th className="py-2.5 px-2 text-center w-16 border-l border-neutral-700">الشد</th>
                          <th className="py-2.5 px-2 text-center w-20 border-l border-neutral-700">كراتين (شد)</th>
                          <th className="py-2.5 px-2 text-left w-24 border-l border-neutral-700">السعر</th>
                          <th className="py-2.5 px-2 text-left w-32 border-l border-neutral-700">الخصم (نسبة/مبلغ)</th>
                          <th className="py-2.5 px-2 text-left w-24 border-l border-neutral-700">السعر الإجمالي</th>
                          <th className="py-2.5 px-2 text-center w-10">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1DA] bg-white">
                        {invLines.map((line, idx) => {
                          const selItem = inventory.find((i) => i.id === line.itemId);
                          const unitsPerPack = Number(line.unitsPerPack) || Number(selItem?.unitsPerPack) || 1;
                          const lineGross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                          const lineDisc =
                            line.discountType === 'PERCENT'
                              ? (lineGross * Math.min(100, Math.max(0, Number(line.discountValue) || 0))) / 100
                              : Math.min(lineGross, Number(line.discountValue) || 0);
                          const lineNet = Math.max(0, lineGross - lineDisc);

                          return (
                            <tr key={idx} className="hover:bg-[#FAF9F6] transition-colors">
                              {/* # */}
                              <td className="py-2 px-2 text-center font-bold text-neutral-500 border-l border-[#E5E1DA]">
                                {idx + 1}
                              </td>

                              {/* رقم الصنف SKU / Barcode */}
                              <td className="py-2 px-2 border-l border-[#E5E1DA]">
                                <input
                                  type="text"
                                  placeholder="رقم الصنف"
                                  value={line.itemSku || line.barcode || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...invLines];
                                    updated[idx].itemSku = val;
                                    const cleanVal = val.trim().toLowerCase();
                                    const matched = scopedInventory.find(
                                      (i) =>
                                        (i.sku && i.sku.toLowerCase() === cleanVal) ||
                                        (i.barcode && i.barcode === val.trim()) ||
                                        i.id === val.trim()
                                    );
                                    if (matched) {
                                      handleInvItemSelect(idx, matched.id, matched);
                                    } else {
                                      setInvLines(updated);
                                    }
                                  }}
                                  className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg px-2 py-1 font-mono text-[11px] font-bold text-black"
                                />
                              </td>

                              {/* اسم الصنف والبيان - بحث مزدوج فوري بالكود والاسم */}
                              <td className="py-2 px-2 border-l border-[#E5E1DA] min-w-[240px]">
                                <InvoiceItemSearchCombobox
                                  inventory={scopedInventory}
                                  selectedItemId={line.itemId}
                                  selectedItemName={line.itemNameAr || ''}
                                  selectedSku={line.itemSku || ''}
                                  selectedBarcode={line.barcode || ''}
                                  onSelectItem={(item) => handleInvItemSelect(idx, item.id, item)}
                                  onCustomNameChange={(customName) => {
                                    const updated = [...invLines];
                                    updated[idx].itemNameAr = customName;
                                    setInvLines(updated);
                                  }}
                                  invType={invType}
                                  currency={currency}
                                  placeholder="انقر لاختيار صنف أو ابحث بالاسم/الكود..."
                                />
                              </td>

                              {/* الكمية */}
                              <td className="py-2 px-2 border-l border-[#E5E1DA]">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value) || 0;
                                    const updated = [...invLines];
                                    updated[idx].quantity = qty;
                                    if (unitsPerPack > 1) {
                                      updated[idx].packQuantity = Math.floor(qty / unitsPerPack);
                                    }
                                    setInvLines(updated);
                                  }}
                                  className="w-full bg-white border border-[#E5E1DA] rounded-lg px-1.5 py-1 text-center font-mono font-extrabold text-black"
                                />
                              </td>

                              {/* الوحده */}
                              <td className="py-2 px-2 text-center border-l border-[#E5E1DA]">
                                <input
                                  type="text"
                                  value={line.unit || 'حبة'}
                                  onChange={(e) => {
                                    const updated = [...invLines];
                                    updated[idx].unit = e.target.value;
                                    setInvLines(updated);
                                  }}
                                  className="w-full bg-transparent border-0 text-center font-bold text-neutral-700 text-xs"
                                />
                              </td>

                              {/* الشد */}
                              <td className="py-2 px-2 text-center border-l border-[#E5E1DA]">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.unitsPerPack || 1}
                                  onChange={(e) => {
                                    const upp = Math.max(1, Number(e.target.value) || 1);
                                    const updated = [...invLines];
                                    updated[idx].unitsPerPack = upp;
                                    if (updated[idx].packQuantity > 0) {
                                      updated[idx].quantity = updated[idx].packQuantity * upp;
                                    }
                                    setInvLines(updated);
                                  }}
                                  className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg px-1 py-1 text-center font-mono font-bold text-neutral-800 text-xs"
                                />
                              </td>

                              {/* البيع بالشد (كراتين) */}
                              <td className="py-2 px-2 text-center border-l border-[#E5E1DA]">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={line.packQuantity || ''}
                                  onChange={(e) => {
                                    const packQty = Number(e.target.value) || 0;
                                    const updated = [...invLines];
                                    updated[idx].packQuantity = packQty;
                                    if (packQty > 0) {
                                      updated[idx].quantity = packQty * unitsPerPack;
                                    }
                                    setInvLines(updated);
                                  }}
                                  className="w-full bg-amber-50/40 border border-amber-200 rounded-lg px-1 py-1 text-center font-mono font-bold text-amber-900 text-xs"
                                  title="إدخال الكمية بعدد الكراتين/الشدات"
                                />
                              </td>

                              {/* السعر */}
                              <td className="py-2 px-2 border-l border-[#E5E1DA]">
                                <input
                                  type="number"
                                  step="0.001"
                                  value={line.unitPrice}
                                  onChange={(e) => {
                                    const updated = [...invLines];
                                    updated[idx].unitPrice = Number(e.target.value) || 0;
                                    setInvLines(updated);
                                  }}
                                  className="w-full bg-white border border-[#E5E1DA] rounded-lg px-1.5 py-1 text-left font-mono font-bold text-[#1A1A1A]"
                                />
                              </td>

                              {/* الخصم (نسبة / مبلغ) */}
                              <td className="py-2 px-2 border-l border-[#E5E1DA]">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step={line.discountType === 'PERCENT' ? '1' : '0.001'}
                                    min="0"
                                    placeholder="0"
                                    value={line.discountValue || ''}
                                    onChange={(e) => {
                                      const updated = [...invLines];
                                      updated[idx].discountValue = Number(e.target.value) || 0;
                                      setInvLines(updated);
                                    }}
                                    className="w-full bg-white border border-[#E5E1DA] rounded-lg px-1.5 py-1 text-left font-mono font-bold text-amber-800 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...invLines];
                                      updated[idx].discountType =
                                        updated[idx].discountType === 'PERCENT' ? 'FIXED' : 'PERCENT';
                                      setInvLines(updated);
                                    }}
                                    className={`px-1.5 py-1 rounded text-[10px] font-bold cursor-pointer border ${
                                      line.discountType === 'PERCENT'
                                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                                        : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                                    }`}
                                    title="تبديل الخصم: نسبة مئوية (%) أو مبلغ ثابت"
                                  >
                                    {line.discountType === 'PERCENT' ? '%' : 'مبلغ'}
                                  </button>
                                </div>
                              </td>

                              {/* السعر الإجمالي */}
                              <td className="py-2 px-2 text-left font-mono font-extrabold text-[#2D6A4F] border-l border-[#E5E1DA]">
                                {formatCurrency(lineNet, currency)}
                              </td>

                              {/* حذف */}
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInvLine(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                                  title="حذف هذا البند"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAddInvLine}
                      className="px-4 py-2 bg-[#FAF9F6] border border-[#E5E1DA] hover:border-black rounded-xl text-black font-extrabold cursor-pointer hover:bg-white flex items-center gap-2 shadow-2xs transition-all"
                    >
                      <Plus className="w-4 h-4 text-[#D4AF37]" />
                      إضافة صنف آخر إلى الفاتورة
                    </button>

                    <div className="text-xs font-bold text-neutral-600">
                      عدد البنود: <span className="font-mono text-black">{invLines.length}</span> | إجمالي الكميات: <span className="font-mono text-black">{invLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Overall Invoice Discount & Totals Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  {/* Tafqeet & Overall Discount Inputs */}
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-xl border border-[#E5E1DA] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-[#1A1A1A]">
                          خصم إجمالي إضافي على كامل الفاتورة
                        </label>
                        <span className="text-[10px] text-neutral-500">اختر نسبة مئوية أو مبلغ ثابت</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={invDiscountType === 'PERCENT' ? '1' : '0.001'}
                          min="0"
                          placeholder="قيمة الخصم الإضافي..."
                          value={invDiscountValue || ''}
                          onChange={(e) => setInvDiscountValue(Number(e.target.value) || 0)}
                          className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-2.5 font-mono font-bold text-amber-900 text-sm outline-none"
                        />
                        <div className="flex border border-[#E5E1DA] rounded-lg overflow-hidden shrink-0 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setInvDiscountType('FIXED')}
                            className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                              invDiscountType === 'FIXED'
                                ? 'bg-[#1A1A1A] text-white'
                                : 'bg-white text-[#6E6659] hover:bg-neutral-50'
                            }`}
                          >
                            مبلغ ثابت ({currency})
                          </button>
                          <button
                            type="button"
                            onClick={() => setInvDiscountType('PERCENT')}
                            className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                              invDiscountType === 'PERCENT'
                                ? 'bg-[#1A1A1A] text-white'
                                : 'bg-white text-[#6E6659] hover:bg-neutral-50'
                            }`}
                          >
                            نسبة مئوية (%)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                      <span className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        التفقيط المعتمد للمستند:
                      </span>
                      <p className="text-xs font-serif font-extrabold text-black leading-relaxed">
                        {tafqeetCurrency(calculatedGrandTotal, currency)}
                      </p>
                    </div>
                  </div>

                  {/* Summary Math */}
                  <div className="bg-white p-4 rounded-xl border border-[#E5E1DA] space-y-2.5 shadow-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>المجموع الإجمالي قبل الخصم:</span>
                      <span className="font-mono font-bold text-black">{formatCurrency(grossSubtotal, currency)}</span>
                    </div>

                    {lineDiscountsTotal > 0 && (
                      <div className="flex justify-between text-amber-800">
                        <span>إجمالي خصومات الأصناف:</span>
                        <span className="font-mono font-bold">-{formatCurrency(lineDiscountsTotal, currency)}</span>
                      </div>
                    )}

                    {invDiscountAmount > 0 && (
                      <div className="flex justify-between text-amber-800">
                        <span>
                          خصم الفاتورة الإضافي {invDiscountType === 'PERCENT' ? `(${invDiscountValue}%)` : '(مبلغ)'}:
                        </span>
                        <span className="font-mono font-bold">
                          -{formatCurrency(Math.min(subtotalAfterLines, invDiscountAmount), currency)}
                        </span>
                      </div>
                    )}

                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-amber-900 font-bold border-t border-neutral-200 pt-1">
                        <span>إجمالي الخصم الممنوح:</span>
                        <span className="font-mono font-extrabold">-{formatCurrency(totalDiscount, currency)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-extrabold text-black pt-2 border-t-2 border-[#E5E1DA] bg-[#FAF9F6] p-2.5 rounded-lg">
                      <span>صافي القيمة المستحقة:</span>
                      <span className="font-mono text-emerald-800 text-lg font-black">{formatCurrency(calculatedGrandTotal, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Footer */}
              <div className="bg-white px-6 py-4 border-t border-[#E5E1DA] flex items-center justify-between no-print">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E5E1DA] text-[#6E6659] font-bold rounded-xl hover:bg-[#F7F5F0] cursor-pointer"
                >
                  إلغاء
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleSaveInvoice(e, false)}
                    className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black font-extrabold rounded-xl border border-neutral-300 cursor-pointer transition-all"
                  >
                    حفظ كمسودة غير مرحلة
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleSaveInvoice(e, true)}
                    className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-extrabold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                    اصدار الفاتورة وترحيلها مالياً الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Voucher Creation Modal */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 dir-rtl text-right">
            <div className="flex justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#D4AF37]" />
                إصدار سند قبض / صرف نقدية
              </h3>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                className="text-[#8C8273] font-bold hover:text-[#1A1A1A]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1A1A1A] mb-1">نوع السند المالي *</label>
                  <select
                    value={vouchType}
                    onChange={(e) => setVouchType(e.target.value as any)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A]"
                  >
                    <option value="RECEIPT">سند قبض (تحصيل مالي من عميل)</option>
                    <option value="PAYMENT">سند صرف (دفع سداد لمورد)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1A1A1A] mb-1">تاريخ السند *</label>
                  <input
                    type="date"
                    required
                    value={vouchDate}
                    onChange={(e) => setVouchDate(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A] outline-none"
                  />
                </div>
              </div>

              <div>
                <CustomerSearchCombobox
                  entities={vouchType === 'RECEIPT' ? scopedCustomers : scopedSuppliers}
                  selectedId={vouchEntityId}
                  onSelect={(id) => setVouchEntityId(id)}
                  entityType={vouchType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER'}
                  currency={currency}
                  getBalance={vouchType === 'RECEIPT' ? getCustomerCurrentBalance : getSupplierCurrentBalance}
                  label="الجهة المعنية *"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#1A1A1A] mb-1">المبلغ الصافي *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={vouchAmount}
                  onChange={(e) => setVouchAmount(Number(e.target.value) || 0)}
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#2D6A4F] font-extrabold text-base"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1A1A1A] mb-1">حساب الإيداع / الخزينة</label>
                <select
                  value={vouchBankAcc}
                  onChange={(e) => setVouchBankAcc(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                >
                  <option value="acc-1111">البنك الأهلي التجاري - الحساب الرئيسي</option>
                  <option value="acc-1112">الصندوق الرئيسي (الخزينة النقدية)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1A1A1A] mb-1">البيان والشرح التفصيلي</label>
                <input
                  type="text"
                  placeholder="سبب التحصيل أو السداد..."
                  value={vouchNotes}
                  onChange={(e) => setVouchNotes(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1A1A1A] text-white font-bold rounded-lg hover:bg-black shadow-sm"
                >
                  حفظ السند وترحيله
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Creation/Editing Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 dir-rtl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <Box className="w-5 h-5 text-[#D4AF37]" />
                {editingItem ? 'تعديل بيانات الصنف وحاسبة الشد' : 'إضافة صنف منتج جديد بالمستودع'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-[#8C8273] font-bold hover:text-[#1A1A1A]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">رمز الصنف SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-mono text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الباركود (Barcode/QR)</label>
                  <input
                    type="text"
                    value={itemBarcode}
                    onChange={(e) => setItemBarcode(e.target.value)}
                    placeholder="6281100..."
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-mono text-[#1A1A1A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">اسم المنتج أو الصنف بالعربي *</label>
                <input
                  type="text"
                  required
                  value={itemNameAr}
                  onChange={(e) => setItemNameAr(e.target.value)}
                  placeholder="مثال: كابلات شبكة ألياف Cat6"
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">التصنيف الرئيسي *</label>
                  <input
                    type="text"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    placeholder="مستلزمات، خوادم، برمجيات..."
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الوحدة الأساسية *</label>
                  <input
                    type="text"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    placeholder="حبة، لفة، طقم..."
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>
              </div>

              {/* Pack settings (الشد) */}
              <div className="p-3 bg-[#F7F5F0] border border-[#E5E1DA] rounded-xl space-y-3">
                <span className="font-bold text-[#1A1A1A] block">إعدادات الشد والعبوات الكبرى (Pack Specs)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#6E6659] font-bold mb-1">
                      الشد (عدد الحبات بـ العبوة الكبرى)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemUnitsPerPack}
                      onChange={(e) => setItemUnitsPerPack(Number(e.target.value) || 1)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-lg p-2 font-bold text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#6E6659] font-bold mb-1">اسم العبوة الكبرى</label>
                    <input
                      type="text"
                      value={itemPackUnit}
                      onChange={(e) => setItemPackUnit(e.target.value)}
                      placeholder="كرتون، شدة، صندوق..."
                      className="w-full bg-white border border-[#E5E1DA] rounded-lg p-2 font-bold text-[#1A1A1A]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">سعر الشراء (التكلفة للحبة)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemPurchase}
                    onChange={(e) => setItemPurchase(Number(e.target.value) || 0)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">سعر البيع الافتراضي للحبة</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemSale}
                    onChange={(e) => setItemSale(Number(e.target.value) || 0)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#2D6A4F] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الرصيد الافتتاحي (بالحبة)</label>
                  <input
                    type="number"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value) || 0)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الحد الأدنى للتنبيه</label>
                  <input
                    type="number"
                    value={itemMinAlert}
                    onChange={(e) => setItemMinAlert(Number(e.target.value) || 5)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-rose-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1A1A1A] text-white font-bold rounded-lg hover:bg-black shadow-sm"
                >
                  حفظ الصنف والبيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entity Modal */}
      {isEntityModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 dir-rtl text-right text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-3">
              <h3 className="font-extrabold text-base text-[#1A1A1A]">
                {editingEntity
                  ? `تعديل بيانات ${entityKind === 'CUSTOMER' ? 'العميل' : 'المورد'}`
                  : `إضافة ${entityKind === 'CUSTOMER' ? 'عميل / جمعية' : 'مورد'} جديد`}
              </h3>
              <button
                onClick={() => setIsEntityModalOpen(false)}
                className="text-[#8C8273] font-bold hover:text-[#1A1A1A]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEntity} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">النوع</label>
                  <select
                    value={entityKind}
                    onChange={(e) => setEntityKind(e.target.value as any)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-bold"
                  >
                    <option value="CUSTOMER">عميل / جمعية تعاونية</option>
                    <option value="SUPPLIER">مورد / شركة موردة</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">كود الحساب / الجمعية</label>
                  <input
                    type="text"
                    placeholder="مثال: CUST-4001"
                    value={entityCode}
                    onChange={(e) => setEntityCode(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#1A1A1A] font-bold block mb-1">الاسم بالكامل / اسم الجمعية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جمعية الروضة وحولي التعاونية"
                  value={entityNameAr}
                  onChange={(e) => setEntityNameAr(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">الرقم الضريبي / السجل</label>
                  <input
                    type="text"
                    value={entityTaxNo}
                    onChange={(e) => setEntityTaxNo(e.target.value)}
                    placeholder="300012345600003"
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">رقم الهاتف / النقال</label>
                  <input
                    type="text"
                    value={entityPhone}
                    onChange={(e) => setEntityPhone(e.target.value)}
                    placeholder="+965 22000000"
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">المحافظة / المنطقة</label>
                  <input
                    type="text"
                    value={entityGovernorate}
                    onChange={(e) => setEntityGovernorate(e.target.value)}
                    placeholder="العاصمة / حولي / الأحمدي..."
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">المدينة / الدولة</label>
                  <input
                    type="text"
                    value={entityCity}
                    onChange={(e) => setEntityCity(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>
              </div>

              {/* Opening Balance Section */}
              <div className="p-3 bg-[#FFFDF0] border border-[#F3E5AB] rounded-xl space-y-2">
                <span className="font-extrabold text-[#B8860B] block text-xs">
                  الرصيد الافتتاحي السنوي (Opening Balance):
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#6E6659] block mb-1 text-[11px]">المبلغ (دينار كويتي KWD)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={entityOpeningBalance}
                      onChange={(e) => setEntityOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[#E5E1DA] rounded-lg p-2 text-[#1A1A1A] font-bold font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[#6E6659] block mb-1 text-[11px]">تاريخ الرصيد الافتتاحي</label>
                    <input
                      type="date"
                      value={entityOpeningBalanceDate}
                      onChange={(e) => setEntityOpeningBalanceDate(e.target.value)}
                      className="w-full bg-white border border-[#E5E1DA] rounded-lg p-2 text-[#1A1A1A] font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsEntityModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1A1A1A] text-white font-bold rounded-lg hover:bg-black shadow-sm flex items-center gap-1"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Unit Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <Ruler className="w-5 h-5 text-[#B8860B]" />
                {editingUnit ? 'تعديل وحدة القياس والشد' : 'إضافة وحدة قياس جديدة'}
              </h3>
              <button
                onClick={() => setIsUnitModalOpen(false)}
                className="text-[#8C8273] hover:text-[#1A1A1A] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">رمز الوحدة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: CTN"
                    value={unitCode}
                    onChange={(e) => setUnitCode(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">الاسم بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: كرتون"
                    value={unitNameAr}
                    onChange={(e) => setUnitNameAr(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    placeholder="e.g. Carton"
                    value={unitNameEn}
                    onChange={(e) => setUnitNameEn(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono"
                  />
                </div>

                <div>
                  <label className="text-[#1A1A1A] font-bold block mb-1">معامل الشد / التحويل *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="مثال: 24"
                    value={unitFactor}
                    onChange={(e) => setUnitFactor(Number(e.target.value) || 1)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-[#FFFDF0] border border-[#F3E5AB] rounded-lg">
                <input
                  type="checkbox"
                  id="unitIsBase"
                  checked={unitIsBase}
                  onChange={(e) => setUnitIsBase(e.target.checked)}
                  className="rounded text-[#B8860B] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="unitIsBase" className="text-xs font-bold text-[#1A1A1A] cursor-pointer">
                  اعتبار هذه الوحدة كـ (وحدة رئيسية أصغر) للمخزن
                </label>
              </div>

              <div>
                <label className="text-[#1A1A1A] font-bold block mb-1">ملاحظات أو وصف</label>
                <textarea
                  rows={2}
                  placeholder="وصف استخدام الوحدة في التعبئة والتغليف..."
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  حفظ وحدة القياس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* Render Print Modal if active */}
      {printDoc && (
        <PrintDocumentModal
          documentType={printDoc.type}
          data={printDoc.data}
          company={company}
          onClose={() => setPrintDoc(null)}
        />
      )}

      {/* Render Bulk Data Import Modal */}
      {isImportModalOpen && (
        <DataImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          importType={importType}
          currency={currency}
          onSuccess={() => {
            if (onRefreshAll) onRefreshAll();
          }}
        />
      )}

      {/* Render Price Management Modal */}
      {isPriceModalOpen && (
        <PriceManagementModal
          isOpen={isPriceModalOpen}
          onClose={() => setIsPriceModalOpen(false)}
          inventory={inventory}
          currency={currency}
          onSuccess={() => {
            if (onRefreshAll) onRefreshAll();
          }}
        />
      )}

      {/* Render Dedicated Account Statement Modal */}
      {isStatementModalOpen && (
        <AccountStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => setIsStatementModalOpen(false)}
          entityType={statementEntityType}
          selectedEntityId={statementSelectedEntityId}
          customers={customers}
          suppliers={suppliers}
          invoices={invoices}
          vouchers={vouchers}
          company={company}
          currency={currency}
        />
      )}

      {/* Render Negative Stock Confirmation Modal */}
      {isNegativeStockModalOpen && (
        <NegativeStockConfirmationModal
          isOpen={isNegativeStockModalOpen}
          onClose={() => setIsNegativeStockModalOpen(false)}
          onConfirm={handleConfirmNegativeStock}
          deficitItems={deficitItemsList}
          userRole="ADMIN"
          userName="المدير العام / المسؤول المعتمد"
        />
      )}
    </div>
  );
};
