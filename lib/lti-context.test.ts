import { describe, it, expect } from 'vitest'
import {
  deriveInviteCode,
  resolveClassForContext,
  ensureEnrollment,
  type ContextMapParams,
} from './lti-context'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

interface AdminOpts {
  contextLookups?: Array<{ class_id: string } | null>
  classInsert?: { data: { id: string } | null; error: { message: string } | null }
  linkError?: { message: string } | null
  enrollError?: { message: string } | null
}

function makeAdmin(opts: AdminOpts = {}) {
  const calls = {
    classInsert: null as unknown,
    linkInsert: null as unknown,
    enrollInsert: null as unknown,
  }
  const lookups = opts.contextLookups ?? [null]
  let idx = 0
  const nextLookup = () => lookups[Math.min(idx++, lookups.length - 1)]

  const contextSelect = {
    eq() {
      return this
    },
    maybeSingle() {
      return Promise.resolve({ data: nextLookup(), error: null })
    },
  }

  const admin = {
    from(table: string) {
      if (table === 'lti_context_links') {
        return {
          select() {
            return contextSelect
          },
          insert(row: unknown) {
            calls.linkInsert = row
            return Promise.resolve({ error: opts.linkError ?? null })
          },
        }
      }
      if (table === 'classes') {
        return {
          insert(row: unknown) {
            calls.classInsert = row
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve(
                      opts.classInsert ?? { data: { id: 'class-new' }, error: null }
                    )
                  },
                }
              },
            }
          },
        }
      }
      if (table === 'enrollments') {
        return {
          insert(row: unknown) {
            calls.enrollInsert = row
            return Promise.resolve({ error: opts.enrollError ?? null })
          },
        }
      }
      throw new Error('unexpected table ' + table)
    },
  }
  return { admin: admin as unknown as Admin, calls }
}

const base: ContextMapParams = {
  issuer: 'https://canvas.test',
  contextId: 'ctx-1',
  contextTitle: '중국어 작문',
}

describe('deriveInviteCode', () => {
  it('결정적 8자 대문자 코드', () => {
    const code = deriveInviteCode('https://canvas.test', 'ctx-1')
    expect(code).toBe(deriveInviteCode('https://canvas.test', 'ctx-1'))
    expect(code).toMatch(/^[0-9A-F]{8}$/)
  })
  it('context 가 다르면 코드도 다르다', () => {
    expect(deriveInviteCode('https://canvas.test', 'ctx-1')).not.toBe(
      deriveInviteCode('https://canvas.test', 'ctx-2')
    )
  })
})

describe('resolveClassForContext', () => {
  it('prebound class 가 있으면 그대로 사용(조회 없이)', async () => {
    const { admin } = makeAdmin()
    const res = await resolveClassForContext(
      admin,
      { ...base, preboundClassId: 'pre-1' },
      'u1',
      false
    )
    expect(res).toEqual({ classId: 'pre-1', created: false })
  })

  it('contextId 가 없으면 null', async () => {
    const { admin } = makeAdmin()
    const res = await resolveClassForContext(admin, { ...base, contextId: null }, 'u1', true)
    expect(res.classId).toBeNull()
  })

  it('기존 매핑이 있으면 그 class', async () => {
    const { admin, calls } = makeAdmin({ contextLookups: [{ class_id: 'c-existing' }] })
    const res = await resolveClassForContext(admin, base, 'u1', true)
    expect(res).toEqual({ classId: 'c-existing', created: false })
    expect(calls.classInsert).toBeNull()
  })

  it('교수자 런치 + 매핑 없음 → class 생성 + 링크', async () => {
    const { admin, calls } = makeAdmin({ contextLookups: [null] })
    const res = await resolveClassForContext(admin, base, 'prof-1', true)
    expect(res).toEqual({ classId: 'class-new', created: true })
    expect(calls.classInsert).toMatchObject({
      professor_id: 'prof-1',
      name: '중국어 작문',
      semester: 'LTI',
    })
    expect(calls.linkInsert).toMatchObject({
      issuer: base.issuer,
      context_id: 'ctx-1',
      class_id: 'class-new',
    })
  })

  it('학생 런치 + 매핑 없음 → null(보류, class 생성 안 함)', async () => {
    const { admin, calls } = makeAdmin({ contextLookups: [null] })
    const res = await resolveClassForContext(admin, base, 'stu-1', false)
    expect(res).toEqual({ classId: null, created: false })
    expect(calls.classInsert).toBeNull()
  })

  it('링크 insert 경쟁 충돌 시 재조회로 수렴', async () => {
    const { admin } = makeAdmin({
      contextLookups: [null, { class_id: 'c-raced' }],
      linkError: { message: 'duplicate key' },
    })
    const res = await resolveClassForContext(admin, base, 'prof-1', true)
    expect(res).toEqual({ classId: 'c-raced', created: false })
  })
})

describe('ensureEnrollment', () => {
  it('미등록이면 insert', async () => {
    const { admin, calls } = makeAdmin()
    await ensureEnrollment(admin, 'c1', 'stu-1')
    expect(calls.enrollInsert).toEqual({ class_id: 'c1', student_id: 'stu-1' })
  })

  it('unique 충돌(이미 등록)은 무시', async () => {
    const { admin } = makeAdmin({ enrollError: { message: 'duplicate key value violates unique' } })
    await expect(ensureEnrollment(admin, 'c1', 'stu-1')).resolves.toBeUndefined()
  })

  it('다른 오류는 throw', async () => {
    const { admin } = makeAdmin({ enrollError: { message: 'permission denied' } })
    await expect(ensureEnrollment(admin, 'c1', 'stu-1')).rejects.toThrow(/수강 등록 실패/)
  })
})
