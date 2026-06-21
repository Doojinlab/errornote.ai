import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSoundPreference,
  saveSoundPreference,
  loadStateSnapshot,
  saveStateSnapshot,
  SOUND_STATE_SNAPSHOT_KEY,
} from './sounds'
import { SOUND_DEFAULT_PREFERENCE, SOUND_STORAGE_KEY } from '@/types/sound'

describe('sound preference (localStorage)', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns default when nothing stored', () => {
    expect(loadSoundPreference()).toEqual(SOUND_DEFAULT_PREFERENCE)
  })
  it('round-trips a saved preference', () => {
    saveSoundPreference({ enabled: false })
    expect(loadSoundPreference()).toEqual({ enabled: false })
  })
  it('falls back to default enabled on malformed JSON', () => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, '{not json')
    expect(loadSoundPreference()).toEqual(SOUND_DEFAULT_PREFERENCE)
  })
  it('ignores non-boolean enabled', () => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify({ enabled: 'yes' }))
    expect(loadSoundPreference().enabled).toBe(SOUND_DEFAULT_PREFERENCE.enabled)
  })
})

describe('sound state snapshot', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns null when absent', () => {
    expect(loadStateSnapshot()).toBeNull()
  })
  it('round-trips a valid snapshot and filters non-string badge ids', () => {
    window.localStorage.setItem(
      SOUND_STATE_SNAPSHOT_KEY,
      JSON.stringify({ level: 3, streakDays: 5, earnedBadgeIds: ['a', 2, 'b'] })
    )
    expect(loadStateSnapshot()).toEqual({ level: 3, streakDays: 5, earnedBadgeIds: ['a', 'b'] })
  })
  it('returns null for structurally invalid snapshot', () => {
    window.localStorage.setItem(
      SOUND_STATE_SNAPSHOT_KEY,
      JSON.stringify({ level: 'x', streakDays: 5, earnedBadgeIds: [] })
    )
    expect(loadStateSnapshot()).toBeNull()
  })
  it('saveStateSnapshot persists for a subsequent load', () => {
    saveStateSnapshot({ level: 1, streakDays: 0, earnedBadgeIds: [] })
    expect(loadStateSnapshot()).toEqual({ level: 1, streakDays: 0, earnedBadgeIds: [] })
  })
})
