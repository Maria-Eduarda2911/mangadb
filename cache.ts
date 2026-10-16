import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const store = new Map<string, { exp: number; val: unknown }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit !== null && hit !== undefined) return hit;
    } catch {
      // fallback para memória local quando o Redis falha
    }
  }

  const memoryHit = store.get(key);
  if (memoryHit && memoryHit.exp > Date.now()) return memoryHit.val as T;

  const val = await fn();

  if (redis) {
    try {
      await redis.set(key, val, { ex: Math.max(1, Math.ceil(ttlMs / 1000)) });
    } catch {
      // ignora falha do Redis e mantém fallback local
    }
  }

  store.set(key, { exp: Date.now() + ttlMs, val });
  if (store.size > 500) store.delete(store.keys().next().value as string);

  return val;
}
