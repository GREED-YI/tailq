// AI 채점 평가 (#19). 프롬프트는 docs/09-grading.md의 코드 블록을 그대로 읽어 쓴다(문서와 평가가 어긋나지 않게).
// 실제 Claude API를 불러 비용이 든다(한 번에 약 1,300원). 프롬프트를 바꿨을 때만 수동으로 돌린다.
// 실행: npm run eval          (답변마다 3번, 키는 .env.local에서 읽는다)
//       npm run eval -- 1     (답변마다 1번, 빠르게 볼 때)
//   A. 본 질문 채점: 답변 27건 × Haiku·Sonnet × runs
//   B. 꼬리질문 채점(1번째 턴): 답변 20건 × Haiku runs + Sonnet 1(참고)
//   C. 프로젝트 질문 생성: README 2개 × Sonnet 2
// 키는 환경변수 ANTHROPIC_API_KEY에서만 읽고 어디에도 출력하지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY가 없어요. .env.local에 키를 넣고 npm run eval로 실행해 주세요.",
  );
  process.exit(1);
}
const RUNS = Number(process.argv[2] ?? 3);
// 0이나 숫자가 아니면 일부 작업만 유료로 돌아가므로 시작 전에 멈춘다
if (!Number.isInteger(RUNS) || RUNS < 1) {
  console.error("반복 횟수는 1 이상의 정수여야 해요. 예: npm run eval -- 1");
  process.exit(1);
}
const KRW = 1400;
const MODELS = {
  haiku: {
    id: "claude-haiku-5-5",
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
  sonnet: {
    id: "claude-sonnet-5-5",
    input: 2,
    output: 10,
    cacheRead: 0.1, // Sonnet 5.5는 캐시 읽기가 입력 가격의 0.05배
    cacheWrite: 2.5,
  },
};

// docs/09에서 제목 바로 아래 첫 ```text 블록을 꺼낸다
const doc = readFileSync(join(here, "../docs/09-grading.md"), "utf8").replace(
  /\r\n/g,
  "\n",
);
function block(heading) {
  const at = doc.indexOf(`### ${heading}\n`);
  if (at < 0) throw new Error(`docs/09에 "${heading}" 제목이 없어요`);
  const m = doc.slice(at).match(/```text\n([\s\S]*?)\n```/);
  return m[1];
}
const SYS_GRADE = block("채점 시스템 프롬프트");
const SYS_FOLLOW = block("꼬리질문 채점 시스템 프롬프트");
const SYS_PROJECT = block("프로젝트 질문 생성 시스템 프롬프트");
const TASK1 =
  "1번째 꼬리질문입니다. need_more는 true로 두고 follow_up을 반드시 만듭니다.";
if (!doc.includes(TASK1))
  throw new Error(
    "docs/09의 1번째 꼬리질문 <task> 문장이 바뀌었어요. 스크립트를 맞춰 주세요",
  );

const FollowUp = z.object({
  question: z.string(),
  expected_answer: z.string(),
});
const Grade = z.object({
  criteria: z.object({
    concept: z.number(),
    reason: z.number(),
    application: z.number(),
    delivery: z.number(),
  }),
  score: z.number(),
  headline: z.string(),
  good_points: z.array(z.string()),
  improve_points: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  follow_up: FollowUp,
});
const FollowGrade = z.object({
  verdict: z.enum(["good", "partial", "wrong"]),
  feedback: z.string(),
  need_more: z.boolean(),
  follow_up: FollowUp.nullable(),
});
const Project = z.object({
  questions: z.array(
    z.object({
      kind: z.enum(["design", "tech", "trouble"]),
      question: z.string(),
      keywords: z.array(z.string()),
      criteria: z.array(z.string()),
      model_answer: z.string(),
      source: z.string(),
    }),
  ),
});

const set = JSON.parse(readFileSync(join(here, "eval-set.json"), "utf8"));
const qById = Object.fromEntries(set.questions.map((q) => [q.id, q]));
const client = new Anthropic();
const rubricText = (r) =>
  `keywords: ${r.keywords.join(", ")}\ncriteria:\n${r.criteria.map((c) => `- ${c}`).join("\n")}`;

async function call(modelKey, system, content, schema, maxTokens = 8000) {
  const m = MODELS[modelKey];
  const started = Date.now();
  const res = await client.messages.parse({
    model: m.id,
    max_tokens: maxTokens,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  const u = res.usage;
  const usd =
    ((u.input_tokens ?? 0) * m.input +
      (u.output_tokens ?? 0) * m.output +
      (u.cache_read_input_tokens ?? 0) * m.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * m.cacheWrite) /
    1e6;
  const base = {
    ms: Date.now() - started,
    usd,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
  if (res.stop_reason === "refusal" || !res.parsed_output)
    return { ok: false, stop: res.stop_reason, ...base };
  return { ok: true, out: res.parsed_output, ...base };
}

async function pool(tasks, n = 4) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tasks.length) {
        const k = i++;
        const { meta, fn } = tasks[k];
        try {
          out[k] = { ...meta, ...(await fn()) };
          process.stdout.write(out[k].ok ? "." : "x");
        } catch (e) {
          // 예외도 어느 작업의 실패인지 남겨 보고서의 실패 수에 들어가게 한다
          out[k] = {
            ...meta,
            ok: false,
            error: `${e?.constructor?.name}: ${e?.message}`,
          };
          process.stdout.write("E");
        }
      }
    }),
  );
  return out;
}

