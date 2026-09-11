import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  MapPin,
  Phone,
  Store,
  Warehouse as WarehouseIcon,
  DollarSign,
  ShieldCheck,
  Check,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { Branch, CompanyProfile, Warehouse, Account } from '../types.js';
import { branchService } from '../services/branchService.ts';
import { DataService } from '../services/dataService.ts';

interface BranchesManagementViewProps {
  company: CompanyProfile;
  warehouses: Warehouse[];
  accounts: Account[];
  currency: string;
  onRefreshAll: () => Promise<void>;
}

export const BranchesManagementView: React.FC<BranchesManagementViewProps> = ({
  company,
  warehouses,
  accounts,
  currency,
  onRefreshAll,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch>(() => branchService.getActiveBranch(company.id));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('الكويت');
  const [warehouseId, setWarehouseId] = useState('');
  const [posCashAccountId, setPosCashAccountId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadBranches = () => {
    const list = branchService.getBranchesForCurrentCompany(company.id);
    setBranches(list);
    const active = branchService.getActiveBranch(company.id);
    setActiveBranch(active);
  };

  useEffect(() => {
    loadBranches();
  }, [company.id]);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setCode(`BR-${String(branches.length + 1).padStart(2, '0')}`);
    setNameAr('');
    setNameEn('');
    setPhone('');
    setAddress('');
    setCity('الكويت');
    setWarehouseId(warehouses[0]?.id || 'wh-main-01');
    const cashAcc = accounts.find((a) => a.code === '1111' || a.nameAr.includes('صندوق') || a.category === 'ASSET');
    setPosCashAccountId(cashAcc ? cashAcc.id : '');
    setIsDefault(branches.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Branch) => {
    setEditingBranch(b);
    setCode(b.code || '');
    setNameAr(b.nameAr || '');
    setNameEn(b.nameEn || '');
    setPhone(b.phone || '');
    setAddress(b.address || '');
    setCity(b.city || 'الكويت');
    setWarehouseId((b as any).warehouseId || (b as any).warehouse_id || warehouses[0]?.id || '');
    setPosCashAccountId((b as any).posCashAccountId || (b as any).pos_cash_account_id || '');
    setIsDefault(Boolean(b.isDefault));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      alert('يرجى إدخال اسم الفرع بالعربي');
      return;
    }

    try {
      if (editingBranch) {
        // Update
        const updated: Branch = {
          ...editingBranch,
          code,
          nameAr,
          nameEn,
          phone,
          address,
          city,
          warehouseId,
          posCashAccountId,
          isDefault,
        };
        // Persist update in branchService
        const all = branchService.getBranchesForCurrentCompany(company.id);
        const idx = all.findIndex((x) => x.id === editingBranch.id);
        if (idx !== -1) {
          all[idx] = updated;
          if (isDefault) {
            all.forEach((x) => {
              if (x.id !== updated.id) x.isDefault = false;
            });
          }
          localStorage.setItem('logix_branches_list', JSON.stringify(all));
        }
      } else {
        // Add
        branchService.addBranch({
          company_id: company.id,
          code,
          nameAr,
          nameEn,
          phone,
          address,
          city,
          isDefault,
          warehouseId,
          posCashAccountId,
        } as any);
      }

      loadBranches();
      setIsModalOpen(false);
      setFeedback('تم حفظ بيانات الفرع وتحديث الربط بنجاح.');
      setTimeout(() => setFeedback(null), 4000);
      await onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'تعذر حفظ الفرع');
    }
  };

  const handleSwitchActiveBranch = (b: Branch) => {
    branchService.setActiveBranch(b.id);
    setActiveBranch(b);
    setFeedback(`تم تعيين "${b.nameAr}" كفرع نشط للعمليات الحالية والـ POS.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F2942] via-[#1E3E62] to-[#0A1D30] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#2E5E8A]/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
            <Building2 className="w-3.5 h-3.5" />
            <span>نظام إدارة الفروع والمواقع المتعددة (Multi-Branch ERP)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-wide text-white">
            إدارة الفروع ومحطات البيع (Branches & POS Stations)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            ربط الفواتير والقيود والـ POS بالفرع والمستودع والصندوق المحدد. يتيح عزل وتتبع أداء المبيعات والمخزون لكل فرع على حدة بدقة متناهية.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-2.5 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Active Branch Highlight Card */}
      <div className="bg-[#F7F5F0] border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3E62] text-cyan-300 flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-[#8C8273] font-bold">الفرع النشط حالياً لجلسة العمل والمبيعات:</div>
            <div className="text-sm font-extrabold text-[#1A1A1A] flex items-center gap-2">
              <span>{activeBranch.nameAr}</span>
              <span className="text-[10px] bg-white border border-[#E5E1DA] px-2 py-0.5 rounded text-[#1E3E62] font-mono font-bold">
                {activeBranch.code}
              </span>
              {activeBranch.isDefault && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  الفرع الرئيسي
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-[#6E6659] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#B8860B]" />
          <span>{activeBranch.address || activeBranch.city || 'مدينة الكويت'}</span>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((b) => {
          const isActiveForUser = activeBranch.id === b.id;
          const wh = warehouses.find((w) => w.id === (b as any).warehouseId || w.id === (b as any).warehouse_id);
          const cashAcc = accounts.find((a) => a.id === (b as any).posCashAccountId || a.id === (b as any).pos_cash_account_id);

          return (
            <div
              key={b.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                isActiveForUser
                  ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md'
                  : 'border-[#E5E1DA] hover:border-slate-400'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs">
                      {b.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#1A1A1A]">{b.nameAr}</h4>
                      {b.nameEn && <span className="text-[11px] text-[#8C8273] block">{b.nameEn}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {b.isDefault && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                        افتراضي
                      </span>
                    )}
                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                      title="تعديل بيانات الفرع"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#6E6659] border-t border-[#E5E1DA] pt-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{b.address || b.city || 'العنوان غير مدخل'}</span>
                  </div>
                  {b.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="dir-ltr">{b.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <WarehouseIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>المستودع المرتبط: </span>
                    <span className="font-bold text-[#1A1A1A]">{wh ? wh.nameAr : 'المستودع الرئيسي'}</span>
                  </div>
                  {cashAcc && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>الصندوق: </span>
                      <span className="font-bold text-[#1A1A1A]">[{cashAcc.code}] {cashAcc.nameAr}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E5E1DA] flex items-center justify-between gap-2">
                {isActiveForUser ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl w-full justify-center">
                    <Check className="w-4 h-4 text-blue-700" />
                    <span>الفرع النشط حالياً</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleSwitchActiveBranch(b)}
                    className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    تفعيل هذا الفرع
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#E5E1DA]">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1E3E62]" />
                <span>{editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">كود الفرع</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="BR-01"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg font-mono focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">المدينة / المنطقة</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="مدينة الكويت"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">اسم الفرع بالعربي *</label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="الفرع الرئيسي - الشويخ"
                  className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">اسم الفرع بالإنجليزي</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Main Branch - Shuwaikh"
                  className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">المستودع المصدر الافتراضي</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg bg-white focus:border-blue-600 focus:outline-hidden"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nameAr} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">صندوق الخزينة المربوط</label>
                  <select
                    value={posCashAccountId}
                    onChange={(e) => setPosCashAccountId(e.target.value)}
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg bg-white focus:border-blue-600 focus:outline-hidden"
                  >
                    <option value="">-- اختياري (الصندوق الرئيسي) --</option>
                    {accounts
                      .filter((a) => a.category === 'ASSET')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.nameAr}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">هاتف الفرع</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+965 2200 0000"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="شارع البنوك - قسيمة 12"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultBranch"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-[#E5E1DA] text-blue-600"
                />
                <label htmlFor="isDefaultBranch" className="text-xs text-[#1A1A1A] font-bold cursor-pointer">
                  تعيين كفرع رئيسي وافتراضي للنظام
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] rounded-xl text-slate-700 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  حفظ بيانات الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
