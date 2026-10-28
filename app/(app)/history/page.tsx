import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";

// 기록 목록은 복습 목록과 함께 내 질문(/questions)으로 합쳤다(#128).
// 옛 주소의 북마크·외부 링크는 전체 질문으로, 옛 북마크 필터(?filter=bookmark)는 북마크한 질문으로 보낸다.
// 주소 쿼리는 Suspense 안에서 읽어야 미리 그릴 수 있다(cacheComponents)
export default function OldHistoryPage({
  searchParams,
}: PageProps<"/history">) {
  return (
    <Suspense>
      {searchParams.then(({ filter }) =>
        permanentRedirect(
          `/questions?filter=${filter === "bookmark" ? "bookmark" : "all"}`,
        ),
      )}
    </Suspense>
  );
}
