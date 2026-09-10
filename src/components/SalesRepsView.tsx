import React, { useState } from 'react';
import {
  SalesRep,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import { DataService } from '../services/dataService.ts';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  Award,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  Calendar,
  Building2,
  Filter,
} from 'lucide-react';

interface SalesRepsViewProps {
  salesReps: SalesRep[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  company: CompanyProfile | null;
  currency: string;
  onRefreshAll: () => Promise<void> | void;
}

export const SalesRepsView: React.FC<SalesRepsViewProps> = ({
  salesReps,
  invoices,
  vouchers,
  company,
  currency,
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'REPORTS'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(2.5);
  const [targetAmount, setTargetAmount] = useState<number>(50000);
  const [notes, setNotes] = useState('');

  // Report Filtering State
  const [selectedRepId, setSelectedRepId] = useState<string>('ALL');

  const openCreateModal = () => {
    setEditingRep(null);
    setCode(`REP-${String(salesReps.length + 1).padStart(2, '0')}`);
    setNameAr('');
    setNameEn('');
    setPhone('');
    setEmail('');
    setCommissionRate(2.5);
    setTargetAmount(50000);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (rep: SalesRep) => {
    setEditingRep(rep);
    setCode(rep.code);
    setNameAr(rep.nameAr);
    setNameEn(rep.nameEn || '');
    setPhone(rep.phone || '');
    setEmail(rep.email || '');
    setCommissionRate(rep.commissionRate);
    setTargetAmount(rep.targetAmount || 0);
    setNotes(rep.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      alert('يرجى إدخال اسم المندوب');
      return;
    }

    const newRep: SalesRep = {
      id: editingRep ? editingRep.id : 'rep-' + Math.random().toString(36).substr(2, 9),
      code,
      nameAr,
      nameEn,
      phone,
      email,
      commissionRate,
      targetAmount,
      isActive: true,
      notes,
      companyId: company?.id,
      createdAt: editingRep?.createdAt || new Date().toISOString(),
    };

    await DataService.saveSalesRep(newRep);
    setIsModalOpen(false);
    await onRefreshAll();
  };

  const handleDeleteRep = async (id: string) => {
    if (confirm('هل أنت تأكد من حذف هذا المندوب؟')) {
      await DataService.deleteSalesRep(id);
      await onRefreshAll();
    }
  };

  const filteredReps = salesReps.filter(
    (r) =>
      r.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.phone && r.phone.includes(searchTerm))
  );

  // Performance Calculations
  const repPerformance = salesReps.map((rep) => {
    const repInvoices = invoices.filter(
      (i) => i.salesRepId === rep.id || i.salesPerson === rep.nameAr
    );
    const totalSales = repInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const totalPaid = repInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalDue = repInvoices.reduce((s, i) => s + i.dueAmount, 0);
    const totalCommission = (totalSales * rep.commissionRate) / 100;
    const repVouchers = vouchers.filter(
      (v) => v.salesRepId === rep.id || v.salesRepName === rep.nameAr
    );
    const totalCollected = repVouchers.reduce((s, v) => s + v.amount, 0);

    return {
      rep,
      repInvoices,
      totalSales,
      totalPaid,
      totalDue,
      totalCommission,
      totalCollected,
    };
  });

  const selectedRepStats =
    selectedRepId === 'ALL'
      ? null
      : repPerformance.find((p) => p.rep.id === selectedRepId);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">إدارة المناديب وعمولات المبيعات</h1>
            <p className="text-xs text-slate-300">
              دليل مندوبي المبيعات والتوزيع مع الاحتساب الآلي للعمولات ومتابعة التحصيلات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            دليل المناديب ({salesReps.length})
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REPORTS'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            تقارير الكفاءة والعمولات
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مندوب جديد</span>
          </button>
        </div>
      </div>

      {activeTab === 'LIST' ? (
        <div className="space-y-4">
          {/* Search */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث باسم المندوب، الكود، أو رقم الهاتف..."
                className="w-full pr-9 pl-3 py-1.5 bg-slate-800 text-white text-xs border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReps.map((rep) => {
              const perf = repPerformance.find((p) => p.rep.id === rep.id);
              return (
                <div
                  key={rep.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                        {rep.code}
                      </span>
                      <h3 className="font-bold text-white text-sm mt-1">{rep.nameAr}</h3>
                      {rep.nameEn && <span className="text-xs text-slate-400">{rep.nameEn}</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(rep)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRep(rep.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-rose-400 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    {rep.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{rep.phone}</span>
                      </div>
                    )}
                    {rep.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rep.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Mini Row */}
                  <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">نسبة العمولة</span>
                      <span className="font-bold text-emerald-400">{rep.commissionRate}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">إجمالي مبيعاته</span>
                      <span className="font-bold text-cyan-300 font-mono">
                        {formatCurrency(perf?.totalSales || 0, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Performance & Commission Reports Tab */
        <div className="space-y-4">
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">اختر المندوب:</span>
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="ALL">جميع المناديب</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameAr} ({r.code})
                </option>
              ))}
            </select>
          </div>

          {/* Performance Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-right text-xs text-slate-200">
              <thead className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-3">كود المندوب</th>
                  <th className="p-3">اسم المندوب</th>
                  <th className="p-3 text-center">عدد الفواتير</th>
                  <th className="p-3">إجمالي المبيعات</th>
                  <th className="p-3">التحصيلات النقدية</th>
                  <th className="p-3 text-center">نسبة العمولة</th>
                  <th className="p-3 text-emerald-400">العمولة المستحقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-semibold">
                {repPerformance.map((p) => (
                  <tr key={p.rep.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-300">{p.rep.code}</td>
                    <td className="p-3 font-bold text-white">{p.rep.nameAr}</td>
                    <td className="p-3 text-center font-mono">{p.repInvoices.length}</td>
                    <td className="p-3 font-mono">{formatCurrency(p.totalSales, currency)}</td>
                    <td className="p-3 font-mono text-cyan-300">
                      {formatCurrency(p.totalCollected, currency)}
                    </td>
                    <td className="p-3 text-center font-mono">{p.rep.commissionRate}%</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      {formatCurrency(p.totalCommission, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales Rep Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D2137] border border-indigo-500/30 w-full max-w-lg rounded-2xl p-5 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>{editingRep ? 'تعديل بيانات المندوب' : 'إضافة مندوب مبيعات جديد'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRep} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الكود *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الاسم بالعربية *</label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: أحمد بن عبد العزيز"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+965 ..."
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rep@example.com"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">نسبة العمولة (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">المستهدف الشهري ({currency})</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">ملاحظات وتفاصيل المنطقة</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold cursor-pointer shadow-lg"
                >
                  حفظ بيانات المندوب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
