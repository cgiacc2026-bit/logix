const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const targetRestore = `  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
const replaceRestore = `
  const handleSmartImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    setIsRestoring(true);
    setErrorMessage('');
    
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const data = JSON.parse(jsonContent);
        
        // 1. [ARCHITECT FIX] Re-calculate and deduplicate invoices in the JSON
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

        // Just push to local store and let the repair script handle it.
        // We will call the standard restore function provided by the app, but with our fixed JSON.
        if (onRestoreData) {
            await onRestoreData(JSON.stringify(data));
        }
        
        // Run massive repair
        const repairResult = await DataService.executeImmediateRepairAndDeduplication();
        
        setRestoreSuccess('تمت استعادة البيانات وتصحيحها محاسبياً بنجاح! ' + repairResult.message);
        setTimeout(() => setRestoreSuccess(''), 6000);
      } catch (err: any) {
        setErrorMessage(err.message || 'ملف غير صالح أو تعذر الاستعادة وتصحيح البيانات');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {`;

code = code.replace(targetRestore, replaceRestore);

const targetButtons = `<label                  htmlFor="import-backup"                  className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-[#D4AF37] px-4 py-2 rounded-md font-medium text-sm transition-colors border border-[#D4AF37]/30 flex items-center justify-center gap-2"                >                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}                  استعادة نسخة من جهازك (Restore)                </label>`;

const replaceButtons = `<label                  htmlFor="import-backup"                  className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-[#D4AF37] px-4 py-2 rounded-md font-medium text-sm transition-colors border border-[#D4AF37]/30 flex items-center justify-center gap-2"                >                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}                  استعادة (عادي)                </label>                <label                  htmlFor="smart-import-backup"                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"                >                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}                  استعادة وتصحيح ذكي (Smart IFRS Fix)                </label>                <input                  type="file"                  id="smart-import-backup"                  accept=".json"                  className="hidden"                  onChange={handleSmartImportBackup}                  disabled={isRestoring}                />`;

if (code.includes('handleImportBackup')) {
  code = code.replace(targetButtons, replaceButtons);
  fs.writeFileSync('src/components/CompanySetupView.tsx', code);
  console.log("Rewritten CompanySetupView buttons!");
}
