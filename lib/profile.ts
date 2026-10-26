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

// 기본 아바타(docs/07 결정 9: 색 원 3개 안에 닉네임 첫 글자). social은 소셜 계정 사진이다.
// 사진 업로드는 받지 않는다(04 기능 명세 "프로필").
export const AVATARS = ["social", "mint", "sky", "orange"] as const;
export type AvatarChoice = (typeof AVATARS)[number];

// 닉네임 2~12자(앞뒤 공백 제외). DB char_length와 같게 글자(코드 포인트) 수로 센다.
export const nicknameLength = (v: string) => [...v.trim()].length;
export const Nickname = z
  .string()
  .trim()
  .refine((v) => nicknameLength(v) >= 2 && nicknameLength(v) <= 12, {
    message: "2~12자로 입력해 주세요",
  });

// PATCH /api/me 본문. 온보딩(동의·연습 범위·알림)과 프로필 편집(닉네임·아바타·공유 카드 닉네임)이 쓴다.
export const MeUpdate = z
  .strictObject({
    nickname: Nickname,
    avatar: z.enum(AVATARS),
    shareNickname: z.boolean(),
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

// 동의 시각과 온보딩 완료 시각은 브라우저가 아니라 서버 시계로 적는다.
// 소셜 사진 주소는 브라우저가 보낸 값이 아니라 로그인 정보(socialPhoto)에서 넣는다.
export function toProfileUpdate(
  input: MeUpdate,
  now: string,
  socialPhoto: string | null = null,
): Database["public"]["Tables"]["profiles"]["Update"] {
  return {
    ...(input.nickname && { nickname: input.nickname }),
    ...(input.avatar && {
      avatar: input.avatar === "social" ? socialPhoto : input.avatar,
    }),
    ...(input.shareNickname !== undefined && {
      share_nickname: input.shareNickname,
    }),
    ...(input.agreed && { agreed_at: now }),
    ...(input.topics && { topics: input.topics }),
    ...(input.levels && { levels: input.levels }),
    ...(input.notifyOn !== undefined && { notify_on: input.notifyOn }),
    ...(input.notifyHour !== undefined && { notify_hour: input.notifyHour }),
    ...(input.onboarded && { onboarded_at: now }),
  };
}

// 저장된 avatar(소셜 사진 주소 또는 기본 아바타 키)가 어느 선택지인지
export const avatarChoice = (avatar: string | null): AvatarChoice =>
  (AVATARS as readonly string[]).includes(avatar ?? "") && avatar !== "social"
    ? (avatar as AvatarChoice)
    : "social";

// 로그인 정보(user_metadata)의 소셜 사진. 소셜마다 키가 달라 둘 다 본다(handle_new_user와 같다).
// 화면에 그대로 넣으므로 https 주소만 받는다.
export function socialPhoto(meta: unknown): string | null {
  const m = (meta ?? {}) as Record<string, unknown>;
  const url = m.avatar_url ?? m.picture;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

// 로그인 방법(app_metadata.provider) 이름. 로그인 방법이 다르면 다른 계정이라 MY에 보여준다(04 기능 명세 1장)
const PROVIDER_NAMES: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  kakao: "카카오",
};
export const providerName = (provider: unknown) =>
  PROVIDER_NAMES[String(provider)] ?? "이메일";
