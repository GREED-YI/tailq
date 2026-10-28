import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { tagLine } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { TRIAL_FIELDS, type TrialField } from "@/lib/trial";
import { ScoreBar } from "@/app/interview/ScoreRing";
import { VerdictMark } from "@/app/interview/VerdictMark";
import { VERDICTS } from "@/app/interview/verdict";
import i from "@/app/interview/interview.module.css";
import { Dots, Score } from "./(app)/history/marks";
import h from "./(app)/history/history.module.css";
import home from "./(app)/home/home.module.css";
import g from "@/components/GrassTip.module.css";
import f from "./_landing/footer.module.css";
import s from "./_landing/landing.module.css";
import { LandingMotion } from "./_landing/LandingMotion";
import { TrialPicker, type TrialQuestions } from "./_landing/TrialPicker";

export const metadata: Metadata = {
  title: "TailQ · 하루 한 문제, AI가 채점하고 되묻는 기술면접",
};

// 연습 범위 15개 주제(04 기능 명세 3번, supabase/seed.sql topics)
const TOPICS = [
  "자료구조·알고리즘",
  "네트워크",
  "운영체제",
  "데이터베이스",
  "Java",
  "Spring",
  "JPA",
  "트랜잭션·동시성",
  "인증·보안",
  "설계·아키텍처",
  "JavaScript",
  "TypeScript",
  "React",
  "브라우저·렌더링",
  "웹 성능",
];

// 질문 띠(§2). 질문 은행은 비공개라(seed.sql) 공개된 문장만 쓴다: 체험 샘플(supabase/seed/sample-questions.json),
// 채점 평가 질문(eval/eval-set.json), 이 페이지가 따라가는 한 사람의 세션 질문
const BAND: [string, string][][] = [
  [
    ["backend / jpa", "JPA에서 N+1 문제가 무엇이고, 어떻게 해결하나요?"],
    ["cs / os", "프로세스와 스레드의 차이는 무엇인가요?"],
    [
      "backend / concurrency",
      "트랜잭션 격리 수준 REPEATABLE READ에서 팬텀 리드는 왜 생기나요?",
    ],
    ["cs / network", "HTTP와 HTTPS의 차이는 무엇인가요?"],
    [
      "backend / spring",
      "스프링의 의존성 주입(DI)은 무엇이고, 생성자 주입을 권장하는 이유는 무엇인가요?",
    ],
    ["cs / database", "복합 인덱스의 컬럼 순서는 어떻게 정하나요?"],
    [
      "cs / os",
      "스레드끼리 메모리를 공유하면 어떤 문제가 생기고 어떻게 막나요?",
    ],
    [
      "backend / jpa",
      "일대다 컬렉션을 fetch join하면서 페이징을 하면 어떤 문제가 생기나요?",
    ],
  ],
  [
    [
      "frontend / browser",
      "브라우저가 HTML을 받아 화면에 그리기까지의 과정을 설명해 주세요.",
    ],
    ["frontend / react", "React useEffect의 의존성 배열은 어떤 역할을 하나요?"],
    ["cs / network", "TCP 연결을 맺을 때 3-way handshake는 어떻게 진행되나요?"],
    [
      "frontend / react",
      "리스트를 렌더링할 때 key는 왜 필요하고, 배열 인덱스를 key로 쓰면 어떤 문제가 생기나요?",
    ],
    ["cs / network", "TLS 핸드셰이크에서 비대칭키와 대칭키를 왜 같이 쓰나요?"],
    [
      "frontend / browser",
      "리플로우와 리페인트는 어떻게 다르고, 리플로우를 줄이려면 어떻게 하나요?",
    ],
    [
      "frontend / react",
      "의존성 배열에서 쓰는 값을 빼먹으면 어떤 문제가 생기나요?",
    ],
    [
      "backend / jpa",
      "컬렉션 두 개를 동시에 fetch join하면 무슨 일이 생기나요?",
    ],
  ],
];

// 한 사람의 하루(전 섹션 공통 예시): 2026.10.27(화) Q.226 74점, 꼬리질문 ● ■ ◐, 꼬리잇기 6일째,
// 복습 대기 3개, 다음 복습 3일 뒤 10월 30일(금). 통계·후기가 아니라 화면 예시다
const MAIN_Q =
  "일대다 컬렉션을 fetch join하면서 페이징을 하면 어떤 문제가 생기나요?";
