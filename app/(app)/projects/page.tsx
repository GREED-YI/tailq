import type { Metadata } from "next";
import { ProjectList } from "./list";

export const metadata: Metadata = { title: "프로젝트 · Q메이커 · TailQ" };

// Q메이커의 프로젝트 구획(04 기능 명세 9번, S22). 프로젝트는 3개까지, 누르면 질문 목록(S24)으로 간다
export default function ProjectsPage() {
  return <ProjectList kind="project" />;
}
