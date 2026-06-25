# errornote UI 리디자인 작업 지시서 (for Claude Code)

> 중국어 작문 오류 교정 PWA · 주 사용자: 한국 대학생
> 톤: 듀오링고풍 모바일-퍼스트 / 차분하지 않고 친근하게
> 이 문서는 **학생 인터페이스** 기준. 교수자 콘솔은 별도(차분한 데스크톱 톤)로 분리.

---

## 0. 이번 작업의 핵심 2가지

1. **모든 한글 텍스트는 Pretendard로 통일.** (중국어 예문/브랜드만 Noto Serif SC)
2. **모든 카드/박스는 hover 시 "볼록 튀어나오는" 애니메이션.** 그림자가 깊어지면서 살짝 떠오르고 커지는 효과. 누르면 다시 들어감.

그 외에 상단 22개 메뉴를 **하단 4탭**으로 정리한다 (3장 참고).

---

## 1. 전역 설정

### 1.1 폰트 — 한글 Pretendard 강제

**설치 (택1)**

```bash
# 방법 A: npm 패키지 (권장)
npm install pretendard
```

```ts
// app/layout.tsx (또는 _app.tsx) 최상단
import "pretendard/dist/web/variable/pretendardvariable.css";
```

```html
<!-- 방법 B: CDN (빠른 적용용) — app/layout.tsx <head> -->
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
/>
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&display=swap"
  rel="stylesheet"
/>
```

**Tailwind 폰트 등록** — `tailwind.config.ts`

```ts
export default {
  theme: {
    extend: {
      fontFamily: {
        // 기본 = Pretendard. 한글 전부 여기로.
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system", "sans-serif"],
        // 중국어 예문 / 브랜드 글자(误)에만 사용
        cn: ['"Noto Serif SC"', "serif"],
      },
    },
  },
};
```

**전역 강제** — `globals.css`

```css
html, body, button, input, textarea, select {
  font-family: "Pretendard Variable", Pretendard, -apple-system, sans-serif;
}
/* 중국어만 예외 */
.font-cn, [lang="zh"] { font-family: "Noto Serif SC", serif; }
```

> ⚠️ 기존에 폰트가 지정돼 있던 컴포넌트(인라인 style, 다른 font-family)를 모두 찾아 제거할 것. 한글이 시스템 폰트로 새어 나오는 곳이 없도록.

---

### 1.2 hover "볼록" 애니메이션 — 모든 박스 공통

`globals.css` 의 `@layer components` 에 재사용 유틸을 정의하고, **모든 카드/박스에 `card-pop` 클래스를 붙인다.**

```css
@layer components {
  /* 기본 상태: 얕은 그림자 */
  .card-pop {
    transition: transform .2s cubic-bezier(.22,.61,.36,1),
                box-shadow .2s cubic-bezier(.22,.61,.36,1);
    box-shadow: 0 1px 2px rgba(28, 25, 23, .04);
    will-change: transform;
  }
  /* hover: 위로 떠오르며 살짝 커지고 그림자가 깊어짐 */
  .card-pop:hover {
    transform: translateY(-5px) scale(1.018);
    box-shadow: 0 18px 34px rgba(28, 25, 23, .13),
                0 5px 12px rgba(28, 25, 23, .07);
  }
  /* press: 다시 들어감 */
  .card-pop:active {
    transform: translateY(-1px) scale(1.0);
    transition-duration: .08s;
  }
}

/* 모션 최소화 선호 시 효과 제거 (접근성 필수) */
@media (prefers-reduced-motion: reduce) {
  .card-pop, .card-pop:hover, .card-pop:active {
    transform: none;
    transition: none;
  }
}
```

**적용 대상 (전부):** 목표 링 카드, 오늘의 학습 hero 카드, 과제/동료리뷰 미니 카드, 카드뉴스, 레벨 카드, 리그 카드, 배지 칸, 보상 뽑기 카드, 도구 카드, 오류 카드 — **박스 형태면 예외 없이 `card-pop`.**

