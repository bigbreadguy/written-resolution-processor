/**
 * Rate Limiter Service
 *
 * Implements token bucket algorithm for client-side rate limiting
 * with localStorage persistence and Pacific Time daily reset.
 *
 * Key Design Decisions:
 * - Token bucket allows burst traffic while maintaining average limits
 * - Persists state to localStorage to survive page refreshes
 * - Daily limits reset at midnight Pacific Time (per Gemini API docs)
 * - Key selection prefers keys with most available tokens
 */

import { STORAGE_KEYS, TIER_LIMITS } from "@/constants";
import type {
  ApiKeyEntry,
  ApiTier,
  TokenBucketState,
  DailyUsage,
} from "@/types";

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get the next midnight in Pacific Time as Unix timestamp
 */
function getNextMidnightPT(): number {
  const now = new Date();
  // Get current time in PT
  const ptString = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const ptDate = new Date(ptString);

  // Set to next midnight
  const nextMidnight = new Date(ptDate);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  // Convert back to UTC timestamp
  // Calculate offset between local interpretation and actual PT
  const ptOffset = ptDate.getTime() - now.getTime();
  return nextMidnight.getTime() - ptOffset;
}

/**
 * Calculate tokens per millisecond for a given RPM
 */
function getRefillRate(rpm: number): number {
  return rpm / 60_000; // tokens per millisecond
}

// ============================================================
// Storage Functions
// ============================================================

function loadBucketState(keyId: string, tier: ApiTier): TokenBucketState {
  const limits = TIER_LIMITS[tier];
  const defaultState: TokenBucketState = {
    tokens: limits.rpm,
    maxTokens: limits.rpm,
    lastRefill: Date.now(),
  };

  try {
    const saved = localStorage.getItem(`${STORAGE_KEYS.BUCKET_PREFIX}${keyId}`);
    if (!saved) return defaultState;

    const parsed = JSON.parse(saved) as Partial<TokenBucketState>;

    // Validate and restore
    if (
      typeof parsed.tokens === "number" &&
      typeof parsed.lastRefill === "number"
    ) {
      return {
        tokens: Math.min(parsed.tokens, limits.rpm),
        maxTokens: limits.rpm,
        lastRefill: parsed.lastRefill,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return defaultState;
}

function saveBucketState(keyId: string, state: TokenBucketState): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.BUCKET_PREFIX}${keyId}`,
      JSON.stringify({
        tokens: state.tokens,
        lastRefill: state.lastRefill,
      })
    );
  } catch {
    // Ignore storage errors
  }
}

function loadDailyUsage(keyId: string): DailyUsage {
  const defaultUsage: DailyUsage = {
    count: 0,
    resetAt: getNextMidnightPT(),
  };

  try {
    const saved = localStorage.getItem(`${STORAGE_KEYS.DAILY_PREFIX}${keyId}`);
    if (!saved) return defaultUsage;

    const parsed = JSON.parse(saved) as DailyUsage;

    // Check if reset time has passed
    if (Date.now() >= parsed.resetAt) {
      return defaultUsage; // Reset
    }

    return parsed;
  } catch {
    return defaultUsage;
  }
}

function saveDailyUsage(keyId: string, usage: DailyUsage): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.DAILY_PREFIX}${keyId}`,
      JSON.stringify(usage)
    );
  } catch {
    // Ignore storage errors
  }
}

// ============================================================
// Rate Limiter Class
// ============================================================

export interface KeyStatus {
  keyId: string;
  label?: string | undefined;
  tier: import("@/types").ApiTier;
  availableTokens: number;
  maxTokens: number;
  dailyUsed: number;
  dailyLimit: number | null;
  isAvailable: boolean;
  isExhausted: boolean;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucketState> = new Map();
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private keys: ApiKeyEntry[];

  constructor(keys: ApiKeyEntry[]) {
    this.keys = keys;
    this.initializeFromStorage();
  }

  /**
   * Initialize buckets and daily usage from localStorage
   */
  private initializeFromStorage(): void {
    for (const key of this.keys) {
      const bucket = loadBucketState(key.id, key.tier);
      this.refillBucket(bucket, key.tier);
      this.buckets.set(key.id, bucket);

      const daily = loadDailyUsage(key.id);
      this.dailyUsage.set(key.id, daily);
    }
  }

  /**
   * Update the keys list (when keys are added/removed)
   */
  public updateKeys(keys: ApiKeyEntry[]): void {
    this.keys = keys;

    // Initialize any new keys
    for (const key of keys) {
      if (!this.buckets.has(key.id)) {
        const bucket = loadBucketState(key.id, key.tier);
        this.refillBucket(bucket, key.tier);
        this.buckets.set(key.id, bucket);
      }
      if (!this.dailyUsage.has(key.id)) {
        this.dailyUsage.set(key.id, loadDailyUsage(key.id));
      }
    }

    // Clean up removed keys
    const keyIds = new Set(keys.map((k) => k.id));
    for (const id of this.buckets.keys()) {
      if (!keyIds.has(id)) {
        this.buckets.delete(id);
        this.dailyUsage.delete(id);
      }
    }
  }

