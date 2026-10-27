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
