import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FloatingQ } from "@/components/FloatingQ";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { tagLine } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { TRIAL_FIELDS, type TrialField } from "@/lib/trial";
import { HeroDemo } from "./_landing/HeroDemo";
import s from "./_landing/landing.module.css";
import { LandingMotion } from "./_landing/LandingMotion";
import { TrialPicker, type TrialQuestions } from "./_landing/TrialPicker";

export const metadata: Metadata = {
  title: "TailQ · 하루 한 문제, AI가 채점하고 되묻는 기술면접",
};

// 연습 범위 15개 주제(04 기능 명세 3번, supabase/seed.sql topics). 첫 줄 공통 CS·백엔드, 둘째 줄 나머지
const TOPICS_A = [
  "자료구조·알고리즘",
  "네트워크",
  "운영체제",
  "데이터베이스",
  "Java",
  "Spring",
  "JPA",
  "트랜잭션·동시성",
];
const TOPICS_B = [
  "인증·보안",
  "설계·아키텍처",
  "JavaScript",
  "TypeScript",
  "React",
  "브라우저·렌더링",
  "웹 성능",
];

// 꼬리잇기 소개의 예시 잔디(20주 × 7일). 실제 기록이 아니라 모양을 보여주는 고정 무늬다
const GRASS = Array.from({ length: 140 }, (_, i) => {
  const col = Math.floor(i / 7);
  const v = (i * 37 + (i % 7) * 11 + col * 5) % 10;
  if (i === 136) return 4;
  if (col === 19) return i < 136 ? 2 : 0;
  return v < 2 ? 0 : v < 4 ? 1 : v < 7 ? 2 : v < 9 ? 3 : 4;
});

