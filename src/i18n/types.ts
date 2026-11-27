import type { CollageFormatId, CollagePattern } from '../collage'
import type { FilterId, FlashMode, LayoutId, StickerCategory } from '../types'

export type Locale = 'vi' | 'en' | 'ru'

export interface LocaleOption {
  code: Locale
  shortLabel: string
  nativeName: string
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: 'vi', shortLabel: 'VI', nativeName: 'Tiếng Việt' },
  { code: 'en', shortLabel: 'EN', nativeName: 'English' },
  { code: 'ru', shortLabel: 'RU', nativeName: 'Русский' },
] as const

export interface BoothMessages {
  documentTitle: string
  languageSwitcherLabel: string
  topbar: {
    brandAria: string
    progressAria: string
    steps: {
      setup: string
      capture: string
      edit: string
    }
    privacyGallery: string
    privacyLocal: string
    toLight: string
    toDark: string
    lightShort: string
    darkShort: string
    dismissNoticeAria: string
  }
  layouts: Record<LayoutId, { name: string; description: string }>
  filters: Record<FilterId, string>
  fallbackFrame: {
    name: string
    description: string
  }
  collageFormats: Record<CollageFormatId, string>
  stickerCategories: Record<'all' | StickerCategory, string>
  setup: {
    lightTableAria: string
    lightTableTag: string
    framesUnit: string
    heroTitle: string
    heroDesc: string
    specimenAria: (layoutName: string, slots: number) => string
    summaryGallery: (target: number, slots: number) => string
    summaryPhoto: (slots: number) => string
    panelTitle: string
    panelDesc: string
    layoutGroupAria: string
    captureModeLabel: string
    captureModeAria: string
    photoOnlyTitle: string
    photoOnlyDesc: (slots: number) => string
    photoGalleryTitle: string
    photoGalleryDesc: (target: number) => string
    countdownLabel: string
    countdownAria: string
    secondsUnit: string
    soundLabel: string
    flashLabel: string
    flashAria: string
    flashModes: Record<FlashMode, string>
    startCamera: string
    permissionCopy: string
  }
  capture: {
    openingCamera: string
    cameraOff: string
    retry: string
    countdownPrompt: string
    recordingLiveBadge: string
    encodingMotion: string
    pausedTitle: string
    pausedDesc: string
    retakeHud: (frame: string) => string
    frameHud: (current: string, total: string) => string
    flipAria: string
    shutterAria: string
    resumeAria: string
    pauseAria: string
    switchCameraAria: string
    zoomAria: string
    deviceZoomHint: string
    flashGroupAria: string
    flashShort: Record<FlashMode, string>
    cancelCapture: string
    sideTitle: string
    sideBaseDesc: (seconds: number) => string
    sideGalleryExtra: (target: number, slots: number) => string
    cameraDeviceLabel: string
    cameraFallbackLabel: (index: number) => string
    zoomControlLabel: string
    zoomControlAria: string
    zoomWeb: string
    zoomDevice: string
    torchSupported: string
    screenFlashFallback: string
    contactSheetTitle: string
    photoAlt: (index: number) => string
    back: string
  }
  selection: {
    eyebrow: string
    title: (slots: number) => string
    desc: (count: number) => string
    framesUnit: string
    photoAlt: (index: number) => string
    chosenBadge: (order: string) => string
    savedToGalleryBadge: string
    retakeAll: string
    encoding: string
    confirm: string
  }
  editor: {
    collageEyebrow: string
    stripEyebrow: string
    previewButton: string
    viewShort: string
    motionAlt: string
    finalStepEyebrow: string
    title: string
    newSessionAria: string
    newSessionLabel: string
    tabsAria: string
    designTabLabel: string
    tabsNote: string
    filtersTitle: string
    framesTitle: string
    sourceRemoteAndLocal: string
    sourceBuiltInAndLocal: string
    deleteFrameAria: (name: string) => string
    addFrame: string
    frameHint: string
    captionTitle: string
    captionAria: string
    showDate: string
    overlayFooterHint: string
    stickerTitle: string
    sourceSupabase: string
    sourceBuiltIn: string
    sizeLabel: string
    rotateStickerAria: string
    rotateTitle: string
    flipStickerAria: string
    flipTitle: string
    bringFrontAria: string
    bringFrontTitle: string
    duplicateStickerAria: string
    duplicateTitle: string
    deleteStickerAria: string
    deleteTitle: string
    stickerHint: string
    clearAll: string
    canvasSizeTitle: string
    colorAndPatternTitle: string
    pickBgColorTitle: string
    customColor: string
    pickColorAria: (color: string) => string
    bgImageTitle: string
    sourceLocalOnly: string
    colorOnly: string
    deleteBgAria: (name: string) => string
    addBg: string
    bgHint: string
    patternAria: string
    patterns: Record<CollagePattern, string>
    collageMessageTitle: string
    pickTextColorTitle: string
    textColor: string
    collageMessageAria: string
    collageMessagePlaceholder: string
    messagePosAria: string
    positionTop: string
    positionBottom: string
    arrangeTitle: string
    stripsUnit: (count: number, max: number) => string
    singleCollage: string
    twoStripCollage: string
    addCopy: string
    rotateLabel: string
    duplicateSelectedAria: string
    deleteSelectedAria: string
    collageHint: string
    motionCardTitle: string
    motionCardDesc: (count: number, seconds: string) => string
    movingStripTitle: string
    movingStripDesc: (seconds: string) => string
    galleryCardTitle: string
    galleryCardDesc: string
    viewQrPrefix: string
    creatingAlbum: string
    createQrButton: string
    highResCollage: string
    highResStrip: string
    fileFormatAria: string
    creatingImage: string
    downloadCollage: string
    downloadStrip: string
  }
  previews: {
    openStripPreviewAria: string
    stripPreviewAria: string
    updating: string
    frameRenderError: string
    moveStickerAria: (name: string) => string
    rotateStickerAria: (name: string) => string
    deleteStickerAria: (name: string) => string
    resizeStickerAria: (name: string) => string
    collageStageAria: string
    moveCollageItemAria: string
    renderingStrip: string
    rotateCollageAria: string
    deleteCollageItemAria: string
    resizeCollageAria: string
    collageFinalAria: string
    creatingPreview: string
    collageRenderError: string
  }
  modals: {
    finalEyebrow: string
    collagePreviewTitle: string
    stripPreviewTitle: string
    zoomOutAria: string
    zoomInAria: string
    resetZoomAria: string
    closePreviewAria: string
    panAreaAria: string
    zoomHint: string
    capturedPhotoEyebrow: string
    frameCountTitle: (current: string, total: string) => string
    closePhotoAria: string
    capturedPhotoAlt: (index: number) => string
    prevPhotoAria: string
    retakePhoto: (index: number) => string
    nextPhotoAria: string
    motionTitle: string
    movingStripTitle: string
    closeMotionAria: string
    motionAlt: string
    downloadVideo: string
    downloadGif: string
    closeQrAria: string
    galleryReadyEyebrow: string
    galleryReadyTitle: string
    qrAlt: (code: string) => string
    albumCodeLabel: string
    copyCodeTitle: string
    shareInstructionsBeforeHost: string
    shareInstructionsAfterHost: string
    openLiveGallery: string
  }
  notices: {
    tabHiddenPaused: string
    cameraNotReady: string
    captureFailed: string
    keptCapturedPhotos: string
    cancelledCapture: string
    pausedCapture: string
    resumedCapture: string
    maxSelection: (slots: number) => string
    motionCreateFailed: string
    maxStickers: string
    minCollageItems: string
    maxCollageItems: (max: number) => string
    savedLocalFrame: string
    saveLocalFrameFailed: string
    removedLocalFrame: string
    savedLocalBg: string
    saveLocalBgFailed: string
    removedLocalBg: string
    exportedPhoto: string
    exportFailed: string
    notEnoughGalleryPhotos: string
    uploadingGallery: string
    galleryReady: string
    galleryFailed: string
    copiedAlbumCode: string
    albumCodeFallback: (code: string) => string
    defaultAlbumTitle: string
  }
}
