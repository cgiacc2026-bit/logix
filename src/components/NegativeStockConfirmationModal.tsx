import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, X, FileWarning } from 'lucide-react';

export interface DeficitItem {
  itemId: string;
  itemNameAr: string;
  itemSku?: string;
  availableQty: number;
  requestedQty: number;
  unit: string;
}

interface NegativeStockConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  deficitItems: DeficitItem[];
  userRole: string; // 'ADMIN' | 'GENERAL_MANAGER' | 'SALES_MANAGER' | ...
  userName: string;
}

export const NegativeStockConfirmationModal: React.FC<NegativeStockConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  deficitItems,
  userRole,
  userName,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // التحقق من أن المستخدم يمتلك صلاحية استثنائية معتمدة للبيع تحت الصفر
  const isAuthorized = ['ADMIN', 'GENERAL_MANAGER', 'SALES_MANAGER', 'CHIEF_ACCOUNTANT'].includes(userRole);

  const handleConfirm = () => {
    if (!reason || reason.trim().length < 10) {
      setError('الرجاء كتابة سبب إداري واضح ومفصل (10 أحرف على الأقل) لاعتماد البيع بالسالب.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-right dir-rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-300 animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800 p-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/30 flex items-center justify-center border border-amber-300/40">
              <AlertTriangle className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">تنبيه تجاوز رصيد المخزون (بيع بالسالب)</h3>
              <p className="text-[11px] text-amber-150 opacity-90">نظام الرقابة والتفويض الإداري المسبق (Backorder Control)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="flex items-start gap-2 text-slate-700 font-bold bg-amber-50/80 p-3 rounded-xl border border-amber-200">
            <FileWarning className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              الكميات المطلوبة في هذه الفاتورة تتجاوز الرصيد الفعلي الموجود في المستودعات حالياً للأصناف الموضحة أدناه:
            </p>
          </div>

          {/* Table of Deficit Items */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 flex justify-between">
              <span>الصنف</span>
              <span>(المتوفر / المطلوب) → العجز</span>
            </div>
            <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
              {deficitItems.map((item) => {
                const deficit = item.requestedQty - item.availableQty;
                return (
                  <div
                    key={item.itemId}
                    className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200/60 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{item.itemNameAr}</span>
                      {item.itemSku && <span className="text-[10px] text-slate-400 font-mono mr-1.5">[{item.itemSku}]</span>}
                    </div>
                    <div className="font-mono text-left font-bold">
                      <span className="text-slate-600 font-normal">متاح: {item.availableQty}</span>
                      <span className="mx-1 text-slate-400">/</span>
                      <span className="text-slate-900">مطلوب: {item.requestedQty}</span>
                      <span className="text-red-600 mr-2 font-black">(-{deficit} {item.unit})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Authorization Check */}
          {!isAuthorized ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1.5 font-bold">
              <p className="flex items-center gap-1.5 text-red-700 font-black">
                <span>⛔</span> ليس لديك الصلاحية لاعتماد البيع تحت الصفر
              </p>
              <p className="text-[11px] font-normal leading-relaxed text-red-600">
                المنع الافتراضي مفعل لضمان سلامة المخزون والتكلفة. يرجى مراجعة إدارة المبيعات أو المدير العام أو المحاسب الرئيسي لاعتماد الفاتورة.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  أنت مؤهل إدارياً ({userRole}) للموافقة على البيع بالسالب وتسجيل العملية رسمياً باسمك ({userName}).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  سبب الاستثناء والبيع تحت الصفر * <span className="text-red-600 font-normal">(إلزامي للرقابة والتدقيق - لا يقل عن 10 أحرف)</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="مثال: طلبية عاجلة لعميل استراتيجي - جارٍ استلام شحنة القمح من المورد وسيتم الإنتاج اليوم..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 focus:bg-white resize-none shadow-2xs"
                />
                {error && <p className="text-xs text-red-600 font-bold mt-1">{error}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            إلغاء والتراجع
          </button>

          {isAuthorized && (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-amber-200" />
              اعتماد الفاتورة والبيع بالسالب
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
