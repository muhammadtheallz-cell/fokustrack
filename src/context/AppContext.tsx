import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  ActiveAlarm,
  ActivityItem,
  AppSettings,
  AppTab,
  FocusPreset,
  FocusSession,
  ReminderMode,
  ReminderOffsetMinutes,
  ThemeMode,
  TransactionItem,
} from '../types'
import { parseActivityDateTime, subtractMinutes, toDateKey } from '../utils/date'
import { playAlarmBurst, playFocusChime, unlockAudioContext } from '../utils/sound'
import {
  getNotificationPermissionStatus,
  requestBrowserNotificationPermission,
  sendSystemNotification,
  type BrowserNotificationStatus,
} from '../utils/notifications'

const STORAGE_KEY = 'fokustrack-state-v3'
const TRIGGERED_KEY = 'fokustrack-triggered-v3'
const THEME_KEY = 'fokustrack-theme'
const INSTALL_DISMISSED_KEY = 'fokustrack-install-dismissed-v3'

export const FOCUS_PRESETS: FocusPreset[] = [
  { id: 'pomodoro', label: 'Fokus 25m', minutes: 25 },
  { id: 'deep', label: 'Deep 50m', minutes: 50 },
  { id: 'short-break', label: 'Rehat 5m', minutes: 5, isBreak: true },
  { id: 'long-break', label: 'Rehat 15m', minutes: 15, isBreak: true },
]

