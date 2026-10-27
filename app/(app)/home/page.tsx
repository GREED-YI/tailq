import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { scoreColor } from "@/app/interview/verdict";
import { AppHeader } from "@/components/AppHeader";
import { FloatingQ } from "@/components/FloatingQ";
import { GrassTip } from "@/components/GrassTip";
import { Icon } from "@/components/icons";
import { LimitNotice } from "@/components/LimitNotice";
import { TailIcon } from "@/components/Streak";
import { startDailySession, type DailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { homeState, type HomeState } from "@/lib/home";
import { questionTags } from "@/lib/questions";
import { daysUntil, dueLabel } from "@/lib/review";
import { grassCells, type GrassCell } from "@/lib/streak";
import { loadStudy, type Study } from "@/lib/study";
import { createClient } from "@/lib/supabase/server";
import { weaknessReport } from "@/lib/weakness";
import h from "../history/history.module.css";
import rv from "../review/review.module.css";
import s from "./home.module.css";
import { NotifyPrompt } from "./NotifyPrompt";

// 홈(S10 오늘 안 풂 · S11 하던 중 · S12 오늘 완료). 모바일은 카드와 통계,
// 태블릿·PC는 복습할 질문·최근 기록 미리보기를 더하고, PC는 오른쪽 열에 통계·이번 주·약한 주제를 둔다(docs/07)
export default function HomePage() {
  return (
    <>
      <AppHeader />
      <Suspense fallback={<Greeting title="오늘의 질문을 준비하고 있어요" />}>
        <Home />
      </Suspense>
    </>
  );
}

function Greeting({ name, title }: { name?: string; title: string }) {
  return (
    <div className={s.head}>
      <h1 className={s.title}>
        {/* 닉네임 줄은 따로 한 줄, 닉네임만 강조색(사용자 요청 #115) */}
        {name && (
          <span className={s.hello}>
            <span className={s.name}>{name}</span>님,
          </span>
        )}
        {title}
      </h1>
    </div>
  );
}

const TITLES: Record<HomeState["kind"], string> = {
  todo: "오늘도 한 문제 도전해 볼까요?",
  doing: "하던 질문 마저 이어가 볼까요?",
  done: "오늘 면접 응시 완료했어요",
};

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
  const nickname = profile.data?.nickname;

  // 라벨 앞 아이콘은 배경 칩 없이 아이콘만(꼬리잇기 강조색 · 복습 대기 --mid, #115 개편안)
  const streakTile = (big: boolean) => (
    <Tile
      label="꼬리잇기"
      icon={
        <span className={s.accent}>
          <TailIcon size={18} />
        </span>
      }
      big={big}
    >
      <span className={`mono ${s.tileNum} ${s.accent}`}>
        {study?.streak.current ?? "–"}
      </span>
      {study && study.streak.current > 0 ? "일째" : "일"}
    </Tile>
  );
  const reviewTile = (big: boolean) => (
    <Tile
      label="복습 대기"
      icon={
        <span className={s.warm}>
          <Icon name="review" size={18} />
        </span>
      }
      big={big}
    >
      <span className={`mono ${s.tileNum}`}>{reviewing.length}</span>개
    </Tile>
  );

  return (
    <div className={s.home}>
      <Greeting
        name={nickname}
        title={state ? TITLES[state.kind] : TITLES.todo}
      />

      <div className={s.main}>
        {budget ? (
          <LimitNotice
            title="오늘은 사용 한도를 모두 썼어요"
            lines={["내일 다시 만나요."]}
          />
        ) : !session || !state ? (
          <EmptyCard />
        ) : done ? (
          <DoneCard
            session={session}
            main={turns[0]}
            review={allReviews.find(
              (r) => r.questions.id === session.question.id,
            )}
            today={today}
          />
        ) : (
          <TodayCard session={session} state={state} />
        )}
        {/* 처음엔 카드 아래에 "내일 오전 8:00에 다음 질문이 와요" 안내가 있었는데 개편안에서 뺐다(#115, 사용자 요청) */}
        {/* 오늘 질문을 끝냈고 알림이 꺼져 있으면 알림 권한 사전 안내(S32) */}
        {done && profile.data && !profile.data.notify_on && (
          <NotifyPrompt vapidKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
        )}

        <section
          aria-label="통계"
          className={`${s.compact} ${done ? s.stats2 : s.stats3}`}
        >
          {streakTile(done)}
          {reviewTile(done)}
          {!done && (
            <Tile label="약한 주제">
              {weak[0] ? (
                <span className={s.tileText}>{weak[0].topic}</span>
              ) : (
                <span className={s.tileNote}>데이터가 모이는 중</span>
              )}
            </Tile>
          )}
        </section>

        {/* 복습할 질문: 질문 1줄 + 분류 칩 · 복습 시기 · 숙련도(#115 개편안, 복습 시기는 사용자 요청) */}
        <Section
          title="복습할 질문"
          href="/review"
          show=""
          count={reviewing.length}
        >
          {reviewing.length === 0 && (
            <li className={rv.empty}>복습할 질문이 없어요</li>
          )}
          {reviewing.slice(0, 3).map((r) => {
            const days = daysUntil(r.due_day, today);
            return (
              <li key={r.questions.id}>
                <Link href="/review" className={`hover-row ${s.reviewRow}`}>
                  <span className={s.rowText}>
                    <span className={s.rowTitle}>{r.questions.prompt}</span>
                    <span className={s.rowSub}>
                      <span
                        className={`${r.questions.projects ? "" : "mono"} ${s.mini}`}
                      >
                        {questionTags(r.questions).topic}
                      </span>
                      {/* 오늘 다시(밀린 것 포함)만 강조색으로 짚는다 */}
                      <span
                        className={`num ${s.due}`}
                        data-now={days <= 0 || undefined}
                      >
                        {dueLabel(days)}
                      </span>
                      <span className={s.level}>
                        숙련도
                        <Dots level={r.box!} />
                      </span>
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            );
          })}
        </Section>

        <RecentSection rows={recent.data ?? []} />
        {/* 처음엔 오늘 완료(S12)에 "바로 가기"(학습 기록·리포트·북마크)가 있었는데 사이드 메뉴·탭바와 겹쳐 뺐다(#115 개편안) */}
      </div>

      <aside className={s.side} aria-label="학습 현황">
        <div className={s.sideStats}>
          {streakTile(true)}
          {reviewTile(true)}
        </div>
        {study && <Week study={study} />}
        <section className={`glass ${s.panel}`} aria-label="약한 주제">
          <div className={s.panelHead}>
            <h2>약한 주제</h2>
            <Link href="/report">전체 보기</Link>
          </div>
          {weak.length > 0 ? (
            <ul className={s.weakList}>
              {weak.slice(0, 3).map((t) => (
                <li key={t.topicId} className={s.weakRow}>
                  <span className={s.weakName}>{t.topic}</span>
                  <span
                    className={`num ${s.weakAvg}`}
                    style={{ color: scoreColor(t.average) }}
                  >
                    평균 {t.average}점
                  </span>
                  <span className={s.weakBar} aria-hidden="true">
                    <span
                      style={{
                        width: `${t.average}%`,
                        background: scoreColor(t.average),
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.tileNote}>
              데이터가 모이는 중이에요. 한 주제를 3번 이상 풀면 보여드려요
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

// 오늘의 질문 카드 한 틀(#115 개편안). 왼쪽 점수 원(오늘 완료) 또는 3D Q, 오른쪽 위 칩 · 가운데 질문 · 아래 다음 복습 칩과 버튼.
// 모바일은 원 옆에 칩만 두고 질문과 아래 줄은 카드 폭 전체를 쓴다. 처음엔 상태마다 카드 모양이 달랐는데(안 풂은 3D Q 172 + 큰 질문,
// 완료는 점수 원 60 + 다음 복습 두 줄 + 카드 아래 안내) 한 틀로 맞췄다
function Card({
  visual,
  chips,
  title,
  foot,
}: {
  visual: ReactNode;
  chips?: ReactNode;
  title: ReactNode;
  foot: ReactNode;
}) {
  return (
    <section className={`glass ${s.card}`} aria-label="오늘의 질문">
      <div className={s.visual}>{visual}</div>
      {chips && <div className={s.chips}>{chips}</div>}
      {title}
      <div className={s.foot}>{foot}</div>
    </section>
  );
}

// 3D Q는 점수 원 자리(88, 모바일 80)에 든다. 처음엔 136, 작아 보인다는 요청으로 172까지 키웠는데 개편안에서 점수 원과 같은 크기로 줄였다(#115)
const Q_SIZE = 80;

function TodayCard({
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
    <Card
      visual={<FloatingQ size={Q_SIZE} />}
      chips={
        <>
          <span className={`num ${s.statusChip}`}>{meta}</span>
          <span className={`${q.projectId ? "" : "mono"} ${s.cat}`}>
            {q.topic}
          </span>
        </>
      }
      // 풀기 전 질문은 끝까지 읽혀야 해서 오늘 완료와 달리 2줄로 자르지 않는다
      title={<p className={s.cardTitle}>{q.prompt}</p>}
      foot={
        <Link
          href="/interview"
          className={`press btn btn-primary ${s.cardBtn}`}
        >
          {state.kind === "doing" ? "이어서 하기" : "시작하기"}
          <Icon name="arrowRight" size={16} bold />
        </Link>
      }
    />
  );
}

function EmptyCard() {
  return (
    <Card
      visual={<FloatingQ size={Q_SIZE} />}
      title={
        <p className={s.emptyText}>
          범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?
        </p>
      }
      foot={
        <button type="button" className={`btn ${s.cardBtn}`} disabled>
          시작하기
        </button>
      }
    />
  );
}

// 점수 원 88(선 8). 모바일 80은 CSS가 줄인다(viewBox 그대로라 선도 같이 줄어든다)
const RING = 2 * Math.PI * 40;

function DoneCard({
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
    <Card
      visual={
        <div className={s.ring}>
          <svg
            viewBox="0 0 88 88"
            role="img"
            aria-label={score === null ? "점수 없음" : `100점 중 ${score}점`}
          >
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="var(--track)"
              strokeWidth="8"
            />
            {!!score && (
              <circle
                cx="44"
                cy="44"
                r="40"
                fill="none"
                stroke={scoreColor(score)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${((RING * score) / 100).toFixed(1)} ${RING.toFixed(1)}`}
                transform="rotate(-90 44 44)"
              />
            )}
          </svg>
          <span className={s.ringNum} aria-hidden="true">
            <b
              className="mono"
              style={score === null ? undefined : { color: scoreColor(score) }}
            >
              {score ?? "–"}
            </b>
            {score !== null && <small>점</small>}
          </span>
        </div>
      }
      chips={
        <>
          <span className={s.statusChip}>오늘 완료</span>
          <span className={`${q.projectId ? "" : "mono"} ${s.cat}`}>
            {q.topic}
          </span>
        </>
      }
      title={<p className={`${s.cardTitle} ${s.clamp}`}>{q.prompt}</p>}
      foot={
        <>
          {/* 다음 복습은 칩 한 줄. 처음엔 "3일 뒤 (10/30)"이 점수처럼 읽혀 두 줄로 썼는데 개편안에서 아이콘 칩으로 바꿨다(#115) */}
          {review && (
            <span className={`num ${s.dueChip}`}>
              <Icon name="review" size={15} />
              {review.box === null ? (
                "복습 완료한 질문이에요"
              ) : (
                <>
                  {dueLabel(daysUntil(review.due_day, today))} ·{" "}
                  <span className={s.longDay}>{dayLabel(review.due_day)}</span>
                  <span className={s.shortDay}>
                    {dayLabel(review.due_day, true)}
                  </span>
                </>
              )}
            </span>
          )}
          <Link
            href="/interview/result"
            className={`glass press btn btn-secondary ${s.cardBtn}`}
          >
            결과 다시 보기
          </Link>
        </>
      }
    />
  );
}

// "2026-10-30" → "10월 30일(금)"(면접 결과 화면과 같다), short는 모바일 칩용 "10/30(금)"
function dayLabel(day: string, short = false) {
  const [, m, d] = day.split("-").map(Number);
  const dow = "일월화수목금토"[new Date(`${day}T00:00:00Z`).getUTCDay()];
  return short ? `${m}/${d}(${dow})` : `${m}월 ${d}일(${dow})`;
}

function Tile({
  label,
  icon,
  big = false,
  children,
}: {
  label: string;
  icon?: ReactNode;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`glass ${s.tile}`} data-big={big || undefined}>
      <span className={s.tileLabel}>
        {icon}
        {label}
      </span>
      <strong className={s.tileValue}>{children}</strong>
    </div>
  );
}

function Dots({ level }: { level: number }) {
  return (
    <span className={rv.dots} role="img" aria-label={`5칸 중 ${level}칸`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= level ? rv.on : undefined} />
      ))}
    </span>
  );
}

// 복습할 질문은 모든 기기(처음엔 태블릿·PC만이었는데 모바일 홈 아래가 비어 보여 넣었다, #110),
// 최근 기록은 PC만(Figma C안 태블릿 홈에는 최근 기록이 없다)
function Section({
  title,
  href,
  show = s.wide,
  count,
  children,
}: {
  title: string;
  href: string;
  show?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className={`${show} ${s.section}`} aria-label={title}>
      <div className={s.sectionHead}>
        <h2>{title}</h2>
        {/* "전체 보기 6": 목록이 3개에서 잘려도 모두 몇 개인지 보인다(#115 개편안) */}
        <Link href={href} className="num">
          전체 보기{!!count && <b>{count}</b>}
        </Link>
      </div>
      <ul className={`glass ${s.list}`}>{children}</ul>
    </section>
  );
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

function RecentSection({ rows }: { rows: RecentRow[] }) {
  const items = rows
    .filter((r) => r.turns[0]?.idx === 0 && r.turns[0].status === "graded")
    .slice(0, 3);
  return (
    <Section title="최근 기록" href="/history" show={s.pcOnly}>
      {items.length === 0 && (
        <li className={rv.empty}>오늘의 질문을 마치면 여기에 기록이 남아요</li>
      )}
      {/* 한 줄 행: 날짜 · 질문(말줄임) · 점수 · 화살표. 처음엔 번호·꼬리질문 수 메타 줄과 질문 2줄이었는데 개편안에서 줄였다(#115) */}
      {items.map((r) => {
        const main = r.turns[0];
        const unknown = main.verdict === "unknown";
        return (
          <li key={r.id}>
            <Link
              href={`/history/${r.id}`}
              className={`hover-row ${h.row} ${s.recentRow}`}
            >
              <span className={`num ${s.recentDate}`}>
                {r.day.slice(5).replace("-", ".")}
              </span>
              <span className={s.rowTitle}>{r.questions.prompt}</span>
              <span
                className={`num ${h.score}`}
                style={
                  unknown ? undefined : { color: scoreColor(main.score ?? 0) }
                }
              >
                {unknown ? "–" : main.score}
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
          </li>
        );
      })}
    </Section>
  );
}

// 이번 주 월~일 7칸: 학습 잔디처럼 점수 단계 색, 휴식권 빗금, 오늘 테두리(docs/07 결정 13)
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
    <section className={`glass ${s.panel}`} aria-label="이번 주">
      <div className={s.panelHead}>
        <h2>이번 주</h2>
        <span className="num">
          {studied}일 학습{rest > 0 && ` · 휴식 ${rest}일`}
        </span>
      </div>
      {/* 칸에 마우스를 올리면(터치는 누르면) 날짜·점수 말풍선(리포트 학습 잔디와 같다) */}
      <GrassTip className={s.week} label="이번 주" focusable>
        {cells.map((c, i) => (
          <span
            key={c.day}
            className={s.day}
            data-today={c.day === study.today || undefined}
          >
            <span
              tabIndex={0}
              role="img"
              aria-label={tips[i]}
              data-tip={tips[i]}
              data-level={c.level}
              data-rest={c.rest || undefined}
            />
            {WEEKDAYS[i]}
          </span>
        ))}
      </GrassTip>
    </section>
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
