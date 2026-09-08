import React, { useState, useEffect } from 'react';
import { SystemUser, UserRole } from '../types';
import { DataService } from '../services/dataService.ts';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  UserCheck,
  Lock,
  Search,
  Building,
  Check
} from 'lucide-react';

interface UsersViewProps {
  currentUser?: SystemUser;
  setCurrentUser?: (user: SystemUser) => void;
}

const DEFAULT_ACTIVE_USER: SystemUser = {
  id: 'usr-admin-01',
  name: 'مودي جميل',
  username: 'alwaleed',
  email: 'admin@alwaleed.com.kw',
  role: 'ADMIN',
  roleTitleAr: 'المدير العام والتنفيذي',
  isActive: true,
  createdAt: '2026-01-01T08:00:00.000Z',
  pinCode: '1234',
};

const ROLE_PRESETS: Record<UserRole, { title: string; desc: string; badgeColor: string }> = {
  ADMIN: {
    title: 'مدير النظام التنفيذي',
    desc: 'صلاحيات مطلقة: إنشاء الشركة، إدارة المستخدمين، التعديل الحذف، والترحيل المالي.',
    badgeColor: 'bg-[#9E2A2B] text-white',
  },
  CHIEF_ACCOUNTANT: {
    title: 'محاسب رئيسي',
    desc: 'صلاحيات كاملة على القيود، الاعتماد المالي، القوائم المالية، الحذف والتعديل.',
    badgeColor: 'bg-[#1A1A1A] text-white',
  },
  ACCOUNTANT: {
    title: 'محاسب عام',
    desc: 'إدخال القيود، إنشاء الفواتير والسندات، طباعة التارير وتعديل المسودات.',
    badgeColor: 'bg-[#2D5A27] text-white',
  },
  SALES: {
    title: 'مسؤول مبيعات',
    desc: 'إنشاء وطباعة فواتير المبيعات، البحث في الأصناف، وعرض بيانات العملاء فقط.',
    badgeColor: 'bg-[#1D3557] text-white',
  },
  AUDITOR: {
    title: 'مدقق ومراجع حسابات',
    desc: 'صلاحية قراءة وفحص واستخراج التقارير والقوائم المالية (دون تعديل أو حذف).',
    badgeColor: 'bg-[#7F5539] text-white',
  },
};

