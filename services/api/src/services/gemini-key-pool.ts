/**
 * Dynamic Multi-Key Gemini Failover Pool
 * Supports:
 * - GEMINI_API_KEYS (comma-separated: key1,key2,key3)
 * - GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3
 * - GOOGLE_API_KEY, GEMINI_KEY
 * Automatically rotates and fails over if any key hits HTTP 429 (Rate Limit).
 */

export interface KeyHealth {
  key: string;
  masked: string;
  failures: number;
  status: 'HEALTHY' | 'RATE_LIMITED_429' | 'INVALID';
  cooldownUntil: number;
  lastUsed: number;
  totalCalls: number;
}

class GeminiKeyPool {
  private keys: KeyHealth[] = [];
  private currentIndex = 0;

  constructor() {
    this.refreshKeys();
  }

  public refreshKeys(): void {
    const rawList: string[] = [];

    if (process.env.GEMINI_API_KEYS) {
      process.env.GEMINI_API_KEYS.split(/[,;\n]/).forEach((k) => rawList.push(k.trim()));
    }

    for (let i = 1; i <= 10; i++) {
      const k = process.env[`GEMINI_API_KEY_${i}`];
      if (k) rawList.push(k.trim());
    }

    if (process.env.GEMINI_API_KEY) rawList.push(process.env.GEMINI_API_KEY.trim());
    if (process.env.GOOGLE_API_KEY) rawList.push(process.env.GOOGLE_API_KEY.trim());
    if (process.env.GEMINI_KEY) rawList.push(process.env.GEMINI_KEY.trim());

    const unique = Array.from(new Set(rawList.filter((k) => k && k.length > 5)));
    const existingMap = new Map<string, KeyHealth>(this.keys.map((k) => [k.key, k]));

    this.keys = unique.map((key) => {
      if (existingMap.has(key)) {
        return existingMap.get(key)!;
      }
      return {
        key,
        masked: key.substring(0, 8) + '...' + key.substring(key.length - 4),
        failures: 0,
        status: 'HEALTHY',
        cooldownUntil: 0,
        lastUsed: 0,
        totalCalls: 0,
      };
    });
  }

  public getAvailableKeys(): KeyHealth[] {
    this.refreshKeys();
    const now = Date.now();
    return this.keys.map((k) => {
      if (k.status === 'RATE_LIMITED_429' && now > k.cooldownUntil) {
        k.status = 'HEALTHY';
        k.failures = 0;
      }
      return k;
    });
  }

  public async executeWithFailover<T>(
    fn: (key: string, maskedKey: string) => Promise<{ success: boolean; data?: T; status?: number; error?: any }>
  ): Promise<{ data: T; keyUsed: string } | null> {
    const available = this.getAvailableKeys();
    if (available.length === 0) {
      console.warn('[Gemini Pool] No Gemini API keys configured in environment.');
      return null;
    }

    const total = available.length;
    for (let attempt = 0; attempt < total; attempt++) {
      const idx = (this.currentIndex + attempt) % total;
      const keyRecord = available[idx];

      if (keyRecord.status === 'RATE_LIMITED_429' && Date.now() < keyRecord.cooldownUntil) {
        console.log(`[Gemini Pool] Skipping ${keyRecord.masked} (Cooling down after 429 until ${new Date(keyRecord.cooldownUntil).toLocaleTimeString()})`);
        continue;
      }

      keyRecord.lastUsed = Date.now();
      keyRecord.totalCalls++;

      try {
        const result = await fn(keyRecord.key, keyRecord.masked);
        if (result.success && result.data !== undefined) {
          keyRecord.status = 'HEALTHY';
          this.currentIndex = (idx + 1) % total;
          return { data: result.data, keyUsed: keyRecord.masked };
        }

        if (result.status === 429) {
          console.warn(`[Gemini Pool] Key ${keyRecord.masked} hit 429 Quota Exceeded! Cooling down for 60s and failing over...`);
          keyRecord.status = 'RATE_LIMITED_429';
          keyRecord.cooldownUntil = Date.now() + 60000;
          keyRecord.failures++;
          continue;
        }
      } catch (err: any) {
        if (err?.status === 429 || err?.message?.includes('429')) {
          keyRecord.status = 'RATE_LIMITED_429';
          keyRecord.cooldownUntil = Date.now() + 60000;
          continue;
        }
      }
    }

    console.warn('[Gemini Pool] All keys in pool are exhausted or rate-limited. Falling back to deterministic engine.');
    return null;
  }

  public getPoolStatus() {
    this.refreshKeys();
    return {
      total_keys: this.keys.length,
      keys: this.keys.map((k) => ({
        masked: k.masked,
        status: k.status,
        cooldown_remaining_sec: Math.max(0, Math.round((k.cooldownUntil - Date.now()) / 1000)),
        total_calls: k.totalCalls,
      })),
    };
  }
}

export const geminiKeyPool = new GeminiKeyPool();
