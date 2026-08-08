/* ============================================================
   Utility: authStorage.js
   Description: Unified, safe authentication storage helper.
                Reads from sessionStorage first, then localStorage.
                Writes to both sessionStorage & localStorage.
   ============================================================ */

export function getAuthData() {
  try {
    const sessionRaw = sessionStorage.getItem('kfpl_auth');
    if (sessionRaw && sessionRaw !== 'null' && sessionRaw !== 'undefined') {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && typeof parsed === 'object' && (parsed.token || parsed.admin)) {
        return parsed;
      }
    }
    const localRaw = localStorage.getItem('kfpl_auth');
    if (localRaw && localRaw !== 'null' && localRaw !== 'undefined') {
      const parsed = JSON.parse(localRaw);
      if (parsed && typeof parsed === 'object' && (parsed.token || parsed.admin)) {
        try {
          sessionStorage.setItem('kfpl_auth', localRaw);
        } catch (_) {}
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read auth data:', e);
  }
  return null;
}

export function getAuthToken() {
  const auth = getAuthData();
  return auth?.token || '';
}

export function getAuthUser() {
  const auth = getAuthData();
  if (!auth) return null;
  const root = auth.admin || auth;
  return root?.admin || root?.data || root?.user || root || null;
}

export function setAuthData(data) {
  try {
    if (!data) return;
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    try {
      sessionStorage.setItem('kfpl_auth', raw);
    } catch (_) {}
    try {
      localStorage.setItem('kfpl_auth', raw);
    } catch (e) {
      console.warn('LocalStorage full on setAuthData, clearing non-essential caches...', e);
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes('_cache') || k.includes('_detail_') || k.includes('_list'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('kfpl_auth', raw);
      } catch (e2) {}
    }
  } catch (e) {
    console.error('Failed to save auth data:', e);
  }
}

export function clearAuthData() {
  try {
    sessionStorage.removeItem('kfpl_auth');
    sessionStorage.removeItem('kfpl_tfa');
    localStorage.removeItem('kfpl_auth');
    localStorage.removeItem('kfpl_tfa');
  } catch (e) {
    console.error('Failed to clear auth data:', e);
  }
}

