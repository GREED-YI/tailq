import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/icons";
import { LimitNotice, limitNotice } from "@/components/LimitNotice";
import { LoadingStatus } from "@/components/LoadingStatus";
import { MAX_NOTES, MAX_PROJECTS } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/usage";
import s from "./projects.module.css";
import { RefreshWhileGenerating } from "./RefreshWhileGenerating";

export const metadata: Metadata = { title: "내 프로젝트 · TailQ" };

// 내 프로젝트 목록(04 기능 명세 9번, S22). 프로젝트는 3개까지, 누르면 질문 목록(S24)으로 간다.
// 그 아래 학습 자료(#141)도 3개까지 같은 모양으로 보여준다. 주 버튼은 프로젝트 등록 하나라 학습 자료 등록은 테두리 버튼이다.
export default function ProjectsPage() {
  return (
    <div className={s.page}>
      <AppHeader title="내 프로젝트" />
      <h1 className={s.pageTitle}>내 프로젝트</h1>
      <p className={s.desc}>
        README나 학습 자료를 넣으면 예상 질문 5개를 만들어 줘요
      </p>
      <div className={`${s.cols} ${s.list}`}>
        <Suspense fallback={<Loading />}>
          <Projects />
        </Suspense>
      </div>
    </div>
  );
}

// 처음 쓰는 사람(프로젝트 0개)에게만 PC 오른쪽 열에 보인다
function Guide() {
  return (
    <section className={s.guide} aria-label="이렇게 연습해요">
      <h2>이렇게 연습해요</h2>
      <ol>
        <li>
          <span className="mono">01</span>
          <strong>README나 프로젝트 설명 붙여넣기</strong>
          <span className="num">최대 10,000자</span>
        </li>
        <li>
          <span className="mono">02</span>
          <strong>예상 질문 5개 생성</strong>
          <span>설계 이유 · 기술 선택 · 트러블슈팅 위주</span>
        </li>
        <li>
          <span className="mono">03</span>
          <strong>질문을 골라 바로 연습</strong>
          <span>부족했던 질문은 복습 목록에 모아 둬요</span>
        </li>
      </ol>
    </section>
  );
}

// 한도 안내 두 줄. 불러오는 동안에도 같은 자리에 둔다. 3개를 다 채웠으면 첫 줄로 버튼이 꺼진 이유를 말한다
function GuideNote({ full = false }: { full?: boolean }) {
  return (
    <p className={s.guideNote}>
      {full
        ? `프로젝트 ${MAX_PROJECTS}개를 모두 등록했어요. 하나를 지우면 새로 등록할 수 있어요.`
        : `프로젝트는 최대 ${MAX_PROJECTS}개까지 등록할 수 있어요.`}
      <br />
      프로젝트 질문 만들기와 연습은 하루에 할 수 있는 횟수가 정해져 있어요.
    </p>
  );
}

