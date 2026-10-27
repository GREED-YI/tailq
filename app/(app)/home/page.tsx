import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { scoreColor } from "@/app/interview/verdict";
import { AppHeader } from "@/components/AppHeader";
import { FloatingQ } from "@/components/FloatingQ";
import { GrassTip } from "@/components/GrassTip";
import { Icon } from "@/components/icons";
import { LimitNotice } from "@/components/LimitNotice";
import { startDailySession, type DailySession } from "@/lib/daily";
import { kstDay } from "@/lib/daily-pick";
import { homeState, type HomeState } from "@/lib/home";
import { hourLabel } from "@/lib/profile";
import { qLabel, tagLine } from "@/lib/questions";
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
        {/* 닉네임 줄은 더 크게, 닉네임은 강조색(사용자 요청 #115) */}
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
  done: "오늘 질문 끝냈어요",
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
    supabase
      .from("profiles")
      .select("nickname, notify_on, notify_hour")
      .maybeSingle(),
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

  const streakTile = (big: boolean) => (
    <Tile label="꼬리잇기" big={big}>
      <span className={`mono ${s.tileNum} ${s.accent}`}>
        {study?.streak.current ?? "–"}
      </span>
      {study && study.streak.current > 0 ? "일째" : "일"}
    </Tile>
  );
  const reviewTile = (big: boolean) => (
    <Tile label="복습 대기" big={big}>
      <span className={`mono ${s.tileNum}`}>{reviewing.length}</span>개
    </Tile>
  );
  const note = done && (
    <p className={s.note}>
      {profile.data?.notify_on
        ? `내일 ${hourLabel(profile.data.notify_hour)}에 다음 질문이 와요`
        : "내일 새 질문이 준비돼요"}
    </p>
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
        {note && <div className={s.pcOnly}>{note}</div>}
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

        <Section title="복습할 질문" href="/review" show="">
          {reviewing.length === 0 && (
            <li className={rv.empty}>복습할 질문이 없어요</li>
          )}
          {reviewing.slice(0, 3).map((r) => (
            <li key={r.questions.id}>
              <Link href="/review" className={`hover-row ${s.linkRow}`}>
                <span className={s.reviewRow}>
                  <span
                    className={`${r.questions.projects ? "num" : "mono"} ${rv.meta} ${s.rowMeta}`}
                  >
                    {tagLine(r.questions)}
                  </span>
                  <span className={`${rv.prompt} ${s.rowTitle}`}>
                    {r.questions.prompt}
                  </span>
                  <span className={`num ${rv.due} ${s.rowSub}`}>
                    {dueLabel(daysUntil(r.due_day, today))} · 숙련도
                    <Dots level={r.box!} />
                  </span>
                </span>
                <Icon name="chevronRight" size={18} />
              </Link>
            </li>
          ))}
        </Section>

        <RecentSection rows={recent.data ?? []} />

        {done && <Shortcuts className={s.compact} />}
        {note && <div className={s.compact}>{note}</div>}
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
        {done && <Shortcuts />}
      </aside>
    </div>
  );
}

// 오늘의 질문 카드의 3D Q. 처음엔 136이었는데 작아 보인다는 요청으로 키웠다(#115)
const Q_SIZE = 172;

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
    <section className={`glass ${s.card}`} aria-label="오늘의 질문">
      <div className={s.q}>
        <FloatingQ size={Q_SIZE} />
      </div>
      <div className={s.cardHead}>
        <span className={`glass ${q.projectId ? "" : "mono"} ${s.qChip}`}>
          {q.label}
        </span>
        <span className="num">{meta}</span>
      </div>
      <span className={`${q.projectId ? "" : "mono"} ${s.tag}`}>{q.topic}</span>
      <p className={s.prompt}>{q.prompt}</p>
      <Link href="/interview" className={`press ${s.go}`}>
        {state.kind === "doing" ? "이어서 하기" : "시작하기"}
        <span className={s.goArrow}>
          <Icon name="arrowRight" size={18} bold />
        </span>
      </Link>
    </section>
  );
}

