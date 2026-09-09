import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, User, Building2, Check, ChevronDown, Sparkles } from 'lucide-react';
import { Customer, Supplier } from '../types.js';
import { filterAndRankEntities } from '../utils/searchUtils.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface CustomerSearchComboboxProps {
  entities: (Customer | Supplier)[];
  selectedId: string;
  onSelect: (entityId: string, entity?: Customer | Supplier) => void;
  entityType?: 'CUSTOMER' | 'SUPPLIER';
  currency: string;
  getBalance?: (entity: any) => number;
  label?: string;
  required?: boolean;
}

export const CustomerSearchCombobox: React.FC<CustomerSearchComboboxProps> = ({
  entities,
  selectedId,
  onSelect,
  entityType = 'CUSTOMER',
  currency,
  getBalance,
  label,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected Entity
  const selectedEntity = useMemo(() => {
    return entities.find((e) => e.id === selectedId) || null;
  }, [entities, selectedId]);

  // Filtered list using normalized Arabic & English fuzzy search
  // When query is empty or whitespace, filterAndRankEntities returns ALL entities!
  const filteredEntities = useMemo(() => {
    const results = filterAndRankEntities(entities, query, {
      primary: (e) => e.nameAr,
      secondary: (e) => (e as any).nameEn,
      fallbackCode: (e) => `${(e as any).code || ''} ${(e as any).phone || ''}`,
    });

    // If query is empty and an entity is selected, keep the selected entity at the top for immediate access
    if (!query.trim() && selectedId) {
      const selected = results.find((e) => e.id === selectedId);
      if (selected) {
        const others = results.filter((e) => e.id !== selectedId);
        return [selected, ...others];
      }
    }

    return results;
  }, [entities, query, selectedId]);

  // Reset highlight when query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (entity: Customer | Supplier) => {
    onSelect(entity.id, entity);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('', undefined);
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setQuery('');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredEntities.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredEntities[highlightedIndex]) {
        handleSelect(filteredEntities[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  };

  const isSupplier = entityType === 'SUPPLIER';
  const defaultLabel = isSupplier ? 'المورد / الحساب الدائن *' : 'العميل / الحساب المدين *';

  return (
    <div className="relative w-full text-right dir-rtl" ref={containerRef}>
      {label !== undefined ? (
        label && <label className="block font-bold text-[#1A1A1A] mb-1 text-xs">{label}</label>
      ) : (
        <label className="block font-bold text-[#1A1A1A] mb-1 text-xs">{defaultLabel}</label>
      )}

      {/* Selected Entity Card Preview or Search Input */}
      {selectedEntity && !isOpen ? (
        <div
          onClick={() => {
            setIsOpen(true);
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center justify-between p-2.5 bg-amber-50/50 border-2 border-[#D4AF37] rounded-xl cursor-pointer hover:bg-amber-50 transition-all shadow-2xs group"
          title="انقر لتغيير الاختيار أو عرض كافة الحسابات"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center shrink-0 text-[#8C6D1F] group-hover:scale-105 transition-transform">
              {isSupplier ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="truncate">
              <div className="font-extrabold text-xs text-[#1A1A1A] truncate flex items-center gap-1.5">
                <span>{selectedEntity.nameAr}</span>
                {(selectedEntity as any).nameEn && (
                  <span className="text-[10px] text-neutral-400 font-mono">
                    ({(selectedEntity as any).nameEn})
                  </span>
                )}
                <span className="text-[9px] bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                  الحساب المختار
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                {getBalance ? (
                  <span>
                    الرصيد الحالي:{' '}
                    <strong
                      className={
                        getBalance(selectedEntity) > 0
                          ? 'text-rose-700'
                          : getBalance(selectedEntity) < 0
                          ? 'text-emerald-700'
                          : 'text-neutral-700'
                      }
                    >
                      {formatCurrency(getBalance(selectedEntity), currency)}
                    </strong>
                  </span>
                ) : (
                  <span>
                    الرصيد:{' '}
                    <strong>{formatCurrency(Number(selectedEntity.balance || 0), currency)}</strong>
                  </span>
                )}
                {(selectedEntity as any).phone && (
                  <span className="font-mono text-[10px] text-neutral-400">
                    هاتف: {(selectedEntity as any).phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-rose-100 text-neutral-400 hover:text-rose-600 rounded-md transition-colors"
              title="إلغاء الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] bg-white border border-[#E5E1DA] px-2.5 py-1 rounded-lg font-bold text-neutral-700 group-hover:border-[#D4AF37] transition-all">
              تغيير / عرض الكل
            </span>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              required={required && !selectedId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                setIsOpen(true);
                // Wildcard: keep query empty on focus to display all available entities immediately
              }}
              onClick={() => {
                if (!isOpen) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedEntity
                  ? `الحساب المختار: ${selectedEntity.nameAr}`
                  : isSupplier
                  ? 'ابحث باسم المورد أو اختر من كافة الموردين المتاحين...'
                  : 'ابحث باسم العميل أو اختر من كافة العملاء المتاحين...'
              }
              className="w-full bg-[#F9F8F6] border border-[#E5E1DA] focus:border-[#D4AF37] focus:bg-white rounded-xl py-2.5 pr-9 pl-14 font-bold text-[#1A1A1A] text-xs outline-none transition-all shadow-2xs"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute right-3 pointer-events-none" />

            <div className="absolute left-2 flex items-center gap-1">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer rounded-md transition-colors"
                  title="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(!isOpen);
                  if (!isOpen) {
                    setQuery('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
                className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer rounded-md transition-colors"
                title="عرض كافة الحسابات"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E5E1DA] rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-[#F1EFEA] animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 bg-[#FAF9F6] border-b border-[#E5E1DA] text-[11px] font-bold text-neutral-600 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-1.5">
              <span>
                {query.trim()
                  ? `نتائج البحث عن "${query}" (${filteredEntities.length} من أصل ${entities.length})`
                  : `كافة ${isSupplier ? 'الموردين المتاحين' : 'العملاء المتاحين'} (${entities.length})`}
              </span>
              {!query.trim() && (
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  عرض شامل
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#D4AF37] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              بحث مرن وتلقائي
            </span>
          </div>

          {filteredEntities.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500 font-medium">
              لا يوجد {isSupplier ? 'مورد' : 'عميل'} يطابق: &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredEntities.map((entity, idx) => {
              const isSelected = entity.id === selectedId;
              const isHighlighted = idx === highlightedIndex;
              const bal = getBalance ? getBalance(entity) : Number(entity.balance || 0);

              return (
                <div
                  key={entity.id}
                  onClick={() => handleSelect(entity)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-amber-50/80' : isSelected ? 'bg-amber-50/40' : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#D4AF37] text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : isSupplier ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-[#1A1A1A] flex items-center gap-1.5 truncate">
                        <span>{entity.nameAr}</span>
                        {(entity as any).nameEn && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({(entity as any).nameEn})
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                            الحساب الحالي
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-neutral-500 bg-neutral-100 px-1 rounded">
                          كود: {(entity as any).code || entity.id.slice(0, 6)}
                        </span>
                        {(entity as any).phone && (
                          <>
                            <span className="text-neutral-300">|</span>
                            <span className="font-mono text-[10px] text-neutral-400">
                              هاتف: {(entity as any).phone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <div
                      className={`text-xs font-mono font-bold ${
                        bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-emerald-700' : 'text-neutral-700'
                      }`}
                    >
                      {formatCurrency(bal, currency)}
                    </div>
                    <div className="text-[9px] text-neutral-400">الرصيد الحالي</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
