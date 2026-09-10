const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

// I will target the journal creation block in `createInvoice`
// Starts with: `let jLines = [];\n    if (isSales) {`

const targetBlockStart = `    let jLines = [];
    if (isSales) {`;

// Let's replace the VAT calculation mapping as well
const vatMappingTarget = `        discountAmount: lineDiscAmt,
        vatRate: 0,
        vatAmount: 0,
        total: lineNet,`;

const vatMappingReplace = `        discountAmount: lineDiscAmt,
        vatRate: Number(item.vatRate) || 0,
        vatAmount: Number(item.vatAmount) || (lineNet * (Number(item.vatRate) || 0) / 100),
        total: lineNet + (Number(item.vatAmount) || (lineNet * (Number(item.vatRate) || 0) / 100)),`;

code = code.replace(vatMappingTarget, vatMappingReplace);

// Now the aggregate VAT calculation
const vatAggregateTarget = `      subtotal: grossSubtotal,
      vatTotal: 0,
      discountType: invDiscType,`;

const vatAggregateReplace = `      subtotal: grossSubtotal,
      vatTotal: lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0),
      discountType: invDiscType,`;

code = code.replace(vatAggregateTarget, vatAggregateReplace);

// Now update grandTotal to include VAT
const grandTotalTarget = `    const discountTotal = lineDiscountsSum + invDiscAmt;
    const grandTotal = Math.max(0, grossSubtotal - discountTotal);`;

const grandTotalReplace = `    const discountTotal = lineDiscountsSum + invDiscAmt;
    const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
    const grandTotal = Math.max(0, grossSubtotal - discountTotal) + computedVatTotal;`;

code = code.replace(grandTotalTarget, grandTotalReplace);

// Now replace the entire `if (isSales) { ... } else if (isSalesReturn) { ... } else if (isPurchase) { ... }` journal creation logic.
// It's safest to find `let jLines = [];` and just do a manual string replace.

// I will use regex or find the exact block.
