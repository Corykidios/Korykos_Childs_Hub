import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollTask } from '../composables/useTask.js'
import { ApiError } from '../api.js'

function taskResponse(task) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(task),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('pollTask', () => {
  it('polls until status done, reporting every snapshot via onUpdate', async () => {
    const snapshots = [
      { id: 't1', status: 'pending', progress: 0, message: '' },
      { id: 't1', status: 'running', progress: 0.5, message: 'indexed 1/2' },
      { id: 't1', status: 'done', progress: 1.0, message: 'added 2 documents' },
    ]
    let i = 0
    const fetchMock = vi.fn(() =>
      Promise.resolve(taskResponse(snapshots[Math.min(i++, snapshots.length - 1)])),
    )
    vi.stubGlobal('fetch', fetchMock)

    const updates = []
    const promise = pollTask('t1', { interval: 800, onUpdate: (t) => updates.push(t.status) })

    await vi.advanceTimersByTimeAsync(0) // immediate first poll
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tasks/t1')

    await vi.advanceTimersByTimeAsync(800)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(800)
    const task = await promise
    expect(task.status).toBe('done')
    expect(task.message).toBe('added 2 documents')
    expect(updates).toEqual(['pending', 'running', 'done'])
  })

  it('waits the full interval between polls (default 800ms)', async () => {
    const snapshots = [
      { id: 't1', status: 'running' },
      { id: 't1', status: 'done' },
    ]
    let i = 0
    const fetchMock = vi.fn(() =>
      Promise.resolve(taskResponse(snapshots[Math.min(i++, snapshots.length - 1)])),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = pollTask('t1')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(799)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(promise).resolves.toMatchObject({ status: 'done' })
  })

  it('rejects when the task fails, carrying the final task', async () => {
    const snapshots = [
      { id: 't2', status: 'running', progress: 0.3, message: '' },
      { id: 't2', status: 'failed', progress: 0.3, message: 'no builder profile' },
    ]
    let i = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(taskResponse(snapshots[Math.min(i++, snapshots.length - 1)]))),
    )

    const promise = pollTask('t2', { interval: 500 })
    const settled = promise.catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(500)

    const err = await settled
    expect(err).toBeInstanceOf(Error)
    expect(err.task.status).toBe('failed')
    expect(err.message).toContain('no builder profile')
  })

  it('cancel() stops polling and rejects with a cancelled flag', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(taskResponse({ id: 't3', status: 'running', progress: 0.1 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = pollTask('t3', { interval: 800 })
    const settled = promise.catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(800)
    const callsBefore = fetchMock.mock.calls.length
    expect(callsBefore).toBeGreaterThanOrEqual(2)

    promise.cancel()
    await vi.advanceTimersByTimeAsync(8000)
    expect(fetchMock.mock.calls.length).toBe(callsBefore)

    const err = await settled
    expect(err.cancelled).toBe(true)
  })

  it('rejects with ApiError if the task endpoint errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, text: async () => '{"error":"unknown task"}' }),
      ),
    )
    const promise = pollTask('missing')
    const settled = promise.catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const err = await settled
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
  })
})
