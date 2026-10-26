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

새 마이그레이션은 `npx supabase migration new <이름>`으로 만든다. DB 구조는 대시보드에서 손으로 바꾸지 않는다.

## 디자인

- [UI 디자인 기준](docs/07-ui-design.md): 지금 기준은 C안(유리 질감, AI 면접관 3D Q, 다크·라이트)
- [Figma · C안 디자인](https://www.figma.com/design/hQbw6ijIVjsloaeUy52iQi): 전 화면(모바일·태블릿·PC·랜딩, 다크·라이트)
- [Figma](https://www.figma.com/design/wPjTOU5FJdhdrMWOGZTHdh): 와이어프레임, 브랜드, 이전 UI 안
- [브랜드](docs/06-brand.md)
