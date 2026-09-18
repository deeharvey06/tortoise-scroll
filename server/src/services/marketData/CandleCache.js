import { fail } from './errors.js';

/** Process-local bounded LRU, source-version keys, single-flight loads, no error caching. */
export class CandleCache {
  constructor({
    maxEntries = 32,
    maxBytes = 32 * 1024 * 1024,
    ttlMs = 300_000,
    maxPending = 4,
    now = Date.now,
  } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.ttlMs = ttlMs;
    this.maxPending = maxPending;
    this.now = now;
    this.entries = new Map();
    this.pending = new Map();
    this.bytes = 0;
  }
  async getOrLoad(key, loader) {
    const found = this.entries.get(key);
    if (found) {
      this.entries.delete(key);
      if (found.expires > this.now()) {
        this.entries.set(key, found);
        return structuredClone(found.value);
      }
      this.bytes -= found.bytes;
    }
    if (this.pending.has(key))
      return structuredClone(await this.pending.get(key));
    if (this.pending.size >= this.maxPending)
      fail(
        'MARKET_DATA_BUSY',
        'Market-data loading is busy; retry shortly.',
        503
      );
    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        const bytes = Buffer.byteLength(JSON.stringify(value));
        if (bytes <= this.maxBytes && this.maxEntries > 0) {
          while (
            this.entries.size >= this.maxEntries ||
            this.bytes + bytes > this.maxBytes
          ) {
            const oldest = this.entries.keys().next().value;
            this.bytes -= this.entries.get(oldest).bytes;
            this.entries.delete(oldest);
          }
          this.entries.set(key, {
            value: structuredClone(value),
            bytes,
            expires: this.now() + this.ttlMs,
          });
          this.bytes += bytes;
        }
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return structuredClone(await promise);
  }
}
