import { useApp } from '../../context/AppContext'
import type { AlarmSoundType, ReminderMode, ReminderOffsetMinutes } from '../../types'
import { formatTimeHHMM, parseActivityDateTime, subtractMinutes } from '../../utils/date'
import Icon from './Icon'
import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ReminderCenterModal({ open, onClose }: Props) {
  const {
    todayKey,
    activities,
    updateActivity,
    settings,
    updateSettings,
    notificationPermission,
    requestNotifications,
    triggerTestAlarm,
  } = useApp()

  const todayPending = activities.filter((a) => a.date === todayKey && !a.completed)

  async function handleEnablePermission() {
    await requestNotifications()
  }

  return (
    <Modal
      open={open}
      title="Pusat Pengingat & Alarm"
      subtitle="Atur notifikasi sistem, nada alarm, dan pengingat jadwal"
      onClose={onClose}
    >
      <div className="form-stack">
        {/* Browser Notification Status Box */}
        <div className="reminder-status-box">
          <div className="reminder-status-head">
            <span className={`summary-icon ${notificationPermission === 'granted' ? 'mint' : 'violet'}`}>
              <Icon name={notificationPermission === 'granted' ? 'bell-ring' : 'bell'} size={18} />
            </span>
            <div className="reminder-status-text">
              <strong>
                {notificationPermission === 'granted'
                  ? 'Notifikasi Sistem Aktif'
                  : notificationPermission === 'denied'
                    ? 'Izin Notifikasi Diblokir Browser'
                    : notificationPermission === 'unsupported'
                      ? 'Alarm In-App Aktif'
                      : 'Aktifkan Notifikasi Latar Belakang'}
              </strong>
              <p>
                {notificationPermission === 'granted'
                  ? 'Pesan notifikasi & alarm akan muncul otomatis saat jadwal tiba.'
                  : notificationPermission === 'denied'
                    ? 'Buka Pengaturan Situs di browser HP (ikon gembok di bilah alamat) → Izinkan Notifikasi.'
                    : notificationPermission === 'unsupported'
                      ? 'Browser ini menggunakan alarm layar & suara langsung di aplikasi.'
                      : 'Izinkan notifikasi agar pengingat tetap muncul saat aplikasi diminimalkan.'}
              </p>
            </div>
          </div>

          <div className="reminder-btn-row">
            {notificationPermission === 'default' && (
              <button type="button" className="primary-button compact-btn" onClick={handleEnablePermission}>
                <Icon name="bell-ring" size={15} /> Izinkan Notifikasi
              </button>
            )}
            <button
              type="button"
              className="secondary-button compact-btn"
              onClick={() => {
                onClose()
                triggerTestAlarm()
              }}
            >
              <Icon name="zap" size={15} /> Tes Alarm &amp; Notifikasi
            </button>
          </div>
        </div>

        {/* Default Reminder Preferences */}
        <div className="form-row-2">
          <label className="field-label">
            <span>Waktu Pengingat Default</span>
            <select
              className="text-input compact-input"
              value={settings.defaultReminderMinutes}
              onChange={(e) =>
                updateSettings({
                  defaultReminderMinutes: Number(e.target.value) as ReminderOffsetMinutes,
                })
              }
            >
              <option value={0}>Tepat saat mulai (0 mnt)</option>
              <option value={5}>5 menit sebelum</option>
              <option value={10}>10 menit sebelum</option>
              <option value={15}>15 menit sebelum</option>
              <option value={30}>30 menit sebelum</option>
              <option value={60}>1 jam sebelum</option>
            </select>
          </label>

          <label className="field-label">
            <span>Mode Default</span>
            <select
              className="text-input compact-input"
              value={settings.defaultReminderMode}
              onChange={(e) =>
                updateSettings({
                  defaultReminderMode: e.target.value as ReminderMode,
                })
              }
            >
              <option value="alarm">Alarm + Notifikasi</option>
              <option value="chime">Nada Lembut + Notif</option>
              <option value="silent">Visual Saja</option>
            </select>
          </label>
        </div>

        <div className="form-row-2">
          <label className="field-label">
            <span>Nada Alarm</span>
            <select
              className="text-input compact-input"
              value={settings.alarmSoundType}
              onChange={(e) =>
                updateSettings({
                  alarmSoundType: e.target.value as AlarmSoundType,
                })
              }
            >
              <option value="classic">Klasik (Jelas)</option>
              <option value="gentle">Lembut (Harmonik)</option>
              <option value="pulse">Pulse (Enerjik)</option>
            </select>
          </label>

          <label className="field-label">
            <span>Suara &amp; Getar</span>
            <button
              type="button"
              className={`secondary-button compact-btn full-width ${settings.soundEnabled ? 'active-outline' : ''}`}
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            >
              <Icon name={settings.soundEnabled ? 'volume-2' : 'volume-x'} size={15} />
              {settings.soundEnabled ? 'Suara Aktif' : 'Suara Hening'}
            </button>
          </label>
        </div>

        {/* Today's Activity Reminder Toggles */}
        <div className="reminder-list-section">
          <span className="eyebrow">JADWAL PENGINGAT HARI INI ({todayPending.length})</span>
          {todayPending.length === 0 ? (
            <p className="modal-desc">Belum ada jadwal aktif hari ini. Tambahkan jadwal untuk menyetel alarm.</p>
          ) : (
            <div className="reminder-mini-list">
              {todayPending.map((act) => {
                const startDt = parseActivityDateTime(act.date, act.startTime)
                const remindDt = subtractMinutes(startDt, act.reminderMinutesBefore)
                return (
                  <div key={act.id} className="reminder-mini-row">
                    <div className="reminder-mini-info">
                      <strong>{act.title}</strong>
                      <span>
                        Mulai {act.startTime} ·{' '}
                        {act.reminderEnabled
                          ? `Alarm pukul ${formatTimeHHMM(remindDt)} (${
                              act.reminderMinutesBefore === 0 ? 'tepat waktu' : `-${act.reminderMinutesBefore}m`
                            })`
                          : 'Pengingat nonaktif'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`pill-toggle ${act.reminderEnabled ? 'on' : ''}`}
                      onClick={() => updateActivity(act.id, { reminderEnabled: !act.reminderEnabled })}
                      aria-label="Toggle pengingat kegiatan"
                    >
                      <Icon name={act.reminderEnabled ? 'bell-ring' : 'bell-off'} size={14} />
                      {act.reminderEnabled ? 'Aktif' : 'Mati'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
