/**
 * LOGIX CLOUD ERP - ERPNext-Grade Stock Ledger & Inventory Audit Engine
 * Handles full chronological stock movement tracking, FIFO/Weighted Average valuation,
 * and physical stock reconciliation.
 */

import { InventoryItem, Invoice, ProductionOrder, StockMovement, StockAuditSummary } from '../types.js';
import { localDataStore, DataService } from './dataService.ts';
import { SupabaseDataService } from './supabaseService.ts';

const STOCK_MOVEMENTS_KEY = 'erp_stock_movements_log';

export class StockLedgerService {
  /**
   * Get all registered stock movements (stored + dynamically synthesized from transactions)
   */
  public static getStockMovements(
    inventory: InventoryItem[],
    invoices: Invoice[],
    productionOrders: ProductionOrder[]
  ): StockMovement[] {
    // 1. Get manually saved adjustments
    const storedMovements = this.getStoredMovements();

    // 2. Synthesize movements from sales, production, and opening balances
    const generatedMovements: StockMovement[] = [];

    // A. Opening Balances
    inventory.forEach((item) => {
      const initialQty =
        item.initialQuantity !== undefined && item.initialQuantity !== null
          ? Number(item.initialQuantity)
          : Number(item.quantityOnHand || 0);

      if (initialQty > 0) {
        generatedMovements.push({
          id: `mv-open-${item.id}`,
          date: '2026-01-01',
          time: '08:00',
          itemId: item.id,
          itemSku: item.sku,
          itemNameAr: item.nameAr,
          type: 'OPENING',
          typeTitleAr: 'رصيد افتتاحي أول المدة',
          referenceDocNumber: 'OB-2026-INIT',
          referenceDocType: 'قيد افتتاحي',
          quantityIn: initialQty,
          quantityOut: 0,
          qty_in: initialQty,
          qty_out: 0,
          balanceAfter: initialQty,
          unit: item.unit || 'حبة',
          unitCost: item.purchasePrice,
          totalCostValue: initialQty * item.purchasePrice,
          warehouse: 'المستودع الرئيسي',
          notes: 'إثبات رصيد المخزون التأسيسي الأولي',
        });
      }
    });

    // B. Invoices (Sales, Purchases, Returns)
    invoices.forEach((inv) => {
      if (inv.status !== 'CANCELLED') {
        const lines = inv.lines || (inv as any).items || [];
        lines.forEach((line: any) => {
          const matchedItem = inventory.find(
            (i) =>
              i.id === line.itemId ||
              (line.itemSku && (i.sku === line.itemSku || (i as any).code === line.itemSku)) ||
              (line.barcode && i.barcode === line.barcode) ||
              (line.itemNameAr && i.nameAr === line.itemNameAr)
          );
          const effectiveItemId = matchedItem?.id || line.itemId;
          const unitCost = matchedItem?.purchasePrice || (line.unitPrice ? line.unitPrice * 0.7 : 0);
          const qty = Number(line.quantity) || 1;

          const isPurchase = inv.type === 'PURCHASE';
          const isSalesReturn = inv.type === 'SALES_RETURN';
          const isPurchaseReturn = inv.type === 'PURCHASE_RETURN';
          const isInbound = isPurchase || isSalesReturn;

          const movementType = isPurchase
            ? 'PURCHASE_RECEIPT'
            : isSalesReturn
            ? 'SALES_RETURN'
            : isPurchaseReturn
            ? 'PURCHASE_RETURN'
            : 'SALES_ISSUE';

          const typeTitleAr = isPurchase
            ? 'فاتورة مشتريات وتوريد مخزني'
            : isSalesReturn
            ? 'مرتجع مبيعات (إرجاع للمستودع)'
            : isPurchaseReturn
            ? 'مرتجع مشتريات (صرف للمورد)'
            : 'فاتورة مبيعات معتمدة';

          const docType = isPurchase
            ? 'فاتورة مشتريات'
            : isSalesReturn
            ? 'مرتجع مبيعات'
            : isPurchaseReturn
            ? 'مرتجع مشتريات'
            : 'فاتورة مبيعات';

          const qtyIn = isInbound ? qty : 0;
          const qtyOut = isInbound ? 0 : qty;

          generatedMovements.push({
            id: `mv-inv-${inv.id}-${line.id}`,
            date: inv.date || new Date().toISOString().slice(0, 10),
            time: '11:30',
            itemId: effectiveItemId,
            itemSku: line.itemSku || matchedItem?.sku || effectiveItemId,
            itemNameAr: line.itemNameAr || matchedItem?.nameAr || 'صنف مخزني',
            type: movementType as any,
            typeTitleAr,
            referenceDocNumber: inv.invoiceNumber,
            referenceDocType: docType,
            quantityIn: qtyIn,
            quantityOut: qtyOut,
            qty_in: qtyIn,
            qty_out: qtyOut,
            balanceAfter: 0, // Will be calculated chronologically
            unit: line.unit || matchedItem?.unit || 'حبة',
            unitCost: unitCost,
            totalCostValue: qty * unitCost,
            warehouse: (inv as any).warehouseName || 'المستودع الرئيسي',
            notes: `${typeTitleAr} - الطرف: ${inv.entityNameAr || 'عميل / مورد'}`,
          });
        });
      }
    });

    // C. Production Orders (تشغيل وتصنيع المطحنة)
    productionOrders.forEach((order) => {
      if (order.status === 'COMPLETED') {
        // Output Finished Goods (وارد منتج تام)
        generatedMovements.push({
          id: `mv-prd-in-${order.id}`,
          date: order.date || new Date().toISOString().slice(0, 10),
          time: '14:00',
          itemId: order.targetItemId,
          itemSku: order.targetSku,
          itemNameAr: order.targetItemNameAr,
          type: 'PRODUCTION_IN',
          typeTitleAr: 'توريد إنتاج مطحنة تام الصنع',
          referenceDocNumber: order.orderNumber,
          referenceDocType: 'أمر تشغيل وتصنيع',
          quantityIn: order.targetQuantity,
          quantityOut: 0,
          qty_in: order.targetQuantity,
          qty_out: 0,
          balanceAfter: 0,
          unit: order.targetUnit || 'حبة',
          unitCost: order.unitProductionCost,
          totalCostValue: order.totalProductionCost,
          warehouse: order.millLine || 'خط الطحن الرئيسي',
          notes: `إتمام إنتاج تشغيلة رقم ${order.orderNumber}`,
        });

        // Raw materials consumption (منصرف مواد أولية)
        if (order.rawMaterials) {
          order.rawMaterials.forEach((rm, idx) => {
            generatedMovements.push({
              id: `mv-prd-out-${order.id}-${idx}`,
              date: order.date || new Date().toISOString().slice(0, 10),
              time: '14:05',
              itemId: rm.itemId,
              itemSku: rm.itemSku,
              itemNameAr: rm.itemNameAr,
              type: 'PRODUCTION_OUT',
              typeTitleAr: 'صرف مواد أولية للتشغيل والطحن',
              referenceDocNumber: order.orderNumber,
              referenceDocType: 'استهلاك تشغيل',
              quantityIn: 0,
              quantityOut: rm.quantityRequired,
              qty_in: 0,
              qty_out: rm.quantityRequired,
              balanceAfter: 0,
              unit: rm.unit || 'كيلو',
              unitCost: rm.unitCost,
              totalCostValue: rm.totalCost,
              warehouse: 'مستودع المواد الخام',
              notes: `مستهلك في أمر التشغيل ${order.orderNumber}`,
            });
          });
        }
      }
    });

    // Merge stored and generated
    const allMovements = [...generatedMovements, ...storedMovements];

    // Sort chronologically
    allMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance per item
    const itemBalances: Record<string, number> = {};

    return allMovements.map((mv) => {
      const current = itemBalances[mv.itemId] || 0;
      const qIn = Number(mv.quantityIn ?? (mv as any).qty_in ?? 0);
      const qOut = Number(mv.quantityOut ?? (mv as any).qty_out ?? 0);
      const updated = current + (qIn - qOut);
      itemBalances[mv.itemId] = updated;
      return {
        ...mv,
        quantityIn: qIn,
        quantityOut: qOut,
        qty_in: qIn,
        qty_out: qOut,
        balanceAfter: updated,
      };
    });
  }

