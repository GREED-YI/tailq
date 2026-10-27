import type { Metadata } from "next";
import { ProjectForm } from "./ProjectForm";
import s from "../projects.module.css";

export const metadata: Metadata = { title: "프로젝트 등록 · TailQ" };

// 프로젝트 등록(04 기능 명세 9번, S23). 3개를 넘으면 서버가 409 PROJECT_LIMIT으로 막는다.
export default function NewProjectPage() {
  return (
    <div className={`${s.page} ${s.detail}`}>
      <ProjectForm />
    </div>
  );
}
