import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/icons";
import { MAX_PROJECTS } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import s from "./projects.module.css";

export const metadata: Metadata = { title: "내 프로젝트 · TailQ" };

// 내 프로젝트 목록(04 기능 명세 9번, S22). 프로젝트는 3개까지, 누르면 질문 목록(S24)으로 간다.
export default function ProjectsPage() {
  return (
    <div className={s.page}>
      <AppHeader title="내 프로젝트" />
      <h1 className={s.pageTitle}>내 프로젝트</h1>
      <div className={`${s.cols} ${s.list}`}>
        <div className={s.list}>
          <h2 className={s.title}>내 프로젝트로 면접 연습</h2>
          <p className={s.desc}>README를 넣으면 예상 질문 5개를 만들어요</p>
          <Suspense>
            <Projects />
          </Suspense>
        </div>
        <div>
          <section className={`glass ${s.guide}`} aria-label="이렇게 연습해요">
            <h3>이렇게 연습해요</h3>
            <ol>
              <li>
                <span className="mono">01</span>
                <strong>README나 프로젝트 설명 붙여 넣기</strong>
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
                <span>부족했던 질문은 복습 상자에 들어가요</span>
              </li>
            </ol>
          </section>
          <p className={s.guideNote}>
            프로젝트는 최대 {MAX_PROJECTS}개까지 등록할 수 있어요.
            <br />
            프로젝트 질문 생성과 연습에는 하루 사용 한도가 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}

// RLS가 내 프로젝트와 그 질문·세션만 보여준다. 본 질문을 채점받은(답했거나 모르겠어요) 질문을 "연습함"으로 센다
async function Projects() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, status, questions(id, sessions(turns(idx, status)))")
    .order("created_at")
    .throwOnError();

  const full = data.length >= MAX_PROJECTS;
  return (
    <>
      <ul className={`glass ${s.rows}`}>
        {data.length === 0 && (
          <li className={s.empty}>아직 등록한 프로젝트가 없어요</li>
        )}
        {data.map((p) => {
          const practiced = p.questions.filter((q) =>
            q.sessions.some((ss) =>
              ss.turns.some((t) => t.idx === 0 && t.status === "graded"),
            ),
          ).length;
          const meta =
            p.status === "generating"
              ? "질문을 만들고 있어요"
              : p.status === "failed"
                ? "질문을 만들지 못했어요"
                : `질문 ${p.questions.length}개 · ${practiced ? `${practiced}개 연습함` : "아직 연습 안 함"}`;
          return (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className={`hover-row ${s.row}`}>
                <span className={s.text}>
                  <span className={`num ${s.meta}`}>{meta}</span>
                  <span className={s.name}>{p.name}</span>
                </span>
                <Icon name="chevronRight" size={18} />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={`num ${s.count}`}>
        {data.length} / {MAX_PROJECTS}개 등록
      </p>
      <div className={s.bottom}>
        {full ? (
          <button type="button" className="btn" disabled>
            프로젝트 등록
          </button>
        ) : (
          <Link href="/projects/new" className="btn btn-primary press">
            프로젝트 등록
          </Link>
        )}
      </div>
    </>
  );
}
