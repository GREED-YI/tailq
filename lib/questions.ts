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
