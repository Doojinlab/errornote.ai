import { describe, it, expect } from 'vitest'
import {
  mapLtiRole,
  deriveLtiEmail,
  resolveOrProvisionIdentity,
  type LtiIdentityParams,
} from './lti-provisioning'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

interface AdminOpts {
  identityLookups?: Array<{ user_id: string } | null>
  existing?: { user_id: string } | null
  getUserResult?: { data: { user: { email?: string } | null } | null }
  createResult?: { data: { user: { id: string } } | null; error: { message: string } | null }
  insertError?: { message: string } | null
}

function makeAdmin(opts: AdminOpts = {}) {
  const calls = {
    createUser: 0,
    createUserArgs: null as unknown,
    profileUpdate: null as unknown,
    insertRow: null as unknown,
    getUserById: 0,
  }
  const lookups = opts.identityLookups ?? [opts.existing ?? null]
  let idx = 0
  const nextLookup = () => {
    const v = lookups[Math.min(idx, lookups.length - 1)]
    idx++
    return v
  }
  const ltiSelect = {
    eq() {
      return this
    },
    maybeSingle() {
      return Promise.resolve({ data: nextLookup(), error: null })
    },
  }
  const admin = {
    from(table: string) {
      if (table === 'lti_identities') {
        return {
          select() {
            return ltiSelect
          },
          insert(row: unknown) {
            calls.insertRow = row
            return Promise.resolve({ error: opts.insertError ?? null })
          },
        }
      }
      if (table === 'profiles') {
        return {
          update(row: unknown) {
            calls.profileUpdate = row
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
      }
      throw new Error('unexpected table ' + table)
    },
    auth: {
      admin: {
        getUserById(id: string) {
          calls.getUserById++
          return Promise.resolve(
            opts.getUserResult ?? { data: { user: { id, email: 'real@school.edu' } } }
          )
        },
        createUser(args: unknown) {
          calls.createUser++
          calls.createUserArgs = args
          return Promise.resolve(
            opts.createResult ?? { data: { user: { id: 'new-user' } }, error: null }
          )
        },
      },
    },
  }
  return { admin: admin as unknown as Admin, calls }
}

const base: LtiIdentityParams = {
  issuer: 'https://canvas.test',
  sub: 'lms-user-1',
  isInstructor: false,
}

describe('mapLtiRole', () => {
  it('instructor=true → professor, false → student', () => {
    expect(mapLtiRole(true)).toBe('professor')
    expect(mapLtiRole(false)).toBe('student')
  })
})

describe('deriveLtiEmail', () => {
  it('결정적이고 예약 도메인 형식이다', () => {
    const a = deriveLtiEmail('https://canvas.test', 'sub-1')
    expect(a).toBe(deriveLtiEmail('https://canvas.test', 'sub-1'))
    expect(a).toMatch(/^lti\+[0-9a-f]{32}@lti\.errornote\.local$/)
  })
  it('sub 가 다르면 이메일도 다르다', () => {
    expect(deriveLtiEmail('https://canvas.test', 'sub-1')).not.toBe(
      deriveLtiEmail('https://canvas.test', 'sub-2')
    )
  })
})

describe('resolveOrProvisionIdentity', () => {
  it('기존 매핑이면 createUser 없이 user_id + 실제 이메일 반환', async () => {
    const { admin, calls } = makeAdmin({
      identityLookups: [{ user_id: 'u1' }],
      getUserResult: { data: { user: { email: 'a@b.edu' } } },
    })
    const res = await resolveOrProvisionIdentity(admin, base)
    expect(res).toEqual({ userId: 'u1', email: 'a@b.edu', created: false })
    expect(calls.createUser).toBe(0)
    expect(calls.getUserById).toBe(1)
  })

  it('신규면 createUser(email_confirm) + profile role(student) + 매핑 insert', async () => {
    const { admin, calls } = makeAdmin({ identityLookups: [null] })
    const res = await resolveOrProvisionIdentity(admin, base)
    expect(res.created).toBe(true)
    expect(res.userId).toBe('new-user')
    expect(res.email).toBe(deriveLtiEmail(base.issuer, base.sub))
    expect(calls.createUser).toBe(1)
    expect((calls.createUserArgs as { email_confirm?: boolean }).email_confirm).toBe(true)
    expect((calls.profileUpdate as { role?: string }).role).toBe('student')
    expect(calls.insertRow).toMatchObject({
      issuer: base.issuer,
      sub: base.sub,
      user_id: 'new-user',
    })
  })

  it('instructor 런치면 profile role=professor', async () => {
    const { admin, calls } = makeAdmin({ identityLookups: [null] })
    await resolveOrProvisionIdentity(admin, { ...base, isInstructor: true })
    expect((calls.profileUpdate as { role?: string }).role).toBe('professor')
  })

  it('플랫폼 제공 이메일이 있으면 그 이메일로 생성', async () => {
    const { admin, calls } = makeAdmin({ identityLookups: [null] })
    const res = await resolveOrProvisionIdentity(admin, { ...base, email: 'student@uni.edu' })
    expect(res.email).toBe('student@uni.edu')
    expect((calls.createUserArgs as { email?: string }).email).toBe('student@uni.edu')
  })

  it('createUser 실패 시 throw', async () => {
    const { admin } = makeAdmin({
      identityLookups: [null],
      createResult: { data: null, error: { message: 'dup' } },
    })
    await expect(resolveOrProvisionIdentity(admin, base)).rejects.toThrow(/사용자 생성 실패/)
  })

  it('동시 런치 unique 충돌이면 재조회로 수렴(created=false)', async () => {
    const { admin } = makeAdmin({
      identityLookups: [null, { user_id: 'raced' }],
      insertError: { message: 'duplicate key' },
      getUserResult: { data: { user: { email: 'r@b.edu' } } },
    })
    const res = await resolveOrProvisionIdentity(admin, base)
    expect(res.userId).toBe('raced')
    expect(res.created).toBe(false)
  })
})
