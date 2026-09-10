const fs = require('fs');

let dsCode = fs.readFileSync('src/services/dataService.ts', 'utf8');

// Bypass setLocal
const setLocalTarget = `  public setLocal<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    this.memoryFallback[key] = serialized;`;

const setLocalReplacement = `  public setLocal<T>(key: string, value: T): void {
    // [ARCHITECT] Strict Bypass: Do not write financial data to LocalStorage if cloud is configured.
    if (isSupabaseConfigured && (
      key.includes(STORAGE_KEYS.INVOICES) || 
      key.includes(STORAGE_KEYS.VOUCHERS) || 
      key.includes(STORAGE_KEYS.JOURNALS) || 
      key.includes(STORAGE_KEYS.INVENTORY) ||
      key.includes(STORAGE_KEYS.CUSTOMERS) ||
      key.includes(STORAGE_KEYS.SUPPLIERS) ||
      key.includes(STORAGE_KEYS.ACCOUNTS) ||
      key.includes(STORAGE_KEYS.PRODUCTION_ORDERS)
    )) {
      return; // Absolute eradication of local writing for transactional data
    }
    
    const serialized = JSON.stringify(value);
    this.memoryFallback[key] = serialized;`;

dsCode = dsCode.replace(setLocalTarget, setLocalReplacement);

// Bypass getLocal
const getLocalTarget = `  public getLocal<T>(key: string, defaultVal: T): T {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);`;

const getLocalReplacement = `  public getLocal<T>(key: string, defaultVal: T): T {
    // [ARCHITECT] Strict Bypass: Do not read financial data from LocalStorage if cloud is configured.
    if (isSupabaseConfigured && (
      key.includes(STORAGE_KEYS.INVOICES) || 
      key.includes(STORAGE_KEYS.VOUCHERS) || 
      key.includes(STORAGE_KEYS.JOURNALS) || 
      key.includes(STORAGE_KEYS.INVENTORY) ||
      key.includes(STORAGE_KEYS.CUSTOMERS) ||
      key.includes(STORAGE_KEYS.SUPPLIERS) ||
      key.includes(STORAGE_KEYS.ACCOUNTS) ||
      key.includes(STORAGE_KEYS.PRODUCTION_ORDERS)
    )) {
      return defaultVal; // Force reading from Supabase exclusively
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);`;

dsCode = dsCode.replace(getLocalTarget, getLocalReplacement);

fs.writeFileSync('src/services/dataService.ts', dsCode);
