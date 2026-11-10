export function createPoller(task: () => Promise<void>): () => Promise<void> {
  let inflight = false
  return async () => {
    if (inflight) return
    inflight = true
    try {
      await task()
    } finally {
      inflight = false
    }
  }
}
