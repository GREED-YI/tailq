import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { GrassTip } from "@/components/GrassTip";
import { Icon } from "@/components/icons";
import { LimitNotice } from "@/components/LimitNotice";
import { startDailySession, type DailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { homeState, type HomeState } from "@/lib/home";
import { daysUntil, dueLabel } from "@/lib/review";
import { grassCells, type GrassCell } from "@/lib/streak";
import { loadStudy, type Study } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { weaknessReport } from "@/lib/weakness";
import { ScoreBar } from "@/app/interview/ScoreRing";
import { Dots, Score } from "../history/marks";
import h from "../history/history.module.css";
import s from "./home.module.css";
import { NotifyPrompt } from "./NotifyPrompt";

// 홈(S10 오늘 안 풂 · S11 하던 중 · S12 오늘 완료). DESIGN.md와 시안 MainM·HomeTabletM·HomeMobileM:
// 인사·날짜 → 오늘의 질문(상자 없이 큰 글, 주 버튼 하나) → 학습 현황 숫자 타일 → 복습할 질문 → 최근 기록(PC).
// PC는 12칸 격자에 오늘의 질문 8칸 · 학습 현황 4칸, 그 아래 두 목록을 나란히 둔다. 폭이 바뀌어도 순서는 같다
export default function HomePage() {
  return (
    <>
      <AppHeader />
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    </>
  );
}

const TITLES: Record<HomeState["kind"], string> = {
  todo: "오늘도 한 문제 도전해 볼까요?",
  doing: "하던 질문 마저 이어가 볼까요?",
  done: "오늘 면접 응시 완료했어요",
};

// "2026-10-28" → "2026.10.28 WED"(기록 상세와 같은 숫자형)
const dateLine = (day: string) =>
  `${day.replaceAll("-", ".")} ${new Date(`${day}T00:00:00Z`)
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase()}`;

// 날짜 · 닉네임 인사 한 줄. 닉네임은 사용자 요청(#115)
function Greeting({
  day,
  name,
  title,
}: {
  day?: string;
  name?: string | null;
  title: string;
}) {
  return (
    <p className={s.greet}>
      {day && (
        <>
          <span className="mono">{dateLine(day)}</span> ·{" "}
        </>
      )}
      {name && <span className={s.name}>{name}님, </span>}
      {title}
    </p>
  );
}

// 불러오는 동안: 같은 자리에 같은 모양의 빈 칸(레이아웃이 밀리지 않게).
// 미리 그리는 화면이라 오늘 날짜(new Date)는 쓸 수 없어 인사 글만 둔다
function Loading() {
  return (
    <div className={s.home} aria-busy="true">
      <section className={s.today} aria-label="오늘의 질문">
        <Greeting title="오늘의 질문을 준비하고 있어요" />
        <QuestionTag />
        <span className={s.skeleton} data-kind="line" />
        <span className={s.skeleton} data-kind="short" />
        <span className={s.skeleton} data-kind="button" />
      </section>
    </div>
  );
}

// 홈을 열면 오늘의 세션을 연다(08 설계 "오늘의 질문 세션").
// 통계·목록은 못 읽어도 오늘의 질문은 보여준다. RLS가 자기 행만 보여준다
async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const today = kstDay(new Date());

  const [started, profile, reviews, recent, study] = await Promise.all([
    userId ? startDailySession(userId) : null,
    supabase.from("profiles").select("nickname, notify_on").maybeSingle(),
    // 숨긴 질문은 다시 나오지 않으므로 뺀다(복습 화면과 같은 기준)
    supabase
      .from("reviews")
      .select(
        "box, due_day, questions!inner(id, prompt, topic_id, topics(field), projects(name))",
      )
      .eq("questions.is_hidden", false)
      .order("due_day")
      .order("question_id"),
    // 기록 화면과 같은 기준: 본 질문을 채점받은 끝난 세션
    // ponytail: 최근 5개만 읽어 거른다. 채점 실패로 끝난 세션이 3개 넘게 몰리면 3개보다 적게 보인다
    supabase
      .from("sessions")
      .select(
        "id, day, questions(id, prompt, project_id), turns(idx, status, score, verdict)",
      )
      .eq("status", "done")
      .order("day", { ascending: false })
      .order("created_at", { ascending: false })
      .order("idx", { referencedTable: "turns" })
      .limit(5),
    loadStudy().catch(() => null),
  ]);
  // 서비스 월 예산에 닿으면 오늘의 질문도 새로 시작하지 않고 안내만 보여준다(04 기능 명세 12장)
  const budget = started === "budget";
  const session = budget ? null : started;
  const turns = session
    ? (
        await supabase
          .from("turns")
          .select("idx, status, score, verdict")
          .eq("session_id", session.id)
          .order("idx")
          // 실패를 빈 목록으로 바꾸면 하던 중인 세션이 "오늘 안 풂"으로 보인다
          .throwOnError()
      ).data
    : [];

  const state = session ? homeState(session.status, turns) : null;
  const allReviews = reviews.data ?? [];
  const reviewing = allReviews.filter((r) => r.box !== null);
  const weak = study ? weaknessReport(study.attempts, today).topics : [];
  const done = state?.kind === "done";

  return (
    <div className={s.home}>
      <section className={s.today} aria-label="오늘의 질문">
        <Greeting
          day={today}
          name={profile.data?.nickname}
          title={state ? TITLES[state.kind] : TITLES.todo}
        />
        {budget ? (
          <>
            <h1 className="sr-only">오늘의 질문</h1>
            <LimitNotice
              title="오늘은 사용 한도를 모두 썼어요"
              lines={["내일 다시 만나요."]}
            />
          </>
        ) : !session || !state ? (
          <Empty />
        ) : done ? (
          <Done
            session={session}
            main={turns[0]}
            review={allReviews.find(
              (r) => r.questions.id === session.question.id,
            )}
            today={today}
          />
        ) : (
          <Today session={session} state={state} />
        )}
        {/* 오늘 질문을 끝냈고 알림이 꺼져 있으면 알림 권한 사전 안내(S32) */}
        {done && profile.data && !profile.data.notify_on && (
          <NotifyPrompt vapidKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
        )}
      </section>

      {/* 학습 현황(stat-tiles home): 모바일 2열, 태블릿 3열, PC 2열. 이번 주는 PC만 */}
      <aside className={s.stats} aria-label="학습 현황">
        <div className={s.tile}>
          <span className={s.tileLabel}>꼬리잇기</span>
          <p className={s.tileValue}>
            <b className="mono">{study?.streak.current ?? "–"}</b>
            {study && study.streak.current > 0 ? "일째" : "일"}
          </p>
        </div>
        <Link href="/review" className={s.tile}>
          <span className={s.tileLabel}>복습 대기 →</span>
          <p className={s.tileValue}>
            <b className={`mono ${s.accent}`}>{reviewing.length}</b>개
          </p>
        </Link>
        {study && <Week study={study} />}
        <Link href="/report" className={`${s.tile} ${s.weak}`}>
          <span className={s.tileLabel}>약한 주제 →</span>
          {weak.length > 0 ? (
            <ul className={s.weakList}>
              {weak.slice(0, 3).map((t) => (
                <li key={t.topicId}>
                  <span className={s.weakName}>{t.topic}</span>
                  <span className={s.weakAvg}>
                    평균
                    <Score value={t.average} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.tileNote}>
              데이터가 모이는 중이에요. 한 주제를 3번 이상 풀면 보여드려요
            </p>
          )}
        </Link>
      </aside>

      {/* 복습할 질문(list-row review): 태블릿·PC는 한 줄, 모바일은 위 줄 복습 시기·숙련도 + 아래 줄 질문 */}
      <section className={s.reviews} aria-labelledby="home-reviews">
        <ListHead id="home-reviews" title="복습할 질문" href="/review">
          {reviewing.length > 0 && (
            <span className={`mono ${h.count}`}>{reviewing.length}</span>
          )}
        </ListHead>
        <ul className={h.list}>
          {reviewing.length === 0 && (
            <li className={h.rowEmpty}>복습할 질문이 없어요</li>
          )}
          {reviewing.slice(0, 3).map((r) => {
            const days = daysUntil(r.due_day, today);
            return (
              <li key={r.questions.id}>
                <Link href="/review" className={`${h.rowLink} ${s.reviewRow}`}>
                  {/* 오늘 다시(밀린 것 포함)만 accent 라벨 */}
                  <span
                    className={`num tag ${days <= 0 ? "tag-today" : "tag-neutral"} ${h.due} ${s.due}`}
                  >
                    {dueLabel(days)}
                  </span>
                  <span className={`${h.rowText} ${s.reviewText}`}>
                    {r.questions.prompt}
                  </span>
                  <span className={s.level}>
                    <Dots level={r.box!} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Recent rows={recent.data ?? []} />
    </div>
  );
}

function ListHead({
  id,
  title,
  href,
  children,
}: {
  id: string;
  title: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <div className={h.listHead}>
      <h2 id={id}>
        {title}
        {children}
      </h2>
      <Link href={href} className={h.more}>
        전체 보기 →
      </Link>
    </div>
  );
}

// 오늘의 질문 라벨과 질문 번호·주제 줄. 은행 질문 번호·주제는 Geist Mono, 프로젝트 이름(한글)은 본문 글꼴
function QuestionTag({
  label = "오늘의 질문",
  q,
}: {
  label?: string;
  q?: DailySession["question"];
}) {
  return (
    <div className={s.tagRow}>
      <span className="tag tag-today">{label}</span>
      {q && (
        <span className={`${q.projectId ? "num" : "mono"} ${s.qMeta}`}>
          {q.label} · {q.topic}
        </span>
      )}
    </div>
  );
}

// 오늘 안 풂·하던 중: 질문을 큰 글로, 아래 주 버튼 하나와 지금 상태 한 줄
function Today({
  session,
  state,
}: {
  session: DailySession;
  state: HomeState;
}) {
  const q = session.question;
  const meta =
    state.kind === "doing"
      ? state.step > 0
        ? `꼬리질문 ${state.step} / 3 진행 중`
        : "본 질문 진행 중"
      : `${session.pick === "review" ? "복습" : "새 질문"} · 약 5분`;
  return (
    <>
      <QuestionTag q={q} />
      {/* 풀기 전 질문은 끝까지 읽혀야 해서 자르지 않는다 */}
      <h1 className={s.display}>{q.prompt}</h1>
      <div className={s.actions}>
        <Link href="/interview" className={`press btn btn-primary ${s.go}`}>
          {state.kind === "doing" ? "이어서 하기" : "시작하기"}
          <Icon name="arrowRight" size={18} bold />
        </Link>
        <span className={`num ${s.hint}`}>{meta}</span>
      </div>
    </>
  );
}

// 낼 질문이 없음(empty-state): 그림 없이 글과 (누를 수 없는) 버튼
function Empty() {
  return (
    <>
      <QuestionTag />
      <h1 className={s.emptyText}>
        범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?
      </h1>
      <div className={s.actions}>
        <button type="button" className={`btn btn-primary ${s.go}`} disabled>
          시작하기
        </button>
      </div>
    </>
  );
}

// 오늘 완료: 질문(3줄까지) · 본 질문 점수와 20칸 막대 · 결과 다시 보기와 다음 복습
function Done({
  session,
  main,
  review,
  today,
}: {
  session: DailySession;
  main?: { score: number | null; verdict: string | null };
  review?: { box: number | null; due_day: string };
  today: string;
}) {
  const q = session.question;
  // 모르겠어요는 0점으로 기록되지만 점수 대신 –로 보여준다(기록 화면과 같다)
  const score = main?.verdict === "unknown" ? null : (main?.score ?? null);
  return (
    <>
      <QuestionTag label="오늘 완료" q={q} />
      <h1 className={`${s.display} ${s.clamp}`}>{q.prompt}</h1>
      <div className={s.doneScore}>
        <p
          className={s.doneNum}
          role="img"
          aria-label={score === null ? "점수 없음" : `100점 만점에 ${score}점`}
        >
          <Score value={score} />
          {score !== null && <span className="mono">/100</span>}
        </p>
        <ScoreBar value={score ?? 0} small />
      </div>
      <div className={s.actions}>
        <Link
          href="/interview/result"
          className={`press btn btn-secondary ${s.go}`}
        >
          결과 다시 보기
        </Link>
        {review && (
          <span className={`num ${s.hint}`}>
            {review.box === null
              ? "복습 완료한 질문이에요"
              : `다음 복습 ${dueLabel(daysUntil(review.due_day, today))} · ${dayLabel(review.due_day)}`}
          </span>
        )}
      </div>
    </>
  );
}

// "2026-10-30" → "10월 30일(금)"(면접 결과 화면과 같다)
function dayLabel(day: string) {
  const [, m, d] = day.split("-").map(Number);
  const dow = "일월화수목금토"[new Date(`${day}T00:00:00Z`).getUTCDay()];
  return `${m}월 ${d}일(${dow})`;
}

type RecentRow = {
  id: string;
  day: string;
  questions: { id: number; prompt: string; project_id: string | null };
  turns: {
    idx: number;
    status: string;
    score: number | null;
    verdict: string | null;
  }[];
};

// 최근 기록(list-row history, PC만): 날짜 · 질문(한 줄) · 점수
function Recent({ rows }: { rows: RecentRow[] }) {
  const items = rows
    .filter((r) => r.turns[0]?.idx === 0 && r.turns[0].status === "graded")
    .slice(0, 3);
  return (
    <section className={s.recent} aria-labelledby="home-recent">
      <ListHead id="home-recent" title="최근 기록" href="/history" />
      <ul className={h.list}>
        {items.length === 0 && (
          <li className={h.rowEmpty}>
            오늘의 질문을 마치면 여기에 기록이 남아요
          </li>
        )}
        {items.map((r) => {
          const main = r.turns[0];
          return (
            <li key={r.id}>
              <Link href={`/history/${r.id}`} className={h.rowLink}>
                <span className={`mono ${h.rowDate}`}>
                  {r.day.slice(5).replace("-", ".")}
                </span>
                <span className={h.rowText}>{r.questions.prompt}</span>
                <Score
                  value={main.verdict === "unknown" ? null : (main.score ?? 0)}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 이번 주 월~일 7칸(PC 학습 현황): 리포트 꼬리잇기 달력과 같은 칸 색(GrassTip.module.css), 오늘 요일 글자는 accent
function Week({ study }: { study: Study }) {
  const cells = grassCells(
    study.scores,
    study.streak.restDays,
    study.today,
  ).slice(-7);
  const studied = cells.filter((c) => c.level > 0).length;
  const rest = cells.filter((c) => c.rest).length;
  const tips = cells.map((c) => weekTip(c, study.today));
  return (
    <div className={`${s.tile} ${s.week}`}>
      <span className={s.tileLabel}>
        이번 주
        <span className={`num ${s.weekNote}`}>
          {studied}일 학습{rest > 0 && ` · 휴식 ${rest}일`}
        </span>
      </span>
      {/* 칸에 마우스를 올리면(터치는 누르면) 날짜·점수 말풍선(리포트와 같다) */}
      <GrassTip className={s.days} label="이번 주" focusable>
        {cells.map((c, i) => (
          <span
            key={c.day}
            className={s.day}
            data-now={c.day === study.today || undefined}
          >
            <span
              tabIndex={0}
              role="img"
              aria-label={tips[i]}
              data-tip={tips[i]}
              data-level={c.level}
              data-rest={c.rest || undefined}
              data-future={c.future || undefined}
              data-today={c.day === study.today || undefined}
            />
            {WEEKDAYS[i]}
          </span>
        ))}
      </GrassTip>
    </div>
  );
}

const WEEKDAYS = "월화수목금토일";

// "2026.10.27 · 74점". 기록 없는 날·휴식권·아직 안 푼 오늘도 알려준다. 앞으로 올 날은 날짜만
function weekTip(c: GrassCell, today: string) {
  const day = c.day.replaceAll("-", ".");
  if (c.rest) return `${day} · 휴식권`;
  if (c.level > 0)
    return c.score == null ? `${day} · 학습` : `${day} · ${c.score}점`;
  if (c.day === today) return `${day} · 오늘`;
  return c.future ? day : `${day} · 기록 없음`;
}