const SCORE = 74;
const SUMMARY =
  "전체를 가져와 메모리에서 페이징한다는 핵심은 짚었어요. 배치 크기로 푸는 대안까지 말하면 더 좋아요.";
const CONCEPTS = ["@BatchSize", "default_batch_fetch_size", "메모리 페이징"];
const THREAD = [
  {
    name: "꼬리질문 1",
    q: "fetch join 대신 @BatchSize로 풀면 쿼리는 몇 번 나가나요?",
    v: "good",
  },
  {
    name: "꼬리질문 2",
    q: "컬렉션 두 개를 동시에 fetch join하면 무슨 일이 생기나요?",
    v: "wrong",
  },
  {
    name: "꼬리질문 3",
    q: "실무라면 어떤 방식을 고르겠어요? 이유까지 말해 주세요.",
    v: "partial",
  },
];
// 복습(apply_review): 70점 미만은 1칸·1일 뒤, 처음 70점 이상은 2칸·3일 뒤
const REVIEWS = [
  {
    due: "오늘 다시",
    today: true,
    level: 1,
    q: "트랜잭션 격리 수준 REPEATABLE READ에서 팬텀 리드는 왜 생기나요?",
  },
  {
    due: "오늘 다시",
    today: true,
    level: 1,
    q: "복합 인덱스의 컬럼 순서는 어떻게 정하나요?",
  },
  { due: "3일 뒤 다시", today: false, level: 2, q: MAIN_Q },
];
const HISTORY = [
  { day: "10.27", q: MAIN_Q, score: 74 },
  { day: "10.26", q: "복합 인덱스의 컬럼 순서는 어떻게 정하나요?", score: 61 },
  {
    day: "10.25",
    q: "트랜잭션 격리 수준 REPEATABLE READ에서 팬텀 리드는 왜 생기나요?",
    score: 38,
  },
];
// 내 프로젝트(§7): eval/eval-set.json의 README "모여라"에서 발췌. 질문은 그 README 문장에 근거한 예시(설계 2·기술 2·트러블 1)
const README = [
  "# 모여라 — 모임 일정 투표 서비스",
  "- 백엔드: Spring Boot 3, JPA, MySQL",
  "- 투표 수정이 잦아서 투표를 (모임, 참여자, 날짜) 행으로 저장하고, 결과는 조회할 때 GROUP BY로 집계했습니다.",
  "- 인원이 많은 모임에서 결과 화면이 3초 넘게 걸렸습니다.",
];
const PROJECT_QS = [
  [
    "설계 이유",
    "투표 결과를 집계 테이블에 두지 않고 조회할 때 GROUP BY로 집계한 이유는 무엇인가요?",
  ],
  [
    "설계 이유",
    "참여자 인증을 로그인 대신 모임별 무작위 토큰 쿠키로 한 이유는 무엇인가요?",
  ],
  ["기술 선택", "프론트엔드에서 React Query를 고른 이유는 무엇인가요?"],
  [
    "기술 선택",
    "동시 수정으로 생긴 중복 행을 유니크 제약과 upsert로 막은 이유는 무엇인가요?",
  ],
  ["트러블슈팅", "결과 화면이 3초 넘게 걸렸을 때 원인을 어떻게 찾고 줄였나요?"],
];

// 랜딩은 다크로 시작한다(04 기능 명세 10번). 직접 고른 테마가 있으면 그것을 따른다.
// 루트 레이아웃의 테마 스크립트 다음, 화면을 그리기 전에 돈다
const darkFirst = `try{if(!localStorage.getItem("${THEME_STORAGE_KEY}"))document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`;
// 꼬리질문 섹션(§4)만 반대 테마로 뒤집는다. 첫 그림 전에 걸고, 토글은 LandingMotion이 따라간다
const invertPeak = `(function(){var e=document.getElementById("peak");if(e)e.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light"})()`;

