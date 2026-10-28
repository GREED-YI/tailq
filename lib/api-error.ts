import "server-only";
import { NextResponse } from "next/server";

// 에러 코드 → HTTP 상태(08 설계 "에러 형식"). API 오류 응답의 상태는 여기서만 정한다
export const ERROR_STATUS = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  REAUTH: 403,
  OTHER_ACCOUNT: 403,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  ALREADY_GRADED: 409,
  NOT_GRADED: 409,
  GRADING_IN_PROGRESS: 409,
  SESSION_CLOSED: 409,
  NOT_FAILED: 409,
  PROJECT_LIMIT: 409,
  PROJECT_IN_TODAY_SESSION: 409,
  REGRADE_LIMIT: 429,
  FEEDBACK_LIMIT: 429,
  LIMIT_EXCEEDED: 429,
  BUDGET_EXCEEDED: 429,
  TRIAL_LIMIT: 429,
  INTERNAL: 500,
  AI_FAILED: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const INTERNAL_MESSAGE = "잠시 뒤에 다시 시도해 주세요.";

// 라우트나 lib 어디서든 던지면 withApiErrors가 이 코드·메시지로 응답한다
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const errorResponse = (code: ErrorCode, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status: ERROR_STATUS[code] },
  );

// 라우트 전체를 감싼다. ApiError는 그 코드로, 처리하지 않은 예외는 로그를 남기고 500 INTERNAL로 응답한다
export function withApiErrors<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.code, e.message);
      console.error("api failed", e);
      return errorResponse("INTERNAL", INTERNAL_MESSAGE);
    }
  };
}
