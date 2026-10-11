export function clearStoredSession() {
  try {
    const deviceId = localStorage.getItem('device_id')
    localStorage.clear()
    if (deviceId) localStorage.setItem('device_id', deviceId)
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  } finally {
    try { sessionStorage.clear() } catch { /* Ignore unavailable session storage. */ }
  }
}
