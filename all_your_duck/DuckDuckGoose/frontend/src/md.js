/**
 * Minimal hand-rolled markdown renderer for report output, with no
 * dependency. Supports exactly what the report writer emits: # / ## / ###
 * headings, **bold**, *italic* / _italic_ (report.py marks failed sections
 * with _…_), `- ` lists, and paragraphs.
 *
 * SECURITY: the input is raw LLM output. Every line is HTML-escaped FIRST;
 * the only tags in the result are the ones this renderer writes itself.
 */

/**
 * Defensive strip of chat/format special tokens that some models (esp. cheaper
 * ones like V4 Flash) leak into their output — DeepSeek `<｜…｜>` tokens,
 * `<|im_start|>`/`<|im_end|>`/`<|assistant|>`, `<think>…</think>` reasoning
 * blocks, and `<tool_call>…</tool_call>` wrappers. Targets ONLY these specific
 * markers so legit prose and stray `<`/`>` (e.g. "a < b") are left intact.
 * Runs at the render layer, so it never mutates stored data.
 */
export function sanitizeLeakedTokens(text) {
  let s = String(text ?? '')
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '')
  s = s.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
  s = s.replace(/<\/?think>/gi, '')
  s = s.replace(/<\/?tool_call>/gi, '')
  s = s.replace(/<\|[^|>]*\|>/g, '') // <|im_start|>, <|im_end|>, <|assistant|>, …
  s = s.replace(/<｜[^｜>]*｜>/g, '') // fullwidth DeepSeek special tokens
  return s.replace(/[ \t]{2,}/g, ' ').trim()
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/* Inline marks, applied to already-escaped text. Bold first so the *
 * pairs inside ** runs are consumed before the italic pass sees them. */
function inline(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
}

export function renderMarkdown(text) {
  const lines = sanitizeLeakedTokens(text).split(/\r?\n/)
  const out = []
  let list = null // open <ul> items
  let para = null // open paragraph lines

  function closeList() {
    if (list) {
      out.push(`<ul>${list.join('')}</ul>`)
      list = null
    }
  }

  function closePara() {
    if (para) {
      out.push(`<p>${para.join(' ')}</p>`)
      para = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      closeList()
      closePara()
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      closePara()
      const level = heading[1].length
      out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`)
      continue
    }
    if (line.startsWith('- ')) {
      closePara()
      if (!list) list = []
      list.push(`<li>${inline(escapeHtml(line.slice(2)))}</li>`)
      continue
    }
    closeList()
    if (!para) para = []
    para.push(inline(escapeHtml(line)))
  }
  closeList()
  closePara()
  return out.join('\n')
}
