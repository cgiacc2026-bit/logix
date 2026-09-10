const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const target1 = `      jLines.push({
        id: \`jl-\${jLines.length + 1}\`,
        accountId: resolved.sales.id,
        accountCode: resolved.sales.code,
        accountNameAr: resolved.sales.nameAr,
        debit: 0,
        credit: grandTotal,
        memo: \`إيراد مبيعات فاتورة \${invoiceNumber}\`,
      });`;

const replacement1 = `      jLines.push({
        id: \`jl-\${jLines.length + 1}\`,
        accountId: resolved.sales.id,
        accountCode: resolved.sales.code,
        accountNameAr: resolved.sales.nameAr,
        debit: 0,
        credit: grandTotal,
        memo: \`إيراد مبيعات فاتورة \${invoiceNumber}\`,
      });

      // COGS Journal Entry
      const totalCost = lines.reduce((sum, line) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        const cost = invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0;
        return sum + (cost * line.quantity);
      }, 0);

      if (totalCost > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`,
          accountId: resolved.cogs.id,
          accountCode: resolved.cogs.code,
          accountNameAr: resolved.cogs.nameAr,
          debit: totalCost,
          credit: 0,
          memo: \`تكلفة بضاعة مباعة - فاتورة \${invoiceNumber}\`,
        });
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`,
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: 0,
          credit: totalCost,
          memo: \`تخفيض المخزون المباع - فاتورة \${invoiceNumber}\`,
        });
      }`;

code = code.replace(target1, replacement1);

const target2 = `        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: 'jl-2',
          accountId: paymentAcc.id,
          accountCode: paymentAcc.code,
          accountNameAr: paymentAcc.nameAr,
          debit: 0,
          credit: grandTotal,
          memo: \`تخفيض حساب العميل \${entityNameAr}\`,
        });
      }`;

const replacement2 = `        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({
          id: 'jl-2',
          accountId: paymentAcc.id,
          accountCode: paymentAcc.code,
          accountNameAr: paymentAcc.nameAr,
          debit: 0,
          credit: grandTotal,
          memo: \`تخفيض حساب العميل \${entityNameAr}\`,
        });
      }
      
      const totalCost = lines.reduce((sum, line) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        const cost = invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0;
        return sum + (cost * line.quantity);
      }, 0);

      if (totalCost > 0) {
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`,
          accountId: resolved.inventory.id,
          accountCode: resolved.inventory.code,
          accountNameAr: resolved.inventory.nameAr,
          debit: totalCost,
          credit: 0,
          memo: \`رد بضاعة للمخزون - مرتجع \${invoiceNumber}\`,
        });
        jLines.push({
          id: \`jl-\${jLines.length + 1}\`,
          accountId: resolved.cogs.id,
          accountCode: resolved.cogs.code,
          accountNameAr: resolved.cogs.nameAr,
          debit: 0,
          credit: totalCost,
          memo: \`تخفيض تكلفة بضاعة مباعة - مرتجع \${invoiceNumber}\`,
        });
      }`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/services/dataService.ts', code);
