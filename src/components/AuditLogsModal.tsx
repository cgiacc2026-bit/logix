import React, { useState, useEffect } from 'react';
import { AuditLog, AuditLogAction, AuditLogEntityType } from '../types.js';
import { auditLogService } from '../services/auditLogService.js';
import {
  ShieldAlert,
  Search,
  Filter,
  X,
  Clock,
  UserCheck,
  Building2,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({ isOpen, onClose, companyId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');

  const reloadLogs = () => {
    const list = auditLogService.getLogs({
      company_id: companyId,
      action: selectedAction !== 'ALL' ? (selectedAction as AuditLogAction) : undefined,
      entity_type: selectedEntity !== 'ALL' ? (selectedEntity as AuditLogEntityType) : undefined,
      limit: 150,
    });
    setLogs(list);
  };

  useEffect(() => {
    if (isOpen) {
      reloadLogs();
    }
  }, [isOpen, selectedAction, selectedEntity, companyId]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.entity_reference && l.entity_reference.toLowerCase().includes(term)) ||
      (l.reason && l.reason.toLowerCase().includes(term)) ||
      (l.user_name && l.user_name.toLowerCase().includes(term)) ||
      (l.authorized_by && l.authorized_by.toLowerCase().includes(term)) ||
      l.action.toLowerCase().includes(term)
    );
  });

  const getActionBadge = (action: AuditLogAction) => {
    switch (action) {
      case 'VOID':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">إلغاء فاتورة VOID</span>;
      case 'REFUND':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">إرجاع / رد مالي</span>;
      case 'CREDIT_LIMIT_OVERRIDE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">تجاوز حد ائتماني</span>;
      case 'SUPERVISOR_AUTH':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">تفويض مشرف</span>;
      case 'DISCOUNT_APPLIED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">خصم خاص</span>;
      case 'SOFT_DELETE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">حذف منطقي ناعم</span>;
      case 'CASH_DRAWER_TRANSACTION':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">حركة درج النقدية</span>;
      case 'SESSION_OPEN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">فتح وردية كاشير</span>;
      case 'SESSION_CLOSE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">إغلاق وردية كاشير</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300">{action}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>سجل التدقيق والرقابة غير القابل للتعديل (Audit Log)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-900/50 text-purple-300 font-mono">Non-destructive</span>
              </h3>
              <p className="text-xs text-slate-400">
                تسجيل رقابي شامل لكافة العمليات الحساسة (إلغاء فواتير، تجاوز ائتمان، خصومات، حركات الدرج، وتفويضات المشرف)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 bg-slate-850 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث بالرقم المرجعي، السبب، أو المشرف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">جميع الإجراءات الرقابية</option>
            <option value="VOID">إلغاء فواتير (VOID)</option>
            <option value="REFUND">مرتجعات ورد مالي (REFUND)</option>
            <option value="CREDIT_LIMIT_OVERRIDE">تجاوز الحد الائتماني</option>
            <option value="SUPERVISOR_AUTH">تفويضات المشرفين</option>
            <option value="DISCOUNT_APPLIED">تطبيق خصومات خاصة</option>
            <option value="CASH_DRAWER_TRANSACTION">حركات الدرج (إيداع/سحب)</option>
            <option value="SESSION_OPEN">فتح الوردية</option>
            <option value="SESSION_CLOSE">إغلاق الوردية</option>
            <option value="SOFT_DELETE">الحذف المنطقي الناعم</option>
          </select>

          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">جميع الكيانات المستهدفة</option>
            <option value="INVOICE">فواتير البيع والشراء</option>
            <option value="POS_SALE">مبيعات الكاشير</option>
            <option value="CUSTOMER">العملاء والائتمان</option>
            <option value="ITEM">الأصناف والتسعير</option>
            <option value="POS_SESSION">ورديات نقاط البيع</option>
            <option value="CREDIT_NOTE">إشعارات الدائن</option>
          </select>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="text-sm font-medium">لا توجد سجلات مطابقة لمعايير البحث</p>
              <p className="text-xs text-slate-600 mt-1">يتم قيد كافة العمليات الاستثنائية تلقائياً وبأعلى معايير الشفافية</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      {log.entity_reference && (
                        <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                          {log.entity_reference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.created_at).toLocaleString('ar-KW')}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {log.reason}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">المنفذ:</span>
                      <span className="text-slate-300 font-semibold">{log.user_name}</span>
                    </div>
                    {log.authorized_by && (
                      <div className="flex items-center gap-1.5 text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>معتمد من المشرف: {log.authorized_by}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            إجمالي السجلات المسجلة: <span className="font-bold text-white font-mono">{filteredLogs.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
