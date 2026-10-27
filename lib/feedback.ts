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
