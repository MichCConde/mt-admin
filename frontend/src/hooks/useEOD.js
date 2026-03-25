import { useState, useEffect, useCallback } from "react";
import { fetchEOD, fetchAttendance } from "../api/va";
import { cacheGet, cacheSet, getCachedAt, TTL } from "../utils/cache";
import { todayISO } from "../utils/dates";

export function useEOD(date = null) {
  const target   = date || todayISO();
  const isToday  = target === todayISO();
  const ttl      = isToday ? TTL.MIN15 : TTL.FOREVER;

  const eodKey  = `eod:${target}`;
  const attKey  = `attendance:${target}`;

  const [eod,        setEOD]        = useState(() => cacheGet(eodKey));
  const [attendance, setAttendance] = useState(() => cacheGet(attKey));
  const [loading,    setLoading]    = useState(!cacheGet(eodKey));
  const [error,      setError]      = useState(null);
  const [cachedAt,   setCachedAt]   = useState(() => getCachedAt(eodKey));

  const load = useCallback(async (force = false) => {
    if (!force && cacheGet(eodKey)) return;
    setLoading(true);
    try {
      const [eodRes, attRes] = await Promise.all([
        fetchEOD(target, force),
        fetchAttendance(target, force),
      ]);
      cacheSet(eodKey, eodRes.data, ttl);
      cacheSet(attKey, attRes.data, ttl);
      setEOD(eodRes.data);
      setAttendance(attRes.data);
      setCachedAt(getCachedAt(eodKey));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    const cached = cacheGet(eodKey);
    if (cached) {
      setEOD(cached);
      setAttendance(cacheGet(attKey));
      setLoading(false);
      if (isToday) load(true); // always revalidate today's data
    } else {
      load(false);
    }
  }, [target, load]);

  return {
    eod, attendance, loading, error, cachedAt,
    refresh: () => load(true),
  };
}