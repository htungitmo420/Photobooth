import { describe, expect, it, vi } from 'vitest'
import indexHtmlRaw from '../index.html?raw'
import vercelJsonRaw from '../vercel.json?raw'
import {
  dataUrlToBlob,
  isSafeRemoteUrl,
  publishGalleryAlbum,
  runWithConcurrency,
  type GalleryPublishInput,
} from '../src/galleryPublish'

const ENDPOINT = 'https://example-project.supabase.co/functions/v1/album-publish'
const PUBLISHABLE_KEY = 'sb_publishable_test_key'

function makeBase64DataUrl(bytes: number[], mimeType = 'image/jpeg') {
  const binary = String.fromCharCode(...bytes)
  return `data:${mimeType};base64,${btoa(binary)}`
}

function makePublishInput(photoCount = 8): GalleryPublishInput {
  const photos = Array.from({ length: photoCount }, (_, index) => ({
    id: `photo-${index + 1}`,
    dataUrl: makeBase64DataUrl([0xff, 0xd8, 0xff, index + 1, 0x10, 0x20, 0x30], 'image/jpeg'),
  }))
  const stripBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: 'image/jpeg' })
  const gifBlob = new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 5, 6])], { type: 'image/gif' })

  return {
    title: '  Đêm tốt nghiệp  ',
    message: '  Chúc mừng bạn!  ',
    layoutId: 'strip4',
    selectedPhotoIds: photos.slice(0, 4).map((photo) => photo.id),
    photos,
    stripBlob,
    motion: {
      videoBlob: null,
      gifBlob,
      videoUrl: null,
      gifUrl: 'blob:gif-preview',
      durationMs: photoCount * 750,
    },
  }
}

function makeR2InitUploads(files: Array<{ role: string; name: string; mimeType: string }>, albumId = 'album-123') {
  return files.map((file, index) => ({
    index,
    role: file.role,
    name: file.name,
    mimeType: file.mimeType,
    putUrl: `https://acct123.r2.cloudflarestorage.com/photobooth-albums/${albumId}/item-${index}?X-Amz-Signature=sig-${index}`,
    storagePath: `r2:${albumId}/item-${index}.${file.role === 'gif' ? 'gif' : 'jpg'}`,
  }))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getHeader(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
    return entry?.[1]
  }
  const foundKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase())
  return foundKey ? headers[foundKey] : undefined
}

describe('isSafeRemoteUrl', () => {
  it('accepts https and localhost http URLs only', () => {
    expect(isSafeRemoteUrl('https://livegallery.vercel.app/i/abc123')).toBe(true)
    expect(isSafeRemoteUrl('https://acct.r2.cloudflarestorage.com/bucket/key')).toBe(true)
    expect(isSafeRemoteUrl('http://localhost:4173/i/abc123')).toBe(true)
    expect(isSafeRemoteUrl('http://127.0.0.1:4173/i/abc123')).toBe(true)
  })

  it('rejects unsafe schemes, non-localhost http, credentials, and malformed URLs', () => {
    expect(isSafeRemoteUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeRemoteUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeRemoteUrl('http://evil.example/i/abc123')).toBe(false)
    expect(isSafeRemoteUrl('http://localhost.evil.example/i/abc123')).toBe(false)
    expect(isSafeRemoteUrl('https://user:pass@livegallery.vercel.app/i/abc123')).toBe(false)
    expect(isSafeRemoteUrl('//livegallery.vercel.app/i/abc123')).toBe(false)
    expect(isSafeRemoteUrl('')).toBe(false)
  })
})

describe('dataUrlToBlob', () => {
  it('decodes base64 image data URLs losslessly with exact bytes and mime type', async () => {
    const raw = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x42, 0x99, 0xaa]
    const blob = dataUrlToBlob(makeBase64DataUrl(raw, 'image/jpeg'))
    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('image/jpeg')
    expect(Array.from(new Uint8Array(await blob!.arrayBuffer()))).toEqual(raw)
  })

  it('returns null for non-data URLs or malformed data URLs', () => {
    expect(dataUrlToBlob('https://example.com/a.jpg')).toBeNull()
    expect(dataUrlToBlob('data:image/jpeg;base64')).toBeNull()
  })
})

