import type { Metadata } from "next";
import { Suspense } from "react";
import f from "@/components/Flow.module.css";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback";
import s from "../my.module.css";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "피드백 보내기 · TailQ" };

// 피드백 보내기(04 기능 명세 12장). MY와 공개 화면 푸터의 "피드백 보내기"에서 오고,
// 채점 결과·질문 상세의 "질문·채점이 이상해요"(#134)는 ?category=report&q=질문id로 분류와 본문 첫 줄을 미리 채운다.
// 로그인 여부는 proxy.ts가 보고(쿼리까지 next에 담아 돌려보낸다), 저장할 때 POST /api/feedback이 다시 확인한다
export default function FeedbackPage({
  searchParams,
}: PageProps<"/my/feedback">) {
  return (
    <main className={`${f.main} ${s.main}`}>
      <Suspense>
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
    </main>
  );
}
