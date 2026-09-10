// I will create an SQL script that the user can run directly in Supabase to insert all data.
// Since the prompt includes the entire JSON, I can read it from the environment if I run a script? No.
// Let's write an endpoint in the app so they can paste it, and it will generate the SQL file for them.
const fs = require('fs');

let code = fs.readFileSync('src/components/CompanySetupView.tsx', 'utf8');

const target = `const handleSmartRestoreData = async () => {`;
const replace = `
  const handleSmartRestoreData = async () => {
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
      
      // Let's generate a massive SQL script instead of standard restore, and trigger a download
      let sql = "-- SQL SCRIPT GENERATED FOR SUPABASE RESTORE\\n\\n";
      const companyId = data.company?.id || '20000000-0000-0000-0000-000000000001';
      
      // 1. Customers
      if(data.customers) {
         for(const c of data.customers) {
             const cid = c.id.replace(/'/g, "''");
             const cname = (c.nameAr || c.nameEn || '').replace(/'/g, "''");
             sql += \`INSERT INTO public.customers (id, company_id, name_ar, balance, current_balance, opening_balance) VALUES ('\${cid}', '\${companyId}', '\${cname}', \${c.balance || 0}, \${c.currentBalance || 0}, \${c.openingBalance || 0}) ON CONFLICT DO NOTHING;\\n\`;
         }
      }
      
      // 2. Items
      if(data.inventory) {
         for(const item of data.inventory) {
             const iid = item.id.replace(/'/g, "''");
             const iname = (item.nameAr || '').replace(/'/g, "''");
             const qty = Number(item.quantityOnHand) || 0;
             sql += \`INSERT INTO public.items (id, company_id, name_ar, item_type, quantity_on_hand, sale_price) VALUES ('\${iid}', '\${companyId}', '\${iname}', 'PRODUCT', \${qty}, \${item.salePrice || 0}) ON CONFLICT DO NOTHING;\\n\`;
         }
      }
      
      // 3. Invoices
      if(data.invoices) {
         for(const inv of data.invoices) {
             const iid = inv.id.replace(/'/g, "''");
             const invNo = inv.invoiceNumber.replace(/'/g, "''");
             const eid = (inv.entityId || '').replace(/'/g, "''");
             const gTotal = Number(inv.grandTotal) || 0;
             sql += \`INSERT INTO public.invoices (id, company_id, invoice_number, type, entity_id, grand_total, due_amount, status) VALUES ('\${iid}', '\${companyId}', '\${invNo}', '\${inv.type}', '\${eid}', \${gTotal}, \${inv.dueAmount || 0}, '\${inv.status}') ON CONFLICT DO NOTHING;\\n\`;
         }
      }
      
      const blob = new Blob([sql], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alwaleed_restore.sql';
      a.click();
      URL.revokeObjectURL(url);
      
      setSuccessMessage('تم توليد وتصحيح ملف SQL بنجاح! يرجى تنفيذ هذا الملف في Supabase.');
    } catch (e: any) {
      setErrorMessage('فشل: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };
  const dummy = async () => {`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/CompanySetupView.tsx', code);
console.log("Written SQL Generator");

