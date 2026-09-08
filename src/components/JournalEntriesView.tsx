import React, { useState } from 'react';
import { Account, JournalEntry, JournalLine, Customer, Supplier } from '../types.js';
import { formatCurrency } from '../utils/formatters.ts';
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  Trash2,
  Info,
  Building,
  Check,
  Edit,
  Sparkles,
  RefreshCw,
  User,
  Building2,
  Link,
  Search,
} from 'lucide-react';

interface JournalEntriesProps {
  journals: JournalEntry[];
  accounts: Account[];
  customers?: Customer[];
  suppliers?: Supplier[];
  currency: string;
  onCreateJournal: (journalData: any) => Promise<void>;
  onUpdateJournal?: (id: string, journalData: any) => Promise<void>;
  onDeleteJournal?: (id: string) => Promise<void>;
  onRebuildOpeningJournal?: () => Promise<void>;
  onReverseJournal: (id: string, reason: string) => Promise<void>;
  companyName?: string;
}

interface FormLineState {
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
  entityType?: 'CUSTOMER' | 'SUPPLIER' | 'NONE';
  entityId?: string;
  entityNameAr?: string;
}

export const JournalEntriesView: React.FC<JournalEntriesProps> = ({
  journals,
  accounts,
  customers = [],
  suppliers = [],
  currency,
  onCreateJournal,
  onUpdateJournal,
  onDeleteJournal,
  onRebuildOpeningJournal,
  onReverseJournal,
  companyName = 'مطحنة الوليد المتحدة',
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [printJournal, setPrintJournal] = useState<JournalEntry | null>(null);
  const [isSyncingOpening, setIsSyncingOpening] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState('');

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<FormLineState[]>([
    { accountId: '', debit: 0, credit: 0, memo: '', entityType: 'NONE', entityId: '', entityNameAr: '' },
    { accountId: '', debit: 0, credit: 0, memo: '', entityType: 'NONE', entityId: '', entityNameAr: '' },
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reversal Prompt State
  const [reversingJournalId, setReversingJournalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Helper to detect if an account is a Customer or Supplier account
  const detectAccountEntityType = (account: Account | undefined): 'CUSTOMER' | 'SUPPLIER' | 'NONE' => {
    if (!account) return 'NONE';
    const code = account.code || '';
    const name = account.nameAr || '';
    if (code.startsWith('112') || name.includes('عملاء') || name.includes('العملاء') || name.includes('مدين')) {
      return 'CUSTOMER';
    }
    if (code.startsWith('211') || name.includes('مورد') || name.includes('الموردين') || name.includes('دائن')) {
      return 'SUPPLIER';
    }
    return 'NONE';
  };

  // Calculate total debit and credit in real-time
  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.001 && totalDebit > 0;

  const handleAutoBalance = () => {
    if (lines.length === 0) return;
    const currentDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const currentCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const difference = currentDebit - currentCredit;
    if (Math.abs(difference) < 0.001) return;

    const updated = [...lines];
    // Find first line with 0 on both sides, or use the last line
    let targetIdx = updated.findIndex((l) => Number(l.debit) === 0 && Number(l.credit) === 0);
    if (targetIdx === -1) {
      targetIdx = updated.length - 1;
    }

    if (difference > 0) {
      // Debit > Credit, balance needs credit on target line
      updated[targetIdx] = {
        ...updated[targetIdx],
        credit: Math.round(difference * 1000) / 1000,
        debit: 0,
      };
    } else {
      // Credit > Debit, balance needs debit on target line
      updated[targetIdx] = {
        ...updated[targetIdx],
        debit: Math.round(Math.abs(difference) * 1000) / 1000,
        credit: 0,
      };
    }
    setLines(updated);
    setErrorMsg('');
  };

  const handleOpenCreateModal = () => {
    setEditingJournalId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setDescription('');
    setLines([
      { accountId: '', debit: 0, credit: 0, memo: '', entityType: 'NONE', entityId: '', entityNameAr: '' },
      { accountId: '', debit: 0, credit: 0, memo: '', entityType: 'NONE', entityId: '', entityNameAr: '' },
    ]);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (journal: JournalEntry) => {
    setEditingJournalId(journal.id);
    setDate(journal.date || new Date().toISOString().split('T')[0]);
    setReference(journal.reference || '');
    setDescription(journal.description || '');
    setLines(
      journal.lines.map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        const autoType = detectAccountEntityType(acc);
        const entityType = l.entityType && l.entityType !== 'NONE' ? l.entityType : autoType;
        return {
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          memo: l.memo || '',
          entityType: entityType || 'NONE',
          entityId: l.entityId || '',
          entityNameAr: l.entityNameAr || '',
        };
      })
    );
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      { accountId: '', debit: 0, credit: 0, memo: '', entityType: 'NONE', entityId: '', entityNameAr: '' },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof FormLineState, value: any) => {
    const updated = [...lines];
    const currentLine = { ...updated[index] };

    if (field === 'accountId') {
      currentLine.accountId = value;
      const selectedAcc = accounts.find((a) => a.id === value);
      const detectedType = detectAccountEntityType(selectedAcc);
      currentLine.entityType = detectedType;
      // Reset entity if account changed and type is NONE
      if (detectedType === 'NONE') {
        currentLine.entityId = '';
        currentLine.entityNameAr = '';
      }
    } else if (field === 'entityType') {
      currentLine.entityType = value;
      currentLine.entityId = '';
      currentLine.entityNameAr = '';
    } else if (field === 'entityId') {
      currentLine.entityId = value;
      if (currentLine.entityType === 'CUSTOMER') {
        const cust = customers.find((c) => c.id === value);
        currentLine.entityNameAr = cust ? cust.nameAr : '';
        if (cust && (!currentLine.memo || currentLine.memo.trim() === '')) {
          currentLine.memo = `العميل: ${cust.nameAr}`;
        }
      } else if (currentLine.entityType === 'SUPPLIER') {
        const supp = suppliers.find((s) => s.id === value);
        currentLine.entityNameAr = supp ? supp.nameAr : '';
        if (supp && (!currentLine.memo || currentLine.memo.trim() === '')) {
          currentLine.memo = `المورد: ${supp.nameAr}`;
        }
      }
    } else if (field === 'debit' && Number(value) > 0) {
      currentLine.credit = 0; // mutually exclusive line item
      currentLine.debit = Number(value);
    } else if (field === 'credit' && Number(value) > 0) {
      currentLine.debit = 0;
      currentLine.credit = Number(value);
    } else {
      (currentLine as any)[field] = value;
    }

    updated[index] = currentLine;
    setLines(updated);
  };

  const handleAutoSyncOpening = async () => {
    setIsSyncingOpening(true);
    setErrorMsg('');
    setSyncSuccessMessage('');
    try {
      if (onRebuildOpeningJournal) {
        await onRebuildOpeningJournal();
      }
      setSyncSuccessMessage('تم تحديث ومزامنة القيد الافتتاحي بنجاح من واقع أرصدة العملاء والموردين والمخزون.');
      setTimeout(() => setSyncSuccessMessage(''), 6000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشلت مزامنة القيد الافتتاحي');
    } finally {
      setIsSyncingOpening(false);
    }
  };

  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (lines.length < 2) {
      setErrorMsg('لا يمكن حفظ القيد: يجب أن يتكون القيد المحاسبي من طرفين على الأقل (طرف مدين وطرف دائن).');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId || !l.accountId.trim()) {
        setErrorMsg(`يرجى اختيار الحساب المالي للدليل المحاسبي في السطر رقم (${i + 1}).`);
        return;
      }
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d === 0 && c === 0) {
        setErrorMsg(`السطر رقم (${i + 1}) فارغ من أي مبالغ. يرجى إدخال مبلغ في خانة المدين أو الدائن.`);
        return;
      }
      if (d < 0 || c < 0) {
        setErrorMsg(`لا يُسمح بإدخال مبالغ سالبة في السطر رقم (${i + 1}).`);
        return;
      }
    }

    if (!isBalanced) {
      setErrorMsg(
        `القيد غير متوازن! إجمالي الطرف المدين (${formatCurrency(totalDebit, currency)}) لا يساوي إجمالي الطرف الدائن (${formatCurrency(totalCredit, currency)}). فارق عدم التوازن: ${formatCurrency(diff, currency)}`
      );
      return;
    }

    // Filter and format lines
    const formattedLines: JournalLine[] = lines.map((l) => {
      const acc = accounts.find((a) => a.id === l.accountId);
      return {
        id: 'jl-' + Math.random().toString(36).substr(2, 9),
        accountId: l.accountId,
        accountCode: acc?.code || '',
        accountNameAr: acc?.nameAr || 'حساب غير مسمى',
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo || description,
        entityType: l.entityType || 'NONE',
        entityId: l.entityId || undefined,
        entityNameAr: l.entityNameAr || undefined,
      };
    });

    setIsSubmitting(true);
    try {
      if (editingJournalId && onUpdateJournal) {
        await onUpdateJournal(editingJournalId, {
          date,
          reference: reference.trim(),
          description: description.trim(),
          lines: formattedLines,
          status: 'POSTED',
        });
      } else {
        await onCreateJournal({
          date,
          reference: reference.trim(),
          description: description.trim(),
          lines: formattedLines,
          status: 'POSTED',
        });
      }
      setIsModalOpen(false);
      setEditingJournalId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ القيد اليومي');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReverse = async () => {
    if (!reversingJournalId) return;
    try {
      await onReverseJournal(reversingJournalId, reversalReason || 'طلب إلغاء وتصحيح قيد');
      setReversingJournalId(null);
      setReversalReason('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredJournals = journals.filter((j) => {
    if (filterStatus === 'ALL') return true;
    return j.status === filterStatus;
  });

  return (
    <div>
      {/* Main Journal Dashboard View (Hidden when printing journal) */}
      <div className={`space-y-6 ${printJournal ? 'no-print' : ''}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-[#E5E1DA] p-6 rounded-lg shadow-xs">
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#B8860B]" /> القيود اليومية والترحيل المحاسبي (Journal Entries)
            </h2>
            <p className="text-xs text-[#8C8273] mt-1 font-serif">
              تسجيل وتعديل القيود المحاسبية مع ربط الحسابات بالعميل أو المورد والتحقق التلقائي من توازن الطرفين المدين والدائن.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAutoSyncOpening}
              disabled={isSyncingOpening}
              title="إعادة احتساب وتحديث القيد الافتتاحي تلقائياً من أرصدة العملاء والموردين والمخزون"
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-md text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-700 ${isSyncingOpening ? 'animate-spin' : ''}`} />
              <span>تحديث القيد الافتتاحي تلقائياً</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold flex items-center gap-2 border border-[#1A1A1A] shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              <span>إنشاء قيد يومية جديد</span>
            </button>
          </div>
        </div>

        {syncSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-lg flex items-center gap-2 font-bold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMessage}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-[#F7F5F0] border border-[#E5E1DA] p-2 rounded-lg overflow-x-auto">
          {[
            { id: 'ALL', label: 'جميع القيود' },
            { id: 'POSTED', label: 'القيود المرحّلة' },
            { id: 'CANCELLED', label: 'القيود العكسية / الملغاة' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterStatus === f.id
                  ? 'bg-[#1A1A1A] text-white shadow-xs border border-[#1A1A1A]'
                  : 'text-[#6E6659] hover:text-[#1A1A1A] hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Journal Entries List */}
        <div className="space-y-4">
          {filteredJournals.map((j) => {
            const isOpening =
              j.sourceModule === 'OPENING' || j.reference === 'OP-2026' || j.description.includes('الافتتاحي');
            return (
              <div key={j.id} className="bg-white border border-[#E5E1DA] rounded-lg p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1DA] pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-[#B8860B] bg-[#F2EFE9] px-3 py-1 rounded-md border border-[#E5E1DA]">
                      {j.entryNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-serif font-bold text-[#1A1A1A]">{j.description}</h4>
                        {isOpening && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                            القيد الافتتاحي
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8C8273] mt-0.5">
                        التاريخ: {j.date} {j.reference && `• المرجع: ${j.reference}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        j.status === 'POSTED'
                          ? 'bg-[#EBF5EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                          : 'bg-[#FDF0F0] text-[#9E2A2B] border-[#9E2A2B]/30'
                      }`}
                    >
                      {j.status === 'POSTED' ? 'مرحّل' : 'ملغى / معكوس'}
                    </span>

                    {/* Edit Journal Button */}
                    <button
                      onClick={() => handleOpenEditModal(j)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="تعديل أسطر وبيانات هذا القيد"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">تعديل القيد</span>
                    </button>

                    <button
                      onClick={() => setPrintJournal(j)}
                      className="p-1.5 bg-[#F2EFE9] hover:bg-[#E5E1DA] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="طباعة سند القيد"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">سند قيد</span>
                    </button>

                    {j.status === 'POSTED' && !j.isAutoGenerated && (
                      <button
                        onClick={() => setReversingJournalId(j.id)}
                        className="p-1.5 bg-[#FDF0F0] hover:bg-[#F8D7DA] text-[#9E2A2B] border border-[#9E2A2B]/30 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        title="عكس القيد المحاسبي"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">عكس القيد</span>
                      </button>
                    )}

                    {onDeleteJournal && (
                      <button
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف القيد (${j.entryNumber})؟ سيتم إلغاء أثره وإعادة احتساب الأرصدة تلقائياً.`)) {
                            try {
                              await onDeleteJournal(j.id);
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        title="حذف القيد بالكامل وتحديث الأرصدة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">حذف</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lines Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#F7F5F0] text-[#6E6659] font-serif font-bold border-b border-[#E5E1DA]">
                      <tr>
                        <th className="py-2 px-3">رقم الحساب</th>
                        <th className="py-2 px-3">اسم الحساب والطرف المرتبط</th>
                        <th className="py-2 px-3">البيان / الشرح</th>
                        <th className="py-2 px-3">الطرف المدين</th>
                        <th className="py-2 px-3">الطرف الدائن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1DA]">
                      {j.lines.map((l) => (
                        <tr key={l.id} className="hover:bg-[#FDFCFB]">
                          <td className="py-2 px-3 font-mono font-bold text-[#B8860B]">{l.accountCode}</td>
                          <td className="py-2 px-3 font-serif font-bold text-[#1A1A1A]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{l.accountNameAr}</span>
                              {l.entityNameAr && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    l.entityType === 'SUPPLIER'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-blue-50 text-blue-900 border-blue-200'
                                  }`}
                                >
                                  {l.entityType === 'SUPPLIER' ? 'مورد' : 'عميل'}: {l.entityNameAr}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-[#6E6659]">{l.memo || '-'}</td>
                          <td className="py-2 px-3 font-serif font-bold text-[#2D6A4F]">
                            {l.debit > 0 ? formatCurrency(l.debit, currency) : '-'}
                          </td>
                          <td className="py-2 px-3 font-serif font-bold text-[#9E2A2B]">
                            {l.credit > 0 ? formatCurrency(l.credit, currency) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#F7F5F0] font-serif font-bold text-[#1A1A1A] border-t border-[#E5E1DA]">
                        <td colSpan={3} className="py-2.5 px-3 text-left">
                          الإجمالي المتوازن:
                        </td>
                        <td className="py-2.5 px-3 text-[#2D6A4F]">{formatCurrency(j.totalDebit, currency)}</td>
                        <td className="py-2.5 px-3 text-[#9E2A2B]">{formatCurrency(j.totalCredit, currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create / Edit Journal Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#E5E1DA] w-full max-w-4xl rounded-xl p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3 shrink-0">
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  {editingJournalId ? (
                    <>
                      <Edit className="w-5 h-5 text-blue-600" />
                      <span>تعديل القيد المحاسبي والأسطر</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-[#B8860B]" />
                      <span>تسجيل قيد يومية مزدوج جديد</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#8C8273] hover:text-[#1A1A1A] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#FDF0F0] border border-[#9E2A2B]/30 text-[#9E2A2B] text-xs rounded-md flex items-center gap-2 font-semibold shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitJournal} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">التاريخ *</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">المرجع / السند</label>
                    <input
                      type="text"
                      placeholder="مثال: OP-2026 أو فاتورة 101"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">البيان العام للقيد *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: القيد الافتتاحي أو إثبات مبيعات أو سداد مورد"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>

                {/* Lines Grid */}
                <div className="space-y-3 border-t border-[#E5E1DA] pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-serif font-bold text-[#1A1A1A]">أطراف القيد (المدين والدائن)</h4>
                      <p className="text-[11px] text-[#8C8273]">
                        عند اختيار حساب العملاء أو الموردين، يمكنك تحديد اسم العميل أو المورد المعني بالسطر بدقة.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs text-[#B8860B] hover:text-[#D4AF37] font-semibold flex items-center gap-1 cursor-pointer bg-amber-50 px-2.5 py-1 rounded border border-amber-200"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة طرف قيد جديد
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lines.map((l, index) => {
                      const selectedAcc = accounts.find((a) => a.id === l.accountId);
                      const isCustomerAcc =
                        l.entityType === 'CUSTOMER' ||
                        (selectedAcc && detectAccountEntityType(selectedAcc) === 'CUSTOMER');
                      const isSupplierAcc =
                        l.entityType === 'SUPPLIER' ||
                        (selectedAcc && detectAccountEntityType(selectedAcc) === 'SUPPLIER');
                      const showEntityPicker = isCustomerAcc || isSupplierAcc || l.entityType !== 'NONE';

                      return (
                        <div
                          key={index}
                          className="bg-[#F7F5F0] p-3 rounded-lg border border-[#E5E1DA] space-y-2"
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            {/* Account Selector */}
                            <div className="col-span-12 sm:col-span-4">
                              <label className="block text-[10px] font-bold text-[#6E6659] mb-0.5">
                                الحساب المالي #{index + 1} *
                              </label>
                              <select
                                required
                                value={l.accountId}
                                onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                                className="w-full bg-white border border-[#E5E1DA] rounded px-2 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                              >
                                <option value="">-- اختر الحساب من الدليل --</option>
                                {accounts
                                  .filter(
                                    (a) =>
                                      a.type === 'DETAIL' ||
                                      a.level >= 2 ||
                                      !accounts.some((sub) => sub.parentId === a.id)
                                  )
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.code} - {a.nameAr} ({formatCurrency(a.balance, currency)})
                                    </option>
                                  ))}
                              </select>
                              {selectedAcc && (
                                <div className="flex items-center justify-between text-[10px] text-[#6E6659] mt-0.5 px-0.5">
                                  <span>التصنيف: {selectedAcc.category}</span>
                                  <span className="font-mono text-stone-700">
                                    الرصيد: {formatCurrency(selectedAcc.balance, currency)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Line Memo */}
                            <div className="col-span-6 sm:col-span-3">
                              <label className="block text-[10px] font-bold text-[#6E6659] mb-0.5">
                                بيان السطر / الشرح
                              </label>
                              <input
                                type="text"
                                placeholder="البيان الخاص بالطرف"
                                value={l.memo}
                                onChange={(e) => handleLineChange(index, 'memo', e.target.value)}
                                className="w-full bg-white border border-[#E5E1DA] rounded px-2 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                              />
                            </div>

                            {/* Debit Input */}
                            <div className="col-span-3 sm:col-span-2">
                              <label className="block text-[10px] font-bold text-[#2D6A4F] mb-0.5">
                                مدين (Debit)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="مدين"
                                value={l.debit || ''}
                                onChange={(e) =>
                                  handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)
                                }
                                className="w-full bg-white border border-[#E5E1DA] rounded px-2 py-1.5 text-xs text-[#2D6A4F] font-bold focus:outline-none focus:border-[#2D6A4F]"
                              />
                            </div>

                            {/* Credit Input */}
                            <div className="col-span-3 sm:col-span-2">
                              <label className="block text-[10px] font-bold text-[#9E2A2B] mb-0.5">
                                دائن (Credit)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="دائن"
                                value={l.credit || ''}
                                onChange={(e) =>
                                  handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)
                                }
                                className="w-full bg-white border border-[#E5E1DA] rounded px-2 py-1.5 text-xs text-[#9E2A2B] font-bold focus:outline-none focus:border-[#9E2A2B]"
                              />
                            </div>

                            {/* Delete Line Button */}
                            <div className="col-span-1 text-center pt-4">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(index)}
                                disabled={lines.length <= 2}
                                className="text-[#8C8273] hover:text-[#9E2A2B] disabled:opacity-30 cursor-pointer p-1"
                                title="حذف السطر"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Secondary Partner Linking Row (Customer / Supplier) */}
                          <div className="pt-2 border-t border-[#E5E1DA]/80 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[11px] font-bold text-[#6E6659] flex items-center gap-1">
                              <Link className="w-3.5 h-3.5 text-[#B8860B]" />
                              ربط بجهة:
                            </span>

                            {/* Entity Type Toggle */}
                            <select
                              value={l.entityType || 'NONE'}
                              onChange={(e) => handleLineChange(index, 'entityType', e.target.value as any)}
                              className="bg-white border border-[#E5E1DA] rounded px-2 py-1 text-xs text-[#1A1A1A] font-medium cursor-pointer"
                            >
                              <option value="NONE">بدون طرف فرعي</option>
                              <option value="CUSTOMER">عميل / جمعية (Customer)</option>
                              <option value="SUPPLIER">مورد / شركة (Supplier)</option>
                            </select>

                            {/* Customer Dropdown */}
                            {l.entityType === 'CUSTOMER' && (
                              <div className="flex-1 min-w-[200px]">
                                <select
                                  value={l.entityId || ''}
                                  onChange={(e) => handleLineChange(index, 'entityId', e.target.value)}
                                  className="w-full bg-white border border-blue-300 rounded px-2.5 py-1 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-blue-600"
                                >
                                  <option value="">-- اختر العميل أو الجمعية المعنية --</option>
                                  {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.code} - {c.nameAr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Supplier Dropdown */}
                            {l.entityType === 'SUPPLIER' && (
                              <div className="flex-1 min-w-[200px]">
                                <select
                                  value={l.entityId || ''}
                                  onChange={(e) => handleLineChange(index, 'entityId', e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2.5 py-1 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-amber-600"
                                >
                                  <option value="">-- اختر المورد أو الشركة المعنية --</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.code} - {s.nameAr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {l.entityNameAr && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                تم ربط الطرف: {l.entityNameAr}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Bar */}
                  <div className="flex flex-wrap items-center justify-between bg-[#F2EFE9] p-3 rounded-md border border-[#E5E1DA] text-xs font-serif mt-3">
                    <div className="flex items-center gap-4">
                      <span>
                        إجمالي المدين:{' '}
                        <strong className="text-[#2D6A4F] font-mono">
                          {formatCurrency(totalDebit, currency)}
                        </strong>
                      </span>
                      <span>
                        إجمالي الدائن:{' '}
                        <strong className="text-[#9E2A2B] font-mono">
                          {formatCurrency(totalCredit, currency)}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-bold">
                      {isBalanced ? (
                        <span className="text-[#2D6A4F] flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4" /> القيد متوازن تماماً
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[#9E2A2B] flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
                            <AlertTriangle className="w-4 h-4" /> فارق التوازن:{' '}
                            <span className="font-mono">{formatCurrency(diff, currency)}</span>
                          </span>
                          {diff > 0.001 && (
                            <button
                              type="button"
                              onClick={handleAutoBalance}
                              className="text-xs bg-[#B8860B] hover:bg-[#D4AF37] text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              title="إكمال الطرف المتبقي لموازنة القيد آلياً"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> موازنة القيد آلياً
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E1DA] shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-md text-xs font-semibold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!isBalanced || isSubmitting}
                    className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#2D2B28] text-white rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1 border border-[#1A1A1A]"
                  >
                    <Check className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {isSubmitting
                        ? 'جاري الحفظ والترحيل...'
                        : editingJournalId
                        ? 'حفظ تعديلات القيد'
                        : 'ترحيل واعتماد القيد'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reversal Confirmation Modal */}
        {reversingJournalId && (
          <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E1DA] w-full max-w-md rounded-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[#9E2A2B] font-serif font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <h3>تأكيد عكس القيد المحاسبي</h3>
              </div>

              <p className="text-xs text-[#6E6659] leading-relaxed">
                وفقاً لمعايير المحاسبة المعتمدة، لا يتم حذف القيود المرحلة بل يتم توليد قيد عكسي مطابق ومرحّل تلقائياً لإلغاء الأثر المالي السابق.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">سبب عكس القيد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تصحيح خطأ في توجيه الحساب أو إلغاء المعاملة"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-[#E5E1DA] rounded-md px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReversingJournalId(null)}
                  className="px-4 py-2 bg-[#F7F5F0] hover:bg-[#E5E1DA] text-[#1A1A1A] rounded-md text-xs font-semibold cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReverse}
                  className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#802223] text-white rounded-md text-xs font-semibold cursor-pointer"
                >
                  تأكيد توليد القيد العكسي
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Journal Voucher Modal */}
      {printJournal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FDFCFB] text-[#1A1A1A] border border-[#E5E1DA] w-full max-w-2xl rounded-lg p-8 shadow-2xl space-y-6 printable-card my-8 font-serif">
            <div className="flex items-center justify-between border-b pb-4 border-[#E5E1DA]">
              <div>
                <h2 className="text-xl font-bold text-[#1A1A1A]">سند قيد محاسبي (Journal Voucher)</h2>
                <p className="text-xs text-[#8C8273]">{companyName} - قسم الحسابات العامة والمالية</p>
              </div>
              <div className="text-left font-mono">
                <span className="font-bold text-sm text-[#B8860B]">{printJournal.entryNumber}</span>
                <p className="text-xs text-[#8C8273]">التاريخ: {printJournal.date}</p>
              </div>
            </div>

            <div className="text-xs space-y-1 bg-[#F7F5F0] p-3 rounded-md border border-[#E5E1DA]">
              <p>
                <strong>البيان العام:</strong> {printJournal.description}
              </p>
              {printJournal.reference && (
                <p>
                  <strong>المرجع:</strong> {printJournal.reference}
                </p>
              )}
            </div>

            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F5F0] text-[#1A1A1A] border-b border-[#E5E1DA] font-bold">
                  <th className="p-2 border border-[#E5E1DA]">كود الحساب</th>
                  <th className="p-2 border border-[#E5E1DA]">اسم الحساب والطرف</th>
                  <th className="p-2 border border-[#E5E1DA]">البيان</th>
                  <th className="p-2 border border-[#E5E1DA]">مدين</th>
                  <th className="p-2 border border-[#E5E1DA]">دائن</th>
                </tr>
              </thead>
              <tbody>
                {printJournal.lines.map((l) => (
                  <tr key={l.id} className="border-b border-[#E5E1DA]">
                    <td className="p-2 border border-[#E5E1DA] font-mono">{l.accountCode}</td>
                    <td className="p-2 border border-[#E5E1DA] font-bold">
                      <div>{l.accountNameAr}</div>
                      {l.entityNameAr && (
                        <span className="text-[10px] text-blue-800 font-bold block">
                          [{l.entityType === 'SUPPLIER' ? 'المورد' : 'العميل'}: {l.entityNameAr}]
                        </span>
                      )}
                    </td>
                    <td className="p-2 border border-[#E5E1DA]">{l.memo}</td>
                    <td className="p-2 border border-[#E5E1DA] font-bold text-[#2D6A4F]">
                      {l.debit > 0 ? l.debit.toFixed(3) : '-'}
                    </td>
                    <td className="p-2 border border-[#E5E1DA] font-bold text-[#9E2A2B]">
                      {l.credit > 0 ? l.credit.toFixed(3) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#F2EFE9] font-bold">
                  <td colSpan={3} className="p-2 border border-[#E5E1DA] text-left">
                    الإجمالي:
                  </td>
                  <td className="p-2 border border-[#E5E1DA] text-[#2D6A4F]">{printJournal.totalDebit.toFixed(3)}</td>
                  <td className="p-2 border border-[#E5E1DA] text-[#9E2A2B]">
                    {printJournal.totalCredit.toFixed(3)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="pt-8 grid grid-cols-3 text-center text-xs text-[#6E6659]">
              <div>
                <p className="font-bold">المحاسب المسؤول</p>
                <p className="mt-8">........................</p>
              </div>
              <div>
                <p className="font-bold">المراجع الداخلي</p>
                <p className="mt-8">........................</p>
              </div>
              <div>
                <p className="font-bold">اعتماد المدير المالي</p>
                <p className="mt-8">........................</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 no-print border-t border-[#E5E1DA] pt-4">
              <button
                onClick={() => setPrintJournal(null)}
                className="px-4 py-2 bg-[#F2EFE9] text-[#1A1A1A] border border-[#E5E1DA] rounded-md text-xs font-semibold cursor-pointer"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#1A1A1A] text-white rounded-md text-xs font-semibold cursor-pointer flex items-center gap-1 border border-[#1A1A1A]"
              >
                <Printer className="w-4 h-4 text-[#D4AF37]" /> طباعة السند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
