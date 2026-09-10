const fs = require('fs');

let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const target = `const dummy = async () => {`;
const replace = `const handleSmartRestoreData = async () => {
    try {
      if (!restoreJsonStr) {
        setErrorMessage('الرجاء إدخال كود JSON');
        return;
      }
      setIsRestoring(true);
      setErrorMessage('');
      const data = JSON.parse(restoreJsonStr);
      
      // Fix invoices logic
      if (data.invoices && Array.isArray(data.invoices)) {
        const uniqueInvs: any[] = [];
        const seen = new Set();
        for(const inv of data.invoices) {
            if(!seen.has(inv.invoiceNumber)) {
                seen.add(inv.invoiceNumber);
                let grossSubtotal = 0;
                let vatTotal = 0;
                if(Array.isArray(inv.lines)) {
                    inv.lines = inv.lines.map((l: any) => {
                        const q = Number(l.quantity) || 1;
                        const p = Number(l.unitPrice) || 0;
                        const vRate = Number(l.vatRate) || 0;
                        l.subtotal = q * p;
                        l.vatAmount = l.subtotal * (vRate / 100);
                        l.total = l.subtotal + l.vatAmount - (Number(l.discountAmount) || 0);
                        grossSubtotal += l.subtotal;
                        vatTotal += l.vatAmount;
                        return l;
                    });
                }
                inv.subtotal = grossSubtotal;
                inv.vatTotal = vatTotal;
                const discAmt = inv.discountType === 'PERCENT' ? (grossSubtotal * (Number(inv.discountValue)||0)/100) : (Number(inv.discountValue)||0);
                inv.discountTotal = discAmt;
                inv.grandTotal = Math.max(0, grossSubtotal - discAmt) + vatTotal;
                inv.dueAmount = Math.max(0, inv.grandTotal - (Number(inv.paidAmount)||0));
                uniqueInvs.push(inv);
            }
        }
        data.invoices = uniqueInvs;
      }
      
      if (onRestoreData) {
         await onRestoreData(JSON.stringify(data));
      }
      
      // Run massive repair
      const repairResult = await DataService.executeImmediateRepairAndDeduplication();
        
      setSuccessMessage('تمت استعادة البيانات وتصحيحها بنجاح! ' + repairResult.message);
      setRestoreJsonStr('');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e: any) {
      setErrorMessage('فشل: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };
  const dummy = async () => {`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/CompanySetupView.tsx', code);
console.log("Restored Original Smart Fix");
