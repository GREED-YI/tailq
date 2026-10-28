import { AppHeader } from "@/components/AppHeader";
import { ProjectTabs } from "./ProjectTabs";
import s from "./projects.module.css";

// 커스텀 Q 탭(처음엔 "프로젝트"). 제목·설명·구획 탭은 두 구획(프로젝트 /projects, 학습 자료 /projects/notes)이
// 함께 쓰고, 구획을 바꿔도 이 자리는 그대로 두고 아래 목록만 바꾼다
export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return (
    <div className={s.page}>
      <AppHeader title="커스텀 Q" />
      <h1 className={s.pageTitle}>커스텀 Q</h1>
      <p className={s.desc}>
        README나 학습 자료를 넣으면 예상 질문 5개를 만들어 줘요
      </p>
      <ProjectTabs />
      {children}
    </div>
  );
}
