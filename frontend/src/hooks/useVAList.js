import { useState, useEffect, useCallback } from "react";
import { fetchVAs } from "../api/va";
import { cacheGet, cacheSet, getCachedAt, TTL } from "../utils/cache";

const CACHE_KEY = "va_list";

export function useVAList() {
  const [data,      setData]      = useState(() => cacheGet(CACHE_KEY));
  const [loading,   setLoading]   = useState(!cacheGet(CACHE_KEY));
  const [error,     setError]     = useState(null);
  const [cachedAt,  setCachedAt]  = useState(() => getCachedAt(CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = cacheGet(CACHE_KEY);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }
    setRefreshing(true);
    try {
      const res = await fetchVAs();
      const vas = res.vas;
      cacheSet(CACHE_KEY, vas, TTL.H1);
      setData(vas);
      setCachedAt(getCachedAt(CACHE_KEY));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Stale-while-revalidate on mount
  useEffect(() => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      setData(cached);
      setLoading(false);
      // Revalidate in background
      load(true);
    } else {
      load(false);
    }
  }, [load]);

  return { data: data || [], loading, error, cachedAt, refreshing, refresh: () => load(true) };
}