interface PersistedData {
  activities: ActivityItem[]
  transactions: TransactionItem[]
  focusSessions: FocusSession[]
  settings: AppSettings
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const defaultSettings: AppSettings = {
  dailyBudgetLimit: 150000,
  dailyFocusGoalMinutes: 60,
  hideBalance: false,
  soundEnabled: true,
  defaultReminderMinutes: 10,
  defaultReminderMode: 'alarm',
  alarmSoundType: 'classic',
}

function getEmptyData(): PersistedData {
  return {
    activities: [],
    transactions: [],
    focusSessions: [],
    settings: { ...defaultSettings },
  }
}

function normalizeActivity(raw: Partial<ActivityItem>, idx: number): ActivityItem {
  const validOffsets: ReminderOffsetMinutes[] = [0, 5, 10, 15, 30, 60]
  const offset = validOffsets.includes(raw.reminderMinutesBefore as ReminderOffsetMinutes)
    ? (raw.reminderMinutesBefore as ReminderOffsetMinutes)
    : 10
  const validModes: ReminderMode[] = ['alarm', 'chime', 'silent']
  const mode = validModes.includes(raw.reminderMode as ReminderMode)
    ? (raw.reminderMode as ReminderMode)
    : 'alarm'

  return {
    id: raw.id || `act-${Date.now()}-${idx}`,
    title: raw.title || 'Kegiatan',
    date: raw.date || toDateKey(),
    startTime: raw.startTime || '09:00',
    endTime: raw.endTime || '10:00',
    category: raw.category || 'Kerja',
    priority: raw.priority || 'Sedang',
    completed: Boolean(raw.completed),
    notes: raw.notes,
    reminderEnabled: raw.reminderEnabled !== undefined ? Boolean(raw.reminderEnabled) : true,
    reminderMinutesBefore: offset,
    reminderMode: mode,
    snoozedUntil: raw.snoozedUntil,
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

function loadInitialData(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getEmptyData()
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    return {
      activities: Array.isArray(parsed.activities)
        ? parsed.activities.map((a, idx) => normalizeActivity(a, idx))
        : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      focusSessions: Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [],
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    }
  } catch {
    return getEmptyData()
  }
}

function loadTriggeredSet(): Set<string> {
  try {
    const raw = localStorage.getItem(TRIGGERED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr.slice(-200)) : new Set()
  } catch {
    return new Set()
  }
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

interface AppContextValue {
  theme: ThemeMode
  toggleTheme: () => void
  todayKey: string
  activities: ActivityItem[]
  addActivity: (item: Omit<ActivityItem, 'id' | 'createdAt'>) => void
  updateActivity: (id: string, patch: Partial<ActivityItem>) => void
  toggleActivity: (id: string) => void
  deleteActivity: (id: string) => void
  transactions: TransactionItem[]
  addTransaction: (item: Omit<TransactionItem, 'id' | 'createdAt'>) => void
  deleteTransaction: (id: string) => void
  focusSessions: FocusSession[]
  addFocusSession: (label: string, minutes: number) => void
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  streakCount: number
  hasStartedConsistency: boolean
  todayFocusMinutes: number
  todayGoalProgress: number
  totalBalance: number
  monthIncome: number
  monthExpense: number
  todayExpense: number
  remainingDailyBudget: number
  // Focus Timer (global across tabs)
  selectedPreset: FocusPreset
  secondsLeft: number
  isRunning: boolean
  sessionLabel: string
  setSessionLabel: (label: string) => void
  justFinished: boolean
  selectPreset: (preset: FocusPreset) => void
  startPauseTimer: () => void
  resetTimer: () => void
  completeTimerNow: () => void
  startFocusForActivity: (title: string, onNavigate?: (tab: AppTab) => void) => void
  // Reminders & Alarms
  notificationPermission: BrowserNotificationStatus
  requestNotifications: () => Promise<BrowserNotificationStatus>
  activeAlarm: ActiveAlarm | null
  snoozeActiveAlarm: (minutes?: number) => void
  dismissActiveAlarm: (markCompleted?: boolean) => void
  triggerTestAlarm: () => void
  upcomingRemindersCount: number
  // PWA Home Screen Install
  canInstallPwa: boolean
  isStandalonePwa: boolean
  installBannerDismissed: boolean
  dismissInstallBanner: () => void
  promptInstallPwa: () => Promise<boolean>
  // Backup & Reset
  exportBackupJson: () => string
  importBackupJson: (jsonString: string) => boolean
  resetStreakOnly: () => void
  resetAllData: () => void
  loadSampleData: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [data, setData] = useState<PersistedData>(loadInitialData)
  const [todayKey, setTodayKey] = useState<string>(() => toDateKey())

  // Focus Timer State
  const [selectedPreset, setSelectedPreset] = useState<FocusPreset>(FOCUS_PRESETS[0])
  const [secondsLeft, setSecondsLeft] = useState<number>(FOCUS_PRESETS[0].minutes * 60)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [sessionLabel, setSessionLabel] = useState<string>('Sesi Fokus Mendalam')
  const [justFinished, setJustFinished] = useState<boolean>(false)
  const completedRef = useRef<boolean>(false)
  const endTimeRef = useRef<number | null>(null)

  // Reminder & Alarm State
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationStatus>(
    () => getNotificationPermissionStatus()
  )
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null)
  const triggeredKeysRef = useRef<Set<string>>(loadTriggeredSet())

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    )
  })
  const [installBannerDismissed, setInstallBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Listen for beforeinstallprompt & appinstalled
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalonePwa(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  // Keep todayKey fresh across midnight
  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = toDateKey()
      setTodayKey((prev) => (prev !== current ? current : prev))
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  // Sync theme attribute, localStorage, and mobile theme-color meta tag
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Ignore storage quota errors
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0b0e14' : '#f4f2fb')
    }
  }, [theme])

  // Persist app data
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore storage quota errors
    }
  }, [data])

  const persistTriggeredKeys = useCallback(() => {
    try {
      localStorage.setItem(TRIGGERED_KEY, JSON.stringify(Array.from(triggeredKeysRef.current).slice(-200)))
    } catch {
      // Ignore storage quota errors
    }
  }, [])

  const addFocusSession = useCallback((label: string, minutes: number) => {
    const session: FocusSession = {
      id: `foc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim() || 'Sesi Fokus Mendalam',
      minutes,
      date: toDateKey(),
      completedAt: new Date().toISOString(),
    }
    setData((prev) => ({
      ...prev,
      focusSessions: [session, ...prev.focusSessions],
    }))
  }, [])

  // Global Focus Timer Ticker
  const timerSnapshotRef = useRef({
    selectedPreset,
    sessionLabel,
    soundEnabled: data.settings.soundEnabled,
    addFocusSession,
  })

  useEffect(() => {
    timerSnapshotRef.current = {
      selectedPreset,
      sessionLabel,
      soundEnabled: data.settings.soundEnabled,
      addFocusSession,
    }
  }, [selectedPreset, sessionLabel, data.settings.soundEnabled, addFocusSession])

  useEffect(() => {
    if (!isRunning) {
      endTimeRef.current = null
      return
    }
    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + secondsLeft * 1000
    }

    const tick = () => {
      if (!endTimeRef.current) return
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)

      if (remaining <= 0) {
        endTimeRef.current = null
        setIsRunning(false)
        if (!completedRef.current) {
          completedRef.current = true
          const snap = timerSnapshotRef.current
          playFocusChime(snap.soundEnabled)
          if (!snap.selectedPreset.isBreak) {
            snap.addFocusSession(snap.sessionLabel, snap.selectedPreset.minutes)
          }
          setJustFinished(true)
          void sendSystemNotification(
            snap.selectedPreset.isBreak ? 'Waktu Istirahat Selesai!' : 'Sesi Fokus Selesai!',
            snap.selectedPreset.isBreak
              ? 'Waktunya kembali fokus ke prioritas utamamu.'
              : `${snap.sessionLabel} (${snap.selectedPreset.minutes} menit) tercatat ke streak harianmu.`,
            'fokustrack-timer-done'
          )
        }
      }
    }

    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [isRunning, secondsLeft])

  // Real-Time Activity Reminder & Alarm Scheduler
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()
      const nowMs = now.getTime()

      for (const act of data.activities) {
        if (act.completed || !act.reminderEnabled) continue

        let triggerDate: Date
        let isSnoozed = false
        if (act.snoozedUntil) {
          triggerDate = new Date(act.snoozedUntil)
          isSnoozed = true
        } else {
          const startDt = parseActivityDateTime(act.date, act.startTime)
          triggerDate = subtractMinutes(startDt, act.reminderMinutesBefore)
        }

        const triggerMs = triggerDate.getTime()
        if (Number.isNaN(triggerMs)) continue

        const triggerKey = `${act.id}|${triggerDate.toISOString()}`
        const elapsedMs = nowMs - triggerMs

        // Trigger if time has arrived within a 2-minute catch-up window
        if (elapsedMs >= 0 && elapsedMs <= 120_000 && !triggeredKeysRef.current.has(triggerKey)) {
          triggeredKeysRef.current.add(triggerKey)
          persistTriggeredKeys()

          // Clear snoozedUntil once triggered
          if (act.snoozedUntil) {
            setData((prev) => ({
              ...prev,
              activities: prev.activities.map((item) =>
                item.id === act.id ? { ...item, snoozedUntil: undefined } : item
              ),
            }))
          }

          setActiveAlarm({
            triggerKey,
            activity: act,
            triggeredAt: now.toISOString(),
            isSnoozed,
          })

          if (act.reminderMode === 'alarm') {
            playAlarmBurst(data.settings.soundEnabled, data.settings.alarmSoundType)
          } else if (act.reminderMode === 'chime') {
            playFocusChime(data.settings.soundEnabled)
          }

          const offsetText = isSnoozed
            ? 'Pengingat tunda (Snooze)'
            : act.reminderMinutesBefore === 0
              ? 'Dimulai sekarang'
              : `${act.reminderMinutesBefore} menit lagi (${act.startTime})`

          void sendSystemNotification(
            `⏰ Pengingat: ${act.title}`,
            `${offsetText} · ${act.startTime}–${act.endTime} (${act.category})`,
            triggerKey
          )
          break
        }
      }
    }

    checkReminders()
    const interval = window.setInterval(checkReminders, 1000)
    return () => window.clearInterval(interval)
  }, [data.activities, data.settings.soundEnabled, data.settings.alarmSoundType, persistTriggeredKeys])

  // Repeat alarm sound while an 'alarm'-mode reminder is actively ringing
  useEffect(() => {
    if (!activeAlarm) return
    if (activeAlarm.activity.reminderMode !== 'alarm') return

    const ringInterval = window.setInterval(() => {
      playAlarmBurst(data.settings.soundEnabled, data.settings.alarmSoundType)
    }, 4000)

    return () => window.clearInterval(ringInterval)
  }, [activeAlarm, data.settings.soundEnabled, data.settings.alarmSoundType])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  function addActivity(item: Omit<ActivityItem, 'id' | 'createdAt'>) {
    unlockAudioContext()
    const newItem: ActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    }
    setData((prev) => ({
      ...prev,
      activities: [...prev.activities, newItem].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
  }

  function updateActivity(id: string, patch: Partial<ActivityItem>) {
    unlockAudioContext()
    setData((prev) => ({
      ...prev,
      activities: prev.activities
        .map((a) => (a.id === id ? { ...a, ...patch } : a))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
  }

  function toggleActivity(id: string) {
    unlockAudioContext()
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === id ? { ...a, completed: !a.completed, snoozedUntil: undefined } : a
      ),
    }))
  }

  function deleteActivity(id: string) {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
    }))
  }

  function addTransaction(item: Omit<TransactionItem, 'id' | 'createdAt'>) {
    const newTx: TransactionItem = {
      ...item,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    }
    setData((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }))
  }

  function deleteTransaction(id: string) {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }))
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }))
  }

  // Focus timer controls
  function selectPreset(preset: FocusPreset) {
    unlockAudioContext()
    setIsRunning(false)
    endTimeRef.current = null
    completedRef.current = false
    setJustFinished(false)
    setSelectedPreset(preset)
    setSecondsLeft(preset.minutes * 60)
  }

  function startPauseTimer() {
    unlockAudioContext()
    if (isRunning) {
      setIsRunning(false)
      endTimeRef.current = null
      return
    }
    const startingSeconds = secondsLeft === 0 ? selectedPreset.minutes * 60 : secondsLeft
    if (secondsLeft === 0) {
      completedRef.current = false
      setJustFinished(false)
      setSecondsLeft(startingSeconds)
    }
    endTimeRef.current = Date.now() + startingSeconds * 1000
    setIsRunning(true)
  }

  function resetTimer() {
    setIsRunning(false)
    endTimeRef.current = null
    completedRef.current = false
    setJustFinished(false)
    setSecondsLeft(selectedPreset.minutes * 60)
  }

  function completeTimerNow() {
    if (selectedPreset.isBreak) return
    unlockAudioContext()
    const totalSeconds = selectedPreset.minutes * 60
    const elapsedMinutes = Math.max(
      1,
      Math.round((totalSeconds - secondsLeft) / 60) || selectedPreset.minutes
    )
    addFocusSession(sessionLabel, elapsedMinutes)
    playFocusChime(data.settings.soundEnabled)
    setIsRunning(false)
    endTimeRef.current = null
    setSecondsLeft(selectedPreset.minutes * 60)
    setJustFinished(true)
  }

  function startFocusForActivity(title: string, onNavigate?: (tab: AppTab) => void) {
    unlockAudioContext()
    const defaultFocus = FOCUS_PRESETS[0]
    setSelectedPreset(defaultFocus)
    setSessionLabel(title.trim() || 'Sesi Fokus Mendalam')
    setSecondsLeft(defaultFocus.minutes * 60)
    completedRef.current = false
    setJustFinished(false)
    endTimeRef.current = Date.now() + defaultFocus.minutes * 60 * 1000
    setIsRunning(true)
    if (onNavigate) onNavigate('focus')
  }

  // Reminder & Notification controls
  async function requestNotifications(): Promise<BrowserNotificationStatus> {
    unlockAudioContext()
    const status = await requestBrowserNotificationPermission()
    setNotificationPermission(status)
    return status
  }

  function snoozeActiveAlarm(minutes = 5) {
    if (!activeAlarm) return
    const targetId = activeAlarm.activity.id
    const snoozeTime = new Date(Date.now() + minutes * 60_000).toISOString()
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === targetId ? { ...a, snoozedUntil: snoozeTime } : a
      ),
    }))
    setActiveAlarm(null)
  }

  function dismissActiveAlarm(markCompleted = false) {
    if (!activeAlarm) return
    const targetId = activeAlarm.activity.id
    if (markCompleted && targetId !== 'test-alarm') {
      toggleActivity(targetId)
    }
    setActiveAlarm(null)
  }

  function triggerTestAlarm() {
    unlockAudioContext()
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const sampleActivity: ActivityItem = {
      id: 'test-alarm',
      title: 'Tes Pengingat & Alarm FokusTrack',
      date: todayKey,
      startTime: `${hh}:${mm}`,
      endTime: `${hh}:${mm}`,
      category: 'Kerja',
      priority: 'Tinggi',
      completed: false,
      notes: 'Ini adalah simulasi alarm & notifikasi kegiatanmu.',
      reminderEnabled: true,
      reminderMinutesBefore: 0,
      reminderMode: 'alarm',
      createdAt: now.toISOString(),
    }
    setActiveAlarm({
      triggerKey: `test-${now.getTime()}`,
      activity: sampleActivity,
      triggeredAt: now.toISOString(),
    })
    playAlarmBurst(data.settings.soundEnabled, data.settings.alarmSoundType)
    void sendSystemNotification(
      '⏰ Tes Alarm FokusTrack',
      'Notifikasi & suara alarm berjalan optimal di perangkatmu!',
      'fokustrack-test-alarm'
    )
  }

  // PWA Install controls
  function dismissInstallBanner() {
    setInstallBannerDismissed(true)
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
    } catch {
      // Ignore
    }
  }

  async function promptInstallPwa(): Promise<boolean> {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsStandalonePwa(true)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Metrics & Streak (100% accurate, 0 when consistency has not started)
  const metrics = useMemo(() => {
    const todayFocusMinutes = data.focusSessions
      .filter((s) => s.date === todayKey)
      .reduce((acc, s) => acc + s.minutes, 0)

    const todayTasks = data.activities.filter((a) => a.date === todayKey)
    const completedTodayTasks = todayTasks.filter((a) => a.completed).length

    const focusRatio =
      data.settings.dailyFocusGoalMinutes > 0
        ? Math.min(1, todayFocusMinutes / data.settings.dailyFocusGoalMinutes)
        : 0
    const taskRatio = todayTasks.length > 0 ? completedTodayTasks / todayTasks.length : 0
    const todayGoalProgress = Math.round(
      (todayTasks.length > 0 ? focusRatio * 0.6 + taskRatio * 0.4 : focusRatio) * 100
    )

    // Build set of genuine consistency dates (completed focus session OR completed activity)
    const activeDates = new Set<string>()
    for (const s of data.focusSessions) {
      if (s.minutes > 0 && s.date) activeDates.add(s.date)
    }
    for (const a of data.activities) {
      if (a.completed && a.date) activeDates.add(a.date)
    }

    const hasStartedConsistency = activeDates.size > 0
    let streakCount = 0

    if (hasStartedConsistency) {
      const now = new Date()
      for (let offset = 0; offset < 365; offset += 1) {
        const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
        const key = toDateKey(checkDate)
        if (activeDates.has(key)) {
          streakCount += 1
        } else if (offset === 0) {
          // Today hasn't been completed yet; check if yesterday kept the streak alive
          continue
        } else {
          break
        }
      }
    }

    const upcomingRemindersCount = data.activities.filter(
      (a) => a.date === todayKey && !a.completed && a.reminderEnabled
    ).length

    const monthPrefix = todayKey.slice(0, 7)
    let totalBalance = 0
    let monthIncome = 0
    let monthExpense = 0
    let todayExpense = 0

    for (const tx of data.transactions) {
      if (tx.type === 'income') {
        totalBalance += tx.amount
        if (tx.date.startsWith(monthPrefix)) monthIncome += tx.amount
      } else {
        totalBalance -= tx.amount
        if (tx.date.startsWith(monthPrefix)) monthExpense += tx.amount
        if (tx.date === todayKey) todayExpense += tx.amount
      }
    }

    const remainingDailyBudget = data.settings.dailyBudgetLimit - todayExpense

    return {
      streakCount,
      hasStartedConsistency,
      todayFocusMinutes,
      todayGoalProgress,
      totalBalance,
      monthIncome,
      monthExpense,
      todayExpense,
      remainingDailyBudget,
      upcomingRemindersCount,
    }
  }, [data, todayKey])

  function exportBackupJson(): string {
    return JSON.stringify(data, null, 2)
  }

  function importBackupJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString) as Partial<PersistedData>
      if (!Array.isArray(parsed.activities) || !Array.isArray(parsed.transactions)) {
        return false
      }
      setData({
        activities: parsed.activities.map((a, idx) => normalizeActivity(a, idx)),
        transactions: parsed.transactions,
        focusSessions: Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [],
        settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      })
      return true
    } catch {
      return false
    }
  }

  function resetStreakOnly() {
    setData((prev) => ({
      ...prev,
      focusSessions: [],
      activities: prev.activities.map((a) => ({ ...a, completed: false })),
    }))
  }

  function resetAllData() {
    triggeredKeysRef.current.clear()
    persistTriggeredKeys()
    setActiveAlarm(null)
    setIsRunning(false)
    endTimeRef.current = null
    setSecondsLeft(FOCUS_PRESETS[0].minutes * 60)
    setData(getEmptyData())
  }

  function loadSampleData() {
    const today = toDateKey()
    const now = new Date()
    const nextHour = String(Math.min(23, now.getHours() + 1)).padStart(2, '0')
    const nextEndHour = String(Math.min(23, now.getHours() + 2)).padStart(2, '0')

    setData((prev) => ({
      ...prev,
      activities: [
        {
          id: `sample-act-1-${Date.now()}`,
          title: 'Deep Work: Prioritas Utama Hari Ini',
          date: today,
          startTime: `${nextHour}:00`,
          endTime: `${nextEndHour}:00`,
          category: 'Kerja',
          priority: 'Tinggi',
          completed: false,
          notes: 'Fokus penuh dengan pengingat otomatis.',
          reminderEnabled: true,
          reminderMinutesBefore: 10,
          reminderMode: 'alarm',
          createdAt: now.toISOString(),
        },
        {
          id: `sample-act-2-${Date.now()}`,
          title: 'Evaluasi Anggaran Harian',
          date: today,
          startTime: '20:00',
          endTime: '20:30',
          category: 'Pribadi',
          priority: 'Sedang',
          completed: false,
          reminderEnabled: true,
          reminderMinutesBefore: 5,
          reminderMode: 'chime',
          createdAt: now.toISOString(),
        },
      ],
      transactions: [
        {
          id: `sample-tx-1-${Date.now()}`,
          title: 'Saldo Tabungan Awal',
          amount: 2500000,
          type: 'income',
          category: 'Tabungan',
          date: today,
          createdAt: now.toISOString(),
        },
        {
          id: `sample-tx-2-${Date.now()}`,
          title: 'Sarapan & Kopi',
          amount: 28000,
          type: 'expense',
          category: 'Makan & Minum',
          date: today,
          createdAt: now.toISOString(),
        },
      ],
    }))
  }

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        todayKey,
        activities: data.activities,
        addActivity,
        updateActivity,
        toggleActivity,
        deleteActivity,
        transactions: data.transactions,
        addTransaction,
        deleteTransaction,
        focusSessions: data.focusSessions,
        addFocusSession,
        settings: data.settings,
        updateSettings,
        ...metrics,
        selectedPreset,
        secondsLeft,
        isRunning,
        sessionLabel,
        setSessionLabel,
        justFinished,
        selectPreset,
        startPauseTimer,
        resetTimer,
        completeTimerNow,
        startFocusForActivity,
        notificationPermission,
        requestNotifications,
        activeAlarm,
        snoozeActiveAlarm,
        dismissActiveAlarm,
        triggerTestAlarm,
        canInstallPwa: Boolean(deferredPrompt),
        isStandalonePwa,
        installBannerDismissed,
        dismissInstallBanner,
        promptInstallPwa,
        exportBackupJson,
        importBackupJson,
        resetStreakOnly,
        resetAllData,
        loadSampleData,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
