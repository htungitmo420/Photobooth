import {
  Copy,
  Download,
  Eye,
  FlipHorizontal2,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCcw,
  RotateCw,
  Trash2,
  Video,
} from 'lucide-react'
import { type ChangeEvent, useRef } from 'react'
import {
  COLLAGE_FORMATS,
  MAX_COLLAGE_ITEMS,
  type CollageItem,
  type CollageSettings,
} from '../collage'
import type { GalleryShare } from '../galleryPublish'
import type { RemoteBackground } from '../lib/backgrounds'
import { COLLAGE_BACKGROUNDS, padFrame } from '../lib/boothUtils'
import type { LocalBackground } from '../lib/localBackgrounds'
import { downloadMotionBlob, type CaptureMode, type MotionClip } from '../motionCapture'
import { FILTERS, STICKER_CATEGORIES } from '../presets'
import type {
  BoothFrame,
  BoothSession,
  BoothSticker,
  CapturedPhoto,
  FilterId,
  StickerAsset,
  StickerCategory,
} from '../types'
import { CollageEditor } from './CollageEditor'
import { StripPreview } from './StripPreview'

interface EditorScreenProps {
  session: BoothSession
  editorPanelTab: 'design' | 'stickers' | 'background'
  outputSize: { width: number; height: number }
  photos: CapturedPhoto[]
  candidatePhotos: CapturedPhoto[]
  captureMode: CaptureMode
  motionClip: MotionClip | null
  visibleFrames: BoothFrame[]
  remoteFrames: boolean
  filter: FilterId
  frame: BoothFrame
  caption: string
  showDate: boolean
  stickers: BoothSticker[]
  selectedSticker: BoothSticker | null
  selectedStickerId: string | null
  stickerCategory: 'all' | StickerCategory
  visibleStickerAssets: StickerAsset[]
  remoteStickers: boolean
  collageSettings: CollageSettings
  selectedCollageItem: CollageItem | null
  selectedCollageItemId: string | null
  remoteBackgrounds: RemoteBackground[]
  localBackgrounds: LocalBackground[]
  remoteBackgroundSource: boolean
  format: 'png' | 'jpeg'
  exporting: boolean
  publishingGallery: boolean
  galleryShare: (GalleryShare & { qrDataUrl: string }) | null
  onReset: () => void
  onOpenPreview: () => void
  onOpenPhotoPreview: (index: number) => void
  onOpenMotionPreview: () => void
  onOpenGalleryShare: () => void
  onSelectFilter: (filter: FilterId) => void
  onSelectFrame: (frame: BoothFrame) => void
  onAddLocalFrame: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveLocalFrame: (frame: BoothFrame) => void
  onChangeCaption: (caption: string) => void
  onToggleShowDate: (show: boolean) => void
  onSelectStickerCategory: (category: 'all' | StickerCategory) => void
  onAddSticker: (asset: StickerAsset) => void
  onMoveSticker: (id: string, x: number, y: number) => void
  onUpdateSticker: (id: string, changes: Partial<BoothSticker>) => void
  onRemoveSticker: (id: string) => void
  onSelectSticker: (id: string | null) => void
  onUpdateSelectedSticker: (changes: Partial<BoothSticker>) => void
  onDuplicateSelectedSticker: () => void
  onRemoveSelectedSticker: () => void
  onClearStickers: () => void
  onPatchCollage: (changes: Partial<CollageSettings>) => void
  onSelectCollageItem: (id: string | null) => void
  onMoveCollageItem: (id: string, x: number, y: number) => void
  onUpdateCollageItem: (id: string, changes: Partial<CollageItem>) => void
  onRemoveCollageItem: (id: string) => void
  onDuplicateCollageItem: () => void
  onUseSingleCollage: () => void
  onUseTwoStripCollage: () => void
  onAddLocalBackground: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveLocalBackground: (item: LocalBackground) => void
  onSelectFormat: (format: 'png' | 'jpeg') => void
  onPublishGallery: () => void
  onExportPhoto: () => void
}

