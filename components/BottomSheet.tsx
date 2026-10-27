import type { ReactNode } from "react";

// 아래에서 올라오는 시트(면접 답변 입력·결과, 모달 바탕). 화면 위에 뜨는 면이라 그림자, 모서리 12(DESIGN.md radius.panel).
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
      style={{ borderRadius: "var(--radius-panel)", padding: "20px 20px 16px" }}
    >
      {children}
    </section>
  );
}
