// TailQ 워드마크(public/brand/wordmark.svg). SVG를 마스크로 써서 둘레 글자색(currentColor)을 그대로 입힌다.
// height는 px 숫자나 CSS 값(예: "var(--logo-h)")
export function Logo({ height = 24 }: { height?: number | string }) {
  return (
    <span
      role="img"
      aria-label="TailQ"
      style={{
        display: "inline-block",
        flexShrink: 0,
        height,
        aspectRatio: "938.09 / 319.82",
        background: "currentColor",
        WebkitMask: "url(/brand/wordmark.svg) center / contain no-repeat",
        mask: "url(/brand/wordmark.svg) center / contain no-repeat",
      }}
    />
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