// A. 본 질문 채점
const gradeContent = (item) => {
  const q = qById[item.qid];
  return `<question>${q.question}</question>\n<topic>${q.topic} · 난이도 ${q.level}</topic>\n<rubric>\n${rubricText(q.rubric)}\n</rubric>\n<model_answer>${q.model_answer}</model_answer>\n<answer>${item.text}</answer>`;
};
const tasksA = [];
for (const modelKey of ["haiku", "sonnet"])
  set.answers.forEach((item, idx) => {
    for (let r = 0; r < RUNS; r++)
      tasksA.push({
        meta: { part: "A", modelKey, idx, run: r },
        fn: () => call(modelKey, SYS_GRADE, gradeContent(item), Grade),
      });
  });

// B. 꼬리질문 채점(1번째). 본 질문 턴은 부분 정답(50점)으로 고정한다
const tasksB = [];
set.followups.forEach((f, fi) => {
  const q = qById[f.qid];
  const partial = set.answers.find(
    (a) => a.qid === f.qid && a.kind === "partial",
  );
  f.answers.forEach(([expect, text], ai) => {
    const content = `<question>${q.question}</question>\n<rubric>\n${rubricText(q.rubric)}\n</rubric>\n<model_answer>${q.model_answer}</model_answer>\n<history>\n<turn idx="0">\n<answer>${partial.text}</answer>\n<result score="50">${f.question.replace(/\?$/, "")}에 대한 설명이 빠졌어요</result>\n</turn>\n</history>\n<current idx="1">\n<question>${f.question}</question>\n<expected_answer>${f.expected}</expected_answer>\n<answer>${text}</answer>\n</current>\n<task>${TASK1}</task>`;
    for (const [modelKey, runs] of [
      ["haiku", RUNS],
      ["sonnet", 1],
    ])
      for (let r = 0; r < runs; r++)
        tasksB.push({
          meta: { part: "B", modelKey, fi, ai, expect, run: r },
          fn: () => call(modelKey, SYS_FOLLOW, content, FollowGrade),
        });
  });
});

// C. 프로젝트 질문 생성
const tasksC = [];
set.projects.forEach((p, pi) => {
  for (let r = 0; r < 2; r++)
    tasksC.push({
      meta: { part: "C", modelKey: "sonnet", pi, run: r },
      fn: () =>
        call(
          "sonnet",
          SYS_PROJECT,
          `<project_name>${p.name}</project_name>\n<readme>${p.readme}</readme>`,
          Project,
          16000,
        ),
    });
});

