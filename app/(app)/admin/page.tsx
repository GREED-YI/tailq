import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { scoreColor, VERDICTS } from "@/app/interview/verdict";
import {
  answersSince,
  isAdmin,
  opsStats,
  SCORE_BANDS,
  type Answer,
  type Signup,
} from "@/lib/admin";
import { kstDay } from "@/lib/daily-pick";
import { categoryLabel, FEEDBACK_CATEGORIES } from "@/lib/feedback";
import { FIELDS } from "@/lib/profile";
import { addDays, studyDay } from "@/lib/streak";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { budgetUsd, loadQuota } from "@/lib/usage";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: "운영 · TailQ",
  robots: { index: false },
};

// 운영자 대시보드: 성공 지표(01 프로젝트 정의)와 채점·질문 은행 상태를 한 화면에서 본다.
// 운영자가 아니면 화면이 있다는 것도 알리지 않도록 404로 보낸다
export default function AdminPage() {
  return (
    <div className={s.page} data-admin>
      <AppHeader />
      <Suspense>
        <Dashboard />
      </Suspense>
    </div>
  );
}

// 질문 은행 목표: 분야별 50개 이상(04 기능 명세 12장)
const BANK_GOAL = 50;
const PAGE = 1000;

// PostgREST가 한 번에 1000행까지만 주므로 나눠 읽는다
// ponytail: 행을 다 읽어 와서 집계한다. 답변이 수만 개가 되면 DB 함수로 옮긴다
async function readAll<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function Dashboard() {
  const { data: auth } = await (await createClient()).auth.getClaims();
  if (!isAdmin(auth?.claims.sub, process.env.ADMIN_USER_IDS)) notFound();

  // 운영자 확인을 마친 뒤에만 RLS를 건너뛰어 모든 사용자 행을 집계한다
  const db = createAdminClient();
  const today = kstDay(new Date());
  const [
    profiles,
    turns,
    questions,
    reviewsDue,
    bookmarks,
    feedback,
    feedbackKinds,
    quota,
  ] = await Promise.all([
    readAll((from, to) =>
      db
        .from("profiles")
        .select("id, created_at, onboarded_at")
        .order("id")
        .range(from, to),
    ),
    // 채점이 20초 넘게 멈춘 턴도 실패로 세도록 turn_states.effective_status를 읽는다
    readAll((from, to) =>
      db
        .from("turn_states")
        .select(
          "id, idx, effective_status, answered_at, score, verdict, rating, sessions!inner(user_id)",
        )
        .gte("answered_at", `${answersSince(today)}T00:00:00+09:00`)
        // 로그인 없는 체험(user_id 없음)은 회원 지표에서 뺀다. 체험은 지표 이벤트로 센다
        .not("sessions.user_id", "is", null)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      db
        .from("questions")
        .select("id, is_hidden, topics!inner(field)")
        .order("id")
        .range(from, to),
    ),
    db
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .not("box", "is", null)
      .lte("due_day", today)
      .throwOnError(),
    db
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .throwOnError(),
    // 전체 개수와 최근 3개
    db
      .from("feedback")
      .select("id, body, category, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(3)
      .throwOnError(),
    // 분류별 개수를 세려고 분류만 읽는다
    readAll((from, to) =>
      db.from("feedback").select("category").order("id").range(from, to),
    ),
    // 이번 달(KST) AI 비용 합계와 예산 상태(ai_usage)
    loadQuota(db, null),
  ]);

  const signups: Signup[] = profiles.map((p) => ({
    userId: p.id,
    createdAt: p.created_at,
    onboardedAt: p.onboarded_at,
  }));
  const answers: Answer[] = turns.map((t) => ({
    userId: t.sessions.user_id!,
    idx: t.idx!,
    answeredAt: t.answered_at!,
    status: t.effective_status!,
    score: t.score,
    verdict: t.verdict,
    rating: t.rating,
  }));
  const st = opsStats(signups, answers, today);
  const peak = Math.max(...st.weekly.map((w) => w.count), 1);
  const bandPeak = Math.max(...st.scoreBands, 1);
  const gradedTotal = st.scoreBands.reduce((a, b) => a + b, 0);
  const verdictTotal = Object.values(st.verdicts).reduce((a, b) => a + b, 0);
  const diff = st.thisWeek - st.lastWeek;

  // 벤토 그리드: 성공 지표(북극성 답변 수, D7, 👍)를 왼쪽 위 큰 칸과 그 옆에, 상태 지표는 아래로.
  // 칸 배치는 CSS grid-template-areas가 화면 폭마다 정한다
  return (
    <>
      <header className={s.top}>
        <h1>운영 대시보드</h1>
        <span className="num">
          {today.replaceAll("-", ".")} 기준 · 한국 시간
        </span>
      </header>

      <div className={s.bento}>
        <section
          className={`glass ${s.hero}`}
          style={{ gridArea: "hero" }}
          aria-labelledby="north-head"
        >
          <div className={s.heroText}>
            <h2 id="north-head">
              이번 주 답변 제출 <span className={s.badge}>북극성</span>
            </h2>
            <strong>
              <span className={`mono ${s.big}`}>{st.thisWeek}</span> 개
            </strong>
            <span className="num" data-trend={trend(diff)}>
              지난주 {st.lastWeek}개
              {diff !== 0 && ` · ${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}`}
            </span>
          </div>
          <ol className={s.weeks} aria-label="최근 8주 답변 제출 수">
            {st.weekly.map((w, i) => {
              const prev = st.weekly[i - 1]?.count;
              const tip = `${dot(w.week)}~${dot(addDays(w.week, 6))} · ${w.count}개${
                prev == null || prev === w.count
                  ? ""
                  : ` (${w.count > prev ? "▲" : "▼"} ${Math.abs(w.count - prev)})`
              }`;
              return (
                <Tip key={w.week} as="li" tip={tip}>
                  <span className="mono">{w.count}</span>
                  <i
                    style={{ height: `${(w.count / peak) * 100}%` }}
                    data-now={i === st.weekly.length - 1 || undefined}
                  />
                  <small className="num">{dot(w.week)}</small>
                </Tip>
              );
            })}
          </ol>
        </section>

        <Stat
          area="d7"
          label="D7 재방문"
          value={st.d7.rate}
          unit="%"
          goal={20}
          note={`가입 7~35일 ${st.d7.cohort}명 중`}
        />
        <Stat
          area="thumbs"
          label="채점 만족 👍"
          value={st.thumbsUp.rate}
          unit="%"
          goal={70}
          note={`평가 ${st.thumbsUp.count}개 중`}
        />
        <Stat
          area="active"
          label="이번 주 답한 사람"
          value={st.activeThisWeek}
          unit="명"
        />
        <Stat
          area="users"
          label="가입자"
          value={st.users.total}
          unit="명"
          note={`이번 주 +${st.users.newThisWeek}`}
        />

        <Card
          area="score"
          title="본 질문 점수 분포"
          meta={
            st.average == null ? "최근 8주" : `최근 8주 · 평균 ${st.average}점`
          }
        >
          <ul className={s.bands}>
            {SCORE_BANDS.map((band, i) => {
              const n = st.scoreBands[i];
              return (
                <Tip
                  key={band}
                  as="li"
                  tip={`${band}점 · ${n}개 (${share(n, gradedTotal)}%)`}
                >
                  <span className="num">{band}</span>
                  <span className={s.track}>
                    <i
                      style={{
                        width: `${(n / bandPeak) * 100}%`,
                        background: scoreColor(i * 20),
                      }}
                    />
                  </span>
                  <span className="mono">{n}</span>
                </Tip>
              );
            })}
          </ul>
        </Card>

        <Card
          area="verdict"
          title="꼬리질문 판정"
          meta={`최근 8주 · ${verdictTotal}개`}
        >
          <div className={s.stack}>
            {Object.entries(VERDICTS)
              .filter(([key]) => st.verdicts[key])
              .map(([key, v]) => (
                <Tip
                  key={key}
                  as="i"
                  tip={`${v.label} · ${share(st.verdicts[key], verdictTotal)}%`}
                  style={{ flexGrow: st.verdicts[key], background: v.color }}
                />
              ))}
          </div>
          <ul className={s.legend}>
            {Object.entries(VERDICTS).map(([key, v]) => (
              <li key={key}>
                <i style={{ background: v.color }} />
                {v.label}
                <span className="mono">{st.verdicts[key] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          area="bank"
          title="질문 은행"
          meta={`공개 ${questions.filter((q) => !q.is_hidden).length}개 · 숨김 ${questions.filter((q) => q.is_hidden).length}개`}
        >
          <ul className={s.bands}>
            {FIELDS.map((f) => {
              const n = questions.filter(
                (q) => !q.is_hidden && q.topics.field === f.id,
              ).length;
              return (
                <Tip
                  key={f.id}
                  as="li"
                  tip={
                    n >= BANK_GOAL
                      ? `${f.label} · 목표 달성`
                      : `${f.label} · 목표까지 ${BANK_GOAL - n}개`
                  }
                >
                  <span>{f.label}</span>
                  <span className={s.track}>
                    <i
                      style={{
                        width: `${Math.min(n / BANK_GOAL, 1) * 100}%`,
                        background:
                          n >= BANK_GOAL ? "var(--good)" : "var(--low)",
                      }}
                    />
                  </span>
                  <span className="mono">
                    {n}/{BANK_GOAL}
                  </span>
                </Tip>
              );
            })}
          </ul>
        </Card>

        <Link
          href="/admin/feedback"
          className={`glass press ${s.card} ${s.feedback}`}
          style={{ gridArea: "feedback" }}
        >
          <span className={s.head}>
            <strong>사용자 피드백</strong>
            <span className="num">
              전체 {feedback.count ?? 0}개 · 모두 보기 ›
            </span>
          </span>
          <ul className={s.kinds} aria-label="분류별 개수">
            {FEEDBACK_CATEGORIES.map((c) => (
              <li key={c.id} className="num">
                {c.label}{" "}
                <span className="mono">
                  {feedbackKinds.filter((k) => k.category === c.id).length}
                </span>
              </li>
            ))}
          </ul>
          {feedback.data.length === 0 ? (
            <span className={s.empty}>아직 받은 피드백이 없어요</span>
          ) : (
            <ul className={s.voices}>
              {feedback.data.map((v) => (
                <li key={v.id}>
                  <p>
                    <span className={s.kind} data-kind={v.category}>
                      {categoryLabel(v.category)}
                    </span>
                    {v.body}
                  </p>
                  <time className="num" dateTime={v.created_at}>
                    {dot(studyDay(v.created_at))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Link>

        <Stat
          area="onboard"
          label="온보딩 완료"
          value={st.users.onboardRate}
          unit="%"
          note="가입자 중"
        />
        <Stat
          area="fail"
          label="채점 실패"
          value={st.failRate}
          unit="%"
          note="최근 8주 답변 중"
          warn={(st.failRate ?? 0) > 5}
        />
        <Stat
          area="review"
          label="복습 대기"
          value={reviewsDue.count}
          unit="개"
        />
        <Stat
          area="bookmark"
          label="북마크"
          value={bookmarks.count}
          unit="개"
        />

        <Soon
          area="visit"
          title="첫 방문 → 첫 답변"
          body="첫 방문자 중 첫 답변까지 간 비율(목표 50%)을 보여줄 자리예요."
          issue={44}
        />
        <Stat
          area="cost"
          label="AI 비용 · 이번 달 예산"
          value={Math.round((quota.spentUsd / budgetUsd()) * 100)}
          unit="%"
          note={costNote(quota.spentUsd, budgetUsd())}
          // 80%를 넘으면 새 세션의 본 질문 채점이 Haiku로 낮아진다(09 채점 5장)
          warn={quota.budget !== "ok"}
        />
      </div>
    </>
  );
}

// "$3.21 / $20 · 약 4,494원". 원화는 보여줄 때만 고정 환율 KRW_PER_USD로 바꾼다(08 설계)
function costNote(spent: number, budget: number) {
  const krw = Number(process.env.KRW_PER_USD);
  const usd = `$${spent.toFixed(2)} / $${budget}`;
  return krw > 0
    ? `${usd} · 약 ${Math.round(spent * krw).toLocaleString()}원`
    : usd;
}

const trend = (c: number) => (c === 0 ? undefined : c > 0 ? "up" : "down");

const share = (n: number, total: number) =>
  total ? Math.round((n / total) * 100) : 0;

// "2026-10-26" → "10.26"
const dot = (day: string) => day.slice(5).replace("-", ".");

// 차트 한 칸: 마우스를 올리거나 키보드로 고르면 자세한 값을 말풍선으로 보여준다
function Tip({
  as: Tag,
  tip,
  style,
  children,
}: {
  as: "li" | "i";
  tip: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <Tag
      className={s.tip}
      data-tip={tip}
      aria-label={tip}
      tabIndex={0}
      style={style}
    >
      {children}
    </Tag>
  );
}

function Stat({
  area,
  label,
  value,
  unit,
  note,
  goal,
  warn = false,
}: {
  area: string;
  label: string;
  value: number | null | undefined;
  unit: string;
  note?: string;
  goal?: number;
  warn?: boolean;
}) {
  const met = goal != null && value != null ? value >= goal : undefined;
  return (
    <div className={`glass ${s.stat}`} style={{ gridArea: area }}>
      <span>{label}</span>
      <strong>
        <span
          className={`mono ${s.value}`}
          data-met={met}
          data-warn={warn || undefined}
        >
          {value ?? "–"}
        </span>{" "}
        {unit}
      </strong>
      {goal != null && (
        // 목표 대비 막대. 세로 눈금이 목표 위치다
        <span className={s.goal} aria-hidden>
          <i
            style={{ width: `${Math.min(value ?? 0, 100)}%` }}
            data-met={met}
          />
          <b style={{ left: `${goal}%` }} />
        </span>
      )}
      {(note || goal != null) && (
        <small className="num">
          {[note, goal != null && `목표 ${goal}${unit}`]
            .filter(Boolean)
            .join(" · ")}
        </small>
      )}
    </div>
  );
}

function Card({
  area,
  title,
  meta,
  children,
}: {
  area: string;
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`glass ${s.card}`}
      style={{ gridArea: area }}
      aria-label={title}
    >
      <div className={s.head}>
        <h2>{title}</h2>
        <span className="num">{meta}</span>
      </div>
      {children}
    </section>
  );
}

// 아직 데이터가 없는 지표 자리. 누르면 기록을 시작할 이슈로 간다
function Soon({
  area,
  title,
  body,
  issue,
}: {
  area: string;
  title: string;
  body: string;
  issue: number;
}) {
  return (
    <a
      href={`https://github.com/GREED-YI/tailq/issues/${issue}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`press ${s.soonCard}`}
      style={{ gridArea: area }}
    >
      <span className={s.head}>
        <strong>{title}</strong>
        <span className={s.badge}>준비 중</span>
      </span>
      <span className={s.soonBody}>
        {body} <span className="num">#{issue}</span>에서 기록을 시작하면
        채워져요.
      </span>
    </a>
  );
}
