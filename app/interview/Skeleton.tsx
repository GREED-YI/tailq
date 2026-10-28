import { LoadingStatus } from "@/components/LoadingStatus";
import s from "./interview.module.css";

// 불러오는 동안의 자리 표시(DESIGN.md components-states "같은 모양의 자리 표시"). Suspense fallback이 비어 있으면
// 세션을 열고 턴을 읽는 동안 빈 화면이 보인다. 면접과 체험 면접이 같이 쓴다
export function InterviewSkeleton() {
  return (
    <>
      <LoadingStatus />
      <div className={s.screen} aria-busy="true" aria-hidden="true">
        <header className={s.header}>
          <div className={s.headerIn} />
        </header>
        <main className={s.main}>
          {/* 데스크톱 왼쪽 4칸(지금까지의 흐름) 자리. 비워 두어 질문이 오른쪽 8칸에 그대로 선다 */}
          <aside className={s.thread} />
          <section className={s.stage}>
            <SkeletonLines />
            <span className={s.skeleton} data-kind="input" />
          </section>
        </main>
      </div>
    </>
  );
}

// 오늘의 결과 전체 자리(전용 머리 + 본문)
export function ResultSkeleton() {
  return (
    <>
      <LoadingStatus />
      <div className={s.screen} aria-busy="true" aria-hidden="true">
        <header className={s.header}>
          <div className={s.headerIn} />
        </header>
        <main className={s.summaryMain}>
          <SkeletonLines />
        </main>
      </div>
    </>
  );
}

// 라벨 · 제목 두 줄. 체험 결과는 머리가 Suspense 밖이라 이것만 쓴다
export function SkeletonLines() {
  return (
    <div className={s.skeletonGroup} aria-busy="true" aria-hidden="true">
      <span className={s.skeleton} data-kind="tag" />
      <span className={s.skeleton} />
      <span className={s.skeleton} data-kind="short" />
    </div>
  );
}