export function EditorScreen({
  session,
  editorPanelTab,
  outputSize,
  photos,
  candidatePhotos,
  captureMode,
  motionClip,
  visibleFrames,
  remoteFrames,
  filter,
  frame,
  caption,
  showDate,
  stickers,
  selectedSticker,
  selectedStickerId,
  stickerCategory,
  visibleStickerAssets,
  remoteStickers,
  collageSettings,
  selectedCollageItem,
  selectedCollageItemId,
  remoteBackgrounds,
  localBackgrounds,
  remoteBackgroundSource,
  format,
  exporting,
  publishingGallery,
  galleryShare,
  onReset,
  onOpenPreview,
  onOpenPhotoPreview,
  onOpenMotionPreview,
  onOpenGalleryShare,
  onSelectFilter,
  onSelectFrame,
  onAddLocalFrame,
  onRemoveLocalFrame,
  onChangeCaption,
  onToggleShowDate,
  onSelectStickerCategory,
  onAddSticker,
  onMoveSticker,
  onUpdateSticker,
  onRemoveSticker,
  onSelectSticker,
  onUpdateSelectedSticker,
  onDuplicateSelectedSticker,
  onRemoveSelectedSticker,
  onClearStickers,
  onPatchCollage,
  onSelectCollageItem,
  onMoveCollageItem,
  onUpdateCollageItem,
  onRemoveCollageItem,
  onDuplicateCollageItem,
  onUseSingleCollage,
  onUseTwoStripCollage,
  onAddLocalBackground,
  onRemoveLocalBackground,
  onSelectFormat,
  onPublishGallery,
  onExportPhoto,
}: EditorScreenProps) {
  const frameInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="editor-layout">
      <div className={`preview-column ${editorPanelTab === 'background' ? 'collage-mode' : ''}`}>
        <div className="preview-column-toolbar">
          <div>
            <p className="eyebrow">{editorPanelTab === 'background' ? 'Nền ghép của bạn' : 'Bàn in phòng tối'}</p>
            <span className="mono-spec">{outputSize.width} × {outputSize.height} PX</span>
          </div>
          <button type="button" className="preview-open-button" onClick={onOpenPreview}>
            <Eye size={16} aria-hidden="true" /> Xem trước
          </button>
        </div>
        <div className="preview-stage">
          {editorPanelTab === 'background'
            ? (
              <CollageEditor
                session={session}
                settings={collageSettings}
                selectedId={selectedCollageItemId}
                onSelect={onSelectCollageItem}
                onMove={onMoveCollageItem}
                onUpdate={onUpdateCollageItem}
                onRemove={onRemoveCollageItem}
              />
            )
            : (
              <StripPreview
                session={session}
                interactive
                onMoveSticker={onMoveSticker}
                onUpdateSticker={onUpdateSticker}
                onRemoveSticker={onRemoveSticker}
                selectedStickerId={selectedStickerId}
                onSelectSticker={onSelectSticker}
                onPreview={onOpenPreview}
              />
            )}
        </div>
        <div className="retake-row">
          {photos.map((photo, index) => (
            <button key={photo.id} type="button" onClick={() => onOpenPhotoPreview(index)}>
              <img src={photo.dataUrl} alt="" />
              <span><em className="mono-value">{padFrame(index + 1)}</em> Xem</span>
            </button>
          ))}
          {motionClip && (
            <button type="button" className="motion-review-button" onClick={onOpenMotionPreview}>
              <img src={motionClip.gifUrl} alt="Ảnh động LiveGallery" />
              <span><Video size={13} aria-hidden="true" /> GIF</span>
            </button>
          )}
        </div>
      </div>

      <div className="editor-panel">
        <div className="editor-title">
          <div>
            <p className="eyebrow">Bước cuối</p>
            <h1>Thêm chút dấu ấn</h1>
          </div>
          <button type="button" className="text-button new-session-button" onClick={onReset} aria-label="Chụp bộ mới">
            <RefreshCcw size={15} aria-hidden="true" />
            <span>Chụp bộ mới</span>
          </button>
        </div>
        <div className="editor-tabs editor-tabs-single" role="group" aria-label="Tùy chỉnh ảnh">
          <button type="button" aria-pressed="true" className="selected">Bộ lọc & khung</button>
          <span className="editor-tabs-note">Sticker và nền ghép chỉnh tiếp trong LiveGallery.</span>
        </div>

        {editorPanelTab === 'design' && (
          <div className="editor-design">
            <section className="control-section filter-section">
              <h2>Bộ lọc màu</h2>
              <div className="filter-grid">
                {FILTERS.map((item) => (
                  <button key={item.id} type="button" className={filter === item.id ? 'selected' : ''} aria-pressed={filter === item.id} onClick={() => onSelectFilter(item.id)}>
                    <span style={{ filter: item.css }} />
                    <small>{item.name}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="control-section frame-section">
              <div className="section-line">
                <h2>Khung ảnh</h2>
                <span className={remoteFrames ? 'source online' : 'source'}>{remoteFrames ? 'Supabase + máy' : 'Bản mẫu + máy'}</span>
              </div>
              <div className="frame-grid">
                {visibleFrames.map((item) => (
                  <div className="frame-option" key={item.id}>
                    <button type="button" title={item.description} className={frame.id === item.id ? 'selected' : ''} aria-pressed={frame.id === item.id} onClick={() => onSelectFrame(item)}>
                      {item.assetUrl ? <img src={item.assetUrl} alt="" /> : <i style={{ background: item.config.background, borderColor: item.config.accent }} />}
                      <span>{item.name}</span>
                    </button>
                    {item.source === 'local' && (
                      <button type="button" className="delete-frame" onClick={() => onRemoveLocalFrame(item)} aria-label={`Xóa ${item.name}`}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-frame" onClick={() => frameInputRef.current?.click()}>
                  <Plus size={16} aria-hidden="true" /> Thêm frame
                </button>
              </div>
              <input ref={frameInputRef} className="visually-hidden" type="file" accept="image/png,image/webp" onChange={onAddLocalFrame} />
              <p className="hint">PNG/WebP tối đa 5 MB, có đúng số ô ảnh trong suốt. Giữ nguyên tỷ lệ khung gốc; lưu riêng trong trình duyệt này.</p>
            </section>

            <section className="control-section caption-section">
              <h2>Lời nhắn</h2>
              <div className="caption-field">
                <input aria-label="Lời nhắn trên bản in" value={caption} disabled={Boolean(frame.assetUrl)} maxLength={60} onChange={(event) => onChangeCaption(event.target.value)} placeholder="KHOẢNH KHẮC" />
                <span className="mono-value">{caption.length}/60</span>
              </div>
              <label className="check-line">
                <input type="checkbox" disabled={Boolean(frame.assetUrl)} checked={showDate} onChange={(event) => onToggleShowDate(event.target.checked)} />
                <span>Hiện ngày chụp</span>
              </label>
              {frame.assetUrl && <p className="hint">Frame này dùng thiết kế footer có sẵn nên lời nhắn và ngày mặc định được ẩn.</p>}
            </section>
          </div>
        )}

        {editorPanelTab === 'stickers' && (
          <div className="editor-stickers">
            <section className="control-section sticker-section">
              <div className="section-line"><h2>Sticker</h2><span className="mono-value">{stickers.length}/20 · {remoteStickers ? 'Supabase' : 'Có sẵn'}</span></div>
              <div className="sticker-categories">{STICKER_CATEGORIES.map((category) => <button key={category.id} type="button" className={stickerCategory === category.id ? 'selected' : ''} onClick={() => onSelectStickerCategory(category.id)}>{category.name}</button>)}</div>
              <div className="sticker-library">{visibleStickerAssets.map((asset) => <button key={asset.id} type="button" onClick={() => onAddSticker(asset)} title={asset.name}>{asset.kind === 'image' ? <img src={asset.content} alt={asset.name} loading="lazy" /> : <span>{asset.content}</span>}</button>)}</div>
              {selectedSticker && (
                <div className="sticker-tools">
                  <label>Kích thước<input type="range" min={0.06} max={0.36} step={0.01} value={selectedSticker.size} onChange={(event) => onUpdateSelectedSticker({ size: Number(event.target.value) })} /></label>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ rotation: selectedSticker.rotation + 15 })} aria-label="Xoay sticker" title="Xoay"><RotateCw size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ flipX: !selectedSticker.flipX })} aria-label="Lật ngang sticker" title="Lật ngang"><FlipHorizontal2 size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ zIndex: stickers.length + 1 })} aria-label="Đưa lên trước" title="Đưa lên trước"><Layers size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={onDuplicateSelectedSticker} aria-label="Nhân bản sticker" title="Nhân bản"><Copy size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={onRemoveSelectedSticker} aria-label="Xóa sticker" title="Xóa"><Trash2 size={16} aria-hidden="true" /></button>
                </div>
              )}
              <div className="sticker-footer"><p className="hint">Chạm để thêm, kéo trực tiếp trên ảnh. Dùng phím mũi tên để căn chính xác.</p>{stickers.length > 0 && <button type="button" onClick={onClearStickers}>Xóa tất cả</button>}</div>
            </section>
          </div>
        )}

        {editorPanelTab === 'background' && (
          <div className="editor-background">
            <section className="control-section collage-section">
              <div className="section-line"><h2>Khổ nền</h2><span className="mono-value">{outputSize.width} × {outputSize.height} px</span></div>
              <div className="collage-formats">
                {COLLAGE_FORMATS.map((item) => <button key={item.id} type="button" className={collageSettings.format === item.id ? 'selected' : ''} onClick={() => onPatchCollage({ format: item.id })}>{item.name}</button>)}
              </div>

              <div className="section-line collage-heading"><h2>Màu & họa tiết</h2><label className="color-picker" title="Chọn màu nền"><input type="color" value={collageSettings.background} onChange={(event) => onPatchCollage({ background: event.target.value })} /><span>Màu tùy chỉnh</span></label></div>
              <div className="background-swatches">
                {COLLAGE_BACKGROUNDS.map((color) => <button key={color} type="button" className={collageSettings.background === color ? 'selected' : ''} style={{ background: color }} onClick={() => onPatchCollage({ background: color })} aria-label={`Chọn màu nền ${color}`} />)}
              </div>
              <div className="section-line collage-heading"><h2>Nền ảnh</h2><span className={remoteBackgroundSource ? 'source online' : 'source'}>{remoteBackgroundSource ? 'Supabase + máy' : 'Trên máy'}</span></div>
              <div className="local-background-grid">
                <button type="button" className={!collageSettings.backgroundImageUrl ? 'selected background-color-only' : 'background-color-only'} onClick={() => onPatchCollage({ backgroundImageUrl: undefined })}><span style={{ background: collageSettings.background }} />Chỉ dùng màu</button>
                {remoteBackgrounds.map((item) => <div className="local-background-option remote" key={item.id}>
                  <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => onPatchCollage({ backgroundImageUrl: item.url })} title={item.name}><img src={item.url} alt="" /><span>{item.name}</span></button>
                </div>)}
                {localBackgrounds.map((item) => <div className="local-background-option" key={item.id}>
                  <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => onPatchCollage({ backgroundImageUrl: item.url })} title={item.name}><img src={item.url} alt="" /><span>{item.name}</span></button>
                  <button type="button" className="delete-background" onClick={() => onRemoveLocalBackground(item)} aria-label={`Xóa nền ${item.name}`}><Trash2 size={13} aria-hidden="true" /></button>
                </div>)}
                <button type="button" className="add-background" onClick={() => backgroundInputRef.current?.click()}><Plus size={16} aria-hidden="true" /> Thêm nền</button>
              </div>
              <input ref={backgroundInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={onAddLocalBackground} />
              <p className="hint compact">PNG, JPG hoặc WebP tối đa 8 MB; ảnh được lưu riêng trong trình duyệt này.</p>
              <div className="pattern-switch" role="group" aria-label="Họa tiết nền">
                {([['solid', 'Trơn'], ['dots', 'Chấm'], ['grid', 'Ô lưới']] as const).map(([value, label]) => <button key={value} type="button" className={collageSettings.pattern === value ? 'selected' : ''} onClick={() => onPatchCollage({ pattern: value })}>{label}</button>)}
              </div>

              <div className="section-line collage-heading"><h2>Lời nhắn trên nền</h2><label className="color-picker" title="Chọn màu chữ"><input type="color" value={collageSettings.messageColor} onChange={(event) => onPatchCollage({ messageColor: event.target.value })} /><span>Màu chữ</span></label></div>
              <div className="caption-field"><input aria-label="Lời nhắn trên nền" value={collageSettings.message} maxLength={80} onChange={(event) => onPatchCollage({ message: event.target.value })} placeholder="Nhập lời nhắn…" /><span className="mono-value">{collageSettings.message.length}/80</span></div>
              <div className="pattern-switch message-position-switch" role="group" aria-label="Vị trí lời nhắn">
                {([['top', 'Phía trên'], ['bottom', 'Phía dưới']] as const).map(([value, label]) => <button key={value} type="button" className={collageSettings.messagePosition === value ? 'selected' : ''} onClick={() => onPatchCollage({ messagePosition: value })}>{label}</button>)}
              </div>

              <div className="section-line collage-heading"><h2>Xếp photobooth</h2><span className="mono-value">{collageSettings.items.length}/{MAX_COLLAGE_ITEMS} bản</span></div>
              <div className="collage-presets">
                <button type="button" onClick={onUseSingleCollage}>Một bản giữa nền</button>
                <button type="button" onClick={onUseTwoStripCollage}>Hai dải chéo</button>
                <button type="button" className="accent" onClick={onDuplicateCollageItem} disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}><Copy size={16} aria-hidden="true" /> Lặp thêm</button>
              </div>

              {selectedCollageItem && (
                <div className="collage-tools">
                  <label>Kích thước<input type="range" min={0.12} max={0.95} step={0.01} value={selectedCollageItem.width} onChange={(event) => onUpdateCollageItem(selectedCollageItem.id, { width: Number(event.target.value) })} /></label>
                  <label>Xoay<input type="range" min={-180} max={180} step={1} value={selectedCollageItem.rotation} onChange={(event) => onUpdateCollageItem(selectedCollageItem.id, { rotation: Number(event.target.value) })} /></label>
                  <div>
                    <button type="button" onClick={() => onUpdateCollageItem(selectedCollageItem.id, { zIndex: Math.max(...collageSettings.items.map((item) => item.zIndex), 0) + 1 })} aria-label="Đưa lên trước" title="Đưa lên trước"><Layers size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={onDuplicateCollageItem} aria-label="Lặp bản đang chọn" title="Lặp bản đang chọn" disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}><Copy size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={() => onRemoveCollageItem(selectedCollageItem.id)} aria-label="Xóa bản đang chọn" title="Xóa bản đang chọn" disabled={collageSettings.items.length <= 1}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              )}
              <p className="hint">Kéo trực tiếp từng bản trên nền. Dùng các nút tròn trên bản được chọn để xoay, xóa hoặc đổi kích thước.</p>
            </section>
          </div>
        )}

        <div className="export-stack">
          {motionClip && (
            <section className="motion-export-card">
              <div>
                <Video size={18} aria-hidden="true" />
                <span>
                  <strong>Khoảnh khắc chuyển động</strong>
                  <small>Tất cả {(captureMode === 'photo-gallery' && candidatePhotos.length ? candidatePhotos : photos).length} ảnh ghép thành GIF, 0,75 giây/ảnh · {(motionClip.durationMs / 1000).toLocaleString('vi-VN')} giây</small>
                </span>
              </div>
              <div>
                <button type="button" onClick={() => downloadMotionBlob(motionClip.gifBlob, 'gif')}>
                  <Download size={15} aria-hidden="true" /> GIF
                </button>
              </div>
            </section>
          )}

          <section className="gallery-export-card">
            <div>
              <span className="gallery-export-icon" aria-hidden="true"><Video size={18} /></span>
              <span>
                <strong>LiveGallery riêng</strong>
                <small>Nhận mã QR để tải ảnh về điện thoại, gắn sticker và ghép nền trên LiveGallery.</small>
              </span>
            </div>
            {galleryShare
              ? (
                <button type="button" className="gallery-ready-button" onClick={onOpenGalleryShare}>
                  <Eye size={16} aria-hidden="true" />
                  <span>Xem QR · <em className="mono-value">{galleryShare.shareCode.toUpperCase()}</em></span>
                </button>
              )
              : (
                <button type="button" className="primary-button" onClick={onPublishGallery} disabled={publishingGallery}>
                  {publishingGallery ? <LoaderCircle className="spin" aria-hidden="true" /> : <ImageIcon size={17} aria-hidden="true" />}
                  <span>{publishingGallery ? 'Đang tạo album…' : 'Tạo mã QR LiveGallery'}</span>
                </button>
              )}
          </section>

          <section className="download-card">
            <div>
              <ImageIcon size={18} aria-hidden="true" />
              <span>
                <strong className="mono-value">{outputSize.width} × {outputSize.height} PX</strong>
                <small>{editorPanelTab === 'background' ? 'Ảnh nền ghép chất lượng cao' : 'Bản in chất lượng cao'}</small>
              </span>
            </div>
            <div className="format-switch" role="group" aria-label="Định dạng file">
              <button type="button" className={format === 'png' ? 'selected' : ''} aria-pressed={format === 'png'} onClick={() => onSelectFormat('png')}>PNG</button>
              <button type="button" className={format === 'jpeg' ? 'selected' : ''} aria-pressed={format === 'jpeg'} onClick={() => onSelectFormat('jpeg')}>JPG</button>
            </div>
            <button type="button" className="primary-button" onClick={onExportPhoto} disabled={exporting}>
              {exporting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
              <span>{exporting ? 'Đang tạo ảnh…' : editorPanelTab === 'background' ? 'Tải ảnh ghép' : 'Tải ảnh về'}</span>
            </button>
          </section>
        </div>
      </div>
    </section>
  )
}
