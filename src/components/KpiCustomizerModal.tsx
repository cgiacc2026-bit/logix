import React, { useState } from 'react';
import {
  X,
  Check,
  RotateCcw,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Sparkles,
  Building,
  TrendingUp,
  DollarSign,
  Wallet,
  Scale,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Percent,
  Layers,
  ArrowUpDown,
  Grid3X3,
  LayoutGrid
} from 'lucide-react';

export interface KpiCardDefinition {
  id: string;
  title: string;
  category: 'FINANCIAL' | 'OPERATIONS' | 'INVENTORY' | 'LIQUIDITY';
  description: string;
  iconName: string;
  defaultVisible: boolean;
  defaultOrder: number;
}

export interface KpiUserSettings {
  cardOrder: string[]; // List of card IDs in order
  hiddenCardIds: string[]; // List of hidden card IDs
  columns: 2 | 3 | 4;
}

export const ALL_AVAILABLE_KPIS: KpiCardDefinition[] = [
  {
    id: 'totalAssets',
    title: 'إجمالي الأصول',
    category: 'FINANCIAL',
    description: 'الأصول الثابتة والمتداولة والمخزون والأرصدة البنكية',
    iconName: 'Building',
    defaultVisible: true,
    defaultOrder: 1,
  },
  {
    id: 'netProfit',
    title: 'صافي أرباح الفترة',
    category: 'FINANCIAL',
    description: 'الفائض المالي بعد خصم تكلفة البضاعة والمصروفات التشغيلية',
    iconName: 'TrendingUp',
    defaultVisible: true,
    defaultOrder: 2,
  },
  {
    id: 'totalRevenue',
    title: 'إجمالي الإيرادات',
    category: 'FINANCIAL',
    description: 'مجموع مبيعات البهارات والمنتجات والخدمات التشغيلية',
    iconName: 'DollarSign',
    defaultVisible: true,
    defaultOrder: 3,
  },
  {
    id: 'cashAndBankBalance',
    title: 'رصيد النقدية والبنوك',
    category: 'LIQUIDITY',
    description: 'السيولة النقدية المتوفرة في الصناديق والحسابات المصرفية',
    iconName: 'Wallet',
    defaultVisible: true,
    defaultOrder: 4,
  },
  {
    id: 'totalLiabilities',
    title: 'إجمالي الالتزامات (الخصوم)',
    category: 'FINANCIAL',
    description: 'مستحقات الموردين والديون قصيرة وطويلة الأجل',
    iconName: 'Scale',
    defaultVisible: true,
    defaultOrder: 5,
  },
  {
    id: 'netAssets',
    title: 'صافي حقوق الملكية (رأس المال العامل)',
    category: 'FINANCIAL',
    description: 'إجمالي الأصول مطروحاً منها كافة الالتزامات والمستحقات',
    iconName: 'Scale',
    defaultVisible: true,
    defaultOrder: 6,
  },
  {
    id: 'accountsReceivable',
    title: 'ذمم العملاء والجمعيات (المدينة)',
    category: 'OPERATIONS',
    description: 'حقوق التحصيل وفواتير المبيعات الآجلة المستحقة',
    iconName: 'FileSpreadsheet',
    defaultVisible: true,
    defaultOrder: 7,
  },
  {
    id: 'accountsPayable',
    title: 'مستحقات الموردين (الدائنة)',
    category: 'OPERATIONS',
    description: 'فواتير مشتريات المواد الخام والبهارات الآجلة',
    iconName: 'Wallet',
    defaultVisible: true,
    defaultOrder: 8,
  },
  {
    id: 'inventoryValuation',
    title: 'إجمالي تقييم المخزون',
    category: 'INVENTORY',
    description: 'القيمة المالية للمواد الخام والبهارات التامة بالمستودعات',
    iconName: 'Package',
    defaultVisible: true,
    defaultOrder: 9,
  },
  {
    id: 'solvencyRatio',
    title: 'مؤشر الملاءة وتغطية الالتزامات',
    category: 'LIQUIDITY',
    description: 'نسبة تغطية الأصول للالتزامات والديون المالية',
    iconName: 'Percent',
    defaultVisible: true,
    defaultOrder: 10,
  },
  {
    id: 'lowStockAlert',
    title: 'تنبيهات حد إعادة الطلب',
    category: 'INVENTORY',
    description: 'عدد الأصناف المقاربة على النفاد بالمستودع',
    iconName: 'AlertTriangle',
    defaultVisible: true,
    defaultOrder: 11,
  },
  {
    id: 'unpaidInvoices',
    title: 'فواتير المبيعات غير المحصلة',
    category: 'OPERATIONS',
    description: 'فواتير العملاء قيد الانتظار أو السداد الجزئي',
    iconName: 'FileSpreadsheet',
    defaultVisible: true,
    defaultOrder: 12,
  },
];

