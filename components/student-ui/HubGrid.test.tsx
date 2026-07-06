import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Home } from 'lucide-react'
import HubGrid, { type HubLink } from './HubGrid'

// next-intl 의 로케일 인식 <Link> 는 Provider 컨텍스트를 요구하므로,
// 라우팅 계약(href 를 그대로 <a href>)만 재현하는 스텁으로 대체한다.
// (messages/*.json 이나 Provider 스캐폴딩 없이 렌더 계약을 검증하기 위함.)
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

// renderToStaticMarkup 결과를 jsdom DOM 으로 파싱해 구조를 질의한다.
// 클래스명 문자열이 아니라 요소 구조/텍스트/속성만 assert 한다(다른 창이
// className 을 바꾸는 중이므로 스타일에 의존하지 않는다).
function renderGrid(props: { title?: string; links: HubLink[] }): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = renderToStaticMarkup(<HubGrid {...props} />)
  return div
}

const link = (over: Partial<HubLink> & { href: string }): HubLink => ({
  icon: Home,
  title: 'Untitled',
  ...over,
})

describe('HubGrid', () => {
  it('각 링크를 href·제목과 함께 렌더한다', () => {
    const div = renderGrid({
      links: [
        link({ href: '/learn/1', title: '학습' }),
        link({ href: '/errors', title: '오류노트' }),
      ],
    })
    const anchors = Array.from(div.querySelectorAll('a'))
    expect(anchors).toHaveLength(2)
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(['/learn/1', '/errors'])
    expect(div.textContent).toContain('학습')
    expect(div.textContent).toContain('오류노트')
  })

  it('desc 가 있으면 렌더하고, 없으면 렌더하지 않는다', () => {
    const withDesc = renderGrid({ links: [link({ href: '/a', title: 'A', desc: '설명입니다' })] })
    expect(withDesc.textContent).toContain('설명입니다')

    const noDesc = renderGrid({ links: [link({ href: '/a', title: 'A' })] })
    expect(noDesc.textContent).toContain('A')
    expect(noDesc.textContent).not.toContain('설명입니다')
  })

  it('badge 가 있으면 배지 텍스트를 렌더한다', () => {
    const div = renderGrid({
      links: [link({ href: '/notifications', title: '알림', badge: '3' })],
    })
    expect(div.textContent).toContain('3')
  })

  it('badge 가 있으면 바로가기 화살표를 표시하지 않는다', () => {
    // 톤 아이콘(1개) 외에 추가 아이콘(ArrowUpRight)이 없어야 한다.
    const anchor = renderGrid({
      links: [link({ href: '/x', title: 'X', badge: '9+' })],
    }).querySelector('a')!
    expect(anchor.querySelectorAll('svg')).toHaveLength(1)
  })

  it('badge 가 없으면 바로가기 화살표를 표시한다', () => {
    // 톤 아이콘 + ArrowUpRight = svg 2개.
    const anchor = renderGrid({
      links: [link({ href: '/x', title: 'X' })],
    }).querySelector('a')!
    expect(anchor.querySelectorAll('svg')).toHaveLength(2)
  })

  it('links 가 비어 있어도 앵커 없이 안전하게 렌더한다', () => {
    const div = renderGrid({ links: [] })
    expect(div.querySelectorAll('a')).toHaveLength(0)
    // 섹션 컨테이너는 존재한다(그리드 셸은 항상 렌더).
    expect(div.querySelector('section')).not.toBeNull()
  })

  it('title 이 주어지면 제목을 렌더하고, 없으면 렌더하지 않는다', () => {
    const withTitle = renderGrid({ title: '허브 제목', links: [link({ href: '/a', title: 'A' })] })
    expect(withTitle.querySelector('h2')?.textContent).toBe('허브 제목')

    const noTitle = renderGrid({ links: [link({ href: '/a', title: 'A' })] })
    expect(noTitle.querySelector('h2')).toBeNull()
  })

  it('모든 tone 값에 대해 링크와 톤 아이콘을 렌더한다(클래스 미의존)', () => {
    const tones: HubLink['tone'][] = ['blue', 'jade', 'terra', 'gold']
    const div = renderGrid({
      links: tones.map((tone, i) => link({ href: `/t${i}`, title: `T${i}`, tone, badge: 'x' })),
    })
    const anchors = Array.from(div.querySelectorAll('a'))
    expect(anchors).toHaveLength(tones.length)
    // 각 카드에는 톤 아이콘 svg 가 하나씩 있다(배지가 있으므로 화살표는 없음).
    for (const a of anchors) {
      expect(a.querySelectorAll('svg').length).toBe(1)
    }
  })

  it('tone 을 생략해도 정상 렌더한다(기본 tone 폴백)', () => {
    const anchor = renderGrid({ links: [link({ href: '/d', title: 'D', badge: '1' })] }).querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('/d')
    expect(anchor.querySelectorAll('svg')).toHaveLength(1)
  })
})
