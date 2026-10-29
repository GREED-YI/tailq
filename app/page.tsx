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

// 캡처마다 대체 글. 캡처는 로컬 쇼케이스 계정의 실제 화면이라(public/landing) 글도 화면에 보이는 것만 쓴다.
// k로 시작하는 것은 실제 화면에서 블록 하나만 잘라 낸 크롭이다
const ALT = {
  hero: "TailQ 홈 데스크톱 화면. 오늘의 질문 Q.226과 시작하기 버튼, 오른쪽에 이번 주 3일 학습과 약한 주제 트랜잭션·동시성 평균 38점",
  heroPhone:
    "면접 채점 결과. 본 질문 100점 만점에 74점, 20칸 막대, 잘 답했어요, 보완할 개념 경고 로그·batch size·DTO 조회",
  score:
    "채점 결과. 100점 만점에 74점, 20칸 중 15칸, 잘 답했어요, 잘한 점과 보완할 점, 보완할 개념 경고 로그·batch size·DTO 조회",
  qnote:
    "Q노트. 오늘 다시 볼 질문 2개(61점, 38점)와 3일 뒤 다시 볼 Q.226(74점)",
  history:
    "질문 상세. JPA N+1 문제 질문을 6번 풀었고 날짜별 기록에 86, 91, 88, 82점",
  today: "오늘의 결과. 본 질문 74점, 꼬리잇기 7일째, 다음 복습 3일 뒤",
  report: "리포트. 꼬리잇기 7일째, 최장 28일, 꼬리잇기 달력",
  note: "학습 자료 등록. 불러온 7주차_트랜잭션.pdf가 마크다운으로 바뀌어 입력칸에 3,524자 채워진 화면",
  questions:
    "학습 자료 '7주차 트랜잭션'으로 만든 질문 5개. ACID, MVCC, 격리 수준 비교, 비관적·낙관적 락, 재고 동시 주문",
};
// 꼬리질문 정점(§3)의 세 단계: 흐름 열(K02)과 질문·판정 블록(K03 데스크톱, K03m 휴대폰)이 같은 자리에서 바뀐다
const PEAK = [
  {
    flow: "면접 흐름. 본 질문 74점, 지금 꼬리질문 1",
    verdict:
      "꼬리질문 1 'fetch join 대신 @BatchSize로 컬렉션을 가져오면 쿼리는 몇 번 나가나요?'에 잘 답했어요",
  },
  {
    flow: "면접 흐름. 본 질문 74점, 꼬리질문 1 잘 답했어요, 지금 꼬리질문 2",
    verdict:
      "꼬리질문 2 '컬렉션 두 개를 동시에 fetch join하면 어떤 일이 생기나요?'에 틀렸어요와 기대 답안",
  },
  {
    flow: "면접 흐름. 본 질문 74점, 꼬리질문 1 잘 답했어요, 꼬리질문 2 틀렸어요, 지금 꼬리질문 3",
    verdict:
      "꼬리질문 3 '실무에서 페이징이 필요한 목록 API라면 어떤 조회 방식을 고르겠어요?'에 조금 부족해요와 기대 답안",
  },
];

// 랜딩은 다크로 시작한다(04 기능 명세 10번). 직접 고른 테마가 있으면 그것을 따른다.
// 루트 레이아웃의 테마 스크립트 다음, 화면을 그리기 전에 돈다
const darkFirst = `try{if(!localStorage.getItem("${THEME_STORAGE_KEY}"))document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`;
// 꼬리질문 섹션(§3)만 반대 테마로 뒤집는다. 첫 그림 전에 걸고, 토글은 LandingMotion이 따라간다
const invertPeak = `(function(){var e=document.getElementById("peak");if(e)e.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light"})()`;
// 첫 화면 기기 등장(CSS)은 보이는 캡처가 decode될 때까지 멈춰 두되 600ms 넘게 기다리지 않는다(data-wait).
// 그때까지 안 온 캡처는 data-late에 back·front로 적어 화면만 비워 두고, 오면 지워서 켠다.
// 표시는 섹션에만 건다(React가 그리는 img에 속성을 붙이면 하이드레이션이 어긋난다). JS가 없으면 바로 재생한다
const heroGate = `(function(){var h=document.getElementById("hero");if(!h)return;var im=[].filter.call(h.querySelectorAll("img"),function(i){return i.getClientRects().length});if(!im.length)return;h.dataset.wait="";var late=[],go=function(){if(!("wait" in h.dataset))return;delete h.dataset.wait;im.forEach(function(i){if(i.complete)return;var k=i.closest(".${s.heroBack}")?"back":"front";late.push(k);i.addEventListener("load",function(){late.splice(late.indexOf(k),1);h.dataset.late=late.join(" ")},{once:true})});h.dataset.late=late.join(" ")};setTimeout(go,600);Promise.all(im.map(function(i){return i.decode().catch(function(){})})).then(go)})()`;

