import React, { useState } from 'react';
import {
  ManufacturingIndustryType,
  ManufacturingStandardSettings,
  StandardCategoryDefinition,
  StandardLineDefinition,
} from '../types.js';
import { INDUSTRY_METADATA_LIST } from '../data/manufacturingProfiles.ts';
import { DataService, DEFAULT_MANUFACTURING_PROFILES } from '../services/dataService.ts';
import {
  X,
  CheckCircle2,
  Plus,
  Trash2,
  Sliders,
  Factory,
  Layers,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

interface ManufacturingSettingsModalProps {
  companyId: string;
  currentSettings: ManufacturingStandardSettings;
  onClose: () => void;
  onSave: (updatedSettings: ManufacturingStandardSettings) => void;
}

export const ManufacturingSettingsModal: React.FC<ManufacturingSettingsModalProps> = ({
  companyId,
  currentSettings,
  onClose,
  onSave,
}) => {
  const [selectedIndustry, setSelectedIndustry] = useState<ManufacturingIndustryType>(
    currentSettings.industryType || 'FOOD_MILLING'
  );
  const [categories, setCategories] = useState<StandardCategoryDefinition[]>(
    currentSettings.standardCategories || []
  );
  const [lines, setLines] = useState<StandardLineDefinition[]>(
    currentSettings.standardLines || []
  );
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'categories' | 'lines'>('profile');

  // Form states for adding new category
  const [newCatNameAr, setNewCatNameAr] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatType, setNewCatType] = useState<'INPUT' | 'OUTPUT'>('INPUT');

  // Form states for adding new line
  const [newLineNameAr, setNewLineNameAr] = useState('');
  const [newLineNameEn, setNewLineNameEn] = useState('');
  const [newLineDesc, setNewLineDesc] = useState('');

  // Handle industry change & offer to load its standard defaults
  const handleSelectIndustry = (newInd: ManufacturingIndustryType) => {
    setSelectedIndustry(newInd);
    const defaults = DEFAULT_MANUFACTURING_PROFILES[newInd];
    if (defaults) {
      setCategories(defaults.standardCategories);
      setLines(defaults.standardLines);
    }
  };

  const handleResetToDefaults = () => {
    const defaults = DEFAULT_MANUFACTURING_PROFILES[selectedIndustry];
    if (defaults) {
      setCategories(defaults.standardCategories);
      setLines(defaults.standardLines);
    }
  };

  const handleAddCategory = () => {
    if (!newCatNameAr.trim()) return;
    const newCat: StandardCategoryDefinition = {
      id: `cat-custom-${Date.now()}`,
      nameAr: newCatNameAr.trim(),
      nameEn: newCatNameEn.trim() || undefined,
      type: newCatType,
    };
    setCategories([...categories, newCat]);
    setNewCatNameAr('');
    setNewCatNameEn('');
  };

  const handleRemoveCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
  };

  const handleAddLine = () => {
    if (!newLineNameAr.trim()) return;
    const newLine: StandardLineDefinition = {
      id: `line-custom-${Date.now()}`,
      nameAr: newLineNameAr.trim(),
      nameEn: newLineNameEn.trim() || undefined,
      description: newLineDesc.trim() || undefined,
    };
    setLines([...lines, newLine]);
    setNewLineNameAr('');
    setNewLineNameEn('');
    setNewLineDesc('');
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleSaveAll = async () => {
    const updated: ManufacturingStandardSettings = {
      industryType: selectedIndustry,
      standardCategories: categories,
      standardLines: lines,
      standardWorkstations: currentSettings.standardWorkstations || [],
    };
    await DataService.saveManufacturingSettings(companyId, updated);
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0F2942] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-cyan-300">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                إدارة المعايير والمجموعات وخطوط الإنتاج القياسية
              </h3>
              <p className="text-xs text-slate-300">
                تخصيص القوائم المنسدلة الثابتة والقطاع الصناعي لكل شركة في النظام (Multi-Tenant)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 bg-slate-100 px-6 py-2 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('profile')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'profile'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>القطاع الصناعي وملف التصنيع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'categories'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>قوائم المجموعات والتصنيفات القياسية ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('lines')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'lines'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>قوائم خطوط ومحطات الإنتاج ({lines.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs bg-slate-50 flex-1">
          {/* TAB 1: INDUSTRY PROFILE SELECTOR */}
          {activeSubTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 text-blue-900">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm">تحديد النشاط والقطاع الصناعي للشركة:</h4>
                  <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                    اختيار القطاع الصناعي يقوم بتهيئة وتحديث القوائم المنسدلة القياسية (التصنيفات، خطوط الإنتاج، ومحطات التشغيل، ومعايير فحص الجودة COA) تلقائياً لتناسب نشاط شركتك بدقة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {INDUSTRY_METADATA_LIST.map((ind) => {
                  const isSelected = selectedIndustry === ind.id;
                  return (
                    <div
                      key={ind.id}
                      onClick={() => handleSelectIndustry(ind.id)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-white shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isSelected ? '✓ القطاع النشط حالياً' : 'انقر للتفعيل'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{ind.nameEn}</span>
                        </div>

                        <h4 className="text-sm font-black text-slate-900">{ind.nameAr}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{ind.subTitle}</p>

                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 block mb-1">أمثلة على المنتجات المصنعة:</span>
                          <div className="flex flex-wrap gap-1">
                            {ind.sampleFinishedGoods.map((g, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: STANDARDIZED CATEGORIES & GROUPS */}
          {activeSubTab === 'categories' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    المجموعات والتصنيفات القياسية (Standard Categories)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    هذه المجموعات تظهر في كافة القوائم المنسدلة بدلاً من الحقول النصية الحرة لضمان توحيد البيانات الصناعية.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  استعادة الافتراضيات
                </button>
              </div>

              {/* Add New Category Form */}
              <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3">
                <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  إضافة مجموعة أو تصنيف قياسي جديد للشركة:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      اسم المجموعة بالعربية *
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: خامات كيميائية فعالة، رولات ورق، مكونات SMD"
                      value={newCatNameAr}
                      onChange={(e) => setNewCatNameAr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      الاسم الإنجليزي (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="English Name"
                      value={newCatNameEn}
                      onChange={(e) => setNewCatNameEn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع التصنيف</label>
                    <div className="flex gap-2">
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none"
                      >
                        <option value="INPUT">مدخلات ومواد خام (Input)</option>
                        <option value="OUTPUT">مخرجات ومنتجات تامة (Output)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-xs cursor-pointer shrink-0"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم المجموعة والتصنيف</th>
                      <th className="p-3 font-mono">الاسم الفني / الإنجليزي</th>
                      <th className="p-3 text-center w-36">طبيعة الصنف</th>
                      <th className="p-3 text-center w-16">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{cat.nameAr}</td>
                        <td className="p-3 font-mono text-slate-500">{cat.nameEn || '-'}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              cat.type === 'INPUT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {cat.type === 'INPUT' ? 'مادة أولية / خام' : 'منتج تام / مخرج'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                            title="حذف من القائمة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STANDARDIZED PRODUCTION LINES */}
          {activeSubTab === 'lines' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    قوائم خطوط الإنتاج القياسية (Standard Production Lines)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تظهر هذه الخطوط في القوائم المنسدلة عند إصدار أوامر التشغيل وتوجيه الدفعات للمحطات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  استعادة الافتراضيات
                </button>
              </div>

              {/* Add New Line Form */}
              <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3">
                <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  إضافة خط إنتاج جديد للشركة:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم خط الإنتاج *</label>
                    <input
                      type="text"
                      placeholder="مثال: خط SMT الآلي، خط المفاعلات، خط التعبئة"
                      value={newLineNameAr}
                      onChange={(e) => setNewLineNameAr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      الاسم الفني / الإنجليزي (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="Line English Name"
                      value={newLineNameEn}
                      onChange={(e) => setNewLineNameEn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الوصف والمواصفات</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="طاقة وسرعة الخط أو المعدات"
                        value={newLineDesc}
                        onChange={(e) => setNewLineDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddLine}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-xs cursor-pointer shrink-0"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lines Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم خط الإنتاج</th>
                      <th className="p-3 font-mono">الاسم الفني</th>
                      <th className="p-3">الوصف والمواصفات</th>
                      <th className="p-3 text-center w-16">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{line.nameAr}</td>
                        <td className="p-3 font-mono text-slate-500">{line.nameEn || '-'}</td>
                        <td className="p-3 text-slate-600">{line.description || '-'}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                            title="حذف الخط"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>يتم حفظ وتطبيق التعديلات فورياً على مستوى حساب الشركة الحالية (Tenant-Isolated)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-300 cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              حفظ واعتماد التخصيص
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
