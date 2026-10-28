"use client";

import { AppHeader } from "@/components/AppHeader";
import s from "./questions.module.css";

// 목록을 읽다 실패하면(empty-state error) 같은 자리에 안내와 다시 시도
export default function QuestionsError({ reset }: { reset: () => void }) {
  return (
    <div className={s.page}>
      <AppHeader title="Q노트" />
      <h1 className={s.pageTitle}>Q노트</h1>
      <div className={s.error} role="alert">
        <p>질문 목록을 불러오지 못했어요</p>
        <button
          type="button"
          className="btn btn-md btn-secondary press"
          onClick={reset}
        >
          다시 시도하기
        </button>
      </div>
    </div>
  );
}
