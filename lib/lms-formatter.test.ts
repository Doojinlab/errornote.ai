import { describe, it, expect } from 'vitest'
import { formatClasses, formatStudents, formatGrades } from './lms-formatter'

describe('formatClasses', () => {
  it('projects raw rows to the LMS shape', () => {
    const out = formatClasses([
      {
        id: 'c1',
        name: '중급 작문',
        semester: '2026-1',
        invite_code: 'ABC',
        is_active: true,
        created_at: 't',
        student_count: 12,
      },
    ])
    expect(out).toEqual([
      {
        id: 'c1',
        name: '중급 작문',
        semester: '2026-1',
        invite_code: 'ABC',
        is_active: true,
        student_count: 12,
        created_at: 't',
      },
    ])
  })
})

describe('formatStudents', () => {
  it('joins enrollments to profiles, null when profile missing', () => {
    const out = formatStudents(
      [
        { student_id: 's1', enrolled_at: 'e1' },
        { student_id: 's2', enrolled_at: 'e2' },
      ],
      [{ id: 's1', name: '홍길동', student_id: '20231234' }]
    )
    expect(out[0]).toEqual({
      id: 's1',
      name: '홍길동',
      student_id: '20231234',
      email: null,
      enrolled_at: 'e1',
    })
    // s2 has no profile → name/student_id null
    expect(out[1].name).toBeNull()
    expect(out[1].student_id).toBeNull()
    expect(out[1].enrolled_at).toBe('e2')
  })
})

describe('formatGrades', () => {
  const profiles = [{ id: 's1', name: '학생', student_id: '2023' }]
  const assignments = [
    { id: 'a1', title: '과제1', prompt_text: 'p', due_date: null, created_at: 't' },
  ]
  it('computes improvement = draft - revision', () => {
    const out = formatGrades(
      [
        {
          id: 'sess1',
          student_id: 's1',
          assignment_id: 'a1',
          draft_error_count: 8,
          revision_error_count: 3,
          created_at: 'now',
        },
      ],
      profiles,
      assignments
    )
    expect(out[0]).toMatchObject({
      student_id: 's1',
      student_name: '학생',
      student_number: '2023',
      assignment_id: 'a1',
      assignment_title: '과제1',
      improvement: 5,
    })
  })
  it('improvement is null when either count is null; blanks for missing joins', () => {
    const out = formatGrades(
      [
        {
          id: 'sess2',
          student_id: 'unknown',
          assignment_id: null,
          draft_error_count: null,
          revision_error_count: 2,
          created_at: 'now',
        },
      ],
      profiles,
      assignments
    )
    expect(out[0].improvement).toBeNull()
    expect(out[0].student_name).toBeNull()
    expect(out[0].assignment_id).toBe('')
    expect(out[0].assignment_title).toBe('')
  })
})
