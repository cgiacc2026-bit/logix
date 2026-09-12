import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  RotateCcw,
  Printer,
  Edit,
  Trash2,
  Landmark,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  X,
  Scale,
  Wrench,
} from 'lucide-react';
import {
  PaymentVoucher,
  Customer,
  Supplier,
  Account,
  Invoice,
  CompanyProfile,
} from '../types';
import { formatCurrency } from '../utils/formatters.ts';
import { VouchersService, BankOrCashAccountSummary } from '../services/vouchersService';
import { DataService } from '../services/dataService.ts';
import { getCalculatedCustomerBalance, getCalculatedSupplierBalance } from '../services/statementService.ts';

interface ReceiptVouchersViewProps {
  vouchers: PaymentVoucher[];
  customers: Customer[];
  suppliers: Supplier[];
  accounts?: Account[];
  invoices?: Invoice[];
  company: CompanyProfile;
  currency: string;
  onCreateVoucher: (data: any) => Promise<void>;
  onUpdateVoucher?: (id: string, data: any) => Promise<void>;
  onCancelVoucher?: (id: string, reason: string) => Promise<void>;
  onDeleteVoucher?: (id: string) => Promise<void>;
  onPrintVoucher?: (voucher: PaymentVoucher) => void;
  onRefreshAll?: () => Promise<void> | void;
  initialTypeFilter?: 'ALL' | 'RECEIPT' | 'PAYMENT';
}