describe('runWithConcurrency', () => {
  it('bounds in-flight workers strictly to the configured limit and preserves order', async () => {
    let active = 0
    let maxActive = 0
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8]

    const results = await runWithConcurrency(items, 3, async (item) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => globalThis.setTimeout(resolve, (9 - item) * 2))
      active -= 1
      return item * 10
    })

    expect(maxActive).toBe(3)
    expect(results).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80])
  })
})

describe('publishGalleryAlbum', () => {
  it('completes R2 direct parallel upload with exact file ordering, bounded concurrency (5), and clean headers', async () => {
    const input = makePublishInput(8)
    let initBody: Record<string, unknown> | null = null
    let completeBody: Record<string, unknown> | null = null
    let inFlightPuts = 0
    let maxInFlightPuts = 0
    const putHeadersSeen: Array<Record<string, string | undefined>> = []
    const putSizes: number[] = []

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      const method = init?.method ?? 'GET'

      if (target === ENDPOINT && method === 'POST') {
        expect(getHeader(init?.headers, 'x-photobooth-client')).toBe('web-v1')
        expect(getHeader(init?.headers, 'apikey')).toBe(PUBLISHABLE_KEY)
        const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>

        if (parsed.action === 'init') {
          initBody = parsed
          const uploads = makeR2InitUploads(parsed.files as Array<{ role: string; name: string; mimeType: string }>)
          return jsonResponse({
            mode: 'r2-direct',
            albumId: 'album-123',
            shareCode: 'ab12cd',
            url: 'https://livegallery.vercel.app/i/ab12cd',
            uploadToken: 'hmac-token-xyz',
            uploads,
          })
        }

        if (parsed.action === 'complete') {
          completeBody = parsed
          return jsonResponse({
            shareCode: 'ab12cd',
            url: 'https://livegallery.vercel.app/i/ab12cd',
          }, 201)
        }
      }

      if (target.startsWith('https://acct123.r2.cloudflarestorage.com/') && method === 'PUT') {
        inFlightPuts += 1
        maxInFlightPuts = Math.max(maxInFlightPuts, inFlightPuts)
        putHeadersSeen.push({
          contentType: getHeader(init?.headers, 'content-type'),
          apikey: getHeader(init?.headers, 'apikey'),
          client: getHeader(init?.headers, 'x-photobooth-client'),
        })
        expect(init?.body).toBeInstanceOf(File)
        putSizes.push((init?.body as File).size)
        await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
        inFlightPuts -= 1
        return new Response(null, { status: 200 })
      }

      throw new Error(`Unexpected request: ${method} ${target}`)
    }) as unknown as typeof fetch

    const share = await publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
      retryDelayMs: 0,
    })

    expect(share).toEqual({
      shareCode: 'ab12cd',
      url: 'https://livegallery.vercel.app/i/ab12cd',
    })

    expect(initBody).not.toBeNull()
    expect(initBody).toMatchObject({
      action: 'init',
      title: 'Đêm tốt nghiệp',
      message: 'Chúc mừng bạn!',
      layoutId: 'strip4',
    })
    const initFiles = initBody!.files as Array<{ role: string; name: string; mimeType: string; byteSize: number }>
    expect(initFiles).toHaveLength(10)
    expect(initFiles[0]).toEqual({ role: 'strip', name: 'photobooth.jpg', mimeType: 'image/jpeg', byteSize: 8 })
    expect(initFiles[1]).toEqual({ role: 'gif', name: 'khoanh-khac.gif', mimeType: 'image/gif', byteSize: 8 })
    expect(initFiles[2]).toEqual({ role: 'photo', name: 'anh-01.jpg', mimeType: 'image/jpeg', byteSize: 7 })
    expect(initFiles[9]).toEqual({ role: 'photo', name: 'anh-08.jpg', mimeType: 'image/jpeg', byteSize: 7 })

    // Bounded parallelism: 10 files with default concurrency 5 must run in parallel and never exceed 5
    expect(maxInFlightPuts).toBe(5)
    expect(putSizes).toHaveLength(10)
    expect(putHeadersSeen.every((entry) => Boolean(entry.contentType) && !entry.apikey && !entry.client)).toBe(true)

    expect(completeBody).toMatchObject({
      action: 'complete',
      albumId: 'album-123',
      uploadToken: 'hmac-token-xyz',
    })
    const completeFiles = completeBody!.files as Array<Record<string, unknown>>
    expect(completeFiles).toHaveLength(10)
    expect(completeFiles[0]).toEqual({
      index: 0,
      role: 'strip',
      name: 'photobooth.jpg',
      mimeType: 'image/jpeg',
      storagePath: 'r2:album-123/item-0.jpg',
    })
    expect(completeFiles[1]).toEqual({
      index: 1,
      role: 'gif',
      name: 'khoanh-khac.gif',
      mimeType: 'image/gif',
      storagePath: 'r2:album-123/item-1.gif',
    })
  })

  it('retries once on transient 5xx and network PUT failures and succeeds without aborting', async () => {
    const input = makePublishInput(4)
    const putAttempts = new Map<string, number>()
    let abortCalled = false

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      if (target === ENDPOINT) {
        const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>
        if (parsed.action === 'init') {
          return jsonResponse({
            mode: 'r2-direct',
            albumId: 'album-retry',
            shareCode: 'rt1234',
            url: 'https://livegallery.vercel.app/i/rt1234',
            uploadToken: 'tok-retry',
            uploads: makeR2InitUploads(parsed.files as Array<{ role: string; name: string; mimeType: string }>, 'album-retry'),
          })
        }
        if (parsed.action === 'abort') {
          abortCalled = true
          return jsonResponse({ ok: true })
        }
        if (parsed.action === 'complete') {
          return jsonResponse({ shareCode: 'rt1234', url: 'https://livegallery.vercel.app/i/rt1234' }, 201)
        }
      }

      const attempts = (putAttempts.get(target) ?? 0) + 1
      putAttempts.set(target, attempts)
      if (target.includes('/item-0') && attempts === 1) {
        return new Response('Temporary R2 error', { status: 503 })
      }
      if (target.includes('/item-2') && attempts === 1) {
        throw new TypeError('Failed to fetch')
      }
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const share = await publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
      retryDelayMs: 0,
    })

    expect(share).toEqual({ shareCode: 'rt1234', url: 'https://livegallery.vercel.app/i/rt1234' })
    expect(abortCalled).toBe(false)
    expect(putAttempts.get('https://acct123.r2.cloudflarestorage.com/photobooth-albums/album-retry/item-0?X-Amz-Signature=sig-0')).toBe(2)
    expect(putAttempts.get('https://acct123.r2.cloudflarestorage.com/photobooth-albums/album-retry/item-2?X-Amz-Signature=sig-2')).toBe(2)
  })

  it('sends abort cleanup after in-flight PUTs settle and hides sensitive URLs when a PUT keeps failing', async () => {
    const input = makePublishInput(8)
    let abortPayload: Record<string, unknown> | null = null
    let completeCalled = false
    let activePuts = 0
    let activePutsAtAbort = -1
    let item1Attempts = 0
    let totalStartedPuts = 0

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      if (target === ENDPOINT) {
        const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>
        if (parsed.action === 'init') {
          return jsonResponse({
            mode: 'r2-direct',
            albumId: 'album-fail',
            shareCode: 'fl9999',
            url: 'https://livegallery.vercel.app/i/fl9999',
            uploadToken: 'secret-upload-token',
            uploads: makeR2InitUploads(parsed.files as Array<{ role: string; name: string; mimeType: string }>, 'album-fail'),
          })
        }
        if (parsed.action === 'abort') {
          activePutsAtAbort = activePuts
          abortPayload = parsed
          return jsonResponse({ ok: true })
        }
        if (parsed.action === 'complete') {
          completeCalled = true
          return jsonResponse({ shareCode: 'fl9999', url: 'https://livegallery.vercel.app/i/fl9999' }, 201)
        }
      }

      activePuts += 1
      totalStartedPuts += 1
      try {
        if (target.includes('/item-1')) {
          item1Attempts += 1
          return new Response('Internal R2 failure', { status: 500 })
        }
        await new Promise((resolve) => globalThis.setTimeout(resolve, 15))
        return new Response(null, { status: 200 })
      } finally {
        activePuts -= 1
      }
    }) as unknown as typeof fetch

    let caughtError: Error | null = null
    try {
      await publishGalleryAlbum(input, {
        endpoint: ENDPOINT,
        publishableKey: PUBLISHABLE_KEY,
        fetchFn: fetchMock,
        retryDelayMs: 0,
      })
    } catch (error) {
      caughtError = error as Error
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError!.message).toContain('Tải ảnh lên máy chủ lưu trữ thất bại')
    expect(caughtError!.message).not.toContain('X-Amz-Signature')
    expect(caughtError!.message).not.toContain('secret-upload-token')
    expect(item1Attempts).toBe(2)
    expect(completeCalled).toBe(false)
    expect(activePutsAtAbort).toBe(0)
    expect(totalStartedPuts).toBeLessThan(10)
    expect(abortPayload).toMatchObject({
      action: 'abort',
      albumId: 'album-fail',
      uploadToken: 'secret-upload-token',
    })
    expect((abortPayload!.storagePaths as string[])).toHaveLength(10)
  })

  it('does not retry non-transient 403 PUT failures and still sends abort cleanup', async () => {
    const input = makePublishInput(4)
    let forbiddenAttempts = 0
    let abortCalled = false

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      if (target === ENDPOINT) {
        const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>
        if (parsed.action === 'init') {
          return jsonResponse({
            mode: 'r2-direct',
            albumId: 'album-403',
            shareCode: 'fb4030',
            url: 'https://livegallery.vercel.app/i/fb4030',
            uploadToken: 'tok-403',
            uploads: makeR2InitUploads(parsed.files as Array<{ role: string; name: string; mimeType: string }>, 'album-403'),
          })
        }
        if (parsed.action === 'abort') {
          abortCalled = true
          return jsonResponse({ ok: true })
        }
      }

      if (target.includes('/item-0')) {
        forbiddenAttempts += 1
        return new Response('SignatureDoesNotMatch', { status: 403 })
      }
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    await expect(publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
      retryDelayMs: 0,
    })).rejects.toThrow('Tải ảnh lên máy chủ lưu trữ thất bại')

    expect(forbiddenAttempts).toBe(1)
    expect(abortCalled).toBe(true)
  })

  it('falls back seamlessly to multipart/form-data when init returns mode=multipart', async () => {
    const input = makePublishInput(4)
    let multipartForm: FormData | null = null

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(ENDPOINT)
      if (typeof init?.body === 'string') {
        expect(JSON.parse(init.body)).toMatchObject({ action: 'init', layoutId: 'strip4' })
        return jsonResponse({ mode: 'multipart' }, 200)
      }
      expect(init?.body).toBeInstanceOf(FormData)
      expect(getHeader(init?.headers, 'content-type')).toBeUndefined()
      expect(getHeader(init?.headers, 'x-photobooth-client')).toBe('web-v1')
      multipartForm = init?.body as FormData
      return jsonResponse({
        shareCode: 'mp1234',
        url: 'https://livegallery.vercel.app/i/mp1234',
      }, 201)
    }) as unknown as typeof fetch

    const share = await publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
    })

    expect(share).toEqual({
      shareCode: 'mp1234',
      url: 'https://livegallery.vercel.app/i/mp1234',
    })
    expect(multipartForm).not.toBeNull()
    expect(multipartForm!.get('title')).toBe('Đêm tốt nghiệp')
    expect(multipartForm!.get('message')).toBe('Chúc mừng bạn!')
    expect(multipartForm!.get('layoutId')).toBe('strip4')
    expect(multipartForm!.get('strip')).toBeInstanceOf(File)
    expect(multipartForm!.get('loopGif')).toBeInstanceOf(File)
    expect(multipartForm!.getAll('photos')).toHaveLength(4)
  })

  it.each([400, 415])('falls back seamlessly to multipart/form-data when an older server returns HTTP %i to JSON init', async (status) => {
    const input = makePublishInput(4)
    let callCount = 0

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      callCount += 1
      if (callCount === 1) {
        return jsonResponse({ error: 'Dữ liệu tải lên không hợp lệ.' }, status)
      }
      expect(init?.body).toBeInstanceOf(FormData)
      return jsonResponse({
        shareCode: 'leg123',
        url: 'https://livegallery.vercel.app/i/leg123',
      }, 201)
    }) as unknown as typeof fetch

    const share = await publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
    })

    expect(callCount).toBe(2)
    expect(share).toEqual({
      shareCode: 'leg123',
      url: 'https://livegallery.vercel.app/i/leg123',
    })
  })

  it('does not fall back to multipart on rate-limit 429 or forbidden 403 init responses', async () => {
    const input = makePublishInput(4)
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'Thiết bị đã tạo quá nhiều album.' }, 429)) as unknown as typeof fetch

    await expect(publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
    })).rejects.toThrow('Thiết bị đã tạo quá nhiều album.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malicious javascript: share URLs from complete and multipart responses', async () => {
    const input = makePublishInput(4)

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body === 'string') {
        return jsonResponse({ mode: 'multipart' })
      }
      return jsonResponse({
        shareCode: 'xss123',
        url: 'javascript:alert(document.cookie)',
      }, 201)
    }) as unknown as typeof fetch

    await expect(publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
    })).rejects.toThrow('Liên kết album LiveGallery không hợp lệ.')
  })

  it('rejects unsafe putUrl from init before uploading and triggers best-effort abort', async () => {
    const input = makePublishInput(4)
    let abortCalled = false
    let putCalled = false

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      if (target === ENDPOINT) {
        const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>
        if (parsed.action === 'init') {
          const uploads = makeR2InitUploads(parsed.files as Array<{ role: string; name: string; mimeType: string }>, 'album-badurl')
          uploads[0].putUrl = 'http://evil.example/steal-photo'
          return jsonResponse({
            mode: 'r2-direct',
            albumId: 'album-badurl',
            shareCode: 'bad001',
            url: 'https://livegallery.vercel.app/i/bad001',
            uploadToken: 'tok-bad',
            uploads,
          })
        }
        if (parsed.action === 'abort') {
          abortCalled = true
          return jsonResponse({ ok: true })
        }
      }
      putCalled = true
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    await expect(publishGalleryAlbum(input, {
      endpoint: ENDPOINT,
      publishableKey: PUBLISHABLE_KEY,
      fetchFn: fetchMock,
    })).rejects.toThrow('Phản hồi máy chủ lưu trữ không hợp lệ.')

    expect(putCalled).toBe(false)
    expect(abortCalled).toBe(true)
  })
})

