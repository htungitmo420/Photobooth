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
import { getIntlLocaleTag } from '../i18n/core'
import { useLocale } from '../i18n/useLocale'
import type { RemoteBackground } from '../lib/backgrounds'
import { COLLAGE_BACKGROUNDS, padFrame } from '../lib/boothUtils'
import type { LocalBackground } from '../lib/localBackgrounds'
import {
  downloadMotionBlob,
  extensionForVideoMime,
  type MotionClip,
} from '../motionCapture'
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
  const { locale, messages } = useLocale()
  const frameInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="editor-layout">
      <div className={`preview-column ${editorPanelTab === 'background' ? 'collage-mode' : ''}`}>
        <div className="preview-column-toolbar">
          <div>
            <p className="eyebrow">{editorPanelTab === 'background' ? messages.editor.collageEyebrow : messages.editor.stripEyebrow}</p>
            <span className="mono-spec">{outputSize.width} × {outputSize.height} PX</span>
          </div>
          <button type="button" className="preview-open-button" onClick={onOpenPreview}>
            <Eye size={16} aria-hidden="true" /> {messages.editor.previewButton}
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
              <span><em className="mono-value">{padFrame(index + 1)}</em> {messages.editor.viewShort}</span>
            </button>
          ))}
          {motionClip && (
            <button type="button" className="motion-review-button" onClick={onOpenMotionPreview}>
              <img src={motionClip.posterUrl} alt={messages.editor.motionAlt} />
              <span><Video size={13} aria-hidden="true" /> LIVE</span>
            </button>
          )}
        </div>
      </div>

      <div className="editor-panel">
        <div className="editor-title">
          <div>
            <p className="eyebrow">{messages.editor.finalStepEyebrow}</p>
            <h1>{messages.editor.title}</h1>
          </div>
          <button type="button" className="text-button new-session-button" onClick={onReset} aria-label={messages.editor.newSessionAria}>
            <RefreshCcw size={15} aria-hidden="true" />
            <span>{messages.editor.newSessionLabel}</span>
          </button>
        </div>
        <div className="editor-tabs editor-tabs-single" role="group" aria-label={messages.editor.tabsAria}>
          <button type="button" aria-pressed="true" className="selected">{messages.editor.designTabLabel}</button>
          <span className="editor-tabs-note">{messages.editor.tabsNote}</span>
        </div>

        {editorPanelTab === 'design' && (
          <div className="editor-design">
            <section className="control-section filter-section">
              <h2>{messages.editor.filtersTitle}</h2>
              <div className="filter-grid">
                {FILTERS.map((item) => (
                  <button key={item.id} type="button" className={filter === item.id ? 'selected' : ''} aria-pressed={filter === item.id} onClick={() => onSelectFilter(item.id)}>
                    <span style={{ filter: item.css }} />
                    <small>{messages.filters[item.id]}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="control-section frame-section">
              <div className="section-line">
                <h2>{messages.editor.framesTitle}</h2>
                <span className={remoteFrames ? 'source online' : 'source'}>
                  {remoteFrames ? messages.editor.sourceRemoteAndLocal : messages.editor.sourceBuiltInAndLocal}
                </span>
              </div>
              <div className="frame-grid">
                {visibleFrames.map((item) => {
                  const frameName = item.source === 'fallback' ? messages.fallbackFrame.name : item.name
                  const frameDesc = item.source === 'fallback' ? messages.fallbackFrame.description : item.description
                  return (
                    <div className="frame-option" key={item.id}>
                      <button type="button" title={frameDesc} className={frame.id === item.id ? 'selected' : ''} aria-pressed={frame.id === item.id} onClick={() => onSelectFrame(item)}>
                        {item.assetUrl ? <img src={item.assetUrl} alt="" /> : <i style={{ background: item.config.background, borderColor: item.config.accent }} />}
                        <span>{frameName}</span>
                      </button>
                      {item.source === 'local' && (
                        <button type="button" className="delete-frame" onClick={() => onRemoveLocalFrame(item)} aria-label={messages.editor.deleteFrameAria(frameName)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}
                <button type="button" className="add-frame" onClick={() => frameInputRef.current?.click()}>
                  <Plus size={16} aria-hidden="true" /> {messages.editor.addFrame}
                </button>
              </div>
              <input ref={frameInputRef} className="visually-hidden" type="file" accept="image/png,image/webp" onChange={onAddLocalFrame} />
              <p className="hint">{messages.editor.frameHint}</p>
            </section>

            <section className="control-section caption-section">
              <h2>{messages.editor.captionTitle}</h2>
              <div className="caption-field">
                <input aria-label={messages.editor.captionAria} value={caption} disabled={Boolean(frame.assetUrl)} maxLength={60} onChange={(event) => onChangeCaption(event.target.value)} placeholder="KHOẢNH KHẮC" />
                <span className="mono-value">{caption.length}/60</span>
              </div>
              <label className="check-line">
                <input type="checkbox" disabled={Boolean(frame.assetUrl)} checked={showDate} onChange={(event) => onToggleShowDate(event.target.checked)} />
                <span>{messages.editor.showDate}</span>
              </label>
              {frame.assetUrl && <p className="hint">{messages.editor.overlayFooterHint}</p>}
            </section>
          </div>
        )}

        {editorPanelTab === 'stickers' && (
          <div className="editor-stickers">
            <section className="control-section sticker-section">
              <div className="section-line">
                <h2>{messages.editor.stickerTitle}</h2>
                <span className="mono-value">
                  {stickers.length}/20 · {remoteStickers ? messages.editor.sourceSupabase : messages.editor.sourceBuiltIn}
                </span>
              </div>
              <div className="sticker-categories">
                {STICKER_CATEGORIES.map((category) => (
                  <button key={category.id} type="button" className={stickerCategory === category.id ? 'selected' : ''} onClick={() => onSelectStickerCategory(category.id)}>
                    {messages.stickerCategories[category.id]}
                  </button>
                ))}
              </div>
              <div className="sticker-library">
                {visibleStickerAssets.map((asset) => (
                  <button key={asset.id} type="button" onClick={() => onAddSticker(asset)} title={asset.name}>
                    {asset.kind === 'image' ? <img src={asset.content} alt={asset.name} loading="lazy" /> : <span>{asset.content}</span>}
                  </button>
                ))}
              </div>
              {selectedSticker && (
                <div className="sticker-tools">
                  <label>{messages.editor.sizeLabel}<input type="range" min={0.06} max={0.36} step={0.01} value={selectedSticker.size} onChange={(event) => onUpdateSelectedSticker({ size: Number(event.target.value) })} /></label>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ rotation: selectedSticker.rotation + 15 })} aria-label={messages.editor.rotateStickerAria} title={messages.editor.rotateTitle}><RotateCw size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ flipX: !selectedSticker.flipX })} aria-label={messages.editor.flipStickerAria} title={messages.editor.flipTitle}><FlipHorizontal2 size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => onUpdateSelectedSticker({ zIndex: stickers.length + 1 })} aria-label={messages.editor.bringFrontAria} title={messages.editor.bringFrontTitle}><Layers size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={onDuplicateSelectedSticker} aria-label={messages.editor.duplicateStickerAria} title={messages.editor.duplicateTitle}><Copy size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={onRemoveSelectedSticker} aria-label={messages.editor.deleteStickerAria} title={messages.editor.deleteTitle}><Trash2 size={16} aria-hidden="true" /></button>
                </div>
              )}
              <div className="sticker-footer">
                <p className="hint">{messages.editor.stickerHint}</p>
                {stickers.length > 0 && <button type="button" onClick={onClearStickers}>{messages.editor.clearAll}</button>}
              </div>
            </section>
          </div>
        )}

        {editorPanelTab === 'background' && (
          <div className="editor-background">
            <section className="control-section collage-section">
              <div className="section-line"><h2>{messages.editor.canvasSizeTitle}</h2><span className="mono-value">{outputSize.width} × {outputSize.height} px</span></div>
              <div className="collage-formats">
                {COLLAGE_FORMATS.map((item) => (
                  <button key={item.id} type="button" className={collageSettings.format === item.id ? 'selected' : ''} onClick={() => onPatchCollage({ format: item.id })}>
                    {messages.collageFormats[item.id]}
                  </button>
                ))}
              </div>

              <div className="section-line collage-heading">
                <h2>{messages.editor.colorAndPatternTitle}</h2>
                <label className="color-picker" title={messages.editor.pickBgColorTitle}>
                  <input type="color" value={collageSettings.background} onChange={(event) => onPatchCollage({ background: event.target.value })} />
                  <span>{messages.editor.customColor}</span>
                </label>
              </div>
              <div className="background-swatches">
                {COLLAGE_BACKGROUNDS.map((color) => (
                  <button key={color} type="button" className={collageSettings.background === color ? 'selected' : ''} style={{ background: color }} onClick={() => onPatchCollage({ background: color })} aria-label={messages.editor.pickColorAria(color)} />
                ))}
              </div>
              <div className="section-line collage-heading">
                <h2>{messages.editor.bgImageTitle}</h2>
                <span className={remoteBackgroundSource ? 'source online' : 'source'}>
                  {remoteBackgroundSource ? messages.editor.sourceRemoteAndLocal : messages.editor.sourceLocalOnly}
                </span>
              </div>
              <div className="local-background-grid">
                <button type="button" className={!collageSettings.backgroundImageUrl ? 'selected background-color-only' : 'background-color-only'} onClick={() => onPatchCollage({ backgroundImageUrl: undefined })}>
                  <span style={{ background: collageSettings.background }} />{messages.editor.colorOnly}
                </button>
                {remoteBackgrounds.map((item) => (
                  <div className="local-background-option remote" key={item.id}>
                    <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => onPatchCollage({ backgroundImageUrl: item.url })} title={item.name}>
                      <img src={item.url} alt="" /><span>{item.name}</span>
                    </button>
                  </div>
                ))}
                {localBackgrounds.map((item) => (
                  <div className="local-background-option" key={item.id}>
                    <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => onPatchCollage({ backgroundImageUrl: item.url })} title={item.name}>
                      <img src={item.url} alt="" /><span>{item.name}</span>
                    </button>
                    <button type="button" className="delete-background" onClick={() => onRemoveLocalBackground(item)} aria-label={messages.editor.deleteBgAria(item.name)}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-background" onClick={() => backgroundInputRef.current?.click()}>
                  <Plus size={16} aria-hidden="true" /> {messages.editor.addBg}
                </button>
              </div>
              <input ref={backgroundInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={onAddLocalBackground} />
              <p className="hint compact">{messages.editor.bgHint}</p>
              <div className="pattern-switch" role="group" aria-label={messages.editor.patternAria}>
                {(['solid', 'dots', 'grid'] as const).map((value) => (
                  <button key={value} type="button" className={collageSettings.pattern === value ? 'selected' : ''} onClick={() => onPatchCollage({ pattern: value })}>
                    {messages.editor.patterns[value]}
                  </button>
                ))}
              </div>

              <div className="section-line collage-heading">
                <h2>{messages.editor.collageMessageTitle}</h2>
                <label className="color-picker" title={messages.editor.pickTextColorTitle}>
                  <input type="color" value={collageSettings.messageColor} onChange={(event) => onPatchCollage({ messageColor: event.target.value })} />
                  <span>{messages.editor.textColor}</span>
                </label>
              </div>
              <div className="caption-field">
                <input aria-label={messages.editor.collageMessageAria} value={collageSettings.message} maxLength={80} onChange={(event) => onPatchCollage({ message: event.target.value })} placeholder={messages.editor.collageMessagePlaceholder} />
                <span className="mono-value">{collageSettings.message.length}/80</span>
              </div>
              <div className="pattern-switch message-position-switch" role="group" aria-label={messages.editor.messagePosAria}>
                {([['top', messages.editor.positionTop], ['bottom', messages.editor.positionBottom]] as const).map(([value, label]) => (
                  <button key={value} type="button" className={collageSettings.messagePosition === value ? 'selected' : ''} onClick={() => onPatchCollage({ messagePosition: value })}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="section-line collage-heading">
                <h2>{messages.editor.arrangeTitle}</h2>
                <span className="mono-value">{messages.editor.stripsUnit(collageSettings.items.length, MAX_COLLAGE_ITEMS)}</span>
              </div>
              <div className="collage-presets">
                <button type="button" onClick={onUseSingleCollage}>{messages.editor.singleCollage}</button>
                <button type="button" onClick={onUseTwoStripCollage}>{messages.editor.twoStripCollage}</button>
                <button type="button" className="accent" onClick={onDuplicateCollageItem} disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}>
                  <Copy size={16} aria-hidden="true" /> {messages.editor.addCopy}
                </button>
              </div>

              {selectedCollageItem && (
                <div className="collage-tools">
                  <label>{messages.editor.sizeLabel}<input type="range" min={0.12} max={0.95} step={0.01} value={selectedCollageItem.width} onChange={(event) => onUpdateCollageItem(selectedCollageItem.id, { width: Number(event.target.value) })} /></label>
                  <label>{messages.editor.rotateLabel}<input type="range" min={-180} max={180} step={1} value={selectedCollageItem.rotation} onChange={(event) => onUpdateCollageItem(selectedCollageItem.id, { rotation: Number(event.target.value) })} /></label>
                  <div>
                    <button type="button" onClick={() => onUpdateCollageItem(selectedCollageItem.id, { zIndex: Math.max(...collageSettings.items.map((item) => item.zIndex), 0) + 1 })} aria-label={messages.editor.bringFrontAria} title={messages.editor.bringFrontTitle}><Layers size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={onDuplicateCollageItem} aria-label={messages.editor.duplicateSelectedAria} title={messages.editor.duplicateSelectedAria} disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}><Copy size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={() => onRemoveCollageItem(selectedCollageItem.id)} aria-label={messages.editor.deleteSelectedAria} title={messages.editor.deleteSelectedAria} disabled={collageSettings.items.length <= 1}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              )}
              <p className="hint">{messages.editor.collageHint}</p>
            </section>
          </div>
        )}

        <div className="export-stack">
          {motionClip && motionClip.videoBlob && (
            <section className="motion-export-card">
              <div>
                <Video size={18} aria-hidden="true" />
                <span>
                  <strong>{messages.editor.movingStripTitle}</strong>
                  <small>
                    {messages.editor.movingStripDesc(
                      (motionClip.durationMs / 1000).toLocaleString(getIntlLocaleTag(locale)),
                    )}
                  </small>
                </span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    downloadMotionBlob(
                      motionClip.videoBlob!,
                      extensionForVideoMime(motionClip.videoMimeType ?? motionClip.videoBlob!.type),
                    )}
                >
                  <Download size={15} aria-hidden="true" />{' '}
                  {extensionForVideoMime(motionClip.videoMimeType ?? motionClip.videoBlob.type).toUpperCase()}
                </button>
              </div>
            </section>
          )}

          <section className="gallery-export-card">
            <div>
              <span className="gallery-export-icon" aria-hidden="true"><Video size={18} /></span>
              <span>
                <strong>{messages.editor.galleryCardTitle}</strong>
                <small>{messages.editor.galleryCardDesc}</small>
              </span>
            </div>
            {galleryShare
              ? (
                <button type="button" className="gallery-ready-button" onClick={onOpenGalleryShare}>
                  <Eye size={16} aria-hidden="true" />
                  <span>{messages.editor.viewQrPrefix} <em className="mono-value">{galleryShare.shareCode.toUpperCase()}</em></span>
                </button>
              )
              : (
                <button type="button" className="primary-button" onClick={onPublishGallery} disabled={publishingGallery}>
                  {publishingGallery ? <LoaderCircle className="spin" aria-hidden="true" /> : <ImageIcon size={17} aria-hidden="true" />}
                  <span>{publishingGallery ? messages.editor.creatingAlbum : messages.editor.createQrButton}</span>
                </button>
              )}
          </section>

          <section className="download-card">
            <div>
              <ImageIcon size={18} aria-hidden="true" />
              <span>
                <strong className="mono-value">{outputSize.width} × {outputSize.height} PX</strong>
                <small>{editorPanelTab === 'background' ? messages.editor.highResCollage : messages.editor.highResStrip}</small>
              </span>
            </div>
            <div className="format-switch" role="group" aria-label={messages.editor.fileFormatAria}>
              <button type="button" className={format === 'png' ? 'selected' : ''} aria-pressed={format === 'png'} onClick={() => onSelectFormat('png')}>PNG</button>
              <button type="button" className={format === 'jpeg' ? 'selected' : ''} aria-pressed={format === 'jpeg'} onClick={() => onSelectFormat('jpeg')}>JPG</button>
            </div>
            <button type="button" className="primary-button" onClick={onExportPhoto} disabled={exporting}>
              {exporting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
              <span>
                {exporting
                  ? messages.editor.creatingImage
                  : editorPanelTab === 'background'
                    ? messages.editor.downloadCollage
                    : messages.editor.downloadStrip}
              </span>
            </button>
          </section>
        </div>
      </div>
    </section>
  )
}
