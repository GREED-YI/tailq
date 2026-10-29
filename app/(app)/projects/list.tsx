import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, limitNotice, UsageLine } from "@/components/LimitNotice";
import { LoadingStatus } from "@/components/LoadingStatus";
import {
  DAILY_GENS,
  DAILY_SESSIONS,
  MAX_NOTES,
  MAX_PROJECTS,
} from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/server/usage";
import s from "./projects.module.css";
import { RefreshWhileGenerating } from "./RefreshWhileGenerating";

// Q메이커의 두 구획(프로젝트 /projects, 학습 자료 /projects/notes, #141)이 같이 쓰는 목록.
// 모양은 같고 글·주소·한도 개수만 다르다. 주 버튼은 구획마다 그 구획의 등록 하나다
export type Kind = "project" | "note";

const COPY = {
  project: {
    noun: "프로젝트",
    max: MAX_PROJECTS,
    href: (id: string) => `/projects/${id}`,
    newHref: "/projects/new",
    empty: "README를 넣으면 예상 질문 5개를 만들어 줘요",
    guide: [
      ["README나 프로젝트 설명 붙여넣기", "최대 10,000자"],
      ["예상 질문 5개 생성", "설계 이유 · 기술 선택 · 트러블슈팅 위주"],
      ["질문을 골라 바로 연습", "부족했던 질문은 복습 목록에 모아 둬요"],
    ],
  },
  note: {
    noun: "학습 자료",
    max: MAX_NOTES,
    href: (id: string) => `/projects/notes/${id}`,
    newHref: "/projects/notes/new",
    empty: "정리한 글이나 수업 자료로 개념 질문을 만들어 보세요",
    guide: [
      ["학습 자료 붙여넣기 또는 파일 불러오기", "최대 30,000자"],
      ["개념 질문 5개 생성", "개념 설명 · 비교 · 적용"],
      ["질문을 골라 바로 연습", "부족했던 질문은 복습 목록에 모아 둬요"],
    ],
  },
} satisfies Record<Kind, unknown>;

// 구획 페이지가 그리는 목록 자리. PC는 8칸 목록 + 4칸 안내 열
export function ProjectList({ kind }: { kind: Kind }) {
  return (
    <div className={`${s.cols} ${s.list}`}>
      <Suspense fallback={<Loading kind={kind} />}>
        <List kind={kind} />
      </Suspense>
    </div>
  );
}

