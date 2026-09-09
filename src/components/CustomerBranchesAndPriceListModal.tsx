import React, { useState, useMemo } from 'react';
import {
  Building2,
  Tag,
  Percent,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  Search,
  X,
  Store,
  MapPin,
  Phone,
  User,
  Sparkles,
  Info,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { Customer, CustomerBranch, CustomerPriceListItem, InventoryItem } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';

interface CustomerBranchesAndPriceListModalProps {
  customer: Customer;
  inventory: InventoryItem[];
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCustomer: Customer) => Promise<void>;
}

export const PRESET_PRICE_LISTS = [
  {
    id: 'standard',
    nameAr: 'قائمة الأسعار القياسية',
    nameEn: 'Standard Price List',
    desc: 'السعر الأساسي المعتمد في دليل الأصناف دون خصومات مسبقة.',
    defaultDiscount: 0,
  },
  {
    id: 'coop',
    nameAr: 'قائمة أسعار الجمعيات التعاونية',
    nameEn: 'Co-op Societies Price List',
    desc: 'تسعيرة مخفضة خاصة بالتعاقدات الرسمية للجمعيات التعاونية والأسواق المركزية.',
    defaultDiscount: 5,
  },
  {
    id: 'wholesale',
    nameAr: 'قائمة أسعار الجملة والموزعين',
    nameEn: 'Wholesale & Distributors Price List',
    desc: 'تسعيرة مخصصة لكبار التجار والمطاحن والموزعين المعتمدين.',
    defaultDiscount: 10,
  },
  {
    id: 'retail',
    nameAr: 'قائمة أسعار التجزئة والمنافذ',
    nameEn: 'Retail & Outlets Price List',
    desc: 'تسعيرة البيع المباشر للمعارض ومنافذ البيع بالتجزئة.',
    defaultDiscount: 0,
  },
  {
    id: 'custom',
    nameAr: 'قائمة تسعير خاصة واستثنائية',
    nameEn: 'Custom Negotiated Price List',
    desc: 'أسعار مخصصة ومحددة بدقة لكل صنف وفق اتفاقيات تعاقدية خاصة بالعميل.',
    defaultDiscount: 0,
  },
];

