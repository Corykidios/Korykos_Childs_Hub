import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TaskProgress from '../components/TaskProgress.vue'

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

describe('TaskProgress', () => {
  it('polls the task, renders bar width + message, and emits done with the final task', async () => {
    const snapshots = [
      { id: 't1', status: 'running', progress: 0.5, message: 'indexed 1/2' },
      { id: 't1', status: 'done', progress: 1.0, message: 'added 2 documents' },
    ]
    let i = 0
    const fetchMock = vi.fn(() =>
      Promise.resolve(taskResponse(snapshots[Math.min(i++, snapshots.length - 1)])),
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(TaskProgress, { props: { taskId: 't1' } })

    await vi.advanceTimersByTimeAsync(0) // immediate first poll
    await nextTick()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tasks/t1')
    expect(wrapper.find('.bar-fill').element.style.width).toBe('50%')
    expect(wrapper.find('.msg').text()).toBe('indexed 1/2')
    expect(wrapper.emitted('done')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(800)
    await nextTick()
    expect(wrapper.find('.bar-fill').element.style.width).toBe('100%')
    expect(wrapper.find('.msg').text()).toBe('added 2 documents')
    expect(wrapper.find('.msg').classes()).toContain('msg-done')

    const done = wrapper.emitted('done')
    expect(done).toHaveLength(1)
    expect(done[0][0]).toMatchObject({ status: 'done', message: 'added 2 documents' })
    expect(wrapper.emitted('failed')).toBeUndefined()
  })

  it('emits failed and shows the failure message in danger text', async () => {
    const snapshots = [
      { id: 't2', status: 'running', progress: 0.3, message: 'scanning folders' },
      { id: 't2', status: 'failed', progress: 0.3, message: 'disk on fire' },
    ]
    let i = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(taskResponse(snapshots[Math.min(i++, snapshots.length - 1)]))),
    )

    const wrapper = mount(TaskProgress, { props: { taskId: 't2' } })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(800)
    await nextTick()

    const failed = wrapper.emitted('failed')
    expect(failed).toHaveLength(1)
    expect(failed[0][0].task).toMatchObject({ status: 'failed' })
    expect(wrapper.find('.msg').classes()).toContain('msg-failed')
    expect(wrapper.find('.msg').text()).toBe('disk on fire')
    expect(wrapper.emitted('done')).toBeUndefined()
  })

  it('emits failed when the task endpoint itself errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, text: async () => '{"error":"unknown task"}' }),
      ),
    )

    const wrapper = mount(TaskProgress, { props: { taskId: 'missing' } })
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(wrapper.emitted('failed')).toHaveLength(1)
    expect(wrapper.find('.msg').classes()).toContain('msg-failed')
  })

  it('stops polling on unmount without emitting', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(taskResponse({ id: 't3', status: 'running', progress: 0.1 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(TaskProgress, { props: { taskId: 't3' } })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(800)
    const callsBefore = fetchMock.mock.calls.length
    expect(callsBefore).toBeGreaterThanOrEqual(2)

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(8000)
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
    expect(wrapper.emitted('done')).toBeUndefined()
    expect(wrapper.emitted('failed')).toBeUndefined()
  })

  it('restarts polling against the new id when taskId changes', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === '/api/tasks/old') {
        return Promise.resolve(taskResponse({ id: 'old', status: 'running', progress: 0.2 }))
      }
      return Promise.resolve(
        taskResponse({ id: 'new', status: 'done', progress: 1.0, message: 'finished' }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(TaskProgress, { props: { taskId: 'old' } })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tasks/old')

    await wrapper.setProps({ taskId: 'new' })
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(fetchMock.mock.calls.at(-1)[0]).toBe('/api/tasks/new')
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('failed')).toBeUndefined() // the cancelled old poll stays silent

    const oldCalls = fetchMock.mock.calls.filter((c) => c[0] === '/api/tasks/old').length
    await vi.advanceTimersByTimeAsync(8000)
    expect(
      fetchMock.mock.calls.filter((c) => c[0] === '/api/tasks/old').length,
    ).toBe(oldCalls)
  })
})
