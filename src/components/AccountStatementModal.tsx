import React from 'react';
import { Customer, Supplier, Invoice, PaymentVoucher, JournalEntry, CompanyProfile, CreditNote } from '../types.js';
import { AccountStatementView } from './AccountStatementView.tsx';
import { X } from 'lucide-react';

interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'CUSTOMER' | 'SUPPLIER';
  selectedEntityId?: string;
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  journals?: JournalEntry[];
  creditNotes?: CreditNote[];
  company: CompanyProfile | null;
  currency: string;
}

export const AccountStatementModal: React.FC<AccountStatementModalProps> = ({
  isOpen,
  onClose,
  entityType,
  selectedEntityId,
  customers,
  suppliers,
  invoices,
  vouchers,
  journals = [],
  creditNotes = [],
  company,
  currency,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-transparent print:static print:inset-auto print:backdrop-blur-none print:overflow-visible">
      <div className="bg-white border border-[#E5E1DA] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] dir-rtl text-right print:border-none print:shadow-none print:rounded-none print:max-h-none print:overflow-visible print:w-full print:max-w-none print:p-0">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1DA] bg-[#F7F5F0] no-print">
          <div className="flex items-center gap-2 text-sm font-serif font-extrabold text-[#1A1A1A]">
            <span>عرض كشف الحساب المالي المعتمد</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8273] hover:text-[#1A1A1A] hover:bg-[#E5E1DA] transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F9F8F6] print:bg-white print:p-0 print:overflow-visible">
          <AccountStatementView
            customers={customers}
            suppliers={suppliers}
            invoices={invoices}
            vouchers={vouchers}
            journals={journals}
            creditNotes={creditNotes}
            company={company}
            currency={currency}
            initialEntityType={entityType}
            initialEntityId={selectedEntityId}
          />
        </div>
      </div>
    </div>
  );
};