// 랜딩은 다크로 시작한다(04 기능 명세 10번). 직접 고른 테마가 있으면 그것을 따른다.
// 루트 레이아웃의 테마 스크립트 다음, 화면을 그리기 전에 돈다
const darkFirst = `try{if(!localStorage.getItem("${THEME_STORAGE_KEY}"))document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

// 랜딩(docs/04 10번, Figma C안 랜딩): 헤더 → 히어로·채점 데모 → 주제 마퀴 → 대화 예시 → 기능 벤토 →
// 진행 방식 → 꼬리잇기 → 체험 → 푸터. 체험 질문만 DB에서 읽고 나머지는 미리 그려 둔다
export default function Landing() {
  return (
    <div className={s.root}>
      <script dangerouslySetInnerHTML={{ __html: darkFirst }} />
      <LandingMotion />
      <div className={s.blobs} aria-hidden="true">
        <span className={s.blob} data-k="1" />
        <span className={s.blob} data-k="2" />
        <span className={s.blob} data-k="3" />
        <span className={s.blob} data-k="4" />
        <span className={s.blob} data-k="5" />
      </div>

      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="TailQ 처음으로">
          <Logo height={26} />
        </Link>
        <nav className={s.nav} aria-label="랜딩 메뉴">
          <a href="#features">기능</a>
          <a href="#how">진행 방식</a>
          <a href="#try">체험하기</a>
        </nav>
        <div className={s.headerEnd}>
          <ThemeToggle />
          <Link href="/login" className={s.login}>
            로그인
          </Link>
          <a href="#try" className={`btn btn-primary press ${s.headerCta}`}>
            무료로 시작
          </a>
        </div>
      </header>

      <main>
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <span className={`glass ${s.badge} ${s.in}`}>
              <span className={s.badgeDot} aria-hidden="true" />
              매일 오는 오늘의 질문
            </span>
            <h1 className={`${s.heroTitle} ${s.in}`} data-i="1">
              하루 한 문제,
              <br />
              AI가 채점하고
              <br />
              <em>되묻는</em> 기술면접
            </h1>
            <p className={`${s.heroSub} ${s.in}`} data-i="2">
              질문에 내 말로 답하면 AI가 점수를 매기고 꼬리질문을 던져요.
              부족했던 질문은 며칠 뒤 다시 나와요.
            </p>
            <div className={`${s.heroActions} ${s.in}`} data-i="4">
              <a href="#try" className={`btn btn-primary press ${s.cta}`}>
                무료로 한 문제 풀어보기
                <span className={s.ctaArrow}>
                  <Icon name="arrowRight" size={18} bold />
                </span>
              </a>
              <a href="#how" className="glass btn btn-secondary press">
                진행 방식 보기
              </a>
            </div>
            <span className={`${s.heroNote} ${s.in}`} data-i="4">
              로그인 없이 하루 1번 체험할 수 있어요
            </span>
          </div>
          <div className={`${s.heroDemo} ${s.in}`} data-i="3">
            <HeroDemo />
          </div>
        </section>

        <div className={s.marquee} aria-label="연습할 수 있는 주제">
          <MarqueeRow topics={TOPICS_A} glass />
          <MarqueeRow topics={TOPICS_B} reverse />
        </div>

        <section className={s.chatSection} aria-labelledby="chat-title">
          <div className={s.sectionHead}>
            <h2 id="chat-title" className={s.h2} data-reveal>
              이렇게 되물어요
            </h2>
            <p className={s.lead} data-reveal data-i="1">
              답변을 채점한 뒤, 부족했던 부분을 골라 꼬리질문으로 이어서 물어요.
            </p>
          </div>
          <div className={s.chat}>
            <div className={`glass ${s.bubbleAi}`} data-reveal>
              <span className={s.bubbleLabel}>AI 면접관</span>
              <strong>JPA에서 N+1 문제가 무엇이고, 어떻게 해결하나요?</strong>
            </div>
            <p className={s.bubbleMe} data-reveal data-i="1">
              목록 조회 1번 뒤에 연관 엔티티마다 쿼리가 N번 더 나가요. fetch
              join으로 줄여요.
            </p>
            <p className={s.grade} data-reveal data-i="2">
              <span className="mono">72</span>원인은 정확히 짚었어요
            </p>
            <div className={`glass ${s.bubbleAi}`} data-reveal data-i="3">
              <span className={s.bubbleLabel}>↳ 꼬리질문 1</span>
              <strong>그럼 페이징이랑 같이 쓰면 어떤 문제가 생기나요?</strong>
            </div>
            <p className={s.bubbleMe} data-reveal data-i="4">
              DB가 아니라 메모리에서 페이징돼서 데이터가 많으면 위험해요.
            </p>
            {/* 꼬리질문은 점수 대신 판정(docs/07 "면접")이라 Figma의 86 대신 판정을 보인다 */}
            <p className={s.grade} data-reveal data-i="5">
              <strong>잘 답했어요</strong>핵심을 잘 짚었어요
            </p>
          </div>
        </section>

        <section id="features" className={s.section} aria-labelledby="f-title">
          <h2 id="f-title" className={s.h2} data-reveal>
            TailQ로 이렇게 연습해요
          </h2>
          <div className={s.bento}>
            <article className={`glass ${s.tile} ${s.b22}`} data-reveal>
              <div className={s.tileArt}>
                <div className={`glass ${s.notice}`}>
                  <FloatingQ size={36} />
                  <div>
                    <span className={s.noticeHead}>
                      TailQ<span className="mono">08:00</span>
                    </span>
                    <strong>오늘의 질문이 도착했어요</strong>
                  </div>
                </div>
                <div className={`glass ${s.noticeQ}`}>
                  <span className={`mono ${s.tag}`}>Q.042 · backend / jpa</span>
                  <strong>
                    JPA에서 N+1 문제가
                    <br />
                    무엇이고, 어떻게 해결하나요?
                  </strong>
                </div>
              </div>
              <div className={s.tileText}>
                <h3>매일 오는 오늘의 질문</h3>
                <p>
                  정한 시각에 내 분야 질문이 하나씩 와요. 이미 푼 날은 알림을
                  보내지 않아요.
                </p>
              </div>
            </article>
            <article className={`glass ${s.tile}`} data-reveal data-i="1">
              <div className={s.miniRing}>
                <svg viewBox="0 0 96 96" role="img" aria-label="예시 점수 72점">
                  <circle cx="48" cy="48" r="40" className={s.ringTrack} />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className={s.ringValue}
                    strokeDasharray="180.9 251.3"
                    transform="rotate(-90 48 48)"
                  />
                </svg>
                <span className="mono" aria-hidden="true">
                  72
                </span>
              </div>
              <div className={s.tileText}>
                <h3>AI 채점</h3>
                <p>점수와 함께 잘한 점, 보완할 점을 알려줘요</p>
              </div>
            </article>
            <article
              className={`glass ${s.tile} ${s.b12}`}
              data-reveal
              data-i="2"
            >
              <div className={s.tailChain}>
                {[
                  "N+1 문제가 뭔가요?",
                  "페이징과 같이 쓰면요?",
                  "batch size는요?",
                  "OSIV는요?",
                ].map((q, i) => (
                  <span key={q} style={{ marginLeft: i * 20 }}>
                    {i > 0 && (
                      <svg
                        width="24"
                        height="22"
                        viewBox="0 0 24 22"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 0v8c0 5 3 8 8 8h12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    <span className={`glass ${s.tailQ}`} data-first={i === 0}>
                      {q}
                    </span>
                  </span>
                ))}
              </div>
              <div className={s.tileText}>
                <h3>꼬리질문</h3>
                <p>앞 답변을 바탕으로 꼬리질문을 2~3개 이어서 물어요.</p>
              </div>
            </article>
            <article className={`glass ${s.tile}`} data-reveal data-i="3">
              <div className={s.days}>
                <span className="glass">1일</span>
                <span aria-hidden="true">→</span>
                <span className="glass">3일</span>
                <span aria-hidden="true">→</span>
                <span className={s.dayOn}>7일</span>
              </div>
              <div className={s.tileText}>
                <h3>다시 출제</h3>
                <p>부족한 질문은 며칠 뒤 다시</p>
              </div>
            </article>
            <article
              className={`glass ${s.tile} ${s.b21} ${s.wide}`}
              data-reveal
              data-i="2"
            >
              <div className={s.tileText}>
                <h3>내 프로젝트로 면접 연습</h3>
                <p>README를 붙여 넣으면 맞춤 질문 5개를 만들어요</p>
              </div>
              <div className={s.readme}>
                <span className={`glass mono ${s.readmeFile}`}>README.md</span>
                <span aria-hidden="true">→</span>
                <div className={s.qGrid}>
                  {["Q.01", "Q.02", "Q.03", "Q.04", "Q.05"].map((q) => (
                    <span key={q} className="mono">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </article>
            <article
              className={`glass ${s.tile} ${s.b21} ${s.wide}`}
              data-reveal
              data-i="3"
            >
              <div className={s.tileText}>
                <h3>기대 답안</h3>
                <p>
                  &quot;모르겠어요&quot;를 누르면 기대 답안을 보여주고, 그
                  질문은 복습으로 다시 나와요.
                </p>
              </div>
              <div className={s.expected}>
                <span>기대 답안 · OSIV</span>
                <p>
                  OSIV를 끄면 트랜잭션 밖에서 지연 로딩할 때 예외가 나요. 필요한
                  데이터는 서비스에서 미리 로딩해요.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section id="how" className={s.section} aria-labelledby="how-title">
          <h2 id="how-title" className={`${s.h2} ${s.center}`} data-reveal>
            이렇게 진행돼요
          </h2>
          <ol className={s.steps}>
            {[
              ["01", "질문 받기", "매일 한 문제씩"],
              ["02", "내 말로 답하기", "5분이면 충분해요"],
              ["03", "채점·꼬리질문", "부족한 건 복습으로"],
            ].map(([n, title, sub], i) => (
              <li key={n}>
                <span
                  className={s.stepNum}
                  data-outline={i < 2}
                  data-reveal
                  data-i={i}
                  aria-hidden="true"
                >
                  {n}
                </span>
                <h3 data-reveal data-i={i + 1}>
                  {title}
                </h3>
                <p data-reveal data-i={i + 2}>
                  {sub}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.streakSection} aria-labelledby="streak-title">
          <div className={s.foxWrap} data-reveal>
            <span className={`breathe ${s.foxHalo}`} aria-hidden="true" />
            <span className={s.fox} role="img" aria-label="TailQ 여우" />
          </div>
          <div className={s.streakCopy}>
            <h2 id="streak-title" className={s.h2} data-reveal>
              꼬리잇기
            </h2>
            <p className={s.lead} data-reveal data-i="1">
              하루도 빠지지 않고 이어서 푼 날 수예요. 일주일에 한 번은 쉬어도
              휴식권으로 이어져요.
            </p>
            <div
              className={s.grass}
              role="img"
              aria-label="학습 잔디 예시"
              data-reveal
              data-i="2"
            >
              {GRASS.map((level, i) => (
                <span key={i} data-level={level} data-today={i === 136} />
              ))}
            </div>
          </div>
        </section>

        <section id="try" className={s.trySection} aria-labelledby="try-title">
          <div className={`glass ${s.tryCard}`} data-reveal>
            <Suspense fallback={<TrialPicker questions={null} />}>
              <TrialSection />
            </Suspense>
          </div>
        </section>
      </main>

      <SiteFooter className={s.footer} logoHeight={22} />
    </div>
  );
}

function MarqueeRow({
  topics,
  glass = false,
  reverse = false,
}: {
  topics: string[];
  glass?: boolean;
  reverse?: boolean;
}) {
  // 같은 목록 두 벌을 이어 붙이고 -50%만큼 흘려 이음새 없이 돈다. 두 번째 벌은 읽지 않게 숨긴다
  return (
    <div className={s.mqRow}>
      <div className={s.mq} data-reverse={reverse || undefined}>
        {[0, 1].map((copy) => (
          <ul key={copy} className={s.mqGroup} aria-hidden={copy === 1}>
            {topics.map((t) => (
              <li
                key={t}
                className={`${glass ? "glass" : ""} ${/[가-힣]/.test(t) ? "" : "mono"}`}
              >
                {t}
              </li>
            ))}
          </ul>
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
