import { api } from '../api.js'

/**
 * Poll a background task until it settles.
 *
 * Backend task lifecycle: pending -> running -> done | failed
 * (GET /api/tasks/<id> returns {id, kind, status, progress, message, ...}).
 *
 * Returns a Promise that:
 *   - resolves with the final task snapshot when status === 'done'
 *   - rejects with an Error carrying `.task` when status === 'failed'
 *   - rejects with ApiError if the task endpoint itself errors (no retry —
 *     callers that want transient-failure tolerance layer it on top)
 *   - rejects with an Error where `.cancelled === true` when cancelled
 *
 * The returned promise has a `.cancel()` method that stops polling
 * immediately. `onUpdate(task)` fires for every snapshot, including the
 * final one.
 */
export function pollTask(taskId, { interval = 800, onUpdate } = {}) {
  let cancelled = false
  let timer = null
  let rejectFn

  const promise = new Promise((resolve, reject) => {
    rejectFn = reject

    const tick = async () => {
      let task
      try {
        task = await api.get(`/api/tasks/${taskId}`)
      } catch (err) {
        if (!cancelled) reject(err)
        return
      }
      if (cancelled) return
      if (onUpdate) onUpdate(task)
      if (task.status === 'done') {
        resolve(task)
        return
      }
      if (task.status === 'failed') {
        const err = new Error(task.message || 'task failed')
        err.task = task
        reject(err)
        return
      }
      timer = setTimeout(tick, interval)
    }

    tick()
  })

  promise.cancel = () => {
    if (cancelled) return
    cancelled = true
    if (timer !== null) clearTimeout(timer)
    const err = new Error('polling cancelled')
    err.cancelled = true
    rejectFn(err)
  }

  return promise
}
