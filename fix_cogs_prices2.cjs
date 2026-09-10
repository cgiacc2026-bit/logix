const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const targetPurchaseStr = `    } else if (isPurchase) {`;
const endIndexStr = `    const jEntry: JournalEntry = {`;

const newPurchaseLogic = `    } else if (isPurchase) {
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

`;

const startIndex = code.indexOf(targetPurchaseStr);
const endIndex = code.indexOf(endIndexStr, startIndex);

if (startIndex > -1 && endIndex > -1) {
  code = code.substring(0, startIndex) + newPurchaseLogic + code.substring(endIndex);
  
  // also recalculate totalDebit and totalCredit on jEntry to make sure they match, because we might have multiple debits and credits
  const totalDebitCalc = `const entryDebit = jLines.reduce((s, l) => s + (l.debit || 0), 0);
    const entryCredit = jLines.reduce((s, l) => s + (l.credit || 0), 0);
    const jEntry: JournalEntry = {`;
  code = code.replace("const jEntry: JournalEntry = {", totalDebitCalc);
  
  code = code.replace("totalDebit: grandTotal,", "totalDebit: entryDebit,");
  code = code.replace("totalCredit: grandTotal,", "totalCredit: entryCredit,");

  fs.writeFileSync('src/services/dataService.ts', code);
  console.log('Success Purchase');
} else {
  console.log('Failed to find block', startIndex, endIndex);
}
