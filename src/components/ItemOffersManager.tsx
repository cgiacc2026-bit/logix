import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Barcode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  TrendingDown,
  Info,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { InventoryItem, ItemOffer } from '../types.js';
import { DataService } from '../services/dataService.ts';

interface ItemOffersManagerProps {
  inventory: InventoryItem[];
  currency: string;
  companyId?: string;
  onRefreshAll?: () => Promise<void> | void;
}

export const ItemOffersManager: React.FC<ItemOffersManagerProps> = ({
  inventory,
  currency,
  companyId,
  onRefreshAll,
}) => {
  const [offers, setOffers] = useState<ItemOffer[]>(() => DataService.getAllItemOffers(companyId));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ItemOffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  // Modal Form State
  const [formBaseItemId, setFormBaseItemId] = useState('');
  const [formTitleAr, setFormTitleAr] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formOfferQuantity, setFormOfferQuantity] = useState<number>(2);
  const [formOfferPrice, setFormOfferPrice] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // Search within modal item picker
  const [modalItemSearch, setModalItemSearch] = useState('');

  const refreshOffers = () => {
    const list = DataService.getAllItemOffers(companyId);
    setOffers(list);
  };

  useEffect(() => {
    refreshOffers();
    DataService.fetchItemOffers(companyId).then(() => {
      refreshOffers();
    });
  }, [companyId, inventory]);

  const selectedBaseItem = useMemo(() => {
    return inventory.find((i) => i.id === formBaseItemId) || null;
  }, [inventory, formBaseItemId]);

  // Filtered inventory for modal picker
  const filteredModalItems = useMemo(() => {
    if (!modalItemSearch.trim()) return inventory.slice(0, 30);
    const q = modalItemSearch.toLowerCase();
    return inventory
      .filter(
        (i) =>
          i.nameAr?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q) ||
          (i.barcode && i.barcode.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [inventory, modalItemSearch]);

  // Derived metrics for current form
  const normalPrice = useMemo(() => {
    if (!selectedBaseItem) return 0;
    return (selectedBaseItem.salePrice || 0) * formOfferQuantity;
  }, [selectedBaseItem, formOfferQuantity]);

  const savingsAmount = Math.max(0, normalPrice - formOfferPrice);
  const savingsPercent = normalPrice > 0 ? Math.round((savingsAmount / normalPrice) * 100) : 0;
  const effectiveUnitPrice = formOfferQuantity > 0 ? formOfferPrice / formOfferQuantity : 0;
  const availableOffersCount = selectedBaseItem
    ? Math.floor((selectedBaseItem.quantityOnHand || 0) / (formOfferQuantity || 1))
    : 0;

  const handleOpenAdd = () => {
    setEditingOffer(null);
    setFormBaseItemId(inventory[0]?.id || '');
    setFormTitleAr('');
    setFormBarcode(`OFFER-${Date.now().toString().slice(-6)}`);
    setFormOfferQuantity(2);
    setFormOfferPrice(inventory[0]?.salePrice ? Number((inventory[0].salePrice * 1.6).toFixed(3)) : 0);
    setFormIsActive(true);
    setFormNotes('');
    setModalItemSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer: ItemOffer) => {
    setEditingOffer(offer);
    setFormBaseItemId(offer.base_item_id);
    setFormTitleAr(offer.title_ar);
    setFormBarcode(offer.barcode || '');
    setFormOfferQuantity(offer.offer_quantity);
    setFormOfferPrice(offer.offer_price);
    setFormIsActive(offer.is_active);
    setFormNotes(offer.notes || '');
    setModalItemSearch('');
    setIsModalOpen(true);
  };

  const handleSelectBaseItem = (item: InventoryItem) => {
    setFormBaseItemId(item.id);
    if (!editingOffer) {
      setFormTitleAr(`عرض 2 حبة ${item.nameAr} بسعر خاص`);
      const normal = (item.salePrice || 0) * 2;
      setFormOfferPrice(Number((normal * 0.8).toFixed(3)));
    }
  };

  const handleGenerateBarcode = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setFormBarcode(`OFFER-${randomSuffix}`);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBaseItemId) {
      alert('يرجى اختيار الصنف الأساسي للعرض.');
      return;
    }
    if (!formTitleAr.trim()) {
      alert('يرجى إدخال اسم العرض الترويجي.');
      return;
    }
    if (formOfferQuantity <= 0) {
      alert('كمية العرض يجب أن تكون أكبر من صفر.');
      return;
    }
    if (formOfferPrice < 0) {
      alert('سعر العرض لا يمكن أن يكون سالباً.');
      return;
    }

    setIsSaving(true);
    try {
      const offerId = editingOffer ? editingOffer.id : `off-${Date.now()}`;
      const offerPayload: ItemOffer = {
        id: offerId,
        company_id: companyId || '',
        companyId: companyId,
        base_item_id: formBaseItemId,
        baseItemId: formBaseItemId,
        title_ar: formTitleAr.trim(),
        barcode: formBarcode.trim() || undefined,
        offer_quantity: Number(formOfferQuantity),
        offer_price: Number(formOfferPrice),
        original_price: Number(normalPrice.toFixed(3)),
        is_active: formIsActive,
        notes: formNotes.trim() || undefined,
        created_at: editingOffer?.created_at || new Date().toISOString(),
      };

      await DataService.saveItemOffer(offerPayload);
      refreshOffers();
      setIsModalOpen(false);
      if (onRefreshAll) await onRefreshAll();
    } catch (err: any) {
      console.error('Error saving item offer:', err);
      alert(`حدث خطأ أثناء حفظ العرض: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOffer = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف العرض الترويجي "${title}"؟`)) {
      return;
    }
    try {
      await DataService.deleteItemOffer(id);
      refreshOffers();
      if (onRefreshAll) await onRefreshAll();
    } catch (err: any) {
      console.error('Error deleting item offer:', err);
      alert('حدث خطأ أثناء حذف العرض.');
    }
  };

  const handleToggleStatus = async (offer: ItemOffer) => {
    try {
      const updated: ItemOffer = {
        ...offer,
        is_active: !offer.is_active,
      };
      await DataService.saveItemOffer(updated);
      refreshOffers();
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      console.error('Error updating offer status:', err);
    }
  };

  const handleCopyBarcode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBarcode(code);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  // Filtered offers list
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const baseItem = inventory.find((i) => i.id === o.base_item_id);
      const matchesText =
        !searchTerm.trim() ||
        o.title_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.barcode && o.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (baseItem && baseItem.nameAr.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (baseItem && baseItem.sku.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && o.is_active) ||
        (statusFilter === 'INACTIVE' && !o.is_active);

      return matchesText && matchesStatus;
    });
  }, [offers, inventory, searchTerm, statusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const activeList = offers.filter((o) => o.is_active);
    const uniqueBaseItems = new Set(offers.map((o) => o.base_item_id)).size;
    let totalBundlesAvailable = 0;
    activeList.forEach((o) => {
      totalBundlesAvailable += DataService.getOfferAvailableCount(o, inventory);
    });

    return {
      totalOffers: offers.length,
      activeOffers: activeList.length,
      uniqueBaseItems,
      totalBundlesAvailable,
    };
  }, [offers, inventory]);

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 text-right">
          <h4 className="text-sm font-bold text-amber-900">
            هيكلية عروض الأصناف الترويجية الافتراضية (Virtual Bundles)
          </h4>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            العرض ليس صنفاً مستقلاً بمخزون خاص، بل هو طريقة بيع بديلة للصنف الأساسي. عند بيع أي عرض في نقطة البيع أو الفاتورة،
            يتم خصم الكمية الفعلية تلقائياً من رصيد الصنف الأصلي، ويُسجّل الإيراد بالقيمة المخفضة وتكلفة البضاعة بدقة المعايير المحاسبية.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#8C8273] mb-1">إجمالي العروض الترويجية</div>
          <div className="text-2xl font-black text-[#1A1A1A] flex items-baseline gap-2">
            <span>{stats.totalOffers}</span>
            <span className="text-xs font-semibold text-emerald-600">({stats.activeOffers} نشط)</span>
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#8C8273] mb-1">الأصناف المشمولة بالعروض</div>
          <div className="text-2xl font-black text-[#1A1A1A]">{stats.uniqueBaseItems} صنف</div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#8C8273] mb-1">إجمالي الحزم المتوفرة للبيع</div>
          <div className="text-2xl font-black text-emerald-700">{stats.totalBundlesAvailable} باقة</div>
          <div className="text-[10px] text-slate-400 mt-0.5">محسوبة من الرصيد الفعلي للأصناف</div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#8C8273] mb-1">إجراء سريع</div>
            <button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عرض جديد</span>
            </button>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C8273]" />
          <input
            type="text"
            placeholder="البحث باسم العرض، الصنف الأصلي، أو الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#F7F5F0] border border-[#E5E1DA] rounded-xl pr-10 pl-4 py-2 text-xs font-bold text-[#1A1A1A] focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-[#F7F5F0] border border-[#E5E1DA] p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#8C8273]'
              }`}
            >
              الكل ({offers.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-[#8C8273]'
              }`}
            >
              النشطة ({stats.activeOffers})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'INACTIVE' ? 'bg-white text-rose-700 shadow-xs' : 'text-[#8C8273]'
              }`}
            >
              المعطلة ({offers.length - stats.activeOffers})
            </button>
          </div>

          <button
            onClick={refreshOffers}
            title="تحديث القائمة"
            className="p-2 border border-[#E5E1DA] rounded-xl text-[#6E6659] hover:bg-[#F7F5F0] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F7F5F0] text-[#6E6659] font-bold border-b border-[#E5E1DA]">
              <tr>
                <th className="py-3 px-4">عنوان العرض والباركود</th>
                <th className="py-3 px-4">الصنف الأساسي المخصوم منه</th>
                <th className="py-3 px-4 text-center">كمية الخصم</th>
                <th className="py-3 px-4 text-left">سعر العرض</th>
                <th className="py-3 px-4 text-left">السعر الأصلي والوفر</th>
                <th className="py-3 px-4 text-center">الرصيد المتاح بالعرض</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1DA]">
              {filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#8C8273]">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#8C8273]/40" />
                    <p className="font-bold">لا توجد عروض ترويجية مطابقة للبحث</p>
                    <p className="text-[11px] mt-1">اضغط على زر "إضافة عرض جديد" لإنشاء أول عرض ترويجي للصنف</p>
                  </td>
                </tr>
              ) : (
                filteredOffers.map((offer) => {
                  const baseItem = inventory.find((i) => i.id === offer.base_item_id);
                  const availableBundles = DataService.getOfferAvailableCount(offer, inventory);
                  const itemStock = Number(baseItem?.quantityOnHand) || 0;
                  const originalTotal = offer.original_price || ((baseItem?.salePrice || 0) * offer.offer_quantity);
                  const diff = Math.max(0, originalTotal - offer.offer_price);
                  const percent = originalTotal > 0 ? Math.round((diff / originalTotal) * 100) : 0;

                  return (
                    <tr key={offer.id} className="hover:bg-[#FDFCF9] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1A1A1A]">{offer.title_ar}</div>
                        {offer.barcode && (
                          <div className="flex items-center gap-1 text-[11px] text-[#8C8273] font-mono mt-0.5">
                            <Barcode className="w-3.5 h-3.5" />
                            <span>{offer.barcode}</span>
                            <button
                              onClick={() => handleCopyBarcode(offer.barcode!)}
                              title="نسخ الباركود"
                              className="hover:text-emerald-600 transition-colors p-0.5"
                            >
                              {copiedBarcode === offer.barcode ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                        {offer.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{offer.notes}</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>{baseItem?.nameAr || 'صنف غير معرف'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          كود: {baseItem?.sku || '---'} | الرصيد الفعلي: {itemStock} {baseItem?.unit || 'حبة'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {offer.offer_quantity} {baseItem?.unit || 'حبة'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">خصم مباشر من الرصيد</div>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="font-black text-emerald-700 text-sm">
                          {offer.offer_price.toFixed(3)} {currency}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ({(offer.offer_price / offer.offer_quantity).toFixed(3)} للواحدة)
                        </div>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="text-slate-400 line-through text-xs font-semibold">
                          {originalTotal.toFixed(3)} {currency}
                        </div>
                        {diff > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                            <TrendingDown className="w-2.5 h-2.5" />
                            <span>وفر {diff.toFixed(3)} ({percent}%)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-bold px-2.5 py-1 rounded-lg text-xs ${
                            availableBundles > 5
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : availableBundles > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {availableBundles} باقة متاحة
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(offer)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            offer.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {offer.is_active ? 'نشط' : 'معطل'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(offer)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="تعديل العرض"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOffer(offer.id, offer.title_ar)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف العرض"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Offer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 text-right custom-scrollbar">
            <form onSubmit={handleSaveOffer} className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <XCircle className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800">
                    {editingOffer ? 'تعديل العرض الترويجي' : 'إضافة عرض ترويجي جديد (Bundle / Offer)'}
                  </h3>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* 1. Base Item Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الصنف الأساسي (الذي سيُخصم منه المخزون الحقيقي) *
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="ابحث في الأصناف باسم الصنف أو الكود..."
                    value={modalItemSearch}
                    onChange={(e) => setModalItemSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600"
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white custom-scrollbar">
                    {filteredModalItems.map((it) => {
                      const isSelected = it.id === formBaseItemId;
                      return (
                        <div
                          key={it.id}
                          onClick={() => handleSelectBaseItem(it)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50 border-r-4 border-emerald-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{it.nameAr}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({it.sku})</span>
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-black text-emerald-700">
                              {(it.salePrice || 0).toFixed(3)} {currency}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-2">
                              (رصيد: {it.quantityOnHand || 0} {it.unit || 'حبة'})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Selected Item Info Box */}
              {selectedBaseItem && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-800">{selectedBaseItem.nameAr}</div>
                    <div className="text-[11px] text-slate-500">
                      السعر العادي: {(selectedBaseItem.salePrice || 0).toFixed(3)} {currency} | الرصيد الحالي بالمخزن: {selectedBaseItem.quantityOnHand || 0} {selectedBaseItem.unit || 'حبة'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                    صنف أساسي معتمد
                  </span>
                </div>
              )}

              {/* 2. Offer Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان العرض الترويجي (يظهر للعميل في شاشة البيع والإيصال) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عرض 2 حبة شمر حبه 70 جم بسعر خاص"
                  value={formTitleAr}
                  onChange={(e) => setFormTitleAr(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* 3. Offer Quantity & Price Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الكمية المخصومة من الصنف الأساسي لكل عرض (حبات) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={formOfferQuantity}
                    onChange={(e) => setFormOfferQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    مثال: 2 يعني بيع حزمتين وخصم 2 حبة من الرصيد الأصلي.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    سعر بيع العرض الإجمالي ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={formOfferPrice}
                    onChange={(e) => setFormOfferPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-600"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    السعر المخفض الذي يُدفع فعلياً ويدخل كإيراد للمنشأة.
                  </div>
                </div>
              </div>

              {/* Live Savings Calculation Card */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">السعر الأصلي للوحدات دون عرض:</span>
                  <span className="font-bold text-slate-700">{normalPrice.toFixed(3)} {currency}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">سعر العرض الترويجي:</span>
                  <span className="font-black text-emerald-700">{formOfferPrice.toFixed(3)} {currency}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-emerald-200/60 pt-2">
                  <span className="font-bold text-emerald-900">قيمة الوفر للعميل:</span>
                  <span className="font-black text-emerald-800">
                    {savingsAmount.toFixed(3)} {currency} ({savingsPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">سعر الحبة الواحدة داخل العرض:</span>
                  <span className="font-bold text-slate-600">{effectiveUnitPrice.toFixed(3)} {currency}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
                  <span className="font-bold text-slate-700">حزم جاهزة للبيع فورياً بالمخزون:</span>
                  <span className="font-black text-slate-900">{availableOffersCount} باقة</span>
                </div>
              </div>

              {/* 4. Barcode & Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      باركود العرض الترويجي (اختياري)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[10px] font-bold text-emerald-700 hover:underline"
                    >
                      توليد تلقائي
                    </button>
                  </div>
                  <div className="relative">
                    <Barcode className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="OFFER-123456"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة العرض</label>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">العرض نشط ومتاح في نقطة البيع</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات داخلية</label>
                <input
                  type="text"
                  placeholder="مثال: عرض نهاية الشهر / حملة الصيف الترويجية"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{editingOffer ? 'حفظ التعديلات' : 'إنشاء العرض الترويجي'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
