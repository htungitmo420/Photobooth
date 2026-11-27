import { Check, Moon, ShieldCheck, Sun } from 'lucide-react'
import type { NoticeItem } from '../hooks/useNotices'
import type { ThemeMode } from '../hooks/useTheme'
import { LOCALE_OPTIONS } from '../i18n/core'
import { useLocale } from '../i18n/useLocale'
import type { CaptureMode } from '../motionCapture'
import type { AppStep } from '../types'

function CameraMark({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="camera-mark" height={size} viewBox="0 0 32 32" width={size}>
      <rect height="20" rx="2" width="26" x="3" y="7" />
      <path d="M10 7 12.5 3.5h7L22 7" />
      <circle cx="16" cy="17" r="5.5" />
      <circle className="camera-mark__lens" cx="16" cy="17" r="2" />
    </svg>
  )
}

export function LanguageSwitch() {
  const { locale, setLocale, messages } = useLocale()
  return (
    <div className="lang-switch" role="group" aria-label={messages.languageSwitcherLabel}>
      {LOCALE_OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          className={locale === option.code ? 'lang-switch__btn selected' : 'lang-switch__btn'}
          aria-pressed={locale === option.code}
          aria-label={option.nativeName}
          title={option.nativeName}
          onClick={() => setLocale(option.code)}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  )
}

interface TopbarProps {
  step: AppStep
  captureMode: CaptureMode
  theme: ThemeMode
  onReset: () => void
  onToggleTheme: () => void
}

export function Topbar({ step, captureMode, theme, onReset, onToggleTheme }: TopbarProps) {
  const { messages } = useLocale()
  const stepItems = [
    ['setup', '01', messages.topbar.steps.setup],
    ['capture', '02', messages.topbar.steps.capture],
    ['edit', '03', messages.topbar.steps.edit],
  ] as const
  const progressStep = step === 'select' ? 'capture' : step
  const currentStepIndex = stepItems.findIndex(([value]) => value === progressStep)

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={onReset} aria-label={messages.topbar.brandAria}>
        <span className="brand-mark" aria-hidden="true"><CameraMark size={20} /></span>
        <span className="brand-text">
          <strong>Khoảnh Khắc</strong>
          <small>PHOTOBOOTH</small>
        </span>
      </button>

      <nav className="step-rail" aria-label={messages.topbar.progressAria}>
        {stepItems.map(([value, number, label], index) => {
          const isActive = progressStep === value
          const isDone = currentStepIndex > index
          return (
            <div
              key={value}
              className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="step-index">
                {isDone ? <Check size={12} aria-hidden="true" /> : number}
              </span>
              <span className="step-label">{label}</span>
            </div>
          )
        })}
      </nav>

      <div className="topbar-right">
        <div className="privacy-note">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>{captureMode === 'photo-gallery' ? messages.topbar.privacyGallery : messages.topbar.privacyLocal}</span>
        </div>
        <LanguageSwitch />
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? messages.topbar.toLight : messages.topbar.toDark}
          aria-pressed={theme === 'light'}
          title={theme === 'dark' ? messages.topbar.toLight : messages.topbar.toDark}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          <span>{theme === 'dark' ? messages.topbar.lightShort : messages.topbar.darkShort}</span>
        </button>
      </div>
    </header>
  )
}

export function NoticeStack({
  notices,
  onDismiss,
}: {
  notices: NoticeItem[]
  onDismiss: (id: string) => void
}) {
  const { messages } = useLocale()
  if (notices.length === 0) return null
  return (
    <div className="notice-stack" aria-live="polite" aria-relevant="additions">
      {notices.map((item) => (
        <div className="notice" role="status" key={item.id}>
          <span>{item.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label={messages.topbar.dismissNoticeAria}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export function ViewfinderBrackets() {
  return (
    <>
      <span className="vf-corner vf-tl" aria-hidden="true" />
      <span className="vf-corner vf-tr" aria-hidden="true" />
      <span className="vf-corner vf-bl" aria-hidden="true" />
      <span className="vf-corner vf-br" aria-hidden="true" />
    </>
  )
}
