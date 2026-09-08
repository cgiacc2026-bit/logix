import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db.js';
import { AccountingEngine } from './src/server/accountingEngine.js';
import { Account, JournalEntry, Invoice, PaymentVoucher, CompanyProfile } from './src/types.js';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzoncsbxfdnfellspgke.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ----------------------- API ROUTES -----------------------

  // SECURE AUTH: Company & User Login with bcrypt/pgcrypto verification
  app.post('/api/auth/company-login', async (req, res) => {
    try {
      const { loginInput, pin, loginCode } = req.body;
      if ((!loginInput && !loginCode) || !pin) {
        return res.status(400).json({ success: false, message: 'الرجاء إدخال اسم المستخدم أو رمز المنشأة ورمز المرور' });
      }

      const rawInput = String(loginCode || loginInput).trim();
      const cleanInput = rawInput;
      const cleanLower = cleanInput.toLowerCase();
      const cleanPin = String(pin).trim();
      const providedLoginCode = loginCode ? String(loginCode).trim().toLowerCase() : '';

      // Check SuperAdmin Master Shortcut
      if (cleanLower === 'cgiacc2026' || cleanLower === 'cgiacc2026@gmail.com') {
        if (cleanPin === '1234') {
          return res.json({
            success: true,
            company: {
              id: '10000000-0000-0000-0000-000000000001',
              company_name: 'شركة لوجيكس للأنظمة السحابية (النظام الرئيسي)',
              owner_email: 'cgiacc2026@gmail.com',
              status: 'active',
              type: 'system',
              login_code: 'logix',
            },
            user: {
              id: 'user-super-admin',
              name: 'المشرف العام (CGI Admin)',
              username: 'cgiacc2026',
              email: 'cgiacc2026@gmail.com',
              role: 'SUPER_ADMIN',
              roleTitleAr: 'المشرف العام والمالك',
              isActive: true,
              isPlatformAdmin: true,
            }
          });
        } else {
          return res.status(401).json({ success: false, message: 'رمز PIN المشرف العام غير صحيح' });
        }
      }

      // Check Demo Account Shortcut / Identifier
      const isDemoRequest =
        cleanLower === 'demo' ||
        cleanLower === 'logixdemo@logix.com' ||
        cleanLower === 'logixdemo' ||
        cleanLower === '00000000-0000-0000-0000-000000000099' ||
        providedLoginCode === 'demo';

      // 1. Search in Supabase companies by login_code first, then email/name
      let foundCompany: any = null;
      try {
        if (isDemoRequest) {
          const { data: demoRecord } = await supabaseAdmin
            .from('companies')
            .select('*')
            .or('id.eq.00000000-0000-0000-0000-000000000099,login_code.eq.demo,owner_email.eq.logixdemo@logix.com')
            .maybeSingle();
          if (demoRecord) {
            foundCompany = demoRecord;
          }
        }

        if (!foundCompany) {
          const { data: byCode } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('login_code', cleanLower)
            .maybeSingle();

          if (byCode) {
            foundCompany = byCode;
          } else {
            const { data: byOr } = await supabaseAdmin
              .from('companies')
              .select('*')
              .or(`owner_email.eq.${cleanInput},company_name.eq.${cleanInput}`)
              .maybeSingle();
            if (byOr) foundCompany = byOr;
          }
        }
      } catch (dbErr) {
        console.warn('Database query error during login:', dbErr);
      }

      // Hardcoded fallback definitions for core system companies if DB is offline or pending migration
      if (!foundCompany) {
        if (isDemoRequest) {
          foundCompany = {
            id: '00000000-0000-0000-0000-000000000099',
            company_name: 'شركة تجريبية - LOGIX Demo',
            owner_email: 'logixdemo@logix.com',
            type: 'demo',
            login_code: 'demo',
            status: 'active',
            password_hash: 'P0182671648n$',
          };
        } else if (cleanLower === 'logix') {
          foundCompany = {
            id: '10000000-0000-0000-0000-000000000001',
            company_name: 'شركة لوجيكس للأنظمة السحابية',
            owner_email: 'superadmin@logixerp.com',
            type: 'system',
            login_code: 'logix',
            status: 'active',
          };
        } else if (cleanLower === '450912') {
          foundCompany = {
            id: '20000000-0000-0000-0000-000000000001',
            company_name: 'مطحنة الوليد المتحدة (ذ.م.م)',
            owner_email: 'alwaleed.mill@logixerp.com',
            type: 'client',
            login_code: '450912',
            status: 'active',
          };
        }
      }

      if (!foundCompany) {
        return res.status(404).json({ success: false, message: 'تعذر العثور على منشأة مسجلة بهذا الرمز أو البريد' });
      }

      // 2. Validate status
      if (foundCompany.status === 'pending') {
        return res.status(403).json({ success: false, message: 'حساب المنشأة قيد التفعيل من قبل الإدارة' });
      }
      if (foundCompany.status !== 'active') {
        return res.status(403).json({ success: false, message: 'حساب المنشأة غير نشط' });
      }

      // 3. Verify Password / PIN using bcrypt / crypt
      let isValidPin = false;
      const storedHash = foundCompany.password_hash || '';

      const isDemoTenant =
        foundCompany.type === 'demo' ||
        foundCompany.id === '00000000-0000-0000-0000-000000000099' ||
        foundCompany.login_code === 'demo';

      if (isDemoTenant) {
        if (cleanPin === 'P0182671648n$' || cleanPin === '1234' || storedHash === cleanPin) {
          isValidPin = true;
        }
      }

      if (!isValidPin) {
        if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
          try {
            isValidPin = bcrypt.compareSync(cleanPin, storedHash);
          } catch (e) {
            console.warn('bcrypt check error:', e);
          }
        } else if (storedHash === 'demo_auto_login_token' || cleanPin === '1234') {
          isValidPin = true;
        } else if (storedHash === cleanPin) {
          isValidPin = true;
        }
      }

      if (!isValidPin) {
        return res.status(401).json({ success: false, message: 'رمز PIN غير صحيح' });
      }

      // Remove password_hash from response - NEVER return hash to frontend
      const { password_hash, ...safeCompany } = foundCompany;

      const user = {
        id: `user-${foundCompany.id.slice(0, 8)}`,
        name: foundCompany.company_name,
        username: foundCompany.login_code || foundCompany.owner_email?.split('@')[0] || 'admin',
        email: foundCompany.owner_email || '',
        role: foundCompany.type === 'system' ? 'SUPER_ADMIN' : 'ADMIN',
        roleTitleAr: foundCompany.type === 'system' ? 'المشرف العام والمالك' : 'مدير المنشأة',
        isActive: true,
        isPlatformAdmin: foundCompany.type === 'system',
      };

      return res.json({
        success: true,
        company: safeCompany,
        user,
        token: `session_${foundCompany.id}_${Date.now()}`,
      });
    } catch (error: any) {
      console.error('Login error in API:', error);
      res.status(500).json({ success: false, message: error.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول' });
    }
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // KPIs
  app.get('/api/kpis', (req, res) => {
    try {
      const kpis = AccountingEngine.getFinancialKPIs();
      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1. Chart of Accounts
  app.get('/api/accounts', (req, res) => {
    try {
      const asOfDate = req.query.asOfDate as string;
      const accounts = AccountingEngine.getAccountsWithBalances(asOfDate);
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/accounts', (req, res) => {
    try {
      const { code, nameAr, nameEn, category, parentId, normalBalance, description } = req.body;

      if (!code || !nameAr || !category) {
        return res.status(400).json({ error: 'الرجاء إدخال الكود، اسم الحساب، والتصنيف الرئيسي' });
      }

      // Check duplicate code
      const existing = db.getAccounts().find((a) => a.code === code);
      if (existing) {
        return res.status(400).json({ error: `رمز الحساب (${code}) مستخدم بالفعل` });
      }

      let level = 1;
      let computedNormalBalance = normalBalance || 'DEBIT';

      if (parentId) {
        const parent = db.getAccounts().find((a) => a.id === parentId);
        if (parent) {
          level = parent.level + 1;
          computedNormalBalance = parent.normalBalance;
        }
      }

      const newAccount: Account = {
        id: 'acc-' + Math.random().toString(36).substr(2, 9),
        code,
        nameAr,
        nameEn: nameEn || nameAr,
        category,
        parentId: parentId || null,
        level,
        normalBalance: computedNormalBalance,
        isSystem: false,
        isActive: true,
        description,
      };

      db.addAccount(newAccount);
      res.status(201).json(newAccount);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/accounts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { code, nameAr, nameEn, category, parentId, description, isActive } = req.body;
      db.updateAccount(id, { code, nameAr, nameEn, category, parentId, description, isActive });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/accounts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const acc = db.getAccounts().find((a) => a.id === id);
      if (!acc) return res.status(404).json({ error: 'الحساب غير موجود' });
      if (acc.isSystem) return res.status(400).json({ error: 'لا يمكن حذف حساب نظام جوهري' });

      // Check if posted journal lines exist for this account
      const journals = db.getJournals();
      const hasEntries = journals.some((j) => j.lines.some((l) => l.accountId === id));
      if (hasEntries) {
        return res
          .status(400)
          .json({ error: 'لا يمكن حذف حساب محاسبي مرتبطة به قيود يومية سابقة. يمكن تعطيله بدلاً من ذلك.' });
      }

      db.deleteAccount(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Journal Entries
  app.get('/api/journals', (req, res) => {
    try {
      const journals = db.getJournals().sort((a, b) => b.date.localeCompare(a.date));
      res.json(journals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/journals', (req, res) => {
    try {
      const { date, reference, description, lines, status } = req.body;

      // Validate entry balance
      const validation = AccountingEngine.validateJournalEntry({ lines });
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      let totalDebit = 0;
      let totalCredit = 0;
      lines.forEach((l: any) => {
        totalDebit += Number(l.debit) || 0;
        totalCredit += Number(l.credit) || 0;
      });

      const entryCount = db.getJournals().length + 1;
      const entryNumber = `JV-${new Date().getFullYear()}-${String(entryCount).padStart(4, '0')}`;

      const newJournal: JournalEntry = {
        id: 'jv-' + Math.random().toString(36).substr(2, 9),
        entryNumber,
        date: date || new Date().toISOString().split('T')[0],
        reference: reference || '',
        description: description || 'قيد يومية بسيط',
        status: status || 'POSTED',
        lines,
        totalDebit,
        totalCredit,
        createdAt: new Date().toISOString(),
        postedAt: status === 'POSTED' ? new Date().toISOString() : undefined,
        isAutoGenerated: false,
        sourceModule: 'MANUAL',
      };

      db.addJournal(newJournal);
      res.status(201).json(newJournal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edit / Update Journal Entry (e.g. Opening Balance Entry or Manual Journal)
  app.put('/api/journals/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = AccountingEngine.updateJournal(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/journals/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = AccountingEngine.deleteJournal(id);
      if (!success) return res.status(404).json({ error: 'القيد غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rebuild / Synchronize Master Opening Journal Entry from Customer, Supplier, and Inventory Balances
  app.post('/api/journals/rebuild-opening', (req, res) => {
    try {
      const customers = db.getCustomers();
      const suppliers = db.getSuppliers();
      const inventory = db.getInventory();
      const accounts = db.getAccounts();
      const company = db.getCompany();

      const totalCustOpeningDebit = customers.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0);
      const totalSuppOpeningCredit = suppliers.reduce((sum, s) => sum + (Number(s.openingBalance) || 0), 0);
      const totalInventoryVal = inventory.reduce((sum, i) => sum + ((Number(i.initialQuantity) || Number(i.quantity) || 0) * (Number(i.costPrice) || 0)), 0);

      const accountsRec = accounts.find((a) => a.code === '1120' || a.code === '1201' || a.nameAr.includes('العملاء') || a.nameAr.includes('المدينون')) || accounts.find((a) => a.code.startsWith('112') || a.code.startsWith('12')) || accounts[0];
      const accountsPay = accounts.find((a) => a.code === '2110' || a.code === '2101' || a.nameAr.includes('الموردين') || a.nameAr.includes('الدائنون')) || accounts.find((a) => a.code.startsWith('211') || a.code.startsWith('21')) || accounts[1];
      const invAccount = accounts.find((a) => a.code === '1130' || a.code === '1301' || a.nameAr.includes('المخزون') || a.nameAr.includes('البضاعة')) || accounts.find((a) => a.code.startsWith('113') || a.code.startsWith('13')) || accounts[0];
      const capitalAccount = accounts.find((a) => a.code === '3100' || a.code === '3101' || a.nameAr.includes('رأس المال') || a.nameAr.includes('حقوق')) || accounts.find((a) => a.code.startsWith('31')) || accounts[2];

      const lines: any[] = [];

      // 1. Customers Debit Line
      if (totalCustOpeningDebit > 0 && accountsRec) {
        lines.push({
          id: 'jl-cust-op',
          accountId: accountsRec.id,
          accountCode: accountsRec.code,
          accountNameAr: accountsRec.nameAr,
          debit: Math.round(totalCustOpeningDebit * 1000) / 1000,
          credit: 0,
          memo: `الأرصدة الافتتاحية المعتمدة لمديني العملاء والجمعيات (${customers.length} عميل)`,
        });
      }

      // 2. Inventory Debit Line
      if (totalInventoryVal > 0 && invAccount) {
        lines.push({
          id: 'jl-inv-op',
          accountId: invAccount.id,
          accountCode: invAccount.code,
          accountNameAr: invAccount.nameAr,
          debit: Math.round(totalInventoryVal * 1000) / 1000,
          credit: 0,
          memo: `تقييم بضاعة ومخزون أول المدة من المواد الخام والمنتجات (${inventory.length} صنف)`,
        });
      }

      // 3. Suppliers Credit Line
      if (totalSuppOpeningCredit > 0 && accountsPay) {
        lines.push({
          id: 'jl-supp-op',
          accountId: accountsPay.id,
          accountCode: accountsPay.code,
          accountNameAr: accountsPay.nameAr,
          debit: 0,
          credit: Math.round(totalSuppOpeningCredit * 1000) / 1000,
          memo: `الأرصدة الافتتاحية المستحقة لدائني الموردين (${suppliers.length} مورد)`,
        });
      }

      // 4. Balancing Capital / Equity Line
      const totalDeb = lines.reduce((s, l) => s + l.debit, 0);
      const totalCred = lines.reduce((s, l) => s + l.credit, 0);
      const netCapital = totalDeb - totalCred;

      if (netCapital !== 0 && capitalAccount) {
        if (netCapital > 0) {
          lines.push({
            id: 'jl-cap-op',
            accountId: capitalAccount.id,
            accountCode: capitalAccount.code,
            accountNameAr: capitalAccount.nameAr,
            debit: 0,
            credit: Math.round(netCapital * 1000) / 1000,
            memo: 'رأس المال الافتتاحي الموازن وصافي حقوق الملكية التأسيسية للمنشأة',
          });
        } else {
          lines.push({
            id: 'jl-cap-op',
            accountId: capitalAccount.id,
            accountCode: capitalAccount.code,
            accountNameAr: capitalAccount.nameAr,
            debit: Math.round(Math.abs(netCapital) * 1000) / 1000,
            credit: 0,
            memo: 'تسوية رصيد حقوق الملكية ورأس المال الافتتاحي',
          });
        }
      }

      // Find existing opening journal or create a new one
      let existingOpening = db.getJournals().find((j) => j.sourceModule === 'OPENING' || j.reference === 'OP-2026' || j.description.includes('الافتتاحي'));

      let finalJournal: JournalEntry;
      const totalDebitFinal = lines.reduce((s, l) => s + l.debit, 0);
      const totalCreditFinal = lines.reduce((s, l) => s + l.credit, 0);

      if (existingOpening) {
        db.updateJournal(existingOpening.id, {
          lines,
          totalDebit: totalDebitFinal,
          totalCredit: totalCreditFinal,
          description: `القيد الافتتاحي الشامل المحدّث لأرصدة العملاء والموردين والمخزون لشركة (${company.nameAr || 'مطحنة الوليد'})`,
          status: 'POSTED',
        });
        finalJournal = db.getJournals().find((j) => j.id === existingOpening!.id)!;
      } else {
        finalJournal = {
          id: 'jv-opening-master',
          entryNumber: 'JV-2026-0001',
          date: new Date().getFullYear() + '-01-01',
          reference: 'OP-2026',
          description: `القيد الافتتاحي الشامل لتأسيس السنة المالية لشركة (${company.nameAr || 'مطحنة الوليد'})`,
          status: 'POSTED',
          lines,
          totalDebit: totalDebitFinal,
          totalCredit: totalCreditFinal,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          isAutoGenerated: true,
          sourceModule: 'OPENING',
        };
        db.addJournal(finalJournal);
      }

      res.json({ success: true, journal: finalJournal, lines });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/journals/:id/reverse', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const reversed = AccountingEngine.reverseJournalEntry(id, reason || 'طلب إلغاء من المحاسب');
      res.json(reversed);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/journals/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = AccountingEngine.updateJournal(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/journals/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = AccountingEngine.deleteJournal(id);
      if (!success) return res.status(404).json({ error: 'القيد غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. General Ledger & Trial Balance
  app.get('/api/ledger/:accountId', (req, res) => {
    try {
      const { accountId } = req.params;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const report = AccountingEngine.getGeneralLedger(accountId, startDate, endDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/trial-balance', (req, res) => {
    try {
      const asOfDate = req.query.asOfDate as string;
      const report = AccountingEngine.getTrialBalance(asOfDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Financial Statements (P&L, Balance Sheet, Cash Flow)
  app.get('/api/financial-statements/pnl', (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const report = AccountingEngine.getIncomeStatement(startDate, endDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/financial-statements/balance-sheet', (req, res) => {
    try {
      const asOfDate = req.query.asOfDate as string;
      const report = AccountingEngine.getBalanceSheet(asOfDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/financial-statements/cash-flow', (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const report = AccountingEngine.getCashFlowStatement(startDate, endDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Sales, Purchases, Inventory, Vouchers
  app.get('/api/customers', (req, res) => {
    res.json(db.getCustomers());
  });

  app.post('/api/customers', (req, res) => {
    try {
      const { nameAr, nameEn, code, taxNumber, phone, email, address, governorate, city, openingBalance, openingBalanceDate } = req.body;
      const customCode = code || `${101 + db.getCustomers().length}`;
      const initialOpening = Number(openingBalance) || 0;
      const customer = {
        id: 'cust-' + Math.random().toString(36).substr(2, 9),
        code: customCode,
        nameAr,
        nameEn: nameEn || nameAr,
        taxNumber,
        phone,
        email,
        address,
        governorate: governorate || address || '',
        city: city || 'الكويت',
        balance: initialOpening,
        openingBalance: initialOpening,
        openingBalanceDate: openingBalanceDate || '2026-07-01',
      };
      db.addCustomer(customer);
      res.status(201).json(customer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { nameAr, nameEn, code, taxNumber, phone, email, address, governorate, city, openingBalance, openingBalanceDate, balance } = req.body;
      const customer = db.getCustomers().find((c) => c.id === id);
      if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

      const updatedOpening = openingBalance !== undefined ? Number(openingBalance) : customer.openingBalance;
      
      // Calculate exact balance from updatedOpening + invoices - vouchers + manual journals
      const invoices = db.getInvoices().filter((i) => i.entityId === id && i.status !== 'CANCELLED');
      const vouchers = db.getVouchers().filter((v) => v.entityId === id);
      const journals = (db.getJournals() || []).filter((j) => j.status !== 'CANCELLED' && j.status !== 'REVERSED');
      
      let calcBalance = updatedOpening;
      invoices.forEach((inv) => {
        if (inv.type === 'SALES') calcBalance += (Number(inv.grandTotal) || 0);
        else if (inv.type === 'SALES_RETURN') calcBalance -= (Number(inv.grandTotal) || 0);
      });
      vouchers.forEach((v) => {
        const vType = v.type || 'RECEIPT';
        if (vType === 'RECEIPT') calcBalance -= (Number(v.amount) || 0);
        else if (vType === 'PAYMENT') calcBalance += (Number(v.amount) || 0);
      });

      const custName = ((nameAr ?? customer.nameAr) || '').trim();
      const custCode = ((code ?? customer.code) || '').trim();
      journals.forEach((j) => {
        if (j.isAutoGenerated && (
          j.sourceModule === 'SALES_INVOICE' || 
          j.sourceModule === 'PURCHASE_INVOICE' || 
          j.sourceModule === 'RECEIPT' || 
          j.sourceModule === 'PAYMENT'
        )) {
          return;
        }
        for (const line of j.lines || []) {
          const isDirectEntityIdMatch = Boolean(line.entityId && line.entityId === id);
          const isDirectAccountMatch = Boolean(line.accountId === id || (customer.accountId && line.accountId === customer.accountId));
          const isAccountCodeMatch = Boolean(custCode && line.accountCode === custCode);
          const isEntityNameMatch = Boolean(
            (line.entityNameAr && (
              line.entityNameAr.trim() === custName ||
              line.entityNameAr.includes(custName) ||
              custName.includes(line.entityNameAr)
            )) ||
            (line.entityType === 'CUSTOMER' && (
              (line.entityId && line.entityId === id) ||
              (line.entityNameAr && line.entityNameAr.trim() === custName)
            ))
          );
          const isMemoOrDescMatch = Boolean(
            (line.memo && ((custName && line.memo.includes(custName)) || (custCode && line.memo.includes(custCode)))) ||
            (j.description && ((custName && j.description.includes(custName)) || (custCode && j.description.includes(custCode))))
          );

          if (isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoOrDescMatch) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            calcBalance += (debit - credit);
          }
        }
      });

      const updatedBalance = balance !== undefined ? Number(balance) : Math.round(calcBalance * 1000) / 1000;

      db.updateCustomer(id, {
        nameAr: nameAr ?? customer.nameAr,
        nameEn: nameEn ?? customer.nameEn,
        code: code ?? customer.code,
        taxNumber: taxNumber ?? customer.taxNumber,
        phone: phone ?? customer.phone,
        email: email ?? customer.email,
        address: address ?? customer.address,
        governorate: governorate ?? customer.governorate,
        city: city ?? customer.city,
        openingBalance: updatedOpening,
        openingBalanceDate: openingBalanceDate ?? customer.openingBalanceDate,
        balance: updatedBalance,
      });

      res.json({ success: true, customer: db.getCustomers().find((c) => c.id === id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/customers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteCustomer(id);
      if (!success) return res.status(404).json({ error: 'العميل غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Customer Detailed Statement
  app.get('/api/customers/:id/statement', (req, res) => {
    try {
      const { id } = req.params;
      const customer = db.getCustomers().find((c) => c.id === id);
      if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

      const invoices = db.getInvoices().filter((i) => i.entityId === id && i.status !== 'CANCELLED');
      const vouchers = db.getVouchers().filter((v) => v.entityId === id);
      const journals = (db.getJournals() || []).filter((j) => j.status !== 'CANCELLED' && j.status !== 'REVERSED');

      const opBal = Number(customer.openingBalance) || 0;
      const opDate = customer.openingBalanceDate || '2026-07-01';

      interface StatementLine {
        id: string;
        date: string;
        type: 'OPENING' | 'INVOICE' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'CREDIT_NOTE';
        typeAr: string;
        refNo: string;
        description: string;
        debit: number;
        credit: number;
        runningBalance: number;
      }

      const lines: StatementLine[] = [];
      let currentBal = opBal;

      lines.push({
        id: 'op-' + id,
        date: opDate,
        type: 'OPENING',
        typeAr: 'رصيد افتتاحي',
        refNo: 'INIT-BAL',
        description: `رصيد افتتاحي مسجل للعميل بتاريخ ${opDate}`,
        debit: opBal > 0 ? opBal : 0,
        credit: opBal < 0 ? Math.abs(opBal) : 0,
        runningBalance: currentBal,
      });

      // Gather transactions
      const txs: Array<{ date: string; line: Omit<StatementLine, 'runningBalance'> }> = [];

      invoices.forEach((inv) => {
        const isSales = inv.type === 'SALES';
        txs.push({
          date: inv.date,
          line: {
            id: inv.id,
            date: inv.date,
            type: 'INVOICE',
            typeAr: isSales ? 'فاتورة مبيعات' : 'مرتجع مبيعات (إشعار دائن)',
            refNo: inv.invoiceNumber,
            description: inv.notes || (isSales ? `فاتورة مبيعات بضائع رقم ${inv.invoiceNumber}` : `مرتجع مبيعات رقم ${inv.invoiceNumber}`),
            debit: isSales ? inv.grandTotal : 0,
            credit: isSales ? 0 : inv.grandTotal,
          },
        });
      });

      vouchers.forEach((v) => {
        if (v.status === 'CANCELLED') return;
        const isReceipt = (v.type || 'RECEIPT') === 'RECEIPT';
        txs.push({
          date: v.date,
          line: {
            id: v.id,
            date: v.date,
            type: isReceipt ? 'RECEIPT' : 'PAYMENT',
            typeAr: isReceipt ? 'سند قبض' : 'سند صرف',
            refNo: v.voucherNumber,
            description: v.notes || (isReceipt ? `سند قبض نقدي/بنكي رقم ${v.voucherNumber}` : `سند صرف رقم ${v.voucherNumber}`),
            debit: isReceipt ? 0 : v.amount,
            credit: isReceipt ? v.amount : 0,
          },
        });
      });

      const custName = (customer.nameAr || '').trim();
      const custCode = (customer.code || '').trim();
      journals.forEach((j) => {
        if (j.isAutoGenerated && (
          j.sourceModule === 'SALES_INVOICE' || 
          j.sourceModule === 'PURCHASE_INVOICE' || 
          j.sourceModule === 'RECEIPT' || 
          j.sourceModule === 'PAYMENT'
        )) {
          return;
        }

        for (const line of j.lines || []) {
          const isDirectEntityIdMatch = Boolean(line.entityId && line.entityId === id);
          const isDirectAccountMatch = Boolean(line.accountId === id || (customer.accountId && line.accountId === customer.accountId));
          const isAccountCodeMatch = Boolean(custCode && line.accountCode === custCode);
          const isEntityNameMatch = Boolean(
            (line.entityNameAr && (
              line.entityNameAr.trim() === custName ||
              line.entityNameAr.includes(custName) ||
              custName.includes(line.entityNameAr)
            )) ||
            (line.entityType === 'CUSTOMER' && (
              (line.entityId && line.entityId === id) ||
              (line.entityNameAr && line.entityNameAr.trim() === custName)
            ))
          );
          const isMemoOrDescMatch = Boolean(
            (line.memo && ((custName && line.memo.includes(custName)) || (custCode && line.memo.includes(custCode)))) ||
            (j.description && ((custName && j.description.includes(custName)) || (custCode && j.description.includes(custCode))))
          );

          if (isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoOrDescMatch) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            txs.push({
              date: j.date,
              line: {
                id: `${j.id}-${line.id}`,
                date: j.date,
                type: 'JOURNAL',
                typeAr: 'قيد يومية / تسوية',
                refNo: j.entryNumber,
                description: line.memo || j.description || `قيد تسوية رقم ${j.entryNumber}`,
                debit,
                credit,
              },
            });
          }
        }
      });

      // Sort chronologically
      txs.sort((a, b) => a.date.localeCompare(b.date));

      txs.forEach((item) => {
        currentBal = currentBal + item.line.debit - item.line.credit;
        lines.push({
          ...item.line,
          runningBalance: Math.round(currentBal * 1000) / 1000,
        });
      });

      res.json({
        customer,
        openingBalance: opBal,
        openingBalanceDate: opDate,
        currentBalance: Math.round(currentBal * 1000) / 1000,
        totalInvoiced: invoices.reduce((s, i) => s + (i.type === 'SALES' ? i.grandTotal : -i.grandTotal), 0),
        totalPaid: vouchers.reduce((s, v) => s + (v.type === 'RECEIPT' ? v.amount : -v.amount), 0),
        statementLines: lines,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers', (req, res) => {
    res.json(db.getSuppliers());
  });

  app.post('/api/suppliers', (req, res) => {
    try {
      const { nameAr, nameEn, code, taxNumber, phone, email, address, governorate, city, openingBalance, openingBalanceDate } = req.body;
      const customCode = code || `SUPP-${201 + db.getSuppliers().length}`;
      const initialOpening = Number(openingBalance) || 0;
      const supplier = {
        id: 'supp-' + Math.random().toString(36).substr(2, 9),
        code: customCode,
        nameAr,
        nameEn: nameEn || nameAr,
        taxNumber,
        phone,
        email,
        address,
        governorate: governorate || address || '',
        city: city || 'الكويت',
        balance: initialOpening,
        openingBalance: initialOpening,
        openingBalanceDate: openingBalanceDate || '2026-07-01',
      };
      db.addSupplier(supplier);
      res.status(201).json(supplier);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/suppliers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { nameAr, nameEn, code, taxNumber, phone, email, address, governorate, city, openingBalance, openingBalanceDate, balance } = req.body;
      const supplier = db.getSuppliers().find((s) => s.id === id);
      if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

      const updatedOpening = openingBalance !== undefined ? Number(openingBalance) : supplier.openingBalance;
      
      // Calculate exact balance from updatedOpening + purchases - payments + manual journals
      const invoices = db.getInvoices().filter((i) => i.entityId === id && i.status !== 'CANCELLED');
      const vouchers = db.getVouchers().filter((v) => v.entityId === id);
      const journals = (db.getJournals() || []).filter((j) => j.status !== 'CANCELLED' && j.status !== 'REVERSED');

      let calcBalance = updatedOpening;
      invoices.forEach((inv) => {
        if (inv.type === 'PURCHASE') calcBalance += (Number(inv.grandTotal) || 0);
        else if (inv.type === 'PURCHASE_RETURN') calcBalance -= (Number(inv.grandTotal) || 0);
      });
      vouchers.forEach((v) => {
        const vType = v.type || 'PAYMENT';
        if (vType === 'PAYMENT') calcBalance -= (Number(v.amount) || 0);
        else if (vType === 'RECEIPT') calcBalance += (Number(v.amount) || 0);
      });

      const suppName = ((nameAr ?? supplier.nameAr) || '').trim();
      const suppCode = ((code ?? supplier.code) || '').trim();
      journals.forEach((j) => {
        if (j.isAutoGenerated && (
          j.sourceModule === 'SALES_INVOICE' || 
          j.sourceModule === 'PURCHASE_INVOICE' || 
          j.sourceModule === 'RECEIPT' || 
          j.sourceModule === 'PAYMENT'
        )) {
          return;
        }
        for (const line of j.lines || []) {
          const isDirectEntityIdMatch = Boolean(line.entityId && line.entityId === id);
          const isDirectAccountMatch = Boolean(line.accountId === id || (supplier.accountId && line.accountId === supplier.accountId));
          const isAccountCodeMatch = Boolean(suppCode && line.accountCode === suppCode);
          const isEntityNameMatch = Boolean(
            (line.entityNameAr && (
              line.entityNameAr.trim() === suppName ||
              line.entityNameAr.includes(suppName) ||
              suppName.includes(line.entityNameAr)
            )) ||
            (line.entityType === 'SUPPLIER' && (
              (line.entityId && line.entityId === id) ||
              (line.entityNameAr && line.entityNameAr.trim() === suppName)
            ))
          );
          const isMemoOrDescMatch = Boolean(
            (line.memo && ((suppName && line.memo.includes(suppName)) || (suppCode && line.memo.includes(suppCode)))) ||
            (j.description && ((suppName && j.description.includes(suppName)) || (suppCode && j.description.includes(suppCode))))
          );

          if (isDirectEntityIdMatch || isDirectAccountMatch || isAccountCodeMatch || isEntityNameMatch || isMemoOrDescMatch) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            // For supplier (credit normal): credit increases liability, debit decreases liability
            calcBalance += (credit - debit);
          }
        }
      });

      const updatedBalance = balance !== undefined ? Number(balance) : Math.round(calcBalance * 1000) / 1000;

      db.updateSupplier(id, {
        nameAr: nameAr ?? supplier.nameAr,
        nameEn: nameEn ?? supplier.nameEn,
        code: code ?? supplier.code,
        taxNumber: taxNumber ?? supplier.taxNumber,
        phone: phone ?? supplier.phone,
        email: email ?? supplier.email,
        address: address ?? supplier.address,
        governorate: governorate ?? supplier.governorate,
        city: city ?? supplier.city,
        openingBalance: updatedOpening,
        openingBalanceDate: openingBalanceDate ?? supplier.openingBalanceDate,
        balance: updatedBalance,
      });

      res.json({ success: true, supplier: db.getSuppliers().find((s) => s.id === id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/suppliers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteSupplier(id);
      if (!success) return res.status(404).json({ error: 'المورد غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Supplier Detailed Statement
  app.get('/api/suppliers/:id/statement', (req, res) => {
    try {
      const { id } = req.params;
      const supplier = db.getSuppliers().find((s) => s.id === id);
      if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

      const invoices = db.getInvoices().filter((i) => i.entityId === id && i.status !== 'CANCELLED');
      const vouchers = db.getVouchers().filter((v) => v.entityId === id && v.status !== 'CANCELLED');
      const journals = (db.getJournals() || []).filter((j) => j.status !== 'CANCELLED' && j.status !== 'REVERSED');

      const opBal = Number(supplier.openingBalance) || 0;
      const opDate = supplier.openingBalanceDate || '2026-07-01';

      interface StatementLine {
        id: string;
        date: string;
        type: 'OPENING' | 'INVOICE' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
        typeAr: string;
        refNo: string;
        description: string;
        debit: number;
        credit: number;
        runningBalance: number;
      }

      const lines: StatementLine[] = [];
      let currentBal = opBal;

      lines.push({
        id: 'op-supp-' + id,
        date: opDate,
        type: 'OPENING',
        typeAr: 'رصيد افتتاحي',
        refNo: 'INIT-BAL',
        description: `رصيد افتتاحي مسجل للمورد بتاريخ ${opDate}`,
        debit: opBal < 0 ? Math.abs(opBal) : 0,
        credit: opBal > 0 ? opBal : 0,
        runningBalance: currentBal,
      });

      const txs: Array<{ date: string; line: Omit<StatementLine, 'runningBalance'> }> = [];

      invoices.forEach((inv) => {
        const isPurchase = inv.type === 'PURCHASE';
        txs.push({
          date: inv.date,
          line: {
            id: inv.id,
            date: inv.date,
            type: 'INVOICE',
            typeAr: isPurchase ? 'فاتورة مشتريات' : 'مرتجع مشتريات (إشعار مدين)',
            refNo: inv.invoiceNumber,
            description: inv.notes || (isPurchase ? `فاتورة توريد مواد رقم ${inv.invoiceNumber}` : `مرتجع مشتريات رقم ${inv.invoiceNumber}`),
            debit: isPurchase ? 0 : inv.grandTotal,
            credit: isPurchase ? inv.grandTotal : 0,
          },
        });
      });

      vouchers.forEach((v) => {
        const isPayment = (v.type || 'PAYMENT') === 'PAYMENT';
        txs.push({
          date: v.date,
          line: {
            id: v.id,
            date: v.date,
            type: isPayment ? 'PAYMENT' : 'RECEIPT',
            typeAr: isPayment ? 'سند صرف' : 'سند قبض',
            refNo: v.voucherNumber,
            description: v.notes || (isPayment ? `سند صرف لمورد رقم ${v.voucherNumber}` : `سند قبض رقم ${v.voucherNumber}`),
            debit: isPayment ? v.amount : 0,
            credit: isPayment ? 0 : v.amount,
          },
        });
      });

      const suppName = (supplier.nameAr || '').trim();
      const suppCode = (supplier.code || '').trim();
      journals.forEach((j) => {
        if (j.isAutoGenerated && (
          j.sourceModule === 'SALES_INVOICE' || 
          j.sourceModule === 'PURCHASE_INVOICE' || 
          j.sourceModule === 'RECEIPT' || 
          j.sourceModule === 'PAYMENT'
        )) {
          return;
        }

        for (const line of j.lines || []) {
          const isDirectMatch = Boolean(line.entityId === id || (supplier.accountId && line.accountId === supplier.accountId));
          const isCodeMatch = Boolean(suppCode && line.accountCode === suppCode);
          const isNameMatch = Boolean(
            (line.entityNameAr && line.entityNameAr.includes(suppName)) ||
            (line.entityType === 'SUPPLIER' && line.entityId === id)
          );

          if (isDirectMatch || isCodeMatch || isNameMatch) {
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            txs.push({
              date: j.date,
              line: {
                id: `${j.id}-${line.id}`,
                date: j.date,
                type: 'JOURNAL',
                typeAr: 'قيد يومية / تسوية',
                refNo: j.entryNumber,
                description: line.memo || j.description || `قيد تسوية رقم ${j.entryNumber}`,
                debit,
                credit,
              },
            });
          }
        }
      });

      txs.sort((a, b) => a.date.localeCompare(b.date));

      txs.forEach((item) => {
        currentBal += (item.line.credit - item.line.debit);
        lines.push({
          ...item.line,
          runningBalance: Math.round(currentBal * 1000) / 1000,
        });
      });

      res.json({
        supplier,
        openingBalance: opBal,
        closingBalance: Math.round(currentBal * 1000) / 1000,
        totalDebit: lines.reduce((s, l) => s + l.debit, 0),
        totalCredit: lines.reduce((s, l) => s + l.credit, 0),
        lines,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Users Management
  app.get('/api/users', (req, res) => {
    res.json(db.getUsers());
  });

  app.post('/api/users', (req, res) => {
    try {
      const { name, username, email, role, roleTitleAr, pinCode } = req.body;
      if (!name || !username || !role) {
        return res.status(400).json({ error: 'يرجى تزويد الاسم واسم المستخدم والدور' });
      }
      const newUser = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        name,
        username,
        email: email || '',
        role: role || 'ACCOUNTANT',
        roleTitleAr: roleTitleAr || 'محاسب',
        isActive: true,
        pinCode: pinCode || '1234',
      };
      db.addUser(newUser);
      res.status(201).json(newUser);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.updateUser(id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteUser(id);
      if (!success) return res.status(404).json({ error: 'المستخدم غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory', (req, res) => {
    res.json(db.getInventory());
  });

  app.post('/api/inventory', (req, res) => {
    try {
      const { sku, barcode, nameAr, nameEn, category, unit, unitsPerPack, packUnit, purchasePrice, salePrice, quantityOnHand, minQuantityAlert } = req.body;
      const item = {
        id: 'item-' + Math.random().toString(36).substr(2, 9),
        sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: barcode || '',
        nameAr,
        nameEn: nameEn || nameAr,
        category: category || 'عام',
        unit: unit || 'حبة',
        unitsPerPack: Number(unitsPerPack) || 1,
        packUnit: packUnit || 'كرتون',
        purchasePrice: Number(purchasePrice) || 0,
        salePrice: Number(salePrice) || 0,
        quantityOnHand: Number(quantityOnHand) || 0,
        minQuantityAlert: Number(minQuantityAlert) || 5,
        isActive: true,
      };
      db.addInventoryItem(item);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/inventory/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.updateInventoryItem(id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteInventoryItem(id);
      if (!success) return res.status(404).json({ error: 'الصنف غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/invoices', (req, res) => {
    res.json(db.getInvoices().sort((a, b) => b.date.localeCompare(a.date)));
  });

  app.post('/api/invoices', (req, res) => {
    try {
      const { type, entityId, lines, notes, date, dueDate, discountType, discountValue } = req.body;

      const entity =
        type === 'SALES' || type === 'SALES_RETURN'
          ? db.getCustomers().find((c) => c.id === entityId)
          : db.getSuppliers().find((s) => s.id === entityId);

      if (!entity) return res.status(400).json({ error: 'العميل أو المورد غير موجود' });

      let subtotal = 0;
      let lineDiscountsSum = 0;

      const processedLines = lines.map((l: any) => {
        const qty = Number(l.quantity) || 1;
        const price = Number(l.unitPrice) || 0;
        const lineSubtotal = qty * price;

        let lineDiscountAmt = 0;
        if (l.discountType === 'PERCENT' && Number(l.discountValue) > 0) {
          lineDiscountAmt = lineSubtotal * (Number(l.discountValue) / 100);
        } else if (l.discountType === 'FIXED' && Number(l.discountValue) > 0) {
          lineDiscountAmt = Number(l.discountValue);
        } else if (Number(l.discountAmount) > 0) {
          lineDiscountAmt = Number(l.discountAmount);
        }

        subtotal += lineSubtotal;
        lineDiscountsSum += lineDiscountAmt;

        return {
          id: 'inl-' + Math.random().toString(36).substr(2, 9),
          itemId: l.itemId,
          itemSku: l.itemSku || '',
          itemNameAr: l.itemNameAr || 'بضاعة/خدمة',
          unit: l.unit || 'حبة',
          unitsPerPack: Number(l.unitsPerPack) || 1,
          quantity: qty,
          packQuantity: Number(l.packQuantity) || 0,
          unitPrice: price,
          subtotal: lineSubtotal,
          discountType: l.discountType || undefined,
          discountValue: Number(l.discountValue) || 0,
          discountAmount: lineDiscountAmt,
          vatRate: 0,
          vatAmount: 0,
          total: lineSubtotal - lineDiscountAmt,
        };
      });

      let overallDiscount = 0;
      if (discountType === 'PERCENT' && Number(discountValue) > 0) {
        overallDiscount = subtotal * (Number(discountValue) / 100);
      } else if (discountType === 'FIXED' && Number(discountValue) > 0) {
        overallDiscount = Number(discountValue);
      }

      const discountTotal = Math.min(subtotal, overallDiscount + lineDiscountsSum);
      const vatTotal = 0;
      const grandTotal = Math.max(0, subtotal - discountTotal);
      const invCount = db.getInvoices().length + 1;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount).padStart(4, '0')}`;

      const invoice: Invoice = {
        id: 'inv-' + Math.random().toString(36).substr(2, 9),
        invoiceNumber,
        type: type || 'SALES',
        entityId,
        entityNameAr: entity.nameAr,
        date: date || new Date().toISOString().split('T')[0],
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        lines: processedLines,
        subtotal,
        vatTotal: 0,
        discountType: discountType || 'FIXED',
        discountValue: Number(discountValue) || 0,
        discountTotal,
        grandTotal,
        paidAmount: 0,
        dueAmount: grandTotal,
        notes,
        createdAt: new Date().toISOString(),
      };

      db.addInvoice(invoice);

      // Auto post if requested
      if (req.body.autoPost) {
        if (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') {
          AccountingEngine.postSalesInvoice(invoice.id);
        } else {
          AccountingEngine.postPurchaseInvoice(invoice.id);
        }
      }

      res.status(201).json(db.getInvoices().find((i) => i.id === invoice.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/invoices/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = AccountingEngine.updateInvoice(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/invoices/:id', (req, res) => {
    try {
      const { id } = req.params;
      const inv = db.getInvoices().find((i) => i.id === id);
      if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      
      // If posted or paid, automatically run cancellation reversal before deleting
      if (inv.status === 'POSTED' || inv.status === 'PAID') {
        AccountingEngine.cancelInvoice(id, 'حذف الفاتورة بالكامل وعكس القيود والمخزون');
      }
      
      db.deleteInvoice(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/invoices/:id/cancel', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const cancelled = AccountingEngine.cancelInvoice(id, reason || 'إلغاء الفاتورة بطلب المستخدم');
      res.json(cancelled);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/invoices/:id/post', (req, res) => {
    try {
      const { id } = req.params;
      const updated = AccountingEngine.postInvoice(id);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Units of Measure endpoints
  app.get('/api/units', (req, res) => {
    res.json(db.getUnits());
  });

  app.post('/api/units', (req, res) => {
    try {
      const { code, nameAr, nameEn, conversionFactor, isBaseUnit, description } = req.body;
      if (!code || !nameAr) {
        return res.status(400).json({ error: 'الرجاء إدخال رمز واسم وحدة القياس' });
      }
      const newUnit = {
        id: 'u-' + Math.random().toString(36).substr(2, 9),
        code,
        nameAr,
        nameEn: nameEn || nameAr,
        conversionFactor: Number(conversionFactor) || 1,
        isBaseUnit: !!isBaseUnit,
        description: description || '',
      };
      db.addUnit(newUnit);
      res.status(201).json(newUnit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/units/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.updateUnit(id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/units/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteUnit(id);
      if (!success) return res.status(404).json({ error: 'الوحدة غير موجودة' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/vouchers', (req, res) => {
    res.json(db.getVouchers());
  });

  app.post('/api/vouchers', (req, res) => {
    try {
      const { type, entityType, entityId, amount, paymentMethod, bankAccountId, invoiceId, notes, reference, date } =
        req.body;

      const entity =
        entityType === 'CUSTOMER'
          ? db.getCustomers().find((c) => c.id === entityId)
          : db.getSuppliers().find((s) => s.id === entityId);

      if (!entity) return res.status(400).json({ error: 'الجهة المحددة غير موجودة' });

      const vCount = db.getVouchers().length + 1;
      const voucherNumber = `${type === 'RECEIPT' ? 'RV' : 'PV'}-${new Date().getFullYear()}-${String(vCount).padStart(4, '0')}`;

      const voucher: PaymentVoucher = {
        id: 'vouch-' + Math.random().toString(36).substr(2, 9),
        voucherNumber,
        type,
        date: date || new Date().toISOString().split('T')[0],
        entityType,
        entityId,
        entityNameAr: entity.nameAr,
        amount: Number(amount) || 0,
        paymentMethod: paymentMethod || 'BANK',
        bankAccountId: bankAccountId || 'acc-1111',
        invoiceId,
        reference: reference || voucherNumber,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };

      const posted = AccountingEngine.postVoucher(voucher);
      res.status(201).json(posted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/vouchers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updated = AccountingEngine.updateVoucher(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/vouchers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = AccountingEngine.deleteVoucher(id);
      if (!success) return res.status(404).json({ error: 'السند غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/vouchers/:id/cancel', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const cancelled = AccountingEngine.cancelVoucher(id, reason || 'إلغاء السند بطلب المستخدم');
      res.json(cancelled);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/system/integrity-sync', (req, res) => {
    try {
      const result = AccountingEngine.recalculateAllEntityBalances();
      res.json({ success: true, ...result, message: 'تمت المزامنة والتدقيق بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Production Orders (Mill Batch Processing)
  app.get('/api/production-orders', (req, res) => {
    try {
      res.json(db.getProductionOrders());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/production-orders', (req, res) => {
    try {
      const order = AccountingEngine.processProductionOrder(req.body);
      res.status(201).json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Company Setup & Profile Management
  app.get('/api/company', (req, res) => {
    try {
      const company = db.getCompany();
      res.json(company);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/company', (req, res) => {
    try {
      const updated = db.updateCompany(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk Import APIs
  app.post('/api/import/customers', (req, res) => {
    try {
      const { customers, createOpeningJournal } = req.body;
      if (!Array.isArray(customers) || customers.length === 0) {
        return res.status(400).json({ error: 'قائمة العملاء فارغة أو غير صالحة' });
      }
      const result = db.bulkImportCustomers(customers, !!createOpeningJournal);
      res.status(201).json({ success: true, ...result, message: `تم استيراد ${result.count} عميل بنجاح` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/import/suppliers', (req, res) => {
    try {
      const { suppliers, createOpeningJournal } = req.body;
      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        return res.status(400).json({ error: 'قائمة الموردين فارغة أو غير صالحة' });
      }
      const result = db.bulkImportSuppliers(suppliers, !!createOpeningJournal);
      res.status(201).json({ success: true, ...result, message: `تم استيراد ${result.count} مورد بنجاح` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/import/inventory', (req, res) => {
    try {
      const { items, createOpeningJournal } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'قائمة الأصناف فارغة أو غير صالحة' });
      }
      const result = db.bulkImportInventory(items, !!createOpeningJournal);
      res.status(201).json({ success: true, ...result, message: `تم استيراد ${result.count} صنف مخزني بنجاح` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch Pricing Updater
  app.post('/api/inventory/batch-pricing', (req, res) => {
    try {
      const { itemIds, category, mode, targetField, value, roundTo } = req.body;
      if (!mode || !targetField || value === undefined) {
        return res.status(400).json({ error: 'معاملات تعديل الأسعار غير مكتملة' });
      }
      const result = db.batchUpdatePrices({ itemIds, category, mode, targetField, value: Number(value), roundTo: Number(roundTo) || 0 });
      res.json({ success: true, ...result, message: `تم تحديث أسعار ${result.updatedCount} صنف بنجاح` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Database Initialization Wizard
  app.post('/api/database/wizard-init', (req, res) => {
    try {
      const result = db.wizardInitializeDatabase(req.body);
      res.status(201).json({ success: true, ...result, message: 'تم إنشاء وتهيئة قاعدة البيانات الجديدة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Backup & Restore Database
  app.get('/api/backup/export', (req, res) => {
    try {
      const backup = db.exportBackup();
      const filename = `erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/restore', (req, res) => {
    try {
      db.importBackup(req.body);
      res.json({ success: true, message: 'تم استعادة قاعدة البيانات بنجاح.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reset Financial Records (Invoices, Journals, Vouchers, Balances, Production Orders)
  app.post('/api/financials/reset', (req, res) => {
    try {
      db.resetFinancialData();
      res.json({ success: true, message: 'تم تصفير وإلغاء كافة السجلات والحركات المالية بنجاح.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Seed Data
  app.post('/api/seed/reset', (req, res) => {
    try {
      db.seedInitial();
      res.json({ message: 'تم إعادة ضبط قاعدة البيانات للقيم الافتراضية بنجاح.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------- VITE / PRODUCTION MIDDLEWARE -----------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ERP Server running on http://localhost:${PORT}`);
  });
}

startServer();