export const UsersView: React.FC<UsersViewProps> = ({ currentUser, setCurrentUser }) => {
  const [internalActiveUser, setInternalActiveUser] = useState<SystemUser>(currentUser || DEFAULT_ACTIVE_USER);
  const activeUser = currentUser || internalActiveUser;

  const setActiveUser = (user: SystemUser) => {
    setInternalActiveUser(user);
    if (setCurrentUser) {
      setCurrentUser(user);
    }
  };

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<UserRole>('ACCOUNTANT');
  const [roleTitleAr, setRoleTitleAr] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('1234');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Pin authentication modal
  const [pinModalUser, setPinModalUser] = useState<SystemUser | null>(null);
  const [inputPin, setInputPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await DataService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setRole('ACCOUNTANT');
    setRoleTitleAr('محاسب عام');
    setPinCode('1234');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || '');
    setRole(user.role);
    setRoleTitleAr(user.roleTitleAr);
    setPinCode(user.pinCode || '1234');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username) {
      setErrorMsg('يرجى ملء كافة الحقول الإلزامية');
      return;
    }

    try {
      const payload: SystemUser = {
        id: editingUser ? editingUser.id : 'usr-' + Math.random().toString(36).substr(2, 9),
        name,
        username,
        email,
        role,
        roleTitleAr: roleTitleAr || ROLE_PRESETS[role].title,
        pinCode,
        isActive: true,
        createdAt: editingUser?.createdAt || new Date().toISOString(),
      };

      await DataService.saveUser(payload);
      setSuccessMsg(editingUser ? 'تم تحديث بيانات المستخدم بنجاح' : 'تم إضافة المستخدم الجديد بنجاح');
      setIsModalOpen(false);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ بيانات المستخدم');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === activeUser.id) {
      alert('لا يمكنك حذف الحساب النشط الحالي. يرجى التبديل لمستخدم آخر أولاً.');
      return;
    }
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذا المستخدم من النظام؟')) return;

    try {
      await DataService.deleteUser(id);
      setSuccessMsg('تم حذف المستخدم بنجاح');
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء حذف المستخدم');
    }
  };

  const handleSwitchUserPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;
    if (pinModalUser.pinCode && inputPin !== pinModalUser.pinCode) {
      setPinError('رمز الـ PIN غير صحيح! جرب 1234 أو الرمز المحدد لهذا المستخدم');
      return;
    }
    setActiveUser(pinModalUser);
    setPinModalUser(null);
    setInputPin('');
    setPinError('');
    setSuccessMsg(`تم تسجيل الدخول بنجاح بصلاحية: ${pinModalUser.name} (${pinModalUser.roleTitleAr})`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.roleTitleAr.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 dir-rtl text-right">
      {/* Top Banner & Current User Card */}
      <div className="bg-gradient-to-r from-[#1A1A1A] via-[#2A2A2A] to-[#1A1A1A] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-[#333]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-bold tracking-tight">إدارة المستخدمين والأدوار والتحكم بالدخول</h1>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
            توفير نظام تحكم صلاحيات متعدد المستويات متوافق مع الحوكمة المالية وحوكمة الشركات (RBAC)، يتيح تسجيل دخول وتأكيد بالرمز السري (PIN) مع حماية التعديل والحذف.
          </p>
        </div>

        {/* Current Active Account Card */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#1A1A1A] font-bold text-lg flex items-center justify-center shadow-md">
            {activeUser.name.charAt(0)}
          </div>
          <div>
            <div className="text-xs text-[#D4AF37] font-semibold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              المستخدم النشط حالياً
            </div>
            <div className="text-base font-bold text-white">{activeUser.name}</div>
            <div className="text-xs text-neutral-300">{activeUser.roleTitleAr}</div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-3 text-[#8C8273]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، اسم المستخدم، أو الدور..."
            className="w-full pr-9 pl-4 py-2 bg-white border border-[#E5E1DA] rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D4AF37] outline-none"
          />
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <UserPlus className="w-4 h-4 text-[#D4AF37]" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#8C8273] text-sm">جاري تحميل مستخدمي النظام...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((u) => {
            const isCurrent = u.id === activeUser.id;
            const preset = ROLE_PRESETS[u.role] || ROLE_PRESETS.ACCOUNTANT;

            return (
              <div
                key={u.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                  isCurrent ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-[#E5E1DA] hover:border-[#1A1A1A]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F7F5F0] border border-[#E5E1DA] text-[#1A1A1A] font-bold flex items-center justify-center text-sm shadow-xs">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5">
                          {u.name}
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-[10px] bg-[#D4AF37] text-black font-extrabold rounded-full">
                              أنت
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#8C8273]">@{u.username}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${preset.badgeColor}`}>
                      {u.roleTitleAr}
                    </span>
                  </div>

                  <p className="text-xs text-[#6E6659] leading-relaxed mb-4 bg-[#F9F8F6] p-3 rounded-lg border border-[#E5E1DA]/60">
                    {preset.desc}
                  </p>

                  <div className="space-y-1.5 text-xs text-[#6E6659] mb-5">
                    <div className="flex items-center justify-between">
                      <span>البريد الإلكتروني:</span>
                      <span className="font-semibold text-[#1A1A1A]">{u.email || 'غير مسجل'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>رمز الدخول PIN:</span>
                      <span className="font-semibold text-[#1A1A1A]">•••• ({u.pinCode || '1234'})</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E1DA] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setPinModalUser(u);
                      setInputPin('');
                      setPinError('');
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : 'bg-[#F7F5F0] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] border border-[#E5E1DA]'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isCurrent ? 'الحساب النشط' : 'تبديل الحساب'}
                  </button>

                  <button
                    onClick={() => openEditModal(u)}
                    className="p-1.5 text-[#6E6659] hover:text-[#1A1A1A] hover:bg-[#F7F5F0] rounded-lg transition-all"
                    title="تعديل المستخدم"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {!isCurrent && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RBAC Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-[#E5E1DA] p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2 border-b border-[#E5E1DA] pb-3">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          جدول مصفوفة الصلاحيات والحوكمة في النظام (RBAC)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#F7F5F0] text-[#1A1A1A] border-b border-[#E5E1DA]">
                <th className="p-3 font-bold">الوظيفة / الصلاحية</th>
                <th className="p-3 font-bold text-center">مدير النظام (Admin)</th>
                <th className="p-3 font-bold text-center">محاسب رئيسي</th>
                <th className="p-3 font-bold text-center">محاسب عام</th>
                <th className="p-3 font-bold text-center">مسؤول مبيعات</th>
                <th className="p-3 font-bold text-center">مدقق ومراجع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1DA]">
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">تأسيس وإعداد بيانات الشركة</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">إنشاء وتعديل الأصناف والمخزون</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">إصدار وتعديل وطباعة الفواتير والسندات</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">الترحيل المالي للقيود والفواتير</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">حذف القيود والفواتير غير المرحّلة</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-[#1A1A1A]">استخراج واستعراض القوائم والتقارير المالية</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-rose-500 font-bold"><XCircle className="w-4 h-4 mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E1DA] dir-rtl text-right space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
              <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد للنظام'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C8273] hover:text-[#1A1A1A] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: د. محمد بن عبد الله"
                  className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">اسم المستخدم *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: m.abdullah"
                    className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#1A1A1A] font-bold mb-1">رمز السر PIN (4 أرقام) *</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="1234"
                    className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg font-mono text-center text-sm font-bold focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@domain.sa"
                  className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">دور الوظيفة بالنظام *</label>
                <select
                  value={role}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setRole(r);
                    setRoleTitleAr(ROLE_PRESETS[r].title);
                  }}
                  className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg font-semibold focus:ring-2 focus:ring-[#D4AF37] outline-none"
                >
                  <option value="ADMIN">مدير النظام (Admin)</option>
                  <option value="CHIEF_ACCOUNTANT">محاسب رئيسي (Chief Accountant)</option>
                  <option value="ACCOUNTANT">محاسب عام (Accountant)</option>
                  <option value="SALES">مسؤول مبيعات (Sales Officer)</option>
                  <option value="AUDITOR">مدقق حسابات (Auditor)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#1A1A1A] font-bold mb-1">المسمى الوظيفي بالعربي</label>
                <input
                  type="text"
                  value={roleTitleAr}
                  onChange={(e) => setRoleTitleAr(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1A1A1A] text-white font-bold rounded-lg hover:bg-black shadow-sm cursor-pointer"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch User PIN Modal */}
      {pinModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#E5E1DA] dir-rtl text-right space-y-4 text-xs animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-[#F7F5F0] rounded-full mx-auto flex items-center justify-center text-[#1A1A1A] font-bold text-lg border border-[#E5E1DA]">
                {pinModalUser.name.charAt(0)}
              </div>
              <h3 className="text-sm font-bold text-[#1A1A1A]">تبديل الحساب إلى: {pinModalUser.name}</h3>
              <p className="text-[#8C8273]">{pinModalUser.roleTitleAr}</p>
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[11px] font-semibold text-center">
                {pinError}
              </div>
            )}

            <form onSubmit={handleSwitchUserPin} className="space-y-4">
              <div>
                <label className="block text-[#1A1A1A] font-bold text-center mb-1">
                  أدخل رمز PIN السري للتحقق
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-lg font-bold p-3 bg-[#F9F8F6] border border-[#E5E1DA] rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                />
                <p className="text-[10px] text-[#8C8273] text-center mt-1">
                  (الرمز الافتراضي لهذا الحساب: {pinModalUser.pinCode || '1234'})
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="flex-1 py-2 border border-[#E5E1DA] text-[#6E6659] rounded-lg hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#1A1A1A] text-white font-bold rounded-lg hover:bg-black shadow-sm cursor-pointer flex items-center justify-center gap-1"
                >
                  <Lock className="w-3.5 h-3.5" />
                  دخول الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