console.log(
  `A ${tasksA.length}건 · B ${tasksB.length}건 · C ${tasksC.length}건`,
);
const results = await pool([...tasksA, ...tasksB, ...tasksC]);
// 초 단위까지 넣어 같은 분에 끝난 실행끼리 결과 파일을 덮어쓰지 않게 한다
const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
mkdirSync(join(here, "results"), { recursive: true });
writeFileSync(
  join(here, "results", `eval-${stamp}.json`),
  JSON.stringify(results, null, 2),
);

// 요약
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
const krw = (rs) => (rs.reduce((s, r) => s + (r.usd ?? 0), 0) * KRW).toFixed(0);
const md = [`# 채점 평가 (${stamp})`, ""];

md.push(
  "## A. 본 질문 채점",
  "",
  "| 모델 | 기대 범위 안 | 70점 합격 판단 | 흔들림 | 기준 합 = 점수 | missing_keywords 부분집합 | 틀린 답 잘한 점 비움 | 호출당 | 실패 |",
  "|---|---|---|---|---|---|---|---|---|",
);
const rowsA = {};
for (const modelKey of ["haiku", "sonnet"]) {
  const rs = results.filter((r) => r.part === "A" && r.modelKey === modelKey);
  const ok = rs.filter((r) => r.ok);
  let inRange = 0,
    judged = 0,
    passOk = 0,
    passJudged = 0;
  const spreads = [];
  rowsA[modelKey] = set.answers.map((item, idx) => {
    const mine = ok.filter((r) => r.idx === idx);
    const scores = mine.map((r) =>
      Math.max(
        0,
        Math.min(
          100,
          Object.values(r.out.criteria).reduce((s, x) => s + x, 0),
        ),
      ),
    );
    if (scores.length > 1) spreads.push(sd(scores));
    let inR = "-";
    if (item.expect && scores.length) {
      judged++;
      inR =
        mean(scores) >= item.expect[0] && mean(scores) <= item.expect[1]
          ? "O"
          : "X";
      if (inR === "O") inRange++;
    }
    if (item.kind !== "noreason" && scores.length) {
      passJudged++;
      if (scores.every((x) => (item.kind === "good" ? x >= 70 : x < 70)))
        passOk++;
    }
    const c = mine[0]?.out?.criteria;
    return `| ${item.qid} | ${item.kind} | ${item.expect?.join("~") ?? "관찰"} | ${scores.join(", ") || "실패"} | ${inR} | ${c ? `${c.concept}/${c.reason}/${c.application}/${c.delivery}` : ""} | ${(mine[0]?.out?.missing_keywords ?? []).join(", ")} |`;
  });
  const sumOk = ok.filter(
    (r) =>
      Object.values(r.out.criteria).reduce((s, x) => s + x, 0) === r.out.score,
  ).length;
  const kwOk = ok.filter((r) =>
    r.out.missing_keywords.every((k) =>
      qById[set.answers[r.idx].qid].rubric.keywords.includes(k),
    ),
  ).length;
  const wrongs = ok.filter((r) =>
    ["wrong", "injection"].includes(set.answers[r.idx].kind),
  );
  const emptyGood = wrongs.filter((r) => r.out.good_points.length === 0).length;
  md.push(
    `| ${MODELS[modelKey].id} | ${inRange}/${judged} | ${passOk}/${passJudged} | ${spreads.length ? mean(spreads).toFixed(1) : "-"} | ${sumOk}/${ok.length} | ${kwOk}/${ok.length} | ${emptyGood}/${wrongs.length} | ${(Number(krw(rs)) / (rs.length || 1)).toFixed(1)}원 | ${rs.length - ok.length} |`,
  );
}
md.push("");
for (const modelKey of ["haiku", "sonnet"])
  md.push(
    `### ${MODELS[modelKey].id}`,
    "",
    "| 질문 | 종류 | 기대 | 점수 | 범위 안 | 기준(1회차) | 보완할 개념(1회차) |",
    "|---|---|---|---|---|---|---|",
    ...rowsA[modelKey],
    "",
  );

