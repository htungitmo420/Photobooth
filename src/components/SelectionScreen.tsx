import { Check, LoaderCircle, RotateCcw } from 'lucide-react'
import { useLocale } from '../i18n/useLocale'
import { padFrame } from '../lib/boothUtils'
import type { BoothLayout, CapturedPhoto } from '../types'

interface SelectionScreenProps {
  layout: BoothLayout
  candidatePhotos: CapturedPhoto[]
  selectedCandidateIds: string[]
  preparingSelection: boolean
  onToggleCandidate: (id: string) => void
  onRetakeAll: () => void
  onConfirmSelection: () => void
}

export function SelectionScreen({
  layout,
  candidatePhotos,
  selectedCandidateIds,
  preparingSelection,
  onToggleCandidate,
  onRetakeAll,
  onConfirmSelection,
}: SelectionScreenProps) {
  const { messages } = useLocale()
  return (
    <section className="selection-screen">
      <div className="selection-heading">
        <div>
          <p className="eyebrow">{messages.selection.eyebrow}</p>
          <h1>{messages.selection.title(layout.slots)}</h1>
          <p>{messages.selection.desc(candidatePhotos.length)}</p>
        </div>
        <div className="selection-count">
          <strong>{padFrame(selectedCandidateIds.length)}</strong>
          <span>/ {padFrame(layout.slots)} {messages.selection.framesUnit}</span>
        </div>
      </div>
      <div className="candidate-grid">
        {candidatePhotos.map((photo, index) => {
          const selectedIndex = selectedCandidateIds.indexOf(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              className={selectedIndex >= 0 ? 'candidate selected' : 'candidate'}
              onClick={() => onToggleCandidate(photo.id)}
              aria-pressed={selectedIndex >= 0}
            >
              <img src={photo.dataUrl} alt={messages.selection.photoAlt(index + 1)} />
              <span className="candidate-number">{padFrame(index + 1)}</span>
              {selectedIndex >= 0
                ? <span className="candidate-choice"><Check size={15} aria-hidden="true" /> {messages.selection.chosenBadge(padFrame(selectedIndex + 1))}</span>
                : <span className="candidate-choice muted">{messages.selection.savedToGalleryBadge}</span>}
            </button>
          )
        })}
      </div>
      <div className="selection-actions">
        <button type="button" className="text-button" onClick={onRetakeAll}>
          <RotateCcw size={17} aria-hidden="true" /> {messages.selection.retakeAll}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={selectedCandidateIds.length !== layout.slots || preparingSelection}
          onClick={onConfirmSelection}
        >
          {preparingSelection ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          <span>{preparingSelection ? messages.selection.encoding : messages.selection.confirm}</span>
        </button>
      </div>
    </section>
  )
}