> 터치 기기에는 hover가 없으므로 `:active` press가 대신 작동(위 정의에 포함됨). 별도 처리 불필요.

**버튼(LipButton)은 hover 시 살짝 더 떠오르게:**

```css
.lip { transition: transform .08s ease, filter .15s ease; }
.lip:hover { filter: brightness(1.04); transform: translateY(-1px); }
.lip:active { transform: translateY(3px); }   /* 입체 버튼 눌림 */
```

---

## 2. 디자인 토큰

`tailwind.config.ts → theme.extend.colors` 에 추가:

```ts
colors: {
  ivory:     "#FAF8F3", // 캔버스 (Hanji Ivory)
  ink:       "#1C1917", // 텍스트/다크
  bodytx:    "#57534E",
  muted:     "#8B847B",
  hairline:  "#EFEAE1",

  blue:      { DEFAULT: "#3B6FB6", dark: "#2E5894", soft: "#EAF1FA" }, // 메인 액션
  jade:      { DEFAULT: "#1D9E75", dark: "#178A66", soft: "#E5F6EF" }, // 성공/교정
  terra:     { DEFAULT: "#D97757", soft: "#FBEEE7" },                  // 오류 표시 전용(≤5%)
  gold:      { DEFAULT: "#E59A35", soft: "#FBF0DC" },                  // 연속학습/트로피
  gem:       { DEFAULT: "#2FB5A6", soft: "#E1F5F2" },                  // 보석
},
borderRadius: { xl2: "20px", xl3: "24px", xl4: "26px" },
```

**색 사용 규칙 (엄수)**
- 메인 CTA = `blue`. Jade = 성공/동료리뷰/교정. **Terracotta는 중국어 오류 마킹·마감 경고에만, 화면의 5% 이하.**
- 연속 학습 불꽃 = `gold`, 보석 = `gem`.
- 인라인 hex 금지. 토큰만 사용.

---

## 3. 정보 구조 — 22개 → 하단 4탭

| 탭 | 들어가는 기능 | 역할 |
|---|---|---|
| **학습** | 오늘의 학습 · 과제 · 동료 리뷰 · 직역 명문장 · 카드뉴스 | 오늘 할 일 허브 |
| **오류** | 오류 기록 · 오류 도감 · 단어장 · 북마크 · 리포트 | 내 약점 복습 |
| **도구** | 번역 · 발음 연습 · URL 분석 | 유틸리티 |
| **성장** | 목표 · 배지 · 주간 리그 · 보상 뽑기 · 포트폴리오 | 동기부여 / 게임 요소 |
| **프로필 ⌄** (상단 아바타) | 알림 설정 · 데이터 내보내기 · 환경 설정 · 언어 | 설정 |

각 탭 내부의 세부 기능은 그 화면 안의 카드/세컨더리 내비로 노출. 상단 가로 메뉴는 **전면 폐기.**

---

## 4. 컴포넌트 스펙

모든 컴포넌트는 함수형 + Tailwind. 박스류엔 `card-pop` 필수.

### `<BottomNav active />`
- 화면 하단 고정, 높이 74px, `bg-white/90 backdrop-blur border-t border-hairline`.
- 4개 아이템(학습/오류/도구/성장), 각 = 아이콘 + 라벨(10px, 700).
- active = `text-blue`, 비활성 = `text-muted`. 라벨 한글 Pretendard.
- 아이콘: lucide-react 사용 (`Home`, `AlertCircle`, `Wrench`, `TrendingUp`).

### `<LipButton variant="blue|jade|gold|white" full? />`
- 듀오링고식 입체 버튼. `rounded-2xl font-extrabold` + 하단 4px 진한 테두리(`border-b-4 border-{variant}-dark`).
- press 시 `translateY(3px)` + border-b-1. (1.2절 `.lip` CSS와 연동)

### `<Card />` (베이스 박스)
- `bg-white border border-hairline rounded-xl3 card-pop`.
- 모든 박스 컴포넌트는 이걸 확장.

### `<StatChip type="flame|gem" value />`
- 둥근 알약. flame=gold, gem=gem 색. 값은 800 굵기.

