import { avatarChoice } from "@/lib/profile";
import { Icon } from "./icons";

// 기본 아바타 색. 저장된 키(mint·sky·orange)는 그대로 두고 색만 DESIGN.md 무채색 토큰으로 바꿨다
// (처음엔 Figma C안 S28의 민트·하늘·주황이었는데, 오렌지는 지금 할 일에만 쓰고 C안은 폐기했다).
// 진한 원·중간 원·옅은 원이고, 글자 대비는 토큰 대비 쌍(text·text-sub on canvas)을 따른다
export const AVATAR_COLORS = {
  mint: { bg: "var(--text)", fg: "var(--canvas)" },
  sky: { bg: "var(--text-sub)", fg: "var(--canvas)" },
  orange: { bg: "var(--line)", fg: "var(--text)" },
} as const;

// 프로필 이미지(S27·S28). 소셜 사진이 있으면 사진, 기본 아바타면 색 원 안에 닉네임 첫 글자,
// 둘 다 없으면 사람 아이콘을 그린다.
export function Avatar({
  avatar,
  nickname,
  size,
  className = "",
}: {
  avatar: string | null;
  nickname: string;
  size: number;
  className?: string;
}) {
  const choice = avatarChoice(avatar);
  const box = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  } as const;

  if (choice !== "social")
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{
          ...box,
          background: AVATAR_COLORS[choice].bg,
          color: AVATAR_COLORS[choice].fg,
          fontWeight: 700,
          fontSize: Math.round(size * 0.36),
        }}
      >
        {[...nickname.trim()][0]}
      </span>
    );

  if (avatar)
    return (
      // 소셜 사진은 주소가 소셜마다 달라 next/image 대신 그대로 그린다
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={className}
        style={{ ...box, objectFit: "cover" }}
      />
    );

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        ...box,
        background: "var(--avatar-bg, var(--canvas))",
        color: "var(--avatar-fg, var(--text-sub))",
      }}
    >
      <Icon name="my" size={Math.round(size * 0.46)} />
    </span>
  );
}
