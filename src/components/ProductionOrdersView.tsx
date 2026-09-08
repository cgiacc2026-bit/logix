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
  Factory,
  ShieldCheck,
  Award,
  Compass,
  Wrench,
  Sliders,
  ChevronRight,
  Activity,
  Flame,
  Sparkles,
  Check,
  FileCheck2
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

  // Subtabs State
  const [activeTab, setActiveTab] = useState<'orders' | 'engineering' | 'quality'>('orders');
  const [selectedEngineeringStep, setSelectedEngineeringStep] = useState<number>(0);
  const [selectedOrderForQc, setSelectedOrderForQc] = useState<ProductionOrder | null>(null);
  const [qcInspector, setQcInspector] = useState('م. أحمد العتيبي - مختبر ضبط الجودة');
  const [qcNotes, setQcNotes] = useState(
    'العينة مطابقة للائحة الفنية للهيئة العامة للغذاء والتغذية الكويتية والمواصفة القياسية الخليجية GSO 1016، نسبة الرطوبة 7.2%، النعومة 60 Mesh'
  );
  const [qcStatus, setQcStatus] = useState<'APPROVED' | 'QUARANTINE' | 'REJECTED'>('APPROVED');
  const [selectedQcForPrint, setSelectedQcForPrint] = useState<{
    order: ProductionOrder;
    status: string;
    inspector: string;
    notes: string;
    certNo: string;
    date: string;
  } | null>(null);

  const engineeringSteps = [
    {
      id: 1,
      nameAr: 'استقبال وفرز الحبوب والبهارات الخام',
      nameEn: 'Raw Grain Ingestion & Pre-cleaning',
      icon: Package,
      workstation: 'صومعة الاستقبال رقم 1',
      operator: 'سالم الكندري',
      parameters: 'فحص أولي للرطوبة (< 12%)، قياس الكثافة الحجمية',
      hazardControl: 'فرز الشوائب الكبيرة والعيوب الظاهرية',
      status: 'نشط ويعمل بكفاءة 100%',
      throughput: '1,200 كجم / ساعة',
      color: 'from-blue-600 to-cyan-600',
    },
    {
      id: 2,
      nameAr: 'الغربلة والكاشف المغناطيسي النادر',
      nameEn: 'Vibratory Sieve & Rare-Earth Magnetic Drum',
      icon: Sliders,
      workstation: 'وحدة الفرز الميكانيكي',
      operator: 'محمد عبد الله',
      parameters: 'غربال هزاز ثنائي الطبقات + مغناطيس نيوديميوم 12,000 Gauss',
      hazardControl: 'إزالة الرمل والحجارة والمعادن الحديدية 0.0 ppm',
      status: 'معايرة دورية معتمدة',
      throughput: '1,000 كجم / ساعة',
      color: 'from-indigo-600 to-blue-600',
    },
    {
      id: 3,
      nameAr: 'التحميص والمعالجة الحرارية المتجانسة',
      nameEn: 'Thermal Conditioning & Roasting',
      icon: Flame,
      workstation: 'محمص الهواء الساخن الدوار',
      operator: 'عمر القحطاني',
      parameters: 'درجة حرارة 110°C - زمن دوران 12 دقيقة',
      hazardControl: 'تثبيط الإنزيمات وتركيز الزيوت العطرية وتقليل الرطوبة',
      status: 'تحت المراقبة الحرارية الرقمية',
      throughput: '800 كجم / ساعة',
      color: 'from-amber-600 to-orange-600',
    },
    {
      id: 4,
      nameAr: 'الطحن فائق النعومة بمطحنة المطارق',
      nameEn: 'High-Velocity Micro Hammer Mill',
      icon: Factory,
      workstation: 'مطحنة المطارق المركزية 50 حصان',
      operator: 'مودي جميل (مشرف التشغيل)',
      parameters: 'سرعة دوران 2,800 RPM، غربال ميكروني 60 Mesh',
      hazardControl: 'نظام تبريد هوائي لمنع احتراق الزيوت العطرية',
      status: 'يعمل بالطاقة الإنتاجية القصوى',
      throughput: '650 كجم / ساعة',
      color: 'from-rose-600 to-red-600',
    },
    {
      id: 5,
      nameAr: 'برج المزج والخلط الآلي للبهارات',
      nameEn: 'Twin-Shaft Paddle Blending Tower',
      icon: Compass,
      workstation: 'خلاط التوابل المتجانس 500 لتر',
      operator: 'طارق الدوسري',
      parameters: 'تجانس 99.8%، دمج التوابل والبهارات المشكلة بدقة',
      hazardControl: 'موازين إلكترونية ميكرونية متصلة بـ PLC',
      status: 'جاهز لخلطات التوريد',
      throughput: '750 كجم / دفعة',
      color: 'from-purple-600 to-indigo-600',
    },
    {
      id: 6,
      nameAr: 'محطة فحص الجودة والمطابقة الكيميائية',
      nameEn: 'In-Line QC Sensor & Lab Clearance',
      icon: ShieldCheck,
      workstation: 'مختبر المطحنة المعتمد',
      operator: 'م. أحمد العتيبي (مسؤول الجودة)',
      parameters: 'جهاز تحليل الرطوبة الهالوجيني، قياس اللون والأشعة',
      hazardControl: 'التحقق من مطابقة لائحة GSO 1016 وهيئة الغذاء',
      status: 'إصدار شهادات COA فورياً',
      throughput: 'فحص فوري لكل تشغيلة',
      color: 'from-emerald-600 to-teal-600',
    },
    {
      id: 7,
      nameAr: 'خط التعبئة والتغليف الآلي بنيتروجين',
      nameEn: 'Automated Nitrogen Flush FFS Packaging',
      icon: Cpu,
      workstation: 'ماكينة التعبئة الرأسية FFS',
      operator: 'خالد المنصور',
      parameters: 'حقن غاز النيتروجين الخامل، دقة وزن ±0.5 غرام',
      hazardControl: 'عزل الأكسجين لضمان جودة وصلاحية 24 شهراً',
      status: 'يعمل بمعدل 45 كيس / دقيقة',
      throughput: '2,700 عبوة / ساعة',
      color: 'from-cyan-600 to-blue-600',
    },
    {
      id: 8,
      nameAr: 'الإيداع المخزني والترحيل المحاسبي اللحظي',
      nameEn: 'Finished Stock Inflow & GL Journal Posting',
      icon: CheckCircle2,
      workstation: 'منظومة LOGIX ERP المركزية',
      operator: 'النظام المحاسبي الآلي',
      parameters: 'توليد قيد يومية متوازن: من حـ/ المخزون التام إلى حـ/ تشغيل المطحنة',
      hazardControl: 'تحديث فوري لدفتر الأستاذ وتكلفة الوحدة المرجحة',
      status: 'مرحل ومطابق لمعايير IFRS',
      throughput: 'لحظي آلي',
      color: 'from-emerald-700 to-green-700',
    },
  ];

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
              إدارة خطوط طحن البهارات، ربط الخرائط الهندسية، ضبط الجودة المخبرية، وإصدار أذونات الإطلاق النهائي للتداول
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

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>سجل أوامر التشغيل والورك فلو ({productionOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('engineering')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'engineering'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Compass className="w-4 h-4 text-cyan-500" />
          <span>الخرائط الهندسية ومخططات خطوط الطحن (Engineering Schematic)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quality')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'quality'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>معمل ضبط الجودة وشهادات الفحص (QC & Lab Analysis)</span>
        </button>
      </div>

      {/* TAB 1: ORDERS LIST */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              سجل أوامر التشغيل والإنتاج بالمطحنة ({productionOrders.length})
            </h3>
            <span className="text-xs text-slate-500 font-bold">الترحيل الآلي للقيود اليومية والمخزون</span>
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
                  <th className="p-3.5 w-36">خط الإنتاج / المشرف</th>
                  <th className="p-3.5 text-center w-28">الحالة</th>
                  <th className="p-3.5 text-center w-32">فحص الجودة (QC)</th>
                  <th className="p-3.5 text-center w-20">طباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {productionOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
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
                          type="button"
                          onClick={() => setSelectedOrderForQc(ord)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors shadow-xs"
                          title="معاينة أو إصدار شهادة فحص الجودة المخبرية"
                        >
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          فحص الجودة COA
                        </button>
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
      )}

      {/* TAB 2: ENGINEERING SCHEMATIC & ROUTING */}
      {activeTab === 'engineering' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-blue-600" />
                  المخطط الهندسي التفاعلي لمسارات خطوط الطحن (Industrial Mill Routing Schematic)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  تتبع المراحل الهندسية الثمانية لعمليات استقبال، معالجة، طحن، فحص، وتعبئة الحبوب والبهارات وفق معايير الجودة العالمية
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                جميع المحطات تعمل بكفاءة تشغيلية 100%
              </span>
            </div>

            {/* 8-Stage Workstation Flow Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {engineeringSteps.map((step, idx) => {
                const IconComp = step.icon;
                const isSelected = selectedEngineeringStep === idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedEngineeringStep(idx)}
                    className={`text-right p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono font-black text-xs flex items-center justify-center">
                          0{step.id}
                        </span>
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${step.color} text-white shadow-xs`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-tight">{step.nameAr}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{step.nameEn}</p>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400">المحطة:</span> <strong>{step.workstation}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">الطاقة:</span> <strong className="font-mono">{step.throughput}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        جاهز ومطابق
                      </span>
                      <span className="text-blue-600 font-black">تفاصيل المحطة &larr;</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detailed Selected Workstation Telemetry & Control Panel */}
            {(() => {
              const current = engineeringSteps[selectedEngineeringStep] || engineeringSteps[0];
              const StepIcon = current.icon;
              return (
                <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-5 border border-slate-800 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${current.color} text-white`}>
                        <StepIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 font-mono text-xs font-bold">
                            محطة رقم {current.id}
                          </span>
                          <h3 className="text-base font-black tracking-tight">{current.nameAr}</h3>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{current.nameEn}</p>
                      </div>
                    </div>

                    <div className="text-left text-xs font-mono">
                      <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        {current.status}
                      </div>
                      <div className="text-slate-400 mt-1">المشرف المسؤول: {current.operator}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
                      <span className="text-slate-400 block font-bold">المعايير التشغيلية والفيزيائية:</span>
                      <p className="text-slate-200 font-medium leading-relaxed">{current.parameters}</p>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
                      <span className="text-slate-400 block font-bold">نظام الأمان والتحكم في المخاطر:</span>
                      <p className="text-slate-200 font-medium leading-relaxed">{current.hazardControl}</p>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
                      <span className="text-slate-400 block font-bold">معدل الإنتاجية اللحظي:</span>
                      <p className="text-cyan-300 font-mono font-black text-sm">{current.throughput}</p>
                      <span className="text-[10px] text-slate-400 block">ربط مباشر بـ PLC ووحدات SCADA الصناعية</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 3: QUALITY CONTROL & LAB ANALYSIS */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  مختبر فحص الجودة والمطابقة الغذائية (Quality Control & COA Issuance)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  إصدار شهادات التحليل المخبري الرسمية (Certificate of Analysis) ومطابقة مواصفات هيئة الغذاء والتغذية الكويتية
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                المواصفة القياسية: GSO 1016 / 2026
              </span>
            </div>

            {/* List of Orders for QC testing */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>أوامر التشغيل الجاهزة للفحص المخبري والاعتماد ({productionOrders.length})</span>
                <span className="text-slate-500 font-normal">اختر أي أمر تشغيل لمعاينة أو طباعة شهادة COA</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-mono">رقم الأمر</th>
                      <th className="p-3">المنتج المفحوص</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3">خط الطحن</th>
                      <th className="p-3 text-center">حالة الجودة المخبرية</th>
                      <th className="p-3 text-center">إجراءات الفحص والطباعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productionOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-900">{ord.orderNumber}</td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{ord.targetItemNameAr}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{ord.targetSku}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          {ord.targetQuantity} {ord.targetUnit}
                        </td>
                        <td className="p-3 text-slate-600">{ord.millLine || 'المطحنة الرئيسية'}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3 text-emerald-600" />
                            مطابق ومعتمد رسمي (Passed)
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForQc(ord)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              فحص وتعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedQcForPrint({
                                  order: ord,
                                  status: 'APPROVED',
                                  inspector: qcInspector,
                                  notes: qcNotes,
                                  certNo: `COA-${ord.orderNumber.replace(/[^0-9]/g, '') || '2026-001'}`,
                                  date: ord.date,
                                });
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              طباعة شهادة COA
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* QC INSPECTION MODAL */}
      {selectedOrderForQc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">فحص الجودة والمطابقة المخبرية لأمر التشغيل</h3>
                  <p className="text-xs text-slate-500">رقم الأمر: {selectedOrderForQc.orderNumber} | {selectedOrderForQc.targetItemNameAr}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForQc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">الكمية المصنعة:</span>
                  <span className="font-black text-slate-900 font-mono">
                    {selectedOrderForQc.targetQuantity} {selectedOrderForQc.targetUnit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">خط الطحن:</span>
                  <span className="font-bold text-slate-800">{selectedOrderForQc.millLine || 'خط الطحن الرئيسي'}</span>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">حالة إفراج الجودة:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQcStatus('APPROVED')}
                    className={`py-2 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      qcStatus === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    معتمد ومطابق (Release)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQcStatus('QUARANTINE')}
                    className={`py-2 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      qcStatus === 'QUARANTINE'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    حجر مخبري (Quarantine)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQcStatus('REJECTED')}
                    className={`py-2 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      qcStatus === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    مرفوض (Rejected)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">اسم مسؤول فحص الجودة والمختبر:</label>
                <input
                  type="text"
                  value={qcInspector}
                  onChange={(e) => setQcInspector(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">تقرير الفحص المخبري وتوصيات الإطلاق:</label>
                <textarea
                  rows={3}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const cert = {
                    order: selectedOrderForQc,
                    status: qcStatus,
                    inspector: qcInspector,
                    notes: qcNotes,
                    certNo: `COA-${selectedOrderForQc.orderNumber.replace(/[^0-9]/g, '') || '2026-001'}`,
                    date: new Date().toISOString().split('T')[0],
                  };
                  setSelectedOrderForQc(null);
                  setSelectedQcForPrint(cert);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                اعتماد وطباعة شهادة COA الفورية
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderForQc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL COA CERTIFICATE MODAL */}
      {selectedQcForPrint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto p-8 space-y-6 border border-slate-300 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <span className="text-xs font-black text-slate-700">شهادة التحليل المخبري وإذن الإطلاق النهائي (COA)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-lg flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  طباعة الشهادة الرسمية (Print COA)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedQcForPrint(null)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Official Certificate Form */}
            <div className="border-4 border-double border-emerald-900 p-8 rounded-xl space-y-6 bg-[#FCFDFD] text-black">
              <div className="flex items-start justify-between border-b-2 border-emerald-900 pb-4">
                <div className="text-right space-y-1">
                  <h1 className="text-2xl font-black text-emerald-950">شهادة فحص مخبري وإذن إفراج جودة نهائي</h1>
                  <p className="text-xs font-bold text-slate-700">CERTIFICATE OF ANALYSIS & FINAL RELEASE APPROVAL</p>
                  <p className="text-[11px] text-slate-500 font-mono">مطحنة الوليد المتحدة - معمل الرقابة وضبط الجودة الغذائية المعتمد</p>
                </div>
                <div className="text-left font-mono">
                  <div className="text-sm font-black text-emerald-900">{selectedQcForPrint.certNo}</div>
                  <div className="text-xs text-slate-500">التاريخ: {selectedQcForPrint.date}</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="text-center py-3 bg-emerald-50 border-2 border-emerald-600 rounded-xl">
                <span className="text-base font-black text-emerald-900">
                  {selectedQcForPrint.status === 'APPROVED'
                    ? '✅ إذن إفراج رسمي - معتمد ومطابق للتداول والتوريد لسلاسل التجزئة'
                    : selectedQcForPrint.status === 'QUARANTINE'
                    ? '⏳ محتجز تحت الحجر المخبري المؤقت'
                    : '❌ غير مطابق للمواصفات - بضاعة معيبة ومرفوضة'}
                </span>
              </div>

              {/* Batch Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">المنتج المفحوص:</span>
                  <span className="font-black text-slate-900">{selectedQcForPrint.order.targetItemNameAr}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم أمر التشغيل:</span>
                  <span className="font-mono font-bold">{selectedQcForPrint.order.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">خط الطحن:</span>
                  <span className="font-bold">{selectedQcForPrint.order.millLine || 'خط الطحن والتعبئة'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الكمية المعتمدة:</span>
                  <span className="font-black text-emerald-800">
                    {selectedQcForPrint.order.targetQuantity} {selectedQcForPrint.order.targetUnit}
                  </span>
                </div>
              </div>

              {/* Test Specifications */}
              <div className="space-y-2 text-xs">
                <h4 className="font-black text-slate-900">نتائج التحليل المخبري والمطابقة (Laboratory Test Results):</h4>
                <table className="w-full text-right border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2 border border-slate-300">المعيار الفني</th>
                      <th className="p-2 border border-slate-300">المواصفة القياسية المعتمدة GSO 1016</th>
                      <th className="p-2 border border-slate-300">النتيجة الفعلية للمختبر</th>
                      <th className="p-2 border border-slate-300 text-center">التقييم</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300">نسبة النقاء ونظافة الحبوب</td>
                      <td className="p-2 border border-slate-300">&gt; 99.0%</td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">99.8%</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">مطابق</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300">نسبة الرطوبة (Moisture Content)</td>
                      <td className="p-2 border border-slate-300">&lt; 10.0%</td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">7.2%</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">مطابق</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300">فحص الكواشف المغناطيسية (Ferrous Metals)</td>
                      <td className="p-2 border border-slate-300">0.0 ppm (خالٍ تماماً)</td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">Pass 0.0 ppm</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">مطابق</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300">درجة النعومة والتجانس (Mesh Fineness)</td>
                      <td className="p-2 border border-slate-300">60 Mesh متجانس</td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">60 Mesh</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">مطابق</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Release Notes */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-300 rounded-xl space-y-1 text-xs">
                <span className="font-black text-emerald-950 block">تعليمات التخزين والإفراج النهائي:</span>
                <p className="text-slate-800 leading-relaxed">{selectedQcForPrint.notes}</p>
              </div>

              {/* Signatures and Stamps */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs font-bold">
                <div className="border-t-2 border-slate-400 pt-2">
                  <span>المسؤول المعتمد للفحص المخبري:</span>
                  <div className="mt-4 text-emerald-900 font-bold">{selectedQcForPrint.inspector}</div>
                </div>
                <div className="border-t-2 border-slate-400 pt-2">
                  <span>الختم الرسمي لإفراج الشحنة:</span>
                  <div className="mt-3 inline-block px-4 py-1.5 border-2 border-emerald-800 text-emerald-900 rounded-full font-black text-[11px]">
                    LOGIX QC CERTIFIED 2026
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
