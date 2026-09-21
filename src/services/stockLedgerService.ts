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
      let initialQty = 0;
      if (item.initialQuantity !== undefined && item.initialQuantity !== null && Number(item.initialQuantity) > 0) {
        initialQty = Number(item.initialQuantity);
      } else if ((item as any).openingBalance !== undefined && (item as any).openingBalance !== null && Number((item as any).openingBalance) > 0) {
        initialQty = Number((item as any).openingBalance);
      }

      // Check if storedMovements contains adjustments or records for this item that imply an opening balance
      const itemStoredMvs = storedMovements.filter(
        (m) => m.itemId === item.id || (item.sku && m.itemSku === item.sku)
      );

      if (initialQty <= 0 && itemStoredMvs.length > 0) {
        // Find the earliest recorded movement for this item
        const sortedItemMvs = [...itemStoredMvs].sort((a, b) => {
          const dtA = `${a.date} ${a.time || '00:00'}`;
          const dtB = `${b.date} ${b.time || '00:00'}`;
          return dtA.localeCompare(dtB);
        });
        const firstMv = sortedItemMvs[0];
        const qIn = Number(firstMv.quantityIn ?? (firstMv as any).qty_in ?? 0);
        const qOut = Number(firstMv.quantityOut ?? (firstMv as any).qty_out ?? 0);
        const balAfter = Number(firstMv.balanceAfter ?? 0);

        // Previous balance before earliest adjustment:
        // balAfter = prev + (qIn - qOut) => prev = balAfter - (qIn - qOut)
        const impliedPrev = balAfter - (qIn - qOut);
        if (impliedPrev > 0) {
          initialQty = impliedPrev;
        }
      }

      // Fallback: if initialQty is still 0 but item.quantityOnHand > 0 and no stored movements exist
      if (initialQty <= 0 && itemStoredMvs.length === 0 && Number(item.quantityOnHand || 0) > 0) {
        initialQty = Number(item.quantityOnHand);
      }

      if (initialQty > 0) {
        const unitCost = Number(item.purchasePrice || item.costPrice || 0);
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
          unitCost: unitCost,
          totalCostValue: Number((initialQty * unitCost).toFixed(3)),
          balanceValue: Number((initialQty * unitCost).toFixed(3)),
          warehouse: 'المستودع الرئيسي',
          notes: 'إثبات رصيد المخزون التأسيسي الأولي',
        });
      }
    });

    // B. Invoices (Sales, Purchases, Returns)
    invoices.forEach((inv) => {
      const invStatus = String(inv.status || '').trim().toUpperCase();
      const isCancelled =
        invStatus === 'CANCELLED' ||
        invStatus === 'VOID' ||
        invStatus === 'REVERSED' ||
        (inv.invoiceNumber && inv.invoiceNumber.toUpperCase().includes('CANCELLED'));

      if (!isCancelled) {
        const lines = inv.lines || (inv as any).items || [];
        lines.forEach((line: any) => {
          const matchedItem = inventory.find(
            (i) =>
              i.id === line.itemId ||
              (line.itemSku && (i.sku === line.itemSku || (i as any).code === line.itemSku)) ||
              (line.barcode && i.barcode === line.barcode) ||
              (line.itemNameAr && i.nameAr === line.itemNameAr)
          );

          // Check if item is linked to a parent/base item (for promotional offers/bundles)
          const linkedBaseId = matchedItem?.base_item_id || matchedItem?.baseItemId || (line as any).base_item_id;
          const targetBaseItem = linkedBaseId ? inventory.find((i) => i.id === linkedBaseId) : null;
          const isOfferLinked = Boolean(targetBaseItem && targetBaseItem.id !== matchedItem?.id);
          const effectiveItem = isOfferLinked ? targetBaseItem! : (matchedItem || line);
          const effectiveItemId = effectiveItem.id || line.itemId;

          const unitCost = Number(effectiveItem?.costPrice ?? effectiveItem?.purchasePrice ?? (line.unitPrice ? line.unitPrice * 0.7 : 0));
          
          // Determine exact physical quantity deducted from base item
          // If line.isOffer is true, line.quantity might already be multiplied; otherwise apply configured offer_quantity
          const configuredOfferQty = Number(matchedItem?.offer_quantity || matchedItem?.offerQuantity || (matchedItem?.nameAr?.includes('2 حبة') ? 2 : 1)) || 1;
          const bundleMultiplier = isOfferLinked && !line.isOffer
            ? configuredOfferQty
            : 1;
          const effectiveQty = (Number(line.quantity) || 1) * bundleMultiplier;

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

          const qtyIn = isInbound ? effectiveQty : 0;
          const qtyOut = isInbound ? 0 : effectiveQty;

          const movementNote = isOfferLinked
            ? `سحب عرض ترويجي [${line.itemNameAr}] - خصم (${effectiveQty}) ${effectiveItem.unit || 'حبة'} من الصنف الأساسي (${effectiveItem.nameAr})`
            : `${typeTitleAr} - الطرف: ${inv.entityNameAr || 'عميل / مورد'}`;

          generatedMovements.push({
            id: `mv-inv-${inv.id}-${line.id}`,
            date: inv.date || new Date().toISOString().slice(0, 10),
            time: '11:30',
            itemId: effectiveItemId,
            itemSku: effectiveItem?.sku || line.itemSku || effectiveItemId,
            itemNameAr: effectiveItem?.nameAr || line.itemNameAr || 'صنف مخزني',
            originalItemId: matchedItem?.id,
            originalItemSku: matchedItem?.sku,
            type: movementType as any,
            typeTitleAr,
            referenceDocNumber: inv.invoiceNumber,
            referenceDocType: docType,
            quantityIn: qtyIn,
            quantityOut: qtyOut,
            qty_in: qtyIn,
            qty_out: qtyOut,
            balanceAfter: 0, // Will be calculated chronologically
            unit: effectiveItem?.unit || line.unit || 'حبة',
            unitCost: unitCost,
            totalCostValue: effectiveQty * unitCost,
            warehouse: (inv as any).warehouseName || 'المستودع الرئيسي',
            notes: movementNote,
          } as any);
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

    // Comprehensive multi-criteria chronological sorting
    allMovements.sort((a, b) => {
      // 1. Date comparison
      const dateA = a.date || '2000-01-01';
      const dateB = b.date || '2000-01-01';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // 2. Time comparison
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeA.localeCompare(timeB);

      // 3. Opening balances strictly come first on that date
      if (a.type === 'OPENING' && b.type !== 'OPENING') return -1;
      if (b.type === 'OPENING' && a.type !== 'OPENING') return 1;

      // 4. Inbound movements (+ / توريد / فائض) strictly precede Outbound movements (- / صرف / عجز)
      // This guarantees stock balance does not dip below zero when inflow and outflow share the same minute
      const aIn = Number(a.quantityIn ?? (a as any).qty_in ?? 0);
      const bIn = Number(b.quantityIn ?? (b as any).qty_in ?? 0);
      const aIsInbound = aIn > 0 ? 1 : 0;
      const bIsInbound = bIn > 0 ? 1 : 0;
      if (aIsInbound !== bIsInbound) {
        return bIsInbound - aIsInbound;
      }

      // 5. Tie-breaker by referenceDocNumber or id
      const refA = a.referenceDocNumber || a.id || '';
      const refB = b.referenceDocNumber || b.id || '';
      return refA.localeCompare(refB);
    });

    // Calculate running balance per item with exact valuation
    const itemBalances: Record<string, number> = {};

    return allMovements.map((mv) => {
      const current = itemBalances[mv.itemId] || 0;
      const qIn = Number(mv.quantityIn ?? (mv as any).qty_in ?? 0);
      const qOut = Number(mv.quantityOut ?? (mv as any).qty_out ?? 0);
      let updated = current + (qIn - qOut);

      // Inventory quantity cannot physically dip below 0
      updated = Math.max(0, updated);

      itemBalances[mv.itemId] = updated;

      const unitCost = Number(mv.unitCost || 0);
      const movementQty = qIn > 0 ? qIn : qOut;
      const movementCostValue = Number((movementQty * unitCost).toFixed(3));
      const balanceVal = Number((updated * unitCost).toFixed(3));

      return {
        ...mv,
        quantityIn: qIn,
        quantityOut: qOut,
        qty_in: qIn,
        qty_out: qOut,
        balanceAfter: updated,
        totalCostValue: movementCostValue,
        balanceValue: balanceVal,
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
      const cost = Number(item.costPrice ?? item.purchasePrice ?? 0);
      const sale = Number(item.salePrice || 0);
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
   * Perform Stock Reconciliation (تسوية جردية فعلية ومباشرة)
   * Supports both Physical Count (جرد فعلي على الرف) and Direct Adjustment (تسوية مباشرة بالزيادة أو النقص +/-)
   */
  public static async reconcileStock(
    itemId: string,
    actualCountOrDelta: number,
    reason: string,
    operatorName: string = 'مدير المستودع',
    mode: 'PHYSICAL_COUNT' | 'DIRECT_ADJUSTMENT' = 'PHYSICAL_COUNT',
    warehouseId: string = 'wh-main-01'
  ): Promise<{ success: boolean; difference: number; newBalance: number; movement?: StockMovement }> {
    const inventory = await DataService.getInventory();
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, difference: 0, newBalance: 0 };

    // Ensure item has initialQuantity established so opening balance does not drift
    if (item.initialQuantity === undefined || item.initialQuantity === null) {
      item.initialQuantity = item.quantityOnHand || 0;
    }

    const currentBookQty = item.quantityOnHand || 0;
    let diff = 0;
    let targetBalance = 0;

    if (mode === 'DIRECT_ADJUSTMENT') {
      diff = Number(actualCountOrDelta) || 0;
      targetBalance = Math.max(0, currentBookQty + diff);
    } else {
      targetBalance = Math.max(0, Number(actualCountOrDelta) || 0);
      diff = targetBalance - currentBookQty;
    }

    if (diff === 0) {
      return { success: true, difference: 0, newBalance: currentBookQty };
    }

    const isSurplus = diff > 0;
    const absDiff = Math.abs(diff);
    const unitCost = Number(item.costPrice ?? item.purchasePrice ?? 0);
    const totalCostValue = Number((absDiff * unitCost).toFixed(3));

    const adjustmentMovement: StockMovement = {
      id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      itemId: item.id,
      itemSku: item.sku,
      itemNameAr: item.nameAr,
      type: 'STOCK_ADJUSTMENT',
      typeTitleAr: isSurplus ? 'تسوية جردية (فائض مخزني +)' : 'تسوية جردية (عجز مخزني -)',
      referenceDocNumber: `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      referenceDocType: 'محضر تسوية جردية',
      quantityIn: isSurplus ? absDiff : 0,
      quantityOut: !isSurplus ? absDiff : 0,
      qty_in: isSurplus ? absDiff : 0,
      qty_out: !isSurplus ? absDiff : 0,
      balanceAfter: targetBalance,
      unit: item.unit || 'حبة',
      unitCost: unitCost,
      totalCostValue: totalCostValue,
      balanceValue: Number((targetBalance * unitCost).toFixed(3)),
      warehouse: 'المستودع الرئيسي',
      notes: `${reason || 'تسوية فروقات الجرد الدوري'} [الرصيد الدفتري السابق: ${currentBookQty} | الرصيد المعتمد الجديد: ${targetBalance} | الفارق: ${diff > 0 ? `+${diff}` : diff}] - المنفذ: ${operatorName}`,
      createdBy: operatorName,
    };

    // 1. Save adjustment movement to stored history
    const stored = this.getStoredMovements();
    stored.push(adjustmentMovement);
    this.saveStoredMovements(stored);

    // 2. Update item quantity on hand and preserve initialQuantity
    await DataService.updateInventoryItem(itemId, {
      quantityOnHand: targetBalance,
      initialQuantity: item.initialQuantity,
    });

    // 3. Update Warehouse specific stock
    DataService.adjustWarehouseStock(warehouseId, item.id, diff);

    // 4. Sync stock balance with Supabase Cloud
    const activeCompanyId = item.companyId || (item as any).company_id || 'default';
    SupabaseDataService.adjustItemStock(
      item.id,
      item.sku,
      item.barcode,
      targetBalance,
      activeCompanyId,
      unitCost
    ).catch((e) => console.warn('Supabase adjustItemStock notice:', e));

    // 5. Automated IFRS Journal Entry for Stock Variance
    try {
      const resolved = DataService.getResolvedAccounts();
      const accounts = localDataStore.getAccounts();
      const isLeaf = (acc: any) => acc && !accounts.some((a) => a.parentId === acc.id);

      let invAcc = resolved.inventory;
      if (!isLeaf(invAcc)) {
        invAcc = accounts.find((a) => a.parentId === invAcc.id && isLeaf(a)) ||
                 accounts.find((a) => a.code.startsWith('113') && isLeaf(a)) || invAcc;
      }

      let varianceRevenueAcc = accounts.find((a) => (a.code === '4200' || a.code === '4101' || a.code === '4201') && isLeaf(a)) ||
                               accounts.find((a) => a.category === 'REVENUE' && isLeaf(a)) || resolved.sales;
      if (!isLeaf(varianceRevenueAcc)) {
        varianceRevenueAcc = accounts.find((a) => a.category === 'REVENUE' && isLeaf(a)) || varianceRevenueAcc;
      }

      let varianceExpenseAcc = accounts.find((a) => (a.code === '5200' || a.code === '5101' || a.code === '5201') && isLeaf(a)) ||
                               accounts.find((a) => a.category === 'EXPENSE' && isLeaf(a)) || resolved.cogs;
      if (!isLeaf(varianceExpenseAcc)) {
        varianceExpenseAcc = accounts.find((a) => a.category === 'EXPENSE' && isLeaf(a)) || varianceExpenseAcc;
      }

      if (totalCostValue > 0 && isLeaf(invAcc) && (isSurplus ? isLeaf(varianceRevenueAcc) : isLeaf(varianceExpenseAcc))) {
        const jLines = isSurplus
          ? [
              {
                id: 'jl-adj-1',
                accountId: invAcc.id,
                accountCode: invAcc.code,
                accountNameAr: invAcc.nameAr,
                debit: totalCostValue,
                credit: 0,
                memo: `إثبات زيادة وفائض جرد مخزني - محضر ${adjustmentMovement.referenceDocNumber} (${item.nameAr})`,
              },
              {
                id: 'jl-adj-2',
                accountId: varianceRevenueAcc.id,
                accountCode: varianceRevenueAcc.code,
                accountNameAr: varianceRevenueAcc.nameAr || 'أرباح وفروقات جرد المخزون',
                debit: 0,
                credit: totalCostValue,
                memo: `أرباح وفروقات الجرد الفعلي للمخزون - صنف ${item.nameAr}`,
              },
            ]
          : [
              {
                id: 'jl-adj-1',
                accountId: varianceExpenseAcc.id,
                accountCode: varianceExpenseAcc.code,
                accountNameAr: varianceExpenseAcc.nameAr || 'خسائر وعجز جرد المخزون والتالف',
                debit: totalCostValue,
                credit: 0,
                memo: `إثبات عجز وفروقات جرد مخزني - محضر ${adjustmentMovement.referenceDocNumber} (${item.nameAr})`,
              },
              {
                id: 'jl-adj-2',
                accountId: invAcc.id,
                accountCode: invAcc.code,
                accountNameAr: invAcc.nameAr,
                debit: 0,
                credit: totalCostValue,
                memo: `تخفيض المخزون بعجز الجرد - صنف ${item.nameAr}`,
              },
            ];

        await DataService.createJournal({
          date: adjustmentMovement.date,
          reference: adjustmentMovement.referenceDocNumber,
          description: `قيد تسوية جردية - ${item.nameAr} (${adjustmentMovement.typeTitleAr})`,
          status: 'POSTED',
          lines: jLines as any,
          companyId: activeCompanyId,
        });
      }
    } catch (err) {
      console.warn('Reconciliation journal entry creation notice:', err);
    }

    return { success: true, difference: diff, newBalance: targetBalance, movement: adjustmentMovement };
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