export const ReceiptVouchersView: React.FC<ReceiptVouchersViewProps> = ({
  vouchers = [],
  customers = [],
  suppliers = [],
  accounts = [],
  invoices = [],
  company,
  currency,
  onCreateVoucher,
  onUpdateVoucher,
  onCancelVoucher,
  onDeleteVoucher,
  onPrintVoucher,
  onRefreshAll,
  initialTypeFilter,
}) => {
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>(initialTypeFilter || 'ALL');

  React.useEffect(() => {
    if (initialTypeFilter) {
      setTypeFilter(initialTypeFilter);
    }
  }, [initialTypeFilter]);
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'CANCELLED'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucher | null>(null);

  // Form Fields
  const [vouchType, setVouchType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [vouchDate, setVouchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vouchEntityId, setVouchEntityId] = useState('');
  const [vouchAmount, setVouchAmount] = useState<number>(0);
  const [vouchBankAcc, setVouchBankAcc] = useState<string>('');
  const [vouchPaymentMethod, setVouchPaymentMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [vouchInvoiceId, setVouchInvoiceId] = useState<string>('');
  const [vouchReference, setVouchReference] = useState<string>('');
  const [vouchNotes, setVouchNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const handleSyncAllVouchers = async () => {
    setIsSyncingLedger(true);
    setSyncSuccessMsg(null);
    try {
      const repairResult = await DataService.executeImmediateRepairAndDeduplication();
      const result = await VouchersService.syncAllVouchersToLedger();
      if (onRefreshAll) await onRefreshAll();
      setSyncSuccessMsg(`تم الإصلاح الفوري وتدقيق الأرقام المميزة بنجاح: ${repairResult.message}. كما تم تحديث أرصدة ${result.accountsUpdated} حساب.`);
      setTimeout(() => setSyncSuccessMsg(null), 6000);
    } catch (err: any) {
      alert('حدث خطأ أثناء الإصلاح والمزامنة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSyncingLedger(false);
    }
  };

  // Dynamically resolve active Bank and Cash accounts from VouchersService and accounts prop
  const bankAndCashAccounts: BankOrCashAccountSummary[] = useMemo(() => {
    return VouchersService.getBankAndCashAccounts();
  }, [accounts, vouchers]);

  // Set default account when modal opens or account list loads
  React.useEffect(() => {
    if (!vouchBankAcc && bankAndCashAccounts.length > 0) {
      setVouchBankAcc(bankAndCashAccounts[0].id);
    }
  }, [bankAndCashAccounts, vouchBankAcc]);

  // Total Receipts and Payments KPI
  const stats = useMemo(() => {
    let totalReceipts = 0;
    let totalPayments = 0;
    let countActive = 0;

    vouchers.forEach((v) => {
      if (v.status !== 'CANCELLED') {
        countActive++;
        if (v.type === 'RECEIPT') {
          totalReceipts += Number(v.amount) || 0;
        } else {
          totalPayments += Number(v.amount) || 0;
        }
      }
    });

    const totalCashBalance = bankAndCashAccounts
      .filter((a) => a.category === 'CASH')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const totalBankBalance = bankAndCashAccounts
      .filter((a) => a.category === 'BANK')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    return {
      totalReceipts,
      totalPayments,
      countActive,
      totalCashBalance,
      totalBankBalance,
    };
  }, [vouchers, bankAndCashAccounts]);

  // Filtered Vouchers List
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // Type filter
      if (typeFilter !== 'ALL' && v.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL') {
        const isCancelled = v.status === 'CANCELLED';
        if (statusFilter === 'CANCELLED' && !isCancelled) return false;
        if (statusFilter === 'POSTED' && isCancelled) return false;
      }

      // Account filter
      if (accountFilter !== 'ALL') {
        if (v.bankAccountId !== accountFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const num = String(v.voucherNumber || '').toLowerCase();
        const entity = String(v.entityNameAr || '').toLowerCase();
        const notes = String(v.notes || '').toLowerCase();
        const ref = String(v.reference || '').toLowerCase();
        if (!num.includes(term) && !entity.includes(term) && !notes.includes(term) && !ref.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [vouchers, typeFilter, statusFilter, accountFilter, searchTerm]);

  // Open modal in Create mode
  const handleOpenCreate = (type: 'RECEIPT' | 'PAYMENT') => {
    setEditingVoucher(null);
    setVouchType(type);
    setVouchDate(new Date().toISOString().split('T')[0]);
    setVouchEntityId('');
    setVouchAmount(0);
    setVouchPaymentMethod(type === 'RECEIPT' ? 'BANK' : 'CASH');
    const defaultAcc = bankAndCashAccounts.find(
      (a) => (type === 'RECEIPT' ? a.category === 'BANK' : a.category === 'CASH')
    ) || bankAndCashAccounts[0];
    setVouchBankAcc(defaultAcc ? defaultAcc.id : 'acc-1111');
    setVouchInvoiceId('');
    setVouchReference('');
    setVouchNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEdit = (voucher: PaymentVoucher) => {
    setEditingVoucher(voucher);
    setVouchType(voucher.type);
    setVouchDate(voucher.date);
    setVouchEntityId(voucher.entityId || '');
    setVouchAmount(Number(voucher.amount) || 0);
    setVouchPaymentMethod(voucher.paymentMethod || (voucher.bankAccountId === 'acc-1112' ? 'CASH' : 'BANK'));
    setVouchBankAcc(voucher.bankAccountId || 'acc-1111');
    setVouchInvoiceId(voucher.invoiceId || '');
    setVouchReference(voucher.reference || '');
    setVouchNotes(voucher.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Live accounting simulation calculation
  const simulation = useMemo(() => {
    if (!vouchBankAcc || vouchAmount <= 0) return null;
    return VouchersService.simulateVoucherAccountingImpact({
      voucherType: vouchType,
      isEdit: Boolean(editingVoucher),
      amount: vouchAmount,
      bankAccountId: vouchBankAcc,
      entityId: vouchEntityId || undefined,
      entityType: vouchType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER',
      oldVoucher: editingVoucher || undefined,
    });
  }, [vouchType, editingVoucher, vouchAmount, vouchBankAcc, vouchEntityId]);

  // Handle Form Submit
  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!vouchEntityId) {
      setFormError(vouchType === 'RECEIPT' ? 'يرجى اختيار العميل' : 'يرجى اختيار المورد');
      return;
    }
    if (vouchAmount <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (!vouchBankAcc) {
      setFormError('يرجى اختيار حساب البنك أو الخزينة المالي');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find selected entity name
      let entityNameAr = '';
      if (vouchType === 'RECEIPT') {
        const c = customers.find((x) => x.id === vouchEntityId);
        if (c) entityNameAr = c.nameAr;
      } else {
        const s = suppliers.find((x) => x.id === vouchEntityId);
        if (s) entityNameAr = s.nameAr;
      }

      const payload = {
        type: vouchType,
        date: vouchDate || new Date().toISOString().split('T')[0],
        entityType: vouchType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER',
        entityId: vouchEntityId,
        entityNameAr,
        amount: Number(vouchAmount),
        paymentMethod: vouchPaymentMethod,
        bankAccountId: vouchBankAcc,
        invoiceId: vouchInvoiceId || undefined,
        reference: vouchReference || undefined,
        notes: vouchNotes,
        voucherNumber: editingVoucher?.voucherNumber,
      };

      if (editingVoucher && onUpdateVoucher) {
        await onUpdateVoucher(editingVoucher.id, payload);
      } else if (editingVoucher) {
        // Fallback to VouchersService directly
        await VouchersService.updateVoucher(editingVoucher.id, payload);
        if (onRefreshAll) await onRefreshAll();
      } else {
        await onCreateVoucher(payload);
      }

      setIsModalOpen(false);
      setEditingVoucher(null);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ وترحيل السند');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get bank name for a voucher
  const getAccountName = (bankAccId?: string, paymentMethod?: string) => {
    if (!bankAccId) {
      return paymentMethod === 'CASH' ? 'الصندوق الرئيسي (الخزينة)' : 'الحساب البنكي الرئيسي';
    }
    const acc = bankAndCashAccounts.find((a) => a.id === bankAccId || a.code === bankAccId);
    return acc ? `${acc.nameAr} (${acc.code})` : bankAccId;
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* 1. Header & Live Bank / Cash Balances Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Receipts */}
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#8C8273] font-bold block">إجمالي المقبوضات (تحصيل العملاء)</span>
            <span className="text-xl font-black text-[#2D6A4F] font-mono">
              {formatCurrency(stats.totalReceipts, currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#2D6A4F]">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#8C8273] font-bold block">إجمالي المدفوعات (سداد الموردين)</span>
            <span className="text-xl font-black text-[#9E2A2B] font-mono">
              {formatCurrency(stats.totalPayments, currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#9E2A2B]">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Bank Balances */}
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#8C8273] font-bold block">إجمالي أرصدة البنوك اللحظية</span>
            <span className="text-xl font-black text-[#1A1A1A] font-mono">
              {formatCurrency(stats.totalBankBalance, currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B8860B]">
            <Landmark className="w-6 h-6" />
          </div>
        </div>

        {/* Cash Balances */}
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#8C8273] font-bold block">إجمالي رصيد الصناديق والخزينة</span>
            <span className="text-xl font-black text-[#1A1A1A] font-mono">
              {formatCurrency(stats.totalCashBalance, currency)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Dynamic Accounts Live Ticker */}
      <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#6E6659] font-bold">
          <Scale className="w-4 h-4 text-[#B8860B]" />
          <span>الأرصدة الحالية للحسابات البنكية والنقدية المربوطة (ترحيل فوري مزدوج):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bankAndCashAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white border border-[#E5E1DA] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-2xs font-semibold"
            >
              {acc.category === 'BANK' ? (
                <Landmark className="w-3.5 h-3.5 text-[#B8860B]" />
              ) : (
                <Wallet className="w-3.5 h-3.5 text-blue-700" />
              )}
              <span className="text-[#1A1A1A]">{acc.nameAr}:</span>
              <span className="font-mono font-bold text-[#2D6A4F]">
                {formatCurrency(acc.balance, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Actions & Filters Bar */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#B8860B]" />
              سندات القبض والصرف المحاسبية (الربط المباشر مع البنوك والخزينة)
            </h3>
            <p className="text-xs text-[#8C8273]">
              ترحيل فوري للقيود المحاسبية مع التحديث التلقائي لأرصدة الحسابات البنكية وحسابات العملاء والموردين ومنع الأرصدة المعلقة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSyncAllVouchers}
              disabled={isSyncingLedger}
              className="px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="الإصلاح الفوري وتدقيق الأرقام المميزة: منع تكرار السندات، ضبط قيود اليومية، وتحديث أرصدة البنوك والخزينة والعملاء"
            >
              <Wrench className={`w-3.5 h-3.5 text-teal-600 ${isSyncingLedger ? 'animate-spin' : ''}`} />
              <span>{isSyncingLedger ? 'جارٍ الإصلاح والتدقيق...' : 'الإصلاح الفوري وتدقيق السندات'}</span>
            </button>

            <button
              onClick={() => handleOpenCreate('RECEIPT')}
              className="px-4 py-2.5 bg-[#2D6A4F] hover:bg-[#22533D] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء سند قبض (تحصيل)</span>
            </button>

            <button
              onClick={() => handleOpenCreate('PAYMENT')}
              className="px-4 py-2.5 bg-[#9E2A2B] hover:bg-[#782021] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء سند صرف (سداد)</span>
            </button>
          </div>
        </div>

        {syncSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#2D6A4F] font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[#E5E1DA] text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C8273] absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث برقم السند، الاسم، البيان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg pr-9 pl-3 py-2 text-xs text-[#1A1A1A] focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#8C8273]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg px-2.5 py-2 text-xs text-[#1A1A1A] font-semibold"
            >
              <option value="ALL">جميع أنواع السندات</option>
              <option value="RECEIPT">سندات القبض (تحصيل)</option>
              <option value="PAYMENT">سندات الصرف (سداد)</option>
            </select>
          </div>

          {/* Bank/Cash Account Filter */}
          <div>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg px-2.5 py-2 text-xs text-[#1A1A1A] font-semibold"
            >
              <option value="ALL">جميع الحسابات البنكية والخزائن</option>
              {bankAndCashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nameAr} ({acc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg px-2.5 py-2 text-xs text-[#1A1A1A] font-semibold"
            >
              <option value="ALL">جميع الحالات (معتمد وملغى)</option>
              <option value="POSTED">المعتمدة والنافذة فقط</option>
              <option value="CANCELLED">الملغاة والمعكوسة فقط</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Vouchers Table */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F7F5F0] text-[#1A1A1A] font-bold border-b border-[#E5E1DA]">
              <tr>
                <th className="py-3 px-4">رقم السند</th>
                <th className="py-3 px-4">نوع السند</th>
                <th className="py-3 px-4">الجهة (العميل / المورد)</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">الحساب المالي (الإيداع / الصرف)</th>
                <th className="py-3 px-4">طريقة الدفع</th>
                <th className="py-3 px-4">البيان</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1DA]">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#8C8273] space-y-2">
                    <FileText className="w-8 h-8 mx-auto opacity-40" />
                    <p className="font-semibold">لا توجد سندات مطابقة لمعايير البحث</p>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const isReceipt = v.type === 'RECEIPT';
                  const isCancelled = v.status === 'CANCELLED';

                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-[#FDFCFB] transition-all ${
                        isCancelled ? 'bg-[#FCF9F9] opacity-75' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#B8860B]">{v.voucherNumber}</td>
                      <td className="py-3 px-4 font-bold">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isReceipt
                              ? 'bg-emerald-50 text-[#2D6A4F] border border-emerald-200'
                              : 'bg-rose-50 text-[#9E2A2B] border border-rose-200'
                          }`}
                        >
                          {isReceipt ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {isReceipt ? 'سند قبض' : 'سند صرف'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1A1A1A]">{v.entityNameAr || '-'}</td>
                      <td className="py-3 px-4 text-[#8C8273] font-mono">{v.date}</td>
                      <td
                        className={`py-3 px-4 font-mono font-bold text-sm ${
                          isReceipt ? 'text-[#2D6A4F]' : 'text-[#9E2A2B]'
                        }`}
                      >
                        {formatCurrency(v.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-[#1A1A1A] font-medium">
                        <div className="flex items-center gap-1.5">
                          {v.paymentMethod === 'CASH' ? (
                            <Wallet className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          ) : (
                            <Landmark className="w-3.5 h-3.5 text-[#B8860B] shrink-0" />
                          )}
                          <span>{getAccountName(v.bankAccountId, v.paymentMethod)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#6E6659]">
                        {v.paymentMethod === 'CASH' ? 'نقداً (خزينة)' : 'تحويل بنكي / شيك'}
                      </td>
                      <td className="py-3 px-4 text-[#8C8273] max-w-[200px] truncate" title={v.notes}>
                        {v.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            isCancelled
                              ? 'bg-[#FDF0F0] text-[#9E2A2B] border-[#9E2A2B]/30'
                              : 'bg-[#EBF5EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                          }`}
                        >
                          {isCancelled ? 'ملغى ومعكوس' : 'مرحل ومعتمد'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Button */}
                          {onPrintVoucher && (
                            <button
                              onClick={() => onPrintVoucher(v)}
                              className="px-2 py-1 bg-[#1A1A1A] hover:bg-black text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="طباعة السند"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                              طباعة
                            </button>
                          )}

                          {/* Edit Button - Active only if not cancelled */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleOpenEdit(v)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-[#B8860B] border border-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                              title="تعديل السند وإعادة الترحيل المحاسبي الفوري"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              تعديل
                            </button>
                          )}

                          {/* Cancel / Reverse Button */}
                          {!isCancelled && onCancelVoucher && (
                            <button
                              onClick={async () => {
                                const reason = prompt(
                                  `إلغاء وعكس السند (${v.voucherNumber}):\nالرجاء كتابة سبب الإلغاء لإلغاء القيد المحاسبي واسترجاع رصيد البنك/الخزينة والعميل فوراً:`,
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
                              title="إلغاء السند وعكس أثره المالي"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              إلغاء وعكس
                            </button>
                          )}

                          {/* Delete Button */}
                          {onDeleteVoucher && (
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `⚠️ هل أنت متأكد من حذف السند (${v.voucherNumber})؟ سيتم عكس قيوده المحاسبية واسترجاع أرصدة البنوك والعملاء بالكامل.`
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create / Edit Voucher Modal with LIVE ACCOUNTING SIMULATION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E1DA] w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 dir-rtl text-right max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#E5E1DA] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                    vouchType === 'RECEIPT' ? 'bg-[#2D6A4F]' : 'bg-[#9E2A2B]'
                  }`}
                >
                  {vouchType === 'RECEIPT' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A1A1A]">
                    {editingVoucher
                      ? `تعديل ${editingVoucher.type === 'RECEIPT' ? 'سند القبض' : 'سند الصرف'} (${editingVoucher.voucherNumber})`
                      : vouchType === 'RECEIPT'
                      ? 'إنشاء سند قبض جديد (إيداع بنكي / خزينة)'
                      : 'إنشاء سند صرف جديد (منصرف بنكي / خزينة)'}
                  </h3>
                  <p className="text-[11px] text-[#8C8273]">
                    {editingVoucher
                      ? 'يتم إلغاء التأثير المحاسبي القديم وتطبيق الأثر الجديد فوراً على أرصدة البنوك والعملاء'
                      : 'ترحيل محاسبي فوري وتحديث لحظي لأرصدة الحسابات البنكية والذمم المدينة/الدائنة'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C8273] font-bold hover:text-[#1A1A1A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-[#9E2A2B] rounded-xl p-3 text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
              {/* Type and Payment Method selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">نوع السند</label>
                  <select
                    value={vouchType}
                    disabled={Boolean(editingVoucher)}
                    onChange={(e) => {
                      const newType = e.target.value as 'RECEIPT' | 'PAYMENT';
                      setVouchType(newType);
                      setVouchEntityId('');
                    }}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A]"
                  >
                    <option value="RECEIPT">سند قبض (تحصيل من عميل)</option>
                    <option value="PAYMENT">سند صرف (سداد لمورد)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">طريقة السداد</label>
                  <select
                    value={vouchPaymentMethod}
                    onChange={(e) => {
                      const method = e.target.value as 'CASH' | 'BANK';
                      setVouchPaymentMethod(method);
                      const matchingAcc = bankAndCashAccounts.find((a) => a.category === method);
                      if (matchingAcc) setVouchBankAcc(matchingAcc.id);
                    }}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 font-bold text-[#1A1A1A]"
                  >
                    <option value="BANK">تحويل بنكي / إيداع بنكي / شيك</option>
                    <option value="CASH">نقداً من الخزينة / الصندوق</option>
                  </select>
                </div>
              </div>

              {/* Entity & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">
                    {vouchType === 'RECEIPT' ? 'العميل *' : 'المورد *'}
                  </label>
                  <select
                    required
                    value={vouchEntityId}
                    onChange={(e) => setVouchEntityId(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-semibold"
                  >
                    <option value="">{vouchType === 'RECEIPT' ? '-- اختر العميل --' : '-- اختر المورد --'}</option>
                    {vouchType === 'RECEIPT'
                      ? customers.map((c) => {
                          const liveBal = getCalculatedCustomerBalance(c.id, invoices, vouchers, [], customers);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.nameAr} (الرصيد: {formatCurrency(liveBal, currency)})
                            </option>
                          );
                        })
                      : suppliers.map((s) => {
                          const liveBal = getCalculatedSupplierBalance(s.id, invoices, vouchers, [], suppliers);
                          return (
                            <option key={s.id} value={s.id}>
                              {s.nameAr} (الرصيد: {formatCurrency(liveBal, currency)})
                            </option>
                          );
                        })}
                  </select>
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">تاريخ السند *</label>
                  <input
                    type="date"
                    required
                    value={vouchDate}
                    onChange={(e) => setVouchDate(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-mono"
                  />
                </div>
              </div>

              {/* Amount and Bank/Cash Account Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">
                    المبلغ بالـ ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="0.000"
                    value={vouchAmount || ''}
                    onChange={(e) => setVouchAmount(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-[#E5E1DA] rounded-lg p-2.5 text-[#2D6A4F] font-mono font-black text-lg focus:border-[#2D6A4F] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">
                    حساب البنك أو الخزينة المالي *
                  </label>
                  <select
                    required
                    value={vouchBankAcc}
                    onChange={(e) => setVouchBankAcc(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A] font-semibold"
                  >
                    {bankAndCashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nameAr} ({acc.code}) - الرصيد: {formatCurrency(acc.balance, currency)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الرقم المرجعي / رقم الشيك</label>
                  <input
                    type="text"
                    placeholder="مثال: CHQ-99201"
                    value={vouchReference}
                    onChange={(e) => setVouchReference(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">البيان والشرح</label>
                  <input
                    type="text"
                    placeholder="سبب التحصيل أو السداد..."
                    value={vouchNotes}
                    onChange={(e) => setVouchNotes(e.target.value)}
                    className="w-full bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg p-2.5 text-[#1A1A1A]"
                  />
                </div>
              </div>

              {/* 6. LIVE SIMULATION BOX (Double-Entry Integrity & Instant Balance Impact) */}
              {simulation && (
                <div className="bg-[#FAF9F6] border border-[#D4AF37]/50 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-2 font-bold text-[#1A1A1A]">
                    <span className="flex items-center gap-1.5 text-[#B8860B]">
                      <Scale className="w-4 h-4" />
                      الأثر المحاسبي اللحظي المباشر (Double-Entry Projection):
                    </span>
                    {editingVoucher && (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold">
                        تعديل سند: فارق المبلغ ({formatCurrency(simulation.deltaAmount, currency)})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Bank Impact */}
                    <div className="bg-white border border-[#E5E1DA] rounded-lg p-2.5 space-y-1">
                      <span className="text-[11px] font-bold text-[#6E6659] block">
                        🏦 {simulation.targetAccount.nameAr}
                      </span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>الرصيد الحالي:</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(simulation.targetAccount.currentBalance, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-dashed border-[#E5E1DA]">
                        <span>الرصيد بعد الحفظ:</span>
                        <span
                          className={`font-mono font-black ${
                            simulation.targetAccount.projectedBalance >= simulation.targetAccount.currentBalance
                              ? 'text-[#2D6A4F]'
                              : 'text-[#9E2A2B]'
                          }`}
                        >
                          {formatCurrency(simulation.targetAccount.projectedBalance, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Entity Impact */}
                    {simulation.entity && (
                      <div className="bg-white border border-[#E5E1DA] rounded-lg p-2.5 space-y-1">
                        <span className="text-[11px] font-bold text-[#6E6659] block">
                          👤 {simulation.entity.nameAr}
                        </span>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>الرصيد الحالي:</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(simulation.entity.currentBalance, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-dashed border-[#E5E1DA]">
                          <span>الرصيد بعد السند:</span>
                          <span className="font-mono font-black text-[#1A1A1A]">
                            {formatCurrency(simulation.entity.projectedBalance, currency)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Journal lines preview */}
                  <div className="bg-white border border-[#E5E1DA] rounded-lg p-2 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-emerald-800 font-semibold">
                      <span>المدين (Debit): {simulation.journalDebit}</span>
                      <span className="font-mono font-bold">+{formatCurrency(vouchAmount, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-900 font-semibold">
                      <span>الدائن (Credit): {simulation.journalCredit}</span>
                      <span className="font-mono font-bold">-{formatCurrency(vouchAmount, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-xl font-semibold hover:bg-[#FAF9F6] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSubmitting
                      ? 'bg-neutral-400 cursor-not-allowed'
                      : vouchType === 'RECEIPT'
                      ? 'bg-[#2D6A4F] hover:bg-[#22533D]'
                      : 'bg-[#9E2A2B] hover:bg-[#782021]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'جاري الحفظ والترحيل...'
                      : editingVoucher
                      ? 'تعديل السند وترحيل الفروقات فوراً'
                      : 'حفظ السند والترحيل الفوري'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