// 처음 쓰는 사람(그 구획 목록 0개)에게만 PC 오른쪽 열에 보인다. 글은 구획마다 다르다
function Guide({ kind }: { kind: Kind }) {
  return (
    <section className={s.guide} aria-label="이렇게 연습해요">
      <h2>이렇게 연습해요</h2>
      <ol>
        {COPY[kind].guide.map(([title, sub], i) => (
          <li key={title}>
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <strong>{title}</strong>
            <span className="num">{sub}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// 한도 안내 두 줄. 불러오는 동안에도 같은 자리에 둔다. 다 채웠으면 첫 줄로 버튼이 꺼진 이유를 말한다.
// 둘째 줄(오늘 남은 횟수는 함께 쓴다)은 두 구획이 같은 글이다
function GuideNote({ kind, full = false }: { kind: Kind; full?: boolean }) {
  const { noun, max } = COPY[kind];
  return (
    <p className={s.guideNote}>
      {full
        ? `${noun} ${max}개를 모두 등록했어요. 하나를 지우면 새로 등록할 수 있어요.`
        : `${noun}는 최대 ${max}개까지 등록할 수 있어요.`}
      <br />
      오늘 남은 횟수는 프로젝트와 학습 자료가 함께 써요.
    </p>
  );
}

// 행 자리 하나(불러오는 동안)
function RowSkeleton() {
  return (
    <li className={s.row}>
      <span className={s.text}>
        <span className={s.meta}>
          <span className="skeleton" style={{ width: "40%" }} />
        </span>
        <span className={s.name}>
          <span className="skeleton" style={{ width: "60%" }} />
        </span>
      </span>
    </li>
  );
}

// 불러오는 동안: 오늘 남은 횟수 · 목록 머리 · 행 자리 2개 · 등록 버튼 자리(레이아웃이 밀리지 않게). 움직이지 않는 칸이다.
// 오늘 남은 횟수 자리는 제목과 두 항목 줄(20px씩, 사이 4px) 높이다
function Loading({ kind }: { kind: Kind }) {
  return (
    <>
      <LoadingStatus />
      <div className={s.noticeRow} aria-hidden="true">
        <span
          className="skeleton"
          style={{ width: 160, height: 68, marginTop: 16 }}
        />
      </div>
      <div className={s.list} aria-busy="true" aria-hidden="true">
        <div className={s.listHead}>
          <h2>등록한 {COPY[kind].noun}</h2>
        </div>
        <ul className={s.rows}>
          <RowSkeleton />
          <RowSkeleton />
        </ul>
        <div className={s.bottom}>
          <span className="skeleton" style={{ height: 52 }} />
        </div>
        <GuideNote kind={kind} />
      </div>
    </>
  );
}

type Turn = {
  idx: number;
  status: string;
  score: number | null;
  verdict: string | null;
};
type Item = {
  id: string;
  name: string;
  status: string;
  questions: { sessions: { created_at: string; turns: Turn[] }[] }[];
};

// 목록 한 줄. 본 질문을 채점받은(답했거나 모르겠어요) 질문을 "연습함"으로 세고, 평균은 질문마다 가장 최근 본 질문
// 점수로 낸다(모르겠어요 빼고. 상세 화면 S24와 같은 기준)
function Row({ href, item }: { href: string; item: Item }) {
  const mains = item.questions.flatMap((q) => {
    const main = [...q.sessions]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((ss) => ss.turns.find((t) => t.idx === 0))
      .find((t) => t?.status === "graded");
    return main ? [main] : [];
  });
  const scores = mains
    .filter((t) => t.verdict !== "unknown" && t.score !== null)
    .map((t) => t.score as number);
  const n = item.questions.length;
  const meta =
    item.status === "generating" ? (
      <>
        <span className="tag tag-neutral">만드는 중</span>
        예상 질문을 만들고 있어요
      </>
    ) : item.status === "failed" ? (
      "질문을 만들지 못했어요 · 다시 만들 수 있어요"
    ) : mains.length === 0 ? (
      `질문 ${n}개 · 아직 연습 안 함`
    ) : (
      `${n}문제 중 ${mains.length}개 연습${scores.length ? ` · 평균 ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}` : ""}`
    );
  return (
    <li>
      <Link href={href} className={`hover-row ${s.row}`}>
        <span className={s.text}>
          <span
            className={`num ${s.meta}`}
            data-failed={item.status === "failed" || undefined}
          >
            {meta}
          </span>
          <span className={s.name}>{item.name}</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </Link>
    </li>
  );
}

const QUESTION_STATS =
  "questions(id, sessions(created_at, turns(idx, status, score, verdict)))";

// RLS가 내 프로젝트·학습 자료와 그 질문·세션만 보여준다.
// 하루 한도·월 예산은 시작하기 전에 확인해 안내(S26)를 보여주고, 등록할 수 없으면 버튼을 막는다.
// 하루 질문 생성 한도는 프로젝트와 학습 자료가 함께 세서(08 설계 "하루 사용 한도와 월 예산") 두 구획에 같은 안내가 뜬다
async function List({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data }, quota] = await Promise.all([
    kind === "note"
      ? supabase
          .from("study_notes")
          .select(`id, name:title, status, ${QUESTION_STATS}`)
          .order("created_at")
          .throwOnError()
      : supabase
          .from("projects")
          .select(`id, name, status, ${QUESTION_STATS}`)
          .order("created_at")
          .throwOnError(),
    loadQuota(createAdminClient(), auth?.claims.sub ?? null),
  ]);
  const items: Item[] = data;

  // PC는 안내 열까지 걸친 한 줄
  const notice = limitNotice(quota, "both");
  const full =
    items.length >= c.max || quota.budget === "exceeded" || quota.gensLeft <= 0;
  return (
    <>
      {/* 오늘 남은 횟수는 구획 탭 바로 아래. 월 예산이 다 찼으면 남은 수가 있어도 쓸 수 없어 숨긴다 */}
      {quota.budget !== "exceeded" && (
        <div className={s.noticeRow}>
          <UsageLine
            items={[
              ["질문 생성", quota.gensLeft, DAILY_GENS],
              ["면접 연습", quota.sessionsLeft, DAILY_SESSIONS],
            ]}
          />
        </div>
      )}
      {notice && (
        <div className={s.noticeRow}>
          <LimitNotice {...notice} />
        </div>
      )}
      <div className={s.list}>
        {items.some((p) => p.status === "generating") && (
          <RefreshWhileGenerating />
        )}
        <div className={s.listHead}>
          <h2>등록한 {c.noun}</h2>
          <span className={`num ${s.count}`}>
            <span className="mono">
              {items.length} / {c.max}
            </span>
            개 등록
          </span>
        </div>
        <ul className={s.rows}>
          {items.length === 0 && (
            <li className={s.empty}>
              <strong>아직 등록한 {c.noun}가 없어요</strong>
              {c.empty}
            </li>
          )}
          {items.map((p) => (
            <Row key={p.id} href={c.href(p.id)} item={p} />
          ))}
        </ul>
        <div className={s.bottom}>
          {full ? (
            <button type="button" className="btn btn-primary" disabled>
              {c.noun} 등록
            </button>
          ) : (
            <Link href={c.newHref} className="btn btn-primary press">
              {c.noun} 등록
            </Link>
          )}
        </div>
        <GuideNote kind={kind} full={items.length >= c.max} />
      </div>
      {items.length === 0 && <Guide kind={kind} />}
    </>
  );
}