md.push(
  "## B. 꼬리질문 채점 (1번째 턴)",
  "",
  "| 모델 | 판정 맞음 | 같은 답 판정 뒤집힘 | follow_up 있음 | 호출당 | 실패 |",
  "|---|---|---|---|---|---|",
);
const rowsB = [];
for (const modelKey of ["haiku", "sonnet"]) {
  const rs = results.filter((r) => r.part === "B" && r.modelKey === modelKey);
  const ok = rs.filter((r) => r.ok);
  const right = ok.filter((r) => r.out.verdict === r.expect).length;
  let flips = 0,
    groups = 0;
  set.followups.forEach((f, fi) =>
    f.answers.forEach((_, ai) => {
      const vs = ok
        .filter((r) => r.fi === fi && r.ai === ai)
        .map((r) => r.out.verdict);
      if (vs.length > 1) {
        groups++;
        if (new Set(vs).size > 1) flips++;
      }
      if (modelKey === "haiku")
        rowsB.push(
          `| ${f.qid} | ${f.answers[ai][0]} | ${vs.join(", ")} | ${ok.find((r) => r.fi === fi && r.ai === ai)?.out?.follow_up?.question?.replaceAll("|", "/") ?? "(없음)"} |`,
        );
    }),
  );
  const hasFu = ok.filter((r) => r.out.follow_up).length;
  md.push(
    `| ${MODELS[modelKey].id} | ${right}/${ok.length} | ${groups ? `${flips}/${groups}` : "-"} | ${hasFu}/${ok.length} | ${(Number(krw(rs)) / (rs.length || 1)).toFixed(1)}원 | ${rs.length - ok.length} |`,
  );
}
md.push(
  "",
  "| 질문 | 기대 | Haiku 판정 | 다음 꼬리질문(1회차) |",
  "|---|---|---|---|",
  ...rowsB,
  "",
);

md.push("## C. 프로젝트 질문 생성 (Sonnet)", "");
const norm = (s) => s.replace(/\s+/g, " ").trim();
for (const r of results.filter((r) => r.part === "C")) {
  const p = set.projects[r.pi];
  if (!r.ok) {
    md.push(`### ${p.name} ${r.run + 1}회차: 실패 (${r.stop ?? r.error})`, "");
    continue;
  }
  const qs = r.out.questions;
  const order =
    qs.map((q) => q.kind).join(",") === "design,design,tech,tech,trouble";
  const srcOk = qs.filter((q) => {
    const src = norm(q.source).replace(/^["']|["']$/g, "");
    return src !== "" && norm(p.readme).includes(src); // 빈 근거는 README에 있다고 세지 않는다
  }).length;
  const long = qs.filter((q) => q.question.length > 80).length;
  md.push(
    `### ${p.name} ${r.run + 1}회차 (${(r.usd * KRW).toFixed(0)}원) — 5개 ${qs.length === 5 ? "O" : "X"} · 순서 ${order ? "O" : "X"} · source가 README에 있음 ${srcOk}/${qs.length} · 80자 초과 ${long}`,
    "",
  );
  for (const q of qs)
    md.push(
      `- [${q.kind}] ${q.question} — 키워드: ${q.keywords.join(", ")}\n  - 예시 답안: ${q.model_answer}`,
    );
  md.push("");
}

const total = krw(results);
md.splice(
  1,
  0,
  `합계 ${total}원 · 캐시 읽기 평균 ${Math.round(mean(results.filter((r) => r.ok && r.cacheRead).map((r) => r.cacheRead)))}토큰`,
  "",
);
writeFileSync(join(here, "results", `eval-${stamp}.md`), md.join("\n"));
console.log(`\n\n합계 ${total}원\n자세한 결과: results/eval-${stamp}.md`);
