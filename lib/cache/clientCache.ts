/**
 * High-Performance Client-Side Stale-While-Revalidate Memory Cache
 * Prevents redundant Supabase queries and eliminates blank loading screens
 * when switching between pages.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryStore = new Map<string, CacheEntry<any>>()

export function getMemoryCache<T>(key: string, maxAgeMs = 120_000): T | null {
  // 1. Check in-memory store
  const mem = memoryStore.get(key)
  if (mem) {
    if (Date.now() - mem.timestamp < maxAgeMs) {
      return mem.data as T
    }
  }

  // 2. Check sessionStorage fallback for instant restore
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(`fs_cache_${key}`)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          // Re-populate memory cache
          memoryStore.set(key, parsed)
          return parsed.data
        }
      }
    } catch (_) {}
  }

  return null
}

export function setMemoryCache<T>(key: string, data: T, persistToSession = true): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  }

  memoryStore.set(key, entry)

  if (persistToSession && typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`fs_cache_${key}`, JSON.stringify(entry))
    } catch (_) {}
  }
}

export function invalidateMemoryCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryStore.clear()
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('fs_cache_')) sessionStorage.removeItem(k)
        })
      } catch (_) {}
    }
    return
  }

  for (const key of memoryStore.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memoryStore.delete(key)
    }
  }

  if (typeof window !== 'undefined') {
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(`fs_cache_${keyOrPrefix}`) || k === `fs_cache_${keyOrPrefix}`) {
          sessionStorage.removeItem(k)
        }
      })
    } catch (_) {}
  }
}

/**
 * Execute a fetcher with Stale-While-Revalidate caching.
 * If fresh cached data exists, returns cached data immediately without calling the fetcher.
 */
export async function withClientCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 90_000 // 90 seconds fresh TTL
): Promise<T> {
  const cached = getMemoryCache<T>(key, ttlMs)
  if (cached !== null && cached !== undefined) {
    return cached
  }

  const fresh = await fetcher()
  if (fresh !== null && fresh !== undefined) {
    setMemoryCache(key, fresh)
  }
  return fresh
}
