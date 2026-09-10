const fs = require('fs');
let code = fs.readFileSync('src/services/dataService.ts', 'utf8');

const startMarker = `  public static async createInvoice(data: any): Promise<Invoice> {`;
const endMarker = `  public static async postInvoice(id: string): Promise<Invoice | null> {`;

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

const newCreateInvoice = `  public static async createInvoice(data: any): Promise<Invoice> {
    const invoices = localDataStore.getInvoices();
    const customers = isSupabaseConfigured ? await this.getCustomers() : localDataStore.getCustomers();
    const suppliers = isSupabaseConfigured ? await this.getSuppliers() : localDataStore.getSuppliers();
    const inventory = localDataStore.getInventory();
    
    const isSales = data.type === 'SALES';
    const isSalesReturn = data.type === 'SALES_RETURN';
    const isPurchase = data.type === 'PURCHASE';
    const isPurchaseReturn = data.type === 'PURCHASE_RETURN';
    
    const invoiceNumber = data.invoiceNumber || \`\${isSales ? 'INV-SAL' : 'INV-PUR'}-2026-\${String(invoices.length + 1).padStart(4, '0')}\`;
    
    const lines = (data.lines || data.items || []).map((item: any, i: number) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice) || 0;
      const unitsPerPack = Number(item.unitsPerPack) > 0 ? Number(item.unitsPerPack) : 1;
      const packQuantity = item.packQuantity !== undefined ? Number(item.packQuantity) : (unitsPerPack > 1 ? Math.floor(q / unitsPerPack) : 0);
      
      const dType: 'PERCENT' | 'FIXED' = item.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
      const dVal = Number(item.discountValue) || Number(item.discount) || 0;
      
      const lineGross = q * p;
      let lineDiscAmt = 0;
      if (dType === 'PERCENT') {
        lineDiscAmt = (lineGross * Math.min(100, Math.max(0, dVal))) / 100;
      } else {
        lineDiscAmt = Math.min(lineGross, Math.max(0, dVal));
      }
      
      const lineNet = Math.max(0, lineGross - lineDiscAmt);
      const vatRate = Number(item.vatRate) || 0;
      const vatAmount = Number(item.vatAmount) || (lineNet * vatRate / 100);

      return {
        id: item.id || \`item-\${i + 1}\`,
        itemId: item.itemId || \`inv-item-\${i + 1}\`,
        itemSku: item.itemSku || item.sku || '',
        barcode: item.barcode || '',
        itemNameAr: item.itemNameAr || item.nameAr || 'صنف',
        unit: item.unit || 'حبة',
        unitsPerPack,
        packQuantity,
        quantity: q,
        unitPrice: p,
        subtotal: lineGross,
        discountType: dType,
        discountValue: dVal,
        discountAmount: lineDiscAmt,
        vatRate,
        vatAmount,
        total: lineNet + vatAmount,
        notes: item.notes || '',
      };
    });

    const grossSubtotal = lines.reduce((s: number, it: any) => s + (it.subtotal || it.quantity * it.unitPrice), 0);
    const lineDiscountsSum = lines.reduce((s: number, it: any) => s + (it.discountAmount || 0), 0);
    const subtotalAfterLines = Math.max(0, grossSubtotal - lineDiscountsSum);
    
    const invDiscType: 'PERCENT' | 'FIXED' = data.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
    const invDiscVal = Number(data.discountValue) || 0;
    let invDiscAmt = 0;
    if (invDiscType === 'PERCENT') {
      invDiscAmt = (subtotalAfterLines * Math.min(100, Math.max(0, invDiscVal))) / 100;
    } else {
      invDiscAmt = Math.min(subtotalAfterLines, Math.max(0, invDiscVal));
    }
    
    const discountTotal = lineDiscountsSum + invDiscAmt;
    const computedVatTotal = lines.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0);
    const grandTotal = Math.max(0, grossSubtotal - discountTotal) + computedVatTotal;
    
    const paidAmount = data.paidAmount !== undefined
      ? Math.max(0, Number(data.paidAmount))
      : (data.paymentTerms === 'CASH' ? grandTotal : 0);
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    
    let entityNameAr = data.entityNameAr || data.entityName || '';
    if (isSales || isSalesReturn) {
      const cust = customers.find((c) => c.id === data.entityId);
      if (cust) entityNameAr = cust.nameAr;
    } else {
      const supp = suppliers.find((s) => s.id === data.entityId);
      if (supp) entityNameAr = supp.nameAr;
    }

    const newInvoice: Invoice = {
      id: 'inv-' + Math.random().toString(36).substr(2, 9),
      invoiceNumber,
      type: data.type || 'SALES',
      date: data.date || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      entityId: data.entityId || '',
      entityNameAr,
      status: data.status || 'POSTED',
      lines,
      subtotal: grossSubtotal,
      vatTotal: computedVatTotal,
      discountType: invDiscType,
      discountValue: invDiscVal,
      discountTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentTerms: data.paymentTerms || (paidAmount >= grandTotal && grandTotal > 0 ? 'CASH' : 'CREDIT'),
      salesPerson: data.salesPerson || '',
      receiverName: data.receiverName || '',
      customerBranchId: data.customerBranchId || undefined,
      customerBranchName: data.customerBranchName || undefined,
      priceListApplied: data.priceListApplied || undefined,
      notes: data.notes,
      companyId: data.companyId || data.company_id || undefined,
      company_id: data.company_id || data.companyId || undefined,
      createdAt: new Date().toISOString(),
    };

    const activeCompanyId = localDataStore.getEffectiveCompanyId() || 'default';
    
    // Inventory Updates
    lines.forEach((it: any) => {
      const invItem = inventory.find((i) => i.id === it.itemId);
      if (invItem) {
        if (isSales || isPurchaseReturn) {
          invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand - it.quantity);
        } else if (isPurchase || isSalesReturn) {
          invItem.quantityOnHand += it.quantity;
        }
        syncToFirestore('erp_inventory', invItem.id, invItem);
        if (isSupabaseConfigured) SupabaseDataService.saveItem(invItem).catch(() => {});
      }
    });
    localDataStore.saveInventory(inventory);

    // =========================================================================
    // [ARCHITECT] IFRS Compliant Automated Journal Entry Generation
    // =========================================================================
    const resolved = this.getResolvedAccounts();
    let jLines: any[] = [];
    
    if (isSales) {
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: paidAmount, credit: 0, memo: \`دفعة نقدية مسددة - فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\` });
        jLines.push({ id: 'jl-2', accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: dueAmount, credit: 0, memo: \`المبلغ الآجل المستحق - فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({ id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: grandTotal, credit: 0, memo: \`فاتورة مبيعات \${invoiceNumber} - \${entityNameAr}\` });
      }
      jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr, debit: 0, credit: netRevenue, memo: \`إيراد مبيعات فاتورة \${invoiceNumber}\` });
      if (computedVatTotal > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: 0, credit: computedVatTotal, memo: \`ضريبة القيمة المضافة المحصلة - فاتورة \${invoiceNumber}\` });
      }
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        return sum + ((invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0) * line.quantity);
      }, 0);
      if (totalCost > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr, debit: totalCost, credit: 0, memo: \`تكلفة بضاعة مباعة - فاتورة \${invoiceNumber}\` });
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: 0, credit: totalCost, memo: \`تخفيض المخزون المباع - فاتورة \${invoiceNumber}\` });
      }
    } else if (isSalesReturn) {
      const netRevenue = Math.max(0, grandTotal - computedVatTotal);
      jLines.push({ id: 'jl-1', accountId: resolved.sales.id, accountCode: resolved.sales.code, accountNameAr: resolved.sales.nameAr, debit: netRevenue, credit: 0, memo: \`مردودات ومسموحات المبيعات \${invoiceNumber} - \${entityNameAr}\` });
      if (computedVatTotal > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: computedVatTotal, credit: 0, memo: \`عكس ضريبة مبيعات مرتجعة - مرتجع \${invoiceNumber}\` });
      }
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: 0, credit: paidAmount, memo: \`رد نقدي مسدد للعميل - مرتجع مبيعات \${invoiceNumber}\` });
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.receivable.id, accountCode: resolved.receivable.code, accountNameAr: resolved.receivable.nameAr, debit: 0, credit: dueAmount, memo: \`تخفيض حساب العميل الآجل \${entityNameAr}\` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.receivable;
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: 0, credit: grandTotal, memo: \`تخفيض رصيد حساب العميل \${entityNameAr}\` });
      }
      const totalCost = lines.reduce((sum: number, line: any) => {
        const invItem = inventory.find(i => i.id === line.itemId);
        return sum + ((invItem ? (Number(invItem.costPrice || invItem.purchasePrice || 0)) : 0) * line.quantity);
      }, 0);
      if (totalCost > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: totalCost, credit: 0, memo: \`رد بضاعة للمخزون - مرتجع \${invoiceNumber}\` });
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cogs.id, accountCode: resolved.cogs.code, accountNameAr: resolved.cogs.nameAr, debit: 0, credit: totalCost, memo: \`تخفيض تكلفة بضاعة مباعة - مرتجع \${invoiceNumber}\` });
      }
    } else if (isPurchase) {
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);
      jLines.push({ id: 'jl-1', accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: netPurchase, credit: 0, memo: \`شراء بضاعة للمخزون - فاتورة \${invoiceNumber} - \${entityNameAr}\` });
      if (computedVatTotal > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: computedVatTotal, credit: 0, memo: \`ضريبة القيمة المضافة المدفوعة - فاتورة \${invoiceNumber}\` });
      }
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: 0, credit: paidAmount, memo: \`دفعة نقدية لمورد - فاتورة مشتريات \${invoiceNumber}\` });
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr, debit: 0, credit: dueAmount, memo: \`مبلغ آجل مستحق للمورد - فاتورة مشتريات \${invoiceNumber}\` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: 0, credit: grandTotal, memo: \`سداد فاتورة مشتريات \${invoiceNumber} - \${entityNameAr}\` });
      }
    } else if (isPurchaseReturn) {
      const netPurchase = Math.max(0, grandTotal - computedVatTotal);
      if (paidAmount > 0 && dueAmount > 0) {
        jLines.push({ id: 'jl-1', accountId: resolved.cash.id, accountCode: resolved.cash.code, accountNameAr: resolved.cash.nameAr, debit: paidAmount, credit: 0, memo: \`استرداد نقدي من المورد - مرتجع مشتريات \${invoiceNumber}\` });
        jLines.push({ id: 'jl-2', accountId: resolved.payable.id, accountCode: resolved.payable.code, accountNameAr: resolved.payable.nameAr, debit: dueAmount, credit: 0, memo: \`تخفيض حساب المورد الآجل - \${entityNameAr}\` });
      } else {
        const paymentAcc = paidAmount >= grandTotal ? resolved.cash : resolved.payable;
        jLines.push({ id: 'jl-1', accountId: paymentAcc.id, accountCode: paymentAcc.code, accountNameAr: paymentAcc.nameAr, debit: grandTotal, credit: 0, memo: \`تخفيض حساب المورد - مرتجع \${invoiceNumber}\` });
      }
      jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.inventory.id, accountCode: resolved.inventory.code, accountNameAr: resolved.inventory.nameAr, debit: 0, credit: netPurchase, memo: \`رد بضاعة للمورد من المخزون - مرتجع \${invoiceNumber}\` });
      if (computedVatTotal > 0) {
        jLines.push({ id: \`jl-\${jLines.length + 1}\`, accountId: resolved.vat.id, accountCode: resolved.vat.code, accountNameAr: resolved.vat.nameAr, debit: 0, credit: computedVatTotal, memo: \`عكس ضريبة مشتريات مستردة - مرتجع \${invoiceNumber}\` });
      }
    }

    const entryDebit = jLines.reduce((s, l) => s + (l.debit || 0), 0);
    const entryCredit = jLines.reduce((s, l) => s + (l.credit || 0), 0);

    const jEntry: JournalEntry = {
      id: 'jv-' + Math.random().toString(36).substr(2, 9),
      entryNumber: \`JV-\${invoiceNumber}\`,
      date: newInvoice.date,
      reference: invoiceNumber,
      description: \`قيد ترحيل فاتورة \${isSales ? 'مبيعات' : 'مشتريات'} رقم (\${invoiceNumber}) - \${entityNameAr}\`,
      status: 'POSTED',
      lines: jLines,
      totalDebit: entryDebit,
      totalCredit: entryCredit,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      isAutoGenerated: true,
      sourceModule: isSales ? 'SALES_INVOICE' : 'PURCHASE_INVOICE',
      sourceId: newInvoice.id,
    };

    const journals = localDataStore.getJournals();
    journals.unshift(jEntry);
    localDataStore.saveJournals(journals);
    syncToFirestore('erp_journals', jEntry.id, jEntry);
    
    newInvoice.journalEntryId = jEntry.id;
    localDataStore.removeTombstone('invoices', newInvoice.id);
    localDataStore.removeTombstone('journals', jEntry.id);
    
    invoices.unshift(newInvoice);
    localDataStore.saveInvoices(invoices);

    // Smart Caching update
    if ((isSales || isSalesReturn) && newInvoice.entityId) {
      this.recalculateCustomerBalance(newInvoice.entityId);
    } else if ((isPurchase || isPurchaseReturn) && newInvoice.entityId) {
      this.recalculateSupplierBalance(newInvoice.entityId);
    }

    // High-Performance Optimistic UI: Background Non-Blocking Persistence
    backgroundSync.enqueueInvoiceCreate(newInvoice, data, activeCompanyId);
    syncToFirestore('erp_invoices', newInvoice.id, newInvoice);

    return newInvoice;
  }
`;

if (startIdx > -1 && endIdx > -1) {
  code = code.substring(0, startIdx) + newCreateInvoice + code.substring(endIdx);
  fs.writeFileSync('src/services/dataService.ts', code);
  console.log("Rewritten CreateInvoice!");
} else {
  console.log("Could not find start/end bounds for CreateInvoice.");
}
