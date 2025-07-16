// cache.js

const CACHE_KEY = 'gw2_event_data_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

export function saveEventCache(events) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      events
    }));
    return true;
  } catch (e) {
    console.warn('[Cache] Save failed.', e);
    return false;
  }
}

export function loadEventCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!data || !Array.isArray(data.events)) return null;
    const isExpired = Date.now() - data.timestamp > MAX_AGE_MS;
    return isExpired ? null : data.events;
  } catch {
    return null;
  }
}

export function getCacheInfo() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!data) return null;
    return {
      timestamp: data.timestamp,
      size: data.events ? data.events.length : 0,
      expired: Date.now() - data.timestamp > MAX_AGE_MS
    };
  } catch {
    return null;
  }
}

export function clearEventCache() {
  localStorage.removeItem(CACHE_KEY);
}
