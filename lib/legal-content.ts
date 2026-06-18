// #49 — 개인정보처리방침 / 이용약관 본문(ko/en/ja).
//
// 법적 문서 본문은 분량이 커서 messages JSON 대신 별도 모듈로 관리한다.
// 페이지(app/[locale]/(legal)/*)에서 locale 로 선택해 렌더한다.
//
// ⚠️ 운영 전 법률 검토 필요: 사업자/운영주체 정보, 연락처, 보존기간, 위탁업체 목록은
//    실제 운영 정보로 갱신해야 한다. 아래는 현재 구현 기준의 합리적 초안이다.

export type LegalLocale = 'ko' | 'en' | 'ja'

export interface LegalSection {
  heading: string
  /** 단락 또는 불릿. '- ' 로 시작하면 리스트 항목으로 렌더. */
  body: string[]
}

export interface LegalDoc {
  title: string
  updated: string // ISO date, 화면엔 locale 포맷으로 표시
  intro: string
  sections: LegalSection[]
}

const LAST_UPDATED = '2026-06-17'
const CONTACT_EMAIL = 'privacy@errornote.ai'

// ============================================================
// 개인정보처리방침
// ============================================================
export const PRIVACY: Record<LegalLocale, LegalDoc> = {
  ko: {
    title: '개인정보처리방침',
    updated: LAST_UPDATED,
    intro:
      'errornote.ai(이하 "서비스")는 한국 대학 중국어 학습자를 위한 AI 작문 오류 교정 서비스입니다. 본 방침은 서비스가 이용자의 개인정보를 어떻게 수집·이용·보관·파기하는지 설명합니다.',
    sections: [
      {
        heading: '1. 수집하는 개인정보 항목',
        body: [
          '- 계정 정보: 이름, 이메일, 비밀번호(해시), 역할(학생/교수), 학번(학생, 선택)',
          '- 학습 데이터: 제출한 중국어 작문, 오류 카드, 학습 진도·통계, 단어장·퀴즈·목표',
          '- 소셜 로그인 시: Google 계정 식별자 및 이메일',
          '- 알림 연동 시(선택): 카카오 계정 식별자, 웹 푸시 구독 정보',
          '- 자동 수집: 접속 로그, 기기·브라우저 정보, 서비스 이용 기록',
        ],
      },
      {
        heading: '2. 개인정보의 이용 목적',
        body: [
          '- 회원 식별 및 인증, 서비스 제공(작문 분석, 오류 교정, 학습 대시보드)',
          '- 교수자의 수업 운영(반 관리, 과제·루브릭 평가, 집계 리포트)',
          '- 주간 학습 리포트·카드뉴스 및 알림(이메일/웹 푸시/카카오) 발송',
          '- 서비스 개선 및 통계 분석(개인 식별 불가능한 형태)',
        ],
      },
      {
        heading: '3. 처리 위탁 및 제3자 제공',
        body: [
          '서비스는 아래 처리자에게 일부 처리를 위탁합니다. 이용자의 개인정보를 광고 목적으로 제3자에게 판매하지 않습니다.',
          '- Supabase Inc.: 데이터베이스·인증 호스팅',
          '- Anthropic PBC: 작문 분석을 위한 AI 처리(제출 텍스트가 전송됨)',
          '- Vercel Inc.: 애플리케이션 호스팅',
          '- Resend: 이메일 발송(선택 기능)',
          '- Kakao: 알림톡 발송(이용자가 연동한 경우)',
        ],
      },
      {
        heading: '4. 보유 및 파기',
        body: [
          '개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.',
          '학습 데이터는 이용자가 데이터 내보내기/삭제를 요청하면 처리합니다.',
        ],
      },
      {
        heading: '5. 이용자의 권리',
        body: [
          '이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.',
          '서비스 내 데이터 내보내기 기능으로 본인 학습 데이터를 내려받을 수 있습니다.',
        ],
      },
      {
        heading: '6. 안전성 확보 조치',
        body: [
          '- 비밀번호 단방향 해시, 전송 구간 TLS 암호화',
          '- 행 수준 보안(RLS)으로 이용자 간 데이터 격리',
          '- 외부 연동 토큰(카카오 등)은 암호화 저장',
        ],
      },
      {
        heading: '7. 문의처',
        body: [`개인정보 관련 문의: ${CONTACT_EMAIL}`],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: LAST_UPDATED,
    intro:
      'errornote.ai ("the Service") is an AI-powered Chinese writing error-correction service for Korean university learners. This policy explains how the Service collects, uses, stores, and deletes your personal data.',
    sections: [
      {
        heading: '1. Data We Collect',
        body: [
          '- Account: name, email, password (hashed), role (student/professor), student ID (optional)',
          '- Learning data: submitted Chinese writing, error cards, progress and statistics, vocabulary, quizzes, goals',
          '- Social login: Google account identifier and email',
          '- Optional notifications: Kakao account identifier, web push subscription',
          '- Automatically collected: access logs, device/browser info, usage records',
        ],
      },
      {
        heading: '2. How We Use Data',
        body: [
          '- Authentication and core service (writing analysis, error correction, dashboards)',
          '- Professor class operations (class management, assignment/rubric grading, aggregate reports)',
          '- Weekly reports, card news, and notifications (email/web push/Kakao)',
          '- Service improvement and analytics (in non-identifiable form)',
        ],
      },
      {
        heading: '3. Processors and Third Parties',
        body: [
          'We use the processors below. We do not sell your personal data to third parties for advertising.',
          '- Supabase Inc.: database and authentication hosting',
          '- Anthropic PBC: AI processing for writing analysis (submitted text is sent)',
          '- Vercel Inc.: application hosting',
          '- Resend: email delivery (optional)',
          '- Kakao: notification delivery (if you connect it)',
        ],
      },
      {
        heading: '4. Retention and Deletion',
        body: [
          'We delete personal data without delay upon account closure, except where retention is required by law.',
          'Learning data is exported or deleted upon your request.',
        ],
      },
      {
        heading: '5. Your Rights',
        body: [
          'You may request access, correction, deletion, or restriction of your personal data at any time.',
          'You can download your learning data via the in-app data export feature.',
        ],
      },
      {
        heading: '6. Security Measures',
        body: [
          '- One-way password hashing and TLS encryption in transit',
          '- Row-Level Security (RLS) isolating data between users',
          '- Encryption at rest for external integration tokens (e.g., Kakao)',
        ],
      },
      {
        heading: '7. Contact',
        body: [`Privacy inquiries: ${CONTACT_EMAIL}`],
      },
    ],
  },
  ja: {
    title: 'プライバシーポリシー',
    updated: LAST_UPDATED,
    intro:
      'errornote.ai（以下「本サービス」）は、韓国の大学で中国語を学ぶ学習者向けのAI作文エラー添削サービスです。本ポリシーは、本サービスが利用者の個人情報をどのように収集・利用・保管・削除するかを説明します。',
    sections: [
      {
        heading: '1. 収集する個人情報',
        body: [
          '- アカウント情報：氏名、メール、パスワード（ハッシュ）、役割（学生/教員）、学籍番号（任意）',
          '- 学習データ：提出した中国語作文、エラーカード、進捗・統計、単語帳・クイズ・目標',
          '- ソーシャルログイン時：Googleアカウント識別子およびメール',
          '- 通知連携時（任意）：Kakaoアカウント識別子、Webプッシュ購読情報',
          '- 自動収集：アクセスログ、端末・ブラウザ情報、利用履歴',
        ],
      },
      {
        heading: '2. 利用目的',
        body: [
          '- 本人確認・認証、コア機能の提供（作文分析、エラー添削、ダッシュボード）',
          '- 教員のクラス運営（クラス管理、課題・ルーブリック評価、集計レポート）',
          '- 週次レポート・カードニュース・通知（メール/Webプッシュ/Kakao）の配信',
          '- サービス改善および統計分析（個人を識別できない形式）',
        ],
      },
      {
        heading: '3. 委託および第三者提供',
        body: [
          '以下の事業者に処理の一部を委託します。広告目的で個人情報を第三者に販売しません。',
          '- Supabase Inc.：データベース・認証のホスティング',
          '- Anthropic PBC：作文分析のためのAI処理（提出テキストが送信されます）',
          '- Vercel Inc.：アプリケーションのホスティング',
          '- Resend：メール配信（任意）',
          '- Kakao：通知配信（連携した場合）',
        ],
      },
      {
        heading: '4. 保有および削除',
        body: [
          '退会時に個人情報を遅滞なく削除します。ただし法令により保存が必要な場合はその期間保管します。',
          '学習データは利用者の請求に応じてエクスポート・削除します。',
        ],
      },
      {
        heading: '5. 利用者の権利',
        body: [
          '利用者はいつでも自己の個人情報の閲覧・訂正・削除・処理停止を請求できます。',
          'アプリ内のデータエクスポート機能で学習データをダウンロードできます。',
        ],
      },
      {
        heading: '6. 安全管理措置',
        body: [
          '- パスワードの一方向ハッシュ、通信区間のTLS暗号化',
          '- 行レベルセキュリティ（RLS）による利用者間のデータ分離',
          '- 外部連携トークン（Kakao等）の暗号化保存',
        ],
      },
      {
        heading: '7. お問い合わせ',
        body: [`個人情報に関するお問い合わせ：${CONTACT_EMAIL}`],
      },
    ],
  },
}

// ============================================================
// 이용약관
// ============================================================
export const TERMS: Record<LegalLocale, LegalDoc> = {
  ko: {
    title: '이용약관',
    updated: LAST_UPDATED,
    intro:
      '본 약관은 errornote.ai(이하 "서비스") 이용에 관한 조건을 정합니다. 서비스에 가입하거나 이용함으로써 본 약관에 동의한 것으로 봅니다.',
    sections: [
      {
        heading: '1. 서비스 내용',
        body: [
          '서비스는 AI를 활용한 중국어 작문 오류 분석·교정, 학습 관리, 교수자 대시보드 및 관련 기능을 제공합니다.',
          'AI가 생성한 분석·피드백은 학습 보조 목적이며 정확성을 보장하지 않습니다.',
        ],
      },
      {
        heading: '2. 계정',
        body: [
          '이용자는 정확한 정보로 가입하고 계정 보안을 유지할 책임이 있습니다.',
          '교수자 계정은 담당 수업의 학생 데이터를 열람할 수 있으며, 이를 교육 목적으로만 사용해야 합니다.',
        ],
      },
      {
        heading: '3. 금지 행위',
        body: [
          '- 타인의 계정 도용 또는 무단 접근',
          '- 서비스의 정상 운영 방해, 자동화된 대량 요청',
          '- 불법·유해 콘텐츠 제출, 타인의 권리 침해',
          '- 역공학, 무단 복제·재배포',
        ],
      },
      {
        heading: '4. 지식재산권',
        body: [
          '서비스 및 관련 소프트웨어·디자인의 권리는 운영자에게 있습니다.',
          '이용자가 제출한 작문의 권리는 이용자에게 있으며, 서비스는 기능 제공에 필요한 범위에서 이를 처리합니다.',
        ],
      },
      {
        heading: '5. 면책',
        body: [
          '서비스는 "있는 그대로" 제공되며, 학습 결과나 AI 피드백의 정확성·완전성을 보장하지 않습니다.',
          '천재지변, 외부 서비스 장애 등 운영자의 합리적 통제를 벗어난 사유로 인한 손해에 대해 책임지지 않습니다.',
        ],
      },
      {
        heading: '6. 해지',
        body: [
          '이용자는 언제든지 탈퇴할 수 있습니다.',
          '운영자는 본 약관 위반 시 사전 통지 후(긴급 시 사후) 이용을 제한하거나 계정을 해지할 수 있습니다.',
        ],
      },
      {
        heading: '7. 준거법',
        body: ['본 약관은 대한민국 법률에 따라 해석되며, 분쟁은 관할 법원에 따릅니다.'],
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: LAST_UPDATED,
    intro:
      'These Terms govern your use of errornote.ai ("the Service"). By signing up for or using the Service, you agree to these Terms.',
    sections: [
      {
        heading: '1. The Service',
        body: [
          'The Service provides AI-assisted Chinese writing error analysis and correction, learning management, professor dashboards, and related features.',
          'AI-generated analysis and feedback are for learning assistance and are not guaranteed to be accurate.',
        ],
      },
      {
        heading: '2. Accounts',
        body: [
          'You must register with accurate information and keep your account secure.',
          'Professor accounts may view student data for their classes and must use it for educational purposes only.',
        ],
      },
      {
        heading: '3. Prohibited Conduct',
        body: [
          '- Impersonating others or unauthorized access',
          '- Disrupting the Service or automated bulk requests',
          '- Submitting illegal/harmful content or infringing others’ rights',
          '- Reverse engineering, unauthorized copying or redistribution',
        ],
      },
      {
        heading: '4. Intellectual Property',
        body: [
          'Rights in the Service and its software/design belong to the operator.',
          'You retain rights in the writing you submit; the Service processes it only as needed to provide features.',
        ],
      },
      {
        heading: '5. Disclaimer',
        body: [
          'The Service is provided "as is" without warranty of accuracy or completeness of results or AI feedback.',
          'The operator is not liable for damages from causes beyond its reasonable control, including outages of external services.',
        ],
      },
      {
        heading: '6. Termination',
        body: [
          'You may close your account at any time.',
          'The operator may restrict use or terminate accounts for breach of these Terms, with notice where practicable.',
        ],
      },
      {
        heading: '7. Governing Law',
        body: ['These Terms are governed by the laws of the Republic of Korea.'],
      },
    ],
  },
  ja: {
    title: '利用規約',
    updated: LAST_UPDATED,
    intro:
      '本規約は errornote.ai（以下「本サービス」）の利用条件を定めます。本サービスに登録または利用することで、本規約に同意したものとみなします。',
    sections: [
      {
        heading: '1. サービス内容',
        body: [
          '本サービスは、AIを活用した中国語作文のエラー分析・添削、学習管理、教員ダッシュボード等の機能を提供します。',
          'AIが生成する分析・フィードバックは学習補助を目的とし、正確性を保証しません。',
        ],
      },
      {
        heading: '2. アカウント',
        body: [
          '利用者は正確な情報で登録し、アカウントのセキュリティを維持する責任を負います。',
          '教員アカウントは担当クラスの学生データを閲覧でき、教育目的にのみ使用しなければなりません。',
        ],
      },
      {
        heading: '3. 禁止事項',
        body: [
          '- 他人のなりすまし、無断アクセス',
          '- サービスの正常な運営の妨害、自動化された大量リクエスト',
          '- 違法・有害なコンテンツの投稿、他者の権利侵害',
          '- リバースエンジニアリング、無断複製・再配布',
        ],
      },
      {
        heading: '4. 知的財産権',
        body: [
          '本サービスおよびソフトウェア・デザインに関する権利は運営者に帰属します。',
          '利用者が投稿した作文の権利は利用者に帰属し、本サービスは機能提供に必要な範囲で処理します。',
        ],
      },
      {
        heading: '5. 免責',
        body: [
          '本サービスは「現状のまま」提供され、結果やAIフィードバックの正確性・完全性を保証しません。',
          '運営者の合理的支配を超える事由（外部サービス障害等）による損害について責任を負いません。',
        ],
      },
      {
        heading: '6. 解約',
        body: [
          '利用者はいつでも退会できます。',
          '運営者は本規約違反時、可能な場合は通知のうえ利用制限またはアカウント解約を行えます。',
        ],
      },
      {
        heading: '7. 準拠法',
        body: ['本規約は大韓民国の法律に準拠して解釈されます。'],
      },
    ],
  },
}

export function getLegalLocale(locale: string): LegalLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}
