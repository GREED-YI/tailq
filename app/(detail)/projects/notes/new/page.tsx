import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { limitNotice } from "@/components/LimitNotice";
import { LoadingStatus } from "@/components/LoadingStatus";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/server/usage";
import { FileDropBody, ProjectForm } from "../../new/ProjectForm";
import s from "@/app/(app)/projects/projects.module.css";

export const metadata: Metadata = { title: "학습 자료 등록 · TailQ" };

// 학습 자료 등록(04 기능 명세 9번 "학습 자료", #141). 프로젝트 등록(S23)과 같은 화면에 파일 불러오기(#144)가 더 있다.
// 3개를 넘으면 서버가 409 NOTE_LIMIT으로 막는다. 하루 등록 한도(프로젝트와 함께 센다)나 월 예산에 닿았으면
// 자료를 다 쓴 뒤에 막히지 않게 입력칸 대신 안내를 보여준다(04 기능 명세 12장)
export default function NewNotePage() {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense fallback={<Loading />}>
        <Form />
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 머리는 그대로, 제목 칸 · 파일 자리 · 자료 칸은 같은 크기의 빈 칸으로(레이아웃이 밀리지 않게). 움직이지 않는다
function Loading() {
  return (
    <>
      <header className={s.top}>
        <Link
          href="/projects/notes"
          className="press icon-btn"
          aria-label="학습 자료 목록으로"
        >
          <Icon name="chevronLeft" />
        </Link>
        <h1>학습 자료 등록</h1>
      </header>
      <LoadingStatus />
      <div className={s.form} aria-busy="true" aria-hidden="true">
        <span className={`skeleton ${s.fieldSkeleton}`} />
        {/* 파일 자리는 실제 자리와 같은 마크업을 회색으로 칠해 그린다(높이가 저절로 같다) */}
        <div className={`${s.fileDrop} ${s.fileSkeleton}`} inert>
          <FileDropBody ids={false} />
        </div>
        <span className={`skeleton ${s.fieldSkeleton}`} data-kind="textarea" />
      </div>
    </>
  );
}

async function Form() {
  const { data } = await (await createClient()).auth.getClaims();
  const notice = limitNotice(
    await loadQuota(createAdminClient(), data?.claims.sub ?? null),
    "register",
  );
  return <ProjectForm kind="note" notice={notice} />;
}
