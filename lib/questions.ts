import { z } from "zod";

// 콘텐츠 파일의 질문 한 개(08 설계 5장). 적재 스크립트와 서버가 같은 모양으로 검증한다.
export const QuestionFile = z.object({
  id: z.number().int().positive(),
  topic_id: z.string().min(1),
  level: z.enum(["basic", "mid", "deep"]),
  prompt: z.string().min(5).max(300),
  is_hidden: z.boolean().default(false),
  trial_field: z.enum(["cs", "backend", "frontend"]).nullable().default(null),
  rubric: z.object({
    keywords: z.array(z.string().min(1).max(40)).min(2).max(8),
    criteria: z.array(z.string().min(1).max(200)).min(1).max(6),
  }),
  model_answer: z.string().min(20).max(2000),
  links: z
    .array(z.object({ title: z.string().min(1), url: z.url() }))
    .min(1)
    .max(3),
});

export type QuestionFile = z.infer<typeof QuestionFile>;

// 화면의 질문 번호(08 설계 "questions"). 은행 질문은 "Q.042", 프로젝트 질문은 "내 프로젝트"
export const qLabel = (q: { id: number; project_id: string | null }) =>
  q.project_id ? "내 프로젝트" : `Q.${String(q.id).padStart(3, "0")}`;

type TaggedQuestion = {
  id: number;
  topic_id: string | null;
  topics: { field: string } | null;
  projects: { name: string } | null;
};

// 번호와 주제 줄. 은행 질문은 "Q.042"와 "backend / jpa", 프로젝트 질문은 "내 프로젝트"와 프로젝트 이름
export function questionTags(q: TaggedQuestion) {
  return q.projects
    ? { label: "내 프로젝트", topic: q.projects.name }
    : {
        label: `Q.${String(q.id).padStart(3, "0")}`,
        topic: `${q.topics?.field} / ${q.topic_id}`,
      };
}

export const tagLine = (q: TaggedQuestion) => {
  const t = questionTags(q);
  return `${t.label} · ${t.topic}`;
};

// 프로젝트 등록 규칙(04 기능 명세 9번). 이름·README 최소 길이는 기획에 없어 #39에서 정했다(DB CHECK와 같다)
export const MAX_PROJECTS = 3;
export const NAME_MAX = 40;
export const CONTENT_MIN = 30;
export const CONTENT_MAX = 10_000;