export const CustomerBranchesAndPriceListModal: React.FC<CustomerBranchesAndPriceListModalProps> = ({
  customer,
  inventory,
  currency,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'branches' | 'pricing'>('branches');

  // Local state copy of branches & pricing
  const [branches, setBranches] = useState<CustomerBranch[]>(
    customer.branches ? JSON.parse(JSON.stringify(customer.branches)) : []
  );
  const [priceListId, setPriceListId] = useState<string>(customer.priceListId || 'standard');
  const [priceListName, setPriceListName] = useState<string>(
    customer.priceListName ||
      PRESET_PRICE_LISTS.find((p) => p.id === (customer.priceListId || 'standard'))?.nameAr ||
      'قائمة الأسعار القياسية'
  );
  const [defaultDiscountRate, setDefaultDiscountRate] = useState<number>(
    customer.defaultDiscountRate !== undefined ? customer.defaultDiscountRate : 0
  );
  const [customPrices, setCustomPrices] = useState<CustomerPriceListItem[]>(
    customer.customPrices ? JSON.parse(JSON.stringify(customer.customPrices)) : []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Branch Sub-Form State
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchCode, setBranchCode] = useState('');
  const [branchNameAr, setBranchNameAr] = useState('');
  const [branchNameEn, setBranchNameEn] = useState('');
  const [branchContact, setBranchContact] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchIsDefault, setBranchIsDefault] = useState(false);
  const [branchNotes, setBranchNotes] = useState('');

  // Item Price Sub-Form State
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [customPriceInput, setCustomPriceInput] = useState<number | ''>('');
  const [discountPercentInput, setDiscountPercentInput] = useState<number | ''>('');
  const [customItemNotes, setCustomItemNotes] = useState('');

  // Editing existing custom price line
  const [editingCustomItemIndex, setEditingCustomItemIndex] = useState<number | null>(null);

  // Filtered inventory for pricing dropdown
  const filteredInventory = useMemo(() => {
    if (!itemSearchQuery.trim()) return inventory.slice(0, 30);
    const q = itemSearchQuery.toLowerCase().trim();
    return inventory.filter(
      (item) =>
        item.nameAr.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.includes(q))
    );
  }, [inventory, itemSearchQuery]);

  const selectedInventoryItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId);
  }, [inventory, selectedItemId]);

  // When selecting an item, calculate default custom price based on general discount
  const handleSelectItemForCustomPrice = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    const basePrice = Number(item.salePrice) || 0;
    if (defaultDiscountRate > 0) {
      const discounted = Math.max(0, basePrice * (1 - defaultDiscountRate / 100));
      setCustomPriceInput(Number(discounted.toFixed(3)));
      setDiscountPercentInput(defaultDiscountRate);
    } else {
      setCustomPriceInput(basePrice);
      setDiscountPercentInput(0);
    }
  };

  const handleCustomPriceChange = (val: number | '') => {
    setCustomPriceInput(val);
    if (val !== '' && selectedInventoryItem && selectedInventoryItem.salePrice > 0) {
      const base = Number(selectedInventoryItem.salePrice);
      const diff = base - Number(val);
      const pct = (diff / base) * 100;
      setDiscountPercentInput(Number(pct.toFixed(2)));
    }
  };

  const handleDiscountPercentChange = (pctVal: number | '') => {
    setDiscountPercentInput(pctVal);
    if (pctVal !== '' && selectedInventoryItem) {
      const base = Number(selectedInventoryItem.salePrice) || 0;
      const calcPrice = base * (1 - Number(pctVal) / 100);
      setCustomPriceInput(Number(Math.max(0, calcPrice).toFixed(3)));
    }
  };

  const handleAddOrUpdateCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || customPriceInput === '') return;

    const newEntry: CustomerPriceListItem = {
      itemId: selectedItemId,
      customPrice: Number(customPriceInput),
      discountPercentage: discountPercentInput !== '' ? Number(discountPercentInput) : undefined,
      notes: customItemNotes.trim() || undefined,
    };

    if (editingCustomItemIndex !== null) {
      const updated = [...customPrices];
      updated[editingCustomItemIndex] = newEntry;
      setCustomPrices(updated);
      setEditingCustomItemIndex(null);
    } else {
      // If already exists, replace; else append
      const existingIdx = customPrices.findIndex((p) => p.itemId === selectedItemId);
      if (existingIdx !== -1) {
        const updated = [...customPrices];
        updated[existingIdx] = newEntry;
        setCustomPrices(updated);
      } else {
        setCustomPrices([...customPrices, newEntry]);
      }
    }

    // Reset inputs
    setSelectedItemId('');
    setCustomPriceInput('');
    setDiscountPercentInput('');
    setCustomItemNotes('');
    setItemSearchQuery('');
  };

  const handleDeleteCustomPrice = (itemId: string) => {
    setCustomPrices(customPrices.filter((p) => p.itemId !== itemId));
  };

  const handleStartEditCustomPrice = (entry: CustomerPriceListItem, index: number) => {
    setEditingCustomItemIndex(index);
    setSelectedItemId(entry.itemId);
    setCustomPriceInput(entry.customPrice);
    setDiscountPercentInput(entry.discountPercentage !== undefined ? entry.discountPercentage : '');
    setCustomItemNotes(entry.notes || '');
  };

  // Branch handlers
  const handleOpenAddBranch = () => {
    setEditingBranchId(null);
    setBranchCode(`BR-${String(branches.length + 1).padStart(2, '0')}`);
    setBranchNameAr('');
    setBranchNameEn('');
    setBranchContact('');
    setBranchPhone(customer.phone || '');
    setBranchAddress(customer.address || '');
    setBranchCity(customer.city || 'الكويت');
    setBranchIsDefault(branches.length === 0);
    setBranchNotes('');
    setIsAddingBranch(true);
  };

  const handleStartEditBranch = (branch: CustomerBranch) => {
    setEditingBranchId(branch.id);
    setBranchCode(branch.code || '');
    setBranchNameAr(branch.nameAr);
    setBranchNameEn(branch.nameEn || '');
    setBranchContact(branch.contactPerson || '');
    setBranchPhone(branch.phone || '');
    setBranchAddress(branch.address || '');
    setBranchCity(branch.city || 'الكويت');
    setBranchIsDefault(Boolean(branch.isDefault));
    setBranchNotes(branch.notes || '');
    setIsAddingBranch(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchNameAr.trim()) return;

    let updatedBranches = [...branches];

    if (branchIsDefault) {
      updatedBranches = updatedBranches.map((b) => ({ ...b, isDefault: false }));
    }

    const branchPayload: CustomerBranch = {
      id: editingBranchId || `br-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: branchCode.trim() || `BR-${String(branches.length + 1).padStart(2, '0')}`,
      nameAr: branchNameAr.trim(),
      nameEn: branchNameEn.trim() || undefined,
      contactPerson: branchContact.trim() || undefined,
      phone: branchPhone.trim() || undefined,
      address: branchAddress.trim() || undefined,
      city: branchCity.trim() || undefined,
      isDefault: branchIsDefault || branches.length === 0,
      notes: branchNotes.trim() || undefined,
    };

    if (editingBranchId) {
      updatedBranches = updatedBranches.map((b) => (b.id === editingBranchId ? branchPayload : b));
    } else {
      updatedBranches.push(branchPayload);
    }

    setBranches(updatedBranches);
    setIsAddingBranch(false);
    setEditingBranchId(null);
  };

  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف فرع "${branchName}"؟`)) return;
    const remaining = branches.filter((b) => b.id !== branchId);
    if (remaining.length > 0 && !remaining.some((b) => b.isDefault)) {
      remaining[0].isDefault = true;
    }
    setBranches(remaining);
  };

  const handleSetDefaultBranch = (branchId: string) => {
    setBranches(
      branches.map((b) => ({
        ...b,
        isDefault: b.id === branchId,
      }))
    );
  };

  // Master Save Handler
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const updatedCustomer: Customer = {
        ...customer,
        branches,
        priceListId,
        priceListName,
        defaultDiscountRate,
        customPrices,
      };

      await onSave(updatedCustomer);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ التعديلات: ' + (err.message || 'فشل الاتصال'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 dir-rtl text-right">
      <div className="bg-white dark:bg-neutral-900 border border-[#E5E1DA] dark:border-neutral-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-[#FAF9F6] dark:bg-neutral-800/80 border-b border-[#E5E1DA] dark:border-neutral-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                  إدارة فروع وقائمة أسعار: {customer.nameAr}
                </h3>
                {customer.code && (
                  <span className="font-mono text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded-md font-bold">
                    {customer.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                تحديد منافذ واستلام الجمعية أو العميل، وتعيين قائمة الأسعار المعتمدة والتسعيرات الخاصة بالأصناف
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex border-b border-[#E5E1DA] dark:border-neutral-700 bg-white dark:bg-neutral-900 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'branches'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>فروع العميل ومواقع التسليم</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-mono font-bold">
              {branches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'pricing'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>قائمة الأسعار والتسعيرة الخاصة</span>
            <span className="text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-mono font-bold">
              {customPrices.length} صنف مسعر
            </span>
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs bg-[#FAF9F6]/50 dark:bg-neutral-900/50">
          {/* TAB 1: BRANCHES */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-800 p-4 rounded-xl border border-[#E5E1DA] dark:border-neutral-700 shadow-2xs">
                <div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-600" />
                    دليل أفرع ومنافذ استلام العميل (Customer Branches & Delivery Hubs)
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    تظهر هذه الأفرع تلقائياً عند إنشاء فواتير المبيعات وأوامر التوصيل لاختيار فرع التسليم المقصود.
                  </p>
                </div>
                {!isAddingBranch && (
                  <button
                    type="button"
                    onClick={handleOpenAddBranch}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة فرع جديد</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Branch Form Sub-panel */}
              {isAddingBranch && (
                <form
                  onSubmit={handleSaveBranch}
                  className="bg-blue-50/70 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2">
                    <span className="font-extrabold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-blue-600" />
                      {editingBranchId ? 'تعديل بيانات الفرع' : 'إضافة فرع / موقع تسليم جديد'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingBranch(false)}
                      className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        كود الفرع *
                      </label>
                      <input
                        type="text"
                        required
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                        placeholder="مثال: BR-01 أو 101"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 font-mono font-bold text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        اسم الفرع بالعربية *
                      </label>
                      <input
                        type="text"
                        required
                        value={branchNameAr}
                        onChange={(e) => setBranchNameAr(e.target.value)}
                        placeholder="مثال: السوق المركزي الرئيسي - قطعة 2"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 font-bold text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        مسؤول الاستلام / التواصل
                      </label>
                      <input
                        type="text"
                        value={branchContact}
                        onChange={(e) => setBranchContact(e.target.value)}
                        placeholder="مثال: أحمد عبد الله (أمين المستودع)"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        هاتف الفرع
                      </label>
                      <input
                        type="text"
                        value={branchPhone}
                        onChange={(e) => setBranchPhone(e.target.value)}
                        placeholder="+965 2467 9001"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 font-mono text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        المدينة / المنطقة
                      </label>
                      <input
                        type="text"
                        value={branchCity}
                        onChange={(e) => setBranchCity(e.target.value)}
                        placeholder="مثال: القيروان ق 2"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                        العنوان التفصيلي وموقع التسليم
                      </label>
                      <input
                        type="text"
                        value={branchAddress}
                        onChange={(e) => setBranchAddress(e.target.value)}
                        placeholder="مثال: شارع 105، مجمع الأسواق بجانب المخفر"
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-200 dark:border-neutral-700 rounded-lg p-2 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <label className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={branchIsDefault}
                          onChange={(e) => setBranchIsDefault(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>تعيين كـ "الفرع الرئيسي الافتراضي"</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingBranch(false)}
                      className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg font-bold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingBranchId ? 'تحديث الفرع' : 'إضافة الفرع'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Branches List Table */}
              {branches.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-neutral-800 border border-dashed border-[#E5E1DA] dark:border-neutral-700 rounded-2xl p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto">
                    <Store className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
                    لا توجد أفرع مضافة لهذا العميل حتى الآن
                  </h5>
                  <p className="text-neutral-500 text-xs max-w-md mx-auto">
                    يمكنك إضافة الفروع المتعددة للعميل (مثل فروع الجمعيات التعاونية أو مستودعات التوزيع) لتحديد فرع التسليم بدقة في الفواتير.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddBranch}
                    className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة الفرع الأول الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {branches.map((branch) => (
                    <div
                      key={branch.id}
                      className={`p-4 rounded-xl border transition-all relative ${
                        branch.isDefault
                          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-neutral-800 border-[#E5E1DA] dark:border-neutral-700 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                              {branch.nameAr}
                            </span>
                            <span className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded font-bold">
                              {branch.code}
                            </span>
                            {branch.isDefault && (
                              <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded-full flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" />
                                الفرع الافتراضي
                              </span>
                            )}
                          </div>
                          {branch.nameEn && (
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              {branch.nameEn}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditBranch(branch)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                            title="تعديل الفرع"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBranch(branch.id, branch.nameAr)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                            title="حذف الفرع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#F0ECE1] dark:border-neutral-700/60 space-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        {branch.contactPerson && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>المسؤول: {branch.contactPerson}</span>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="font-mono">{branch.phone}</span>
                          </div>
                        )}
                        {(branch.address || branch.city) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>
                              {branch.city ? `${branch.city} - ` : ''}
                              {branch.address || ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {!branch.isDefault && (
                        <div className="mt-3 pt-2 border-t border-dashed border-[#F0ECE1] dark:border-neutral-700 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSetDefaultBranch(branch.id)}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            تعيين كفرع افتراضي
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRICE LIST & CUSTOM PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              {/* 1. Price List Policy Selector */}
              <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-[#E5E1DA] dark:border-neutral-700 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1DA] dark:border-neutral-700 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-amber-600" />
                      قائمة الأسعار المعتمدة للعميل (Approved Customer Price List)
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      اختر السياسة السعرية المطبقة افتراضياً على هذا العميل عند تحرير فواتير المبيعات.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg self-start sm:self-auto">
                    تطبيق فوري وتلقائي
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PRESET_PRICE_LISTS.map((preset) => {
                    const isSelected = priceListId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setPriceListId(preset.id);
                          setPriceListName(preset.nameAr);
                          if (preset.defaultDiscount > 0 && defaultDiscountRate === 0) {
                            setDefaultDiscountRate(preset.defaultDiscount);
                          }
                        }}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-600 ring-2 ring-amber-500/30 text-amber-950 dark:text-amber-100 shadow-xs'
                            : 'bg-white dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 hover:border-amber-300 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-xs flex items-center justify-between">
                            <span>{preset.nameAr}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-400 mt-0.5">{preset.nameEn}</div>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                            {preset.desc}
                          </p>
                        </div>

                        {preset.defaultDiscount > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-amber-200 dark:border-neutral-700 flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            <span>خصم قياسي مقترح:</span>
                            <span>{preset.defaultDiscount}%</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* General Discount Rate for Customer */}
                <div className="pt-3 border-t border-[#E5E1DA] dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="font-bold text-xs text-neutral-900 dark:text-neutral-100 block mb-1">
                      نسبة الخصم العام المعتمدة للعميل (%):
                    </label>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      تطبق هذه النسبة تلقائياً على كافة أصناف الفاتورة التي ليس لها سعر استثنائي مخصص أدناه.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="relative w-40">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={defaultDiscountRate}
                        onChange={(e) => setDefaultDiscountRate(Number(e.target.value) || 0)}
                        className="w-full bg-[#FAF9F6] dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2 px-3 pl-8 font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100 text-left"
                      />
                      <Percent className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Custom Item Prices Table */}
              <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-[#E5E1DA] dark:border-neutral-700 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1DA] dark:border-neutral-700 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      جدول تسعير الأصناف الخاصة المتفق عليها (Custom Agreed Item Prices)
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      تحديد سعر بيع مخصص لصنف معين للعميل يلغي السعر القياسي ويتم إدراجه تلقائياً بالفاتورة.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 px-2.5 py-1 rounded-lg">
                    الأصناف المخصصة: {customPrices.length}
                  </span>
                </div>

                {/* Add / Edit Special Price Bar */}
                <form
                  onSubmit={handleAddOrUpdateCustomPrice}
                  className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3"
                >
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                    <span>
                      {editingCustomItemIndex !== null ? 'تعديل السعر المخصص للصنف' : 'إضافة صنف للتسعيرة الخاصة:'}
                    </span>
                    {editingCustomItemIndex !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomItemIndex(null);
                          setSelectedItemId('');
                          setCustomPriceInput('');
                          setDiscountPercentInput('');
                          setCustomItemNotes('');
                        }}
                        className="text-[10px] text-neutral-500 hover:text-neutral-800"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Item Selector / Search */}
                    <div className="sm:col-span-5 relative">
                      <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                        اختر الصنف من المخزون *
                      </label>
                      <div className="space-y-1">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="ابحث باسم الصنف أو الباركود..."
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 pr-7 text-xs text-neutral-900 dark:text-neutral-100"
                          />
                          <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-2.5" />
                        </div>
                        <select
                          required
                          value={selectedItemId}
                          onChange={(e) => {
                            const found = inventory.find((i) => i.id === e.target.value);
                            if (found) handleSelectItemForCustomPrice(found);
                            else setSelectedItemId(e.target.value);
                          }}
                          className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 text-xs font-bold text-neutral-900 dark:text-neutral-100"
                        >
                          <option value="">-- اختر الصنف من القائمة --</option>
                          {filteredInventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nameAr} ({formatCurrency(item.salePrice, currency)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Base Price Display */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mb-1">
                        السعر القياسي
                      </label>
                      <div className="p-2 bg-neutral-100 dark:bg-neutral-700/60 rounded-lg font-mono font-bold text-neutral-800 dark:text-neutral-200 text-xs h-9 flex items-center">
                        {selectedInventoryItem
                          ? formatCurrency(selectedInventoryItem.salePrice, currency)
                          : '-'}
                      </div>
                    </div>

                    {/* Custom Price Input */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                        السعر المتفق عليه للعميل *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        value={customPriceInput}
                        onChange={(e) =>
                          handleCustomPriceChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="0.000"
                        className="w-full bg-white dark:bg-neutral-800 border border-emerald-400 dark:border-emerald-600 rounded-lg p-2 font-mono font-bold text-emerald-800 dark:text-emerald-300 text-xs"
                      />
                    </div>

                    {/* Discount % Auto-calc */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                        نسبة الخصم %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={discountPercentInput}
                        onChange={(e) =>
                          handleDiscountPercentChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="%"
                        className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 font-mono text-neutral-900 dark:text-neutral-100 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-9">
                      <input
                        type="text"
                        value={customItemNotes}
                        onChange={(e) => setCustomItemNotes(e.target.value)}
                        placeholder="ملاحظات الاتفاق السعري (مثال: خصم كميات توريد شهري / عقد مناقصة)"
                        className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 text-xs text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{editingCustomItemIndex !== null ? 'تحديث السعر' : 'إدراج بالتسعيرة'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Table of Custom Prices */}
                {customPrices.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#E5E1DA] dark:border-neutral-700 rounded-xl p-4 text-neutral-500 dark:text-neutral-400">
                    <Info className="w-5 h-5 mx-auto mb-1 text-neutral-400" />
                    لا توجد أصناف مسعرة بأسعار خاصة بعد. سيتم بيع الأصناف للعميل بالسعر القياسي (مع تطبيق الخصم العام {defaultDiscountRate}% إن وجد).
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#E5E1DA] dark:border-neutral-700 rounded-xl">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold border-b border-[#E5E1DA] dark:border-neutral-700">
                          <th className="p-2.5">الصنف</th>
                          <th className="p-2.5 text-center">الوحدة</th>
                          <th className="p-2.5 text-left font-mono">السعر القياسي</th>
                          <th className="p-2.5 text-left font-mono text-emerald-700 dark:text-emerald-400">
                            السعر المتفق عليه
                          </th>
                          <th className="p-2.5 text-center">نسبة الوفر / الخصم</th>
                          <th className="p-2.5">ملاحظات</th>
                          <th className="p-2.5 text-center w-20">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1DA] dark:divide-neutral-700 bg-white dark:bg-neutral-900">
                        {customPrices.map((cp, idx) => {
                          const item = inventory.find((i) => i.id === cp.itemId);
                          const basePrice = item ? Number(item.salePrice) : cp.customPrice;
                          const diff = basePrice - cp.customPrice;
                          const discountPct =
                            cp.discountPercentage !== undefined
                              ? cp.discountPercentage
                              : basePrice > 0
                              ? ((diff / basePrice) * 100).toFixed(1)
                              : 0;

                          return (
                            <tr
                              key={cp.itemId}
                              className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                            >
                              <td className="p-2.5">
                                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                                  {item ? item.nameAr : cp.itemId}
                                </div>
                                {item?.sku && (
                                  <div className="text-[10px] text-neutral-400 font-mono">
                                    SKU: {item.sku}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center text-neutral-600 dark:text-neutral-400">
                                {item?.unit || 'حبة'}
                              </td>
                              <td className="p-2.5 text-left font-mono text-neutral-500 line-through">
                                {formatCurrency(basePrice, currency)}
                              </td>
                              <td className="p-2.5 text-left font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                                {formatCurrency(cp.customPrice, currency)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    Number(discountPct) > 0
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : Number(discountPct) < 0
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  {Number(discountPct) > 0
                                    ? `خصم ${discountPct}%`
                                    : Number(discountPct) < 0
                                    ? `زيادة ${Math.abs(Number(discountPct))}%`
                                    : 'مطابق'}
                                </span>
                              </td>
                              <td className="p-2.5 text-[11px] text-neutral-500">
                                {cp.notes || '-'}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCustomPrice(cp, idx)}
                                    className="p-1 text-neutral-500 hover:text-blue-600 rounded"
                                    title="تعديل السعر"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomPrice(cp.itemId)}
                                    className="p-1 text-neutral-400 hover:text-red-600 rounded"
                                    title="إزالة السعر المخصص"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-[#FAF9F6] dark:bg-neutral-800 border-t border-[#E5E1DA] dark:border-neutral-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {branches.length} فرع محدد • قائمة: {priceListName} (
              {customPrices.length} صنف مسعر)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`px-6 py-2 rounded-xl font-extrabold text-white text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600'
                  : 'bg-[#1A1A1A] hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>تم حفظ البيانات بنجاح!</span>
                </>
              ) : isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Save className="w-4 h-4 text-amber-400" />
                  <span>حفظ الأفرع وقائمة الأسعار</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
