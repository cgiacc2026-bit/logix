import React, { useState } from 'react';
import { ProductionOrder, InventoryItem, CompanyProfile, JournalEntry } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  ArrowRight,
  TrendingUp,
  Cpu,
  FileSpreadsheet,
  AlertCircle,
  X,
  Factory
} from 'lucide-react';

interface Props {
  productionOrders: ProductionOrder[];
  inventory: InventoryItem[];
  company: CompanyProfile;
  currency: string;
  onCreateProductionOrder: (orderData: Partial<ProductionOrder>) => Promise<void>;
}

export const ProductionOrdersView: React.FC<Props> = ({
  productionOrders,
  inventory,
  company,
  currency,
  onCreateProductionOrder,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<ProductionOrder | null>(null);

  // Form State
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetItemId, setTargetItemId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(100);
  const [targetUnit, setTargetUnit] = useState('حبة');
  const [millLine, setMillLine] = useState('خط طحن وتعبئة البهارات رقم 1');
  const [operatorName, setOperatorName] = useState(company.generalManager || 'مودي جميل');
  const [overheadCost, setOverheadCost] = useState(5.0);
  const [notes, setNotes] = useState('');

  // Raw Materials selection list
  const [rawMaterials, setRawMaterials] = useState<
    { itemId: string; quantityRequired: number; unitCost: number }[]
  >([{ itemId: '', quantityRequired: 100, unitCost: 0 }]);

  const handleOpenAddModal = () => {
    setOrderDate(new Date().toISOString().split('T')[0]);
    setTargetItemId(inventory[0]?.id || '');
    setTargetQuantity(100);
    setTargetUnit(inventory[0]?.unit || 'حبة');
    setRawMaterials([
      {
        itemId: inventory[1]?.id || inventory[0]?.id || '',
        quantityRequired: 100,
        unitCost: Number(inventory[1]?.purchasePrice || inventory[0]?.purchasePrice) || 0.2,
      },
    ]);
    setOverheadCost(5.0);
    setNotes('أمر تشغيل وطحن وتعبئة آلي');
    setIsModalOpen(true);
  };

  const handleTargetItemChange = (itemId: string) => {
    setTargetItemId(itemId);
    const item = inventory.find((i) => i.id === itemId);
    if (item) {
      setTargetUnit(item.unit || 'حبة');
    }
  };

  const handleRawItemChange = (index: number, itemId: string) => {
    const updated = [...rawMaterials];
    const item = inventory.find((i) => i.id === itemId);
    updated[index].itemId = itemId;
    if (item) {
      updated[index].unitCost = Number(item.purchasePrice) || 0;
    }
    setRawMaterials(updated);
  };

  const handleAddRawMaterialRow = () => {
    setRawMaterials([...rawMaterials, { itemId: '', quantityRequired: 10, unitCost: 0 }]);
  };

  const handleRemoveRawMaterialRow = (index: number) => {
    setRawMaterials(rawMaterials.filter((_, i) => i !== index));
  };

  // Calculations
  const rawMaterialsTotalCost = rawMaterials.reduce((sum, r) => {
    return sum + (Number(r.quantityRequired) || 0) * (Number(r.unitCost) || 0);
  }, 0);

  const totalProductionCost = rawMaterialsTotalCost + (Number(overheadCost) || 0);
  const unitProductionCost = targetQuantity > 0 ? totalProductionCost / targetQuantity : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = inventory.find((i) => i.id === targetItemId);
    if (!targetItem) {
      alert('الرجاء اختيار الصنف المراد تصنيعه وطحنه');
      return;
    }

    const formattedRaw = rawMaterials
      .filter((r) => r.itemId && r.quantityRequired > 0)
      .map((r) => {
        const item = inventory.find((i) => i.id === r.itemId);
        return {
          itemId: r.itemId,
          itemSku: item?.sku || '',
          itemNameAr: item?.nameAr || '',
          unit: item?.unit || 'حبة',
          quantityRequired: Number(r.quantityRequired),
          unitCost: Number(r.unitCost),
          totalCost: Number(r.quantityRequired) * Number(r.unitCost),
        };
      });

    if (formattedRaw.length === 0) {
      alert('الرجاء تحديد مادة خام واحدة على الأقل للاستهلاك في التشغيل');
      return;
    }

    try {
      await onCreateProductionOrder({
        date: orderDate || new Date().toISOString().split('T')[0],
        targetItemId: targetItem.id,
        targetItemNameAr: targetItem.nameAr,
        targetSku: targetItem.sku,
        targetQuantity: Number(targetQuantity),
        targetUnit: targetUnit,
        millLine,
        operatorName,
        overheadCost: Number(overheadCost),
        totalProductionCost,
        unitProductionCost,
        rawMaterials: formattedRaw,
        status: 'COMPLETED',
        notes,
      });

      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء ترحيل أمر التشغيل');
    }
  };

  return (
    <div>
      {/* Main Interactive Dashboard View (Hidden when printing order) */}
      <div className={`space-y-6 ${selectedOrderForPrint ? 'no-print' : ''}`}>
        {/* Top Banner & KPI Summary */}
      <div className="bg-gradient-to-r from-[#0F2942] to-[#1E3E62] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-blue-900/50">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-500/20 border border-blue-400/40 rounded-2xl text-cyan-300">
            <Factory className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight">{company.nameAr}</h2>
              <span className="text-xs bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 px-2.5 py-0.5 rounded-full font-bold">
                أوامر التشغيل وتصنيع المطحنة
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              إدارة خطوط طحن البهارات، خلط المكونات، التعبئة والتغليف، مع الترحيل التلقائي لقيود التكاليف والمخزون
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          إصدار أمر تشغيل وطحن جديد
        </button>
      </div>

      {/* Orders List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            سجل أوامر التشغيل والإنتاج بالمطحنة ({productionOrders.length})
          </h3>
          <span className="text-xs text-slate-500 font-bold">الترحيل الآلي للقيود اليومية</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-28 font-mono">رقم الأمر</th>
                <th className="p-3.5 w-24">التاريخ</th>
                <th className="p-3.5">المنتج التام المصنع</th>
                <th className="p-3.5 text-center w-28">الكمية المنتجة</th>
                <th className="p-3.5 text-left w-32">تكلفة الإنتاج</th>
                <th className="p-3.5 text-left w-28">تكلفة الوحدة</th>
                <th className="p-3.5 w-40">خط الإنتاج / المشغل</th>
                <th className="p-3.5 text-center w-28">الحالة</th>
                <th className="p-3.5 text-center w-20">طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {productionOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                    لا توجد أوامر تشغيل حتى الآن. انقر على «إصدار أمر تشغيل وطحن جديد» للبدء.
                  </td>
                </tr>
              ) : (
                productionOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-black text-blue-900">{ord.orderNumber}</td>
                    <td className="p-3.5 font-mono text-slate-600">{ord.date}</td>
                    <td className="p-3.5">
                      <span className="font-black text-slate-900 block">{ord.targetItemNameAr}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{ord.targetSku}</span>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-slate-800">
                      {ord.targetQuantity} {ord.targetUnit}
                    </td>
                    <td className="p-3.5 text-left font-mono font-black text-slate-900">
                      {formatCurrency(ord.totalProductionCost, currency)}
                    </td>
                    <td className="p-3.5 text-left font-mono font-bold text-emerald-700">
                      {formatCurrency(ord.unitProductionCost, currency)}
                    </td>
                    <td className="p-3.5">
                      <span className="text-slate-700 font-bold block">{ord.millLine || 'المطحنة الرئيسية'}</span>
                      <span className="text-[10px] text-slate-500 block">المشرف: {ord.operatorName || 'مودي جميل'}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        مكتمل ومرحل
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedOrderForPrint(ord)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        title="معاينة وطباعة بطاقة التشغيل"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Production Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">إصدار وترحيل أمر تشغيل وطحن بمطحنة الوليد</h3>
                  <p className="text-xs text-slate-300">تحويل المواد الخام إلى منتجات تامة وتوليد قيد التكاليف آلياً</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs bg-slate-50">
              {/* Finished Good Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  1. المنتج النهائي المستهدف (تام الصنع)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-black text-slate-700 mb-1">اختر الصنف المراد طحنه وتجهيزه *</label>
                    <select
                      value={targetItemId}
                      onChange={(e) => handleTargetItemChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {inventory.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nameAr} (متوفر حالياً: {item.quantityOnHand} {item.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-black text-slate-700 mb-1">تاريخ أمر التشغيل *</label>
                    <input
                      type="date"
                      required
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-black text-slate-700 mb-1">الكمية المستهدفة للإنتاج *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={targetQuantity}
                        onChange={(e) => setTargetQuantity(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 font-mono outline-none"
                      />
                      <span className="font-bold text-slate-600 whitespace-nowrap">{targetUnit}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Materials Recipe Table */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    2. المواد الخام والمكونات المستهلكة في الخلطة
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddRawMaterialRow}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-black text-xs flex items-center gap-1 border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة مادة خام
                  </button>
                </div>

                <div className="space-y-3">
                  {rawMaterials.map((raw, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">المادة الخام:</label>
                        <select
                          value={raw.itemId}
                          onChange={(e) => handleRawItemChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                        >
                          <option value="">-- اختر المادة الخام --</option>
                          {inventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nameAr} (متاح: {item.quantityOnHand} {item.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">الكمية المستهلكة:</label>
                        <input
                          type="number"
                          step="any"
                          value={raw.quantityRequired}
                          onChange={(e) => {
                            const updated = [...rawMaterials];
                            updated[idx].quantityRequired = Number(e.target.value);
                            setRawMaterials(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 font-mono outline-none"
                        />
                      </div>

                      <div className="w-28">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">تكلفة الوحدة:</label>
                        <input
                          type="number"
                          step="any"
                          value={raw.unitCost}
                          onChange={(e) => {
                            const updated = [...rawMaterials];
                            updated[idx].unitCost = Number(e.target.value);
                            setRawMaterials(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 font-mono outline-none"
                        />
                      </div>

                      <div className="w-28 text-left">
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">الإجمالي:</span>
                        <span className="font-mono font-black text-slate-800 text-xs">
                          {formatCurrency(raw.quantityRequired * raw.unitCost, currency)}
                        </span>
                      </div>

                      {rawMaterials.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRawMaterialRow(idx)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer mt-4"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Operating & Overhead Costs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-black text-slate-700 mb-1">تكاليف تشغيل وطحن وعمالة مباشرة ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={overheadCost}
                    onChange={(e) => setOverheadCost(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">خط الإنتاج بالمطحنة</label>
                  <input
                    type="text"
                    value={millLine}
                    onChange={(e) => setMillLine(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">المشرف المسؤول على التشغيل</label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-blue-900 text-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-blue-200 block">إجمالي تكلفة دفعة الإنتاج:</span>
                  <span className="text-2xl font-black font-mono text-white">
                    {formatCurrency(totalProductionCost, currency)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-blue-200 block">التكلفة المحتسبة للوحدة الواحدة:</span>
                  <span className="text-xl font-black font-mono text-cyan-300">
                    {formatCurrency(unitProductionCost, currency)} / {targetUnit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد وترحيل أمر التشغيل
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* Production Order Print Modal */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:backdrop-blur-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:border-none print:w-full print:m-0 print:p-0">
            {/* Top Control Bar (Hidden on Print) */}
            <div className="bg-[#0F2942] text-white p-4 sm:p-5 flex items-center justify-between no-print border-b border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">معاينة بطاقة أمر التشغيل والتصنيع</h3>
                  <p className="text-xs text-slate-300">أمر تشغيل رقم: {selectedOrderForPrint.orderNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة بطاقة التشغيل (Print)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForPrint(null)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Container */}
            <div className="p-6 sm:p-8 overflow-y-auto bg-white text-slate-900 space-y-6 print:p-0 print:overflow-visible" id="printable-production">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <h1 className="text-xl font-black text-[#0F2942] tracking-tight">{company.nameAr}</h1>
                  <p className="text-xs text-slate-600 font-bold">{company.nameEn}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold pt-1">
                    <span>سجل تجاري: {company.crNumber}</span>
                    <span>•</span>
                    <span>غرفة التجارة: {company.chamberNumber || '112890'}</span>
                    <span>•</span>
                    <span>هاتف: {company.phone}</span>
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <div className="inline-block bg-[#0F2942] text-white px-3.5 py-1 rounded-lg text-xs font-black">
                    بطاقة أمر تشغيل وطحن معتمدة
                  </div>
                  <p className="text-[11px] text-slate-600 font-mono font-bold">رقم الأمر: {selectedOrderForPrint.orderNumber}</p>
                  <p className="text-[11px] text-slate-500 font-bold">تاريخ التشغيل: {selectedOrderForPrint.date}</p>
                </div>
              </div>

              {/* Order Info & Finished Goods Summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">المنتج النهائي المُصنّع:</span>
                  <span className="text-sm font-black text-slate-900">{selectedOrderForPrint.targetItemNameAr}</span>
                  <span className="text-[11px] text-slate-600 font-mono font-bold block">
                    الكمية المنتجة: {selectedOrderForPrint.targetQuantity} {selectedOrderForPrint.targetUnit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">خط الإنتاج والمشرف:</span>
                  <span className="font-bold text-slate-800 block">خط: {selectedOrderForPrint.millLine || 'خط طحن وتعبئة رقم 1'}</span>
                  <span className="text-slate-600 block">المشرف المسؤول: مشرف خط الإنتاج</span>
                </div>
                <div className="sm:text-left">
                  <span className="text-slate-500 font-bold block">تكلفة الوحدة المنتجة:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatCurrency(selectedOrderForPrint.unitProductionCost, currency)} / {selectedOrderForPrint.targetUnit}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    إجمالي التكلفة: {formatCurrency(selectedOrderForPrint.totalProductionCost, currency)}
                  </span>
                </div>
              </div>

              {/* Raw Materials Consumed Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-800">تفاصيل المواد الخام المستهلكة في أمر التشغيل (BOM):</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5">المادة الخام</th>
                        <th className="p-2.5 text-center w-24">الكمية المستهلكة</th>
                        <th className="p-2.5 text-center w-20">الوحدة</th>
                        <th className="p-2.5 text-left w-28">سعر التكلفة</th>
                        <th className="p-2.5 text-left w-32 font-bold">إجمالي تكلفة المادة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrderForPrint.rawMaterials || []).map((raw, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800">{raw.itemNameAr}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{raw.quantityRequired}</td>
                          <td className="p-2.5 text-center text-slate-600">{raw.unit}</td>
                          <td className="p-2.5 text-left font-mono">{formatCurrency(raw.unitCost, '')}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                            {formatCurrency(raw.quantityRequired * raw.unitCost, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={5} className="p-2.5 text-left">إجمالي تكلفة المواد الخام:</td>
                        <td className="p-2.5 text-left font-mono text-blue-900">
                          {formatCurrency((selectedOrderForPrint.rawMaterials || []).reduce((acc, r) => acc + (r.quantityRequired * r.unitCost), 0), currency)}
                        </td>
                      </tr>
                      {selectedOrderForPrint.overheadCost > 0 && (
                        <tr>
                          <td colSpan={5} className="p-2.5 text-left text-slate-600 font-bold">مصاريف التشغيل والطحن الإضافية:</td>
                          <td className="p-2.5 text-left font-mono text-slate-800">
                            {formatCurrency(selectedOrderForPrint.overheadCost, currency)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td colSpan={5} className="p-2.5 text-left text-emerald-900 font-black">إجمالي تكلفة أمر الإنتاج المعتمدة:</td>
                        <td className="p-2.5 text-left font-mono text-emerald-900 font-black text-sm">
                          {formatCurrency(selectedOrderForPrint.totalProductionCost, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-4">
                  <span className="text-slate-500 font-bold block">مشرف خط الإنتاج</span>
                  <span className="text-slate-400 text-[11px] block">التوقيع: ...........................</span>
                  <div className="w-32 h-0.5 bg-slate-300 mx-auto"></div>
                </div>

                <div className="space-y-4">
                  <span className="text-slate-500 font-bold block">محاسب التكاليف والمخازن</span>
                  <span className="text-slate-400 text-[11px] block">التوقيع: ...........................</span>
                  <div className="w-32 h-0.5 bg-slate-300 mx-auto"></div>
                </div>

                <div className="space-y-4">
                  <span className="text-slate-500 font-bold block">المدير المالي والاعتماد</span>
                  <span className="text-slate-400 text-[11px] block">الختم والتوقيع: ...........................</span>
                  <div className="w-32 h-0.5 bg-slate-300 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
