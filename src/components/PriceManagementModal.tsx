import React, { useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  TrendingUp,
  Percent,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Search,
  Layers,
  Sparkles,
  ArrowUpRight,
  Filter,
  Save,
  RotateCcw
} from 'lucide-react';
import { InventoryItem } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';

interface PriceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  currency: string;
  onSuccess: () => void;
}

export const PriceManagementModal: React.FC<PriceManagementModalProps> = ({
  isOpen,
  onClose,
  inventory,
  currency,
  onSuccess,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [localPrices, setLocalPrices] = useState<Record<string, { purchase: number; sale: number }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Batch Update Tool State
  const [showBatchTool, setShowBatchTool] = useState(false);
  const [batchMode, setBatchMode] = useState<'MARKUP_PERCENT' | 'MARGIN_TARGET' | 'FIXED_ADD' | 'DIRECT_SET'>('MARKUP_PERCENT');
  const [batchTarget, setBatchTarget] = useState<'SALE' | 'PURCHASE' | 'BOTH'>('SALE');
  const [batchValue, setBatchValue] = useState<number>(20); // 20%
  const [batchRoundTo, setBatchRoundTo] = useState<number>(0);

  // Initialize local prices on open
  React.useEffect(() => {
    if (isOpen && inventory) {
      const initial: Record<string, { purchase: number; sale: number }> = {};
      inventory.forEach((item) => {
        initial[item.id] = {
          purchase: item.purchasePrice || 0,
          sale: item.salePrice || 0,
        };
      });
      setLocalPrices(initial);
      setSelectedItemIds([]);
    }
  }, [isOpen, inventory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [inventory]);

  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.nameAr.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (item.barcode && item.barcode.includes(search));
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [inventory, search, selectedCategory]);

  if (!isOpen) return null;

  const handlePriceChange = (id: string, field: 'purchase' | 'sale', val: number) => {
    setLocalPrices((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: Math.max(0, val),
      },
    }));
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApplyBatchPricing = async () => {
    setIsSaving(true);
    try {
      const payload = {
        itemIds: selectedItemIds.length > 0 ? selectedItemIds : undefined,
        category: selectedItemIds.length === 0 ? selectedCategory : undefined,
        mode: batchMode,
        targetField: batchTarget,
        value: Number(batchValue),
        roundTo: Number(batchRoundTo) || 0,
      };

      const res = await fetch('/api/inventory/batch-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل تطبيق التسعير الجماعي');
      }

      const result = await res.json();
      alert(`✅ ${result.message || 'تم تحديث الأسعار بنجاح'}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`❌ حدث خطأ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllModified = async () => {
    setIsSaving(true);
    try {
      const entries = Object.entries(localPrices) as [string, { purchase: number; sale: number }][];
      const promises = entries.map(([id, prices]) => {
        const original = inventory.find((i) => i.id === id);
        if (
          original &&
          (original.purchasePrice !== prices.purchase || original.salePrice !== prices.sale)
        ) {
          return fetch(`/api/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              purchasePrice: prices.purchase,
              salePrice: prices.sale,
            }),
          });
        }
        return Promise.resolve(null);
      });

      await Promise.all(promises);
      alert('✅ تم حفظ كافة تعديلات الأسعار بنجاح');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`❌ خطأ أثناء الحفظ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Summary Metrics
  const avgMargin = useMemo(() => {
    let totalSale = 0;
    let totalCost = 0;
    filteredItems.forEach((item) => {
      const p = localPrices[item.id] || { purchase: item.purchasePrice, sale: item.salePrice };
      totalSale += p.sale;
      totalCost += p.purchase;
    });
    if (totalSale === 0) return 0;
    return ((totalSale - totalCost) / totalSale) * 100;
  }, [filteredItems, localPrices]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-right animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                إدارة ومراجعة أسعار البيع والتكلفة وهامش الربح
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                مصفوفة التسعير الشاملة للأصناف مع حاسبة الهامش والتسعير الجماعي الآلي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar & KPI Stats */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* KPI 1 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">إجمالي الأصناف المعروضة:</span>
              <span className="font-mono font-extrabold text-base text-slate-900">
                {filteredItems.length} صنف
              </span>
            </div>
            {/* KPI 2 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">متوسط هامش الربح الإجمالي:</span>
              <span className="font-mono font-extrabold text-base text-emerald-600">
                {avgMargin.toFixed(1)}%
              </span>
            </div>
            {/* KPI 3 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">الأصناف المحددة للتعديل:</span>
              <span className="font-mono font-extrabold text-base text-blue-700">
                {selectedItemIds.length > 0 ? `${selectedItemIds.length} صنف` : 'كامل القائمة'}
              </span>
            </div>
            {/* Toggle Batch Tool Button */}
            <button
              onClick={() => setShowBatchTool(!showBatchTool)}
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs ${
                showBatchTool
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>{showBatchTool ? 'إخفاء أداة التسعير الجماعي' : 'فتح أداة التسعير الجماعي'}</span>
            </button>
          </div>

          {/* Collapsible Batch Tool Panel */}
          {showBatchTool && (
            <div className="bg-blue-900 text-white p-4 rounded-xl space-y-4 animate-in fade-in duration-200 border border-blue-700">
              <div className="flex items-center justify-between border-b border-blue-800 pb-2">
                <div className="font-bold text-xs flex items-center gap-2 text-cyan-300">
                  <Sparkles className="w-4 h-4" />
                  <span>معالج التسعير الجماعي الآلي (Batch Price Updater)</span>
                </div>
                <span className="text-[11px] text-blue-200">
                  يطبق على: {selectedItemIds.length > 0 ? `(${selectedItemIds.length}) صنف محدد` : `تصنيف (${selectedCategory === 'ALL' ? 'كل الأصناف' : selectedCategory})`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Method */}
                <div>
                  <label className="block text-blue-200 font-semibold mb-1">طريقة احتساب السعر:</label>
                  <select
                    value={batchMode}
                    onChange={(e) => setBatchMode(e.target.value as any)}
                    className="w-full bg-slate-900 border border-blue-600 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="MARKUP_PERCENT">نسبة زيادة مئوية على التكلفة (Cost Markup %)</option>
                    <option value="MARGIN_TARGET">نسبة هامش ربح مستهدفة (Target Margin %)</option>
                    <option value="FIXED_ADD">إضافة مبلغ نقدي ثابت (Fixed Add)</option>
                    <option value="DIRECT_SET">تحديد سعر محدد للكل (Direct Set)</option>
                  </select>
                </div>

                {/* Target Field */}
                <div>
                  <label className="block text-blue-200 font-semibold mb-1">الحقل المستهدف بالتعديل:</label>
                  <select
                    value={batchTarget}
                    onChange={(e) => setBatchTarget(e.target.value as any)}
                    className="w-full bg-slate-900 border border-blue-600 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="SALE">سعر البيع فقط (Selling Price)</option>
                    <option value="PURCHASE">سعر التكلفة فقط (Cost Price)</option>
                    <option value="BOTH">سعر البيع وسعر التكلفة معاً</option>
                  </select>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-blue-200 font-semibold mb-1">
                    {batchMode === 'MARKUP_PERCENT' || batchMode === 'MARGIN_TARGET'
                      ? 'النسبة المئوية (%) :'
                      : `القيمة النقدية (${currency}) :`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={batchValue}
                    onChange={(e) => setBatchValue(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-blue-600 rounded-lg p-2 text-cyan-300 font-bold font-mono text-left"
                  />
                </div>

                {/* Rounding Rule */}
                <div>
                  <label className="block text-blue-200 font-semibold mb-1">تقريب الكسور النقدية:</label>
                  <select
                    value={batchRoundTo}
                    onChange={(e) => setBatchRoundTo(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-blue-600 rounded-lg p-2 text-white font-bold"
                  >
                    <option value={0}>بدون تقريب (دقيق)</option>
                    <option value={0.05}>لأقرب 0.050 (نصف درهم/فلس)</option>
                    <option value={0.1}>لأقرب 0.100 (100 فلس)</option>
                    <option value={0.5}>لأقرب 0.500 (نصف دينار/ريال)</option>
                    <option value={1.0}>لأقرب 1.000 (دينار/ريال كامل)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleApplyBatchPricing}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تطبيق التسعير الجماعي وحفظ التغييرات</span>
                </button>
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم الصنف، الباركود، أو الرمز SKU..."
                className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">جميع التصنيفات ({inventory.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Price Matrix Table */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.length > 0 && selectedItemIds.length === filteredItems.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">رمز SKU</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3 text-left">سعر التكلفة ({currency})</th>
                  <th className="p-3 text-left">سعر البيع ({currency})</th>
                  <th className="p-3 text-left">مبلغ هامش الربح</th>
                  <th className="p-3 text-left">نسبة الهامش (%)</th>
                  <th className="p-3 text-left">نسبة الزيادة Markup (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const prices = localPrices[item.id] || {
                    purchase: item.purchasePrice || 0,
                    sale: item.salePrice || 0,
                  };
                  const marginVal = prices.sale - prices.purchase;
                  const marginPercent = prices.sale > 0 ? (marginVal / prices.sale) * 100 : 0;
                  const markupPercent = prices.purchase > 0 ? (marginVal / prices.purchase) * 100 : 0;
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono text-slate-700 font-bold">{item.sku}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {item.nameAr}
                        {item.unit && <span className="text-slate-400 font-normal text-[11px] mr-1">({item.unit})</span>}
                      </td>
                      <td className="p-3 text-slate-600">{item.category || 'عام'}</td>
                      {/* Cost Input */}
                      <td className="p-3 text-left">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={prices.purchase}
                          onChange={(e) => handlePriceChange(item.id, 'purchase', Number(e.target.value))}
                          className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-left font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      {/* Sale Input */}
                      <td className="p-3 text-left">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={prices.sale}
                          onChange={(e) => handlePriceChange(item.id, 'sale', Number(e.target.value))}
                          className="w-24 bg-white border border-emerald-300 rounded px-2 py-1 text-left font-mono font-extrabold text-emerald-700 focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      {/* Margin Amount */}
                      <td className="p-3 text-left font-mono font-bold">
                        <span className={marginVal >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {formatCurrency(marginVal, currency)}
                        </span>
                      </td>
                      {/* Margin % */}
                      <td className="p-3 text-left font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            marginPercent >= 20
                              ? 'bg-emerald-100 text-emerald-800'
                              : marginPercent >= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {marginPercent.toFixed(1)}%
                        </span>
                      </td>
                      {/* Markup % */}
                      <td className="p-3 text-left font-mono text-slate-600">
                        +{markupPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAllModified}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات المدخلة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