// 랜딩(docs/04 10번): 한 사람의 하루에서 되묻는 순간만 실제 화면 크롭으로 꺼내 보인다.
// 첫 화면(기기 틀, 페이지에서 한 번) → 채점 → 꼬리질문(정점, 반대 테마) → Q노트 → 기록 → 학습 자료(실제 녹화) → 체험 → 푸터.
// 섹션마다 놓는 법이 다르다(옆 · 스크롤 교차 · 아래 어긋남 · 위아래 · 영상 위 겹침). 체험 질문만 DB에서 읽고 나머지는 미리 그려 둔다
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
        {/* §1 첫 화면: 데스크톱 홈 뒤, 채점 결과 휴대폰 앞(기기 틀은 여기에만) */}
        <section
          id="hero"
          className={s.hero}
          aria-labelledby="hero-title"
          suppressHydrationWarning
        >
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
              <Shot id="d01-home" {...DESK} alt={ALT.hero} eager from={768} />
            </Desktop>
            <Phone className={s.heroFront}>
              <Shot id="p03-result" {...PHONE} alt={ALT.heroPhone} eager />
            </Phone>
          </div>
        </section>
        <script dangerouslySetInnerHTML={{ __html: heroGate }} />

        {/* §2 채점: 글 왼쪽, 점수 묶음 크롭 하나 오른쪽(PC는 1.1배로 화면 오른쪽 끝까지) */}
        <section
          className={`${s.wrap} ${s.sec} ${s.grade}`}
          aria-labelledby="grade-title"
        >
          <div className={`${s.gradeCopy} ${s.reveal}`}>
            <h2 id="grade-title" className={s.h2}>
              100점 만점 채점, 잘한 점부터
            </h2>
            <p className={s.lead}>
              점수 아래에 잘한 점과 보완할 개념을 차례로 짚어요. 모르는 질문은
              &lsquo;모르겠어요&rsquo;를 누르면 모범 답안을 보여 줘요.
            </p>
          </div>
          <div className={`${s.crop} ${s.reveal} ${s.gradeShot}`}>
            <div className={s.wideOnly}>
              <Shot id="k01-score" w={834} h={494} alt={ALT.score} />
            </div>
            <div className={s.phoneOnly}>
              <Shot id="k01m-score" w={390} h={584} alt={ALT.score} />
            </div>
          </div>
        </section>

        {/* 정점 직전의 빈 바탕 */}
        <div className={s.breath} aria-hidden="true" />

        {/* §3 꼬리질문(정점): 반대 테마. 스크롤에 따라 흐름 열과 판정 블록이 세 단계로 같은 자리에서 바뀐다(틀 없음) */}
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
                  AI가 내 답변을 읽고 다음 질문을 만들어요. 실제 면접처럼
                  답변에서 빠진 부분을 이어서 물어요.
                </p>
              </div>
              <p className={s.hold}>
                본 질문은 점수로, 꼬리질문은 판정으로 남아요.
              </p>
            </div>
            <div className={`${s.wrap} ${s.peakFrame}`}>
              <div className={s.peakFlow}>
                {PEAK.map((p, n) => (
                  <div key={n} className={s.step}>
                    <Shot
                      id={`k02-flow-${n + 1}`}
                      w={412}
                      h={372}
                      alt={p.flow}
                    />
                  </div>
                ))}
              </div>
              <div className={s.peakVerdict}>
                {PEAK.map((p, n) => (
                  <div key={n} className={s.step}>
                    <Shot
                      id={`k03-verdict-${n + 1}`}
                      w={804}
                      h={372}
                      alt={p.verdict}
                    />
                  </div>
                ))}
              </div>
              <div className={s.peakVerdictM}>
                {PEAK.map((p, n) => (
                  <div key={n} className={s.step}>
                    <Shot
                      id={`k03m-verdict-${n + 1}`}
                      w={390}
                      h={462}
                      alt={p.verdict}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <script dangerouslySetInnerHTML={{ __html: invertPeak }} />

        {/* §4 Q노트: 글 위, 크롭 두 장 아래(오늘 다시 세로 열 + 날짜별 기록을 높이 어긋나게) */}
        <section
          className={`${s.wrap} ${s.sec} ${s.review}`}
          aria-labelledby="review-title"
        >
          <div className={s.reveal}>
            <h2 id="review-title" className={s.h2}>
              점수에 맞춰 돌아오는 복습
            </h2>
            <p className={s.lead}>
              70점이 안 되면 다음 날 다시 묻고, 70점 이상이면 3일, 7일, 14일,
              30일로 간격을 늘려요. 푼 질문은 Q노트에 모이고, 열면 날짜별 기록이
              보여요.
            </p>
          </div>
          <div className={s.reviewShots}>
            <div className={`${s.crop} ${s.reveal}`}>
              <Shot id="k04-qnote" w={366} h={346} alt={ALT.qnote} />
            </div>
            <div className={`${s.crop} ${s.reveal} ${s.history}`}>
              <Shot id="k05-history" w={808} h={418} alt={ALT.history} />
            </div>
          </div>
        </section>

        {/* §5 기록: 위에 글과 오늘의 결과 3칸, 아래에 리포트 달력이 레인 오른쪽 끝에 맞춰 넓게 */}
        <section
          className={`${s.wrap} ${s.sec} ${s.record}`}
          aria-labelledby="record-title"
        >
          <div className={`${s.recordCopy} ${s.reveal}`}>
            <h2 id="record-title" className={s.h2}>
              숫자로 남는 꼬리잇기와 약한 주제
            </h2>
            <p className={s.lead}>
              하루도 빠지지 않고 이어서 푼 날이 꼬리잇기로 쌓여요. 리포트에서
              달력과 주제별 평균 점수로 약한 곳을 찾아요.
            </p>
          </div>
          <div className={`${s.crop} ${s.reveal} ${s.today}`}>
            <Shot id="k07-today" w={390} h={138} alt={ALT.today} />
          </div>
          <div className={`${s.crop} ${s.reveal} ${s.report}`}>
            <div className={s.mdUp}>
              <Shot id="k06-report" w={1008} h={420} alt={ALT.report} />
            </div>
            <div className={s.mdDown}>
              <Shot id="k06m-report" w={390} h={380} alt={ALT.report} />
            </div>
          </div>
        </section>

        {/* §6 학습 자료: PC는 등록 화면 실제 녹화(보일 때만 재생) 위에 질문 5개 크롭을 겹친다.
            좁은 화면·동작 줄이기는 녹화 대신 정지 이미지 */}
        <section
          className={`${s.wrap} ${s.sec} ${s.maker}`}
          aria-labelledby="maker-title"
        >
          <div className={`${s.makerCopy} ${s.reveal}`}>
            <h2 id="maker-title" className={s.h2}>
              내 학습 자료로 만드는 질문 5개
            </h2>
            <p className={s.lead}>
              Q메이커에 PDF·Word·한글 파일을 올리면 내용이 마크다운으로 바뀌어
              입력칸에 채워져요. 파일은 서버로 보내지 않고, 그 글로 질문 5개를
              만들어요.
            </p>
            <p className={`${s.caption} ${s.makerNote}`}>
              파일 50MB까지 · 학습 자료 3개까지 · 내 프로젝트 README도 같은
              자리에서
            </p>
            {/* 녹화를 멈추는 스위치(녹화가 없는 좁은 화면·동작 줄이기에서는 숨긴다) */}
            <label className={`press ${s.pause}`}>
              <input type="checkbox" />
              녹화 멈추기
            </label>
          </div>
          <div className={s.makerStage}>
            <div className={`${s.panel} ${s.reveal} ${s.recording}`}>
              {/* 포스터 자리: 녹화 마지막 장면. 재생 전·JS 없음·동작 줄이기에는 이 그림이 보이고, 재생하면 녹화가 덮는다.
                  poster 속성은 숨은 테마에서도 받아 와서 쓰지 않는다 */}
              <Shot id="v02-poster" w={848} h={724} alt="" />
              {(["dark", "light"] as const).map((t) => (
                <video
                  key={t}
                  data-shot={t}
                  width={848}
                  height={724}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-label="학습 자료 등록 화면 녹화"
                >
                  <source src={`/landing/v02-${t}.webm`} type="video/webm" />
                  <source src={`/landing/v02-${t}.mp4`} type="video/mp4" />
                </video>
              ))}
              <p className="sr-only">
                PDF 파일을 불러오면 브라우저가 마크다운으로 바꿔 입력칸에 채우고
                몇 자를 넣었는지 알려 줘요.
              </p>
            </div>
            <div className={`${s.crop} ${s.reveal} ${s.noteStill}`}>
              <Shot id="k08m-note" w={390} h={612} alt={ALT.note} />
            </div>
            <div className={`${s.crop} ${s.reveal} ${s.questions}`}>
              <Shot id="k09-questions" w={390} h={636} alt={ALT.questions} />
            </div>
          </div>
        </section>

        {/* §7 체험 */}
        <section
          id="try"
          className={`${s.wrap} ${s.sec} ${s.try}`}
          aria-labelledby="try-title"
        >
          <Suspense fallback={<TrialPicker questions={null} />}>
            <TrialSection />
          </Suspense>
          <p className={`${s.caption} ${s.topics}`}>
            15개 주제 · {TOPICS.join(" · ")}
          </p>
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
