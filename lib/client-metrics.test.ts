import { describe, it, expect } from 'vitest'
import {
  ALLOWED_METRICS,
  buildMetricPayload,
  isAllowedMetric,
  sanitizeTags,
} from './client-metrics'

describe('client-metrics', () => {
  describe('isAllowedMetric', () => {
    it('accepts whitelisted metric names', () => {
      for (const name of ALLOWED_METRICS) expect(isAllowedMetric(name)).toBe(true)
    })
    it('rejects unknown names and non-strings', () => {
      expect(isAllowedMetric('pwa_random_event')).toBe(false)
      expect(isAllowedMetric('')).toBe(false)
      expect(isAllowedMetric(undefined)).toBe(false)
      expect(isAllowedMetric(42)).toBe(false)
      expect(isAllowedMetric({ name: 'pwa_install_accepted' })).toBe(false)
    })
  })

  describe('sanitizeTags', () => {
    it('keeps scalar string/number values', () => {
      expect(sanitizeTags({ mode: 'install', n: 3 })).toEqual({ mode: 'install', n: 3 })
    })
    it('drops non-scalar and non-finite values', () => {
      expect(sanitizeTags({ a: { x: 1 }, b: [1], c: NaN, d: true, e: null })).toBeUndefined()
    })
    it('returns undefined for non-objects', () => {
      expect(sanitizeTags(undefined)).toBeUndefined()
      expect(sanitizeTags('x')).toBeUndefined()
      expect(sanitizeTags(null)).toBeUndefined()
    })
    it('caps key count at 12 and string length at 64', () => {
      const big: Record<string, string> = {}
      for (let i = 0; i < 20; i++) big['k' + i] = 'v'
      expect(Object.keys(sanitizeTags(big) ?? {})).toHaveLength(12)
      const long = sanitizeTags({ s: 'a'.repeat(200) })
      expect((long?.s as string).length).toBe(64)
    })
  })

  describe('buildMetricPayload', () => {
    it('defaults value to 1 and omits empty tags', () => {
      expect(buildMetricPayload('pwa_install_accepted')).toEqual({
        name: 'pwa_install_accepted',
        value: 1,
      })
    })
    it('includes sanitized tags and custom value', () => {
      expect(buildMetricPayload('pwa_install_prompt_shown', { mode: 'ios-guide' }, 2)).toEqual({
        name: 'pwa_install_prompt_shown',
        value: 2,
        tags: { mode: 'ios-guide' },
      })
    })
  })
})
