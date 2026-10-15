/**
 * Thin fetch wrapper for the DuckDuckGoose backend API.
 *
 * Every method resolves with the parsed JSON body (or null for empty bodies)
 * and throws ApiError(status, body) on any non-2xx response. `body` is the
 * parsed JSON error payload when the server sent JSON, raw text otherwise.
 */

export class ApiError extends Error {
  constructor(status, body) {
    const detail =
      body && typeof body === 'object' && body.error ? body.error : `HTTP ${status}`
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Human-readable message for any error, ApiError included. Handles the
 * backend's two 4xx shapes: {error: "string"} and {error: [pydantic
 * error dicts]} (PUT /api/settings/profiles validation), plus raw-text
 * bodies (proxies/timeouts).
 */
export function errorMessage(err, fallback = 'request failed') {
  if (err instanceof ApiError) {
    const body = err.body
    if (body && typeof body === 'object' && body.error !== undefined) {
      const detail = body.error
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (!item || typeof item !== 'object') return String(item)
            const loc = Array.isArray(item.loc) ? item.loc.join('.') : ''
            const msg = item.msg || JSON.stringify(item)
            return loc ? `${loc}: ${msg}` : msg
          })
          .join('; ')
      }
    }
    if (typeof body === 'string' && body.trim()) return body.slice(0, 200)
    return `HTTP ${err.status}`
  }
  return err?.message || fallback
}

async function request(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    if (body instanceof FormData) {
      // Leave Content-Type unset so the browser supplies the multipart boundary.
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  const res = await fetch(path, opts)
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  /**
   * Multipart upload. The backend reads `request.files.getlist("files")`,
   * so every file is appended under the `files` field.
   */
  upload: (path, files) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return request(path, { method: 'POST', body: form })
  },
}
