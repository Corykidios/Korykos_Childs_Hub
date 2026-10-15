import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError, errorMessage } from '../api.js'

function response(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api.get', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchMock.mockResolvedValue(response({ projects: [{ id: 'proj_1' }] }))
    const data = await api.get('/api/projects')
    expect(data).toEqual({ projects: [{ id: 'proj_1' }] })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/projects')
    expect(opts.method).toBe('GET')
  })

  it('resolves null for an empty body', async () => {
    fetchMock.mockResolvedValue(response(undefined, { status: 204 }))
    const data = await api.get('/api/whatever')
    expect(data).toBeNull()
  })
})

describe('api.post / api.put / api.del', () => {
  it('post sends a JSON body with Content-Type header', async () => {
    fetchMock.mockResolvedValue(response({ id: 'proj_2', name: 'n' }, { status: 201 }))
    const data = await api.post('/api/projects', { name: 'n', question: 'q' })
    expect(data.id).toBe('proj_2')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/projects')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual({ name: 'n', question: 'q' })
  })

  it('post without a body sends no Content-Type and no body', async () => {
    fetchMock.mockResolvedValue(response({ task_id: 't1' }, { status: 202 }))
    await api.post('/api/projects/p/rescan')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.body).toBeUndefined()
    expect(opts.headers['Content-Type']).toBeUndefined()
  })

  it('put sends a JSON body via PUT', async () => {
    fetchMock.mockResolvedValue(response({ ok: true }))
    await api.put('/api/settings/roles', { builder: 'local' })
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toEqual({ builder: 'local' })
  })

  it('del issues DELETE', async () => {
    fetchMock.mockResolvedValue(response({ ok: true }))
    await api.del('/api/settings/profiles/old')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/settings/profiles/old')
    expect(opts.method).toBe('DELETE')
  })
})

describe('error handling', () => {
  it('throws ApiError with status and parsed JSON body on non-2xx', async () => {
    fetchMock.mockResolvedValue(response({ error: 'unknown project' }, { status: 404 }))
    let caught
    try {
      await api.get('/api/projects/nope')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.status).toBe(404)
    expect(caught.body).toEqual({ error: 'unknown project' })
  })

  it('keeps a non-JSON error body as raw text', async () => {
    fetchMock.mockResolvedValue(response('<html>gateway timeout</html>', { status: 504 }))
    let caught
    try {
      await api.get('/api/projects/p/runs/r/interview')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.status).toBe(504)
    expect(caught.body).toBe('<html>gateway timeout</html>')
  })
})

describe('errorMessage', () => {
  it('returns the string error from {error: "…"} bodies', () => {
    const err = new ApiError(404, { error: 'unknown project' })
    expect(errorMessage(err)).toBe('unknown project')
  })

  it('formats pydantic error arrays (PUT /api/settings/profiles 400)', () => {
    const err = new ApiError(400, {
      error: [
        { loc: ['name'], msg: 'String should have at least 1 character', type: 'string_too_short' },
        { loc: ['max_concurrency'], msg: 'Input should be greater than 0', type: 'greater_than' },
      ],
    })
    expect(errorMessage(err)).toBe(
      'name: String should have at least 1 character; max_concurrency: Input should be greater than 0',
    )
  })

  it('passes through (truncated) raw-text bodies', () => {
    const err = new ApiError(504, '<html>gateway timeout</html>')
    expect(errorMessage(err)).toBe('<html>gateway timeout</html>')
    const long = new ApiError(502, 'x'.repeat(500))
    expect(errorMessage(long)).toHaveLength(200)
  })

  it('falls back to HTTP status for empty ApiError bodies', () => {
    expect(errorMessage(new ApiError(500, null))).toBe('HTTP 500')
  })

  it('uses .message for plain errors and the fallback when absent', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(undefined)).toBe('request failed')
    expect(errorMessage(undefined, 'no dice')).toBe('no dice')
  })
})

describe('api.upload', () => {
  it('posts FormData with every file appended under "files" and no manual Content-Type', async () => {
    fetchMock.mockResolvedValue(response({ added: 2, doc_ids: ['d1', 'd2'] }))
    const a = new File(['alpha'], 'a.txt', { type: 'text/plain' })
    const b = new File(['beta'], 'b.md', { type: 'text/markdown' })
    const data = await api.upload('/api/projects/p1/docs', [a, b])
    expect(data.added).toBe(2)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/projects/p1/docs')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeInstanceOf(FormData)
    expect(opts.body.getAll('files')).toHaveLength(2)
    // Content-Type must be left to the browser so the multipart boundary is set.
    expect(opts.headers?.['Content-Type']).toBeUndefined()
  })
})