// 랜딩(docs/04 10번): 한 사람의 하루를 실제 화면 조각으로 따라간다.
// 첫 화면(채점 결과 도착) → 질문 띠 → 채점 → 꼬리질문(정점, 반대 테마) → 복습 → 기록 → 내 프로젝트 → 체험 → 푸터.
// 체험 질문만 DB에서 읽고 나머지는 미리 그려 둔다
export default function Landing() {
  return (
    <div className={s.root}>
      <script dangerouslySetInnerHTML={{ __html: darkFirst }} />
      <LandingMotion />

      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="TailQ 처음으로">
          <Logo height="var(--logo-h)" />
        </Link>
        <div className={s.headerEnd}>
          <ThemeToggle />
          <Link href="/login" className={`btn btn-ghost press ${s.login}`}>
            로그인
          </Link>
          <Link
            href="/login"
            className={`btn btn-md btn-secondary press ${s.start}`}
          >
            시작하기
          </Link>
        </div>
      </header>

      <main>
        {/* §1 첫 화면: 채점 결과가 도착한 순간 */}
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <h1 id="hero-title" className={s.h1}>
              하루 한 문제, AI가 채점하고 되묻는 개발자 기술 면접 연습
            </h1>
            <p className={s.heroSub}>
              답변을 쓰면 AI가 100점 만점으로 채점하고, 내 답변에 맞춰
              꼬리질문을 이어 가요. 70점이 안 된 질문은 다음 날 다시 물어요.
            </p>
            <a href="#try" className={`btn btn-primary press ${s.cta}`}>
              로그인 없이 한 문제 풀어보기
              <Icon name="arrowRight" size={18} bold />
            </a>
          </div>

          <div
            className={s.stage}
            role="group"
            aria-label="채점 결과 화면 예시"
          >
            <ol className={`${s.tl} ${s.heroThread}`}>
              <li>
                <span
                  className={i.threadDot}
                  data-shape="fill"
                  style={{ color: "var(--text)" }}
                  aria-hidden="true"
                />
                <span className={s.tlHead}>
                  <b>본 질문</b>
                  <span className="mono">{SCORE}</span>
                </span>
                <p>{MAIN_Q}</p>
              </li>
              <li aria-current="step">
                <span className={i.threadDot} data-current aria-hidden="true" />
                <span className={s.tlNow}>꼬리질문 1 · 지금</span>
              </li>
            </ol>

            <div className={`${i.panel} ${s.heroPanel}`}>
              <div className={s.heroSteps}>
                <span
                  className={i.stepBars}
                  role="img"
                  aria-label="4단계 중 1단계 끝, 꼬리질문 1 차례"
                >
                  <span data-state="done" />
                  <span data-state="current" />
                  <span />
                  <span />
                </span>
                <span className={s.heroStepLabel}>본 질문 → 꼬리질문 1</span>
              </div>
              <span className={`mono ${s.qTag}`}>Q.226 · backend / jpa</span>
              <p className={s.heroQ}>{MAIN_Q}</p>
              <div className={`${i.score} ${s.heroScore}`}>
                <div className={i.scoreRow}>
                  <p
                    className={i.scoreNum}
                    role="img"
                    aria-label={`100점 만점에 ${SCORE}점`}
                  >
                    <span className="mono">{SCORE}</span>
                    <span className="mono">/100</span>
                  </p>
                  <VerdictMark verdict="good" />
                </div>
                <ScoreBar value={SCORE} />
              </div>
              <p className={i.summary}>{SUMMARY}</p>
              <Concepts />
            </div>
          </div>
        </section>

        {/* §2 질문 띠 */}
        <section className={s.band} aria-labelledby="band-title">
          <div className={s.wrap}>
            <h2 id="band-title" className={s.h2}>
              15개 주제, 매일 한 문제
            </h2>
            <p className={s.lead}>
              자료구조부터 React까지, 내가 고른 연습 범위 안에서 매일 한 문제씩
              질문해요.
            </p>
          </div>
          <div className={s.tracks}>
            {BAND.map((row, r) => (
              <div
                key={r}
                className={s.track}
                role="group"
                aria-label={`질문 예시 ${r + 1}줄`}
                tabIndex={0}
              >
                <div className={s.flow} data-reverse={r === 1 || undefined}>
                  {[0, 1].map((copy) => (
                    <ul
                      key={copy}
                      className={s.flowGroup}
                      aria-hidden={copy === 1 || undefined}
                    >
                      {row.map(([tag, q]) => (
                        <li key={q}>
                          <span className="mono">{tag}</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={`${s.wrap} ${s.bandFoot}`}>
            <p className={s.caption}>{TOPICS.join(" · ")}</p>
            {/* 흐르는 띠를 멈추는 스위치(동작 줄이기에서는 처음부터 멈춰 있어 숨긴다) */}
            <label className={`press ${s.pause}`}>
              <input type="checkbox" />
              흐름 멈추기
            </label>
          </div>
        </section>

        {/* §3 채점 결과 */}
        <section
          className={`${s.wrap} ${s.split} ${s.grade}`}
          aria-labelledby="grade-title"
        >
          <div className={s.copy5}>
            <h2 id="grade-title" className={s.h2}>
              100점 만점 채점, 잘한 점부터 짚는 피드백
            </h2>
            <p className={s.lead}>
              점수 아래에 잘한 점, 보완할 점, 모범 답안을 차례로 보여 줘요.
              모르는 질문은 &lsquo;모르겠어요&rsquo;를 누르면 기대 답안을 보여
              주고 다음 날 다시 물어요.
            </p>
          </div>
          <div className={`${i.result} ${s.media7}`}>
            {/* 앱에서는 접혀 있는 칸. 랜딩에서는 펼쳐 두고, 눌러 접을 수 있다 */}
            <details className={i.more} open>
              <summary className="press">
                모범 답안과 피드백 자세히 보기
                <Icon name="chevronDown" size={18} />
              </summary>
              <div className={i.moreBody}>
                <div className={i.block}>
                  <span className={i.label}>잘한 점</span>
                  <ul className={i.list}>
                    <li>
                      페이징이 데이터베이스가 아니라 메모리에서 일어난다는 점을
                      짚었어요.
                    </li>
                  </ul>
                </div>
                <div className={i.block}>
                  <span className={i.label}>보완할 점</span>
                  <ul className={i.list}>
                    <li>
                      배치 크기(@BatchSize)로 IN 쿼리를 묶어 가져오는 대안을
                      함께 말해 보세요.
                    </li>
                  </ul>
                </div>
                <div className={i.block}>
                  <span className={i.label}>모범 답안</span>
                  <p className={i.well}>
                    컬렉션을 fetch join하면 행이 컬렉션 수만큼 늘어나서
                    데이터베이스에서 페이징할 수 없어요. 그래서 전체를 메모리로
                    가져와 페이징하고, 데이터가 많으면 메모리가 위험해요. 이때는
                    fetch join 대신 batch size(default_batch_fetch_size)로 IN
                    쿼리 묶음 조회를 써요.
                  </p>
                </div>
              </div>
            </details>
            <div className={s.dontKnow}>
              <VerdictMark verdict="unknown" />
              <span className={s.caption}>기대 답안 확인 · 내일 다시</span>
            </div>
          </div>
        </section>

        {/* 정점 직전의 빈 바탕 */}
        <div className={s.breath} aria-hidden="true" />

        {/* §4 꼬리질문(정점): 반대 테마, 스크롤에 따라 단계가 이어진다 */}
        <section
          id="peak"
          className={s.peak}
          aria-labelledby="peak-title"
          suppressHydrationWarning
        >
          <div className={s.peakStage}>
            <div className={`${s.wrap} ${s.split}`}>
              <div className={s.copy5}>
                <h2 id="peak-title" className={s.h2}>
                  내 답변에서 이어지는 꼬리질문
                </h2>
                <p className={s.lead}>
                  AI가 내 답변을 읽고 꼬리질문을 만들어요. 외워 둔 답은 두 번째
                  질문에서 드러나요.
                </p>
              </div>
              <ol className={`${s.tl} ${s.peakThread}`}>
                <li>
                  <span
                    className={i.threadDot}
                    data-shape="fill"
                    style={{ color: "var(--text)" }}
                    aria-hidden="true"
                  />
                  <span
                    className={i.threadDot}
                    data-current
                    data-now
                    aria-hidden="true"
                  />
                  <span className={s.tlHead}>
                    <b>본 질문</b>
                    <Score value={SCORE} />
                  </span>
                  <p>{MAIN_Q}</p>
                </li>
                {THREAD.map((t, n) => {
                  const last = n === THREAD.length - 1;
                  const v = VERDICTS[t.v];
                  return (
                    <li key={t.name} aria-current={last ? "step" : undefined}>
                      {!last && (
                        <span
                          className={i.threadDot}
                          data-shape={v.shape}
                          style={{ color: v.color }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={i.threadDot}
                        data-current
                        data-now={!last || undefined}
                        aria-hidden="true"
                      />
                      <span className={s.tlHead}>
                        <b>{t.name}</b>
                        <VerdictMark verdict={t.v} />
                      </span>
                      <p>{t.q}</p>
                    </li>
                  );
                })}
              </ol>
              <p className={s.hold}>
                본 질문은 점수로, 꼬리질문은 판정으로 남아요.
              </p>
            </div>
          </div>
        </section>
        <script dangerouslySetInnerHTML={{ __html: invertPeak }} />

        {/* §5 복습 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
          aria-labelledby="review-title"
        >
          <div className={s.copy5}>
            <h2 id="review-title" className={s.h2}>
              점수에 맞춰 돌아오는 복습
            </h2>
            <p className={s.lead}>
              70점이 안 되면 다음 날 다시 묻고, 70점 이상이면 3일, 7일, 14일,
              30일로 간격을 늘려 가요. 미룬 복습도 사라지지 않아요.
            </p>
          </div>
          <div className={s.media7}>
            <div className={h.listHead}>
              <h3 className={s.h3}>
                복습할 질문<span className={`mono ${h.count}`}>3</span>
              </h3>
            </div>
            <ul className={h.list}>
              {REVIEWS.map((r) => (
                <li key={r.q}>
                  <div className={`${h.rowLink} ${home.reviewRow}`}>
                    <span
                      className={`num tag ${r.today ? "tag-today" : "tag-neutral"} ${h.due} ${home.due}`}
                    >
                      {r.due}
                    </span>
                    <span className={`${h.rowText} ${home.reviewText}`}>
                      {r.q}
                    </span>
                    <span className={home.level}>
                      <Dots level={r.level} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {/* 숙련도가 오르내리는 모습(6초 반복). 동작 줄이기면 한 장면에 멈춘다 */}
            <div className={s.mastery}>
              <span className={s.masteryName}>숙련도</span>
              <p className="sr-only">
                맞히면 숙련도 칸이 하나씩 늘고 간격이 1일, 3일, 7일로 벌어져요.
                틀리면 1칸으로 돌아가 내일 다시 나와요.
              </p>
              <div className={s.loop} aria-hidden="true">
                <span data-still>
                  <Dots level={2} />
                  <span className="num">3일 뒤 다시 · 10월 30일(금)</span>
                </span>
                <span>
                  <Dots level={1} />
                  내일 다시
                </span>
                <span>
                  <Dots level={2} />
                  3일 뒤 다시
                </span>
                <span>
                  <Dots level={3} />
                  7일 뒤 다시
                </span>
                <span>
                  <Dots level={1} />
                  <VerdictMark verdict="wrong" />
                  <span>→ 내일 다시</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* §6 기록·리포트 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
          aria-labelledby="record-title"
        >
          <div className={s.copy5}>
            <h2 id="record-title" className={s.h2}>
              숫자로 남는 기록과 약한 주제
            </h2>
            <p className={s.lead}>
              날마다 받은 점수와 약한 주제를 기록과 리포트로 모아 보여 줘요.
              꼬리잇기는 하루도 빠지지 않고 이어서 푼 날 수예요.
            </p>
          </div>
          <div className={s.media7}>
            <div
              className={`${home.stats} ${s.stats}`}
              role="group"
              aria-label="학습 현황 예시"
            >
              <div className={home.tile}>
                <span className={home.tileLabel}>꼬리잇기</span>
                <p className={home.tileValue}>
                  <b className="mono">6</b>일째
                </p>
              </div>
              <div className={home.tile}>
                <span className={home.tileLabel}>복습 대기</span>
                <p className={home.tileValue}>
                  <b className={`mono ${home.accent}`}>3</b>개
                </p>
              </div>
              <div className={`${home.tile} ${s.week}`}>
                <span className={home.tileLabel}>
                  이번 주
                  <span className={`num ${home.weekNote}`}>2일 학습</span>
                </span>
                <div
                  className={`${g.cells} ${home.days}`}
                  role="img"
                  aria-label="이번 주 월요일 61점, 화요일 74점"
                >
                  {[...WEEKDAYS].map((d, n) => (
                    <span
                      key={d}
                      className={home.day}
                      data-now={n === 1 || undefined}
                    >
                      <span
                        data-level={n === 0 ? 2 : n === 1 ? 3 : 0}
                        data-future={n > 1 || undefined}
                        data-today={n === 1 || undefined}
                      />
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`${home.tile} ${home.weak} ${s.weak}`}>
                <span className={home.tileLabel}>약한 주제</span>
                <ul className={home.weakList}>
                  <li>
                    <span className={home.weakName}>트랜잭션·동시성</span>
                    <span className={home.weakAvg}>
                      평균
                      <Score value={38} />
                    </span>
                  </li>
                  <li>
                    <span className={home.weakName}>데이터베이스</span>
                    <span className={home.weakAvg}>
                      평균
                      <Score value={61} />
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div className={h.listHead}>
              <h3 className={s.h3}>최근 기록</h3>
            </div>
            <ul className={h.list}>
              {HISTORY.map((r) => (
                <li key={r.day}>
                  <div className={h.rowLink}>
                    <span className={`mono ${h.rowDate}`}>{r.day}</span>
                    <span className={h.rowText}>{r.q}</span>
                    <Score value={r.score} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* §7 내 프로젝트 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
          aria-labelledby="project-title"
        >
          <div className={s.copy5}>
            <h2 id="project-title" className={s.h2}>
              내 프로젝트 README로 만드는 예상 질문
            </h2>
            <p className={s.lead}>
              README를 붙여넣으면 설계 이유 2개, 기술 선택 2개, 트러블슈팅 1개로
              질문 5개를 만들어요. README에 적힌 내용만 물어요.
            </p>
            <div className={s.readme}>
              <span className={i.label}>README 또는 설명</span>
              <div className={s.readmeBox}>
                {README.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
          <ol className={`${s.media7} ${s.pq}`} aria-label="만들어진 질문 예시">
            {PROJECT_QS.map(([kind, q]) => (
              <li key={q}>
                <span className={s.pqKind}>{kind}</span>
                {q}
              </li>
            ))}
          </ol>
        </section>

        {/* §8 체험 */}
        <section
          id="try"
          className={`${s.wrap} ${s.sec} ${s.try}`}
          aria-labelledby="try-title"
        >
          <Suspense fallback={<TrialPicker questions={null} />}>
            <TrialSection />
          </Suspense>
        </section>
      </main>

      <SiteFooter className={f.footer} logoHeight={22} />
    </div>
  );
}

const WEEKDAYS = "월화수목금토일";

// 보완할 개념 칩(DESIGN.md label concept). 한글이 섞이면 본문 글꼴
function Concepts() {
  return (
    <div className={i.block}>
      <span className={i.label}>보완할 개념</span>
      <div className={i.chips}>
        {CONCEPTS.map((k) => (
          <span
            key={k}
            className={`tag tag-concept ${/[가-힣]/.test(k) ? "" : "mono"}`}
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// 분야마다 체험에 낼 샘플 질문(trial_field). 공개해도 되는 샘플이라 service_role로 질문 글만 읽는다.
// DB를 못 읽으면 질문 미리보기 없이 분야 고르기만 보인다
async function TrialSection() {
  await connection();
  let questions: TrialQuestions = null;
  try {
    const { data } = await createAdminClient()
      .from("questions")
      .select(
        "id, prompt, topic_id, trial_field, topics(field), projects(name)",
      )
      .in("trial_field", [...TRIAL_FIELDS])
      .eq("is_hidden", false)
      .order("id")
      .throwOnError();
    questions = {};
    for (const q of data) {
      const field = q.trial_field as TrialField;
      questions[field] ??= { tag: tagLine(q), prompt: q.prompt };
    }
  } catch (e) {
    console.error("trial questions read failed", e);
  }
  return <TrialPicker questions={questions} />;
}
