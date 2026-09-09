import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Package, Check, ChevronDown, Sparkles } from 'lucide-react';
import { InventoryItem, InvoiceType } from '../types.js';
import { filterAndRankEntities } from '../utils/searchUtils.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface InvoiceItemSearchComboboxProps {
  inventory: InventoryItem[];
  selectedItemId: string;
  selectedItemName?: string;
  onSelectItem: (item: InventoryItem) => void;
  onCustomNameChange?: (name: string) => void;
  invType?: InvoiceType;
  currency?: string;
  placeholder?: string;
}

export const InvoiceItemSearchCombobox: React.FC<InvoiceItemSearchComboboxProps> = ({
  inventory,
  selectedItemId,
  selectedItemName = '',
  onSelectItem,
  onCustomNameChange,
  invType = 'SALES',
  currency = 'KWD',
  placeholder = 'ابحث بالاسم أو اختر من كافة الأصناف المتاحة...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [inventory, selectedItemId]);

  // When dropdown is closed, show selected item name or custom name.
  // When dropdown is open, show what the user is typing in `query`.
  const inputValue = isOpen ? query : selectedItem ? selectedItem.nameAr : selectedItemName;

  // Real-time fuzzy, wildcard search across all inventory items
  // When query is empty or whitespace, filterAndRankEntities returns ALL items in full!
  const filteredItems = useMemo(() => {
    const results = filterAndRankEntities(inventory, query, {
      primary: (i) => i.nameAr,
      secondary: (i) => i.nameEn,
      fallbackCode: (i) => `${i.sku || ''} ${i.barcode || ''} ${i.category || ''}`,
    });

    // If query is empty and an item is already selected, bring selected item to the top
    if (!query.trim() && selectedItemId) {
      const selected = results.find((i) => i.id === selectedItemId);
      if (selected) {
        const others = results.filter((i) => i.id !== selectedItemId);
        return [selected, ...others];
      }
    }

    return results;
  }, [inventory, query, selectedItemId]);

  // Reset highlight index when query or filteredItems change
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

  const handleSelect = (item: InventoryItem) => {
    onSelectItem(item);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCustomNameChange) onCustomNameChange('');
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCustomItemSelect = () => {
    if (onCustomNameChange && query.trim()) {
      onCustomNameChange(query.trim());
      setIsOpen(false);
      setQuery('');
    }
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
      setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems.length > 0 && filteredItems[highlightedIndex]) {
        handleSelect(filteredItems[highlightedIndex]);
      } else if (query.trim()) {
        handleCustomItemSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  };

  const isSales = invType === 'SALES' || invType === 'SALES_RETURN';

  return (
    <div className="relative w-full text-right dir-rtl" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (onCustomNameChange) onCustomNameChange(val);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            // Wildcard behavior: keep query empty on focus to display all available items immediately
            setQuery('');
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setQuery('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedItem
              ? `الصنف المختار: ${selectedItem.nameAr}`
              : placeholder
          }
          className={`w-full bg-[#FAF9F6] border rounded-lg pr-7 pl-12 py-1.5 font-bold text-black text-xs outline-none transition-all shadow-2xs ${
            isOpen ? 'border-[#D4AF37] bg-white ring-2 ring-[#D4AF37]/30' : 'border-[#E5E1DA] hover:border-[#D4AF37]/60'
          }`}
        />
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2 pointer-events-none" />

        <div className="absolute left-1.5 flex items-center gap-0.5">
          {inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer rounded-md transition-colors"
              title="مسح واختيار صنف آخر"
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
            title="عرض كافة الأصناف"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 w-80 sm:w-[420px] bg-white border border-[#E5E1DA] rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-[#F1EFEA] animate-in fade-in zoom-in-95 duration-100 text-xs">
          {/* Header with scope and count */}
          <div className="p-2 bg-[#FAF9F6] border-b border-[#E5E1DA] text-[10px] font-bold text-neutral-600 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-1.5">
              <span>
                {query.trim()
                  ? `نتائج البحث عن "${query}" (${filteredItems.length} من أصل ${inventory.length})`
                  : `كافة الأصناف المتاحة بالمخزون (${inventory.length} صنف)`}
              </span>
              {!query.trim() && (
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  عرض شامل
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#D4AF37] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              بحث فوري مرن
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs font-bold text-neutral-600">لا يوجد صنف يطابق: &ldquo;{query}&rdquo;</p>
              {query.trim() && (
                <div className="mt-2.5">
                  <p className="text-[11px] text-neutral-500 mb-2">
                    يمكنك اعتماد هذا الاسم كبند مخصص أو خدمة في الفاتورة الحالية:
                  </p>
                  <button
                    type="button"
                    onClick={handleCustomItemSelect}
                    className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-[#D4AF37] text-[#8C6D1F] rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>+ استخدام &ldquo;{query}&rdquo; كبند مخصص للفاتورة</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = item.id === selectedItemId;
              const isHighlighted = idx === highlightedIndex;
              const price = isSales ? item.salePrice : item.purchasePrice;
              const inStock = (item.quantityOnHand ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
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
                      {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Package className="w-3.5 h-3.5" />}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-[#1A1A1A] flex items-center gap-1.5 truncate">
                        <span>{item.nameAr}</span>
                        {item.nameEn && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({item.nameEn})
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                            الصنف الحالي
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-neutral-500 bg-neutral-100 px-1 rounded">
                          {item.sku || 'بدون رمز'}
                        </span>
                        {item.barcode && (
                          <>
                            <span className="text-neutral-300">|</span>
                            <span className="font-mono text-[9px] text-neutral-400">
                              بار كود: {item.barcode}
                            </span>
                          </>
                        )}
                        <span className="text-neutral-300">|</span>
                        <span className="text-neutral-600">الوحدة: {item.unit || 'حبة'}</span>
                        <span className="text-neutral-300">|</span>
                        <span
                          className={`font-bold ${
                            inStock ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          المتاح: {item.quantityOnHand ?? 0} {item.unit || 'حبة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <div className="text-xs font-mono font-bold text-[#2D6A4F]">
                      {formatCurrency(price, currency)}
                    </div>
                    <div className="text-[9px] text-neutral-400">
                      {isSales ? 'سعر البيع' : 'سعر الشراء'}
                    </div>
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
