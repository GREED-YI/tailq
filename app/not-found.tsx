import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요 · TailQ" };

// 없는 주소(404). 홈(/)은 로그인했으면 /home, 아니면 랜딩으로 간다(proxy.ts)
export default function NotFound() {
  return (
    <StatusScreen
      title="페이지를 찾을 수 없어요"
      body="주소가 바뀌었거나 지워진 페이지예요."
    >
      <Link href="/" className="press btn btn-primary">
        홈으로
      </Link>
    </StatusScreen>
  );
}
