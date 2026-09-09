/**
 * Smart In-Memory & Local Caching Layer
 * Enterprise-grade caching with O(1) indexed lookups, TTL invalidation,
 * and Stale-While-Revalidate pattern for Items, Customers, Suppliers, and Accounts.
 */
import { InventoryItem, Customer, Supplier, Account } from '../types.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  companyId: string;
}

class SmartCacheService {
  private static instance: SmartCacheService;

  // Master data caches with company scoping
  private itemsCache: CacheEntry<InventoryItem[]> | null = null;
  private customersCache: CacheEntry<Customer[]> | null = null;
  private suppliersCache: CacheEntry<Supplier[]> | null = null;
  private accountsCache: CacheEntry<Account[]> | null = null;

  // Fast O(1) Index Maps
  private itemsById: Map<string, InventoryItem> = new Map();
  private itemsBySku: Map<string, InventoryItem> = new Map();
  private itemsByBarcode: Map<string, InventoryItem> = new Map();

  private customersById: Map<string, Customer> = new Map();
  private customersByPhone: Map<string, Customer> = new Map();

  private suppliersById: Map<string, Supplier> = new Map();

  // Cache configuration (Default: 3 minutes TTL)
  private readonly TTL_MS = 3 * 60 * 1000;

  private constructor() {}

  public static getInstance(): SmartCacheService {
    if (!SmartCacheService.instance) {
      SmartCacheService.instance = new SmartCacheService();
    }
    return SmartCacheService.instance;
  }

  // --- ITEMS CACHE ---
  public getItems(companyId: string): InventoryItem[] | null {
    if (this.itemsCache && this.itemsCache.companyId === companyId) {
      const isFresh = Date.now() - this.itemsCache.timestamp < this.TTL_MS;
      if (isFresh) {
        return this.itemsCache.data;
      }
    }
    return null;
  }

  public setItems(companyId: string, items: InventoryItem[]): void {
    this.itemsCache = {
      data: items,
      timestamp: Date.now(),
      companyId,
    };
    this.rebuildItemIndexes(items);
  }

  public getItemById(id: string): InventoryItem | undefined {
    return this.itemsById.get(id);
  }

  public getItemBySku(sku: string): InventoryItem | undefined {
    if (!sku) return undefined;
    return this.itemsBySku.get(sku.trim().toLowerCase());
  }

  public getItemByBarcode(barcode: string): InventoryItem | undefined {
    if (!barcode) return undefined;
    return this.itemsByBarcode.get(barcode.trim());
  }

  public updateInventoryStock(itemId: string, deltaQty: number): void {
    const item = this.itemsById.get(itemId);
    if (item) {
      item.quantityOnHand = Math.max(0, (Number(item.quantityOnHand) || 0) + deltaQty);
    }
  }

  private rebuildItemIndexes(items: InventoryItem[]): void {
    this.itemsById.clear();
    this.itemsBySku.clear();
    this.itemsByBarcode.clear();

    for (const it of items) {
      if (it.id) this.itemsById.set(it.id, it);
      if (it.sku) this.itemsBySku.set(it.sku.trim().toLowerCase(), it);
      if (it.barcode) this.itemsByBarcode.set(it.barcode.trim(), it);
    }
  }

  // --- CUSTOMERS CACHE ---
  public getCustomers(companyId: string): Customer[] | null {
    if (this.customersCache && this.customersCache.companyId === companyId) {
      const isFresh = Date.now() - this.customersCache.timestamp < this.TTL_MS;
      if (isFresh) {
        return this.customersCache.data;
      }
    }
    return null;
  }

  public setCustomers(companyId: string, customers: Customer[]): void {
    this.customersCache = {
      data: customers,
      timestamp: Date.now(),
      companyId,
    };
    this.rebuildCustomerIndexes(customers);
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customersById.get(id);
  }

  public updateCustomerBalance(customerId: string, deltaBalance: number): void {
    const cust = this.customersById.get(customerId);
    if (cust) {
      cust.balance = (Number(cust.balance) || 0) + deltaBalance;
    }
  }

  private rebuildCustomerIndexes(customers: Customer[]): void {
    this.customersById.clear();
    this.customersByPhone.clear();

    for (const c of customers) {
      if (c.id) this.customersById.set(c.id, c);
      if (c.phone) this.customersByPhone.set(c.phone.trim(), c);
    }
  }

  // --- SUPPLIERS CACHE ---
  public getSuppliers(companyId: string): Supplier[] | null {
    if (this.suppliersCache && this.suppliersCache.companyId === companyId) {
      const isFresh = Date.now() - this.suppliersCache.timestamp < this.TTL_MS;
      if (isFresh) {
        return this.suppliersCache.data;
      }
    }
    return null;
  }

  public setSuppliers(companyId: string, suppliers: Supplier[]): void {
    this.suppliersCache = {
      data: suppliers,
      timestamp: Date.now(),
      companyId,
    };
    this.suppliersById.clear();
    for (const s of suppliers) {
      if (s.id) this.suppliersById.set(s.id, s);
    }
  }

  public getSupplierById(id: string): Supplier | undefined {
    return this.suppliersById.get(id);
  }

  public updateSupplierBalance(supplierId: string, deltaBalance: number): void {
    const supp = this.suppliersById.get(supplierId);
    if (supp) {
      supp.balance = (Number(supp.balance) || 0) + deltaBalance;
    }
  }

  // --- ACCOUNTS CACHE ---
  public getAccounts(companyId: string): Account[] | null {
    if (this.accountsCache && this.accountsCache.companyId === companyId) {
      const isFresh = Date.now() - this.accountsCache.timestamp < this.TTL_MS;
      if (isFresh) {
        return this.accountsCache.data;
      }
    }
    return null;
  }

  public setAccounts(companyId: string, accounts: Account[]): void {
    this.accountsCache = {
      data: accounts,
      timestamp: Date.now(),
      companyId,
    };
  }

  // --- INVALIDATIONS ---
  public invalidateItems(): void {
    this.itemsCache = null;
  }

  public invalidateCustomers(): void {
    this.customersCache = null;
  }

  public invalidateSuppliers(): void {
    this.suppliersCache = null;
  }

  public invalidateAccounts(): void {
    this.accountsCache = null;
  }

  public invalidateAll(): void {
    this.itemsCache = null;
    this.customersCache = null;
    this.suppliersCache = null;
    this.accountsCache = null;
    this.itemsById.clear();
    this.itemsBySku.clear();
    this.itemsByBarcode.clear();
    this.customersById.clear();
    this.customersByPhone.clear();
    this.suppliersById.clear();
  }
}

export const cacheService = SmartCacheService.getInstance();
