// 한자 획순 손글씨 연습 — 큐레이션된 글자 목록 (gamification-spec G5).
// 획순 데이터는 public/hanzi-data/{char}.json 에 로컬 번들(오프라인·PWA 안전).
// 렌더링은 hanzi-writer 라이브러리가 담당하고, 여기서는 순수 데이터·헬퍼만 둔다.

export interface HanziEntry {
  char: string
  pinyin: string
  /** 한국어 뜻(짧게). */
  meaning: string
}

// HSK 1~3 수준의 기초·획순 학습용 글자. public/hanzi-data 에 대응 JSON 이 있어야 한다.
export const HANZI_CHARS: readonly HanziEntry[] = [
  { char: '一', pinyin: 'yī', meaning: '하나' },
  { char: '二', pinyin: 'èr', meaning: '둘' },
  { char: '三', pinyin: 'sān', meaning: '셋' },
  { char: '四', pinyin: 'sì', meaning: '넷' },
  { char: '五', pinyin: 'wǔ', meaning: '다섯' },
  { char: '六', pinyin: 'liù', meaning: '여섯' },
  { char: '七', pinyin: 'qī', meaning: '일곱' },
  { char: '八', pinyin: 'bā', meaning: '여덟' },
  { char: '九', pinyin: 'jiǔ', meaning: '아홉' },
  { char: '十', pinyin: 'shí', meaning: '열' },
  { char: '人', pinyin: 'rén', meaning: '사람' },
  { char: '大', pinyin: 'dà', meaning: '크다' },
  { char: '小', pinyin: 'xiǎo', meaning: '작다' },
  { char: '中', pinyin: 'zhōng', meaning: '가운데' },
  { char: '口', pinyin: 'kǒu', meaning: '입' },
  { char: '日', pinyin: 'rì', meaning: '날·해' },
  { char: '月', pinyin: 'yuè', meaning: '달' },
  { char: '木', pinyin: 'mù', meaning: '나무' },
  { char: '水', pinyin: 'shuǐ', meaning: '물' },
  { char: '火', pinyin: 'huǒ', meaning: '불' },
  { char: '山', pinyin: 'shān', meaning: '산' },
  { char: '天', pinyin: 'tiān', meaning: '하늘' },
  { char: '你', pinyin: 'nǐ', meaning: '너' },
  { char: '好', pinyin: 'hǎo', meaning: '좋다' },
  { char: '我', pinyin: 'wǒ', meaning: '나' },
  { char: '是', pinyin: 'shì', meaning: '~이다' },
  { char: '不', pinyin: 'bù', meaning: '아니다' },
  { char: '学', pinyin: 'xué', meaning: '배우다' },
  { char: '国', pinyin: 'guó', meaning: '나라' },
  { char: '爱', pinyin: 'ài', meaning: '사랑' },
] as const

/** 로컬 번들된 획순 데이터 경로. */
export function hanziDataUrl(char: string): string {
  return `/hanzi-data/${encodeURIComponent(char)}.json`
}
