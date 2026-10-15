import { describe, it, expect } from 'vitest'
import { escapeHtml, renderMarkdown, sanitizeLeakedTokens } from '../md.js'

describe('sanitizeLeakedTokens', () => {
  it('strips chat/format special tokens that cheap models leak', () => {
    expect(sanitizeLeakedTokens('<|im_start|>assistant<|im_end|>Hello there'))
      .toBe('assistantHello there')
    expect(sanitizeLeakedTokens('<｜begin▁of▁sentence｜>Real text')).toBe('Real text')
  })

  it('removes <think> reasoning blocks and orphan tags', () => {
    expect(sanitizeLeakedTokens('<think>let me reason</think>The answer.')).toBe('The answer.')
    expect(sanitizeLeakedTokens('Visible </think> still here')).toBe('Visible still here')
  })

  it('removes leaked tool-call wrappers', () => {
    expect(sanitizeLeakedTokens('<tool_call>{"x":1}</tool_call>Done')).toBe('Done')
  })

  it('leaves ordinary prose and legit angle brackets untouched', () => {
    const ok = 'If a < b and c > d, the deal holds. Email me@x.'
    expect(sanitizeLeakedTokens(ok)).toBe(ok)
    expect(sanitizeLeakedTokens('No tokens here at all.')).toBe('No tokens here at all.')
  })

  it('collapses whitespace left behind and tolerates junk input', () => {
    expect(sanitizeLeakedTokens('a <think>x</think>  b')).toBe('a b')
    expect(sanitizeLeakedTokens(null)).toBe('')
    expect(sanitizeLeakedTokens(42)).toBe('42')
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x" id='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('stringifies null/undefined to empty', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('renderMarkdown', () => {
  it('renders #/##/### headings', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>')
    expect(renderMarkdown('## Sub')).toBe('<h2>Sub</h2>')
    expect(renderMarkdown('### Deep')).toBe('<h3>Deep</h3>')
  })

  it('does not treat #### as a heading', () => {
    expect(renderMarkdown('#### nope')).toBe('<p>#### nope</p>')
  })

  it('renders **bold** and *italic*', () => {
    expect(renderMarkdown('a **b** and *c*')).toBe(
      '<p>a <strong>b</strong> and <em>c</em></p>',
    )
  })

  it('renders _italic_ (report.py failed-section marker)', () => {
    expect(renderMarkdown('_Section generation failed: boom_')).toBe(
      '<p><em>Section generation failed: boom</em></p>',
    )
  })

  it('groups consecutive - items into one list', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('joins adjacent lines into a paragraph and splits on blank lines', () => {
    expect(renderMarkdown('line one\nline two\n\nnext para')).toBe(
      '<p>line one line two</p>\n<p>next para</p>',
    )
  })

  it('separates headings, lists and paragraphs', () => {
    const html = renderMarkdown('## Findings\n- a\n- b\n\ntext after')
    expect(html).toBe('<h2>Findings</h2>\n<ul><li>a</li><li>b</li></ul>\n<p>text after</p>')
  })

  it('neutralizes raw HTML in LLM output — <script> cannot survive', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> world')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML inside headings and list items too', () => {
    expect(renderMarkdown('# <img src=x onerror=alert(1)>')).toBe(
      '<h1>&lt;img src=x onerror=alert(1)&gt;</h1>',
    )
    expect(renderMarkdown('- <b>x</b>')).toBe('<ul><li>&lt;b&gt;x&lt;/b&gt;</li></ul>')
  })

  it('applies inline marks to escaped text (escape-then-mark order)', () => {
    expect(renderMarkdown('**<i>**')).toBe('<p><strong>&lt;i&gt;</strong></p>')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
  })
})
