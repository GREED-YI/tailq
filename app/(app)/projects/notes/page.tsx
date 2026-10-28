import type { Metadata } from "next";
import { ProjectList } from "../list";

export const metadata: Metadata = { title: "학습 자료 · Q메이커 · TailQ" };

// Q메이커의 학습 자료 구획(04 기능 명세 9번 "학습 자료", #141). 학습 자료는 프로젝트와 따로 3개까지,
// 누르면 학습 자료 질문 목록으로 간다
export default function NotesPage() {
  return <ProjectList kind="note" />;
}