describe('Vercel deployment & CSP configuration integrity', () => {
  it('keeps SPA rewrite, immutable asset caching, and exact inline script CSP SHA-256 hash in sync', async () => {
    const vercelConfig = JSON.parse(vercelJsonRaw) as {
      rewrites: Array<{ source: string; destination: string }>
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    const scriptMatch = indexHtmlRaw.match(/<script>([\s\S]*?)<\/script>/)
    expect(scriptMatch).not.toBeNull()

    const normalizedScript = scriptMatch![1].replace(/\r\n/g, '\n')
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedScript)),
    )
    const base64Digest = btoa(String.fromCharCode(...digest))
    const expectedHash = `sha256-${base64Digest}`

    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/((?!assets/|_vercel/|favicon\\.svg|robots\\.txt).*)',
        destination: '/index.html',
      },
    ])

    const globalRule = vercelConfig.headers.find((entry) => entry.source === '/(.*)')
    expect(globalRule).toBeDefined()
    const headerMap = new Map(globalRule!.headers.map((h) => [h.key, h.value]))
    expect(headerMap.get('Strict-Transport-Security')).toContain('includeSubDomains')
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headerMap.get('X-Frame-Options')).toBe('DENY')
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headerMap.get('Permissions-Policy')).toBe('camera=(self), microphone=(), geolocation=()')

    const csp = headerMap.get('Content-Security-Policy') ?? ''
    expect(csp).toContain(`'${expectedHash}'`)
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain('https://*.r2.cloudflarestorage.com')
    expect(csp).toContain('https://fonts.googleapis.com')
    expect(csp).toContain('https://fonts.gstatic.com')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")

    const assetRule = vercelConfig.headers.find((entry) => entry.source === '/assets/(.*)')
    expect(assetRule?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    })
  })
})
