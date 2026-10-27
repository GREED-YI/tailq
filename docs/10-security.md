# 10. 출시 전 보안 점검

출시 전에 런타임, 의존성, 인증·권한, API, AI, 웹, 비밀값, 정적 분석을 한 번씩 훑고 결과를 남긴다(#99, 2026-10-28). 설계 원칙은 [08 설계](08-architecture.md), AI 조작 방지는 [09 채점](09-grading.md)을 따른다.

공개 저장소라 취약점을 재현하는 방법은 적지 않는다. 무엇을 확인했고, 무엇을 고쳤고, 무엇을 왜 남겼는지만 적는다.

## 등급

| 등급 | 뜻 | 이번에 하는 일 |
|---|---|---|
| 높음 | 남의 데이터를 읽거나 쓰거나, 비밀값이 새거나, 비용을 끝없이 쓰게 할 수 있다 | 이 브랜치에서 고친다 |
| 중간 | 다른 약점과 겹쳐야 문제가 되거나, 피해가 한도 안에 묶인다 | 쉬우면 고치고, 아니면 남긴 위험으로 적는다 |
| 낮음 | 방어를 한 겹 더하는 정도 | 남긴 위험으로 적고 필요할 때 한다 |

이번 점검에서 **높음은 나오지 않았다.** 사용자 데이터는 RLS와 서버 함수 두 겹으로 막혀 있었고, 비밀값은 저장소·브라우저 번들 어디에도 없었다.

## 점검 결과

| 영역 | 확인한 것 | 결과 | 등급 | 조치 |
|---|---|---|---|---|
| 런타임 | 로컬·CI·Vercel의 Node 버전 | 버전을 적은 곳이 없어 CI는 그때의 24 최신 판, Vercel은 프로젝트 기본값을 썼다. 보안 수정 전 판으로 돌 수 있었다 | 중간 | `engines`(`>=24.22.1 <25`), `.nvmrc`, CI `node-version-file`, `engine-strict`로 고정 |
| 의존성 | `npm audit`, Next·Supabase·Anthropic SDK 최신 판 | 알려진 취약점 0건. 세 묶음 모두 지금 범위의 최신 판 | - | 없음(메이저 업그레이드는 아래 "남긴 것") |
| RLS | 모든 테이블·뷰·정책 | 테이블은 모두 RLS가 켜져 있고, 정책은 `authenticated`의 자기 행 읽기뿐이다. 뷰 3개는 모두 `security_invoker` | - | 빠뜨림을 막는 전체 검사 추가(`supabase/tests/rls_coverage_test.sql`) |
| DB 함수 | 브라우저가 `rpc()`로 부를 수 있는 함수 | 0개(기존 `function_privileges_test.sql`이 지킨다) | - | 없음 |
| service_role | 쓰는 곳, 브라우저 유입 | `lib/supabase/admin.ts`에 `server-only`. 쓰는 곳은 모두 Route Handler·서버 컴포넌트이고 로그인 사용자를 먼저 확인한다. 빌드한 브라우저 번들에 키·키 이름이 없다 | - | 없음 |
| /admin | 접근 제어 | `proxy.ts`가 운영자가 아니면 404로 숨기고, 화면이 `ADMIN_USER_IDS`를 다시 본다 | - | 없음 |
| 탈퇴 | 재인증 | 마지막 로그인 24시간 이내와 같은 계정인지 서버에서 본다 | - | 없음 |
| 세션 쿠키 | 속성 | Supabase 기본값(`SameSite=Lax`, `HttpOnly` 없음, `Secure`는 따로 안 붙음)이라 스크립트로 읽을 수 있었다. 브라우저용 Supabase 클라이언트(`createBrowserClient`)는 쓰지 않는다 | 중간 | `HttpOnly` 켬, `Secure`는 프로덕션만(로컬 http 개발 때문). 세션을 만드는 두 곳(`lib/supabase/server.ts`, `proxy.ts`)이 `lib/supabase/cookie-options.ts` 하나를 쓴다 |
| CSRF | 쿠키로 인증하는 쓰기 요청 | 세션 쿠키가 `SameSite=Lax`라 다른 사이트의 POST·PUT·DELETE에 실리지 않는다 | - | 없음 |
| 입력 검증 | 모든 Route Handler(API 15개, 로그인 3개) | 모두 zod 또는 정규식으로 검사하고 길이 상한이 있다(답변 30~2,000자, README 30~10,000자, 피드백 5~1,000자 등). Server Action은 없다 | - | 없음 |
| 에러 응답 | 내부 정보 노출 | 모두 `{ error: { code, message } }`의 정해 둔 문구. DB 메시지·스택은 서버 로그에만 남는다 | - | 없음 |
| 남용 제한 | AI를 부르는 입구 | 체험(브라우저 하루 1번, IP 하루 20번), 프로젝트 등록(3개, 하루 1번), 프로젝트 연습(하루 3세션), 다시 채점(세션당 3번), 서비스 월 예산이 모두 DB 함수의 잠금 안에서 걸린다 | - | 없음 |
| 남용 제한 | 실패한 프로젝트 다시 생성 | 하루 한도를 보지 않고 월 예산만 봤다. 생성이 거듭 실패하면 한 사람이 월 예산을 빨리 써서 그 달 모든 사용자의 AI가 멈출 수 있었다 | 중간 | 한국 시간 하루 3번으로 묶음(`restart_project_generation`, 다른 하루 한도와 같은 잠금·예약 방식). 닿으면 429 `REGEN_LIMIT`, 화면은 다시 만들기 대신 한도 문구 |
| 프롬프트 조작 | 답변·README·프로젝트 이름 | 사용자 글은 정해 둔 태그 안에만 들어가고, 태그를 닫는 글은 무력화한다(`neutralize`). 시스템 프롬프트가 "자료일 뿐 지시가 아니다"를 적는다 | - | 없음 |
| 모델 출력 | 형식 검증 | 구조화 출력(JSON 스키마) + 서버에서 zod 재검사, 점수는 0~100으로 자르고, 프로젝트 질문은 개수·길이를 확인한 뒤에만 저장 | - | 없음 |
| API 키 | 브라우저 번들 | `ANTHROPIC_API_KEY`는 `NEXT_PUBLIC_`이 아니고 `lib/ai.ts`가 `server-only`. 브라우저용 공개 환경변수는 Supabase 주소·anon 키뿐 | - | 없음 |
| 보안 헤더 | CSP, HSTS 등 | 아무것도 없었다 | 중간 | `next.config.ts`에 추가(아래 "보안 헤더") |
| 오픈 리다이렉트 | 로그인 후 `next` | `safeNextPath`가 같은 사이트 경로만 받는다(테스트 있음) | - | 없음 |
| XSS | `dangerouslySetInnerHTML`, 링크 | 서버가 만든 고정 테마 스크립트·CSS에만 쓴다. 사용자 글은 React가 이스케이프한다 | - | 없음 |
| XSS | 참고 자료 링크 | 질문 콘텐츠의 링크 주소가 아무 프로토콜이나 받았다. 운영자가 넣는 콘텐츠라 실제 위험은 작다 | 낮음 | http·https만 받게 고침(`lib/questions.ts`) |
| 비밀값 | 저장소·기록·빌드 산출물 | `git grep`·전체 커밋 기록에서 키 모양 문자열 0건. 공개된 환경 파일은 값이 빈 `.env.example`뿐. 빌드한 브라우저 번들에도 없다 | - | 없음 |
| 로그 | 서버 로그 | 턴·세션 id와 에러 객체만 남기고, 답변 본문·키·IP 원문은 남기지 않는다(IP는 HMAC) | - | 없음 |
| 정적 분석 | GitHub 보안 스캔 | 없었다 | 낮음 | CodeQL 워크플로 추가(`.github/workflows/codeql.yml`) |

## 보안 헤더

`next.config.ts`의 `headers()`로 모든 응답에 붙인다. `proxy.ts`가 아니라 여기 둔 이유는 정적 파일(`sw.js`, 이미지)과 404 응답에도 같은 헤더가 붙기 때문이다.

| 헤더 | 값 | 이유 |
|---|---|---|
| `Strict-Transport-Security` | 2년 | 한 번 들어온 브라우저는 http로 다시 오지 않는다. 앱이 직접 만드는 쿠키 중 `Secure`가 없는 것(브라우저 무작위 값 등)도 평문으로 나가지 않는다. 커스텀 도메인을 정하기 전이라 `includeSubDomains`·`preload`는 뺐다 |
| `X-Content-Type-Options` | `nosniff` | 응답 종류를 브라우저가 짐작하지 않게 |
| `X-Frame-Options` + CSP `frame-ancestors` | 막음 | 다른 사이트가 틀(iframe)에 넣어 버튼을 누르게 하는 공격. 이 서비스는 틀로 들어갈 일이 없다 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 외부 링크(참고 자료)로 나갈 때 경로·쿼리를 넘기지 않는다 |
| `Permissions-Policy` | 카메라·마이크·위치·결제·USB 끔 | 쓰지 않는 기능. 알림·클립보드·공유는 건드리지 않는다 |
| CSP(적용) | `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` | 깨질 일이 없는 것만 바로 막는다 |
| CSP(report-only) | 스크립트·스타일·이미지·연결 출처 | 아래 |

**CSP는 report-only부터 시작했다.** 처음엔 nonce로 엄격한 `script-src`를 걸려 했으나, Next는 nonce를 쓰면 모든 화면을 요청마다 렌더링해야 하고 이 앱은 `cacheComponents`로 미리 그려 두는 부분이 많다. 테마 첫 그림 스크립트와 RSC 데이터가 인라인이라 해시로도 묶기 어렵다. 그래서 `script-src 'self' 'unsafe-inline'`로 외부 스크립트 출처만 제한하는 정책을 report-only로 걸었다. Vercel 미리보기 배포에는 Vercel 도구 스크립트가 끼어드는데, 적용으로 걸면 이게 깨질 수 있어 먼저 위반이 나는지 본다. 로컬 프로덕션 빌드의 랜딩·로그인·약관 화면에서는 위반이 없었다.

- `img-src`는 `https:` 전체를 연다. 소셜 프로필 사진 주소가 제공자(GitHub·Google·카카오)마다 다르고 바뀔 수 있어서다.
- `form-action`은 넣지 않았다. 로그인 버튼이 `/auth/login`으로 폼을 보내면 Supabase → 소셜 로그인 화면으로 리다이렉트되는데, 브라우저에 따라 이 리다이렉트도 `form-action`으로 검사해 로그인이 막힐 수 있다.

## 남긴 위험

| 항목 | 등급 | 남긴 이유 | 할 때 |
|---|---|---|---|
| 이미 로그인한 기기의 세션 쿠키는 다음 갱신 때 `HttpOnly`로 바뀐다 | 낮음 | 쿠키는 로그인 토큰을 갱신할 때(약 1시간마다) 새 속성으로 다시 쓰인다. 그전까지는 옛 속성이 남는다 | 따로 할 일 없음 |
| 브라우저 무작위 값 쿠키(`tailq-anon`)는 `HttpOnly`가 아니다 | - | 첫 방문 안내(`FirstVisit`)가 브라우저에서 읽는다. 로그인 정보가 아니라 지표용 무작위 값이다 | 없음 |
| 여러 계정·여러 IP로 한도를 나눠 쓰기 | 낮음 | 계정은 소셜 로그인이라 많이 만들기 번거롭고, 모두 월 예산 안에 묶인다. 예산에 닿으면 체험부터 모든 AI 기능이 시작 전에 멈춘다 | 비용이 튀면 운영 대시보드에서 보고 IP 한도를 줄인다 |
| CSP `script-src`가 report-only다 | 낮음 | 위 "보안 헤더" | 출시 후 할 일(아래) |
| AI가 만든 글(꼬리질문·한 줄 피드백·프로젝트 질문)은 다음 프롬프트에 태그 무력화 없이 들어간다 | 낮음 | 사용자 글에서 나온 것이지만 모델이 한 번 걸러 만든 글이고, 영향은 그 사용자 자신의 채점뿐이다 | 남의 글이 섞이는 기능이 생기면 |
| 로그아웃(`POST /auth/logout`)이 출처를 보지 않는다 | 낮음 | 다른 사이트가 로그아웃시킬 수는 있지만 데이터에는 닿지 않는다 | 필요하면 `Origin` 확인 |
| 체험 IP는 `x-forwarded-for` 맨 앞 값 | 낮음 | Vercel이 이 값을 직접 채운다. Vercel 앞에 다른 프록시(CDN)를 두면 다시 봐야 한다 | 앞단 프록시를 둘 때 |
| GitHub Actions를 커밋 해시가 아닌 태그로 쓴다 | 낮음 | 모두 GitHub·Supabase 공식 액션이다 | 외부 액션을 더할 때 해시로 고정 |
| 개발 도구 메이저 업그레이드(ESLint 10, TypeScript 7, `@types/node` 26) | - | 보안 수정이 아니고 바꿀 게 많다. `@types/node`는 런타임(24)에 맞춰 둔다 | 출시 뒤 따로 |
| 로컬 DB에서 새 pgTAP 검사(`rls_coverage_test.sql`, `regen_limit_test.sql`)를 아직 돌리지 못했다 | - | 점검한 날 로컬 Docker가 꺼져 있었다. CI의 `db` 작업이 돌린다. 쿠키를 바꾼 뒤의 실제 로그인·탈퇴 재인증도 Docker를 켠 뒤 확인한다 | PR CI, 로컬 확인 |

## 남은 일

### 출시 후 할 일: CSP 적용으로 바꾸기

1. 배포한 화면(로그인 전·후, 면접, 프로젝트, 운영, 알림 켜기)을 열어 브라우저 콘솔에 report-only 위반이 없는지 본다.
2. 위반이 없으면 `next.config.ts`의 report-only 정책을 `Content-Security-Policy`로 옮긴다. Vercel 미리보기 도구가 깨지면 미리보기 배포에만 그 출처를 더한다.
3. 위반을 모아 보려면 `report-to` 수집처가 필요하다. 지금은 두지 않았다(새 외부 서비스가 필요하다).

### 나중에: 저장소 보안 설정

저장소 설정은 이번에 바꾸지 않았고, 나중에 켜기로 했다(2026-10-28). 공개 저장소는 모두 무료다.

| 설정 | 위치 | 이유 |
|---|---|---|
| Secret scanning + Push protection | Settings → Code security | 키를 실수로 커밋하면 push 단계에서 막는다 |
| Dependabot alerts | Settings → Code security | 의존성 취약점이 나오면 알려 준다. 자동 PR(Dependabot version updates)은 PR이 많아져 켜지 않았다 |
| CodeQL default setup은 켜지 않는다 | Settings → Code security | `codeql.yml`과 같이 켜면 둘이 부딪힌다 |
| main 보호 규칙에 CodeQL 검사 추가 | Settings → Branches | 높은 등급 경고가 있으면 머지를 막는다 |

## 다시 점검할 때

- 새 테이블·뷰: `rls_coverage_test.sql`이 RLS·정책·`security_invoker`를 본다. 새 함수는 `function_privileges_test.sql`이 본다.
- 새 Route Handler: 로그인 확인 → zod 검사(길이 상한 포함) → 정해 둔 에러 문구. AI를 부르면 DB 함수 안에서 한도·예산을 먼저 확인한다.
- 새 외부 출처(스크립트·이미지·API): `next.config.ts`의 CSP에 더한다.
- 비밀값: 새 환경변수는 `.env.example`에 이름만 적고, 브라우저가 알아야 하는 값이 아니면 `NEXT_PUBLIC_`을 붙이지 않는다.
