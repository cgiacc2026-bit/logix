/**
 * IAS-2 Compliant Moving Weighted Average Costing (MAC) Engine
 * International Accounting Standard 2 (IAS 2) - Inventories
 *
 * Implements strict moving weighted average valuation for inventory in ERP systems.
 * Precision: 3 decimal places for Kuwaiti Dinar (KWD: 0.000).
 */

export interface CostCalculationResult {
  previousQuantity: number;
  previousAverageCost: number;
  incomingQuantity: number;
  purchaseUnitPrice: number;
  newQuantity: number;
  newAverageCost: number;
  totalValuation: number;
}

export class IAS2CostingEngine {
  /**
   * Currency decimal places (KWD uses 3 decimals: 0.000)
   */
  public static readonly PRECISION = 3;

  /**
   * Round to 3 decimal places (e.g. 1.2345 -> 1.235)
   */
  public static roundToPrecision(amount: number, precision: number = IAS2CostingEngine.PRECISION): number {
    const factor = Math.pow(10, precision);
    return Math.round((Number(amount) || 0) * factor) / factor;
  }

  /**
   * Calculates the Moving Weighted Average Cost upon a new purchase / stock-in according to IAS 2:
   *
   * Formula:
   * New Average Cost = (Current Stock Quantity × Current Average Cost + Incoming Quantity × Purchase Unit Price) / (Current Stock Quantity + Incoming Quantity)
   *
   * Edge cases:
   * 1. If Current Stock Quantity <= 0: The new incoming purchase unit price becomes the new average cost directly.
   * 2. If Incoming Quantity <= 0: Average cost remains unchanged.
   * 3. Division by zero protection: Returns purchase price if denominator <= 0.
   */
  public static calculateMovingAverageCost(
    currentStockQty: number,
    currentAverageCost: number,
    incomingQty: number,
    purchaseUnitPrice: number
  ): number {
    const q0 = Number(currentStockQty) || 0;
    const c0 = Number(currentAverageCost) || 0;
    const qIn = Number(incomingQty) || 0;
    const pIn = Number(purchaseUnitPrice) || 0;

    // No incoming stock or negative incoming
    if (qIn <= 0) {
      return this.roundToPrecision(c0);
    }

    // Edge Case: If existing stock is zero or negative (e.g. backorders),
    // IAS 2 stipulates the latest purchase price becomes the new base unit cost.
    if (q0 <= 0) {
      return this.roundToPrecision(pIn);
    }

    const currentValuation = q0 * c0;
    const incomingValuation = qIn * pIn;
    const totalQty = q0 + qIn;

    if (totalQty <= 0) {
      return this.roundToPrecision(pIn);
    }

    const rawNewAvgCost = (currentValuation + incomingValuation) / totalQty;
    return this.roundToPrecision(rawNewAvgCost);
  }

  /**
   * Detailed calculation returning all intermediate audit values for financial logging
   */
  public static computeDetailedPurchaseCost(
    currentStockQty: number,
    currentAverageCost: number,
    incomingQty: number,
    purchaseUnitPrice: number
  ): CostCalculationResult {
    const q0 = Number(currentStockQty) || 0;
    const c0 = Number(currentAverageCost) || 0;
    const qIn = Number(incomingQty) || 0;
    const pIn = Number(purchaseUnitPrice) || 0;

    const newAvgCost = this.calculateMovingAverageCost(q0, c0, qIn, pIn);
    const newQty = q0 <= 0 ? qIn : q0 + qIn;
    const totalValuation = this.roundToPrecision(newQty * newAvgCost);

    return {
      previousQuantity: q0,
      previousAverageCost: this.roundToPrecision(c0),
      incomingQuantity: qIn,
      purchaseUnitPrice: this.roundToPrecision(pIn),
      newQuantity: newQty,
      newAverageCost: newAvgCost,
      totalValuation,
    };
  }

  /**
   * Calculates Cost of Goods Sold (COGS) on Sales / POS.
   * On sales, the unit cost DOES NOT change (IAS 2 mandate).
   * Only quantity decreases and COGS is recognized at the moving average cost.
   *
   * Accounting Journal:
   * Dr. COGS (5100 تكلفة البضاعة المباعة)
   *   Cr. Inventory (1130 المخزون)
   * Amount = (Sold Quantity × Unit Moving Average Cost)
   */
  public static calculateCOGS(soldQty: number, currentAverageCost: number): number {
    const q = Math.max(0, Number(soldQty) || 0);
    const c = Math.max(0, Number(currentAverageCost) || 0);
    return this.roundToPrecision(q * c);
  }

  /**
   * Calculates Sales Return inventory valuation.
   * Goods return to inventory at their original unit cost when sold.
   *
   * Accounting Journal (Reversal):
   * Dr. Inventory (1130 المخزون)
   *   Cr. COGS (5100 تكلفة البضاعة المباعة)
   * Amount = (Returned Quantity × Unit Cost)
   */
  public static calculateSalesReturnValuation(returnedQty: number, unitCost: number): number {
    const q = Math.max(0, Number(returnedQty) || 0);
    const c = Math.max(0, Number(unitCost) || 0);
    return this.roundToPrecision(q * c);
  }
}