  /**
   * Refill bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucketState, tier: ApiTier): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillRate = getRefillRate(TIER_LIMITS[tier].rpm);
    const refill = elapsed * refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  /**
   * Check if a key has available daily quota
   */
  private checkDailyLimit(keyId: string, tier: ApiTier): boolean {
    const limits = TIER_LIMITS[tier];
    if (limits.rpd === null) return true; // Unlimited

    let usage = this.dailyUsage.get(keyId);
    if (!usage) {
      usage = loadDailyUsage(keyId);
      this.dailyUsage.set(keyId, usage);
    }

    // Check if reset time has passed
    if (Date.now() >= usage.resetAt) {
      usage.count = 0;
      usage.resetAt = getNextMidnightPT();
      saveDailyUsage(keyId, usage);
    }

    return usage.count < limits.rpd;
  }

  /**
   * Get the best available key (most tokens available)
   * Returns null if no key has available quota
   */
  public getBestKey(): ApiKeyEntry | null {
    let bestKey: ApiKeyEntry | null = null;
    let maxTokens = 0;

    for (const key of this.keys) {
      const bucket = this.buckets.get(key.id);
      if (!bucket) continue;

      // Refill before checking
      this.refillBucket(bucket, key.tier);

      // Check daily limit
      if (!this.checkDailyLimit(key.id, key.tier)) continue;

      // Check if has tokens
      if (bucket.tokens >= 1 && bucket.tokens > maxTokens) {
        maxTokens = bucket.tokens;
        bestKey = key;
      }
    }

    return bestKey;
  }

  /**
   * Consume one request from a key's bucket
   * Returns false if unable to consume
   */
  public consumeRequest(keyId: string): boolean {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return false;

    const bucket = this.buckets.get(keyId);
    if (!bucket) return false;

    // Refill first
    this.refillBucket(bucket, key.tier);

    // Check if has tokens
    if (bucket.tokens < 1) return false;

    // Consume token
    bucket.tokens -= 1;
    saveBucketState(keyId, bucket);

    // Increment daily usage
    let usage = this.dailyUsage.get(keyId);
    if (!usage) {
      usage = { count: 0, resetAt: getNextMidnightPT() };
    }
    usage.count += 1;
    this.dailyUsage.set(keyId, usage);
    saveDailyUsage(keyId, usage);

    return true;
  }

  /**
   * Mark a key as exhausted (received 429)
   * Sets tokens to 0 to force waiting for refill
   */
  public markExhausted(keyId: string): void {
    const bucket = this.buckets.get(keyId);
    if (bucket) {
      bucket.tokens = 0;
      bucket.lastRefill = Date.now();
      saveBucketState(keyId, bucket);
    }
  }

  /**
   * Get estimated wait time until any key has tokens (in ms)
   * Returns 0 if a key is immediately available
   */
  public getWaitTime(): number {
    let minWait = Infinity;

    for (const key of this.keys) {
      const bucket = this.buckets.get(key.id);
      if (!bucket) continue;

      // Check daily limit first
      if (!this.checkDailyLimit(key.id, key.tier)) continue;

      // Refill
      this.refillBucket(bucket, key.tier);

      if (bucket.tokens >= 1) return 0; // Immediately available

      const tokensNeeded = 1 - bucket.tokens;
      const refillRate = getRefillRate(TIER_LIMITS[key.tier].rpm);
      const waitMs = tokensNeeded / refillRate;
      minWait = Math.min(minWait, waitMs);
    }

    return minWait === Infinity ? 60_000 : Math.ceil(minWait);
  }

  /**
   * Get status of all keys (for UI display)
   */
  public getKeyStatuses(): KeyStatus[] {
    return this.keys.map((key) => {
      const bucket = this.buckets.get(key.id);
      const usage = this.dailyUsage.get(key.id);
      const limits = TIER_LIMITS[key.tier];

      if (bucket) {
        this.refillBucket(bucket, key.tier);
      }

      const availableTokens = bucket ? Math.floor(bucket.tokens) : 0;
      const dailyUsed = usage?.count ?? 0;
      const dailyLimit = limits.rpd;
      const hasDailyQuota = dailyLimit === null || dailyUsed < dailyLimit;
      const isExhausted = !hasDailyQuota || (bucket !== undefined && bucket.tokens < 1);

      return {
        keyId: key.id,
        label: key.label,
        tier: key.tier,
        availableTokens,
        maxTokens: limits.rpm,
        dailyUsed,
        dailyLimit,
        isAvailable: availableTokens >= 1 && hasDailyQuota,
        isExhausted,
      };
    });
  }

  /**
   * Check if any key is available
   */
  public hasAvailableKey(): boolean {
    return this.getBestKey() !== null;
  }

  /**
   * Clear all stored rate limit data for a key
   */
  public clearKeyData(keyId: string): void {
    this.buckets.delete(keyId);
    this.dailyUsage.delete(keyId);

    try {
      localStorage.removeItem(`${STORAGE_KEYS.BUCKET_PREFIX}${keyId}`);
      localStorage.removeItem(`${STORAGE_KEYS.DAILY_PREFIX}${keyId}`);
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================
// Singleton Instance Management
// ============================================================

let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(keys: ApiKeyEntry[]): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(keys);
  } else {
    rateLimiterInstance.updateKeys(keys);
  }
  return rateLimiterInstance;
}

export function resetRateLimiter(): void {
  rateLimiterInstance = null;
}
