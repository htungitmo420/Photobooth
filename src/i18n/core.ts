import { enMessages } from './en'
import { ruMessages } from './ru'
import { LOCALE_OPTIONS, type BoothMessages, type Locale } from './types'
import { viMessages } from './vi'

export const LOCALE_STORAGE_KEY = 'khoanhkhac-locale'

const MESSAGES_BY_LOCALE: Record<Locale, BoothMessages> = {
  vi: viMessages,
  en: enMessages,
  ru: ruMessages,
}

const INTL_LOCALE_TAG: Record<Locale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  ru: 'ru-RU',
}

const ERROR_TRANSLATIONS: Record<string, { en: string; ru: string }> = {
  'Trình duyệt này không hỗ trợ truy cập camera.': {
    en: 'This browser does not support camera access.',
    ru: 'Этот браузер не поддерживает доступ к камере.',
  },
  'Không thể mở camera. Hãy thử lại.': {
    en: 'Unable to open camera. Please try again.',
    ru: 'Не удалось открыть камеру. Попробуйте снова.',
  },
  'Bạn chưa cấp quyền camera. Hãy cho phép rồi thử lại.': {
    en: 'Camera permission denied. Please allow access and try again.',
    ru: 'Нет доступа к камере. Разрешите доступ и повторите.',
  },
  'Không tìm thấy camera trên thiết bị này.': {
    en: 'No camera found on this device.',
    ru: 'Камера на этом устройстве не найдена.',
  },
  'Camera đang được ứng dụng khác sử dụng.': {
    en: 'The camera is currently in use by another app.',
    ru: 'Камера занята другим приложением.',
  },
  'Không thể mở camera. Hãy kiểm tra quyền trình duyệt.': {
    en: 'Unable to open camera. Check your browser permissions.',
    ru: 'Не удалось открыть камеру. Проверьте разрешения браузера.',
  },
  'Chưa cấu hình máy chủ LiveGallery.': {
    en: 'LiveGallery server is not configured.',
    ru: 'Сервер LiveGallery не настроен.',
  },
  'Địa chỉ máy chủ LiveGallery không hợp lệ.': {
    en: 'Invalid LiveGallery server URL.',
    ru: 'Некорректный адрес сервера LiveGallery.',
  },
  'Không thể tạo album LiveGallery.': {
    en: 'Could not create LiveGallery album.',
    ru: 'Не удалось создать альбом LiveGallery.',
  },
  'Liên kết album LiveGallery không hợp lệ.': {
    en: 'Invalid LiveGallery album link.',
    ru: 'Некорректная ссылка на альбом LiveGallery.',
  },
  'Phản hồi máy chủ lưu trữ không hợp lệ.': {
    en: 'Invalid storage server response.',
    ru: 'Некорректный ответ сервера хранения.',
  },
  'Tải ảnh lên máy chủ lưu trữ thất bại. Hãy thử lại.': {
    en: 'Uploading photos to storage failed. Please try again.',
    ru: 'Не удалось загрузить фото в хранилище. Попробуйте снова.',
  },
  'Không thể hoàn tất tạo album LiveGallery. Hãy thử lại.': {
    en: 'Could not finalize LiveGallery album. Please try again.',
    ru: 'Не удалось завершить создание альбома LiveGallery. Попробуйте снова.',
  },
  'Bộ nhớ lưu trữ ảnh đã đạt giới hạn tối đa. Tạm ngừng nhận album mới.': {
    en: 'Photo storage has reached its capacity limit. New albums are temporarily paused.',
    ru: 'Хранилище фото заполнено. Приём новых альбомов временно приостановлен.',
  },
  'Thiết bị đã tạo quá nhiều album. Hãy thử lại sau một giờ.': {
    en: 'Too many albums created recently. Please try again in an hour.',
    ru: 'Создано слишком много альбомов. Попробуйте снова через час.',
  },
  'Bộ ảnh vượt quá giới hạn 60 MB.': {
    en: 'Album size exceeds the 60 MB limit.',
    ru: 'Размер альбома превышает лимит 60 МБ.',
  },
  'Frame chỉ nhận file PNG hoặc WebP.': {
    en: 'Frames must be PNG or WebP files.',
    ru: 'Рамки поддерживаются только в формате PNG или WebP.',
  },
  'Frame phải nhỏ hơn 5 MB.': {
    en: 'Frame file must be smaller than 5 MB.',
    ru: 'Размер файла рамки должен быть меньше 5 МБ.',
  },
  'File frame không phải ảnh hợp lệ.': {
    en: 'Selected frame file is not a valid image.',
    ru: 'Выбранный файл рамки не является корректным изображением.',
  },
  'Frame không có đủ ô ảnh trong suốt đúng bố cục này.': {
    en: 'This frame does not have transparent cutouts matching the selected layout.',
    ru: 'В этой рамке нет прозрачных окон, соответствующих выбранному макету.',
  },
  'Nền ghép chỉ nhận file PNG, JPG hoặc WebP.': {
    en: 'Backgrounds must be PNG, JPG, or WebP files.',
    ru: 'Фон должен быть в формате PNG, JPG или WebP.',
  },
  'Ảnh nền phải nhỏ hơn 8 MB.': {
    en: 'Background image must be smaller than 8 MB.',
    ru: 'Размер фонового изображения должен быть меньше 8 МБ.',
  },
  'Ảnh nền cần có kích thước ít nhất 320 × 320 px.': {
    en: 'Background image must be at least 320 × 320 px.',
    ru: 'Минимальный размер фонового изображения — 320 × 320 пикс.',
  },
  'File nền không phải ảnh hợp lệ.': {
    en: 'Selected background file is not a valid image.',
    ru: 'Выбранный файл фона не является корректным изображением.',
  },
  'Không thể tạo canvas xuất ảnh.': {
    en: 'Could not create export canvas.',
    ru: 'Не удалось создать холст для экспорта.',
  },
  'Không thể tạo canvas nền ghép.': {
    en: 'Could not create collage canvas.',
    ru: 'Не удалось создать холст для коллажа.',
  },
  'Không thể mã hóa ảnh.': {
    en: 'Could not encode image.',
    ru: 'Не удалось закодировать изображение.',
  },
  'Cần ít nhất một ảnh để tạo chuyển động.': {
    en: 'At least one photo is required to create an animation.',
    ru: 'Для создания анимации нужен хотя бы один снимок.',
  },
  'Không thể đọc ảnh để tạo chuyển động.': {
    en: 'Could not read photo for animation.',
    ru: 'Не удалось прочитать фото для анимации.',
  },
  'Không thể chuẩn bị ảnh GIF.': {
    en: 'Could not prepare GIF encoder.',
    ru: 'Не удалось подготовить GIF.',
  },
}

export function normalizeLocale(raw: unknown): Locale | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'vi' || normalized.startsWith('vi-')) return 'vi'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru'
  return null
}

export function getInitialLocale(search = typeof window !== 'undefined' ? window.location.search : ''): Locale {
  try {
    const queryLang = normalizeLocale(new URLSearchParams(search).get('lang'))
    if (queryLang) return queryLang
  } catch {
    /* Ignore malformed query string. */
  }
  try {
    const stored = normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
    if (stored) return stored
  } catch {
    /* Storage may be unavailable in restricted contexts. */
  }
  return 'vi'
}

export function getMessages(locale: Locale): BoothMessages {
  return MESSAGES_BY_LOCALE[locale]
}

export function getIntlLocaleTag(locale: Locale): string {
  return INTL_LOCALE_TAG[locale]
}

export function localizeBoothError(message: string, locale: Locale): string {
  if (locale === 'vi') return message
  return ERROR_TRANSLATIONS[message]?.[locale] ?? message
}

export function appendLocaleParam(url: string, locale: Locale): string {
  if (locale === 'vi') return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('lang', locale)
    return parsed.toString()
  } catch {
    return url
  }
}

export { LOCALE_OPTIONS, type BoothMessages, type Locale } from './types'
