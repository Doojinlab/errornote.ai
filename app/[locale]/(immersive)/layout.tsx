import type { ReactNode } from 'react'
import { SoundProvider } from '@/components/gamification/SoundManager'

/**
 * 몰입형 풀스크린 레이아웃 — 작문·분석 화면(/learn/[chapterId]) 전용.
 *
 * 학생 모바일 셸((student)/layout: max-w-420 + 하단탭)에서 벗어나 뷰포트 전체를
 * 쓰기 위해 별도 라우트 그룹으로 분리했다. 좌우 분할(split-screen) 학습 UI 가
 * 좁은 폭에 짓눌리지 않도록 하기 위함이다.
 *
 * - 인증/역할 가드는 proxy.ts 가 경로(/learn 등)로 이미 처리한다.
 * - LearnClient 의 효과음(useSound)을 위해 SoundProvider 만 제공한다
 *   (게이미피케이션 사운드 디텍터는 이 화면에 불필요하므로 생략).
 */
export default function ImmersiveLayout({ children }: { children: ReactNode }) {
  return <SoundProvider>{children}</SoundProvider>
}
