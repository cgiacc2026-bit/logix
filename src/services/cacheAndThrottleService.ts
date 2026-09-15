/**
 * Enterprise Cache & Throttling Service
 * Designed to drastically cut Egress (bandwidth consumption) on Supabase Free Tier.
 * 
 * Capabilities:
 * 1. In-memory TTL caching for semi-static tables:
 *    - chart_of_accounts (5 min)
 *    - master_price_lists (10 min)
 *    - warehouses (10 min)
 * 2. Throttled / Debounced full-company ledger balance recalculation:
 *    - Minimum interval: 60,000ms (1 minute) per company
 *    - Prevents full table scan loops on every invoice / voucher insert
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheAndThrottleService {
  private static cache: Map<string, CacheEntry<any>> = new Map();
  private static lastRecalculateTime: Map<string, number> = new Map();
  private static recalculateTimers: Map<string, any> = new Map();

  // ==========================================
  // In-Memory Cache for Semi-Static Data
  // ==========================================

  public static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public static set<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  public static invalidate(keyPrefix: string): void {
    for (const k of this.cache.keys()) {
      if (k.startsWith(keyPrefix)) {
        this.cache.delete(k);
      }
    }
  }

  public static clearAll(): void {
    this.cache.clear();
  }

  // ==========================================
  // Throttled Ledger Recalculation (Max 1 per 60s)
  // ==========================================

  /**
   * Schedules or executes a full company ledger recalculation.
   * Guarantees at least 60 seconds interval between executions per company.
   */
  public static async throttledRecalculate(
    companyId: string,
    executeFn: () => Promise<any>,
    minIntervalMs: number = 60000
  ): Promise<boolean> {
    if (!companyId) return false;

    const now = Date.now();
    const lastTime = this.lastRecalculateTime.get(companyId) || 0;
    const elapsed = now - lastTime;

    if (elapsed >= minIntervalMs) {
      // Execute immediately and update timestamp
      this.lastRecalculateTime.set(companyId, now);
      if (this.recalculateTimers.has(companyId)) {
        clearTimeout(this.recalculateTimers.get(companyId));
        this.recalculateTimers.delete(companyId);
      }
      try {
        await executeFn();
        return true;
      } catch (err) {
        console.warn('[CacheAndThrottle] throttledRecalculate error:', err);
        return false;
      }
    } else {
      // Debounce: schedule for when the interval has elapsed if not already scheduled
      if (!this.recalculateTimers.has(companyId)) {
        const delay = minIntervalMs - elapsed;
        const timer = setTimeout(async () => {
          this.recalculateTimers.delete(companyId);
          this.lastRecalculateTime.set(companyId, Date.now());
          try {
            await executeFn();
          } catch (err) {
            console.warn('[CacheAndThrottle] Scheduled throttledRecalculate error:', err);
          }
        }, delay);
        this.recalculateTimers.set(companyId, timer);
      }
      return true;
    }
  }
}
