# TailQ (테일큐)

매일 기술면접 질문 하나. 답을 쓰면 AI가 채점하고 꼬리질문을 던지고, 틀린 질문은 며칠 뒤 다시 나온다.

> 기획 단계. 진행 상황은 [Projects 보드](../../projects)와 [마일스톤](../../milestones)에서 본다. 서비스 정의는 [docs/01-project-definition.md](docs/01-project-definition.md).

## 스택

Next.js (TypeScript) · Supabase · Claude API · Vercel

## 개발

필요한 것: Node.js 24, Docker (로컬 Supabase)

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run db:start             # 로컬 Supabase (처음엔 이미지를 받느라 몇 분)
npm run db:reset             # 마이그레이션 + 시드 다시 적용
npm run dev                  # http://localhost:3000
```

| 명령 | 하는 일 |
|---|---|
| `npm test` | 단위·API 테스트 (Vitest). Claude API는 MSW 가짜 응답이고, 처리하지 않은 외부 요청은 테스트를 실패시킨다 |
| `npm run test:e2e` | E2E (Playwright). 처음 한 번 `npx playwright install chromium` |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | 린트 · 타입 · 포맷 검사 |
| `npm run db:types` | 로컬 DB에서 `lib/database.types.ts`를 다시 만든다. 마이그레이션을 바꾸면 같이 커밋한다 |
| `npm run db:test` | RLS·함수 권한 테스트 (`supabase/tests/`, pgTAP) |
| `npm run seed:questions` | 샘플 질문 3개를 로컬 DB에 넣는다. 실제 질문은 `npm run seed:questions -- <비공개 콘텐츠 저장소>/questions`. 고치거나 숨기려면(`is_hidden: true`) 파일을 고치고 다시 돌린다 |
| `npm run eval` | AI 채점 평가 (`eval/`). 실제 Claude API를 불러 비용이 들어서 프롬프트를 바꿀 때만 돌린다 ([docs/09](docs/09-grading.md) 6장) |

PR마다 CodeRabbit이 한국어로 코드 리뷰를 단다(`.coderabbit.yaml`). 지적은 반영하거나, 반영하지 않으면 이유를 답글로 남기고 대화를 닫는다. 리뷰는 머지를 막지 않는다.

PR마다 GitHub Actions가 `verify`(린트·포맷·타입·단위 테스트·커버리지·빌드), `db`(마이그레이션·RLS 테스트·DB 타입 일치), `e2e`(Playwright)를 돌린다. 셋 다 통과해야 main에 합칠 수 있다.

새 마이그레이션은 `npx supabase migration new <이름>`으로 만든다. DB 구조는 대시보드에서 손으로 바꾸지 않는다.

## 디렉터리 구조

| 폴더 | 역할 |
|---|---|
| `app/` | 화면과 API. 폴더 이름이 곧 주소라서 Next.js 규칙을 따른다 (아래) |
| `components/` | 여러 화면이 같이 쓰는 UI 부품 (`Logo`, `Marks`(점수 표시) 등) |
| `lib/server/` | 서버 전용 코드. 파일 맨 위에 `import "server-only"`가 있어 브라우저 번들에 들어가면 빌드가 실패한다 (AI 호출, DB 쓰기·읽기, 사용량 기록, 오늘의 세션 만들기, 학습 기록 불러오기 등). 클라이언트 컴포넌트는 여기서 `import type`으로 타입만 가져온다 |
| `lib/client/` | 브라우저에서만 도는 코드 (푸시 구독, 파일 → 글 변환) |
| `lib/` (최상위) | 서버·브라우저 어디서나 쓰는 계산·타입 (채점 결과 변환, 연속 학습일, 복습 간격 등). `lib/supabase/`는 Supabase 클라이언트, `lib/database.types.ts`는 `npm run db:types`가 만드는 생성 파일 |
| `supabase/` | 마이그레이션, 시드, RLS·함수 테스트 (pgTAP) |
| `tests/` · `e2e/` | 단위·API 테스트(Vitest) · 화면 흐름 테스트(Playwright) |
| `docs/` | 기획·설계 문서 (`docs/assets/`는 화면에 쓰지 않는 디자인 원본) |
| `eval/` · `scripts/` | AI 채점 평가 · 질문 시드 스크립트 |

`app/`의 괄호 폴더(`(app)` 등)는 주소에 들어가지 않고 레이아웃만 나눈다.

- `app/(app)/`: 하단 탭이 있는 화면 (홈, Q노트, 프로젝트, 리포트, MY, 관리자)
- `app/(detail)/`: 뒤로 가기 머리글이 있는 상세 화면. 기록 상세는 `app/(detail)/history/[id]`로, 주소(`/history/:id`)가 이 이름이라 폴더 이름을 그대로 뒀다
- `app/(legal)/`: 이용약관·개인정보처리방침
- `app/my/`와 `app/(app)/my/`: 둘 다 주소는 `/my…`다. `(app)/my`는 탭이 있는 MY 화면이고, `app/my`는 탭 없이 열리는 MY 하위 화면(계정 삭제, 피드백, 프로필, 학습 범위)이다
- `app/api/`: Route Handler(API). 그 밖의 `interview`, `trial`, `onboarding`, `login`, `s/[id]`(공유 페이지)는 탭 없는 단독 화면이고, `_landing`·`_og`는 주소가 되지 않는 내부 폴더다

## 디자인

- [UI 디자인 기준](docs/07-ui-design.md): 지금 기준은 C안(유리 질감, AI 면접관 3D Q, 다크·라이트)
- [Figma · C안 디자인](https://www.figma.com/design/hQbw6ijIVjsloaeUy52iQi): 전 화면(모바일·태블릿·PC·랜딩, 다크·라이트)
- [Figma](https://www.figma.com/design/wPjTOU5FJdhdrMWOGZTHdh): 와이어프레임, 브랜드, 이전 UI 안
- [브랜드](docs/06-brand.md)
