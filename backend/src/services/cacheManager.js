/**
 * CacheManager — Simple in-memory TTL cache.
 * Avoids hammering external APIs by storing responses for configurable durations.
 */

class CacheManager {
  constructor() {
    /** @type {Map<string, {value: any, expiresAt: number}>} */
    this.store = new Map();
    // Sweep expired entries every 60s
    this._sweepInterval = setInterval(() => this._sweep(), 60_000);
  }

  /**
   * Get a cached value. Returns `null` if missing or expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set a cache entry with a TTL in milliseconds.
   */
  set(key, value, ttlMs = 60_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Remove a specific key.
   */
  invalidate(key) {
    this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Remove all expired entries.
   */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  /**
   * Clean-up interval on shutdown.
   */
  destroy() {
    clearInterval(this._sweepInterval);
    this.store.clear();
  }
}

// Singleton instance shared across services
const cache = new CacheManager();
export default cache;