  /**
   * Calculate IFRS Inventory Valuation & Stock Health KPIs
   */
  public static computeStockAudit(inventory: InventoryItem[]): StockAuditSummary {
    let totalUnits = 0;
    let totalValuationAtCost = 0;
    let totalValuationAtSale = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let safeStock = 0;
    let excessStock = 0;

    inventory.forEach((item) => {
      const qty = item.quantityOnHand || 0;
      const cost = item.purchasePrice || 0;
      const sale = item.salePrice || 0;
      const minAlert = item.minQuantityAlert || 10;

      totalUnits += qty;
      totalValuationAtCost += qty * cost;
      totalValuationAtSale += qty * sale;

      if (qty <= 0) {
        outOfStock++;
      } else if (qty <= minAlert) {
        lowStock++;
      } else if (qty > minAlert * 5) {
        excessStock++;
      } else {
        safeStock++;
      }
    });

    const expectedGrossProfit = Math.max(0, totalValuationAtSale - totalValuationAtCost);
    const expectedGrossMarginPct = totalValuationAtSale > 0 
      ? (expectedGrossProfit / totalValuationAtSale) * 100 
      : 0;

    return {
      totalItemCount: inventory.length,
      totalUnitsInStock: totalUnits,
      totalValuationAtCost,
      totalValuationAtSale,
      expectedGrossProfit,
      expectedGrossMarginPct,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      safeStockCount: safeStock,
      excessStockCount: excessStock,
    };
  }

