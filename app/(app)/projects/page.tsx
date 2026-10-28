import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/icons";
import { LimitNotice, limitNotice } from "@/components/LimitNotice";
import { MAX_PROJECTS } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/usage";
import s from "./projects.module.css";
import { RefreshWhileGenerating } from "./RefreshWhileGenerating";

export const metadata: Metadata = { title: "내 프로젝트 · TailQ" };

// 내 프로젝트 목록(04 기능 명세 9번, S22). 프로젝트는 3개까지, 누르면 질문 목록(S24)으로 간다.
export default function ProjectsPage() {
  return (
    <div className={s.page}>
      <AppHeader title="내 프로젝트" />
      <h1 className={s.pageTitle}>내 프로젝트</h1>
      <p className={s.desc}>README를 넣으면 예상 질문 5개를 만들어 줘요</p>
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

// 한도 안내 두 줄. 불러오는 동안에도 같은 자리에 둔다
function GuideNote() {
  return (
    <p className={s.guideNote}>
      프로젝트는 최대 {MAX_PROJECTS}개까지 등록할 수 있어요.
      <br />
      프로젝트 질문 만들기와 연습은 하루에 할 수 있는 횟수가 정해져 있어요.
    </p>
  );
}

// 불러오는 동안: 목록 머리 · 행 자리 2개 · 등록 버튼 자리(레이아웃이 밀리지 않게)
function Loading() {
  return (
    <div className={s.list} aria-busy="true">
      <div className={s.listHead}>
        <h2>등록한 프로젝트</h2>
      </div>
      <ul className={s.rows}>
        {[0, 1].map((i) => (
          <li key={i} className={s.row}>
            <span className={s.text}>
              <span className={s.meta}>
                <span className="skeleton" style={{ width: "40%" }} />
              </span>
              <span className={s.name}>
                <span className="skeleton" style={{ width: "60%" }} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className={s.bottom}>
        <span className="skeleton" style={{ height: 52 }} />
      </div>
      <GuideNote />
    </div>
  );
}

// RLS가 내 프로젝트와 그 질문·세션만 보여준다. 본 질문을 채점받은(답했거나 모르겠어요) 질문을 "연습함"으로 세고,
// 평균은 질문마다 가장 최근 본 질문 점수로 낸다(모르겠어요 빼고. 상세 화면 S24와 같은 기준).
// 하루 한도·월 예산은 시작하기 전에 확인해 안내(S26)를 보여주고, 등록할 수 없으면 버튼을 막는다
async function Projects() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data }, quota] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, questions(id, sessions(created_at, turns(idx, status, score, verdict)))",
      )
      .order("created_at")
      .throwOnError(),
    loadQuota(createAdminClient(), auth?.claims.sub ?? null),
  ]);

  const notice = limitNotice(quota, "both");
  const full =
    data.length >= MAX_PROJECTS ||
    quota.budget === "exceeded" ||
    quota.gensLeft <= 0;
  const generating = data.some((p) => p.status === "generating");
  return (
    <>
      <div className={s.list}>
        {generating && <RefreshWhileGenerating />}
        <div className={s.listHead}>
          <h2>등록한 프로젝트</h2>
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
          {data.map((p) => {
            const mains = p.questions.flatMap((q) => {
              const main = [...q.sessions]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((ss) => ss.turns.find((t) => t.idx === 0))
                .find((t) => t?.status === "graded");
              return main ? [main] : [];
            });
            const scores = mains
              .filter((t) => t.verdict !== "unknown" && t.score !== null)
              .map((t) => t.score as number);
            const n = p.questions.length;
            const meta =
              p.status === "generating" ? (
                <>
                  <span className="tag tag-neutral">만드는 중</span>
                  예상 질문을 만들고 있어요
                </>
              ) : p.status === "failed" ? (
                "질문을 만들지 못했어요 · 다시 만들 수 있어요"
              ) : mains.length === 0 ? (
                `질문 ${n}개 · 아직 연습 안 함`
              ) : (
                `${n}문제 중 ${mains.length}개 연습${scores.length ? ` · 평균 ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}` : ""}`
              );
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`hover-row ${s.row}`}
                >
                  <span className={s.text}>
                    <span
                      className={`num ${s.meta}`}
                      data-failed={p.status === "failed" || undefined}
                    >
                      {meta}
                    </span>
                    <span className={s.name}>{p.name}</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
        {notice && <LimitNotice {...notice} />}
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
        <GuideNote />
      </div>
      {data.length === 0 && <Guide />}
    </>
  );
}
