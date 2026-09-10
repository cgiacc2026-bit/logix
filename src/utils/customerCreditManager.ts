import { Customer, CustomerCreditEvaluation } from '../types.js';

/**
 * Smart Customer Profile & Credit Risk Engine
 * Computes live credit exposure, credit limit breaches, and tax compliance status.
 */
export function evaluateCustomerCredit(
  customer: Customer | null | undefined,
  newTransactionAmount: number = 0
): CustomerCreditEvaluation {
  if (!customer) {
    return {
      status: 'NORMAL',
      currentBalance: 0,
      creditLimit: 0,
      availableCredit: 0,
      utilizationRate: 0,
      requiresSupervisorOverride: false,
      message: 'عميل نقدي عام (كاش)',
    };
  }

  const currentBalance = Number(customer.balance || customer.currentBalance) || 0;
  const creditLimit = Number(customer.creditLimit) || 0;
  const potentialTotal = currentBalance + newTransactionAmount;

  // If customer has no credit limit specified (0 or undefined), default to cash only or warning if unpaid balance
  if (creditLimit <= 0) {
    if (newTransactionAmount > 0) {
      return {
        status: 'WARNING',
        currentBalance,
        creditLimit: 0,
        availableCredit: 0,
        utilizationRate: 100,
        requiresSupervisorOverride: true,
        message: 'العميل ليس لديه سقف ائتماني محدد (البيع الآجل يتطلب موافقة المشرف)',
      };
    }
    return {
      status: 'NORMAL',
      currentBalance,
      creditLimit: 0,
      availableCredit: 0,
      utilizationRate: 0,
      requiresSupervisorOverride: false,
      message: 'عميل نقدي معتمد',
    };
  }

  const availableCredit = Math.max(0, creditLimit - currentBalance);
  const utilizationRate = Math.round((potentialTotal / creditLimit) * 100);

  if (potentialTotal > creditLimit) {
    const excess = potentialTotal - creditLimit;
    return {
      status: 'EXCEEDED',
      currentBalance,
      creditLimit,
      availableCredit: 0,
      utilizationRate,
      requiresSupervisorOverride: true,
      message: `تجاوز السقف الائتماني بمقدار ${excess.toFixed(3)} د.ك (السقف: ${creditLimit.toFixed(3)} د.ك - الرصيد الحالي: ${currentBalance.toFixed(3)} د.ك). يلزم إذن المشرف.`,
    };
  }

  if (utilizationRate >= 80) {
    return {
      status: 'WARNING',
      currentBalance,
      creditLimit,
      availableCredit: creditLimit - potentialTotal,
      utilizationRate,
      requiresSupervisorOverride: false,
      message: `تنبيه ائتماني: استهلاك الائتمان وصل إلى ${utilizationRate}% من الحد المسموح.`,
    };
  }

  return {
    status: 'NORMAL',
    currentBalance,
    creditLimit,
    availableCredit: creditLimit - potentialTotal,
    utilizationRate,
    requiresSupervisorOverride: false,
    message: `الوضع الائتماني سليم (المتاح: ${(creditLimit - potentialTotal).toFixed(3)} د.ك)`,
  };
}