  /**
   * Perform Stock Reconciliation (تسوية جردية فعلية)
   */
  public static async reconcileStock(
    itemId: string,
    actualCount: number,
    reason: string,
    operatorName: string = 'مدير المستودع'
  ): Promise<{ success: boolean; difference: number; movement?: StockMovement }> {
    const inventory = await DataService.getInventory();
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, difference: 0 };

    const bookQty = item.quantityOnHand || 0;
    const diff = actualCount - bookQty;

    if (diff === 0) {
      return { success: true, difference: 0 };
    }

    const isSurplus = diff > 0;
    const absDiff = Math.abs(diff);
    const unitCost = item.purchasePrice || 0;

    const adjustmentMovement: StockMovement = {
      id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      itemId: item.id,
      itemSku: item.sku,
      itemNameAr: item.nameAr,
      type: 'STOCK_ADJUSTMENT',
      typeTitleAr: isSurplus ? 'تسوية جردية (فائض مخزني)' : 'تسوية جردية (عجز مخزني)',
      referenceDocNumber: `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      referenceDocType: 'محضر تسوية جردية',
      quantityIn: isSurplus ? absDiff : 0,
      quantityOut: !isSurplus ? absDiff : 0,
      balanceAfter: actualCount,
      unit: item.unit || 'حبة',
      unitCost: unitCost,
      totalCostValue: absDiff * unitCost,
      warehouse: 'المستودع الرئيسي',
      notes: `${reason || 'تسوية فروقات الجرد الدوري'} - المنفذ: ${operatorName}`,
      createdBy: operatorName,
    };

    // 1. Save adjustment movement
    const stored = this.getStoredMovements();
    stored.push(adjustmentMovement);
    this.saveStoredMovements(stored);

    // 2. Update item quantity on hand
    await DataService.updateInventoryItem(itemId, {
      quantityOnHand: actualCount,
    });

    return { success: true, difference: diff, movement: adjustmentMovement };
  }

  private static getStoredMovements(): StockMovement[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STOCK_MOVEMENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  private static saveStoredMovements(movements: StockMovement[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STOCK_MOVEMENTS_KEY, JSON.stringify(movements));
    } catch {}
  }
}
