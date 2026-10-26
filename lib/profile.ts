import { z } from "zod";
import type { Database } from "@/lib/database.types";

// 연습 범위 선택지(04 기능 명세 "연습 범위 선택지"). 세부 주제는 DB topics 테이블에 있다.
export const FIELDS = [
  { id: "cs", label: "공통 CS" },
  { id: "backend", label: "백엔드" },
  { id: "frontend", label: "프론트엔드" },
] as const;

export const LEVELS = [
  { id: "basic", label: "기본" },
  { id: "mid", label: "중급" },
  { id: "deep", label: "심화" },
] as const;

export type Level = (typeof LEVELS)[number]["id"];

export function hourLabel(hour: number) {
  return `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:00`;
}

const unique = <T>(list: T[]) => [...new Set(list)];

// PATCH /api/me 본문. 지금은 온보딩이 쓰는 값만 받는다. 닉네임·아바타·테마는 MY 화면에서 붙인다.
export const MeUpdate = z
  .strictObject({
    agreed: z.literal(true),
    topics: z.array(z.string().min(1).max(40)).min(1).max(30).transform(unique),
    levels: z
      .array(z.enum(LEVELS.map((l) => l.id)))
      .min(1)
      .transform(unique),
    notifyOn: z.boolean(),
    notifyHour: z.int().min(0).max(23),
    onboarded: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "바꿀 값이 없어요");

export type MeUpdate = z.infer<typeof MeUpdate>;

// 동의 시각과 온보딩 완료 시각은 브라우저가 아니라 서버 시계로 적는다
export function toProfileUpdate(
  input: MeUpdate,
  now: string,
): Database["public"]["Tables"]["profiles"]["Update"] {
  return {
    ...(input.agreed && { agreed_at: now }),
    ...(input.topics && { topics: input.topics }),
    ...(input.levels && { levels: input.levels }),
    ...(input.notifyOn !== undefined && { notify_on: input.notifyOn }),
    ...(input.notifyHour !== undefined && { notify_hour: input.notifyHour }),
    ...(input.onboarded && { onboarded_at: now }),
  };
}
