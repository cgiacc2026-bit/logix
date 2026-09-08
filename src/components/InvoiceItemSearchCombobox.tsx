import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Package, Check, ChevronDown } from 'lucide-react';
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
  placeholder = 'ابحث باسم الصنف مباشرة...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [inventory, selectedItemId]);

  // Keep query in sync with selectedItem name when closed
  const displayValue = isOpen ? query : selectedItem ? selectedItem.nameAr : selectedItemName;

  // Filtered and ranked items by normalized Arabic & English name search
  const filteredItems = useMemo(() => {
    return filterAndRankEntities(inventory, query, {
      primary: (i) => i.nameAr,
      secondary: (i) => i.nameEn,
      fallbackCode: (i) => `${i.sku || ''} ${i.barcode || ''} ${i.category || ''}`,
    });
  }, [inventory, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setQuery(displayValue);
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
      if (filteredItems[highlightedIndex]) {
        handleSelect(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isSales = invType === 'SALES' || invType === 'SALES_RETURN';

  return (
    <div className="relative w-full text-right dir-rtl" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (onCustomNameChange) onCustomNameChange(val);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery(selectedItem ? selectedItem.nameAr : selectedItemName);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-[#FAF9F6] border rounded-lg pr-7 pl-6 py-1 font-bold text-black text-xs outline-none transition-all ${
            isOpen ? 'border-[#D4AF37] bg-white ring-1 ring-[#D4AF37]/30' : 'border-[#E5E1DA]'
          }`}
        />
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2 pointer-events-none" />

        {displayValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
            title="مسح واختيار صنف آخر"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="absolute left-2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 w-80 sm:w-96 bg-white border border-[#E5E1DA] rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-[#F1EFEA] animate-in fade-in zoom-in-95 duration-100 text-xs">
          <div className="p-2 bg-[#FAF9F6] border-b border-[#E5E1DA] text-[10px] font-bold text-neutral-500 flex items-center justify-between">
            <span>
              أصناف الشركة النشطة ({filteredItems.length} من أصل {inventory.length})
            </span>
            <span className="text-[10px] text-[#D4AF37] font-semibold">بحث بالاسم</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-3 text-center text-neutral-500 font-medium text-xs">
              <p>لا يوجد صنف يطابق &ldquo;{query}&rdquo;</p>
              {query && (
                <p className="text-[10px] text-neutral-400 mt-1">
                  يمكنك الاستمرار بكتابة هذا الوصف كبند مخصص للفاتورة
                </p>
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
                  className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-amber-50/70' : isSelected ? 'bg-amber-50/30' : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#D4AF37] text-white'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-[#1A1A1A] flex items-center gap-1.5 truncate">
                        <span>{item.nameAr}</span>
                        {item.nameEn && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({item.nameEn})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-neutral-400">
                          {item.sku || 'بدون رمز'}
                        </span>
                        <span className="text-neutral-300">|</span>
                        <span className="text-neutral-600">الوحدة: {item.unit || 'حبة'}</span>
                        <span className="text-neutral-300">|</span>
                        <span
                          className={`font-semibold ${
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
