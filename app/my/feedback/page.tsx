import type { Metadata } from "next";
import f from "@/components/Flow.module.css";
import s from "../my.module.css";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "피드백 보내기 · TailQ" };

// 피드백 보내기(04 기능 명세 12장). 모든 화면 하단의 "피드백 보내기"와 MY에서 온다.
// 로그인 여부는 proxy.ts가 보고, 저장할 때 POST /api/feedback이 다시 확인한다
export default function FeedbackPage() {
  return (
    <main className={`${f.main} ${s.main}`}>
      <FeedbackForm />
    </main>
  );
}
