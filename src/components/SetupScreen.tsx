import { Camera, Check, Volume2, VolumeX, Zap } from 'lucide-react'
import { useLocale } from '../i18n/useLocale'
import { clampCountdown, padFrame } from '../lib/boothUtils'
import { LAYOUTS } from '../presets'
import type { BoothLayout, FlashMode } from '../types'
import { ViewfinderBrackets } from './Topbar'

interface SetupScreenProps {
  layout: BoothLayout
  countdownSeconds: number
  sound: boolean
  flashMode: FlashMode
  onSelectLayout: (layout: BoothLayout) => void
  onChangeCountdown: (seconds: number) => void
  onToggleSound: () => void
  onSelectFlashMode: (mode: FlashMode) => void
  onStartCamera: () => void
}

export function SetupScreen({
  layout,
  countdownSeconds,
  sound,
  flashMode,
  onSelectLayout,
  onChangeCountdown,
  onToggleSound,
  onSelectFlashMode,
  onStartCamera,
}: SetupScreenProps) {
  const { messages } = useLocale()
  const specimenFrames = Array.from({ length: layout.slots }, (_, index) => padFrame(index + 1))
  const currentLayoutCopy = messages.layouts[layout.id]

  return (
    <section className="setup-grid">
      <div className="light-table" aria-label={messages.setup.lightTableAria}>
        <div className="light-table__bar">
          <span className="mono-tag">{messages.setup.lightTableTag}</span>
          <span className="mono-tag mono-tag--accent" data-testid="layout-dimensions">
            {layout.width} × {layout.height} PX · {padFrame(layout.slots)} {messages.setup.framesUnit}
          </span>
        </div>

        <div className="light-table__copy">
          <h1>{messages.setup.heroTitle}</h1>
          <p>{messages.setup.heroDesc}</p>
        </div>

        <div className="specimen-bay">
          <ViewfinderBrackets />

          <div className="sprocket-rail sprocket-rail--left" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
          </div>

          <div
            className={`print-specimen specimen--${layout.id}`}
            data-layout={layout.id}
            aria-label={messages.setup.specimenAria(currentLayoutCopy.name, layout.slots)}
          >
            <div className="specimen-frames">
              {specimenFrames.map((frameCode, index) => (
                <div key={frameCode} className={`specimen-frame tone-${(index % 4) + 1}`}>
                  <span className="specimen-frame-num">{frameCode}</span>
                </div>
              ))}
            </div>
            <div className="specimen-footer">
              <strong>KHOẢNH KHẮC</strong>
              <span>{layout.id === 'grid4' ? '2×2 · 35MM' : layout.id === 'polaroid' ? 'POLAROID · 01' : `35MM · ${padFrame(layout.slots)}F`}</span>
            </div>
          </div>

          <div className="sprocket-rail sprocket-rail--right" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
          </div>
        </div>

        <div className="light-table__footer">
          <div className="light-table__summary">
            <strong>{currentLayoutCopy.name}</strong>
            <span>{messages.setup.summaryPhoto(layout.slots)}</span>
          </div>
          <span className="mono-tag">
            {padFrame(countdownSeconds)}S · FLASH {flashMode === 'off' ? 'OFF' : flashMode === 'auto' ? 'AUTO' : 'ON'}
          </span>
        </div>
      </div>

      <div className="setup-panel">
        <div className="panel-heading">
          <span className="panel-step-num">01</span>
          <div>
            <h2>{messages.setup.panelTitle}</h2>
            <p>{messages.setup.panelDesc}</p>
          </div>
        </div>

        <div className="layout-options" role="group" aria-label={messages.setup.layoutGroupAria}>
          {LAYOUTS.map((item) => {
            const selected = layout.id === item.id
            const itemCopy = messages.layouts[item.id]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectLayout(item)}
                aria-pressed={selected}
                className={`layout-option ${selected ? 'selected' : ''}`}
              >
                <span className={`layout-icon ${item.kind} slots-${item.slots}`} aria-hidden="true">
                  {Array.from({ length: item.slots }, (_, index) => <i key={index} />)}
                </span>
                <span className="layout-option__copy">
                  <strong>{itemCopy.name}</strong>
                  <small>{itemCopy.description}</small>
                </span>
                <span className="layout-option__meta">
                  {selected ? <Check size={16} aria-hidden="true" /> : `${padFrame(item.slots)}F`}
                </span>
              </button>
            )
          })}
        </div>

        <div className="quick-settings">
          <label className="countdown-setting">
            <span>{messages.setup.countdownLabel}</span>
            <span className="number-setting">
              <input
                aria-label={messages.setup.countdownAria}
                type="number"
                min={0}
                max={30}
                value={countdownSeconds}
                onChange={(event) => onChangeCountdown(clampCountdown(Number(event.target.value)))}
              />
              <span className="unit">{messages.setup.secondsUnit}</span>
            </span>
          </label>
          <button
            type="button"
            className={sound ? 'toggle active' : 'toggle'}
            aria-pressed={sound}
            onClick={onToggleSound}
          >
            {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            <span>{messages.setup.soundLabel}</span>
          </button>
        </div>

        <div className="flash-setting">
          <span><Zap size={15} aria-hidden="true" /> {messages.setup.flashLabel}</span>
          <div role="group" aria-label={messages.setup.flashAria}>
            {(['off', 'auto', 'on'] as FlashMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={flashMode === mode ? 'selected' : ''}
                aria-pressed={flashMode === mode}
                onClick={() => onSelectFlashMode(mode)}
              >
                {messages.setup.flashModes[mode]}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="primary-button shutter-cta" onClick={onStartCamera}>
          <Camera size={19} aria-hidden="true" />
          <span>{messages.setup.startCamera}</span>
        </button>
        <p className="permission-copy">{messages.setup.permissionCopy}</p>
      </div>
    </section>
  )
}
