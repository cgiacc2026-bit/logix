import React, { useState, useEffect } from 'react';
import { TenantCompanyRecord, SystemUser, CompanyProfile } from '../types.js';
import { JsonBackupRestoreModal } from './JsonBackupRestoreModal.js';
import {
  getAllCompaniesForSuperAdmin,
  updateCompanyStatus,
  registerCompany,
  setCurrentCompanyId,
  checkIsSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseCredentials,
  testSupabaseConnection,
  syncCompanyToSupabase,
  syncAllLocalCompaniesToSupabase,
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
  Layers,
  Key,
  Copy,
  Check,
  HelpCircle,
  Cpu,
  Globe
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
  const [selectedBackupCompany, setSelectedBackupCompany] = useState<{ id: string; name: string } | null>(null);

  // New Company Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('1234');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);

  // Cloud DB Modal state
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [cloudUrl, setCloudUrl] = useState<string>(getSupabaseConfig().url || 'https://gzoncsbxfdnfellspgke.supabase.co');
  const [cloudKey, setCloudKey] = useState<string>(getSupabaseConfig().key || '');
  const [isTestingCloud, setIsTestingCloud] = useState<boolean>(false);
  const [cloudTestResult, setCloudTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedInvoiceSql, setCopiedInvoiceSql] = useState<boolean>(false);

  const handleTestAndSaveCloud = async (save: boolean = false) => {
    setIsTestingCloud(true);
    setCloudTestResult(null);
    try {
      const res = await testSupabaseConnection(cloudUrl.trim(), cloudKey.trim());
      setCloudTestResult(res);
      if (res.success && save) {
        saveSupabaseCredentials(cloudUrl.trim(), cloudKey.trim());
        setActionMessage({
          type: 'success',
          text: 'تم تفعيل وربط قاعدة بيانات Supabase السحابية بنجاح! تم التحول إلى السحابة الدائمة.',
        });
        setTimeout(() => {
          fetchCompanies();
          setShowCloudModal(false);
        }, 1200);
      }
    } catch (err: any) {
      setCloudTestResult({
        success: false,
        message: err?.message || 'فشل فحص الاتصال',
      });
    } finally {
      setIsTestingCloud(false);
    }
  };

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

  const handleSyncAllCompanies = async () => {
    setIsSyncingAll(true);
    setActionMessage(null);
    try {
      const res = await syncAllLocalCompaniesToSupabase();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: res.message,
        });
        await fetchCompanies();
      } else {
        setActionMessage({
          type: 'error',
          text: res.message,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'فشل مزامنة الشركات',
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingleCompany = async (comp: TenantCompanyRecord) => {
    setSyncingCompanyId(comp.id);
    setActionMessage(null);
    try {
      const res = await syncCompanyToSupabase(comp);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: res.message,
        });
        await fetchCompanies();
      } else {
        setActionMessage({
          type: 'error',
          text: res.message,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'فشل المزامنة السحابية',
      });
    } finally {
      setSyncingCompanyId(null);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newOwnerEmail.trim()) return;

    setIsRegistering(true);
    setActionMessage(null);

    try {
      const res = await registerCompany(newCompanyName.trim(), newOwnerEmail.trim(), newPassword.trim(), 'active');
      if (res.success && res.data) {
        // Automatically activate this company since it was created by Super Admin
        await updateCompanyStatus(res.data.id, 'active');
        
        const cloudNote = res.savedToCloud
          ? 'وحفظها في قاعدة بيانات Supabase السحابية بنجاح 🟢'
          : res.cloudError
          ? `(حُفظت محلياً، تعذر الحفظ السحابي: ${res.cloudError}) 🟡`
          : 'في النظام المحلي (يمكنك مزامنتها مع السحابة بضغطة زر) 🟡';

        setActionMessage({
          type: res.savedToCloud ? 'success' : 'error',
          text: `تم إنشاء واعتماد شركة "${newCompanyName}" ${cloudNote}`,
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedBackupCompany({
                  id: 'company-alwaleed-client-003',
                  name: 'شركة مطحنة الوليد المتحدة ذ.م.م (شركة عميل مسجل)',
                })
              }
              className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="استعادة آخر شغل مدخل لمطحنة الوليد عبر ملف JSON"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>استعادة شغل مطحنة الوليد (JSON)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
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

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 block">قاعدة البيانات:</span>
                <button
                  type="button"
                  onClick={() => setShowCloudModal(true)}
                  className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                  title="إعداد وربط قاعدة Supabase السحابية"
                >
                  <Key className="w-3 h-3" />
                  <span>ربط وتفعيل السحابة</span>
                </button>
              </div>
              <span className={`text-xs font-bold flex items-center gap-1 mt-1 ${checkIsSupabaseConfigured() ? 'text-emerald-700' : 'text-amber-700'}`}>
                <Database className="w-3.5 h-3.5" />
                {checkIsSupabaseConfigured() ? '🟢 Supabase سحابي متصل' : '🟡 تخزين محلي مؤقت'}
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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={fetchCompanies}
                disabled={isLoading}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleSyncAllCompanies}
                disabled={isSyncingAll}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="مزامنة وحفظ جميع الشركات المحلية في قاعدة بيانات Supabase السحابية"
              >
                <Database className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'جاري المزامنة...' : 'مزامنة الشركات مع Supabase'}</span>
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
                          <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{comp.company_name}</span>
                            {comp.id === '00000000-0000-0000-0000-000000000001' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                المنشأة الفعلية المعتمدة
                              </span>
                            )}
                            {comp.id === '00000000-0000-0000-0000-000000000002' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                ديمو النظام (System Demo)
                              </span>
                            )}
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

                            <button
                              onClick={() => handleSyncSingleCompany(comp)}
                              disabled={syncingCompanyId === comp.id}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                              title="مزامنة وحفظ هذه الشركة في قاعدة Supabase السحابية"
                            >
                              <Database className={`w-3 h-3 text-sky-600 ${syncingCompanyId === comp.id ? 'animate-spin' : ''}`} />
                              <span>{syncingCompanyId === comp.id ? 'جاري الرفع...' : 'رفع للسحابة'}</span>
                            </button>

                            <button
                              onClick={() =>
                                setSelectedBackupCompany({
                                  id: comp.id,
                                  name: comp.company_name,
                                })
                              }
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                              title="استعادة آخر شغل مدخل أو تصفير أو تصدير بيانات المنشأة عبر ملف JSON"
                            >
                              <Database className="w-3 h-3 text-indigo-600" />
                              <span>استعادة / نسخ JSON</span>
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
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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

      {/* Cloud Database Connection Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    ربط وتفعيل قاعدة بيانات Supabase السحابية
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    حفظ ومزامنة بيانات الشركات والأصناف والمستخدمين سحابياً بدلاً من التخزين المحلي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCloudModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Non-coder visual instructions */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>طريقة الحصول على المفتاح في دقيقة واحدة (بدون خبرة برمجية):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800 leading-relaxed">
                <li>افتح لوحة مشروعك في Supabase (المشروع: <strong className="font-mono text-slate-900">gzoncsbxfdnfellspgke</strong>).</li>
                <li>من القائمة الجانبية اليسرى، اضغط على <strong>Project Settings ⚙️</strong> ثم اختر <strong>API</strong>.</li>
                <li>انسخ القيمة الموجودة تحت خانة <strong>Project API keys (anon / public)</strong>.</li>
                <li>الصق المفتاح في الحقل أدناه واضغط <strong>"فحص وحفظ السحابة"</strong>.</li>
              </ol>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">رابط المشروع السحابي (Project URL):</label>
                <input
                  type="text"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://gzoncsbxfdnfellspgke.supabase.co"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-left"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>مفتاح الوصول السحابي العام (Anon Public Key):</span>
                  <span className="text-[10px] text-slate-400 font-normal">يبدأ بـ eyJhbGciOi...</span>
                </label>
                <textarea
                  rows={3}
                  value={cloudKey}
                  onChange={(e) => setCloudKey(e.target.value)}
                  placeholder="الصق هنا مفتاح anon public key..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-[11px] text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-left"
                />
              </div>

              {/* Live Test Feedback */}
              {cloudTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    cloudTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {cloudTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{cloudTestResult.message}</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sqlScript = `-- ==============================================================================
-- سكريبت التحديث الآمن لهيكل جداول الفواتير والبنود في Supabase (Schema Fix)
-- Safe Schema Update Script for Invoices & Invoice Items (Multi-Tenancy & Integrity)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_number TEXT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    date DATE DEFAULT CURRENT_DATE,
    customer_id TEXT,
    customer_name TEXT,
    subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(18, 4) DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18, 4) DEFAULT 0,
    due_amount NUMERIC(18, 4) DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'POSTED',
    status TEXT DEFAULT 'POSTED',
    payment_method TEXT DEFAULT 'CREDIT',
    customer_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'POSTED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'POSTED';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CREDIT';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(18, 4) DEFAULT 0,
    item_snapshot JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 4) DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_items_invoices_cascade' 
          AND table_name = 'invoice_items'
    ) THEN
        BEGIN
            ALTER TABLE public.invoice_items 
            ADD CONSTRAINT fk_invoice_items_invoices_cascade 
            FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
        EXCEPTION
            WHEN others THEN NULL;
        END;
    END IF;
END $$;

ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sales_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'POSTED';
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS total_price NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS item_snapshot JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "invoices_full_access" ON public.invoices;
    CREATE POLICY "invoices_full_access" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "invoice_items_full_access" ON public.invoice_items;
    CREATE POLICY "invoice_items_full_access" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);
EXCEPTION 
    WHEN others THEN NULL;
END $$;

-- تمديد جدول الشركات وسندات vouchers وفهارس البحث السريع
ALTER TABLE IF EXISTS companies 
    ADD COLUMN IF NOT EXISTS cash_account_id TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_id TEXT,
    ADD COLUMN IF NOT EXISTS inventory_account_id TEXT,
    ADD COLUMN IF NOT EXISTS pnl_account_id TEXT,
    ADD COLUMN IF NOT EXISTS company_logo TEXT;

ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    voucher_type TEXT,
    amount NUMERIC DEFAULT 0,
    account_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_company_id ON items(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_id ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_items_name_search ON items(company_id, item_name);
CREATE INDEX IF NOT EXISTS idx_customers_name_search ON customers(company_id, name);`;
                    navigator.clipboard?.writeText(sqlScript);
                    setCopiedInvoiceSql(true);
                    setTimeout(() => setCopiedInvoiceSql(false), 2000);
                  }}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="نسخ كود تحديث جداول الفواتير (Schema Fix)"
                >
                  {copiedInvoiceSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-700" />}
                  <span>{copiedInvoiceSql ? 'تم نسخ كود الفواتير!' : 'كود إصلاح الفواتير (SQL)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `-- سكريبت إنشاء جداول LOGIX Cloud ERP في Supabase SQL Editor\n-- تجده كاملاً في ملف: supabase_accounting_safe_schema.sql بجذر المشروع`
                    );
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="نسخ سكريبت الجداول"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{copiedSql ? 'تم نسخ التنبيه' : 'المخطط الشامل'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestAndSaveCloud(false)}
                  disabled={isTestingCloud || !cloudKey.trim()}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingCloud ? 'animate-spin' : ''}`} />
                  <span>فحص الاتصال فقط</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestAndSaveCloud(true)}
                  disabled={isTestingCloud || !cloudKey.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 shadow-xs"
                >
                  <Key className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isTestingCloud ? 'جارٍ الفحص...' : 'فحص وحفظ السحابة فوراً'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* JSON Backup & Restore & Zero-Out Modal */}
      {selectedBackupCompany && (
        <JsonBackupRestoreModal
          isOpen={true}
          onClose={() => setSelectedBackupCompany(null)}
          currentCompanyId={selectedBackupCompany.id}
          currentCompanyName={selectedBackupCompany.name}
          isSuperAdmin={true}
          onDataRestored={() => {
            fetchCompanies();
            if (onSwitchCompany) {
              onSwitchCompany(selectedBackupCompany.id);
            }
          }}
        />
      )}
    </div>
  );
};
