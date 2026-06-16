/**
 * Caché de cliente para métricas de sensores (Capítulo VIII, objetivo de rendimiento).
 *
 * Objetivo: que el renderizado de gráficos históricos sea instantáneo (< 1.5 s)
 * evitando reconsultar Supabase cuando los datos recientes siguen vigentes.
 *
 * Estrategia: caché en memoria con respaldo en sessionStorage (sobrevive a
 * recargas de página dentro de la misma sesión) y expiración por TTL.
 */

const DEFAULT_TTL_MS = 60_000; // 1 minuto
const STORAGE_PREFIX = 'pc_metrics_cache_';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

function readFromStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeToStorage<T>(key: string, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* almacenamiento lleno o no disponible: la caché en memoria sigue activa */
  }
}

/** Devuelve el valor cacheado si está vigente, o null. */
export function getCached<T>(key: string): T | null {
  const now = Date.now();
  const inMemory = memory.get(key) as CacheEntry<T> | undefined;
  if (inMemory && inMemory.expiresAt > now) return inMemory.value;

  const persisted = readFromStorage<T>(key);
  if (persisted && persisted.expiresAt > now) {
    memory.set(key, persisted);
    return persisted.value;
  }
  return null;
}

/** Guarda un valor en la caché con el TTL indicado. */
export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
  memory.set(key, entry);
  writeToStorage(key, entry);
}

/** Invalida una entrada concreta (p. ej. tras importar nuevas métricas). */
export function invalidateCached(key: string): void {
  memory.delete(key);
  try { sessionStorage.removeItem(STORAGE_PREFIX + key); } catch { /* noop */ }
}

/**
 * Envuelve una función asíncrona con caché transparente.
 * Si hay valor vigente lo devuelve sin invocar `loader`.
 */
export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const value = await loader();
  setCached(key, value, ttlMs);
  return value;
}