function NoteGuideNote({ full = false }: { full?: boolean }) {
  return (
    <p className={s.guideNote}>
      {full
        ? `학습 자료 ${MAX_NOTES}개를 모두 등록했어요. 하나를 지우면 새로 등록할 수 있어요.`
        : `학습 자료는 최대 ${MAX_NOTES}개까지 등록할 수 있어요.`}
      <br />
      질문 만들기와 연습 횟수는 프로젝트와 함께 세요.
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

// 불러오는 동안: 구획마다 목록 머리 · 행 자리 · 등록 버튼 자리(레이아웃이 밀리지 않게). 움직이지 않는 칸이다
function Loading() {
  return (
    <>
      <LoadingStatus />
      <div className={s.list} aria-busy="true" aria-hidden="true">
        <div>
          <div className={s.listHead}>
            <h2>등록한 프로젝트</h2>
          </div>
          <ul className={s.rows}>
            <RowSkeleton />
            <RowSkeleton />
          </ul>
          <div className={s.bottom}>
            <span className="skeleton" style={{ height: 52 }} />
          </div>
          <GuideNote />
        </div>
        <div className={s.notes}>
          <div className={s.listHead}>
            <h2>학습 자료</h2>
          </div>
          <ul className={s.rows}>
            <RowSkeleton />
          </ul>
          <div className={`${s.bottom} ${s.static}`}>
            <span className="skeleton" style={{ height: 44 }} />
          </div>
          <NoteGuideNote />
        </div>
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
// 점수로 낸다(모르겠어요 빼고. 상세 화면 S24와 같은 기준). 프로젝트와 학습 자료가 같이 쓴다
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
// 하루 질문 만들기 한도는 프로젝트와 학습 자료가 함께 센다(08 설계 "하루 사용 한도와 월 예산")
async function Projects() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data }, { data: notes }, quota] = await Promise.all([
    supabase
      .from("projects")
      .select(`id, name, status, ${QUESTION_STATS}`)
      .order("created_at")
      .throwOnError(),
    supabase
      .from("study_notes")
      .select(`id, name:title, status, ${QUESTION_STATS}`)
      .order("created_at")
      .throwOnError(),
    loadQuota(createAdminClient(), auth?.claims.sub ?? null),
  ]);

  // 하루 한도·월 예산 안내는 두 구획이 함께 쓰므로 구획 위에 한 번만 둔다(PC는 안내 열까지 걸친 한 줄)
  const notice = limitNotice(quota, "both");
  const noGen = quota.budget === "exceeded" || quota.gensLeft <= 0;
  const full = data.length >= MAX_PROJECTS || noGen;
  const notesFull = notes.length >= MAX_NOTES || noGen;
  const generating = [...data, ...notes].some((p) => p.status === "generating");
  return (
    <>
      {notice && (
        <div className={s.noticeRow}>
          <LimitNotice {...notice} />
        </div>
      )}
      <div className={s.list}>
        {generating && <RefreshWhileGenerating />}
        {/* 모바일에서 화면 아래에 붙는 프로젝트 등록 버튼은 이 구획 안에서만 따라온다 */}
        <section aria-labelledby="projects-head">
          <div className={s.listHead}>
            <h2 id="projects-head">등록한 프로젝트</h2>
            <span className={`num ${s.count}`}>
              <span className="mono">
                {data.length} / {MAX_PROJECTS}
              </span>
              개 등록
            </span>
          </div>
          <ul className={s.rows}>
            {data.length === 0 && (
              <li className={s.empty}>아직 등록한 프로젝트가 없어요</li>
            )}
            {data.map((p) => (
              <Row key={p.id} href={`/projects/${p.id}`} item={p} />
            ))}
          </ul>
          <div className={s.bottom}>
            {full ? (
              <button type="button" className="btn btn-primary" disabled>
                프로젝트 등록
              </button>
            ) : (
              <Link href="/projects/new" className="btn btn-primary press">
                프로젝트 등록
              </Link>
            )}
          </div>
          <GuideNote full={data.length >= MAX_PROJECTS} />
        </section>

        <section className={s.notes} aria-labelledby="notes-head">
          <div className={s.listHead}>
            <h2 id="notes-head">학습 자료</h2>
            <span className={`num ${s.count}`}>
              <span className="mono">
                {notes.length} / {MAX_NOTES}
              </span>
              개 등록
            </span>
          </div>
          <ul className={s.rows}>
            {notes.length === 0 && (
              <li className={s.empty}>
                <strong>아직 등록한 학습 자료가 없어요</strong>
                정리한 노트나 수업 자료로 개념 질문을 만들어 보세요
              </li>
            )}
            {notes.map((n) => (
              <Row key={n.id} href={`/projects/notes/${n.id}`} item={n} />
            ))}
          </ul>
          <div className={`${s.bottom} ${s.static}`}>
            {notesFull ? (
              <button type="button" className="btn btn-secondary" disabled>
                학습 자료 등록
              </button>
            ) : (
              <Link
                href="/projects/notes/new"
                className="btn btn-secondary press"
              >
                학습 자료 등록
              </Link>
            )}
          </div>
          <NoteGuideNote full={notes.length >= MAX_NOTES} />
        </section>
      </div>
      {data.length === 0 && <Guide />}
    </>
  );
}
