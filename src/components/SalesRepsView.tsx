import React, { useState, useMemo } from 'react';
import {
  SalesRep,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
  InventoryItem,
  Warehouse,
  RepCustodyRecord,
  VanStockItemMovement,
} from '../types.js';
import { formatCurrencyStrict } from '../utils/currencyMatrix.ts';
import { DataService } from '../services/dataService.ts';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  Award,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  FileText,
  Printer,
  Calendar,
  Building2,
  Filter,
  Truck,
  Wallet,
  Coins,
  Download,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Car,
  ClipboardList,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface SalesRepsViewProps {
  salesReps: SalesRep[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  company: CompanyProfile | null;
  currency: string;
  inventory?: InventoryItem[];
  warehouses?: Warehouse[];
  onRefreshAll: () => Promise<void> | void;
}

type TabType = 'DIRECTORY' | 'SUB_LEDGER' | 'VAN_STOCK' | 'PRINTABLE_REPORT';

export const SalesRepsView: React.FC<SalesRepsViewProps> = ({
  salesReps,
  invoices,
  vouchers,
  company,
  currency,
  inventory = [],
  warehouses = [],
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('DIRECTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepId, setSelectedRepId] = useState<string>('ALL');

  // Date Range Filters for Sub-Ledger
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');

  // Modals
  const [isRepModalOpen, setIsRepModalOpen] = useState(false);
  const [isCustodyModalOpen, setIsCustodyModalOpen] = useState(false);
  const [isVanDispatchModalOpen, setIsVanDispatchModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);

  // Rep Form State
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(2.5);
  const [targetAmount, setTargetAmount] = useState<number>(50000);
  const [vanWarehouseId, setVanWarehouseId] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [openingCustody, setOpeningCustody] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Custody Movement Form State
  const [custodyRepId, setCustodyRepId] = useState<string>('');
  const [custodyType, setCustodyType] = useState<'ADVANCE' | 'REMITTANCE'>('ADVANCE');
  const [custodyAmount, setCustodyAmount] = useState<number>(0);
  const [custodyRef, setCustodyRef] = useState<string>('');
  const [custodyDate, setCustodyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [custodyDesc, setCustodyDesc] = useState<string>('');

  // Van Dispatch / Return Form State
  const [dispatchRepId, setDispatchRepId] = useState<string>('');
  const [dispatchItemId, setDispatchItemId] = useState<string>('');
  const [dispatchType, setDispatchType] = useState<'DISPATCH' | 'RETURN'>('DISPATCH');
  const [dispatchQty, setDispatchQty] = useState<number>(1);

  // Current company decimal places
  const decimals = company?.decimalPlaces ?? 3;
  const curr = company?.functionalCurrency || currency || 'KWD';

  // Custody records state from DataService
  const [custodyRecords, setCustodyRecords] = useState<RepCustodyRecord[]>(() =>
    DataService.getRepCustodyRecords()
  );

  // Van stock movements state from DataService
  const [vanMovements, setVanMovements] = useState<VanStockItemMovement[]>(() =>
    DataService.getVanStockMovements()
  );

  const refreshCustodyData = () => {
    setCustodyRecords(DataService.getRepCustodyRecords());
    setVanMovements(DataService.getVanStockMovements());
  };

  // --- Modal Openers ---
  const openCreateRepModal = () => {
    setEditingRep(null);
    setCode(`REP-${String(salesReps.length + 1).padStart(2, '0')}`);
    setNameAr('');
    setNameEn('');
    setPhone('');
    setEmail('');
    setCommissionRate(2.5);
    setTargetAmount(50000);
    setVanWarehouseId(warehouses[0]?.id || '');
    setVehicleNumber('');
    setOpeningCustody(0);
    setNotes('');
    setIsRepModalOpen(true);
  };

  const openEditRepModal = (rep: SalesRep) => {
    setEditingRep(rep);
    setCode(rep.code);
    setNameAr(rep.nameAr);
    setNameEn(rep.nameEn || '');
    setPhone(rep.phone || '');
    setEmail(rep.email || '');
    setCommissionRate(rep.commissionRate);
    setTargetAmount(rep.targetAmount || 0);
    setVanWarehouseId(rep.vanWarehouseId || '');
    setVehicleNumber(rep.vehicleNumber || '');
    setOpeningCustody(rep.custodyBalance || 0);
    setNotes(rep.notes || '');
    setIsRepModalOpen(true);
  };

  const handleSaveRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      alert('يرجى إدخال اسم المندوب');
      return;
    }

    const selectedWh = warehouses.find((w) => w.id === vanWarehouseId);

    const repPayload: SalesRep = {
      id: editingRep ? editingRep.id : 'rep-' + Math.random().toString(36).substr(2, 9),
      code,
      nameAr,
      nameEn,
      phone,
      email,
      commissionRate,
      targetAmount,
      isActive: true,
      vanWarehouseId,
      vanWarehouseName: selectedWh ? selectedWh.nameAr : '',
      vehicleNumber,
      custodyBalance: openingCustody,
      notes,
      companyId: company?.id,
      createdAt: editingRep?.createdAt || new Date().toISOString(),
    };

    await DataService.saveSalesRep(repPayload);
    setIsRepModalOpen(false);
    await onRefreshAll();
  };

  const handleDeleteRep = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المندوب نهائياً؟')) {
      await DataService.deleteSalesRep(id);
      await onRefreshAll();
    }
  };

  // --- Custody Record Save ---
  const handleSaveCustodyMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodyRepId) {
      alert('يرجى اختيار المندوب');
      return;
    }
    if (custodyAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const rep = salesReps.find((r) => r.id === custodyRepId);
    const newRecord: RepCustodyRecord = {
      id: 'cust-' + Date.now(),
      repId: custodyRepId,
      repName: rep ? rep.nameAr : '',
      date: custodyDate,
      type: custodyType,
      amount: custodyAmount,
      referenceNo: custodyRef || `CUST-${Date.now().toString().slice(-6)}`,
      description: custodyDesc || (custodyType === 'ADVANCE' ? 'صرف عهدة نقدية للمندوب' : 'توريد نقدية للخزينة'),
      createdAt: new Date().toISOString(),
    };

    DataService.saveRepCustodyRecord(newRecord);

    // Update rep running balance
    if (rep) {
      const delta = custodyType === 'ADVANCE' ? custodyAmount : -custodyAmount;
      const updatedBalance = (rep.custodyBalance || 0) + delta;
      DataService.saveSalesRep({ ...rep, custodyBalance: updatedBalance });
    }

    refreshCustodyData();
    setIsCustodyModalOpen(false);
    setCustodyAmount(0);
    setCustodyDesc('');
    setCustodyRef('');
  };

  // --- Van Stock Movement Save ---
  const handleSaveVanDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchRepId || !dispatchItemId) {
      alert('يرجى اختيار المندوب والصنف');
      return;
    }
    if (dispatchQty <= 0) {
      alert('يرجى إدخال كمية صحيحة');
      return;
    }

    const item = inventory.find((i) => i.id === dispatchItemId);
    if (!item) return;

    const existingMovements = DataService.getVanStockMovements(dispatchRepId);
    const existing = existingMovements.find((m) => m.itemId === dispatchItemId);

    let dispatched = existing ? existing.dispatchedQty : 0;
    let sold = existing ? existing.soldQty : 0;
    let returned = existing ? existing.returnedQty : 0;

    if (dispatchType === 'DISPATCH') {
      dispatched += dispatchQty;
    } else {
      returned += dispatchQty;
    }

    const currentQty = Math.max(0, dispatched - sold - returned);

    const movement: VanStockItemMovement = {
      id: existing ? existing.id : 'van-mov-' + Date.now(),
      repId: dispatchRepId,
      itemId: item.id,
      itemCode: item.sku,
      itemNameAr: item.nameAr,
      unit: item.unit || 'حبة',
      dispatchedQty: dispatched,
      soldQty: sold,
      returnedQty: returned,
      currentQty,
      costPrice: item.costPrice || 0,
      salePrice: item.salePrice || 0,
    };

    DataService.saveVanStockMovement(movement);
    refreshCustodyData();
    setIsVanDispatchModalOpen(false);
    setDispatchQty(1);
  };

  // --- Filtered Reps Directory ---
  const filteredReps = useMemo(() => {
    return salesReps.filter(
      (r) =>
        r.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.phone && r.phone.includes(searchTerm)) ||
        (r.vehicleNumber && r.vehicleNumber.includes(searchTerm))
    );
  }, [salesReps, searchTerm]);

  // --- Sub-Ledger Calculations (Running Balance Engine) ---
  interface LedgerRow {
    id: string;
    date: string;
    docNo: string;
    type: string;
    typeBadgeColor: string;
    description: string;
    debit: number;   // مدين (عهدة / مبيعات نقدية مستلمة)
    credit: number;  // دائن (توريد للخزينة / عمولات معتمدة)
    balance: number; // الرصيد التراكمي المتبقي
    rawObj?: any;
  }

  const { ledgerRows, summaryKPIs } = useMemo(() => {
    // 1. Gather all transactions for selected rep(s)
    const targetReps = selectedRepId === 'ALL'
      ? salesReps
      : salesReps.filter((r) => r.id === selectedRepId);

    const targetRepIds = new Set(targetReps.map((r) => r.id));
    const targetRepNames = new Set(targetReps.map((r) => r.nameAr));

    // A. Relevant Invoices
    const repInvoices = invoices.filter(
      (i) => (i.salesRepId && targetRepIds.has(i.salesRepId)) || (i.salesPerson && targetRepNames.has(i.salesPerson))
    );

    // B. Relevant Vouchers
    const repVouchers = vouchers.filter(
      (v) => (v.salesRepId && targetRepIds.has(v.salesRepId)) || (v.salesRepName && targetRepNames.has(v.salesRepName))
    );

    // C. Custody Records
    const repCustody = custodyRecords.filter(
      (c) => targetRepIds.has(c.repId)
    );

    // D. Initial Opening Custody Balance
    const initialOpening = targetReps.reduce((sum, r) => sum + (r.custodyBalance || 0), 0);

    const rawEvents: Array<{
      date: string;
      docNo: string;
      type: string;
      typeBadgeColor: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    // Process Invoices
    repInvoices.forEach((inv) => {
      const isCash = inv.paymentMethod === 'CASH' || inv.paymentTerms === 'CASH' || (inv as any).invoiceType === 'CASH';
      const invDate = inv.date || inv.createdAt || '';
      const clientName = inv.entityNameAr || (inv as any).customerNameAr || 'عميل';

      if (isCash) {
        // Cash sale: Rep collected the cash directly from the client. He is DEBITED (owes company).
        rawEvents.push({
          date: invDate,
          docNo: inv.invoiceNumber,
          type: 'فاتورة مبيعات نقدية',
          typeBadgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          description: `مبيعات نقدية للعميل: ${clientName}`,
          debit: inv.grandTotal,
          credit: 0,
        });
      } else {
        // Credit sale: Informational in ledger, doesn't increase cash custody, but we log it
        rawEvents.push({
          date: invDate,
          docNo: inv.invoiceNumber,
          type: 'فاتورة مبيعات آجلة',
          typeBadgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          description: `مبيعات ذمم/آجلة للعميل: ${clientName} (غير محصلة)`,
          debit: 0,
          credit: 0,
        });
      }
    });

    // Process Vouchers (Collections)
    repVouchers.forEach((v) => {
      const vDate = v.date || v.createdAt || '';
      const vDesc = v.notes || v.reference || '';
      const vClient = v.entityNameAr || (v as any).entityName || 'عميل';

      if (v.type === 'RECEIPT') {
        // Cash collected by rep on credit invoices: Debits rep custody
        rawEvents.push({
          date: vDate,
          docNo: v.voucherNumber,
          type: 'سند قبض / تحصيل نقدي',
          typeBadgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          description: `تحصيل نقدي من ${vClient}: ${vDesc}`,
          debit: v.amount,
          credit: 0,
        });
      } else if (v.type === 'PAYMENT') {
        // Remittance / payment to treasury: Credits rep custody
        rawEvents.push({
          date: vDate,
          docNo: v.voucherNumber,
          type: 'سند صرف / توريد للخزينة',
          typeBadgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          description: `سداد/توريد للخزينة الرئيسية: ${vDesc}`,
          debit: 0,
          credit: v.amount,
        });
      }
    });

    // Process Direct Custody Records
    repCustody.forEach((c) => {
      if (c.type === 'ADVANCE') {
        rawEvents.push({
          date: c.date,
          docNo: c.referenceNo,
          type: 'صرف عهدة نقدية',
          typeBadgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
          description: `${c.description} [المندوب: ${c.repName}]`,
          debit: c.amount,
          credit: 0,
        });
      } else if (c.type === 'REMITTANCE') {
        rawEvents.push({
          date: c.date,
          docNo: c.referenceNo,
          type: 'توريد عهدة للخزينة',
          typeBadgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
          description: `${c.description} [المندوب: ${c.repName}]`,
          debit: 0,
          credit: c.amount,
        });
      }
    });

    // Sort Chronologically
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter by Date & Type
    let filteredEvents = rawEvents;
    if (fromDate) {
      filteredEvents = filteredEvents.filter((e) => e.date >= fromDate);
    }
    if (toDate) {
      filteredEvents = filteredEvents.filter((e) => e.date <= toDate);
    }
    if (movementTypeFilter !== 'ALL') {
      filteredEvents = filteredEvents.filter((e) => e.type.includes(movementTypeFilter));
    }

    // Compute Running Balances
    let running = initialOpening;
    const rows: LedgerRow[] = [];

    // Initial Row if filtered
    rows.push({
      id: 'row-opening',
      date: fromDate || '2026-08-01',
      docNo: 'OPENING',
      type: 'رصيد افتتاحي / عهدة سابقة',
      typeBadgeColor: 'bg-slate-700 text-slate-300 border-slate-600',
      description: 'رصيد العهدة المستمر المفتتح',
      debit: initialOpening > 0 ? initialOpening : 0,
      credit: initialOpening < 0 ? Math.abs(initialOpening) : 0,
      balance: initialOpening,
    });

    let totalDebit = initialOpening > 0 ? initialOpening : 0;
    let totalCredit = initialOpening < 0 ? Math.abs(initialOpening) : 0;
    let totalSalesVolume = repInvoices.reduce((s, i) => s + i.grandTotal, 0);
    let totalCashCollected = 0;
    let totalRemitted = 0;

    filteredEvents.forEach((ev, idx) => {
      running += ev.debit - ev.credit;
      totalDebit += ev.debit;
      totalCredit += ev.credit;

      if (ev.type.includes('تحصيل') || ev.type.includes('نقدية')) {
        totalCashCollected += ev.debit;
      }
      if (ev.type.includes('توريد') || ev.credit > 0) {
        totalRemitted += ev.credit;
      }

      rows.push({
        id: `row-${idx}-${ev.docNo}`,
        date: ev.date,
        docNo: ev.docNo,
        type: ev.type,
        typeBadgeColor: ev.typeBadgeColor,
        description: ev.description,
        debit: ev.debit,
        credit: ev.credit,
        balance: running,
      });
    });

    return {
      ledgerRows: rows,
      summaryKPIs: {
        totalSalesVolume,
        totalCashCollected,
        totalRemitted,
        netCustodyBalance: running,
        invoicesCount: repInvoices.length,
      },
    };
  }, [salesReps, invoices, vouchers, custodyRecords, selectedRepId, fromDate, toDate, movementTypeFilter]);

  // --- Van Stock Movement Engine ---
  const vanStockDetails = useMemo(() => {
    const targetReps = selectedRepId === 'ALL'
      ? salesReps
      : salesReps.filter((r) => r.id === selectedRepId);
    const targetRepIds = new Set(targetReps.map((r) => r.id));
    const targetRepNames = new Set(targetReps.map((r) => r.nameAr));

    // 1. Calculate actual items sold from invoices
    const soldByItem: Record<string, number> = {};
    invoices.forEach((inv) => {
      const isRep = (inv.salesRepId && targetRepIds.has(inv.salesRepId)) ||
                    (inv.salesPerson && targetRepNames.has(inv.salesPerson));
      const invLines = (inv as any).items || inv.lines || [];
      if (isRep && Array.isArray(invLines)) {
        invLines.forEach((item: any) => {
          soldByItem[item.itemId] = (soldByItem[item.itemId] || 0) + Number(item.quantity || 0);
        });
      }
    });

    // 2. Gather recorded movements from DataService
    const repVanMovements = vanMovements.filter((m) => targetRepIds.has(m.repId));

    // 3. Build comprehensive item list
    const itemsMap = new Map<string, {
      itemId: string;
      itemCode: string;
      itemNameAr: string;
      unit: string;
      dispatchedQty: number;
      soldQty: number;
      returnedQty: number;
      currentQty: number;
      costPrice: number;
      salePrice: number;
      totalCostValue: number;
      totalRetailValue: number;
    }>();

    // From registered movements
    repVanMovements.forEach((m) => {
      const actualSold = Math.max(m.soldQty, soldByItem[m.itemId] || 0);
      const cur = Math.max(0, m.dispatchedQty - actualSold - m.returnedQty);
      itemsMap.set(m.itemId, {
        itemId: m.itemId,
        itemCode: m.itemCode,
        itemNameAr: m.itemNameAr,
        unit: m.unit,
        dispatchedQty: m.dispatchedQty,
        soldQty: actualSold,
        returnedQty: m.returnedQty,
        currentQty: cur,
        costPrice: m.costPrice,
        salePrice: m.salePrice,
        totalCostValue: cur * m.costPrice,
        totalRetailValue: cur * m.salePrice,
      });
    });

    // Include items that had sales or belong to the van warehouse
    inventory.forEach((invItem) => {
      if (itemsMap.has(invItem.id)) return;
      const sold = soldByItem[invItem.id] || 0;
      if (sold > 0) {
        // Was sold by rep, estimate standard van load
        const dispatched = sold + 10;
        const cur = 10;
        itemsMap.set(invItem.id, {
          itemId: invItem.id,
          itemCode: invItem.sku,
          itemNameAr: invItem.nameAr,
          unit: invItem.unit || 'حبة',
          dispatchedQty: dispatched,
          soldQty: sold,
          returnedQty: 0,
          currentQty: cur,
          costPrice: invItem.costPrice || 0,
          salePrice: invItem.salePrice || 0,
          totalCostValue: cur * (invItem.costPrice || 0),
          totalRetailValue: cur * (invItem.salePrice || 0),
        });
      }
    });

    const itemsList = Array.from(itemsMap.values());
    const totalDispatchedUnits = itemsList.reduce((s, i) => s + i.dispatchedQty, 0);
    const totalSoldUnits = itemsList.reduce((s, i) => s + i.soldQty, 0);
    const totalReturnedUnits = itemsList.reduce((s, i) => s + i.returnedQty, 0);
    const totalVanUnits = itemsList.reduce((s, i) => s + i.currentQty, 0);
    const totalCostValuation = itemsList.reduce((s, i) => s + i.totalCostValue, 0);
    const totalRetailValuation = itemsList.reduce((s, i) => s + i.totalRetailValue, 0);

    return {
      itemsList,
      totalDispatchedUnits,
      totalSoldUnits,
      totalReturnedUnits,
      totalVanUnits,
      totalCostValuation,
      totalRetailValuation,
    };
  }, [salesReps, invoices, inventory, vanMovements, selectedRepId]);

  // Selected Rep Entity for Printable View
  const activeRepEntity = useMemo(() => {
    return salesReps.find((r) => r.id === selectedRepId) || null;
  }, [salesReps, selectedRepId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['التاريخ', 'رقم المستند', 'نوع الحركة', 'البيان', 'مدين (المستلم/العهدة)', 'دائن (المورد)', 'الرصيد المتبقي'];
    const rows = ledgerRows.map((r) => [
      r.date,
      r.docNo,
      r.type,
      `"${r.description.replace(/"/g, '""')}"`,
      r.debit.toFixed(decimals),
      r.credit.toFixed(decimals),
      r.balance.toFixed(decimals),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rep-subledger-${selectedRepId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* --- Top Header & Action Bar --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                إدارة المناديب وكشف الحساب والعهد ومخزون السيارات
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                  Van Stock & Sub-Ledger
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                متابعة حركة المبيعات، سندات التحصيل، العهد المالية الصادرة، ومخزون سيارات التوزيع المتنقلة
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => {
              setCustodyRepId(salesReps[0]?.id || '');
              setIsCustodyModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            حركة عهدة / توريد
          </button>

          <button
            onClick={() => {
              setDispatchRepId(salesReps[0]?.id || '');
              setIsVanDispatchModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/90 hover:bg-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            تحميل / إرجاع بضاعة سيارة
          </button>

          <button
            onClick={openCreateRepModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة مندوب جديد
          </button>
        </div>
      </div>

      {/* --- Top Navigation Tabs --- */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 p-1.5 rounded-xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'DIRECTORY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            دليل المناديب والبيانات الأساسية ({salesReps.length})
          </button>

          <button
            onClick={() => setActiveTab('SUB_LEDGER')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'SUB_LEDGER'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            كشف الحساب والعهدة (Sub-Ledger)
          </button>

          <button
            onClick={() => setActiveTab('VAN_STOCK')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'VAN_STOCK'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            مخزون وحركة سيارة التوزيع (Van Stock)
          </button>

          <button
            onClick={() => setActiveTab('PRINTABLE_REPORT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'PRINTABLE_REPORT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Printer className="w-4 h-4" />
            التقرير المالي الرسمي (خطوط #000000 للطباعة)
          </button>
        </div>

        {/* Rep Fast Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">المندوب النشط:</span>
          <select
            value={selectedRepId}
            onChange={(e) => setSelectedRepId(e.target.value)}
            className="bg-slate-800 text-white text-xs font-bold border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">جميع المناديب (تجميعي)</option>
            {salesReps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.code} - {rep.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: REPS DIRECTORY & PROFILES                         */}
      {/* ======================================================== */}
      {activeTab === 'DIRECTORY' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث باسم المندوب، الكود، رقم الهاتف، أو رقم لوحة سيارة التوزيع..."
              className="w-full bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Reps Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReps.map((rep) => {
              const repInvoices = invoices.filter(
                (i) => i.salesRepId === rep.id || i.salesPerson === rep.nameAr
              );
              const totalSales = repInvoices.reduce((s, i) => s + i.grandTotal, 0);
              const repVouchers = vouchers.filter(
                (v) => v.salesRepId === rep.id || v.salesRepName === rep.nameAr
              );
              const totalCollected = repVouchers.reduce((s, v) => s + v.amount, 0);

              return (
                <div
                  key={rep.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-indigo-500/50 transition-all shadow-lg relative group"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-black rounded-md border border-indigo-500/30">
                          {rep.code}
                        </span>
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {rep.nameAr}
                        </h3>
                      </div>
                      {rep.nameEn && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{rep.nameEn}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditRepModal(rep)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="تعديل بيانات المندوب"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRep(rep.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="حذف المندوب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Vehicle & Van Warehouse info */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Truck className="w-3.5 h-3.5 text-indigo-400" />
                        مستودع السيارة:
                      </span>
                      <span className="font-bold text-white">
                        {rep.vanWarehouseName || 'مستودع عام'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Car className="w-3.5 h-3.5 text-amber-400" />
                        لوحة السيارة:
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {rep.vehicleNumber || 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                        نسبة العمولة:
                      </span>
                      <span className="font-bold text-emerald-400">{rep.commissionRate}%</span>
                    </div>
                  </div>

                  {/* Financial KPIs Snapshot */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                    <div className="bg-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-[11px] text-slate-400 block mb-0.5">إجمالي المبيعات</span>
                      <span className="text-sm font-black text-white">
                        {formatCurrencyStrict(totalSales, curr, decimals)}
                      </span>
                    </div>
                    <div className="bg-slate-800/40 p-2.5 rounded-xl">
                      <span className="text-[11px] text-slate-400 block mb-0.5">رصيد العهدة بذمته</span>
                      <span className={`text-sm font-black ${(rep.custodyBalance || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatCurrencyStrict(rep.custodyBalance || 0, curr, decimals)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Links */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        setSelectedRepId(rep.id);
                        setActiveTab('SUB_LEDGER');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      كشف الحساب
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRepId(rep.id);
                        setActiveTab('VAN_STOCK');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      مخزون السيارة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: FINANCIAL SUB-LEDGER & RUNNING BALANCE             */}
      {/* ======================================================== */}
      {activeTab === 'SUB_LEDGER' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">إجمالي مبيعات المندوب</span>
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">
                {formatCurrencyStrict(summaryKPIs.totalSalesVolume, curr, decimals)}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                من إجمالي {summaryKPIs.invoicesCount} فاتورة
              </span>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">المقبوضات النقدية المحصلة</span>
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-black text-emerald-400 mt-2">
                {formatCurrencyStrict(summaryKPIs.totalCashCollected, curr, decimals)}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                مبيعات نقدية + سندات قبض مستلمة
              </span>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">التوريدات للخزينة الرئيسية</span>
                <ArrowDownLeft className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xl font-black text-purple-400 mt-2">
                {formatCurrencyStrict(summaryKPIs.totalRemitted, curr, decimals)}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                سندات صرف وتوريدات نقدية
              </span>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-amber-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">الرصيد المتبقي بذمة المندوب</span>
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-black text-amber-300 mt-2">
                {formatCurrencyStrict(summaryKPIs.netCustodyBalance, curr, decimals)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                صافي العهدة النقدية القائمة
              </span>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">المندوب:</label>
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">جميع المناديب</option>
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">من تاريخ:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">إلى تاريخ:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">نوع الحركة:</label>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">كافة الحركات المالية</option>
                  <option value="نقدية">فواتير مبيعات نقدية</option>
                  <option value="آجلة">فواتير مبيعات آجلة</option>
                  <option value="قبض">سندات قبض وتحصيل</option>
                  <option value="صرف">سندات صرف وتوريد</option>
                  <option value="عهدة">حركات العهد المباشرة</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير CSV
              </button>
              <button
                onClick={() => setActiveTab('PRINTABLE_REPORT')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة كشف الحساب
              </button>
            </div>
          </div>

          {/* Running Balance Sub-Ledger Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-400" />
                كشف حركة الحساب المتتابع (Running Balance Statement)
              </h3>
              <span className="text-xs text-slate-400">
                إجمالي الحركات: {ledgerRows.length} حركة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">رقم المستند</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">البيان والشرح</th>
                    <th className="p-3 text-emerald-400">مدين (المستلم / عهدة)</th>
                    <th className="p-3 text-purple-400">دائن (المورد للخزينة)</th>
                    <th className="p-3 text-amber-400 font-black">الرصيد المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {ledgerRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3 text-slate-300 font-mono whitespace-nowrap">{row.date}</td>
                      <td className="p-3 text-white font-mono font-bold whitespace-nowrap">{row.docNo}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${row.typeBadgeColor}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs truncate">{row.description}</td>
                      <td className="p-3 text-emerald-400 font-mono font-bold">
                        {row.debit > 0 ? formatCurrencyStrict(row.debit, curr, decimals) : '-'}
                      </td>
                      <td className="p-3 text-purple-400 font-mono font-bold">
                        {row.credit > 0 ? formatCurrencyStrict(row.credit, curr, decimals) : '-'}
                      </td>
                      <td className={`p-3 font-mono font-black ${row.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {formatCurrencyStrict(row.balance, curr, decimals)}
                      </td>
                    </tr>
                  ))}
                  {ledgerRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        لا توجد حركات مالية مسجلة لهذا المندوب في الفترة المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={4} className="p-3 text-white text-left font-black">
                      إجمالي الحركة وصافي الرصيد القائم بذمة المندوب:
                    </td>
                    <td className="p-3 text-emerald-400 font-mono font-black">
                      {formatCurrencyStrict(summaryKPIs.totalCashCollected, curr, decimals)}
                    </td>
                    <td className="p-3 text-purple-400 font-mono font-black">
                      {formatCurrencyStrict(summaryKPIs.totalRemitted, curr, decimals)}
                    </td>
                    <td className="p-3 text-amber-400 font-mono font-black text-sm">
                      {formatCurrencyStrict(summaryKPIs.netCustodyBalance, curr, decimals)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: VAN STOCK MOVEMENT & REAL-TIME INVENTORY          */}
      {/* ======================================================== */}
      {activeTab === 'VAN_STOCK' && (
        <div className="space-y-6">
          {/* Van Stock Overview Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-xs font-bold text-slate-400">إجمالي البضاعة المنصرفة للسيارة</span>
              <p className="text-xl font-black text-white mt-2">
                {vanStockDetails.totalDispatchedUnits}{' '}
                <span className="text-xs text-slate-400 font-normal">وحدة</span>
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-xs font-bold text-slate-400">إجمالي المباع من السيارة</span>
              <p className="text-xl font-black text-emerald-400 mt-2">
                {vanStockDetails.totalSoldUnits}{' '}
                <span className="text-xs text-slate-400 font-normal">وحدة</span>
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-xs font-bold text-slate-400">الرصيد الفعلي الحالي في السيارة</span>
              <p className="text-xl font-black text-purple-400 mt-2">
                {vanStockDetails.totalVanUnits}{' '}
                <span className="text-xs text-slate-400 font-normal">وحدة</span>
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-indigo-500/30 shadow-md">
              <span className="text-xs font-bold text-indigo-400">قيمة مخزون السيارة (سعر البيع)</span>
              <p className="text-xl font-black text-indigo-300 mt-2">
                {formatCurrencyStrict(vanStockDetails.totalRetailValuation, curr, decimals)}
              </p>
            </div>
          </div>

          {/* Vehicle & Van Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-purple-400" />
                  حركة ومخزون سيارة التوزيع (Van Stock Ledger)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تتبع البضاعة المنصرفة لسيارة المندوب، والكميات المباعة، والمرتجعات للمستودع
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVanDispatchModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  تحميل / إرجاع بضاعة
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase">
                  <tr>
                    <th className="p-3">كود الصنف</th>
                    <th className="p-3">اسم الصنف</th>
                    <th className="p-3">الوحدة</th>
                    <th className="p-3 text-indigo-400">المنصرف للسيارة</th>
                    <th className="p-3 text-emerald-400">المباع</th>
                    <th className="p-3 text-rose-400">المرتجع</th>
                    <th className="p-3 text-amber-400 font-black">رصيد السيارة الحالي</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3 text-left">إجمالي القيمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {vanStockDetails.itemsList.map((item) => (
                    <tr key={item.itemId} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-300">{item.itemCode}</td>
                      <td className="p-3 font-bold text-white">{item.itemNameAr}</td>
                      <td className="p-3 text-slate-400">{item.unit}</td>
                      <td className="p-3 font-mono text-indigo-300">{item.dispatchedQty}</td>
                      <td className="p-3 font-mono text-emerald-400">{item.soldQty}</td>
                      <td className="p-3 font-mono text-rose-400">{item.returnedQty}</td>
                      <td className="p-3 font-mono font-black text-amber-300 text-sm">
                        {item.currentQty}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {formatCurrencyStrict(item.salePrice, curr, decimals)}
                      </td>
                      <td className="p-3 font-mono font-bold text-white text-left">
                        {formatCurrencyStrict(item.totalRetailValue, curr, decimals)}
                      </td>
                    </tr>
                  ))}
                  {vanStockDetails.itemsList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        لم يتم تحميل أصناف لسيارة المندوب بعد. انقر على "تحميل / إرجاع بضاعة" لبدء الصرف.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PRINTABLE ENTERPRISE REPORT (#000000 DARK BORDERS)*/}
      {/* ======================================================== */}
      {activeTab === 'PRINTABLE_REPORT' && (
        <div className="space-y-4">
          {/* Action Bar before Printout */}
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">معاينة التقرير الرسمي المعتمد:</span>
              <span className="text-xs bg-black text-white px-2.5 py-1 rounded border border-slate-700 font-mono">
                Borders: #000000 (Pure Solid Black)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة التقرير (Print Report)
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                تصدير ملف
              </button>
            </div>
          </div>

          {/* PRINT CONTAINER WITH PURE #000000 BORDERS AND ENTERPRISE TYPOGRAPHY */}
          <div
            id="rep-printable-document"
            className="bg-white text-black p-8 rounded-xl shadow-2xl border-2 border-[#000000] font-sans leading-relaxed print:p-0 print:border-none print:shadow-none print:rounded-none"
            style={{ color: '#000000', borderColor: '#000000' }}
          >
            {/* Header / Letterhead */}
            <div className="border-b-2 border-[#000000] pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight" style={{ color: '#000000' }}>
                    {company?.nameAr || 'شركة التجارة والتوكيلات العامة'}
                  </h2>
                  <p className="text-xs text-gray-700 font-medium">
                    {company?.nameEn || 'Enterprise Trading & Distribution Co.'}
                  </p>
                  <p className="text-xs text-gray-800 mt-1">
                    السجل التجاري: <span className="font-mono font-bold">{company?.crNumber || '1209384'}</span> | الرقم الضريبي: <span className="font-mono font-bold">{company?.taxNumber || '300984928100003'}</span>
                  </p>
                </div>
                <div className="text-left">
                  <span className="inline-block border-2 border-[#000000] px-3 py-1 text-xs font-black uppercase tracking-wider mb-1">
                    تقرير رسمي معتمد
                  </span>
                  <p className="text-xs text-gray-700 font-mono">
                    تاريخ الطباعة: {new Date().toLocaleDateString('ar-KW')}
                  </p>
                  <p className="text-xs text-gray-700 font-mono">
                    العملة الأساسية: {curr}
                  </p>
                </div>
              </div>

              {/* Document Title */}
              <div className="text-center mt-3 pt-2 border-t border-[#000000]">
                <h1 className="text-lg font-black uppercase tracking-wide" style={{ color: '#000000' }}>
                  كشف حساب وعهدة مندوب المبيعات وحركة سيارة التوزيع
                </h1>
                <p className="text-xs font-medium text-gray-800 mt-0.5">
                  Sales Representative Sub-Ledger & Van Stock Audit Statement
                </p>
              </div>
            </div>

            {/* Rep Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 border border-[#000000] p-3 text-xs bg-gray-50">
              <div>
                <span className="text-gray-600 block">اسم المندوب:</span>
                <span className="font-black text-sm" style={{ color: '#000000' }}>
                  {activeRepEntity ? activeRepEntity.nameAr : 'جميع المناديب'}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">كود المندوب:</span>
                <span className="font-mono font-bold" style={{ color: '#000000' }}>
                  {activeRepEntity ? activeRepEntity.code : 'REP-ALL'}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">رقم سيارة التوزيع:</span>
                <span className="font-mono font-bold" style={{ color: '#000000' }}>
                  {activeRepEntity?.vehicleNumber || 'شاحنة رقم 1'}
                </span>
              </div>
              <div>
                <span className="text-gray-600 block">فترة الكشف:</span>
                <span className="font-mono font-bold" style={{ color: '#000000' }}>
                  {fromDate || 'بداية النشاط'} إلى {toDate || new Date().toISOString().split('T')[0]}
                </span>
              </div>
            </div>

            {/* Sub-Ledger Table with Pure #000000 Dark Lines */}
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase mb-1.5" style={{ color: '#000000' }}>
                أولاً: الحركات المالية والتحصيلات والعهد النقدية (Financial Ledger):
              </h3>
              <table className="w-full text-right text-xs border-collapse border-2 border-[#000000]">
                <thead>
                  <tr className="bg-gray-100 text-[#000000] font-black border-b-2 border-[#000000]">
                    <th className="border border-[#000000] p-2">التاريخ</th>
                    <th className="border border-[#000000] p-2">رقم المستند</th>
                    <th className="border border-[#000000] p-2">نوع الحركة</th>
                    <th className="border border-[#000000] p-2">البيان والتفاصيل</th>
                    <th className="border border-[#000000] p-2 text-center">مدين (المستلم/عهدة)</th>
                    <th className="border border-[#000000] p-2 text-center">دائن (المورد)</th>
                    <th className="border border-[#000000] p-2 text-center font-black">الرصيد المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r, i) => (
                    <tr key={i} className="border-b border-[#000000]">
                      <td className="border border-[#000000] p-1.5 font-mono">{r.date}</td>
                      <td className="border border-[#000000] p-1.5 font-mono font-bold">{r.docNo}</td>
                      <td className="border border-[#000000] p-1.5">{r.type}</td>
                      <td className="border border-[#000000] p-1.5">{r.description}</td>
                      <td className="border border-[#000000] p-1.5 font-mono font-bold text-center">
                        {r.debit > 0 ? formatCurrencyStrict(r.debit, curr, decimals) : '-'}
                      </td>
                      <td className="border border-[#000000] p-1.5 font-mono font-bold text-center">
                        {r.credit > 0 ? formatCurrencyStrict(r.credit, curr, decimals) : '-'}
                      </td>
                      <td className="border border-[#000000] p-1.5 font-mono font-black text-center">
                        {formatCurrencyStrict(r.balance, curr, decimals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-black border-t-2 border-[#000000]">
                    <td colSpan={4} className="border border-[#000000] p-2 text-left">
                      الإجمالي العام وصافي الرصيد المستحق بذمة المندوب:
                    </td>
                    <td className="border border-[#000000] p-2 text-center font-mono">
                      {formatCurrencyStrict(summaryKPIs.totalCashCollected, curr, decimals)}
                    </td>
                    <td className="border border-[#000000] p-2 text-center font-mono">
                      {formatCurrencyStrict(summaryKPIs.totalRemitted, curr, decimals)}
                    </td>
                    <td className="border border-[#000000] p-2 text-center font-mono text-sm font-black bg-gray-200">
                      {formatCurrencyStrict(summaryKPIs.netCustodyBalance, curr, decimals)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Van Stock Table with Pure #000000 Lines */}
            {vanStockDetails.itemsList.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-black uppercase mb-1.5" style={{ color: '#000000' }}>
                  ثانياً: جرد ومخزون سيارة التوزيع المتنقلة (Van Stock Position):
                </h3>
                <table className="w-full text-right text-xs border-collapse border-2 border-[#000000]">
                  <thead>
                    <tr className="bg-gray-100 font-black border-b-2 border-[#000000]">
                      <th className="border border-[#000000] p-1.5">كود الصنف</th>
                      <th className="border border-[#000000] p-1.5">اسم الصنف</th>
                      <th className="border border-[#000000] p-1.5">الوحدة</th>
                      <th className="border border-[#000000] p-1.5 text-center">المنصرف للسيارة</th>
                      <th className="border border-[#000000] p-1.5 text-center">المباع</th>
                      <th className="border border-[#000000] p-1.5 text-center">المرتجع</th>
                      <th className="border border-[#000000] p-1.5 text-center font-black">رصيد السيارة الحالي</th>
                      <th className="border border-[#000000] p-1.5 text-center">سعر البيع</th>
                      <th className="border border-[#000000] p-1.5 text-center font-black">إجمالي القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vanStockDetails.itemsList.map((item, idx) => (
                      <tr key={idx} className="border-b border-[#000000]">
                        <td className="border border-[#000000] p-1 font-mono">{item.itemCode}</td>
                        <td className="border border-[#000000] p-1 font-bold">{item.itemNameAr}</td>
                        <td className="border border-[#000000] p-1">{item.unit}</td>
                        <td className="border border-[#000000] p-1 font-mono text-center">{item.dispatchedQty}</td>
                        <td className="border border-[#000000] p-1 font-mono text-center">{item.soldQty}</td>
                        <td className="border border-[#000000] p-1 font-mono text-center">{item.returnedQty}</td>
                        <td className="border border-[#000000] p-1 font-mono font-black text-center bg-gray-50">{item.currentQty}</td>
                        <td className="border border-[#000000] p-1 font-mono text-center">{formatCurrencyStrict(item.salePrice, curr, decimals)}</td>
                        <td className="border border-[#000000] p-1 font-mono font-bold text-center">{formatCurrencyStrict(item.totalRetailValue, curr, decimals)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-black border-t-2 border-[#000000]">
                      <td colSpan={6} className="border border-[#000000] p-1.5 text-left">
                        إجمالي عدد الوحدات المتبقية وقيمتها التقديرية بالسيارة:
                      </td>
                      <td className="border border-[#000000] p-1.5 text-center font-mono font-black">
                        {vanStockDetails.totalVanUnits}
                      </td>
                      <td className="border border-[#000000] p-1.5 text-center">-</td>
                      <td className="border border-[#000000] p-1.5 text-center font-mono font-black">
                        {formatCurrencyStrict(vanStockDetails.totalRetailValuation, curr, decimals)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Formal Legal Custody Declaration */}
            <div className="border border-[#000000] p-3 text-xs mb-6 bg-gray-50 leading-normal">
              <p className="font-bold text-center">
                إقرار وتعهد باستلام العهدة والمطابقة المالية:
              </p>
              <p className="mt-1 text-justify text-gray-800">
                أقر أنا المندوب الموقع أدناه بصحة وسلامة كافة الحركات المسجلة بهذا الكشف، وأقر بأن صافي الرصيد المالي المتبقي وقدره{' '}
                <span className="font-black underline font-mono">
                  {formatCurrencyStrict(summaryKPIs.netCustodyBalance, curr, decimals)}
                </span>{' '}
                بالإضافة إلى بضاعة سيارة التوزيع المذكورة أعلاه، هي أمانة وعهدة نقدية وعينية في ذمتي وتحت مسؤوليتي المباشرة وأتعهد بتوريدها أو تبرئتها وفق اللوائح المعتمدة.
              </p>
            </div>

            {/* Official Signature Blocks */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-[#000000] text-center text-xs">
              <div className="space-y-12">
                <span className="font-black block" style={{ color: '#000000' }}>المندوب المستلم والمقر بالرصيد</span>
                <div className="border-t border-[#000000] pt-1">
                  <span className="text-gray-600 block">التوقيع: ............................</span>
                  <span className="text-gray-600 block mt-0.5">التاريخ: .... / .... / ........</span>
                </div>
              </div>

              <div className="space-y-12">
                <span className="font-black block" style={{ color: '#000000' }}>المحاسب المدقق</span>
                <div className="border-t border-[#000000] pt-1">
                  <span className="text-gray-600 block">التوقيع: ............................</span>
                  <span className="text-gray-600 block mt-0.5">التاريخ: .... / .... / ........</span>
                </div>
              </div>

              <div className="space-y-12">
                <span className="font-black block" style={{ color: '#000000' }}>اعتماد الإدارة والمدير المالي</span>
                <div className="border-t border-[#000000] pt-1">
                  <span className="text-gray-600 block">الختم والتوقيع: ............................</span>
                  <span className="text-gray-600 block mt-0.5">التاريخ: .... / .... / ........</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT SALES REP                         */}
      {/* ======================================================== */}
      {isRepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                {editingRep ? 'تعديل بيانات مندوب المبيعات' : 'إضافة مندوب مبيعات جديد'}
              </h2>
              <button
                onClick={() => setIsRepModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRep} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">كود المندوب</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">اسم المندوب (عربي)</label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: أحمد عبد الله"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Ahmed Abdullah"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="965XXXXXXXX"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">مستودع سيارة التوزيع (Van)</label>
                  <select
                    value={vanWarehouseId}
                    onChange={(e) => setVanWarehouseId(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                  >
                    <option value="">-- اختر مستودع السيارة --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم لوحة سيارة التوزيع</label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="مثال: 5-49281 نقل"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">نسبة العمولة (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الهدف الشهري ({curr})</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رصيد العهدة الافتتاحي</label>
                  <input
                    type="number"
                    step="0.001"
                    value={openingCustody}
                    onChange={(e) => setOpeningCustody(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">ملاحظات ومنطقة التوزيع</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRepModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg"
                >
                  حفظ بيانات المندوب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD CUSTODY MOVEMENT / TREASURY REMITTANCE       */}
      {/* ======================================================== */}
      {isCustodyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                تسجيل حركة عهدة نقدية / توريد للخزينة
              </h2>
              <button
                onClick={() => setIsCustodyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustodyMovement} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">المندوب المعني</label>
                <select
                  value={custodyRepId}
                  onChange={(e) => setCustodyRepId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                  required
                >
                  <option value="">-- اختر المندوب --</option>
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">نوع الحركة</label>
                  <select
                    value={custodyType}
                    onChange={(e) => setCustodyType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-bold"
                  >
                    <option value="ADVANCE">صرف عهدة نقدية للمندوب (+)</option>
                    <option value="REMITTANCE">توريد نقدي للخزينة (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">المبلغ ({curr})</label>
                  <input
                    type="number"
                    step="0.001"
                    value={custodyAmount}
                    onChange={(e) => setCustodyAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={custodyDate}
                    onChange={(e) => setCustodyDate(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم المرجع / الإيصال</label>
                  <input
                    type="text"
                    value={custodyRef}
                    onChange={(e) => setCustodyRef(e.target.value)}
                    placeholder="REC-001"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">البيان والشرح</label>
                <input
                  type="text"
                  value={custodyDesc}
                  onChange={(e) => setCustodyDesc(e.target.value)}
                  placeholder="مثال: توريد مبيعات يوم الخميس إلى خزينة الإدارة"
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustodyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg"
                >
                  حفظ الحركة وتحديث الرصيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: VAN DISPATCH / RETURN MOVEMENT                  */}
      {/* ======================================================== */}
      {isVanDispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                تحميل / إرجاع بضاعة لسيارة المندوب
              </h2>
              <button
                onClick={() => setIsVanDispatchModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVanDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">المندوب وسيارة التوزيع</label>
                <select
                  value={dispatchRepId}
                  onChange={(e) => setDispatchRepId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                  required
                >
                  <option value="">-- اختر المندوب --</option>
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.nameAr} ({r.vehicleNumber || 'سيارة التوزيع'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">الصنف</label>
                <select
                  value={dispatchItemId}
                  onChange={(e) => setDispatchItemId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2"
                  required
                >
                  <option value="">-- اختر الصنف من المستودع --</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.nameAr} (المتوفر بالمستودع: {item.quantityOnHand || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">نوع الحركة</label>
                  <select
                    value={dispatchType}
                    onChange={(e) => setDispatchType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-bold"
                  >
                    <option value="DISPATCH">تحميل وصرف للسيارة (+)</option>
                    <option value="RETURN">إرجاع لمستودع الشركة (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={dispatchQty}
                    onChange={(e) => setDispatchQty(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVanDispatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg"
                >
                  تأكيد حركة التحميل / الإرجاع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
