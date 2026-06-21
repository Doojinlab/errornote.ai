import next from 'eslint-config-next'

// ESLint 9 flat config (#53). eslint-config-next 16 은 네이티브 flat config 배열을
// 제공하므로 FlatCompat 없이 직접 펼친다(index = core-web-vitals + typescript 통합).
// 구 .eslintrc.json 의 커스텀 no-unused-vars 규칙과 .eslintignore 패턴을 그대로 유지한다.
const eslintConfig = [
  {
    ignores: ['node_modules/', '.next/', 'e2e/', 'public/sw.js', 'scripts/'],
  },
  {
    // eslint 9 flat config 는 미사용 disable 지시문을 기본 warn 한다. 구 .eslintrc 기본값은
    // off 였고, 기존 disable 주석들은 의도 문서화 + 규칙 복귀 대비용이라 그대로 둔다.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  ...next,
  {
    // eslint-config-next 16 은 eslint-plugin-react-hooks v6(React Compiler 인지) 의 신규
    // 규칙을 error 로 켠다. 기존(config-next 14)엔 없던 규칙으로, 버그가 아니라 스타일/성능
    // 권고다. 이번 PR 은 "버전 업그레이드" 범위이므로 이들을 warn 으로 낮춰 기존 lint
    // 베이스라인을 유지한다(규칙 채택·코드 정리는 별도 후속 PR). 동시에 App Router 에서
    // 오탐하는 legacy pages-router 규칙(no-html-link-for-pages)은 끈다.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    // @typescript-eslint 플러그인은 next 의 typescript flat config 가 TS 파일에만
    // 등록하므로, 커스텀 규칙도 동일 범위(*.ts/*.tsx)로 스코프해야 플러그인이 해석된다.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]

export default eslintConfig
