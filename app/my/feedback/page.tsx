import type { Metadata } from "next";
import { Suspense } from "react";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback";
import f from "@/components/Flow.module.css";
import s from "../my.module.css";
import { MyLoading } from "../MyLoading";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "피드백 보내기 · TailQ" };

// 피드백 보내기(04 기능 명세 12장). MY와 공개 화면 푸터의 "피드백 보내기"에서 오고,
// 채점 결과·질문 상세의 "질문·채점이 이상해요"(#134)는 ?category=report&q=질문id로 분류와 본문 첫 줄을 미리 채운다.
// 로그인 여부는 proxy.ts가 보고(쿼리까지 next에 담아 돌려보낸다), 저장할 때 POST /api/feedback이 다시 확인한다
export default function FeedbackPage({
  searchParams,
}: PageProps<"/my/feedback">) {
  return (
    <div className={s.main}>
      <Suspense fallback={<Loading />}>
        {searchParams.then(({ category, q }) => {
          const initialCategory =
            FEEDBACK_CATEGORIES.find((c) => c.id === category)?.id ?? "etc";
          const initialBody =
            typeof q === "string" && /^\d{1,9}$/.test(q)
              ? `Q.${q.padStart(3, "0")} 질문 신고: `
              : "";
          return (
            <FeedbackForm
              key={`${initialCategory}-${initialBody}`}
              initialCategory={initialCategory}
              initialBody={initialBody}
            />
          );
        })}
      </Suspense>
    </div>
  );
}

// 불러오는 동안: 분류 칩 · 의견 칸 · 보내기 버튼 자리
function Loading() {
  return (
    <MyLoading title="피드백 보내기">
      <p className={f.sub}>
        불편했던 점, 바라는 기능, 채점이 이상했던 질문까지 무엇이든 편하게 남겨
        주세요.
      </p>
      <p className={`${s.label} ${s.gap}`}>분류</p>
      <span className="skeleton" style={{ marginTop: 8, height: 44 }} />
      <p className={`${s.label} ${s.gap}`}>의견</p>
      <span className="skeleton" style={{ marginTop: 8, height: 200 }} />
      <p className={s.helpRow}>운영자만 읽어요. 따로 답장은 드리지 못해요.</p>
      <div className={f.bottom}>
        <span className="skeleton" style={{ height: 52 }} />
      </div>
    </MyLoading>
  );
}
