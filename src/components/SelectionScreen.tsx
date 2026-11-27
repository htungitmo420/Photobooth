import { Check, LoaderCircle, RotateCcw } from 'lucide-react'
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
  return (
    <section className="selection-screen">
      <div className="selection-heading">
        <div>
          <p className="eyebrow">BẢNG PHIM · CHỌN ẢNH IN</p>
          <h1>Giữ lại {layout.slots} khoảnh khắc bạn thích</h1>
          <p>Toàn bộ {candidatePhotos.length} ảnh được lưu trong LiveGallery và ghép ở tốc độ 0,75 giây/ảnh.</p>
        </div>
        <div className="selection-count">
          <strong>{padFrame(selectedCandidateIds.length)}</strong>
          <span>/ {padFrame(layout.slots)} KHUNG</span>
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
              <img src={photo.dataUrl} alt={`Ảnh chụp ${index + 1}`} />
              <span className="candidate-number">{padFrame(index + 1)}</span>
              {selectedIndex >= 0
                ? <span className="candidate-choice"><Check size={15} aria-hidden="true" /> Ảnh in {padFrame(selectedIndex + 1)}</span>
                : <span className="candidate-choice muted">Lưu vào LiveGallery</span>}
            </button>
          )
        })}
      </div>
      <div className="selection-actions">
        <button type="button" className="text-button" onClick={onRetakeAll}>
          <RotateCcw size={17} aria-hidden="true" /> Chụp lại toàn bộ
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={selectedCandidateIds.length !== layout.slots || preparingSelection}
          onClick={onConfirmSelection}
        >
          {preparingSelection ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          <span>{preparingSelection ? 'Đang tạo ảnh động…' : 'Dùng các ảnh đã chọn'}</span>
        </button>
      </div>
    </section>
  )
}
