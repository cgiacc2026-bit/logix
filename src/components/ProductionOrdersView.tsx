import React, { useState, useEffect, useMemo } from 'react';
import {
  ProductionOrder,
  InventoryItem,
  CompanyProfile,
  ManufacturingIndustryType,
  ManufacturingStandardSettings,
  StandardCategoryDefinition,
  StandardLineDefinition,
} from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  INDUSTRY_METADATA_LIST,
  INDUSTRY_ROUTING_PRESETS,
  INDUSTRY_QC_PRESETS,
} from '../data/manufacturingProfiles.ts';
import { DataService, DEFAULT_MANUFACTURING_PROFILES } from '../services/dataService.ts';
import { ManufacturingSettingsModal } from './ManufacturingSettingsModal.tsx';
import {
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  Cpu,
  AlertCircle,
  X,
  Factory,
  ShieldCheck,
  Award,
  Compass,
  Sliders,
  Sparkles,
  Check,
  FileSpreadsheet,
  TrendingUp,
  Box,
  Lightbulb,
  FlaskConical,
  Wheat,
  Cog,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
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
  // Settings & Industry Configuration
  const [manufacturingSettings, setManufacturingSettings] = useState<ManufacturingStandardSettings>(() => {
    return DataService.getLocalManufacturingSettings(company.id);
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Sync settings when company changes
  useEffect(() => {
    DataService.getManufacturingSettings(company.id).then((s) => {
      if (s) setManufacturingSettings(s);
    });
  }, [company.id]);

  const activeIndustry: ManufacturingIndustryType = manufacturingSettings.industryType || 'FOOD_MILLING';
  const currentIndustryMeta = useMemo(() => {
    return (
      INDUSTRY_METADATA_LIST.find((m) => m.id === activeIndustry) ||
      INDUSTRY_METADATA_LIST[0]
    );
  }, [activeIndustry]);

  // Modals & Active Tab States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<ProductionOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'engineering' | 'quality'>('orders');
  const [selectedEngineeringStep, setSelectedEngineeringStep] = useState<number>(0);

  // QC modal states
  const [selectedOrderForQc, setSelectedOrderForQc] = useState<ProductionOrder | null>(null);
  const [qcInspector, setQcInspector] = useState(currentIndustryMeta.defaultSupervisor);
  const [qcNotes, setQcNotes] = useState(
    'تم فحص العينة مخبرياً وهي مطابقة للمواصفات القياسية الصناعية المعتمدة وخالية تماماً من أي عيوب أو شوائب.'
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

  // Form State for Order Creation
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetItemId, setTargetItemId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(100);
  const [targetUnit, setTargetUnit] = useState('حبة');

  // Predefined Standardized Dropdowns
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [operatorName, setOperatorName] = useState(currentIndustryMeta.defaultSupervisor);
  const [overheadCost, setOverheadCost] = useState(15.0);
  const [notes, setNotes] = useState('');

  // Scrap & Waste Tracking
  const [scrapQuantity, setScrapQuantity] = useState<number>(0);
  const [scrapPercentage, setScrapPercentage] = useState<number>(0);
  const [scrapReason, setScrapReason] = useState<string>('');

  // By-Products / Co-Products
  const [byProductsNote, setByProductsNote] = useState<string>('');

  // Raw Materials (BOM) list
  const [rawMaterials, setRawMaterials] = useState<
    { itemId: string; quantityRequired: number; unitCost: number }[]
  >([{ itemId: '', quantityRequired: 100, unitCost: 0 }]);

  // Quick industry switcher
  const handleQuickSwitchIndustry = async (newInd: ManufacturingIndustryType) => {
    const defaults = DEFAULT_MANUFACTURING_PROFILES[newInd];
    const updated: ManufacturingStandardSettings = {
      industryType: newInd,
      standardCategories: defaults.standardCategories,
      standardLines: defaults.standardLines,
      standardWorkstations: defaults.standardWorkstations,
    };
    await DataService.saveManufacturingSettings(company.id, updated);
    setManufacturingSettings(updated);
    setSelectedEngineeringStep(0);
    const meta = INDUSTRY_METADATA_LIST.find((m) => m.id === newInd);
    if (meta) {
      setQcInspector(meta.defaultSupervisor);
    }
  };

  const handleOpenAddModal = () => {
    setOrderDate(new Date().toISOString().split('T')[0]);
    const firstItem = inventory[0];
    setTargetItemId(firstItem?.id || '');
    setTargetQuantity(100);
    setTargetUnit(firstItem?.unit || 'حبة');

    // Default category & line from standardized settings
    const outputCat = manufacturingSettings.standardCategories.find((c) => c.type === 'OUTPUT');
    setSelectedCategory(outputCat?.nameAr || manufacturingSettings.standardCategories[0]?.nameAr || 'منتج تام');
    setSelectedLine(manufacturingSettings.standardLines[0]?.nameAr || 'خط الإنتاج الرئيسي 1');
    setOperatorName(currentIndustryMeta.defaultSupervisor);

    // Initial raw materials BOM
    setRawMaterials([
      {
        itemId: inventory[1]?.id || inventory[0]?.id || '',
        quantityRequired: 100,
        unitCost: Number(inventory[1]?.purchasePrice || inventory[0]?.purchasePrice) || 0.5,
      },
    ]);
    setOverheadCost(15.0);
    setScrapQuantity(0);
    setScrapPercentage(0);
    setScrapReason('');
    setByProductsNote('');
    setNotes(`تشغيل دفعة صناعية لخط ${manufacturingSettings.standardLines[0]?.nameAr || 'الإنتاج'}`);
    setIsModalOpen(true);
  };

  const handleTargetItemChange = (itemId: string) => {
    setTargetItemId(itemId);
    const item = inventory.find((i) => i.id === itemId);
    if (item) {
      setTargetUnit(item.unit || 'حبة');
      if (item.category) {
        setSelectedCategory(item.category);
      }
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
      alert('الرجاء اختيار المنتج التام المراد تصنيعه');
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
        millLine: selectedLine || 'خط الإنتاج الرئيسي',
        industryType: activeIndustry,
        operatorName: operatorName,
        overheadCost: Number(overheadCost),
        totalProductionCost,
        unitProductionCost,
        rawMaterials: formattedRaw,
        scrapQuantity: Number(scrapQuantity) || 0,
        scrapPercentage: Number(scrapPercentage) || 0,
        scrapReason: scrapReason || undefined,
        byProducts: byProductsNote
          ? [{ itemNameAr: byProductsNote, quantity: 1, unit: 'دفعة', estimatedValue: 0 }]
          : undefined,
        status: 'COMPLETED',
        notes: notes || `أمر تصنيع وتشغيل قطاع ${currentIndustryMeta.nameAr}`,
      });

      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء ترحيل أمر التشغيل');
    }
  };

  // Industry Routing steps for active industry
  const currentRoutingSteps = INDUSTRY_ROUTING_PRESETS[activeIndustry] || INDUSTRY_ROUTING_PRESETS.GENERAL_ASSEMBLY;
  const currentQcPreset = INDUSTRY_QC_PRESETS[activeIndustry] || INDUSTRY_QC_PRESETS.GENERAL_ASSEMBLY;

  // Render industry icon helper
  const renderIndustryIcon = (type: ManufacturingIndustryType, className: string = 'w-4 h-4') => {
    switch (type) {
      case 'FOOD_MILLING':
        return <Wheat className={className} />;
      case 'ELECTRICAL_LIGHTING':
        return <Lightbulb className={className} />;
      case 'CHEMICALS_DETERGENTS':
        return <FlaskConical className={className} />;
      case 'PACKAGING_CONVERTING':
        return <Box className={className} />;
      case 'GENERAL_ASSEMBLY':
      default:
        return <Cog className={className} />;
    }
  };

  return (
    <div>
      {/* Main Interactive Dashboard View */}
      <div className={`space-y-6 ${selectedOrderForPrint ? 'no-print' : ''}`}>
        {/* Top Universal Industrial Hub Banner */}
        <div className="bg-gradient-to-r from-[#0F2942] via-[#16365C] to-[#1E3E62] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-blue-900/50 relative overflow-hidden">
          <div className="flex items-center gap-4 z-10">
            <div className="p-3.5 bg-blue-500/20 border border-blue-400/40 rounded-2xl text-cyan-300 shadow-inner">
              <Factory className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">{company.nameAr}</h2>
                <span className="text-xs bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                  {renderIndustryIcon(activeIndustry, 'w-3.5 h-3.5 text-cyan-300')}
                  مركز التصنيع والإنتاج الشامل (Universal Engine)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                محرك تصنيع صناعي عام ومتكامل يدعم كافة الأنشطة وخطوط الإنتاج (بهارات ومواد غذائية، لمبات وأجهزة كهربائية، منظفات وكيماويات، كرتون وتغليف، وتجميع عام) لكافة الشركات في النظام.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 z-10 self-stretch md:self-auto justify-end">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-white/20 transition-all cursor-pointer shadow-xs whitespace-nowrap"
              title="تخصيص القوائم المنسدلة والمجموعات وخطوط الإنتاج القياسية"
            >
              <Sliders className="w-4 h-4 text-cyan-300" />
              <span>إدارة المعايير والمجموعات</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              إصدار أمر تصنيع وتشغيل جديد
            </button>
          </div>
        </div>

        {/* Industrial Profile Switcher Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>القطاع الصناعي النشط حالياً:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                {currentIndustryMeta.nameAr}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              انقر على أي قطاع صناعي للتبديل الفوري وتحميل خطوطه ومجموعاته القياسية
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {INDUSTRY_METADATA_LIST.map((ind) => {
              const isActive = ind.id === activeIndustry;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => handleQuickSwitchIndustry(ind.id)}
                  className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-blue-900 text-white border-blue-900 shadow-sm ring-2 ring-blue-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isActive ? 'bg-white/20 text-cyan-300' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {renderIndustryIcon(ind.id, 'w-4 h-4')}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-black truncate">{ind.nameAr}</div>
                    <div className={`text-[10px] font-mono truncate ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                      {ind.nameEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
            <span>سجل أوامر التصنيع والتشغيل ({productionOrders.length})</span>
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
            <span>المخططات الهندسية ومحطات التشغيل ({currentIndustryMeta.nameAr})</span>
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
            <span>معمل ضبط الجودة وشهادات COA التفاعلية</span>
          </button>
        </div>

        {/* TAB 1: PRODUCTION ORDERS LIST */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">إجمالي أوامر التشغيل:</span>
                  <span className="text-2xl font-black text-slate-900 font-mono">{productionOrders.length}</span>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">الكميات المنتجة المعتمدة:</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono">
                    {productionOrders.reduce((sum, o) => sum + (o.targetQuantity || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">إجمالي تكاليف التشغيل:</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {formatCurrency(
                      productionOrders.reduce((sum, o) => sum + (o.totalProductionCost || 0), 0),
                      currency
                    )}
                  </span>
                </div>
                <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">خطوط الإنتاج المعتمدة:</span>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {manufacturingSettings.standardLines.length}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-blue-600" />
                  سجل أوامر التصنيع والتشغيل الشامل ({productionOrders.length})
                </h3>
                <span className="text-xs text-slate-500 font-bold">
                  ترحيل آلي لقيود اليومية (GL Journal) وتخفيض الخامات وإيداع المنتجات التامة
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 w-28 font-mono">رقم الأمر</th>
                      <th className="p-3.5 w-24">التاريخ</th>
                      <th className="p-3.5">المنتج التام المصنع</th>
                      <th className="p-3.5 text-center w-28">الكمية</th>
                      <th className="p-3.5 text-left w-32">تكلفة الإنتاج</th>
                      <th className="p-3.5 text-left w-28">تكلفة الوحدة</th>
                      <th className="p-3.5 w-36">خط الإنتاج / المشرف</th>
                      <th className="p-3.5 text-center w-28">الهالك الصناعي</th>
                      <th className="p-3.5 text-center w-24">الحالة</th>
                      <th className="p-3.5 text-center w-28">فحص COA</th>
                      <th className="p-3.5 text-center w-16">طباعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {productionOrders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400 font-bold">
                          لا توجد أوامر تشغيل حتى الآن. انقر على «إصدار أمر تصنيع وتشغيل جديد» للبدء.
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
                            <span className="text-slate-800 font-bold block">{ord.millLine || 'خط الإنتاج العام'}</span>
                            <span className="text-[10px] text-slate-500 block">المشرف: {ord.operatorName || 'مشرف الخط'}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {ord.scrapQuantity && ord.scrapQuantity > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                {ord.scrapQuantity} {ord.targetUnit} ({ord.scrapPercentage || 0}%)
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-bold">0.0% (قياسي)</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              مكتمل
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
                              فحص COA
                            </button>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
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
          </div>
        )}

        {/* TAB 2: INDUSTRIAL ENGINEERING & WORKSTATIONS SCHEMATIC */}
        {activeTab === 'engineering' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Compass className="w-5 h-5 text-blue-600" />
                      المخطط الهندسي التفاعلي لمسارات خطوط الإنتاج ({currentIndustryMeta.nameAr})
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">{currentIndustryMeta.nameEn}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    تتبع المراحل الهندسية ومحطات التشغيل والمراقبة المعيارية المتناسبة مع قطاع {currentIndustryMeta.nameAr}.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  جميع المحطات الصناعية تعمل بكفاءة 100%
                </span>
              </div>

              {/* Workstations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentRoutingSteps.map((step, idx) => {
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
                            {renderIndustryIcon(activeIndustry, 'w-4 h-4')}
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

              {/* Selected Workstation Detailed Panel */}
              {(() => {
                const current = currentRoutingSteps[selectedEngineeringStep] || currentRoutingSteps[0];
                return (
                  <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-5 border border-slate-800 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${current.color} text-white shadow-md`}>
                          {renderIndustryIcon(activeIndustry, 'w-6 h-6')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 font-mono text-xs font-bold">
                              محطة رقم 0{current.id}
                            </span>
                            <h3 className="text-base font-black tracking-tight">{current.nameAr}</h3>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{current.nameEn}</p>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                        {current.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-1">
                        <span className="text-slate-400 block">اسم المحطة والمعدات:</span>
                        <span className="font-bold text-slate-100">{current.workstation}</span>
                        <span className="text-[10px] text-slate-400 block pt-1">
                          المشرف المعين: <strong className="text-cyan-300">{current.operator}</strong>
                        </span>
                      </div>

                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-1">
                        <span className="text-slate-400 block">المعايير التشغيلية والسرعة:</span>
                        <span className="font-mono text-slate-200">{current.parameters}</span>
                      </div>

                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-1">
                        <span className="text-slate-400 block">التحكم بالمخاطر والجودة (HACCP/ISO):</span>
                        <span className="text-emerald-300 font-medium">{current.hazardControl}</span>
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    معمل الرقابة وضبط الجودة وشهادات التحليل COA ({currentQcPreset.title})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    المواصفة المعتمدة: <strong className="text-slate-700">{currentQcPreset.standardDoc}</strong>
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                  نظام إدارة الجودة المعتمد ISO / GSO
                </span>
              </div>

              {/* Standard Criteria Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800">
                  المعايير الفنية والفحوصات المخبرية النموذجية لقطاع {currentIndustryMeta.nameAr}:
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="p-3">المعيار الفني</th>
                        <th className="p-3">المواصفة القياسية المعتمدة</th>
                        <th className="p-3">النتيجة المعملية الفعلية</th>
                        <th className="p-3 text-center w-24">التقييم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentQcPreset.criteria.map((cr, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{cr.parameter}</td>
                          <td className="p-3 text-slate-600">{cr.standardSpec}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{cr.actualResult}</td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" />
                              مطابق
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action trigger for latest order */}
              {productionOrders.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      آخر أمر تشغيل مسجل: #{productionOrders[0].orderNumber} - {productionOrders[0].targetItemNameAr}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يمكنك معاينة وطباعة شهادة الفحص المخبري الرسمية (COA) لهذا الأمر فورياً
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderForQc(productionOrders[0])}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    معاينة وإصدار شهادة COA للدفعة
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE PRODUCTION ORDER MODAL (Universal Multi-Industry) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-cyan-300">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    إصدار وترحيل أمر تصنيع وتشغيل ({currentIndustryMeta.nameAr})
                  </h3>
                  <p className="text-xs text-slate-300">
                    تحويل الخامات إلى منتجات تامة، تسجيل الهالك والمنتجات الفرعية، وتوليد قيد التكاليف آلياً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs bg-slate-50 flex-1">
              {/* Finished Good Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 shadow-xs">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  1. المنتج النهائي المستهدف (تام الصنع)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-black text-slate-700 mb-1">اختر الصنف المراد تصنيعه *</label>
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

                {/* Predefined Standardized Category & Line Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block font-black text-slate-700 mb-1">
                      المجموعة والتصنيف القياسي (Standard Category) *
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {manufacturingSettings.standardCategories.map((c) => (
                        <option key={c.id} value={c.nameAr}>
                          {c.nameAr} {c.nameEn ? `(${c.nameEn})` : ''} - {c.type === 'OUTPUT' ? 'مخرج' : 'مدخل'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-black text-slate-700 mb-1">
                      خط الإنتاج القياسي (Production Line) *
                    </label>
                    <select
                      value={selectedLine}
                      onChange={(e) => setSelectedLine(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {manufacturingSettings.standardLines.map((l) => (
                        <option key={l.id} value={l.nameAr}>
                          {l.nameAr} {l.nameEn ? `(${l.nameEn})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-black text-slate-700 mb-1">المشرف المسؤول على الخط</label>
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bill of Materials (BOM) Table */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    2. المواد الخام والمكونات المستهلكة في التصنيع (BOM)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddRawMaterialRow}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-black text-xs flex items-center gap-1 border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة مادة خام / مكون
                  </button>
                </div>

                <div className="space-y-3">
                  {rawMaterials.map((raw, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex-1 min-w-[220px]">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">المادة الخام / المكون:</label>
                        <select
                          value={raw.itemId}
                          onChange={(e) => handleRawItemChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                        >
                          <option value="">-- اختر المادة من المخزون --</option>
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
                          title="إلغاء المادة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Operating & Overhead Costs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-xs">
                <div>
                  <label className="block font-black text-slate-700 mb-1">
                    تكاليف تشغيل وعمالة وطاقة مباشرة ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={overheadCost}
                    onChange={(e) => setOverheadCost(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    تُحمّل على تكلفة دفعة الإنتاج وتوزع آلياً على تكلفة الوحدة
                  </span>
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">ملاحظات وتعليمات التشغيل الصناعي</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: رقم تشغيلة، معايير تعبئة خاصة، درجة حرارة"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Scrap & By-Products Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  3. مراقبة الهالك والمنتجات الفرعية والعرضية (Scrap & By-Products)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">كمية الهالك الصناعي:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={scrapQuantity}
                        onChange={(e) => setScrapQuantity(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-800 font-mono"
                      />
                      <span className="font-bold text-slate-500 whitespace-nowrap">{targetUnit}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">نسبة الهالك (%):</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="%"
                      value={scrapPercentage}
                      onChange={(e) => setScrapPercentage(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">سبب الهالك / نوع الفاقد:</label>
                    <input
                      type="text"
                      placeholder="مثال: عيوب غربلة، تالف بدء تشغيل، قص أطراف"
                      value={scrapReason}
                      onChange={(e) => setScrapReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    منتجات فرعية مسترجعة (By-Products) إن وجدت:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: نخالة قابلة للبيع، قصاصات كرتون تدوير، بودرة ناعمة"
                    value={byProductsNote}
                    onChange={(e) => setByProductsNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Total Live Costing Calculation Card */}
              <div className="bg-[#0F2942] text-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
                <div>
                  <span className="text-xs text-blue-200 block">إجمالي تكلفة دفعة الإنتاج الصناعية:</span>
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
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد وترحيل أمر التصنيع
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUFACTURING SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <ManufacturingSettingsModal
          companyId={company.id}
          currentSettings={manufacturingSettings}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={(updated) => {
            setManufacturingSettings(updated);
            setIsSettingsModalOpen(false);
          }}
        />
      )}

      {/* PRINT PRODUCTION ORDER CARD (JOB TICKET) */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:backdrop-blur-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:border-none print:w-full print:m-0 print:p-0">
            {/* Control Bar (No Print) */}
            <div className="bg-[#0F2942] text-white p-4 sm:p-5 flex items-center justify-between no-print border-b border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">معاينة بطاقة أمر التشغيل والتصنيع (Job Ticket)</h3>
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

            {/* Printable Content */}
            <div className="p-6 sm:p-8 overflow-y-auto bg-white text-slate-900 space-y-6 print:p-0 print:overflow-visible" id="printable-production">
              {/* Header */}
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
                    بطاقة أمر تصنيع وتشغيل معتمدة
                  </div>
                  <p className="text-[11px] text-slate-600 font-mono font-bold">رقم الأمر: {selectedOrderForPrint.orderNumber}</p>
                  <p className="text-[11px] text-slate-500 font-bold">تاريخ التشغيل: {selectedOrderForPrint.date}</p>
                </div>
              </div>

              {/* Order Info Summary */}
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
                  <span className="font-bold text-slate-800 block">خط: {selectedOrderForPrint.millLine || 'خط الإنتاج الرئيسي'}</span>
                  <span className="text-slate-600 block">المشرف المسؤول: {selectedOrderForPrint.operatorName || 'مشرف الخط'}</span>
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

              {/* BOM Materials Consumed Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-800">تفاصيل المواد الخام والمكونات المستهلكة (BOM):</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5">المادة الخام / المكون</th>
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
                          {formatCurrency(
                            (selectedOrderForPrint.rawMaterials || []).reduce(
                              (acc, r) => acc + r.quantityRequired * r.unitCost,
                              0
                            ),
                            currency
                          )}
                        </td>
                      </tr>
                      {selectedOrderForPrint.overheadCost > 0 && (
                        <tr>
                          <td colSpan={5} className="p-2.5 text-left text-slate-600 font-bold">
                            مصاريف التشغيل والعمالة الإضافية:
                          </td>
                          <td className="p-2.5 text-left font-mono text-slate-800">
                            {formatCurrency(selectedOrderForPrint.overheadCost, currency)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td colSpan={5} className="p-2.5 text-left text-emerald-900 font-black">
                          إجمالي تكلفة أمر الإنتاج المعتمدة:
                        </td>
                        <td className="p-2.5 text-left font-mono text-emerald-900 font-black text-sm">
                          {formatCurrency(selectedOrderForPrint.totalProductionCost, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Scrap & By-Products summary if exists */}
              {(selectedOrderForPrint.scrapQuantity || selectedOrderForPrint.byProducts) && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 block">الهالك والفاقد المسجل:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {selectedOrderForPrint.scrapQuantity || 0} {selectedOrderForPrint.targetUnit} (
                      {selectedOrderForPrint.scrapPercentage || 0}%) - {selectedOrderForPrint.scrapReason || 'هالك تشغيل عادي'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">المنتجات الفرعية:</span>
                    <span className="text-slate-800 font-bold">
                      {selectedOrderForPrint.byProducts?.map((b) => b.itemNameAr).join('، ') || 'لا توجد منتجات فرعية'}
                    </span>
                  </div>
                </div>
              )}

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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    فحص الجودة والمطابقة المخبرية لأمر التشغيل ({currentIndustryMeta.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500">
                    رقم الأمر: {selectedOrderForQc.orderNumber} | {selectedOrderForQc.targetItemNameAr}
                  </p>
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
                  <span className="text-slate-500 block">خط الإنتاج:</span>
                  <span className="font-bold text-slate-800">{selectedOrderForQc.millLine || 'خط الإنتاج الرئيسي'}</span>
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
                    مرفوض ومعيب (Reject)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">مسؤول الفحص والمختبر:</label>
                <input
                  type="text"
                  value={qcInspector}
                  onChange={(e) => setQcInspector(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">تقرير التحليل المخبري والمطابقة:</label>
                <textarea
                  rows={3}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedQcForPrint({
                    order: selectedOrderForQc,
                    status: qcStatus,
                    inspector: qcInspector,
                    notes: qcNotes,
                    certNo: `COA-${selectedOrderForQc.orderNumber.replace('ORD-', '')}-${Date.now().toString().slice(-4)}`,
                    date: new Date().toISOString().split('T')[0],
                  });
                  setSelectedOrderForQc(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                معاينة وطباعة شهادة COA الرسمية
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
              <span className="text-xs font-black text-slate-700">
                شهادة التحليل المخبري وإذن الإطلاق النهائي (Certificate of Analysis COA)
              </span>
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
                  <p className="text-[11px] text-slate-500 font-mono">
                    {company.nameAr} - مختبر الرقابة وضبط الجودة الصناعية المعتمد
                  </p>
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
                    ? '✅ إذن إفراج رسمي - معتمد ومطابق للتداول والتوريد'
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
                  <span className="text-slate-500 block">خط الإنتاج:</span>
                  <span className="font-bold">{selectedQcForPrint.order.millLine || 'خط الإنتاج الرئيسي'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الكمية المعتمدة:</span>
                  <span className="font-black text-emerald-800">
                    {selectedQcForPrint.order.targetQuantity} {selectedQcForPrint.order.targetUnit}
                  </span>
                </div>
              </div>

              {/* Dynamic Test Specifications matching active industry */}
              <div className="space-y-2 text-xs">
                <h4 className="font-black text-slate-900">
                  نتائج التحليل المخبري والمطابقة (Laboratory Test Results) - المواصفة: {currentQcPreset.standardDoc}:
                </h4>
                <table className="w-full text-right border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2 border border-slate-300">المعيار الفني</th>
                      <th className="p-2 border border-slate-300">المواصفة القياسية المعتمدة</th>
                      <th className="p-2 border border-slate-300">النتيجة الفعلية للمختبر</th>
                      <th className="p-2 border border-slate-300 text-center">التقييم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentQcPreset.criteria.map((cr, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 font-bold">{cr.parameter}</td>
                        <td className="p-2 border border-slate-300">{cr.standardSpec}</td>
                        <td className="p-2 border border-slate-300 font-mono font-bold">{cr.actualResult}</td>
                        <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">مطابق</td>
                      </tr>
                    ))}
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
