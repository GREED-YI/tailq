import { z } from "zod";

// 앱 안 피드백(04 기능 명세 12장). 길이 기준은 feedback 테이블 check와 같다
export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 1000;
// 한 사람이 24시간 동안 보낼 수 있는 개수
export const FEEDBACK_DAILY = 5;

export const FeedbackBody = z
  .string()
  .trim()
  .min(FEEDBACK_MIN)
  .max(FEEDBACK_MAX);

export const feedbackLength = (v: string) => [...v.trim()].length;

// 피드백 분류(#118). 값은 feedback.category check와 같다. 고르지 않으면 기타
export const FEEDBACK_CATEGORIES = [
  { id: "feature", label: "바라는 기능" },
  { id: "bug", label: "버그" },
  { id: "report", label: "신고" },
  { id: "etc", label: "기타" },
] as const;
export const FeedbackCategory = z
  .enum(["feature", "bug", "report", "etc"])
  .default("etc");
export const categoryLabel = (id: string) =>
  FEEDBACK_CATEGORIES.find((c) => c.id === id)?.label ?? "기타";
