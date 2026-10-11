export function clearStoredSession() {
  const deviceId = localStorage.getItem('device_id')
  localStorage.clear()
  if (deviceId) localStorage.setItem('device_id', deviceId)
  sessionStorage.clear()
}
