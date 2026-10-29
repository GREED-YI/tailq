# 11. 운영 배포

TailQ를 실제 주소로 공개하는 절차다(#14). 처음 한 번은 아래 순서대로 손으로 설정하고, 그 뒤로는 main에 합치기만 하면 코드와 DB가 같이 반영된다. 실행 환경(리전, 함수 시간)과 설계는 [08 설계](08-architecture.md)를 따른다.

## 왜 두 군데에 배포하나

TailQ는 두 곳에서 돈다.

| 어디 | 무엇 | main에 합치면 |
|---|---|---|
| Vercel | 화면과 API(Next.js) | Vercel이 GitHub를 보고 **자동으로 새로 배포한다** |
| Supabase | DB, 로그인, 매시 알림 예약(`pg_cron`) | 아무 일도 일어나지 않는다. 그래서 `.github/workflows/db-deploy.yml`이 마이그레이션을 `supabase db push`로 반영한다 |

DB가 따로 반영되지 않으면, 새 코드는 배포됐는데 그 코드가 읽는 열이 운영 DB에 없어 에러가 난다. 워크플로가 이 틈을 없앤다.

비밀값은 세 곳에 나뉘어 들어간다. 저장소에는 하나도 두지 않는다(공개 저장소).

- **Vercel 환경변수**: 앱이 실행 중에 읽는 값 (Claude API 키, Supabase 키 등)
- **GitHub Secrets**: 워크플로 두 개가 읽는 값 (DB 반영, 깨우기)
- **Supabase vault**: DB 안의 매시 알림 예약이 읽는 값 (호출 주소, 비밀 헤더)

## 체크리스트

순서대로 한다. 뒤 단계가 앞 단계에서 만든 값(주소, 키)을 쓴다. `<ref>`는 Supabase 프로젝트 id(대시보드 주소 `supabase.com/dashboard/project/<ref>`의 그 부분), `<도메인>`은 Vercel이 준 주소(예: `tailq.vercel.app`)다.

### 1. Supabase 운영 프로젝트 새로 만들기

로컬에서 쓰던 Supabase는 내 컴퓨터의 Docker 안에만 있다. 실제 사용자가 쓸 DB는 Supabase 클라우드에 **새 프로젝트로 따로** 만든다.

1. [Supabase 대시보드](https://supabase.com/dashboard)에 GitHub 계정으로 로그인 → Organization이 없으면 하나 만들고 플랜은 **Free**.
2. New project:
   - Name: `tailq` (아무 이름이나 된다)
   - **Region: `Northeast Asia (Seoul)`**. Vercel 함수(`icn1`, 서울)와 같은 곳이어야 DB 왕복이 빠르다(08 "실행 환경"). 리전은 나중에 바꿀 수 없다.
   - Database password: Generate a password로 만들고 **바로 비밀번호 관리자에 적어 둔다.** 다시 보여주지 않는다(잊으면 Database 설정에서 재설정). 2단계에서 DB 접속 주소(`SUPABASE_DB_URL`)를 만들 때 쓴다.
   - **Data API는 켜 두고, "새 표를 Data API에 자동으로 공개"(Automatically expose new tables) 같은 선택지가 보이면 켠 채로 둔다.** 마이그레이션은 로컬과 같은 기본 권한을 전제로 쓰여 있어서(`supabase/config.toml`의 `auto_expose_new_tables` 기본값), 끄면 로그인한 사용자도 표를 읽지 못한다. 막아야 하는 표·함수는 마이그레이션이 직접 권한을 뺀다.
3. 만들어지기까지 1~2분 걸린다. 끝나면 아래 값을 찾아 둔다.

| 값 | 어디서 | 성격 |
|---|---|---|
| project ref (`<ref>`) | Project Settings → General → Project ID. 대시보드 주소 `supabase.com/dashboard/project/<ref>`의 그 부분과 같다 | 비밀 아님 |
| Project URL | `https://<ref>.supabase.co` (Project Settings → Data API에도 나온다) | 비밀 아님 |
| 공개 키 (anon) | Project Settings → API Keys. 새 방식 `sb_publishable_…` 또는 Legacy API Keys 탭의 `anon` 중 하나 | 브라우저에 들어가는 공개 값 |
| 비밀 키 (service role) | 같은 화면의 `sb_secret_…` 또는 Legacy 탭의 `service_role` | **절대 비밀.** RLS를 건너뛴다 |

공개 키와 비밀 키는 같은 방식(둘 다 새 방식 또는 둘 다 legacy)으로 맞춘다.

### 2. GitHub Secrets 넣기

저장소 Settings → Secrets and variables → Actions → New repository secret. 값이 하나라도 비어 있으면 두 워크플로는 실패하지 않고 "건너뜀" 안내만 남긴다.

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `SUPABASE_DB_URL` | 대시보드 위쪽 **Connect** → Connection String → Method **Session pooler**의 URI. `[YOUR-PASSWORD]` 자리를 1단계 Database password로 바꾼 전체 문자열. 비밀번호에 `@` `#` `%` `/` `:` 같은 특수문자가 있으면 퍼센트 인코딩해서 넣는다(CLI 문서: `--db-url`은 percent-encoded여야 한다). Generate a password로 만든 영문·숫자 비밀번호면 그대로 넣으면 된다 | DB 배포 |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | 깨우기 |
| `SUPABASE_ANON_KEY` | 공개 키 (Vercel의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 같은 값) | 깨우기 |

`SUPABASE_DB_URL`에는 DB 비밀번호가 들어 있어서 Secrets 말고 다른 곳에 붙여 넣지 않는다. 세션 풀러 주소를 쓰는 이유: GitHub Actions 러너는 IPv4만 되는데, 무료 프로젝트의 직접 접속 주소(`db.<ref>.supabase.co`)는 IPv6 전용이다. 깨우기에는 일부러 공개 키를 쓴다(아래 "Supabase 일시정지 방지").

### 3. DB 만들기 (마이그레이션 → 주제)

새 프로젝트는 표가 하나도 없는 빈 DB다. 마이그레이션 전부와 주제 15개(`supabase/seed.sql`)를 한 번에 넣는다. 방법은 두 가지다.

| | A. 워크플로로 (**추천**) | B. 내 컴퓨터에서 |
|---|---|---|
| 하는 법 | 2단계 Secrets를 넣고 Actions 탭 → **DB 배포** → Run workflow(main) | 아래 명령 |
| 장점 | 앞으로 main에 합칠 때 도는 길과 똑같아서 첫 실행이 곧 워크플로 점검이 된다. 무엇이 적용됐는지 Actions 로그에 남는다 | Secrets 없이 바로 된다 |
| 단점 | Secrets를 먼저 넣어야 한다 | 내 컴퓨터의 Supabase CLI가 운영 프로젝트에 연결된 채로 남는다. 나중에 로컬용 명령을 칠 때 헷갈릴 수 있다 |

A를 고른다. 어차피 2단계 Secrets는 자동 반영에 필요해서 B를 골라도 넣어야 한다.

B를 쓴다면 저장소 폴더에서 (DB 비밀번호를 물으면 1단계 값):

```powershell
# 주소에 비밀번호가 들어 있어 명령문에 쓰지 않고 입력받는다(PowerShell 기록에 남지 않게)
$env:SUPABASE_DB_URL = [Net.NetworkCredential]::new("", (Read-Host "Session pooler URI" -AsSecureString)).Password
npx supabase db push --db-url $env:SUPABASE_DB_URL --include-seed --skip-vault --dry-run   # 적용할 목록만 본다
npx supabase db push --db-url $env:SUPABASE_DB_URL --include-seed --skip-vault
Remove-Item Env:SUPABASE_DB_URL
```

로컬 DB용 명령(`npm run db:reset` 등)은 계속 로컬 Docker에만 간다.

A·B 모두 같은 일을 한다.

- 하는 일: `supabase db push --db-url … --dry-run`(적용할 목록을 로그에 남김) → `supabase db push --db-url … --include-seed`. 처음엔 `supabase link`와 계정 토큰을 썼으나, link가 프로젝트 API 키까지 읽는 넓은 권한을 요구해서 DB 접속 주소로 바로 미는 방식으로 바꿨다(2026-10-29). 계정 토큰이 필요 없다. 마이그레이션이 먼저 들어가고, 그다음 주제 시드가 들어간다
- 평소에는 `supabase/migrations/`나 `supabase/seed.sql`이 바뀐 커밋이 main에 들어올 때만 워크플로가 자동으로 돈다
- 처음 실행에서는 `supabase/migrations/`의 **모든 파일**이 순서대로 들어간다. 테마 열 삭제(#154, `drop_profiles_theme`), 앱 설치 이벤트(#157, `events_install`), 다시 생성 횟수 제한(#160, `regen_limit`, 그 PR이 합쳐진 뒤) 같은 최근 마이그레이션도 따로 챙길 필요 없이 같이 들어간다.
- `--include-seed`로 `supabase/seed.sql`(주제 15개)도 들어간다. 내용이 upsert라 여러 번 돌아도 같다.
- `--skip-vault`로 6단계에서 넣을 vault 값을 건드리지 않는다.
- 두 번 연달아 합쳐도 `concurrency`로 하나씩 돈다.

확인: Table Editor에서 `topics`가 15행이고, SQL `select jobname, schedule from cron.job;`에 `send-push`, `purge-old-events`, `cleanup-trials` 세 개가 보인다.

### 4. 질문 은행 넣기

질문은 주제(`topic_id`)를 가리키므로 **3단계가 끝난 뒤에** 넣는다. 질문 본문과 모범 답안은 공개 저장소에 없다(08 5장). 비공개 콘텐츠 저장소를 내 컴퓨터에 받아 둔 뒤, 운영 DB를 가리키는 값을 **이 터미널에서만** 잠깐 넣고 시드 스크립트를 돌린다. 셸에 넣은 값이 `.env.local`보다 우선한다.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://<ref>.supabase.co"
# 키는 명령문에 쓰지 않고 입력받는다. 명령문에 쓰면 PowerShell 기록(PSReadLine)에 남는다
$env:SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new("", (Read-Host "service role 키" -AsSecureString)).Password
npm run seed:questions -- <비공개 콘텐츠 저장소>/questions
Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL, Env:SUPABASE_SERVICE_ROLE_KEY
```

- 공개 샘플 질문(id 90000번대)은 스크립트가 운영 DB에 넣지 않게 막는다.
- 질문을 고치거나 숨길 때도 같은 명령을 다시 돌린다. 이 손 작업은 #161에서 자동으로 바꿀 예정이다.

확인: SQL `select count(*) from bank_questions;`가 은행 질문 수와 같다.

### 5. Vercel 프로젝트와 환경변수

1. [Vercel](https://vercel.com/new)에서 GitHub 저장소 `GREED-YI/tailq`를 Import. Framework는 Next.js로 자동 인식된다. 리전(`icn1`)과 Fluid compute는 저장소의 `vercel.json`이 정하므로 따로 고르지 않는다.
2. Settings → Environment Variables에 아래 값을 **Production에만** 넣는다. Preview에 운영 값을 넣으면 PR 코드가 실제 사용자 DB를 건드린다. (Preview 배포는 빌드는 되지만 열면 로그인·DB가 안 된다. PR 검사는 GitHub Actions가 한다.)
3. 값을 넣은 뒤 Deployments → 최근 배포 → Redeploy. 환경변수는 다시 배포해야 반영된다.

`.env.example`의 모든 변수:

| 변수 | 운영 값 | 어디서 | 브라우저에 가나 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | 운영용 키 | [Anthropic Console](https://console.anthropic.com) → API Keys. 같은 곳 Limits에서 월 사용 한도도 걸어 둔다(앱의 월 예산과 별개인 두 번째 안전장치) | 아니오 (Sensitive) |
| `AI_MOCK` | **넣지 않는다** | 값이 `1`이면 Claude를 부르지 않고 가짜 채점이 나간다. 운영에서는 비워 두거나 `0` | 아니오 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | 1단계 | **예** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 키 | 1단계. RLS가 막으므로 드러나도 되는 값이다 | **예** |
| `SUPABASE_SERVICE_ROLE_KEY` | 비밀 키 | 1단계. RLS를 건너뛰므로 절대 브라우저·로그·채팅에 두지 않는다 | 아니오 (Sensitive) |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | 운영용 새 쌍 | `npx web-push generate-vapid-keys`. **한 번 정하면 바꾸지 않는다**(바꾸면 기존 알림 구독이 모두 끊긴다). 공개 키는 서버 컴포넌트가 화면에 넘긴다 | 공개 키만 화면에 / 비밀 키는 아니오 (Sensitive) |
| `VAPID_SUBJECT` | `mailto:<운영자 메일>` | 푸시 서비스가 문제 있을 때 연락하는 주소 | 아니오 |
| `CRON_SECRET` | 긴 무작위 값 | `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`. 6단계 vault의 `cron_secret`과 **같은 값** | 아니오 (Sensitive) |
| `TRIAL_IP_HMAC_SECRET` | 긴 무작위 값 | 위와 같은 명령으로 따로 하나 더. 바꾸면 체험 IP 횟수 세기가 처음부터 다시 시작된다 | 아니오 (Sensitive) |
| `AI_MONTHLY_BUDGET_USD` | `20` | 월 AI 예산(09 5장) | 아니오 |
| `KRW_PER_USD` | `1400` | 비용 표시 환율 | 아니오 |
| `ADMIN_USER_IDS` | 내 사용자 id | 8단계에서 첫 로그인 뒤 채운다 | 아니오 |
| `SUPABASE_AUTH_*` (6개) | Vercel에 **넣지 않는다** | 로컬 Supabase가 `config.toml`에서 읽는 값이다. 운영 소셜 로그인은 7단계에서 Supabase 대시보드에 넣는다 | - |
| `CONTENT_DIR` | Vercel에 **넣지 않는다** | 내 컴퓨터에서 4단계 시드 스크립트만 쓴다 | - |

`NEXT_PUBLIC_`으로 시작하는 두 개만 브라우저 코드에 들어간다. 나머지는 서버에서만 읽는다.

배포가 끝나면 `<도메인>`이 정해진다. 아래 단계는 이 주소를 쓴다.

### 6. 매시 알림 예약 연결 (Supabase vault)

알림은 Supabase 안의 `pg_cron`이 매시 정각 `POST https://<도메인>/api/cron/push`를 부르면서 시작된다(08 "웹 푸시"). 마이그레이션(`20261028030700_push.sql`)이 예약(`send-push`)은 이미 등록해 두었고, **호출 주소와 비밀 헤더 값만 vault에서 읽는다.** 둘 중 하나라도 없거나 주소가 `https://`가 아니면 아무것도 하지 않는다. 그래서 이 단계 전까지는 알림이 나가지 않을 뿐 에러는 없다.

Supabase SQL Editor에서 한 번 실행한다.

```sql
select vault.create_secret('https://<도메인>/api/cron/push', 'push_cron_url');
select vault.create_secret('<CRON_SECRET과 같은 값>', 'cron_secret');
```

나중에 도메인이나 `CRON_SECRET`을 바꾸면 새로 만들지 말고 고친다.

```sql
select vault.update_secret((select id from vault.secrets where name = 'push_cron_url'), 'https://<새 도메인>/api/cron/push');
```

확인: 다음 정각이 지난 뒤 `select status_code, created from net._http_response order by created desc limit 3;`에 `202`가 보인다. `401`이면 vault의 `cron_secret`과 Vercel의 `CRON_SECRET`이 다르다.

### 7. 소셜 로그인 (GitHub, Google, 카카오)

로그인은 "TailQ → 각 서비스 로그인 화면 → **Supabase**(`https://<ref>.supabase.co/auth/v1/callback`) → TailQ(`/auth/callback`)" 순서로 돌아온다. 그래서 각 서비스 콘솔에는 Supabase 주소를, Supabase에는 TailQ 주소를 등록한다.

**Supabase 쪽** (Authentication → URL Configuration)

- Site URL: `https://<도메인>`
- Redirect URLs: `https://<도메인>/auth/callback`. 같은 앱을 `*.vercel.app`과 커스텀 도메인 둘로 열 수 있게 두면 둘 다 넣는다(로그인 버튼이 지금 연 주소로 돌아오게 만들기 때문이다).

**각 서비스 콘솔** (콜백 주소는 셋 다 `https://<ref>.supabase.co/auth/v1/callback`). 받은 Client ID·Secret은 Supabase Authentication → Sign In / Providers의 해당 항목에 넣고 켠다.

| 서비스 | 할 일 |
|---|---|
| GitHub | GitHub OAuth App은 콜백 주소를 하나만 받으므로 로컬용과 **따로 운영용 앱을 새로 만든다**(Settings → Developer settings → OAuth Apps). Homepage URL은 `https://<도메인>` |
| Google | Google Cloud Console → 사용자 인증 정보 → 로컬에서 쓰던 OAuth 클라이언트(웹 애플리케이션)에 승인된 리디렉션 URI를 하나 더 추가해도 되고, 운영용을 새로 만들어도 된다. OAuth 동의 화면을 **게시(프로덕션)** 상태로 바꾼다. 테스트 상태면 등록한 테스트 사용자만 로그인된다 |
| 카카오 | 카카오 디벨로퍼스 → 내 애플리케이션 → 카카오 로그인 → Redirect URI 추가, 앱 → 플랫폼 → Web에 `https://<도메인>` 추가. Supabase의 Kakao 항목에서 **이메일 없는 사용자 허용**(Allow users without an email)을 켠다. 로컬 `config.toml`의 `email_optional = true`와 같은 설정이다(08 10장) |

### 8. 운영 대시보드 권한

1. 배포 주소에서 내 계정으로 로그인한다.
2. Supabase Authentication → Users에서 내 행의 UID를 복사해 Vercel `ADMIN_USER_IDS`에 넣고 Redeploy.
3. `/admin`이 열리면 된다. 목록에 없는 계정에는 없는 페이지(404)로 보인다.

### 9. 도메인 (선택)

`*.vercel.app` 주소로도 충분하다. 커스텀 도메인을 붙이면 Vercel Settings → Domains에서 추가한 뒤 아래를 새 주소로 바꾼다.

- Supabase Site URL·Redirect URLs (7단계)
- vault `push_cron_url` (6단계, `update_secret`)
- 카카오 플랫폼 Web 도메인, GitHub OAuth App Homepage URL
- 공유 카드 미리보기 주소는 Vercel이 넣어 주는 운영 주소를 Next.js가 그대로 쓰므로 고칠 것이 없다.

### 10. 연기 테스트 (배포 주소에서 한 바퀴)

처음 배포했을 때와, 큰 PR을 합친 뒤에 확인한다. 실제 Claude API를 부르므로 채점이 몇 번 쓰인다.

- [ ] 랜딩이 열리고, 체험(`/trial`)에서 질문 하나를 답해 채점을 받는다
- [ ] GitHub·Google·카카오 로그인이 각각 되고, 체험한 질문이 이어받아진다
- [ ] 온보딩(분야·주제 고르기)을 마치고 홈으로 간다
- [ ] 오늘의 질문에 답하면 채점이 글자 단위로 흘러나오고 점수가 저장된다
- [ ] 꼬리질문에 답하고 세션이 끝난다
- [ ] 프로젝트 설명으로 질문 생성, 학습 자료(파일 하나)로 질문 생성이 된다
- [ ] MY에서 알림을 켜고(알림 시각을 지금 시각으로, 오늘 질문은 아직 답하지 않은 계정으로) SQL `select public.request_push_cron();`을 한 번 실행하면 알림이 온다
- [ ] 결과 공유 링크를 만들어 다른 브라우저(로그인 안 한 창)에서 열리고, 메신저에 붙이면 미리보기 카드가 뜬다
- [ ] `/admin`(운영 대시보드)이 열린다
- [ ] Actions → **Supabase 깨우기** → Run workflow가 성공하고, 로그에 `운영 DB 조회 응답: 200`이 찍힌다. "건너뜁니다" 알림만 있고 성공했다면 Secrets가 비어 있어 요청을 보내지 않은 것이라 확인이 아니다
- [ ] Anthropic Console 사용량에 방금 채점한 호출이 찍힌다 (`AI_MOCK`이 꺼져 있다는 뜻)

## 평소 배포

- PR을 main에 합치면 Vercel이 코드를, **DB 배포** 워크플로가 마이그레이션을 반영한다. 둘은 거의 동시에 돈다.
- 그래서 마이그레이션은 **옛 코드와 새 코드가 둘 다 견디게** 쓴다.
  - 열·표 추가: 옛 코드는 새 열을 모르니 괜찮다. 다만 새 코드가 새 열·표를 꼭 읽는다면, 아직 열이 없을 때도 동작하게(기본값으로 처리 등) 짜거나, 마이그레이션만 담은 PR을 먼저 합쳐 DB에 반영한 뒤 코드를 합친다.
  - 열·표 삭제나 이름 바꾸기: 먼저 코드가 그것을 안 쓰게 한 PR을 합치고, 다음 PR에서 지운다(#154 테마 열 삭제처럼).
- 운영 주제(`topics`)를 고치거나 더할 때는 `seed.sql`이 아니라 새 마이그레이션으로 한다. 이미 넣은 시드 파일이 바뀌어도 CLI가 다시 돌리지 않는다.
- 새 마이그레이션은 로컬에서 `npx supabase migration new <이름>`으로 만들고 `npm run db:reset`·`npm run db:test`로 확인한다. 운영 DB를 대시보드에서 손으로 바꾸지 않는다. 바꾸면 마이그레이션 기록과 어긋나 다음 `db push`가 실패할 수 있다.

## 되돌리기

**코드**: Vercel Deployments에서 이전 운영 배포를 골라 Instant Rollback. 몇 초 안에 바뀐다. 그 뒤 원인 커밋을 되돌리는 PR을 main에 합친다(롤백한 채로 두면 다음 머지 때 다시 덮인다).

**DB**: 마이그레이션은 앞으로만 간다. 적용된 마이그레이션 파일을 고치거나 지우지 않는다(운영 기록에 이미 "적용함"으로 남아 다시 돌지 않는다).

- 잘못된 마이그레이션이 **적용됐다면**: 되돌리는 SQL을 **새 마이그레이션**으로 만들어 PR로 합친다. 코드도 함께 문제라면 Vercel 롤백을 먼저 한다.
- 마이그레이션이 **실패했다면**: Actions 로그에 실패한 파일과 에러가 남는다. 실패한 파일은 기록되지 않으므로 그 파일을 고쳐 PR로 합치거나, 고친 뒤 DB 배포를 다시 돌린다. 앞서 성공한 파일은 이미 적용된 상태다.
- 데이터를 지우는 마이그레이션(열·표 삭제) 전에는 Table Editor에서 그 표를 CSV로 내려받아 둔다. 무료 플랜의 자동 백업 범위는 **확인 필요**다.

## Supabase 일시정지 방지 (#20)

무료 Supabase는 7일 동안 요청이 없으면 프로젝트를 일시정지한다. 출시 초반에 사용자가 적어 멈추면, 새로 들어온 사람이 에러를 보게 된다.

- `.github/workflows/keepalive.yml`이 **월·수·금 09:17(KST)** 에 주제 표를 1행 읽는다. 가장 긴 간격이 3일이라 7일 안에 반드시 요청이 생긴다.
- 공개 키를 쓰는 이유: 이 값은 원래 브라우저에 들어가 있어 Secrets에 둬도 새로 드러나는 것이 없다. `topics`는 로그인한 사람만 읽게 막혀 있어 빈 목록(`[]`)이 오지만, 요청은 API 게이트웨이를 거쳐 DB에서 실제로 실행된다. 비밀 키는 RLS를 건너뛰므로 이런 작업에 쓰지 않는다.
- 요청이 실패하면 워크플로가 실패하고, GitHub가 저장소 주인에게 실패 메일을 보낸다(GitHub Settings → Notifications → Actions에서 메일이 켜져 있는지 확인). 이미 멈췄다면 대시보드에서 Restore project.
- 6단계를 마치면 매시 알림 호출도 Vercel → Supabase API를 매시간 부르므로 이것만으로도 멈추지 않을 가능성이 크다. 다만 Supabase가 무엇을 "사용"으로 치는지 공개 기준이 분명하지 않아 이 워크플로를 따로 둔다.
- GitHub는 공개 저장소에 60일 동안 커밋이 없으면 예약 워크플로를 자동으로 끈다. 그러면 Actions 탭에 안내가 뜨고, Enable workflow를 누르면 다시 돈다.
- **임시 장치다.** 매일 사용자가 들어와 요청이 끊기지 않게 되면 `keepalive.yml`을 지우고 Secrets의 `SUPABASE_URL`·`SUPABASE_ANON_KEY`도 지운다.
