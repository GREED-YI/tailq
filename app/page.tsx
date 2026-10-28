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
import f from "./_landing/footer.module.css";
import s from "./_landing/landing.module.css";
import { LandingMotion } from "./_landing/LandingMotion";
import { DESK, Desktop, PHONE, Phone, Shot } from "./_landing/Shot";
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

// 캡처마다 대체 글. 캡처는 로컬 쇼케이스 계정의 실제 화면이라(public/landing) 글도 화면에 보이는 것만 쓴다
const ALT: Record<string, string> = {
  "d01-home":
    "TailQ 홈 데스크톱 화면. 오늘의 질문 Q.226과 시작하기 버튼, 오른쪽에 이번 주 3일 학습과 약한 주제 트랜잭션·동시성 평균 38점",
  "p01-home":
    "홈 화면. 오늘의 질문 Q.226(일대다 컬렉션 fetch join과 페이징)과 시작하기 버튼, 꼬리잇기 6일",
  "p01b-home-stats":
    "홈 학습 현황. 이번 주 3일 학습, 약한 주제 트랜잭션·동시성 평균 38점, 오늘 다시 볼 복습할 질문 목록",
  "p02-answer": "면접 화면. 본 질문에 답변을 쓰는 중",
  "p03-result":
    "면접 채점 결과. 본 질문 100점 만점에 74점, 20칸 막대, 잘 답했어요, 보완할 개념 경고 로그·batch size·DTO 조회",
  "p03b-feedback":
    "채점 피드백. 잘한 점, 보완할 점, 보완할 개념, 모범 답안을 펼친 화면",
  "e01-score":
    "점수 묶음. 74/100, 20칸 중 15칸 채운 막대, 잘 답했어요, 잘한 점과 보완할 점, 보완할 개념 경고 로그·batch size·DTO 조회",
  "d02-result":
    "면접 데스크톱 화면. 왼쪽 흐름에 본 질문, 오른쪽에 74점 채점 결과와 꼬리질문 받기 버튼",
  "d03-followup1":
    "꼬리질문 1 'fetch join 대신 @BatchSize로 컬렉션을 가져오면 쿼리는 몇 번 나가나요?'에 잘 답했어요",
  "d04-followup2":
    "꼬리질문 2 '컬렉션 두 개를 동시에 fetch join하면 어떤 일이 생기나요?'에 틀렸어요와 기대 답안",
  "d05-followup3":
    "꼬리질문 3 '실무에서 페이징이 필요한 목록 API라면 어떤 조회 방식을 고르겠어요?'에 조금 부족해요와 오늘의 결과 보기 버튼",
  "p05-followup2":
    "꼬리질문 2 '컬렉션 두 개를 동시에 fetch join하면 어떤 일이 생기나요?'에 틀렸어요와 기대 답안",
  "p07-today-result":
    "오늘의 결과. 본 질문 74점, 꼬리잇기 7일, 다음 복습 3일 뒤와 단계별 결과",
  "p08-qnote":
    "Q노트. 오늘 다시 볼 질문 2개(61점, 38점)와 3일 뒤 다시 볼 Q.226(74점), 숙련도 칸",
  "d06-question":
    "질문 상세 데스크톱. JPA N+1 문제 질문의 날짜별 풀이 기록과 점수",
  "d07-report":
    "리포트 데스크톱. 꼬리잇기 7일·최장 28일, 꼬리잇기 달력, 약점 리포트의 트랜잭션·동시성",
  "p10-report": "리포트. 꼬리잇기 7일·최장 28일, 꼬리잇기 달력과 약점 리포트",
  "p11-qmaker-projects":
    "Q메이커 프로젝트 구획. 오늘 남은 횟수와 등록한 프로젝트 '모여라'",
  "p12-qmaker-notes":
    "Q메이커 학습 자료 구획. 오늘 남은 횟수와 등록한 학습 자료 'HTTP 캐시 정리', '7주차 트랜잭션'",
  "p13-note-new":
    "학습 자료 등록. '7주차_트랜잭션.pdf'를 불러와 3,524자가 입력칸에 채워진 화면",
  "p14-note-questions":
    "학습 자료 '7주차 트랜잭션'으로 만든 질문 5개. ACID, MVCC, 격리 수준 비교, 비관적·낙관적 락, 재고 동시 주문",
  "p15-trial":
    "로그인 없이 하는 체험 화면. 백엔드 샘플 질문 Q.210(스프링 IoC와 의존성 주입)과 빈 답변 칸",
};
// 꼬리질문 정점(§4)의 네 단계. 데스크톱 면접 화면과 같은 상태의 휴대폰 화면
const PEAK_DESK = [
  "d02-result",
  "d03-followup1",
  "d04-followup2",
  "d05-followup3",
];
const PEAK_PHONE = [
  ["p03-result", "d02-result"],
  ["p04-followup1", "d03-followup1"],
  ["p05-followup2", "d04-followup2"],
  ["p06-followup3", "d05-followup3"],
];
// 하루 한 바퀴(§2): 이름 · 캡처 · 데스크톱 화면이면 true
const REEL: [string, string, boolean?][] = [
  ["홈", "p01-home"],
  ["답변", "p02-answer"],
  ["채점", "d02-result", true],
  ["꼬리질문", "p05-followup2"],
  ["오늘의 결과", "p07-today-result"],
  ["Q노트", "p08-qnote"],
  ["리포트", "d07-report", true],
  ["Q메이커 프로젝트", "p11-qmaker-projects"],
  ["학습 자료", "p12-qmaker-notes"],
  ["학습 자료 질문", "p14-note-questions"],
];

