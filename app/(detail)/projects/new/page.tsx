import type { Metadata } from "next";
import { Suspense } from "react";
import { limitNotice } from "@/components/LimitNotice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadQuota } from "@/lib/usage";
import { ProjectForm } from "./ProjectForm";
import s from "@/app/(app)/projects/projects.module.css";

export const metadata: Metadata = { title: "프로젝트 등록 · TailQ" };

// 프로젝트 등록(04 기능 명세 9번, S23). 3개를 넘으면 서버가 409 PROJECT_LIMIT으로 막는다.
// 하루 등록 한도나 월 예산에 닿았으면 README를 다 쓴 뒤에 막히지 않게 입력칸 대신 안내를 보여준다(04 기능 명세 12장)
export default function NewProjectPage() {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <Suspense>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const { data } = await (await createClient()).auth.getClaims();
  const notice = limitNotice(
    await loadQuota(createAdminClient(), data?.claims.sub ?? null),
    "register",
  );
  return <ProjectForm notice={notice} />;
}
