import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
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
import { FIELDS } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: "운영 · TailQ",
  robots: { index: false },
};

// 운영자 대시보드: 성공 지표(01 프로젝트 정의)와 채점·질문 은행 상태를 한 화면에서 본다.
// 운영자가 아니면 화면이 있다는 것도 알리지 않도록 404로 보낸다
export default function AdminPage() {
  return (
    <div className={s.page}>
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
  const [profiles, turns, questions, reviewsDue, bookmarks] = await Promise.all(
    [
      readAll((from, to) =>
        db
          .from("profiles")
          .select("id, created_at, onboarded_at")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("turns")
          .select(
            "id, idx, status, answered_at, score, verdict, rating, sessions!inner(user_id)",
          )
          .gte("answered_at", `${answersSince(today)}T00:00:00+09:00`)
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
    ],
  );

  const signups: Signup[] = profiles.map((p) => ({
    userId: p.id,
    createdAt: p.created_at,
    onboardedAt: p.onboarded_at,
  }));
  const answers: Answer[] = turns.map((t) => ({
    userId: t.sessions.user_id,
    idx: t.idx,
    answeredAt: t.answered_at!,
    status: t.status,
    score: t.score,
    verdict: t.verdict,
    rating: t.rating,
  }));
  const st = opsStats(signups, answers, today);
  const peak = Math.max(...st.weekly.map((w) => w.count), 1);
  const bandPeak = Math.max(...st.scoreBands, 1);
  const verdictTotal = Object.values(st.verdicts).reduce((a, b) => a + b, 0);
  const diff = st.thisWeek - st.lastWeek;

  return (
    <>
      <header className={s.top}>
        <h1>운영 대시보드</h1>
        <span className="num">
          {today.replaceAll("-", ".")} 기준 · 한국 시간
        </span>
      </header>

      <section className={`glass ${s.hero}`} aria-labelledby="north-head">
        <div className={s.heroText}>
          <h2 id="north-head">이번 주 답변 제출</h2>
          <strong>
            <span className={`mono ${s.big}`}>{st.thisWeek}</span> 개
          </strong>
          <span className="num" data-trend={trend(diff)}>
            지난주 {st.lastWeek}개
            {diff !== 0 && ` · ${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}`}
          </span>
        </div>
        <ol
          className={s.weeks}
          aria-label={`최근 8주 답변 제출 수: ${st.weekly.map((w) => w.count).join(", ")}`}
        >
          {st.weekly.map((w, i) => (
            <li key={w.week} title={`${w.week} 주 · ${w.count}개`}>
              <span className="mono">{w.count}</span>
              <i
                style={{ height: `${(w.count / peak) * 100}%` }}
                data-now={i === st.weekly.length - 1 || undefined}
              />
              <small className="num">{w.week.slice(5).replace("-", ".")}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className={s.stats} aria-label="핵심 지표">
        <Stat
          label="가입자"
          value={st.users.total}
          unit="명"
          note={`이번 주 +${st.users.newThisWeek}`}
        />
        <Stat label="이번 주 답한 사람" value={st.activeThisWeek} unit="명" />
        <Stat
          label="온보딩 완료"
          value={st.users.onboardRate}
          unit="%"
          note="가입자 중"
        />
        <Stat
          label="D7 재방문"
          value={st.d7.rate}
          unit="%"
          goal={20}
          note={`가입 7~35일 ${st.d7.cohort}명 중`}
        />
        <Stat
          label="채점 만족 👍"
          value={st.thumbsUp.rate}
          unit="%"
          goal={70}
          note={`평가 ${st.thumbsUp.count}개`}
        />
        <Stat
          label="채점 실패"
          value={st.failRate}
          unit="%"
          note="최근 8주 답변 중"
          warn={(st.failRate ?? 0) > 5}
        />
        <Stat label="복습 대기" value={reviewsDue.count} unit="개" />
        <Stat label="북마크" value={bookmarks.count} unit="개" />
      </section>

      <div className={s.grid}>
        <Card
          title="본 질문 점수 분포"
          meta={
            st.average == null ? "최근 8주" : `최근 8주 · 평균 ${st.average}점`
          }
        >
          <ul className={s.bands}>
            {SCORE_BANDS.map((band, i) => (
              <li key={band}>
                <span className="num">{band}</span>
                <span className={s.track}>
                  <i
                    style={{
                      width: `${(st.scoreBands[i] / bandPeak) * 100}%`,
                      background: scoreColor(i * 20),
                    }}
                  />
                </span>
                <span className="mono">{st.scoreBands[i]}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="꼬리질문 판정" meta={`최근 8주 · ${verdictTotal}개`}>
          <div className={s.stack} role="img" aria-label="꼬리질문 판정 비율">
            {Object.entries(VERDICTS).map(([key, v]) => (
              <i
                key={key}
                style={{
                  flexGrow: st.verdicts[key] ?? 0,
                  background: v.color,
                }}
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
          title="질문 은행"
          meta={`공개 ${questions.filter((q) => !q.is_hidden).length}개 · 숨김 ${questions.filter((q) => q.is_hidden).length}개`}
        >
          <ul className={s.bands}>
            {FIELDS.map((f) => {
              const n = questions.filter(
                (q) => !q.is_hidden && q.topics.field === f.id,
              ).length;
              return (
                <li key={f.id}>
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
                </li>
              );
            })}
          </ul>
        </Card>

        <div className={s.soon}>
          <Soon
            title="AI 비용 · 월 예산"
            body="월 $20 중 사용량과 80% 경고를 보여줄 자리예요"
            issue={43}
          />
          <Soon
            title="첫 방문 → 첫 답변"
            body="첫 방문자 중 첫 답변까지 간 비율(목표 50%)을 보여줄 자리예요"
            issue={44}
          />
        </div>
      </div>
    </>
  );
}

const trend = (c: number) => (c === 0 ? undefined : c > 0 ? "up" : "down");

function Stat({
  label,
  value,
  unit,
  note,
  goal,
  warn = false,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  note?: string;
  goal?: number;
  warn?: boolean;
}) {
  const met = goal != null && value != null ? value >= goal : undefined;
  return (
    <div className={`glass ${s.stat}`}>
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
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section className={`glass ${s.card}`} aria-label={title}>
      <div className={s.head}>
        <h2>{title}</h2>
        <span className="num">{meta}</span>
      </div>
      {children}
    </section>
  );
}

// 아직 데이터가 없는 지표 자리. 그 이슈에서 채운다
function Soon({
  title,
  body,
  issue,
}: {
  title: string;
  body: string;
  issue: number;
}) {
  return (
    <section className={s.soonCard} aria-label={`${title} (준비 중)`}>
      <div className={s.head}>
        <h2>{title}</h2>
        <span className={s.badge}>준비 중</span>
      </div>
      <p>
        {body}. <span className="num">#{issue}</span>에서 기록을 시작하면
        채워져요.
      </p>
    </section>
  );
}