// 랜딩은 다크로 시작한다(04 기능 명세 10번). 직접 고른 테마가 있으면 그것을 따른다.
// 루트 레이아웃의 테마 스크립트 다음, 화면을 그리기 전에 돈다
const darkFirst = `try{if(!localStorage.getItem("${THEME_STORAGE_KEY}"))document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`;
// 꼬리질문 섹션(§4)만 반대 테마로 뒤집는다. 첫 그림 전에 걸고, 토글은 LandingMotion이 따라간다
const invertPeak = `(function(){var e=document.getElementById("peak");if(e)e.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light"})()`;

// 랜딩(docs/04 10번): 한 사람의 하루를 실제 앱 화면 캡처로 따라간다.
// 첫 화면 → 하루 한 바퀴(가로로 넘기는 화면 10장) → 채점 → 꼬리질문(정점, 반대 테마) → Q노트 → 기록 → Q메이커 학습 자료 → 체험 → 푸터.
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
        {/* §1 첫 화면: 데스크톱 홈 뒤, 채점 결과 휴대폰 앞 */}
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
          <div className={s.heroStage}>
            <Desktop className={s.heroBack}>
              <Shot
                id="d01-home"
                {...DESK}
                alt={ALT["d01-home"]}
                eager
                from={768}
              />
            </Desktop>
            <Phone className={s.heroFront}>
              <Shot id="p03-result" {...PHONE} alt={ALT["p03-result"]} eager />
            </Phone>
          </div>
        </section>

        {/* §2 하루 한 바퀴: 실제 화면 10장을 가로로 넘긴다(자동으로 흐르지 않는다) */}
        <section className={s.reelSec} aria-labelledby="reel-title">
          <div className={`${s.wrap} ${s.reelHead}`}>
            <div>
              <h2 id="reel-title" className={s.h2}>
                오늘의 질문부터 복습까지, 실제 화면 그대로
              </h2>
              <p className={s.lead}>
                홈에서 오늘의 질문을 열고, 답하고, 채점받고, 꼬리질문을 이어요.
                15개 주제 안에서 매일 한 문제씩 나와요.
              </p>
            </div>
            <div className={s.reelNav}>
              <button
                type="button"
                className="icon-btn press"
                aria-label="이전 화면 보기"
                data-reel="-1"
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <button
                type="button"
                className="icon-btn press"
                aria-label="다음 화면 보기"
                data-reel="1"
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </div>
          </div>
          <div
            className={s.reel}
            role="region"
            aria-label="실제 화면 10장"
            tabIndex={0}
          >
            <ol className={s.reelList}>
              {REEL.map(([label, id, desk], n) => (
                <li key={id}>
                  <p className={s.reelLabel}>
                    <span className="mono">
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    {label}
                  </p>
                  {desk ? (
                    <Desktop className={s.reelDesk}>
                      <Shot id={id} {...DESK} alt={ALT[id]} />
                    </Desktop>
                  ) : (
                    <Phone className={s.reelPhone}>
                      <Shot id={id} {...PHONE} alt={ALT[id]} />
                    </Phone>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className={s.wrap}>
            <p className={`${s.caption} ${s.topics}`}>{TOPICS.join(" · ")}</p>
          </div>
        </section>

        {/* §3 채점 결과 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
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
          <div className={`${s.media7} ${s.duo} ${s.duoGrade}`}>
            <Desktop className={`${s.back} ${s.wide}`}>
              <Shot id="d02-result" {...DESK} alt={ALT["d02-result"]} />
            </Desktop>
            <div
              className={`${s.panel} ${s.front} ${s.fore} ${s.wide} ${s.reveal}`}
            >
              <Shot id="e01-score" w={834} h={494} alt={ALT["e01-score"]} />
            </div>
            <Phone className={`${s.solo} ${s.narrow} ${s.reveal}`}>
              <Shot id="p03b-feedback" {...PHONE} alt={ALT["p03b-feedback"]} />
            </Phone>
          </div>
        </section>

        {/* 정점 직전의 빈 바탕 */}
        <div className={s.breath} aria-hidden="true" />

        {/* §4 꼬리질문(정점): 반대 테마. 스크롤에 따라 면접 화면 네 단계가 같은 자리에서 바뀐다 */}
        <section
          id="peak"
          className={s.peak}
          aria-labelledby="peak-title"
          suppressHydrationWarning
        >
          <div className={s.peakStage}>
            <div className={`${s.wrap} ${s.peakCopy}`}>
              <div className={s.peakLead}>
                <h2 id="peak-title" className={s.h2}>
                  내 답변에서 이어지는 꼬리질문
                </h2>
                <p className={s.lead}>
                  AI가 내 답변을 읽고 꼬리질문을 만들어요. 외워 둔 답은 두 번째
                  질문에서 드러나요.
                </p>
              </div>
              <p className={s.hold}>
                본 질문은 점수로, 꼬리질문은 판정으로 남아요.
              </p>
            </div>
            <div className={s.peakFrame}>
              <Desktop className={`${s.peakDesk} ${s.wide}`}>
                {PEAK_DESK.map((id) => (
                  <div key={id} className={s.step}>
                    <Shot id={id} {...DESK} alt={ALT[id]} />
                  </div>
                ))}
              </Desktop>
              <Phone className={`${s.peakPhone} ${s.narrow}`}>
                {PEAK_PHONE.map(([id, alt]) => (
                  <div key={id} className={s.step}>
                    <Shot id={id} {...PHONE} alt={ALT[alt]} />
                  </div>
                ))}
              </Phone>
            </div>
          </div>
        </section>
        <script dangerouslySetInnerHTML={{ __html: invertPeak }} />

        {/* §5 Q노트 복습 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
          aria-labelledby="review-title"
        >
          <div className={s.copy5}>
            <h2 id="review-title" className={s.h2}>
              점수에 맞춰 돌아오는 복습, Q노트
            </h2>
            <p className={s.lead}>
              70점이 안 되면 다음 날 다시 묻고, 70점 이상이면 3일, 7일, 14일,
              30일로 간격을 늘려 가요. 푼 질문은 Q노트에 모이고, 질문을 열면
              날짜별 기록을 볼 수 있어요.
            </p>
          </div>
          <div className={`${s.media7} ${s.duo}`}>
            <Desktop className={`${s.back} ${s.wide}`}>
              <Shot id="d06-question" {...DESK} alt={ALT["d06-question"]} />
            </Desktop>
            <Phone className={`${s.solo} ${s.fore} ${s.reveal}`}>
              <Shot id="p08-qnote" {...PHONE} alt={ALT["p08-qnote"]} />
            </Phone>
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
          <div className={`${s.media7} ${s.duo}`}>
            <Desktop className={`${s.back} ${s.wide}`}>
              <Shot id="d07-report" {...DESK} alt={ALT["d07-report"]} />
            </Desktop>
            <Phone className={`${s.solo} ${s.fore} ${s.wide} ${s.reveal}`}>
              <Shot
                id="p01b-home-stats"
                {...PHONE}
                alt={ALT["p01b-home-stats"]}
              />
            </Phone>
            <Phone className={`${s.solo} ${s.narrow} ${s.reveal}`}>
              <Shot id="p10-report" {...PHONE} alt={ALT["p10-report"]} />
            </Phone>
          </div>
        </section>

        {/* §7 Q메이커 학습 자료: 데스크톱은 등록 화면 녹화(6초 반복), 좁은 화면·동작 줄이기는 정지 화면 두 장 */}
        <section
          className={`${s.wrap} ${s.split} ${s.sec}`}
          aria-labelledby="maker-title"
        >
          <div className={s.copy5}>
            <h2 id="maker-title" className={s.h2}>
              학습 자료 파일을 올리면 질문 5개
            </h2>
            <p className={s.lead}>
              PDF·Word·한글 같은 파일을 올리면 브라우저가 마크다운으로 바꿔
              입력칸에 채워요. 파일은 서버로 보내지 않고, 등록하면 입력칸의 글만
              보내요.
            </p>
            <p className={`${s.caption} ${s.makerNote}`}>
              파일은 50MB까지, 학습 자료는 3개까지 두고 자료마다 질문 5개를
              만들어요. 내 프로젝트 README로도 같은 자리에서 질문을 만들어요.
            </p>
            {/* 녹화를 멈추는 스위치(녹화가 없는 좁은 화면·동작 줄이기에서는 숨긴다) */}
            <label className={`press ${s.pause}`}>
              <input type="checkbox" />
              녹화 멈추기
            </label>
          </div>
          <div className={`${s.media7} ${s.duo} ${s.duoMaker}`}>
            <Desktop className={`${s.back} ${s.motionOnly}`}>
              {/* 포스터 자리: 녹화 마지막 장면(D08). 재생 전·JS 없음에는 이 그림이 보이고, 재생하면 녹화가 덮는다.
                  poster 속성은 숨은 테마·숨은 폭에서도 받아 와서 쓰지 않는다 */}
              <Shot id="d08-note-new" {...DESK} alt="" />
              {(["dark", "light"] as const).map((t) => (
                <video
                  key={t}
                  data-shot={t}
                  width={1280}
                  height={800}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-label="학습 자료 등록 화면 녹화"
                >
                  <source src={`/landing/v01-${t}.webm`} type="video/webm" />
                  <source src={`/landing/v01-${t}.mp4`} type="video/mp4" />
                </video>
              ))}
              <p className="sr-only">
                PDF 파일을 불러오면 브라우저가 내용을 바꿔 입력칸에 채우고, 몇
                자를 넣었는지 알려 줘요.
              </p>
            </Desktop>
            <Phone className={`${s.solo} ${s.stillOnly}`}>
              <Shot id="p13-note-new" {...PHONE} alt={ALT["p13-note-new"]} />
            </Phone>
            <Phone className={`${s.solo} ${s.fore} ${s.pair} ${s.reveal}`}>
              <Shot
                id="p14-note-questions"
                {...PHONE}
                alt={ALT["p14-note-questions"]}
              />
            </Phone>
          </div>
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
          <Phone className={s.tryPhone}>
            <Shot id="p15-trial" {...PHONE} alt={ALT["p15-trial"]} />
          </Phone>
        </section>
      </main>

      <SiteFooter className={f.footer} logoHeight={22} />
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
