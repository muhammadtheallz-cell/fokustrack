export type BrowserNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported'

export function getNotificationPermissionStatus(): BrowserNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return Notification.permission
  }
}

export async function sendSystemNotification(title: string, body: string, tag?: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body,
    icon: '/icons/fokustrack-192.png',
    badge: '/icons/fokustrack-192.png',
    tag: tag || `fokustrack-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 120, 300, 120, 450],
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, options)
        return
      }
    }
  } catch {
    // Fall back to standard Notification API
  }

  try {
    const notif = new Notification(title, options)
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
  } catch {
    // Ignore notification errors on restricted webviews
  }
}
