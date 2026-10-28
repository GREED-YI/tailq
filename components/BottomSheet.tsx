import type { ReactNode } from "react";

// 아래에서 올라오는 시트(면접 답변 입력·결과, 모달 바탕). 화면 위에 뜨는 면이라 그림자, 모서리 12(DESIGN.md radius.panel).
// 바탕은 대화상자와 같은 canvas(DESIGN.md dialog 토큰)
export function BottomSheet({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section
      className="glass-strong rise"
      aria-label={label}
      style={{
        background: "var(--canvas)",
        borderRadius: "var(--radius-panel)",
        padding: "20px 20px 16px",
      }}
    >
      {children}
    </section>
  );
}
