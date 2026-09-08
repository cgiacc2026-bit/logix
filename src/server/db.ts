import fs from 'fs';
import path from 'path';
import {
  Account,
  Customer,
  Supplier,
  InventoryItem,
  JournalEntry,
  Invoice,
  PaymentVoucher,
  CompanyProfile,
  SystemUser,
  UnitDefinition,
  ProductionOrder
} from '../types.js';
import {
  INITIAL_ACCOUNTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_INVENTORY,
  INITIAL_JOURNALS,
  INITIAL_INVOICES,
  INITIAL_USERS,
  INITIAL_UNITS,
  DEFAULT_COMPANY_PROFILE
} from './defaultData.js';

interface DBData {
  company: CompanyProfile;
  users: SystemUser[];
  accounts: Account[];
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  journals: JournalEntry[];
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
  units: UnitDefinition[];
  productionOrders?: ProductionOrder[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

class DatabaseStore {
  private data: DBData = {
    company: JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE)),
    users: JSON.parse(JSON.stringify(INITIAL_USERS)),
    accounts: [],
    customers: [],
    suppliers: [],
    inventory: [],
    journals: [],
    invoices: [],
    vouchers: [],
    units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
    productionOrders: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.company) {
          this.data.company = JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE));
        }
        if (!this.data.users || this.data.users.length === 0) {
          this.data.users = JSON.parse(JSON.stringify(INITIAL_USERS));
        }
        if (!this.data.units || this.data.units.length === 0) {
          this.data.units = JSON.parse(JSON.stringify(INITIAL_UNITS));
        }
        console.log('✅ Loaded ERP database from filesystem.');
      } else {
        this.seedInitial();
      }
    } catch (err) {
      console.error('Error initializing database, seeding defaults:', err);
      this.seedInitial();
    }
  }

  public seedInitial() {
    this.data = {
      company: JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE)),
      users: JSON.parse(JSON.stringify(INITIAL_USERS)),
      accounts: JSON.parse(JSON.stringify(INITIAL_ACCOUNTS)).map((a: any) => ({ ...a, balance: 0 })),
      customers: JSON.parse(JSON.stringify(INITIAL_CUSTOMERS)),
      suppliers: JSON.parse(JSON.stringify(INITIAL_SUPPLIERS)),
      inventory: JSON.parse(JSON.stringify(INITIAL_INVENTORY)),
      journals: JSON.parse(JSON.stringify(INITIAL_JOURNALS)),
      invoices: JSON.parse(JSON.stringify(INITIAL_INVOICES)),
      vouchers: [],
      units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
    };
    this.save();
    console.log('🌱 Seeded authentic Al-Waleed ERP database.');
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save DB file:', err);
    }
  }

  /**
   * ACID Atomic Transaction Execution with snapshot and rollback on error
   */
  public executeTransaction<T>(work: () => T): T {
    const snapshot = JSON.stringify(this.data);
    try {
      const result = work();
      this.save();
      return result;
    } catch (error) {
      // Revert state on any domain or database failure
      this.data = JSON.parse(snapshot);
      throw error;
    }
  }

  // Getters
  public getCompany(): CompanyProfile {
    return this.data.company || DEFAULT_COMPANY_PROFILE;
  }

  public getUsers(): SystemUser[] {
    return this.data.users || [];
  }

  public addUser(user: SystemUser) {
    this.data.users.push(user);
    this.save();
  }

  public updateUser(id: string, updated: Partial<SystemUser>) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updated };
      this.save();
    }
  }

  public deleteUser(id: string): boolean {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.data.users.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public deleteInventoryItem(id: string): boolean {
    const idx = this.data.inventory.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.data.inventory.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public deleteInvoice(id: string): boolean {
    const idx = this.data.invoices.findIndex((inv) => inv.id === id);
    if (idx !== -1) {
      this.data.invoices.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public deleteJournal(id: string): boolean {
    const idx = this.data.journals.findIndex((j) => j.id === id);
    if (idx !== -1) {
      this.data.journals.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public updateCompany(updated: Partial<CompanyProfile>): CompanyProfile {
    this.data.company = { ...this.getCompany(), ...updated };
    this.save();
    return this.data.company;
  }
  public getAccounts(): Account[] {
    return this.data.accounts;
  }

  public getCustomers(): Customer[] {
    return this.data.customers;
  }

  public getSuppliers(): Supplier[] {
    return this.data.suppliers;
  }

  public getInventory(): InventoryItem[] {
    return this.data.inventory;
  }

  public getJournals(): JournalEntry[] {
    return this.data.journals;
  }

  public getInvoices(): Invoice[] {
    return this.data.invoices;
  }

  public getVouchers(): PaymentVoucher[] {
    return this.data.vouchers;
  }

  public getProductionOrders(): ProductionOrder[] {
    if (!this.data.productionOrders) {
      this.data.productionOrders = [];
    }
    return this.data.productionOrders;
  }

  public addProductionOrder(order: ProductionOrder) {
    if (!this.data.productionOrders) {
      this.data.productionOrders = [];
    }
    this.data.productionOrders.unshift(order);
    this.save();
  }

  // Mutations
  public addAccount(account: Account) {
    this.data.accounts.push(account);
    this.save();
  }

  public updateAccount(id: string, updated: Partial<Account>) {
    const idx = this.data.accounts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.data.accounts[idx] = { ...this.data.accounts[idx], ...updated };
      this.save();
    }
  }

  public deleteAccount(id: string): boolean {
    const idx = this.data.accounts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.data.accounts.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addJournal(journal: JournalEntry) {
    this.data.journals.push(journal);
    this.save();
  }

  public updateJournal(id: string, updated: Partial<JournalEntry>) {
    const idx = this.data.journals.findIndex((j) => j.id === id);
    if (idx !== -1) {
      this.data.journals[idx] = { ...this.data.journals[idx], ...updated };
      this.save();
    }
  }

  public addCustomer(customer: Customer) {
    this.data.customers.push(customer);
    this.save();
  }

  public updateCustomer(id: string, updated: Partial<Customer>) {
    const idx = this.data.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.data.customers[idx] = { ...this.data.customers[idx], ...updated };
      this.save();
    }
  }

  public deleteCustomer(id: string): boolean {
    const idx = this.data.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.data.customers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addSupplier(supplier: Supplier) {
    this.data.suppliers.push(supplier);
    this.save();
  }

  public updateSupplier(id: string, updated: Partial<Supplier>) {
    const idx = this.data.suppliers.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.data.suppliers[idx] = { ...this.data.suppliers[idx], ...updated };
      this.save();
    }
  }

  public deleteSupplier(id: string): boolean {
    const idx = this.data.suppliers.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.data.suppliers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addInventoryItem(item: InventoryItem) {
    this.data.inventory.push(item);
    this.save();
  }

  public updateInventoryItem(id: string, updated: Partial<InventoryItem>) {
    const idx = this.data.inventory.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.data.inventory[idx] = { ...this.data.inventory[idx], ...updated };
      this.save();
    }
  }

  public addInvoice(invoice: Invoice) {
    this.data.invoices.push(invoice);
    this.save();
  }

  public updateInvoice(id: string, updated: Partial<Invoice>) {
    const idx = this.data.invoices.findIndex((inv) => inv.id === id);
    if (idx !== -1) {
      this.data.invoices[idx] = { ...this.data.invoices[idx], ...updated };
      this.save();
    }
  }

  public addVoucher(voucher: PaymentVoucher) {
    this.data.vouchers.push(voucher);
    this.save();
  }

  public updateVoucher(id: string, updated: Partial<PaymentVoucher>) {
    const idx = this.data.vouchers.findIndex((v) => v.id === id);
    if (idx !== -1) {
      this.data.vouchers[idx] = { ...this.data.vouchers[idx], ...updated };
      this.save();
    }
  }

  public deleteVoucher(id: string): boolean {
    const idx = this.data.vouchers.findIndex((v) => v.id === id);
    if (idx !== -1) {
      this.data.vouchers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Units CRUD
  public getUnits(): UnitDefinition[] {
    return this.data.units || [];
  }

  public addUnit(unit: UnitDefinition) {
    if (!this.data.units) this.data.units = [];
    this.data.units.push(unit);
    this.save();
  }

  public updateUnit(id: string, updated: Partial<UnitDefinition>) {
    if (!this.data.units) return;
    const idx = this.data.units.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.data.units[idx] = { ...this.data.units[idx], ...updated };
      this.save();
    }
  }

  public deleteUnit(id: string): boolean {
    if (!this.data.units) return false;
    const idx = this.data.units.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.data.units.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Bulk Import Customers
  public bulkImportCustomers(customersList: Partial<Customer>[], createOpeningJournal = false): { count: number; openingJournalId?: string } {
    let totalOpeningDebit = 0;
    const createdCustomers: Customer[] = [];

    customersList.forEach((c, index) => {
      const id = c.id || 'cust-' + Math.random().toString(36).substr(2, 9);
      const code = c.code || `C-${String(this.data.customers.length + index + 1).padStart(3, '0')}`;
      const openingBal = Number(c.openingBalance) || 0;
      const initialBal = c.balance !== undefined ? Number(c.balance) : openingBal;

      const newCustomer: Customer = {
        id,
        code,
        nameAr: c.nameAr || `عميل جديد ${index + 1}`,
        nameEn: c.nameEn || c.nameAr || `Customer ${index + 1}`,
        taxNumber: c.taxNumber || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        governorate: c.governorate || 'العاصمة',
        city: c.city || 'الكويت',
        openingBalance: openingBal,
        openingBalanceDate: c.openingBalanceDate || new Date().toISOString().split('T')[0],
        balance: initialBal,
        isActive: true,
      };

      this.data.customers.push(newCustomer);
      createdCustomers.push(newCustomer);
      totalOpeningDebit += openingBal;
    });

    let journalId: string | undefined = undefined;

    // If requested, generate balanced Opening Journal entry for customers
    if (createOpeningJournal && totalOpeningDebit > 0) {
      const jNumber = `JV-OPEN-CUST-${Date.now().toString().slice(-4)}`;
      const jEntry: JournalEntry = {
        id: 'j-' + Math.random().toString(36).substr(2, 9),
        entryNumber: jNumber,
        date: new Date().toISOString().split('T')[0],
        description: `قيد افتتاحي: إثبات أرصدة أول المدة للعملاء المستوردين (عدد ${createdCustomers.length})`,
        reference: 'OPENING-CUST',
        status: 'POSTED',
        totalDebit: totalOpeningDebit,
        totalCredit: totalOpeningDebit,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: 'line-1',
            accountId: 'acc-1120', // Accounts Receivable
            accountCode: '1120',
            accountNameAr: 'الذمم المدينة (حسابات العملاء)',
            debit: totalOpeningDebit,
            credit: 0,
            memo: 'أرصدة افتتاحية - ذمم العملاء المستوردة',
          },
          {
            id: 'line-2',
            accountId: 'acc-3200', // Retained Earnings / Equity
            accountCode: '3200',
            accountNameAr: 'الأرباح (الخسائر) المرحلة والمبقاة',
            debit: 0,
            credit: totalOpeningDebit,
            memo: 'تسوية رصيد أول المدة لحسابات العملاء',
          },
        ],
      };
      this.data.journals.push(jEntry);
      journalId = jEntry.id;
    }

    this.save();
    return { count: createdCustomers.length, openingJournalId: journalId };
  }

  // Bulk Import Suppliers
  public bulkImportSuppliers(suppliersList: Partial<Supplier>[], createOpeningJournal = false): { count: number; openingJournalId?: string } {
    let totalOpeningCredit = 0;
    const createdSuppliers: Supplier[] = [];

    suppliersList.forEach((s, index) => {
      const id = s.id || 'supp-' + Math.random().toString(36).substr(2, 9);
      const code = s.code || `S-${String(this.data.suppliers.length + index + 1).padStart(3, '0')}`;
      const openingBal = Number(s.openingBalance) || 0;
      const initialBal = s.balance !== undefined ? Number(s.balance) : openingBal;

      const newSupplier: Supplier = {
        id,
        code,
        nameAr: s.nameAr || `مورد جديد ${index + 1}`,
        nameEn: s.nameEn || s.nameAr || `Supplier ${index + 1}`,
        taxNumber: s.taxNumber || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        governorate: s.governorate || 'العاصمة',
        city: s.city || 'الكويت',
        openingBalance: openingBal,
        openingBalanceDate: s.openingBalanceDate || new Date().toISOString().split('T')[0],
        balance: initialBal,
        isActive: true,
      };

      this.data.suppliers.push(newSupplier);
      createdSuppliers.push(newSupplier);
      totalOpeningCredit += openingBal;
    });

    let journalId: string | undefined = undefined;

    if (createOpeningJournal && totalOpeningCredit > 0) {
      const jNumber = `JV-OPEN-SUPP-${Date.now().toString().slice(-4)}`;
      const jEntry: JournalEntry = {
        id: 'j-' + Math.random().toString(36).substr(2, 9),
        entryNumber: jNumber,
        date: new Date().toISOString().split('T')[0],
        description: `قيد افتتاحي: إثبات أرصدة أول المدة للموردين المستوردين (عدد ${createdSuppliers.length})`,
        reference: 'OPENING-SUPP',
        status: 'POSTED',
        totalDebit: totalOpeningCredit,
        totalCredit: totalOpeningCredit,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: 'line-1',
            accountId: 'acc-3200', // Retained Earnings / Equity
            accountCode: '3200',
            accountNameAr: 'الأرباح (الخسائر) المرحلة والمبقاة',
            debit: totalOpeningCredit,
            credit: 0,
            memo: 'تسوية رصيد أول المدة لحسابات الموردين',
          },
          {
            id: 'line-2',
            accountId: 'acc-2110', // Accounts Payable
            accountCode: '2110',
            accountNameAr: 'الذمم الدائنة (الموردين)',
            debit: 0,
            credit: totalOpeningCredit,
            memo: 'أرصدة افتتاحية - ذمم الموردين المستوردة',
          },
        ],
      };
      this.data.journals.push(jEntry);
      journalId = jEntry.id;
    }

    this.save();
    return { count: createdSuppliers.length, openingJournalId: journalId };
  }

  // Bulk Import Inventory Items
  public bulkImportInventory(itemsList: Partial<InventoryItem>[], createOpeningJournal = false): { count: number; openingJournalId?: string; totalStockValue?: number } {
    let totalStockValue = 0;
    const createdItems: InventoryItem[] = [];

    itemsList.forEach((it, index) => {
      const id = it.id || 'item-' + Math.random().toString(36).substr(2, 9);
      const sku = it.sku || `SKU-${Date.now().toString().slice(-4)}-${index + 1}`;
      const qty = Number(it.quantityOnHand) || 0;
      const cost = Number(it.purchasePrice) || 0;
      const sale = Number(it.salePrice) || 0;

      const newItem: InventoryItem = {
        id,
        sku,
        barcode: it.barcode || '',
        nameAr: it.nameAr || `صنف مخزني ${index + 1}`,
        nameEn: it.nameEn || it.nameAr || `Item ${index + 1}`,
        category: it.category || 'عام',
        unit: it.unit || 'حبة',
        unitsPerPack: Number(it.unitsPerPack) || 1,
        packUnit: it.packUnit || 'كرتون',
        purchasePrice: cost,
        salePrice: sale,
        quantityOnHand: qty,
        minQuantityAlert: Number(it.minQuantityAlert) !== undefined ? Number(it.minQuantityAlert) : 5,
        isActive: true,
      };

      this.data.inventory.push(newItem);
      createdItems.push(newItem);
      totalStockValue += qty * cost;
    });

    let journalId: string | undefined = undefined;

    if (createOpeningJournal && totalStockValue > 0) {
      const jNumber = `JV-OPEN-INV-${Date.now().toString().slice(-4)}`;
      const jEntry: JournalEntry = {
        id: 'j-' + Math.random().toString(36).substr(2, 9),
        entryNumber: jNumber,
        date: new Date().toISOString().split('T')[0],
        description: `قيد افتتاحي: إثبات قيمة بضاعة ومخزون أول المدة للأصناف المستوردة (عدد ${createdItems.length})`,
        reference: 'OPENING-STOCK',
        status: 'POSTED',
        totalDebit: totalStockValue,
        totalCredit: totalStockValue,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: 'line-1',
            accountId: 'acc-1130', // Inventory Asset
            accountCode: '1130',
            accountNameAr: 'مخزون البضائع والمنتجات',
            debit: totalStockValue,
            credit: 0,
            memo: 'إثبات بضاعة ومخزون أول المدة',
          },
          {
            id: 'line-2',
            accountId: 'acc-3200', // Retained Earnings / Equity
            accountCode: '3200',
            accountNameAr: 'الأرباح (الخسائر) المرحلة والمبقاة',
            debit: 0,
            credit: totalStockValue,
            memo: 'رصيد مخزون أول المدة مقابل حقوق الملكية',
          },
        ],
      };
      this.data.journals.push(jEntry);
      journalId = jEntry.id;
    }

    this.save();
    return { count: createdItems.length, openingJournalId: journalId, totalStockValue };
  }

  // Batch Update Pricing
  public batchUpdatePrices(params: {
    itemIds?: string[];
    category?: string;
    mode: 'MARKUP_PERCENT' | 'FIXED_ADD' | 'DIRECT_SET' | 'MARGIN_TARGET';
    targetField: 'SALE' | 'PURCHASE' | 'BOTH';
    value: number;
    roundTo?: number; // e.g. 0.05 or 0.1 or 0.001
  }): { updatedCount: number } {
    let count = 0;
    this.data.inventory.forEach((item) => {
      const matchesId = !params.itemIds || params.itemIds.length === 0 || params.itemIds.includes(item.id);
      const matchesCat = !params.category || params.category === 'ALL' || item.category === params.category;

      if (matchesId && matchesCat) {
        let newPurchase = item.purchasePrice;
        let newSale = item.salePrice;

        if (params.mode === 'MARKUP_PERCENT') {
          // Increase sale price by X% from cost or current sale
          if (params.targetField === 'SALE' || params.targetField === 'BOTH') {
            newSale = item.purchasePrice > 0 
              ? item.purchasePrice * (1 + params.value / 100) 
              : item.salePrice * (1 + params.value / 100);
          }
          if (params.targetField === 'PURCHASE' || params.targetField === 'BOTH') {
            newPurchase = item.purchasePrice * (1 + params.value / 100);
          }
        } else if (params.mode === 'FIXED_ADD') {
          if (params.targetField === 'SALE' || params.targetField === 'BOTH') {
            newSale = Math.max(0, item.salePrice + params.value);
          }
          if (params.targetField === 'PURCHASE' || params.targetField === 'BOTH') {
            newPurchase = Math.max(0, item.purchasePrice + params.value);
          }
        } else if (params.mode === 'DIRECT_SET') {
          if (params.targetField === 'SALE') newSale = params.value;
          if (params.targetField === 'PURCHASE') newPurchase = params.value;
        } else if (params.mode === 'MARGIN_TARGET') {
          // Gross Margin = (Sale - Cost) / Sale => Sale = Cost / (1 - Margin/100)
          if (params.value < 100 && params.value >= 0 && item.purchasePrice > 0) {
            newSale = item.purchasePrice / (1 - params.value / 100);
          }
        }

        // Apply rounding
        if (params.roundTo && params.roundTo > 0) {
          newSale = Math.round(newSale / params.roundTo) * params.roundTo;
          newPurchase = Math.round(newPurchase / params.roundTo) * params.roundTo;
        }

        item.purchasePrice = Number(newPurchase.toFixed(3));
        item.salePrice = Number(newSale.toFixed(3));
        count++;
      }
    });

    this.save();
    return { updatedCount: count };
  }

  // Step-by-Step Database Initialization Wizard
  public wizardInitializeDatabase(payload: {
    company: Partial<CompanyProfile>;
    chartPreset: 'IFRS_KUWAIT' | 'COMMERCIAL' | 'SERVICE';
    openingCash?: number;
    openingBank?: number;
    openingCapital?: number;
    customers?: Partial<Customer>[];
    suppliers?: Partial<Supplier>[];
    inventory?: Partial<InventoryItem>[];
  }): { success: boolean; stats: any } {
    // 1. Reset/Initialize base company
    const newCompany: CompanyProfile = {
      ...JSON.parse(JSON.stringify(DEFAULT_COMPANY_PROFILE)),
      ...payload.company,
      nameAr: payload.company.nameAr || 'الشركة الجديدة للتجارة العامة والمقاولات',
      currency: payload.company.currency || 'KWD',
    };

    // 2. Load chart of accounts
    const newAccounts: Account[] = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));

    // 3. Clear existing transactional records
    this.data = {
      company: newCompany,
      users: JSON.parse(JSON.stringify(INITIAL_USERS)),
      accounts: newAccounts,
      customers: [],
      suppliers: [],
      inventory: [],
      journals: [],
      invoices: [],
      vouchers: [],
      units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
    };

    // 4. Import customers if provided
    if (payload.customers && payload.customers.length > 0) {
      this.bulkImportCustomers(payload.customers, false);
    }

    // 5. Import suppliers if provided
    if (payload.suppliers && payload.suppliers.length > 0) {
      this.bulkImportSuppliers(payload.suppliers, false);
    }

    // 6. Import inventory if provided
    if (payload.inventory && payload.inventory.length > 0) {
      this.bulkImportInventory(payload.inventory, false);
    }

    // 7. Generate Master Opening Journal Entry
    const openingCash = Number(payload.openingCash) || 0;
    const openingBank = Number(payload.openingBank) || 0;
    const totalCustOpening = this.data.customers.reduce((s, c) => s + (c.openingBalance || 0), 0);
    const totalSuppOpening = this.data.suppliers.reduce((s, s2) => s + (s2.openingBalance || 0), 0);
    const totalStockOpening = this.data.inventory.reduce((s, it) => s + ((it.quantityOnHand || 0) * (it.purchasePrice || 0)), 0);

    const totalDebits = openingCash + openingBank + totalCustOpening + totalStockOpening;
    const totalCredits = totalSuppOpening;
    const netEquityCapital = totalDebits - totalCredits;

    const openingLines: any[] = [];
    let lineIdx = 1;

    if (openingCash > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-1113',
        accountCode: '1113',
        accountNameAr: 'الصندوق الرئيسي (الخزينة)',
        debit: openingCash,
        credit: 0,
        description: 'رصيد النقدية الافتتاحي بالخزينة',
      });
    }

    if (openingBank > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-1111',
        accountCode: '1111',
        accountNameAr: 'بنك الكويت الوطني (NBK) - الحساب الرئيسي',
        debit: openingBank,
        credit: 0,
        description: 'رصيد الحساب البنكي الافتتاحي',
      });
    }

    if (totalCustOpening > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-1120',
        accountCode: '1120',
        accountNameAr: 'الذمم المدينة (حسابات العملاء)',
        debit: totalCustOpening,
        credit: 0,
        description: 'إجمالي أرصدة أول المدة للعملاء',
      });
    }

    if (totalStockOpening > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-1130',
        accountCode: '1130',
        accountNameAr: 'مخزون البضائع والمنتجات',
        debit: totalStockOpening,
        credit: 0,
        description: 'إجمالي تقييم بضاعة أول المدة بالمخازن',
      });
    }

    if (totalSuppOpening > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-2110',
        accountCode: '2110',
        accountNameAr: 'الذمم الدائنة (الموردين)',
        debit: 0,
        credit: totalSuppOpening,
        description: 'إجمالي أرصدة أول المدة للموردين',
      });
    }

    if (netEquityCapital > 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-3100', // Capital
        accountCode: '3100',
        accountNameAr: 'رأس المال المدفوع',
        debit: 0,
        credit: netEquityCapital,
        description: 'صافي حقوق الملكية ورأس المال الافتتاحي الموازن',
      });
    } else if (netEquityCapital < 0) {
      openingLines.push({
        id: `line-${lineIdx++}`,
        accountId: 'acc-3200', // Retained Losses
        accountCode: '3200',
        accountNameAr: 'الأرباح (الخسائر) المرحلة والمبقاة',
        debit: Math.abs(netEquityCapital),
        credit: 0,
        description: 'موازنة عجز حقوق الملكية الافتتاحية',
      });
    }

    if (openingLines.length >= 2) {
      const sumD = openingLines.reduce((a, b) => a + (b.debit || 0), 0);
      const sumC = openingLines.reduce((a, b) => a + (b.credit || 0), 0);
      const masterOpeningJournal: JournalEntry = {
        id: 'j-opening-master-' + Date.now(),
        entryNumber: 'JV-OPEN-0001',
        date: newCompany.fiscalYearStart || new Date().toISOString().split('T')[0],
        description: `القيد الافتتاحي الشامل لتأسيس وبدء السنة المالية لشركة (${newCompany.nameAr})`,
        reference: 'OPENING-BALANCE-MASTER',
        status: 'POSTED',
        totalDebit: sumD,
        totalCredit: sumC,
        createdAt: new Date().toISOString(),
        lines: openingLines,
      };
      this.data.journals.push(masterOpeningJournal);
    }

    this.save();

    return {
      success: true,
      stats: {
        company: newCompany.nameAr,
        customersCount: this.data.customers.length,
        suppliersCount: this.data.suppliers.length,
        inventoryCount: this.data.inventory.length,
        journalsCount: this.data.journals.length,
      },
    };
  }

  public resetFinancialData() {
    this.data.journals = [];
    this.data.invoices = [];
    this.data.vouchers = [];
    this.data.productionOrders = [];
    this.data.customers = (this.data.customers || []).map((c) => ({
      ...c,
      balance: 0,
      openingBalance: 0,
      openingBalanceDate: '',
    }));
    this.data.suppliers = (this.data.suppliers || []).map((s) => ({
      ...s,
      balance: 0,
      openingBalance: 0,
      openingBalanceDate: '',
    }));
    this.data.inventory = (this.data.inventory || []).map((i) => ({
      ...i,
      quantityOnHand: 0,
    }));
    this.save();
    console.log('🧹 Successfully cleared and reset all financial records (invoices, journals, vouchers, balances, stock).');
    return true;
  }

  // Backup & Export
  public exportBackup() {
    return {
      appName: 'ERP Financial System',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      companyName: this.data.company.nameAr,
      stats: {
        accountsCount: this.data.accounts.length,
        customersCount: this.data.customers.length,
        suppliersCount: this.data.suppliers.length,
        inventoryCount: this.data.inventory.length,
        journalsCount: this.data.journals.length,
        invoicesCount: this.data.invoices.length,
        vouchersCount: this.data.vouchers.length,
        unitsCount: (this.data.units || []).length,
      },
      data: this.data,
    };
  }

  public importBackup(backupObj: any) {
    if (!backupObj || typeof backupObj !== 'object') {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    const incomingData = backupObj.data || backupObj;
    if (!incomingData.accounts || !incomingData.company) {
      throw new Error('محتوى النسخة الاحتياطية غير مكتمل أو مفقود');
    }
    this.data = {
      company: incomingData.company,
      users: incomingData.users || [],
      accounts: incomingData.accounts || [],
      customers: incomingData.customers || [],
      suppliers: incomingData.suppliers || [],
      inventory: incomingData.inventory || [],
      journals: incomingData.journals || [],
      invoices: incomingData.invoices || [],
      vouchers: incomingData.vouchers || [],
      units: incomingData.units || [],
    };
    this.save();
    return true;
  }
}

export const db = new DatabaseStore();
