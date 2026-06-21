import type { CorpusParseResult, CorpusFileType } from '@/types'

export const MAX_CORPUS_FILE_BYTES = 10 * 1024 * 1024 // 10MB

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function detectFileType(fileName: string): CorpusFileType {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt' || ext === 'text' || ext === 'md') return 'txt'
  throw new Error(`지원하지 않는 파일 형식: .${ext} (pdf, docx, txt만 허용됩니다)`)
}

async function parsePdf(buf: Buffer): Promise<string> {
  // pdf-parse v2 는 PDFParse 클래스 기반 API(pdfjs-dist). Buffer 를 Uint8Array data 로
  // 넘겨 getText() 로 페이지 텍스트를 추출하고, 사용 후 destroy() 로 문서를 해제한다.
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const result = await parser.getText()
    // result.text 는 페이지마다 "-- N of M --" 구분자를 끼워 넣으므로(코퍼스 오염),
    // 마커 없는 페이지별 텍스트(pages[].text)를 직접 이어 붙인다.
    const text = result.pages.map((p) => p.text).join('\n\n')
    return normalizeText(text)
  } finally {
    await parser.destroy()
  }
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: buf })
  return normalizeText(result.value)
}

function toBuffer(input: ArrayBuffer | Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(input)) return input
  if (input instanceof Uint8Array) return Buffer.from(input)
  return Buffer.from(new Uint8Array(input))
}

export async function parseCorpusFile(
  data: ArrayBuffer | Uint8Array | Buffer,
  fileName: string
): Promise<CorpusParseResult> {
  const buf = toBuffer(data)
  if (buf.byteLength > MAX_CORPUS_FILE_BYTES) {
    const sizeMb = (buf.byteLength / 1024 / 1024).toFixed(1)
    throw new Error(`파일 크기가 10MB를 초과합니다 (${sizeMb}MB)`)
  }

  const fileType = detectFileType(fileName)
  let text: string
  if (fileType === 'pdf') {
    text = await parsePdf(buf)
  } else if (fileType === 'docx') {
    text = await parseDocx(buf)
  } else {
    text = normalizeText(buf.toString('utf8'))
  }

  if (!text.trim()) {
    throw new Error('파일에서 텍스트를 추출하지 못했습니다 (빈 내용이거나 스캔 이미지일 수 있습니다)')
  }

  return {
    text,
    fileType,
    byteLength: buf.byteLength,
    charLength: text.length
  }
}
