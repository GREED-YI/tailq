import { useId } from "react";
import { TAIL_POINTS, WORDMARK_D } from "./logo-paths";

// TailQ 워드마크(public/brand/wordmark.svg). 몸통은 둘레 글자색(currentColor), Q 꼬리는 --brand-tail(DESIGN.md).
// 몸통은 꼬리 영역을 마스크로 빼고, 꼬리는 그 영역만 잘라 그려 두 색이 겹치지 않는다(다크에서 꼬리 둘레가 밝게 번지지 않게).
// height는 px 숫자나 CSS 값(예: "var(--logo-h)"). mono면 전부 글자색
export function Logo({
  height = 24,
  mono = false,
}: {
  height?: number | string;
  mono?: boolean;
}) {
  const id = useId();
  const clip = `${id}c`;
  const mask = `${id}m`;
  return (
    <svg
      viewBox="0 0 938.09 319.82"
      role="img"
      aria-label="TailQ"
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: "auto",
        height,
        aspectRatio: "938.09 / 319.82",
      }}
    >
      {mono ? (
        <path fill="currentColor" fillRule="evenodd" d={WORDMARK_D} />
      ) : (
        <>
          <defs>
            <clipPath id={clip}>
              <polygon points={TAIL_POINTS} />
            </clipPath>
            <mask
              id={mask}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="938.09"
              height="319.82"
            >
              <rect width="938.09" height="319.82" fill="white" />
              <polygon points={TAIL_POINTS} fill="black" />
            </mask>
          </defs>
          <path
            fill="currentColor"
            fillRule="evenodd"
            mask={`url(#${mask})`}
            d={WORDMARK_D}
          />
          <path
            fill="var(--brand-tail)"
            fillRule="evenodd"
            clipPath={`url(#${clip})`}
            d={WORDMARK_D}
          />
        </>
      )}
    </svg>
  );
}

// 앱 아이콘과 같은 오렌지 Q 표시(primary 바탕에 on-primary Q 심볼, Q 폭은 한 변의 62%).
// DESIGN.md 규칙대로 로그인 화면 위쪽에만 쓴다(공유 미리보기 이미지는 app/_og/draw.tsx가 따로 그린다)
export function AppMark({ size }: { size: number | string }) {
  return (
    <span
      role="img"
      aria-label="TailQ"
      style={{
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "var(--radius-panel)",
        background: "var(--primary)",
      }}
    >
      <span
        style={{
          width: "62%",
          aspectRatio: "663.08 / 570.81",
          background: "var(--on-primary)",
          WebkitMask: "url(/brand/symbol.svg) center / contain no-repeat",
          mask: "url(/brand/symbol.svg) center / contain no-repeat",
        }}
      />
    </span>
  );
}