export const DEFAULT_KPI_SETTINGS: KpiUserSettings = {
  cardOrder: ALL_AVAILABLE_KPIS.map(k => k.id),
  hiddenCardIds: ['solvencyRatio', 'lowStockAlert', 'unpaidInvoices', 'netAssets'], // By default show top 8 cards
  columns: 4,
};

interface KpiCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: KpiUserSettings;
  onSaveSettings: (newSettings: KpiUserSettings) => void;
}

export const KpiCustomizerModal: React.FC<KpiCustomizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [currentOrder, setCurrentOrder] = useState<string[]>(settings.cardOrder || DEFAULT_KPI_SETTINGS.cardOrder);
  const [hiddenIds, setHiddenIds] = useState<string[]>(settings.hiddenCardIds || DEFAULT_KPI_SETTINGS.hiddenCardIds);
  const [columns, setColumns] = useState<2 | 3 | 4>(settings.columns || 4);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  // Move card up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...currentOrder];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;
    setCurrentOrder(newOrder);
  };

  // Move card down
  const handleMoveDown = (index: number) => {
    if (index === currentOrder.length - 1) return;
    const newOrder = [...currentOrder];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;
    setCurrentOrder(newOrder);
  };

  // Toggle Visibility
  const handleToggleVisibility = (id: string) => {
    if (hiddenIds.includes(id)) {
      setHiddenIds(hiddenIds.filter(hid => hid !== id));
    } else {
      // Don't allow hiding all cards
      if (currentOrder.length - hiddenIds.length <= 1) {
        return;
      }
      setHiddenIds([...hiddenIds, id]);
    }
  };

  // Presets
  const applyPreset = (presetType: 'DEFAULT' | 'ALL' | 'FINANCIAL' | 'OPERATIONAL') => {
    if (presetType === 'DEFAULT') {
      setCurrentOrder(DEFAULT_KPI_SETTINGS.cardOrder);
      setHiddenIds(DEFAULT_KPI_SETTINGS.hiddenCardIds);
      setColumns(4);
    } else if (presetType === 'ALL') {
      setCurrentOrder(ALL_AVAILABLE_KPIS.map(k => k.id));
      setHiddenIds([]);
      setColumns(4);
    } else if (presetType === 'FINANCIAL') {
      const financialIds = ['totalAssets', 'netProfit', 'totalRevenue', 'totalLiabilities', 'netAssets', 'cashAndBankBalance'];
      const otherIds = ALL_AVAILABLE_KPIS.map(k => k.id).filter(id => !financialIds.includes(id));
      setCurrentOrder([...financialIds, ...otherIds]);
      setHiddenIds(otherIds);
      setColumns(3);
    } else if (presetType === 'OPERATIONAL') {
      const opIds = ['inventoryValuation', 'accountsReceivable', 'accountsPayable', 'lowStockAlert', 'unpaidInvoices', 'cashAndBankBalance'];
      const otherIds = ALL_AVAILABLE_KPIS.map(k => k.id).filter(id => !opIds.includes(id));
      setCurrentOrder([...opIds, ...otherIds]);
      setHiddenIds(otherIds);
      setColumns(3);
    }
  };

  const handleSave = () => {
    onSaveSettings({
      cardOrder: currentOrder,
      hiddenCardIds: hiddenIds,
      columns,
    });
    onClose();
  };

  const visibleCount = currentOrder.length - hiddenIds.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Modal Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-2xl text-cyan-300">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                تخصيص وترتيب بطاقات المؤشرات (Dashboard KPIs)
                <span className="text-xs bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 px-2.5 py-0.5 rounded-full font-bold">
                  {visibleCount} بطاقات معروضة
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                حدد المؤشرات المالية والتشغيلية التي تريد إظهارها في لوحة التحكم ورتبها حسب أولوياتك
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Toolbar & Presets */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500">القوالب الجاهزة:</span>
            <button
              type="button"
              onClick={() => applyPreset('DEFAULT')}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg font-bold text-slate-700 transition-colors cursor-pointer"
            >
              الافتراضي
            </button>
            <button
              type="button"
              onClick={() => applyPreset('ALL')}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg font-bold text-slate-700 transition-colors cursor-pointer"
            >
              إظهار الكل ({ALL_AVAILABLE_KPIS.length})
            </button>
            <button
              type="button"
              onClick={() => applyPreset('FINANCIAL')}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-bold transition-colors cursor-pointer"
            >
              التركيز المالي
            </button>
            <button
              type="button"
              onClick={() => applyPreset('OPERATIONAL')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold transition-colors cursor-pointer"
            >
              التركيز التشغيلي والمخزون
            </button>
          </div>

          {/* Grid Layout Selector */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">تخطيط الشبكة:</span>
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setColumns(2)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  columns === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عمودان (كبير)
              </button>
              <button
                type="button"
                onClick={() => setColumns(3)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  columns === 3 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ٣ أعمدة
              </button>
              <button
                type="button"
                onClick={() => setColumns(4)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  columns === 4 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ٤ أعمدة (قياسي)
              </button>
            </div>
          </div>
        </div>

        {/* Modal List of Cards with Reordering & Visibility Toggles */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2 bg-slate-100/60">
          <div className="text-xs text-slate-500 font-bold mb-3 flex items-center justify-between">
            <span>اسحب أو استخدم أسهم الترتيب لتغيير موضع البطاقة في لوحة التحكم:</span>
            <span>انقر على الأيقونة للتبديل بين الإظهار والإخفاء</span>
          </div>

          <div className="space-y-2">
            {currentOrder.map((cardId, index) => {
              const cardDef = ALL_AVAILABLE_KPIS.find(k => k.id === cardId);
              if (!cardDef) return null;
              const isVisible = !hiddenIds.includes(cardId);

              const categoryBadgeColors = {
                FINANCIAL: 'bg-blue-50 text-blue-700 border-blue-200',
                OPERATIONS: 'bg-amber-50 text-amber-800 border-amber-200',
                INVENTORY: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                LIQUIDITY: 'bg-purple-50 text-purple-800 border-purple-200',
              }[cardDef.category];

              const categoryLabel = {
                FINANCIAL: 'مالي',
                OPERATIONS: 'تشغيلي',
                INVENTORY: 'مخزون',
                LIQUIDITY: 'سيولة ونقدية',
              }[cardDef.category];

              return (
                <div
                  key={cardDef.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isVisible
                      ? 'bg-white border-slate-200 shadow-xs hover:border-blue-300'
                      : 'bg-slate-100/90 border-slate-200 opacity-60'
                  }`}
                >
                  {/* Card Order Number & Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                        isVisible ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-300 text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-black text-xs ${isVisible ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                          {cardDef.title}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${categoryBadgeColors}`}>
                          {categoryLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {cardDef.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions: Reordering Arrows & Visibility Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        index === 0
                          ? 'opacity-30 border-transparent text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700 hover:text-blue-700'
                      }`}
                      title="تحريك للأعلى"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === currentOrder.length - 1}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        index === currentOrder.length - 1
                          ? 'opacity-30 border-transparent text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700 hover:text-blue-700'
                      }`}
                      title="تحريك للأسفل"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>

                    {/* Visibility Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(cardDef.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isVisible
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-300'
                      }`}
                    >
                      {isVisible ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>معروضة</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>مخفية</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => applyPreset('DEFAULT')}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة ضبط للافتراضي</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتطبيق الإعدادات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
