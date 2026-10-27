import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import s from "../admin.module.css";

export const metadata: Metadata = {
  title: "피드백 · 운영 · TailQ",
  robots: { index: false },
};

// 받은 피드백 목록(운영 대시보드 "사용자 피드백" 칸에서 온다). 운영자가 아니면 404
export default function FeedbackListPage() {
  return (
    <div className={s.page} data-admin>
      <AppHeader />
      <Suspense>
        <FeedbackList />
      </Suspense>
    </div>
  );
}

// ponytail: 최근 200개만 보여준다. 넘치기 시작하면 페이지를 나눈다
const LIMIT = 200;

const when = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

async function FeedbackList() {
  const { data: auth } = await (await createClient()).auth.getClaims();
  if (!isAdmin(auth?.claims.sub, process.env.ADMIN_USER_IDS)) notFound();

  // 운영자 확인을 마친 뒤에만 RLS를 건너뛰어 읽는다. 누가 보냈는지는 읽지 않는다
  const { data, count } = await createAdminClient()
    .from("feedback")
    .select("id, body, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(LIMIT)
    .throwOnError();

  return (
    <>
      <Link href="/admin" className={s.backLink}>
        ‹ 운영 대시보드
      </Link>
      <header className={s.top}>
        <h1>사용자 피드백</h1>
        <span className="num">
          전체 {count ?? 0}개{(count ?? 0) > LIMIT && ` · 최근 ${LIMIT}개`}
        </span>
      </header>
      {data.length === 0 ? (
        <p className={`glass ${s.card} ${s.empty}`}>
          아직 받은 피드백이 없어요
        </p>
      ) : (
        <ul className={s.feedbackList}>
          {data.map((v) => (
            <li key={v.id} className={`glass ${s.card}`}>
              <p>{v.body}</p>
              <time className="num" dateTime={v.created_at}>
                {when(v.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
