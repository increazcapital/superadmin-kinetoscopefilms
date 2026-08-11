/* ============================================================
   Utility: swrHelper.js (Super Admin)
   Description: User-scoped SWR (Stale-While-Revalidate) cache
                for instant page navigation & real-time updates.
   ============================================================ */

const SWR_PREFIX = 'swr_';
const DEFAULT_TTL_MINUTES = 10;

/**
 * Extract userId from stored auth data for user-scoped cache keys.
 * This ensures Client A's cache is NEVER visible to Client B.
 */
export function getSWRUserId() {
  try {
    const raw = sessionStorage.getItem('kfpl_auth') || localStorage.getItem('kfpl_auth');
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw);
    const user = parsed?.admin || parsed?.data || parsed?.user || parsed;
    return user?._id || user?.id || 'anon';
  } catch { return 'anon'; }
}

/**
 * Build a user-scoped cache key: swr_{userId}_{cacheKey}
 */
function buildKey(userId, cacheKey) {
  return `${SWR_PREFIX}${userId}_${cacheKey}`;
}

/**
 * GET cached data. Returns null if expired or missing.
 */
export function getSWRCache(cacheKey) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data) return null;
    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

/**
 * SET data into cache with TTL (in minutes).
 */
export function setSWRCache(cacheKey, data, ttlMinutes = DEFAULT_TTL_MINUTES) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const entry = {
      data,
      savedAt: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // localStorage full — silently clear old SWR entries
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SWR_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

/**
 * MUTATE cache in-place (for instant UI updates on edit/delete/add).
 * @param {string} cacheKey
 * @param {function} mutatorFn - Receives current data, returns new data
 */
export function mutateSWRCache(cacheKey, mutatorFn) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data) return;
    entry.data = mutatorFn(entry.data);
    entry.savedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

/**
 * INVALIDATE (delete) a specific cache entry.
 */
export function invalidateSWRCache(cacheKey) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    localStorage.removeItem(key);
  } catch {}
}

/**
 * CLEAR ALL SWR cache entries (called on logout).
 * Nuclear wipe — removes every swr_* key from localStorage.
 */
export function clearAllSWRCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SWR_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

/**
 * Custom hook pattern: useSWRData
 * Returns cached data instantly, then revalidates in background.
 * Usage:
 *   const { data, loading, refresh } = useSWRData('dashboard', fetchFn);
 */
export function createSWRFetcher(cacheKey, fetchFn, setData, setLoading, ttlMinutes = DEFAULT_TTL_MINUTES) {
  // 1. Try to render from cache instantly (0ms)
  const cached = getSWRCache(cacheKey);
  if (cached) {
    setData(cached);
    if (setLoading) setLoading(false);
  }

  // 2. Revalidate in background
  const revalidate = async (silent = !!cached) => {
    if (!silent && setLoading) setLoading(true);
    try {
      const freshData = await fetchFn();
      setData(freshData);
      setSWRCache(cacheKey, freshData, ttlMinutes);
    } catch (err) {
      // If we had cached data, silently fail. Otherwise propagate.
      if (!cached) throw err;
      console.warn(`[SWR] Background revalidation failed for "${cacheKey}":`, err.message);
    } finally {
      if (setLoading) setLoading(false);
    }
  };

  return { cached: !!cached, revalidate };
}
