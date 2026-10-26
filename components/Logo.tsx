// TailQ 워드마크. SVG를 마스크로 써서 테마 글자색(--text)을 그대로 입힌다.
export function Logo({ height = 24 }: { height?: number }) {
  return (
    <span
      role="img"
      aria-label="TailQ"
      style={{
        display: "inline-block",
        height,
        aspectRatio: "675 / 241",
        background: "var(--text)",
        WebkitMask: "url(/brand/wordmark.svg) center / contain no-repeat",
        mask: "url(/brand/wordmark.svg) center / contain no-repeat",
        transition: "background-color 0.5s ease",
      }}
    />
  );
}
