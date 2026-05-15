import { describe, it, expect } from 'vitest'
import { parseFeed } from '../rss-poll.mjs'

describe('parseFeed — RSS 2.0', () => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Demo Feed</title>
<item>
  <title>First post</title>
  <link>https://example.com/1</link>
  <description>A short summary of the first post.</description>
  <pubDate>Wed, 14 May 2026 18:00:00 GMT</pubDate>
  <guid isPermaLink="false">https://example.com/1</guid>
</item>
<item>
  <title><![CDATA[Second & deeper post]]></title>
  <link>https://example.com/2</link>
  <description><![CDATA[<p>Wrapped in <strong>HTML</strong> and CDATA.</p>]]></description>
  <pubDate>Thu, 15 May 2026 09:30:00 GMT</pubDate>
  <guid>guid-2</guid>
</item>
</channel></rss>`

  it('extracts two items', () => {
    const items = parseFeed(rss)
    expect(items).toHaveLength(2)
  })

  it('keeps the title intact', () => {
    const [first] = parseFeed(rss)
    expect(first.title).toBe('First post')
  })

  it('strips CDATA wrapping and HTML entities', () => {
    const items = parseFeed(rss)
    expect(items[1].title).toBe('Second & deeper post')
  })

  it('strips inline HTML from the description', () => {
    const items = parseFeed(rss)
    expect(items[1].summary).toBe('Wrapped in HTML and CDATA.')
  })

  it('parses pubDate to a Date', () => {
    const [first] = parseFeed(rss)
    expect(first.published_at).toBeInstanceOf(Date)
    expect(first.published_at.toISOString()).toBe('2026-05-14T18:00:00.000Z')
  })

  it('uses the link as guid fallback when guid is missing', () => {
    const minimal = `<rss><channel><item>
      <title>No guid</title>
      <link>https://example.com/x</link>
    </item></channel></rss>`
    const [it] = parseFeed(minimal)
    expect(it.guid).toBe('https://example.com/x')
  })

  it('skips items missing both title and link', () => {
    const broken = `<rss><channel>
      <item><title>has title</title></item>
      <item><link>https://example.com/y</link></item>
      <item><title>OK</title><link>https://example.com/z</link></item>
    </channel></rss>`
    const items = parseFeed(broken)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('OK')
  })
})

describe('parseFeed — Atom', () => {
  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Atom Demo</title>
<entry>
  <title>Atom entry one</title>
  <link href="https://example.com/atom/1"/>
  <id>tag:example.com,2026:1</id>
  <published>2026-05-14T18:00:00Z</published>
  <summary>Summary text.</summary>
</entry>
<entry>
  <title>Atom entry two</title>
  <link rel="alternate" type="text/html" href="https://example.com/atom/2"/>
  <id>tag:example.com,2026:2</id>
  <updated>2026-05-15T09:30:00Z</updated>
  <content>Content body instead of summary.</content>
</entry>
</feed>`

  it('extracts entries', () => {
    expect(parseFeed(atom)).toHaveLength(2)
  })

  it('reads the href attribute as the link', () => {
    const [first] = parseFeed(atom)
    expect(first.link).toBe('https://example.com/atom/1')
  })

  it('uses <id> as the guid', () => {
    const [first] = parseFeed(atom)
    expect(first.guid).toBe('tag:example.com,2026:1')
  })

  it('falls back to <updated> when <published> is absent', () => {
    const items = parseFeed(atom)
    expect(items[1].published_at?.toISOString()).toBe('2026-05-15T09:30:00.000Z')
  })

  it('uses <content> when <summary> is absent', () => {
    const items = parseFeed(atom)
    expect(items[1].summary).toBe('Content body instead of summary.')
  })

  it('tolerates link tags with extra attributes (rel, type)', () => {
    const items = parseFeed(atom)
    expect(items[1].link).toBe('https://example.com/atom/2')
  })
})

describe('parseFeed — edge cases', () => {
  it('returns [] on completely unrelated XML', () => {
    expect(parseFeed('<root><node>hi</node></root>')).toEqual([])
  })

  it('returns [] on empty input', () => {
    expect(parseFeed('')).toEqual([])
  })

  it('caps title at 500 chars and summary at 600 chars', () => {
    const longTitle   = 'A'.repeat(1000)
    const longSummary = 'B'.repeat(1000)
    const xml = `<rss><channel><item>
      <title>${longTitle}</title>
      <link>https://example.com/long</link>
      <description>${longSummary}</description>
    </item></channel></rss>`
    const [it] = parseFeed(xml)
    expect(it.title.length).toBe(500)
    expect(it.summary.length).toBe(600)
  })

  it('handles invalid pubDate by setting published_at to null', () => {
    const xml = `<rss><channel><item>
      <title>Bad date</title>
      <link>https://example.com/baddate</link>
      <pubDate>not a real date</pubDate>
    </item></channel></rss>`
    const [it] = parseFeed(xml)
    expect(it.published_at).toBeNull()
  })

  it('handles empty description by setting summary to null', () => {
    const xml = `<rss><channel><item>
      <title>No body</title>
      <link>https://example.com/nobody</link>
    </item></channel></rss>`
    const [it] = parseFeed(xml)
    expect(it.summary).toBeNull()
  })
})
