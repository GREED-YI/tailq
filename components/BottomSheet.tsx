import type { ReactNode } from "react";

// 아래에서 0.5초 동안 올라오는 유리 시트(면접 답변 입력·결과, 모달 바탕). 모서리 30.
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
      style={{ borderRadius: 30, padding: "20px 18px 16px" }}
    >
      {children}
    </section>
  );
}
