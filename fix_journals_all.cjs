const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const targetStart = `    let jLines = [];`;
const targetEnd = `    const jEntry: JournalEntry = {`;

const newJournalLogic = `
    let jLines = [];
    
    // =========================================================================
    // [ARCHITECT] IFRS Compliant Automated Journal Entry Generation
    // =========================================================================
    
    if (isSales) {
      const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      
      // 1. Debit Cash / Accounts Receivable
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr,
          debit: paidAmount, credit: 0, memo: \`دفعة نقدية مسددة - فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\`,
        });
        jLines.push({
          id: 'jl-2', accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr,
          debit: dueAmount, credit: 0, memo: \`المبلغ الآجل المستحق - فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr,
          debit: grandTotal, credit: 0, memo: \`فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\`,
        });
      }
      
      // 2. Credit Sales Revenue
      jLines.push({
        id: \`jl-\${jLines.length + 1}\`, accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr,
        debit: 0, credit: netRevenue, memo: \`إيراد مبيعات فاتورة \${invoiceNumber}\`,
      });
      
      // 3. Credit VAT Payable (if applicable)
      if (computedVatTotal > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr,
          debit: 0, credit: computedVatTotal, memo: \`ضريبة القيمة المضافة المحصلة - فاتورة \${invoiceNumber}\`,
        });
      }

      // 4. COGS & Inventory (Perpetual Inventory)
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        const cost = invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0;
        return sum + (cost * line.quantity);
      }, 0);
      
      if (totalCost > 0) {
        jLines.push({ // Debit COGS
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr,
          debit: totalCost, credit: 0, memo: \`تكلفة بضاعة مباعة - فاتورة \${invoiceNumber}\`,
        });
        jLines.push({ // Credit Inventory
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr,
          debit: 0, credit: totalCost, memo: \`تخفيض المخزون المباع - فاتورة \${invoiceNumber}\`,
        });
      }
    } else if (isSalesReturn) {
      const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      
      // 1. Debit Sales Returns (Revenue Contra Account)
      jLines.push({
        id: 'jl-1', accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr,
        debit: netRevenue, credit: 0, memo: \`مردودات ومسموحات المبيعات \${invoiceNumber} - \${entityNameAr}\`,
      });
      
      // 2. Debit VAT Payable (reversing VAT collected)
      if (computedVatTotal > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr,
          debit: computedVatTotal, credit: 0, memo: \`عكس ضريبة مبيعات مرتجعة - مرتجع \${invoiceNumber}\`,
        });
      }

      // 3. Credit Cash / Accounts Receivable
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr,
          debit: 0, credit: paidAmount, memo: \`رد نقدي مسدد للعميل - مرتجع مبيعات \${invoiceNumber}\`,
        });
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr,
          debit: 0, credit: dueAmount, memo: \`تخفيض حساب العميل الآجل \${entityNameAr}\`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr,
          debit: 0, credit: grandTotal, memo: \`تخفيض رصيد حساب العميل \${entityNameAr}\`,
        });
      }
      
      // 4. Reverse COGS & Inventory
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        const cost = invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0;
        return sum + (cost * line.quantity);
      }, 0);
      if (totalCost > 0) {
        jLines.push({ // Debit Inventory
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr,
          debit: totalCost, credit: 0, memo: \`رد بضاعة للمخزون - مرتجع \${invoiceNumber}\`,
        });
        jLines.push({ // Credit COGS
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr,
          debit: 0, credit: totalCost, memo: \`تخفيض تكلفة بضاعة مباعة - مرتجع \${invoiceNumber}\`,
        });
      }
    } else if (isPurchase) {
      const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);
      
      // Debit Inventory (Asset)
      jLines.push({
        id: 'jl-1', accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr,
        debit: netPurchase, credit: 0, memo: \`شراء بضاعة للمخزون - فاتورة \${invoiceNumber} - \${entityNameAr}\`,
      });
      
      // Debit VAT Receivable (if applicable)
      if (computedVatTotal > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr,
          debit: computedVatTotal, credit: 0, memo: \`ضريبة القيمة المضافة المدفوعة - فاتورة \${invoiceNumber}\`,
        });
      }

      // Credit Cash/Bank or Accounts Payable
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr,
          debit: 0, credit: paidAmount, memo: \`دفعة نقدية لمورد - فاتورة مشتريات \${invoiceNumber}\`,
        });
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr,
          debit: 0, credit: dueAmount, memo: \`مبلغ آجل مستحق للمورد - فاتورة مشتريات \${invoiceNumber}\`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr,
          debit: 0, credit: grandTotal, memo: \`سداد فاتورة مشتريات \${invoiceNumber} - \${entityNameAr}\`,
        });
      }
    } else { // PURCHASE_RETURN
      const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);

      // Debit Cash / Accounts Payable (Supplier)
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({
          id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr,
          debit: paidAmount, credit: 0, memo: \`استرداد نقدي من المورد - مرتجع مشتريات \${invoiceNumber}\`,
        });
        jLines.push({
          id: 'jl-2', accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr,
          debit: dueAmount, credit: 0, memo: \`تخفيض حساب المورد الآجل - \${entityNameAr}\`,
        });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({
          id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr,
          debit: grandTotal, credit: 0, memo: \`تخفيض حساب المورد - مرتجع \${invoiceNumber}\`,
        });
      }

      // Credit Inventory (Asset reduction)
      jLines.push({
        id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr,
        debit: 0, credit: netPurchase, memo: \`رد بضاعة للمورد من المخزون - مرتجع \${invoiceNumber}\`,
      });

      // Credit VAT Receivable (reversing VAT)
      if (computedVatTotal > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr,
          debit: 0, credit: computedVatTotal, memo: \`عكس ضريبة مشتريات مستردة - مرتجع \${invoiceNumber}\`,
        });
      }
    }

    const entryDebit = jLines.reduce((s, l) => s + (l.debit || 0), 0);
    const entryCredit = jLines.reduce((s, l) => s + (l.credit || 0), 0);
`;

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd, startIndex);

if (startIndex > -1 && endIndex > -1) {
  code = code.substring(0, startIndex) + newJournalLogic + code.substring(endIndex);
  fs.writeFileSync('src/services/dataService.ts', code);
  console.log('Success Rewrite All');
} else {
  console.log('Failed to find block', startIndex, endIndex);
}
