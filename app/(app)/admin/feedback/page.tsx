import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/admin";
import { Icon } from "@/components/icons";
import { LoadingStatus } from "@/components/LoadingStatus";
import { categoryLabel, FEEDBACK_CATEGORIES } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import s from "../admin.module.css";
import { countFeedback, FeedbackList } from "../Table";

export const metadata: Metadata = {
  title: "피드백 · 운영 · TailQ",
  robots: { index: false },
};

// 받은 피드백 목록(운영 대시보드 "사용자 피드백" 칸에서 온다). 운영자가 아니면 404.
// ?category=bug처럼 분류로 거른다(없거나 모르는 값이면 전체)
export default function FeedbackListPage({
  searchParams,
}: PageProps<"/admin/feedback">) {
  return (
    <div className={s.page} data-admin>
      <AppHeader />
      <Suspense fallback={<Loading />}>
        {searchParams.then(({ category }) => (
          <Feedback
            category={
              FEEDBACK_CATEGORIES.find((c) => c.id === category)?.id ?? null
            }
          />
        ))}
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 뒤로 링크 · 제목 · 분류 칩 · 목록 자리. 운영 대시보드처럼 글 없이 칸만 둔다
function Loading() {
  return (
    <>
      <LoadingStatus />
      <div className={s.narrow} aria-busy="true" aria-hidden="true">
        <div className={s.backLink} />
        <div className={s.top}>
          <h1 className="skeleton" style={{ width: 160 }} />
        </div>
        <div className={s.filters}>
          {CHIP_WIDTHS.map((w, i) => (
            <span
              key={i}
              className="skeleton"
              style={{ width: w, height: 44, borderRadius: 999 }}
            />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={s.feedbackSkeleton}>
            <span className="skeleton" style={{ width: 64, height: 28 }} />
            <span className="skeleton" />
            <span className="skeleton" style={{ width: "60%" }} />
          </div>
        ))}
      </div>
    </>
  );
}

// 분류 칩(전체 + 분류 4개) 자리. 실제 칩 폭에 가깝게 두어 375에서 같은 곳에서 줄바꿈된다
const CHIP_WIDTHS = [73, 112, 73, 73, 73];

// ponytail: 최근 200개만 보여준다. 넘치기 시작하면 페이지를 나눈다
const LIMIT = 200;

async function Feedback({ category }: { category: string | null }) {
  const { data: auth } = await (await createClient()).auth.getClaims();
  if (!isAdmin(auth?.claims.sub, process.env.ADMIN_USER_IDS)) notFound();

  // 운영자 확인을 마친 뒤에만 RLS를 건너뛰어 읽는다. 누가 보냈는지는 읽지 않는다
  const db = createAdminClient();
  let query = db
    .from("feedback")
    .select("id, body, category, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (category) query = query.eq("category", category);
  const [{ data, count }, kinds] = await Promise.all([
    query.throwOnError(),
    countFeedback(db),
  ]);
  // 분류 칩의 개수. 전체는 분류별 합(분류는 비지 않는다)
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);

  return (
    <div className={s.narrow}>
      <Link href="/admin" className={`press ${s.backLink}`}>
        <Icon name="chevronLeft" size={18} />
        운영 대시보드
      </Link>
      <header className={s.top}>
        <h1>사용자 피드백</h1>
        <span className="num">
          {category ? categoryLabel(category) : "전체"} {count ?? 0}개
          {(count ?? 0) > LIMIT && ` · 최근 ${LIMIT}개`}
        </span>
      </header>
      <nav className={s.filters} aria-label="분류 필터">
        {[{ id: null, label: "전체" }, ...FEEDBACK_CATEGORIES].map((c) => (
          <Link
            key={c.id ?? "all"}
            href={c.id ? `/admin/feedback?category=${c.id}` : "/admin/feedback"}
            replace
            className="chip press"
            aria-current={category === c.id ? "page" : undefined}
          >
            {c.label}
            <span className={`mono ${s.chipCount}`}>
              {c.id ? kinds[c.id] : total}
            </span>
          </Link>
        ))}
      </nav>
      {data.length === 0 ? (
        <div className={s.empty}>
          <p>
            {category
              ? "이 분류의 피드백이 없어요"
              : "아직 받은 피드백이 없어요"}
          </p>
          {category && <small>다른 분류를 고르거나 전체를 봐 주세요.</small>}
        </div>
      ) : (
        <FeedbackList rows={data} />
      )}
    </div>
  );
}
