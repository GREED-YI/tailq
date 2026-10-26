// 질문 콘텐츠를 DB에 넣는다(08 설계 5장). 여러 번 돌려도 결과가 같다(id 기준 upsert).
// 질문을 고치거나 숨기려면 파일을 고치고(숨기기는 is_hidden: true) 다시 돌린다. 지우지 않는다.
//
//   npm run seed:questions                    샘플 질문(supabase/seed/sample-questions.json)
//   npm run seed:questions -- <파일 또는 폴더>   비공개 콘텐츠 저장소의 questions/ 등
//
// NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY(서버 전용)를 쓴다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { QuestionFile } from "../lib/questions.ts";

const target =
  process.argv[2] ??
  (process.env.CONTENT_DIR
    ? join(process.env.CONTENT_DIR, "questions")
    : "supabase/seed/sample-questions.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요해요.",
  );
  process.exit(1);
}

// 파일 하나(질문 배열 또는 질문 1개) 또는 폴더 안의 *.json 전부
const files = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(target, f))
  : [target];

const raw = files.flatMap((f) => {
  const data: unknown = JSON.parse(readFileSync(f, "utf8"));
  return (Array.isArray(data) ? data : [data]).map((q) => ({ f, q }));
});

const problems: string[] = [];
const questions = raw.flatMap(({ f, q }) => {
  const r = QuestionFile.safeParse(q);
  if (r.success) return [r.data];
  problems.push(
    `${f}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ")}`,
  );
  return [];
});
const ids = questions.map((q) => q.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) problems.push(`id가 겹쳐요: ${[...new Set(dup)].join(", ")}`);
if (problems.length) {
  console.error(`검증 실패 ${problems.length}건\n${problems.join("\n")}`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { error: qErr } = await db.from("questions").upsert(
  questions.map(({ id, topic_id, level, prompt, is_hidden, trial_field }) => ({
    id,
    topic_id,
    level,
    prompt,
    is_hidden,
    trial_field,
  })),
);
if (qErr) throw new Error(`questions 저장 실패: ${qErr.message}`);

const { error: kErr } = await db.from("question_keys").upsert(
  questions.map(({ id, rubric, model_answer, links }) => ({
    question_id: id,
    rubric,
    model_answer,
    links,
  })),
);
if (kErr) throw new Error(`question_keys 저장 실패: ${kErr.message}`);

const { error: sErr } = await db.rpc("sync_question_id_seq");
if (sErr) throw new Error(`id 시퀀스 맞추기 실패: ${sErr.message}`);

const hidden = questions.filter((q) => q.is_hidden).length;
console.log(
  `질문 ${questions.length}개를 넣었어요 (숨김 ${hidden}개). 대상: ${target}`,
);
