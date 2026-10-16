// Cache em memória com TTL. Só guarda sucesso (falhas não ficam em cache).
const store = new Map<string, { exp: number; val: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.val as T;
  const val = await fn();
  store.set(key, { exp: Date.now() + ttlMs, val });
  if (store.size > 500) store.delete(store.keys().next().value as string);
  return val;
}
