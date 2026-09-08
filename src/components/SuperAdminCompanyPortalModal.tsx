import React, { useState, useEffect } from 'react';
import { TenantCompanyRecord, SystemUser, CompanyProfile } from '../types.js';
import {
  getAllCompaniesForSuperAdmin,
  updateCompanyStatus,
  registerCompany,
  setCurrentCompanyId,
  isSupabaseConfigured,
  getSupabaseConfig,
} from '../services/supabaseClient.ts';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Mail,
  User,
  Sparkles,
  X,
  Layers
} from 'lucide-react';

interface SuperAdminCompanyPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SystemUser;
  onSwitchCompany?: (companyId: string) => void;
}

export const SuperAdminCompanyPortalModal: React.FC<SuperAdminCompanyPortalModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSwitchCompany,
}) => {
  const [companies, setCompanies] = useState<TenantCompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Company Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('1234');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCompaniesForSuperAdmin();
      setCompanies(data);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
    }
  }, [isOpen]);

  const handleUpdateStatus = async (
    companyId: string,
    newStatus: 'active' | 'suspended' | 'pending' | 'rejected'
  ) => {
    try {
      const res = await updateCompanyStatus(companyId, newStatus);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: res.message || 'تم تحديث حالة الشركة بنجاح',
        });
        await fetchCompanies();
      } else {
        setActionMessage({
          type: 'error',
          text: res.message || 'فشل تحديث حالة الشركة',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء تحديث حالة الشركة',
      });
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newOwnerEmail.trim()) return;

    setIsRegistering(true);
    setActionMessage(null);

    try {
      const res = await registerCompany(newCompanyName.trim(), newOwnerEmail.trim(), newPassword.trim());
      if (res.success && res.data) {
        // Automatically activate this company since it was created by Super Admin
        await updateCompanyStatus(res.data.id, 'active');
        setActionMessage({
          type: 'success',
          text: `تم إنشاء واعتماد شركة "${newCompanyName}" بنجاح وتفعيلها في قاعدة البيانات!`,
        });
        setShowAddModal(false);
        setNewCompanyName('');
        setNewOwnerEmail('');
        await fetchCompanies();
      } else {
        setActionMessage({
          type: 'error',
          text: res.message || 'فشل إنشاء الشركة',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء إنشاء الشركة',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSwitch = (companyId: string) => {
    setCurrentCompanyId(companyId);
    if (onSwitchCompany) {
      onSwitchCompany(companyId);
    }
    onClose();
  };

  if (!isOpen) return null;

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = companies.filter((c) => c.status === 'pending').length;
  const activeCount = companies.filter((c) => c.status === 'active').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 flex items-center justify-between border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> بوابة المشرف العام (Super Admin Multi-Tenant Portal)
              </span>
              <span className="text-xs text-slate-300 font-mono">
                {currentUser?.email || 'cgiacc2026@gmail.com'}
              </span>
            </div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              لوحة اعتماد وتفعيل الشركات والمؤسسات السحابية
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              متابعة طلبات التسجيل السحابية وتفعيل الحسابات المعلقة فورياً لمنح الشركات الوصول للنظام
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`px-6 py-3 text-xs font-bold flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Controls & Stats */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block">إجمالي الشركات:</span>
              <span className="text-base font-black text-slate-900">{companies.length} شركة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-[11px] text-amber-700 font-bold block">بانتظار التفعيل (Pending):</span>
              <span className="text-base font-black text-amber-600">{pendingCount} طلب</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] text-emerald-700 font-bold block">مفعلة ونشطة (Active):</span>
              <span className="text-base font-black text-emerald-600">{activeCount} شركة</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block">قاعدة البيانات:</span>
              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 mt-1">
                <Database className="w-3.5 h-3.5" />
                {isSupabaseConfigured ? 'Supabase سحابي متصل' : 'تخزين محلي مؤقت'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث باسم الشركة أو بريد المالك..."
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                <option value="ALL">جميع الحالات ({companies.length})</option>
                <option value="pending">قيد التفعيل والمراجعة ({pendingCount})</option>
                <option value="active">الشركات المفعلة ({activeCount})</option>
                <option value="suspended">الشركات الموقوفة</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchCompanies}
                disabled={isLoading}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>إضافة وتفعيل شركة جديدة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Company List Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>جارٍ تحميل الشركات المسجلة...</span>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              لم يتم العثور على شركات مطابقة لمعايير البحث.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">اسم الشركة والمنشأة</th>
                    <th className="py-3 px-4">بريد المالك / المسؤول</th>
                    <th className="py-3 px-4">تاريخ التسجيل</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات المشرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((comp) => {
                    const isPending = comp.status === 'pending';
                    const isActive = comp.status === 'active';

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{comp.company_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{comp.id}</div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-700">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{comp.owner_email}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {comp.created_at ? new Date(comp.created_at).toLocaleDateString('ar-EG') : 'حديثاً'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px] inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> بانتظار التفعيل
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> نشطة ومفعلة
                            </span>
                          )}
                          {comp.status === 'suspended' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> معلقة / موقوفة
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPending && (
                              <button
                                onClick={() => handleUpdateStatus(comp.id, 'active')}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                title="تفعيل واعتماد الشركة"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تفعيل فوري</span>
                              </button>
                            )}

                            {isActive && (
                              <button
                                onClick={() => handleUpdateStatus(comp.id, 'suspended')}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs transition-all border border-amber-200 cursor-pointer"
                                title="تعليق حساب الشركة مؤقتاً"
                              >
                                تعليق
                              </button>
                            )}

                            {comp.status === 'suspended' && (
                              <button
                                onClick={() => handleUpdateStatus(comp.id, 'active')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-semibold text-xs transition-all border border-emerald-200 cursor-pointer"
                                title="إعادة تنشيط الشركة"
                              >
                                إعادة تنشيط
                              </button>
                            )}

                            <button
                              onClick={() => handleSwitch(comp.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                              title="التبديل إلى بيئة هذه الشركة"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>دخول</span>
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

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>حساب المشرف العام: cgiacc2026@gmail.com</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all border cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Add Company Submodal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                تسجيل وتفعيل منشأة جديدة مباشرة
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الشركة أو المؤسسة:</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="مثال: مطحنة الأمل للصناعات الغذائية"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني لمالك الشركة:</label>
                <input
                  type="email"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="owner@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور الافتراضية:</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isRegistering ? 'جارٍ الإنشاء...' : 'إنشاء وتفعيل الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
