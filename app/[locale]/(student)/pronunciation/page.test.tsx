import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import PronunciationPage from './page'

// React 19 act() 환경 플래그.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ── 스캐폴딩 mock (messages/*.json·Provider 편집 없이 렌더 계약만 검증) ──
// t(key) 는 키를 그대로 반환하므로 textContent 에서 i18n 키로 분기를 확인한다.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children?: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// 배럴(@/components/student-ui)은 여러 컴포넌트를 끌어오므로 필요한 LipButton 만 스텁.
vi.mock('@/components/student-ui', () => ({
  LipButton: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}))

// Web Speech 지원 여부는 window.SpeechRecognition 존재로만 판별된다(page.tsx).
type MutableWindow = Record<string, unknown>

function setSpeechSupport(supported: boolean) {
  const w = window as unknown as MutableWindow
  if (supported) {
    // 렌더 중에는 생성자를 호출하지 않으므로 최소 스텁으로 충분.
    w.SpeechRecognition = function SpeechRecognitionStub() {}
  } else {
    delete w.SpeechRecognition
    delete w.webkitSpeechRecognition
  }
}

let activeRoot: Root | null = null
let activeContainer: HTMLDivElement | null = null

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  // act 로 감싸면 마운트 후 useEffect(지원 여부 판별)까지 flush 된다.
  await act(async () => {
    root.render(<PronunciationPage />)
  })
  activeRoot = root
  activeContainer = container
  return container
}

afterEach(async () => {
  if (activeRoot) {
    const root = activeRoot
    await act(async () => {
      root.unmount()
    })
    activeRoot = null
  }
  activeContainer?.remove()
  activeContainer = null
  setSpeechSupport(false)
})

describe('PronunciationPage — Web Speech 지원 분기', () => {
  it('미지원 환경에서는 안내 카드를 렌더한다', async () => {
    setSpeechSupport(false)
    const el = await mount()
    // 지원 여부 판별 effect 후 unsupported 카드가 노출된다.
    expect(el.textContent).toContain('unsupportedTitle')
    expect(el.textContent).toContain('unsupportedBody')
    // 미지원 분기에서는 샘플/입력 UI 를 렌더하지 않는다.
    expect(el.textContent).not.toContain('sampleTextsTitle')
    expect(el.textContent).not.toContain('startRecording')
  })

  it('지원 환경에서는 샘플/녹음 UI 를 렌더하고 안내 카드는 렌더하지 않는다', async () => {
    setSpeechSupport(true)
    const el = await mount()
    expect(el.textContent).toContain('sampleTextsTitle')
    expect(el.textContent).toContain('startRecording')
    expect(el.textContent).not.toContain('unsupportedTitle')
  })

  it('항상 제목과 기록(history) 링크를 렌더한다', async () => {
    setSpeechSupport(true)
    const el = await mount()
    expect(el.querySelector('h1')?.textContent).toBe('title')
    const historyLink = el.querySelector('a[href="/pronunciation/history"]')
    expect(historyLink).not.toBeNull()
  })
})
