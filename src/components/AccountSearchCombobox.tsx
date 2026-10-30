import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Layers, Building, Landmark, Wallet, Shield } from 'lucide-react';
import { Account } from '../types.js';
import { matchesAccountSearch } from '../utils/searchUtils.ts';
import { isAccountLeaf } from '../utils/accountingTreeEngine.ts';
import { getCategoryBadgeClass, getCategoryLabelAr } from '../utils/formatters.ts';

interface AccountSearchComboboxProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (accountId: string, account?: Account) => void;
  includeAllOption?: boolean;
  label?: string;
  placeholder?: string;
  leafOnly?: boolean;
  className?: string;
}

export const AccountSearchCombobox: React.FC<AccountSearchComboboxProps> = ({
  accounts,
  selectedId,
  onSelect,
  includeAllOption = true,
  label,
  placeholder = 'اختر أو ابحث عن الحساب المحاسبي...',
  leafOnly = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Available accounts based on leafOnly constraint
  const baseAccounts = useMemo(() => {
    if (!leafOnly) return accounts;
    return accounts.filter((a) => isAccountLeaf(a, accounts));
  }, [accounts, leafOnly]);

  // Selected Account Object
  const selectedAccount = useMemo(() => {
    if (selectedId === 'ALL') return null;
    return accounts.find((a) => a.id === selectedId || a.code === selectedId) || null;
  }, [accounts, selectedId]);

  // Filter accounts by search query and category
  const filteredAccounts = useMemo(() => {
    return baseAccounts.filter((acc) => {
      // 1. Category Filter
      if (selectedCategory !== 'ALL' && acc.category !== selectedCategory) {
        return false;
      }
      // 2. Search Query with Arabic normalization
      if (!searchQuery.trim()) return true;
      return matchesAccountSearch(acc, searchQuery);
    });
  }, [baseAccounts, selectedCategory, searchQuery]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setHighlightedIndex(0);
    } else {
      setSearchQuery('');
      setSelectedCategory('ALL');
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAccount = (id: string, acc?: Account) => {
    onSelect(id, acc);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = (includeAllOption ? 1 : 0) + filteredAccounts.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (includeAllOption && highlightedIndex === 0) {
        handleSelectAccount('ALL');
      } else {
        const itemIdx = includeAllOption ? highlightedIndex - 1 : highlightedIndex;
        if (filteredAccounts[itemIdx]) {
          handleSelectAccount(filteredAccounts[itemIdx].id, filteredAccounts[itemIdx]);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-[#6E6659] mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full bg-[#FDFCFB] hover:bg-white border rounded-md px-3 py-1.5 text-xs text-right font-bold flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs ${
          isOpen ? 'border-[#B8860B] ring-1 ring-[#B8860B]/30' : 'border-[#E5E1DA]'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedId === 'ALL' ? (
            <div className="flex items-center gap-1.5 text-[#B8860B] truncate">
              <span className="text-amber-600 font-black">★</span>
              <span>كافة الحسابات (دفتر الأستاذ العام الشامل لجميع الحسابات)</span>
            </div>
          ) : selectedAccount ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono font-black text-[#B8860B]">{selectedAccount.code}</span>
              <span className="text-[#1A1A1A] truncate">{selectedAccount.nameAr}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isAccountLeaf(selectedAccount, accounts)
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {isAccountLeaf(selectedAccount, accounts) ? 'طرفي' : 'رئيسي'}
              </span>
              <span className="text-[10px] text-[#8C8273]">
                {(selectedAccount.normalBalance || (selectedAccount as any).nature) === 'DEBIT' ? 'مدين' : 'دائن'}
              </span>
            </div>
          ) : (
            <span className="text-[#8C8273] font-normal">{placeholder}</span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-[#8C8273] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[340px] max-w-2xl bg-white border border-[#E5E1DA] rounded-xl shadow-2xl p-2.5 space-y-2 text-right dir-rtl animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ابحث برقم الحساب أو الاسم (مثلاً: 1112 أو بيت التمويل أو ذمم)..."
              className="w-full bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg pr-8 pl-8 py-2 text-xs text-[#1A1A1A] font-bold placeholder-[#8C8273] focus:bg-white focus:outline-none focus:border-[#B8860B]"
            />
            <Search className="w-4 h-4 text-[#8C8273] absolute right-2.5 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2.5 text-[#8C8273] hover:text-[#1A1A1A] p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 pb-1 border-b border-[#E5E1DA] text-[10px]">
            {[
              { id: 'ALL', label: 'كافة التصنيفات' },
              { id: 'ASSET', label: '1 - الأصول' },
              { id: 'LIABILITY', label: '2 - الخصوم' },
              { id: 'EQUITY', label: '3 - حقوق الملكية' },
              { id: 'REVENUE', label: '4 - الإيرادات' },
              { id: 'EXPENSE', label: '5 - المصروفات' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-[#F2EFE9] text-[#6E6659] hover:bg-[#E5E1DA]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-[#F2EFE9] rounded-lg border border-[#E5E1DA]/60">
            {/* All Accounts Option */}
            {includeAllOption && (!searchQuery.trim() || 'كافة الحسابات الأستاذ العام الشامل'.includes(searchQuery.trim())) && (
              <button
                type="button"
                onClick={() => handleSelectAccount('ALL')}
                className={`w-full px-3 py-2 text-right flex items-center justify-between text-xs font-bold transition-colors cursor-pointer ${
                  selectedId === 'ALL'
                    ? 'bg-amber-50/80 text-[#B8860B]'
                    : highlightedIndex === 0
                    ? 'bg-[#F7F5F0]'
                    : 'hover:bg-[#FAF9F6]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-black">★</span>
                  <span>كافة الحسابات (دفتر الأستاذ العام الشامل لجميع الحسابات)</span>
                </div>
                {selectedId === 'ALL' && <Check className="w-4 h-4 text-[#B8860B]" />}
              </button>
            )}

            {/* Account Rows */}
            {filteredAccounts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8C8273] space-y-1">
                <Layers className="w-6 h-6 mx-auto opacity-30 text-[#8C8273]" />
                <p className="font-bold">لا توجد حسابات مطابقة لمعايير البحث</p>
                <p className="text-[11px] text-[#A89F91]">جرّب البحث برقم كود آخر أو مسح عبارة البحث</p>
              </div>
            ) : (
              filteredAccounts.map((acc, idx) => {
                const isSelected = selectedId === acc.id || selectedId === acc.code;
                const isHighlighted = includeAllOption ? highlightedIndex === idx + 1 : highlightedIndex === idx;
                const leaf = isAccountLeaf(acc, accounts);
                const isDebit = (acc.normalBalance || (acc as any).nature) === 'DEBIT';

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccount(acc.id, acc)}
                    className={`w-full px-3 py-2 text-right flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 font-bold'
                        : isHighlighted
                        ? 'bg-[#F7F5F0]'
                        : 'hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono font-black text-[#B8860B] text-xs shrink-0 w-14">
                        {acc.code}
                      </span>
                      <span className="text-[#1A1A1A] font-bold truncate">
                        {acc.nameAr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${getCategoryBadgeClass(acc.category)}`}>
                        {getCategoryLabelAr(acc.category)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          leaf
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {leaf ? 'طرفي' : 'رئيسي'}
                      </span>
                      <span className="text-[#8C8273] font-mono">
                        {isDebit ? 'مدين' : 'دائن'}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#B8860B] mr-1" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="flex items-center justify-between text-[10px] text-[#8C8273] px-1 pt-1 border-t border-[#E5E1DA]">
            <span>الحسابات المعروضة: {filteredAccounts.length} من {baseAccounts.length}</span>
            <span className="font-mono">نظام موحد (Zero Data Loss)</span>
          </div>
        </div>
      )}
    </div>
  );
};
