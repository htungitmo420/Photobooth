export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const concurrency = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0
  let firstError: unknown = null
  let hasFailed = false

  const runWorker = async () => {
    while (!hasFailed) {
      const currentIndex = nextIndex
      if (currentIndex >= items.length) return
      nextIndex += 1
      try {
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      } catch (error) {
        if (!hasFailed) {
          hasFailed = true
          firstError = error
        }
        return
      }
    }
  }

  await Promise.allSettled(Array.from({ length: concurrency }, () => runWorker()))
  if (hasFailed) throw firstError
  return results
}

export function delay(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}
