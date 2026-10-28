import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LoadingStatus } from "@/components/LoadingStatus";
import { ScoreBar } from "@/app/interview/ScoreRing";
import { VERDICTS } from "@/app/interview/verdict";
import {
  alerts,
  answersSince,
  FAIL_LIMIT,
  funnelSteps,
  goalRates,
  goalSince,
  isAdmin,
  latency,
  monthForecast,
  numericDate,
  opsStats,
  ratio,
  recentSince,
  SCORE_BANDS,
  thumbsDownQuestions,
  visitFunnel,
  type Answer,
  type Signup,
} from "@/lib/admin";
import { kstDay } from "@/lib/daily-pick";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback";
import { FIELDS } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { budgetUsd, loadQuota } from "@/lib/usage";
import s from "./admin.module.css";
import { countFeedback, FeedbackList, Table } from "./Table";

export const metadata: Metadata = {
  title: "운영 · TailQ",
  robots: { index: false },
};

// 운영자 대시보드. 위에서 아래로 확인할 것 → 성공 지표 → 가입 흐름 → 채점 품질 → 운영 상태 → 사용자 피드백
// (DESIGN 운영 대시보드 순서). 운영자가 아니면 화면이 있다는 것도 알리지 않도록 404로 보낸다
export default function AdminPage() {
  return (
    <div className={s.page} data-admin>
      <AppHeader />
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 머리 · 확인할 것 한 줄 · 성공 지표 타일 · 아래 구획 자리(레이아웃이 밀리지 않게).
// 운영자가 아니어도 받는 미리 그린 화면이라 운영 화면임을 알 수 있는 글(구획 제목 포함)은 넣지 않고 칸만 둔다
function Loading() {
  return (
    <>
      <LoadingStatus />
      <div aria-busy="true" aria-hidden="true">
        <div className={s.top}>
          <h1 className="skeleton" style={{ width: 200 }} />
        </div>
        <section className={s.block}>
          <div className={s.blockHead} />
          <div className={s.calm}>
            <span className="skeleton" style={{ width: "40%" }} />
          </div>
        </section>
        <section className={s.block}>
          <div className={s.blockHead} />
          <div className={`${s.tiles} ${s.goals}`}>
            <div className={s.hero}>
              <div className={s.heroText}>
                <span className="skeleton" style={{ width: 160 }} />
                <strong>
                  <span className={`skeleton ${s.big}`} style={{ width: 96 }} />
                </strong>
                <p className={s.heroNotes}>
                  <span className="skeleton" style={{ width: 140 }} />
                  <span className="skeleton" style={{ width: 88 }} />
                </p>
              </div>
              <div>
                <div className={s.weeks} />
                <p className={s.ticks}>
                  <span className="skeleton" style={{ width: 40 }} />
                  <span className="skeleton" style={{ width: 40 }} />
                </p>
              </div>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className={s.stat}>
                <span className="skeleton" style={{ width: "50%" }} />
                <strong>
                  <span
                    className={`skeleton ${s.value}`}
                    style={{ width: "30%" }}
                  />
                </strong>
                <div className="skeleton" style={{ height: 6 }} />
                <span
                  className={`skeleton ${s.state}`}
                  style={{ width: "70%" }}
                />
                <small className="skeleton" style={{ width: "60%" }} />
              </div>
            ))}
          </div>
        </section>
        <div className={s.grid}>
          {[0, 1].map((i) => (
            <section key={i} className={s.block}>
              <div className={s.blockHead} />
              <span className="skeleton" style={{ height: 240 }} />
            </section>
          ))}
        </div>
      </div>
    </>
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

const kst = (day: string) => `${day}T00:00:00+09:00`;

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
    feedback,
    feedbackKinds,
    recentFeedback,
    metrics,
    visits,
    grades,
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
          "id, idx, effective_status, answered_at, score, verdict, rating, sessions!inner(user_id, question_id)",
        )
        .gte("answered_at", kst(answersSince(today)))
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
    // 전체 개수와 최근 3개
    db
      .from("feedback")
      .select("id, body, category, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(3)
      .throwOnError(),
    countFeedback(db),
    // 최근 7일에 온 피드백 분류(확인할 것·새 글 수)
    readAll((from, to) =>
      db
        .from("feedback")
        .select("id, category")
        .gte("created_at", kst(recentSince(today)))
        .order("id")
        .range(from, to),
    ),
    // 첫 방문 → 첫 답변, D7(이벤트 기준, #44·#133). 최근 4주 행만
    db
      .from("metrics_weekly")
      .select(
        "week, first_visitors, first_visitors_answered, d7_cohort, d7_returned",
      )
      .gte("week", goalSince(today))
      .throwOnError(),
    // 방문 흐름 앞단: 최근 4주 첫 방문·체험 완료(브라우저 단위)
    readAll((from, to) =>
      db
        .from("events")
        .select("id, name, anon_id")
        .in("name", ["first_visit", "trial_complete"])
        .not("anon_id", "is", null)
        .gte("created_at", kst(goalSince(today)))
        .order("id")
        .range(from, to),
    ),
    // 채점 지연: 최근 7일 본 질문 채점 호출
    readAll((from, to) =>
      db
        .from("ai_usage")
        .select("id, latency_ms")
        .eq("purpose", "grade")
        .eq("status", "used")
        .not("latency_ms", "is", null)
        .gte("day", recentSince(today))
        .order("id")
        .range(from, to),
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
    questionId: t.sessions.question_id,
    idx: t.idx!,
    answeredAt: t.answered_at!,
    status: t.effective_status!,
    score: t.score,
    verdict: t.verdict,
    rating: t.rating,
  }));
  const st = opsStats(signups, answers, today);
  const goal = goalRates(
    metrics.data.map((r) => ({
      week: r.week!,
      first_visitors: r.first_visitors ?? 0,
      first_visitors_answered: r.first_visitors_answered ?? 0,
      d7_cohort: r.d7_cohort ?? 0,
      d7_returned: r.d7_returned ?? 0,
    })),
    today,
  );
  const front = visitFunnel(visits);
  const recentBy = (c: string) =>
    recentFeedback.filter((f) => f.category === c).length;
  const alertRows = alerts(st.fail7d, quota.budget, {
    bug: recentBy("bug"),
    report: recentBy("report"),
  });
  const lag = latency(grades.map((g) => g.latency_ms!));
  const disliked = thumbsDownQuestions(answers);
  // 싫어요가 많은 질문의 글은 그 몇 개만 따로 읽는다
  const prompts = disliked.length
    ? (
        await db
          .from("questions")
          .select("id, prompt")
          .in(
            "id",
            disliked.map((q) => q.questionId),
          )
          .throwOnError()
      ).data
    : [];
  const spentPct = Math.round((quota.spentUsd / budgetUsd()) * 100);
  const forecast = monthForecast(quota.spentUsd, today);
  const gradedTotal = st.scoreBands.reduce((a, b) => a + b, 0);
  const mainTotal = gradedTotal + st.unknownMain;
  const verdictTotal = Object.values(st.verdicts).reduce((a, b) => a + b, 0);
  const diff = st.thisWeek - st.lastWeekSoFar;
  const peak = Math.max(...st.weekly.map((w) => w.count), 1);
  const steps = funnelSteps([
    // 첫 방문 기록이 있을 때만 앞단을 붙인다(없으면 가입부터)
    ...(front.visitors > 0
      ? [
          { label: "첫 방문", n: front.visitors },
          { label: "체험 완료", n: front.trialed, skippable: true },
        ]
      : []),
    { label: "가입", n: st.funnel.signed },
    { label: "온보딩 마침", n: st.funnel.onboarded },
    { label: "첫 답변", n: st.funnel.answered },
  ]);
  const publicCount = questions.filter((q) => !q.is_hidden).length;

  return (
    <>
      <header className={s.top}>
        <h1>운영 대시보드</h1>
        <span className="num">
          <span className="mono">{today.replaceAll("-", ".")}</span> 기준 · 한국
          시간
        </span>
      </header>

      <Block title="확인할 것">
        {alertRows.length === 0 ? (
          <p className={s.calm}>지금 확인할 문제가 없어요</p>
        ) : (
          <ul className={s.rows}>
            {alertRows.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className={`hover-row ${s.alert}`}>
                  <span className="tag tag-neutral">{a.label}</span>
                  <span className={s.alertText}>{a.text}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="성공 지표" meta="최근 4주 · 북극성 8주">
        <div className={`${s.tiles} ${s.goals}`}>
          <div className={s.hero}>
            <div className={s.heroText}>
              <h3>북극성 · 이번 주 답변 제출</h3>
              <strong>
                <span className={`mono ${s.big}`}>{st.thisWeek}</span>개
              </strong>
              <p className={s.heroNotes}>
                {st.weekly.every((w) => w.count === 0) ? (
                  <span>아직 답변이 없어요</span>
                ) : (
                  <span className="num">
                    지난주 같은 때 {st.lastWeekSoFar}개
                    {diff !== 0 && (
                      <span data-trend={diff > 0 ? "up" : "down"}>
                        {" "}
                        · {diff > 0 ? "+" : "−"}
                        {Math.abs(diff)}
                      </span>
                    )}
                  </span>
                )}
                <span className="num">답한 사람 {st.activeThisWeek}명</span>
              </p>
            </div>
            <div>
              <ol className={s.weeks} aria-label="최근 8주 답변 제출 수">
                {st.weekly.map((w, i) => (
                  <li key={w.week}>
                    <span className="sr-only">
                      {numericDate(kst(w.week))} 주 {w.count}개
                    </span>
                    <span className="mono" aria-hidden="true">
                      {w.count}
                    </span>
                    <i
                      aria-hidden="true"
                      style={{ height: `${(w.count / peak) * 100}%` }}
                      data-now={i === st.weekly.length - 1 || undefined}
                      data-zero={w.count === 0 || undefined}
                    />
                  </li>
                ))}
              </ol>
              <p className={s.ticks} aria-hidden="true">
                <span>7주 전</span>
                <span>이번 주</span>
              </p>
            </div>
          </div>

          <Goal
            label="첫 방문 → 첫 답변"
            rate={goal.firstAnswer.rate}
            target={50}
            sample={`첫 방문 ${goal.firstAnswer.visitors}명 중 ${goal.firstAnswer.answered}명`}
            empty="최근 4주에 처음 온 사람이 없어요"
          />
          <Goal
            label="D7 재방문"
            help="가입 다음 날부터 7일 안에 다시 와서 연습을 시작하거나 답한 비율이에요"
            rate={goal.d7.rate}
            target={20}
            sample={`가입하고 7일 지난 ${goal.d7.cohort}명 중 ${goal.d7.returned}명`}
            empty="가입하고 7일이 지난 사람이 아직 없어요"
          />
          <Goal
            label="채점 만족"
            rate={st.thumbsUp.rate}
            target={70}
            sample={`평가 ${st.thumbsUp.rated}개 중 좋아요 ${st.thumbsUp.liked}개`}
            empty="최근 4주에 남긴 평가가 없어요"
          />
        </div>
      </Block>

      <div className={s.grid}>
        <Block
          title="가입 흐름"
          meta={`최근 4주 · 전체 ${st.users.total}명 · 이번 주 +${st.users.newThisWeek}`}
        >
          {st.funnel.signed === 0 && front.visitors === 0 ? (
            <p className={s.empty}>최근 4주에 가입한 사람이 없어요</p>
          ) : (
            <ul className={s.funnel}>
              {steps.map((step) => (
                <li key={step.label}>
                  <span className={s.stepName}>{step.label}</span>
                  <ScoreBar value={step.ofFirst} small decorative />
                  <span>
                    <span className="mono">{step.n}</span>명
                  </span>
                  <span className="mono">
                    {step.ofBase != null && (
                      <>
                        <span className="sr-only">{step.base}의 </span>
                        {pctText(step.n, step.ofBase)}%
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="채점 품질" meta="최근 8주">
          <div className={s.pair}>
            <div>
              <Sub
                title="본 질문 점수"
                meta={
                  st.average == null
                    ? `${mainTotal}개`
                    : `평균 ${st.average}점${st.unknownMain ? "(모르겠어요 빼고)" : ""} · ${mainTotal}개`
                }
              />
              {mainTotal === 0 ? (
                <p className={s.empty}>최근 8주에 채점된 답변이 없어요</p>
              ) : (
                <Table label="본 질문 점수 분포">
                  <thead>
                    <tr>
                      <th scope="col">점수 구간</th>
                      <th scope="col">분포</th>
                      <th scope="col" className={s.numCol}>
                        개수
                      </th>
                      <th scope="col" className={s.numCol}>
                        비율
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...SCORE_BANDS.map((band, i) => ({
                        name: `${band}점`,
                        n: st.scoreBands[i],
                      })).reverse(),
                      { name: "모르겠어요", n: st.unknownMain },
                    ].map((row) => (
                      <RatioRow
                        key={row.name}
                        name={row.name}
                        n={row.n}
                        pct={ratio(row.n, mainTotal) ?? 0}
                      />
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            <div>
              <Sub title="꼬리질문 판정" meta={`${verdictTotal}개`} />
              {verdictTotal === 0 ? (
                <p className={s.empty}>최근 8주에 꼬리질문 답변이 없어요</p>
              ) : (
                <ul className={s.legend}>
                  {Object.entries(VERDICTS).map(([key, v]) => {
                    const n = st.verdicts[key] ?? 0;
                    const pct = ratio(n, verdictTotal) ?? 0;
                    return (
                      <li key={key}>
                        <i data-verdict={key} aria-hidden="true" />
                        <span className={s.stepName}>{v.label}</span>
                        <ScoreBar value={pct} small decorative />
                        <span className="mono">{n}</span>
                        <span className="mono">{pctText(n, pct)}%</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <Sub
            title="싫어요가 많은 질문"
            meta={disliked.length ? `${disliked.length}개` : ""}
          />
          {disliked.length === 0 ? (
            <p className={s.empty}>최근 8주에 싫어요를 받은 질문이 없어요</p>
          ) : (
            <Table label="싫어요가 많은 질문">
              <thead>
                <tr>
                  <th scope="col">번호</th>
                  <th scope="col">질문</th>
                  <th scope="col" className={s.numCol}>
                    싫어요/평가
                  </th>
                </tr>
              </thead>
              <tbody>
                {disliked.map((q) => (
                  <tr key={q.questionId}>
                    <td className={`mono ${s.nameCol}`}>#{q.questionId}</td>
                    <td className={s.clip}>
                      {prompts.find((p) => p.id === q.questionId)?.prompt ?? ""}
                    </td>
                    <td className={`mono ${s.numCol}`}>
                      {q.down}/{q.rated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Block>

        <Block id="ops" title="운영 상태">
          <div className={`${s.tiles} ${s.opsTiles}`}>
            <div className={s.stat}>
              <span>AI 비용 · 이번 달 예산</span>
              <strong>
                <span className={`mono ${s.value}`}>{spentPct}</span>%
              </strong>
              <ScoreBar value={spentPct} small decorative />
              <span
                className={s.state}
                data-warn={quota.budget !== "ok" || undefined}
              >
                {BUDGET_STATE[quota.budget]}
              </span>
              <small className="num">
                {costNote(quota.spentUsd, budgetUsd())}
                {forecast != null && (
                  <>
                    <br />
                    지금 속도면 월말 약 ${forecast.toFixed(2)}
                  </>
                )}
              </small>
            </div>
            <div className={s.stat}>
              <span>채점 실패 · 최근 7일</span>
              <strong>
                <span className={`mono ${s.value}`}>
                  {st.fail7d.rate ?? "–"}
                </span>
                {st.fail7d.rate != null && "%"}
              </strong>
              {st.fail7d.rate == null ? (
                <small>최근 7일에 답변이 없어요</small>
              ) : (
                <>
                  <span
                    className={s.state}
                    data-warn={st.fail7d.rate > FAIL_LIMIT || undefined}
                  >
                    기준 {FAIL_LIMIT}%{" "}
                    {st.fail7d.rate > FAIL_LIMIT ? "넘음" : "아래"}
                  </span>
                  <small className="num">
                    답변 {st.fail7d.n}개 중 {st.fail7d.failed}개
                  </small>
                </>
              )}
            </div>
            <div className={s.stat}>
              <span>채점 시간 · 최근 7일</span>
              <strong>
                <span className={`mono ${s.value}`}>
                  {lag ? seconds(lag.p50) : "–"}
                </span>
                {lag && "초"}
              </strong>
              {lag ? (
                <>
                  <span className={`num ${s.state}`}>
                    95%는 {seconds(lag.p95)}초 안에 끝나요
                  </span>
                  <small className="num">중간값 · 채점 {lag.n}번</small>
                </>
              ) : (
                <small>최근 7일에 채점이 없어요</small>
              )}
            </div>
          </div>

          <Sub
            title="질문 은행"
            meta={`공개 ${publicCount} · 숨김 ${questions.length - publicCount}`}
          />
          <Table label="분야별 공개 질문 수">
            <thead>
              <tr>
                <th scope="col">분야</th>
                <th scope="col">목표 {BANK_GOAL}개 대비</th>
                <th scope="col" className={s.numCol}>
                  공개
                </th>
                <th scope="col" className={s.numCol}>
                  목표까지
                </th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const n = questions.filter(
                  (q) => !q.is_hidden && q.topics.field === f.id,
                ).length;
                return (
                  <tr key={f.id}>
                    <td className={s.nameCol}>{f.label}</td>
                    <td className={s.barCell}>
                      <ScoreBar
                        value={Math.min(n / BANK_GOAL, 1) * 100}
                        small
                        decorative
                      />
                    </td>
                    <td className={`mono ${s.numCol}`}>
                      {n}/{BANK_GOAL}
                    </td>
                    <td className={`num ${s.numCol}`}>
                      {n >= BANK_GOAL ? "달성" : `${BANK_GOAL - n}개`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Block>

        <Block
          title="사용자 피드백"
          meta={`전체 ${feedback.count ?? 0}개 · 최근 7일 ${recentFeedback.length}개`}
        >
          <div className={s.kindsRow}>
            <ul className={s.kinds} aria-label="분류별 개수">
              {FEEDBACK_CATEGORIES.map((c) => (
                <li key={c.id} className="num">
                  {c.label} <span className="mono">{feedbackKinds[c.id]}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/feedback" className={`press ${s.more}`}>
              모두 보기 →
            </Link>
          </div>
          {feedback.data.length === 0 ? (
            <p className={s.empty}>아직 받은 피드백이 없어요</p>
          ) : (
            <FeedbackList rows={feedback.data} clamp />
          )}
        </Block>
      </div>
    </>
  );
}

// 예산 상태 글(색만으로 말하지 않는다). 80%를 넘으면 새 세션의 본 질문 채점이 Haiku로 낮아진다(09 채점 5장)
const BUDGET_STATE = {
  ok: "예산 안이에요",
  downgrade: "80%를 넘어 가벼운 모델로 채점해요",
  exceeded: "예산을 다 써서 새로 시작할 수 없어요",
};

// "$3.21 / $20 · 약 4,494원". 원화는 보여줄 때만 고정 환율 KRW_PER_USD로 바꾼다(08 설계)
function costNote(spent: number, budget: number) {
  const krw = Number(process.env.KRW_PER_USD);
  const usd = `$${spent.toFixed(2)} / $${budget}`;
  return krw > 0
    ? `${usd} · 약 ${Math.round(spent * krw).toLocaleString()}원`
    : usd;
}

// 0이 아닌데 반올림으로 0이 되면 "<1"(2/469가 "0%"로 보이지 않게)
const pctText = (n: number, pct: number) => (n > 0 && pct === 0 ? "<1" : pct);

// 3518ms → "3.5"
const seconds = (ms: number) => (ms / 1000).toFixed(1);

// 목표 칸(stat-tiles admin): 숫자 · 20칸 막대 · 목표와 상태 글 · 표본. 기록이 모자라면 "–"와 이유
function Goal({
  label,
  help,
  rate,
  target,
  sample,
  empty,
}: {
  label: string;
  help?: string;
  rate: number | null;
  target: number;
  sample: string;
  empty: string;
}) {
  const met = rate != null && rate >= target;
  return (
    <div className={s.stat}>
      <span title={help}>
        {label}
        {help && <span className="sr-only"> · {help}</span>}
      </span>
      <strong>
        <span
          className={`mono ${s.value}`}
          data-empty={rate == null || undefined}
        >
          {rate ?? "–"}
        </span>
        {rate != null && "%"}
      </strong>
      <ScoreBar value={rate ?? 0} small decorative />
      {rate == null ? (
        <>
          <span className={s.state}>아직 기록이 모자라요</span>
          <small>{empty}</small>
        </>
      ) : (
        <>
          <span className={`num ${s.state}`}>
            목표 {target}% · {met ? "목표 넘음" : `목표까지 ${target - rate}%p`}
          </span>
          <small className="num">{sample}</small>
        </>
      )}
    </div>
  );
}

// 비율 표 한 줄: 이름 · 20칸 막대 · 개수 · 비율
function RatioRow({ name, n, pct }: { name: string; n: number; pct: number }) {
  return (
    <tr>
      <td className={`num ${s.nameCol}`}>{name}</td>
      <td className={s.barCell}>
        <ScoreBar value={pct} small decorative />
      </td>
      <td className={`mono ${s.numCol}`}>{n}</td>
      <td className={`mono ${s.numCol}`}>{pctText(n, pct)}%</td>
    </tr>
  );
}

// 구획: 2px 머리선 위에 제목·기준
function Block({
  id,
  title,
  meta,
  children,
}: {
  id?: string;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={s.block} aria-label={title}>
      <div className={s.blockHead}>
        <h2>{title}</h2>
        {meta && <span className="num">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

// 구획 안 소제목 줄
function Sub({ title, meta }: { title: string; meta: string }) {
  return (
    <div className={s.sub}>
      <h3>{title}</h3>
      <span className="num">{meta}</span>
    </div>
  );
}
