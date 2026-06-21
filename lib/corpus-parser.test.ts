import { describe, it, expect } from 'vitest'
import { parseCorpusFile, MAX_CORPUS_FILE_BYTES } from './corpus-parser'

const buf = (s: string) => Buffer.from(s, 'utf8')

describe('parseCorpusFile (txt + validation)', () => {
  it('parses a .txt file and normalizes whitespace', async () => {
    const res = await parseCorpusFile(buf('line1\r\n\r\n\r\n\r\nline2  '), 'notes.txt')
    expect(res.fileType).toBe('txt')
    expect(res.text).toBe('line1\n\nline2') // CRLF→LF, 3+ newlines collapsed, trimmed
    expect(res.charLength).toBe(res.text.length)
    expect(res.byteLength).toBeGreaterThan(0)
  })

  it('accepts .md and .text as txt', async () => {
    expect((await parseCorpusFile(buf('hi'), 'a.md')).fileType).toBe('txt')
    expect((await parseCorpusFile(buf('hi'), 'a.text')).fileType).toBe('txt')
  })

  it('rejects unsupported extensions', async () => {
    await expect(parseCorpusFile(buf('x'), 'image.png')).rejects.toThrow(/지원하지 않는/)
  })

  it('rejects files over the size limit', async () => {
    const big = Buffer.alloc(MAX_CORPUS_FILE_BYTES + 1, 0x61)
    await expect(parseCorpusFile(big, 'big.txt')).rejects.toThrow(/10MB/)
  })

  it('rejects empty / whitespace-only content', async () => {
    await expect(parseCorpusFile(buf('   \n  '), 'blank.txt')).rejects.toThrow(/텍스트를 추출/)
  })

  it('accepts Uint8Array and ArrayBuffer inputs', async () => {
    const u8 = new TextEncoder().encode('hello')
    expect((await parseCorpusFile(u8, 'a.txt')).text).toBe('hello')
    expect((await parseCorpusFile(u8.buffer, 'a.txt')).text).toBe('hello')
  })
})