function EmptyCard() {
  return (
    <section className={`glass ${s.card}`} aria-label="오늘의 질문">
      <div className={s.q}>
        <FloatingQ size={Q_SIZE} />
      </div>
      <p className={s.emptyText}>
        범위 안의 새 질문을 다 풀었어요. 범위를 넓혀볼까요?
      </p>
      <button type="button" className="btn" disabled style={{ marginTop: 20 }}>
        시작하기
      </button>
    </section>
  );
}

const RING = 2 * Math.PI * 26;

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
    <section
      className={`glass ${s.card} ${s.doneCard}`}
      aria-label="오늘의 질문"
    >
      <div className={s.cardHead}>
        <span className={s.doneChip}>오늘 완료</span>
        <span className={q.projectId ? undefined : "mono"}>
          {q.label} · {q.topic}
        </span>
      </div>
      <div className={s.doneRow}>
        <div className={s.ring}>
          <svg
            width="60"
            height="60"
            viewBox="0 0 60 60"
            role="img"
            aria-label={score === null ? "점수 없음" : `100점 중 ${score}점`}
          >
            <circle
              cx="30"
              cy="30"
              r="26"
              fill="none"
              stroke="var(--track)"
              strokeWidth="6"
            />
            {!!score && (
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke={scoreColor(score)}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${((RING * score) / 100).toFixed(1)} ${RING.toFixed(1)}`}
                transform="rotate(-90 30 30)"
              />
            )}
          </svg>
          <span className="mono" aria-hidden="true">
            {score ?? "–"}
          </span>
        </div>
        {review && (
          <div className={s.next}>
            <span>다음 복습</span>
            {review.box === null ? (
              <strong>익힌 질문이에요</strong>
            ) : (
              <strong className="num">
                {daysUntil(review.due_day, today)}일 뒤
                <span className="mono">
                  ({review.due_day.slice(5).replace("-", "/")})
                </span>
              </strong>
            )}
          </div>
        )}
      </div>
      <Link
        href="/interview/result"
        className={`glass press btn btn-md ${s.again}`}
      >
        결과 다시 보기
      </Link>
    </section>
  );
}

function Tile({
  label,
  big = false,
  children,
}: {
  label: string;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`glass ${s.tile}`} data-big={big || undefined}>
      <span className={s.tileLabel}>{label}</span>
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
  children,
}: {
  title: string;
  href: string;
  show?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${show} ${s.section}`} aria-label={title}>
      <div className={s.sectionHead}>
        <h2>{title}</h2>
        <Link href={href}>전체 보기</Link>
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
      {items.map((r) => {
        const main = r.turns[0];
        const unknown = main.verdict === "unknown";
        const followUps = r.turns.filter(
          (t) => t.idx > 0 && t.status === "graded",
        ).length;
        const meta = [
          unknown && "모르겠어요",
          qLabel(r.questions),
          followUps > 0 && `꼬리질문 ${followUps}개`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={r.id}>
            <Link href={`/history/${r.id}`} className={`hover-row ${h.row}`}>
              <span className={`mono ${h.date} ${s.rowSub}`}>
                {r.day.slice(5).replace("-", ".")}
              </span>
              <span className={h.text}>
                <span className={`num ${h.meta} ${s.rowMeta}`}>{meta}</span>
                <span className={`${h.prompt} ${s.rowTitle}`}>
                  {r.questions.prompt}
                </span>
              </span>
              <span
                className={`mono ${h.score}`}
                style={
                  unknown ? undefined : { color: scoreColor(main.score ?? 0) }
                }
              >
                {unknown ? "–" : main.score}
              </span>
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

const SHORTCUTS = [
  ["/history", "학습 기록"],
  ["/report", "리포트"],
  ["/history?filter=bookmark", "북마크"],
] as const;

// 오늘 완료(S12) 바로 가기
function Shortcuts({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`glass ${s.list} ${s.shortcuts} ${className}`}
      aria-label="바로 가기"
    >
      <ul>
        {SHORTCUTS.map(([href, label], i) => (
          <li key={href}>
            <Link href={href} className={`hover-row ${s.linkRow}`}>
              <span className={s.shortcut}>
                <span className="mono">0{i + 1}</span>
                <span className={s.rowTitle}>{label}</span>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
