const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const targetImports = `import { useTheme } from '../hooks/useTheme';`;
const addImports = `import { useTheme } from '../hooks/useTheme';
import { DataService } from '../services/dataService';`;

if(code.includes(targetImports)) {
   code = code.replace(targetImports, addImports);
} else {
   code = `import { DataService } from '../services/dataService';\n` + code;
}

const targetRestore = `  const handleRestoreData = async () => {`;
const replaceRestore = `
  const handleSmartRestoreData = async () => {
    try {
      if (!restoreJsonStr) {
        setErrorMessage('الرجاء إدخال كود JSON');
        return;
      }
      setIsRestoring(true);
      setErrorMessage('');
      const data = JSON.parse(restoreJsonStr);
      
      // 1. [ARCHITECT FIX] Re-calculate and deduplicate invoices in the JSON
      if (data.invoices && Array.isArray(data.invoices)) {
        const uniqueInvs: any[] = [];
        const seen = new Set();
        for(const inv of data.invoices) {
            if(!seen.has(inv.invoiceNumber)) {
                seen.add(inv.invoiceNumber);
                
                // Fix lines subtotal and grandTotal
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

      localDataStore.saveInvoices(data.invoices || []);
      localDataStore.saveSuppliers(data.suppliers || []);
      localDataStore.saveCustomers(data.customers || []);
      localDataStore.saveInventory(data.inventory || []);
      localDataStore.saveAccounts(data.accounts || []);
      localDataStore.saveVouchers(data.vouchers || []);
      localDataStore.saveJournals(data.journals || []);
      if (data.company) {
         localDataStore.saveCompanyProfile(data.company);
      }
      
      // Run the massive architect repair to fix balances and sync to Supabase
      const repairResult = await DataService.executeImmediateRepairAndDeduplication();
      
      setSuccessMessage('تمت استعادة البيانات وتصحيحها بنجاح! ' + repairResult.message);
      setRestoreJsonStr('');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e: any) {
      setErrorMessage('فشل في تصحيح واستعادة البيانات: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreData = async () => {`;

code = code.replace(targetRestore, replaceRestore);

const targetButtons = `<Button                onClick={handleRestoreData}                disabled={isRestoring || !restoreJsonStr}                className="bg-indigo-600 hover:bg-indigo-700 text-white"              >                {isRestoring ? (                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />                ) : (                  <Upload className="w-5 h-5 ml-2" />                )}                استعادة البيانات وتحديث النظام              </Button>`;

const replaceButtons = `<Button                onClick={handleRestoreData}                disabled={isRestoring || !restoreJsonStr}                variant="outline"                className="ml-2"              >                {isRestoring ? (                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />                ) : (                  <Upload className="w-5 h-5 ml-2" />                )}                استعادة فقط              </Button>              <Button                onClick={handleSmartRestoreData}                disabled={isRestoring || !restoreJsonStr}                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"              >                {isRestoring ? (                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />                ) : (                  <Upload className="w-5 h-5 ml-2" />                )}                تصحيح الأخطاء المحاسبية واستعادة (IFRS)              </Button>`;

if (code.includes('handleRestoreData')) {
  code = code.replace(targetButtons, replaceButtons);
  fs.writeFileSync('src/components/CompanySetupView.tsx', code);
  console.log("Rewritten CompanySetupView");
}
