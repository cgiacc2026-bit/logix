import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  Package,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Boxes,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { Warehouse, InventoryItem, CompanyProfile } from '../types.js';
import { DataService, localDataStore } from '../services/dataService.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface WarehousesManagementViewProps {
  company: CompanyProfile;
  inventory: InventoryItem[];
  currency: string;
  onRefreshAll: () => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

export const WarehousesManagementView: React.FC<WarehousesManagementViewProps> = ({
  company,
  inventory,
  currency,
  onRefreshAll,
  onNavigateTab,
}) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => DataService.getWarehouses());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [location, setLocation] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const warehouseStocks = localDataStore.getWarehouseStocks();

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setCode(`WH-0${warehouses.length + 1}`);
    setNameAr('');
    setNameEn('');
    setLocation('الشويخ الصناعية');
    setManagerName('');
    setPhone('');
    setIsDefault(warehouses.length === 0);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setCode(w.code || '');
    setNameAr(w.nameAr || '');
    setNameEn(w.nameEn || '');
    setLocation(w.location || '');
    setManagerName(w.managerName || '');
    setPhone(w.phone || '');
    setIsDefault(Boolean(w.isDefault));
    setNotes(w.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      alert('يرجى إدخال اسم المستودع بالعربي');
      return;
    }

    try {
      const warehousePayload: Warehouse = {
        id: editingWarehouse ? editingWarehouse.id : 'wh-' + Date.now().toString(36),
        code,
        nameAr,
        nameEn,
        location,
        managerName,
        phone,
        isDefault,
        notes,
        company_id: company.id,
      };

      await DataService.saveWarehouse(warehousePayload);
      setWarehouses(DataService.getWarehouses());
      setIsModalOpen(false);
      setFeedback('تم حفظ بيانات المستودع بنجاح.');
      setTimeout(() => setFeedback(null), 3000);
      await onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'تعذر حفظ بيانات المستودع');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A365D] via-[#2A4365] to-[#1A202C] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-blue-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <WarehouseIcon className="w-3.5 h-3.5" />
            <span>نظام إدارة المستودعات والمخازن التوزيعية (WMS Enterprise)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-wide text-white">
            المستودعات ومواقع التخزين (Warehouses & Stock Hubs)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            إدارة كافة المستودعات الرئيسية والفرعية، ربط حركات الصرف والإضافة المباشرة، وتتبع أرصدة الأصناف بدقة بالغة داخل كل مستودع.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('stock-ledger')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4 text-cyan-300" />
              <span>أذون الحركات والجرد</span>
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مستودع جديد</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-2.5 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-3 text-[#8C8273]" />
        <input
          type="text"
          placeholder="البحث باسم المستودع، الكود، أو الموقع الجغرافي..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-10 py-2.5 bg-white border border-[#E5E1DA] rounded-xl text-xs text-[#1A1A1A] focus:outline-hidden focus:border-[#B8860B]"
        />
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses
          .filter((w) => !searchTerm || w.nameAr.includes(searchTerm) || w.code.includes(searchTerm))
          .map((w) => {
            const whItemCount = warehouseStocks.filter((s) => s.warehouseId === w.id && s.quantityOnHand > 0).length;

            return (
              <div
                key={w.id}
                className="bg-white border border-[#E5E1DA] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#1E3E62] transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold text-xs">
                        <WarehouseIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1A1A1A]">{w.nameAr}</h4>
                        <span className="text-[11px] text-[#8C8273] font-mono block">{w.code}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {w.isDefault && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          الافتراضي
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEdit(w)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="تعديل بيانات المستودع"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-[#6E6659] border-t border-[#E5E1DA] pt-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{w.location || 'الشويخ الصناعية'}</span>
                    </div>
                    {w.managerName && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>أمين المستودع: {w.managerName}</span>
                      </div>
                    )}
                    {w.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="dir-ltr">{w.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[#8C8273]">الأصناف المتوفرة به:</span>
                      <span className="font-bold font-mono text-blue-700">
                        {whItemCount > 0 ? `${whItemCount} صنف` : `${inventory.length} صنف متاح`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#E5E1DA] flex items-center justify-between">
                  <span className="text-[11px] text-[#8C8273]">
                    {w.notes || 'جاهز للربط بالـ POS وفواتير البيع والشراء'}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Add / Edit Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#E5E1DA]">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-amber-600" />
                <span>{editingWarehouse ? 'تعديل بيانات المستودع' : 'إضافة مستودع جديد'}</span>
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
                  <label className="block text-[#1A1A1A] font-bold mb-1">كود المستودع</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="WH-01"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg font-mono focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">الموقع / المنطقة</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="الشويخ الصناعية"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">اسم المستودع بالعربي *</label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="المستودع الرئيسي (الشويخ)"
                  className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">اسم المستودع بالإنجليزي</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Main Warehouse (Shuwaikh)"
                  className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">اسم أمين المستودع المسؤول</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="م. أحمد الكندري"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">رقم الهاتف للتواصل</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+965 2480 0000"
                    className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">ملاحظات المستودع</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مستودع مبرد ومخصص للمواد الغذائية والبهارات التامة"
                  className="w-full p-2 border border-[#E5E1DA] rounded-lg focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultWarehouse"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-[#E5E1DA] text-blue-600"
                />
                <label htmlFor="isDefaultWarehouse" className="text-xs text-[#1A1A1A] font-bold cursor-pointer">
                  تعيين كمستودع رئيسي وافتراضي لحركات البيع والمشتريات
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
                  حفظ المستودع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
