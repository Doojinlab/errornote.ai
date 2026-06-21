import { describe, it, expect } from 'vitest'
import { getLegalLocale, PRIVACY, TERMS } from './legal-content'

describe('getLegalLocale', () => {
  it('passes through supported locales', () => {
    expect(getLegalLocale('en')).toBe('en')
    expect(getLegalLocale('ja')).toBe('ja')
    expect(getLegalLocale('ko')).toBe('ko')
  })
  it('falls back to ko for anything else', () => {
    expect(getLegalLocale('zh')).toBe('ko')
    expect(getLegalLocale('')).toBe('ko')
    expect(getLegalLocale('EN')).toBe('ko')
  })
})

describe('legal documents', () => {
  it('provide ko/en/ja docs with title, updated date, and sections', () => {
    for (const doc of [PRIVACY, TERMS]) {
      for (const locale of ['ko', 'en', 'ja'] as const) {
        const d = doc[locale]
        expect(d.title, `${locale} title`).toBeTruthy()
        expect(d.updated, `${locale} updated`).toBeTruthy()
        expect(Array.isArray(d.sections) && d.sections.length > 0, `${locale} sections`).toBe(true)
      }
    }
  })
})
