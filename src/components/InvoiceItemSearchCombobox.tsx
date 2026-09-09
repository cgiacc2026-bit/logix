import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Package, Check, ChevronDown, Sparkles, Barcode } from 'lucide-react';
import { InventoryItem, InvoiceType } from '../types.js';
import { filterAndRankEntities } from '../utils/searchUtils.ts';
import { formatCurrency } from '../utils/formatters.ts';

export interface InvoiceItemSearchComboboxProps {
  inventory: InventoryItem[];
  selectedItemId: string;
  selectedItemName?: string;
  selectedSku?: string;
  selectedBarcode?: string;
  onSelectItem: (item: InventoryItem) => void;
  onCustomNameChange?: (name: string) => void;
  invType?: InvoiceType;
  currency?: string;
  placeholder?: string;
}

export const InvoiceItemSearchCombobox: React.FC<InvoiceItemSearchComboboxProps> = ({
  inventory = [],
  selectedItemId,
  selectedItemName = '',
  selectedSku = '',
  selectedBarcode = '',
  onSelectItem,
  onCustomNameChange,
  invType = 'SALES',
  currency = 'KWD',
  placeholder = 'انقر لعرض كافة الأصناف أو اكتب للبحث بالاسم/الكود...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number; width: number }>({
    top: 0,
    right: 0,
    width: 520,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [inventory, selectedItemId]);

  // When dropdown is closed, show selected item name or custom name.
  // When dropdown is open, show what the user is typing in `query`.
  const inputValue = isOpen ? query : selectedItem ? selectedItem.nameAr : selectedItemName;

  // Real-time fuzzy, wildcard search across all inventory items for the active company
  // When query is empty or whitespace, filterAndRankEntities returns ALL items in full!
  const filteredItems = useMemo(() => {
    const results = filterAndRankEntities(inventory, query, {
      primary: (i) => i.nameAr,
      secondary: (i) => `${i.nameEn || ''} ${i.description || ''}`,
      fallbackCode: (i) => `${i.sku || ''} ${i.barcode || ''} ${i.category || ''} ${i.id || ''}`,
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

  // Update fixed portal position based on input bounding client rect
  const updateDropdownPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(Math.max(rect.width, 520), window.innerWidth - 16);
    
    // In RTL, align right edge of dropdown with right edge of input, ensuring it stays on screen
    let right = window.innerWidth - rect.right;
    if (right < 8) right = 8;
    if (window.innerWidth - right < dropdownWidth) {
      right = Math.max(8, window.innerWidth - dropdownWidth - 8);
    }

    // Vertical positioning: default below input, or above if near screen bottom
    const spaceBelow = window.innerHeight - rect.bottom;
    let top = rect.bottom + 4;
    if (spaceBelow < 280 && rect.top > 300) {
      top = Math.max(10, rect.top - 324);
    }

    setDropdownPos({
      top,
      right,
      width: dropdownWidth,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Click outside to close (checks both input container and portal menu)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
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
            // Wildcard behavior: show all available company items immediately on focus
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
            title="عرض كافة الأصناف المتاحة للشركة"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Suggestions Dropdown rendered via Portal to prevent table clipping */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            right: `${dropdownPos.right}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 999999,
          }}
          className="bg-white border-2 border-[#D4AF37] rounded-xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-[#F1EFEA] animate-in fade-in zoom-in-95 duration-100 text-xs text-right dir-rtl"
        >
          {/* Header with scope and count */}
          <div className="p-2 bg-[#FAF9F6] border-b border-[#E5E1DA] text-[10px] font-bold text-neutral-600 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-1.5">
              <span>
                {query.trim()
                  ? `نتائج البحث عن "${query}" (${filteredItems.length} من ${inventory.length})`
                  : `أصناف الشركة النشطة (${inventory.length} صنف متاح)`}
              </span>
              {!query.trim() && (
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  عرض شامل
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#D4AF37] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              بحث مزدوج بالكود والاسم
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
                    className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-[#D4AF37] text-[#8C6D1F] rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>+ اعتماد &ldquo;{query}&rdquo; كبند مخصص للفاتورة</span>
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
                  className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors border-b border-[#F5F2EB] last:border-b-0 ${
                    isHighlighted ? 'bg-amber-50/90' : isSelected ? 'bg-amber-50/50' : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-start gap-2.5 overflow-hidden flex-1">
                    {/* Status Icon */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#D4AF37] text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Package className="w-3.5 h-3.5" />}
                    </div>

                    {/* Content: Row 1 = Code & Barcode & Category, Row 2 = Name & Description */}
                    <div className="truncate flex-1">
                      {/* السطر الأول: كود الصنف / الباركود / التصنيف */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-slate-500" />
                          <span>كود: {item.sku || item.id}</span>
                        </span>
                        {item.barcode && (
                          <span className="font-mono text-[9px] text-neutral-600 bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 rounded">
                            باركود: {item.barcode}
                          </span>
                        )}
                        {item.category && (
                          <span className="text-[9px] font-bold text-amber-900 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold">
                            محدد حالياً
                          </span>
                        )}
                      </div>

                      {/* السطر الثاني: اسم الصنف والبيان التفصيلي */}
                      <div className="mt-1 flex items-center gap-1.5 truncate">
                        <span className="font-extrabold text-xs text-[#1A1A1A]">{item.nameAr}</span>
                        {item.nameEn && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({item.nameEn})
                          </span>
                        )}
                        {item.description && (
                          <span className="text-[10px] text-neutral-400 truncate max-w-[200px]">
                            • {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left Side (RTL End): Price, Unit, Stock on Hand */}
                  <div className="text-left shrink-0 pl-1 pr-3 flex flex-col items-end">
                    <div className="text-xs font-mono font-bold text-[#2D6A4F]">
                      {formatCurrency(price, currency)}
                    </div>
                    <div className="text-[9px] text-neutral-400">
                      {isSales ? 'سعر البيع' : 'سعر الشراء'}
                    </div>
                    <div className="mt-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block ${
                          inStock
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        المتاح: {item.quantityOnHand ?? 0} {item.unit || 'حبة'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
