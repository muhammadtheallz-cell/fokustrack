import { FOCUS_PRESETS, useApp } from '../../context/AppContext'
import Icon from '../../components/ui/Icon'

export default function FocusPage() {
  const {
    todayKey,
    activities,
    focusSessions,
    todayFocusMinutes,
    settings,
    updateSettings,
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
  } = useApp()

  const totalSeconds = selectedPreset.minutes * 60
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0
  const radius = 94
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')
  const todaySessions = focusSessions.filter((s) => s.date === todayKey)
  const todayPendingTasks = activities.filter((a) => a.date === todayKey && !a.completed)

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">DEEP WORK TIMER</p>
          <h1>
            Ruang <span className="gradient-text">fokus.</span>
          </h1>
          <p className="heading-subtitle">Timer tetap berjalan meski kamu berpindah tab.</p>
        </div>
        <button
          className="icon-button"
          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
          title={settings.soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi nonaktif'}
          aria-label="Toggle suara timer"
        >
          <Icon name={settings.soundEnabled ? 'volume-2' : 'volume-x'} size={19} />
        </button>
      </section>

      <section className="surface-card focus-timer-card">
        <div className="preset-pills" role="tablist" aria-label="Pilih mode timer">
          {FOCUS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`preset-pill ${selectedPreset.id === preset.id ? 'active' : ''}`}
              onClick={() => selectPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="timer-ring-wrap">
          <svg className="timer-svg" viewBox="0 0 220 220" aria-hidden="true">
            <circle className="timer-track" cx="110" cy="110" r={radius} />
            <circle
              className={`timer-progress ${selectedPreset.isBreak ? 'break-mode' : ''}`}
              cx="110"
              cy="110"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="timer-readout">
            <span className="timer-mode-badge">{selectedPreset.isBreak ? 'WAKTU ISTIRAHAT' : 'SESI FOKUS'}</span>
            <div className="timer-digits">
              {mins}:{secs}
            </div>
            <span className="timer-sub">{isRunning ? 'Tetap hadir di momen ini...' : 'Siap dimulai'}</span>
          </div>
        </div>

        {!selectedPreset.isBreak && (
          <div className="focus-target-box">
            <input
              type="text"
              className="text-input compact-input"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="Apa yang sedang kamu kerjakan?"
              aria-label="Nama sesi fokus"
            />
            {todayPendingTasks.length > 0 && (
              <div className="quick-task-chips">
                {todayPendingTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="mini-chip"
                    onClick={() => setSessionLabel(t.title)}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {justFinished && (
          <div className="toast-banner">
            <Icon name="sparkles" size={16} /> Sesi tercatat! Streak konsistensimu diperbarui.
          </div>
        )}

        <div className="timer-controls">
          <button className="icon-button" onClick={resetTimer} aria-label="Reset timer" title="Reset">
            <Icon name="rotate-ccw" size={18} />
          </button>
          <button className="primary-button timer-main-btn" onClick={startPauseTimer}>
            <Icon name={isRunning ? 'pause' : 'play'} size={18} />
            {isRunning ? 'Jeda' : secondsLeft === 0 ? 'Ulangi' : 'Mulai Fokus'}
          </button>
          {!selectedPreset.isBreak && (
            <button
              className="icon-button"
              onClick={completeTimerNow}
              aria-label="Selesaikan & catat sesi sekarang"
              title="Catat selesai sekarang"
            >
              <Icon name="check" size={18} />
            </button>
          )}
        </div>
      </section>

      <section className="summary-grid">
        <article className="surface-card summary-card compact-stat">
          <div className="card-top">
            <span className="summary-icon violet">
              <Icon name="clock" size={18} />
            </span>
            <span className="card-kicker">FOKUS HARI INI</span>
          </div>
          <div className="summary-value compact">{todayFocusMinutes} mnt</div>
          <p className="summary-caption">Target: {settings.dailyFocusGoalMinutes} mnt</p>
        </article>
        <article className="surface-card summary-card compact-stat">
          <div className="card-top">
            <span className="summary-icon mint">
              <Icon name="target" size={18} />
            </span>
            <span className="card-kicker">SESI SELESAI</span>
          </div>
          <div className="summary-value compact">{todaySessions.length} sesi</div>
          <p className="summary-caption">Tercatat hari ini</p>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RIWAYAT HARI INI</p>
            <h2>Log sesi fokus</h2>
          </div>
          <span className="muted-pill">{todaySessions.length} sesi</span>
        </div>

        {todaySessions.length === 0 ? (
          <div className="surface-card empty-activity small-empty">
            <p>Belum ada sesi fokus yang selesai hari ini. Mulai 1 sesi 25 menit untuk membangun streak.</p>
          </div>
        ) : (
          <div className="item-list">
            {todaySessions.map((session) => (
              <div key={session.id} className="surface-card task-row">
                <span className="summary-icon violet">
                  <Icon name="check" size={16} />
                </span>
                <div className="task-info">
                  <div className="task-title-line">
                    <span className="task-title">{session.label}</span>
                    <span className="category-tag">{session.minutes} menit</span>
                  </div>
                  <div className="task-meta">
                    <span>
                      Selesai pukul{' '}
                      {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
                        new Date(session.completedAt)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