### `<GoalRing current total />`
- SVG 원형 progress (stroke `jade`). 가운데 `6 /10`.
- 부모 카드는 `card-pop`.

### `<HeroCard />` (오늘의 학습)
- `bg-gradient` blue 계열, 흰 글씨, 우상단 반투명 원 장식.
- 내부 `<LipButton variant="white">시작하기 →</LipButton>`.

### `<MiniCard icon title desc badge />`
- 2-up 그리드. 과제(terra, D-3), 동료리뷰(jade, +10 XP) 등.

### 성장 탭 전용
- `<LevelCard>` : Lv 배지 + XP 바(`bg-gradient blue→gem`) + 남은 XP.
- `<LeagueCard>` : 트로피 + 순위 리스트. 내 행은 `bg-blue-soft` 하이라이트.
- `<BadgeGrid>` : 4열. 획득=골드 그라데이션, 미획득=회색 + 자물쇠.
- `<RewardCard>` : gem 그라데이션, `<LipButton variant="gold">50 보석으로 뽑기</LipButton>`.

---

## 5. 화면 구성

### 학습(홈)
인사("안녕, 두진!") → GoalRing 카드 → HeroCard → 미니 2-up(과제/동료리뷰) → 카드뉴스 가로 스크롤.

### 성장
LevelCard → LeagueCard → BadgeGrid → RewardCard.

### 오류 / 도구
- 오류: 상단 요약(이번 주 수정 개수·정확도) + 오류 카드 리스트(터라코타 취소선 + jade 교정).
- 도구: 오류 검사 / 발음 연습 / URL 분석 카드 3개.

### 빈 상태 재작성 (지금 "활성 수업이 없습니다" 화면)
> 빈 화면 = 행동을 부르는 초대장. 덩그러니 두지 말 것.

- 일러스트/아이콘 + 헤드라인 **"아직 등록된 수업이 없어요"**
- 본문 **"교수자에게 받은 초대코드를 입력하면 바로 시작할 수 있어요."**
- **초대코드 입력 인풋 + `<LipButton variant="blue">수업 등록하기</LipButton>`** 를 중앙 카드(`card-pop`)에 배치.

---

## 6. 작업 순서 (체크리스트)

```
[ ] 1. Pretendard 설치 + 전역 폰트 강제, 기존 font-family 잔재 제거
[ ] 2. tailwind.config 토큰(색/radius/font) 추가
[ ] 3. globals.css 에 .card-pop / .lip 애니메이션 정의
[ ] 4. <Card> 베이스 + <LipButton> 구현
[ ] 5. <BottomNav> 구현, 상단 가로 메뉴 제거
[ ] 6. 학습(홈) 화면 조립
[ ] 7. 성장 화면 조립
[ ] 8. 빈 상태(수업 없음) 재작성
[ ] 9. 오류 / 도구 화면
[ ] 10. 반응형 + 접근성 점검
```

---

## 7. 품질 기준 (반드시 충족)

- **반응형:** 모바일(<640) 우선. 데스크톱에선 폰 폭(max 420px) 중앙 정렬 또는 좌측 사이드바 + 콘텐츠 레이아웃 중 택1.
- **접근성:** 모든 인터랙티브 요소에 키보드 포커스 링, `prefers-reduced-motion` 시 `card-pop`/lip 애니메이션 off(1.2절 포함됨).
- **터치 타깃:** 최소 44px. 하단 탭 아이템은 충분히 넓게.
- **카피:** 시스템 용어 금지, 사용자 언어로. 능동태. 빈 화면/에러는 "무엇을 하면 되는지" 안내.
- **일관성:** hover-pop은 박스에만, lip-press는 버튼에만. 섞지 말 것.

---

### 참고
- 시각 레퍼런스 목업: `errornote-mobile.html` (학습·성장 두 화면) — 색/간격/애니메이션 감 잡는 용도.
- 교수자 콘솔은 이 톤이 아니라 차분한 데스크톱 에디토리얼로 별도 진행.
