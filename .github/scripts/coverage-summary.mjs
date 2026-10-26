// Vitest 커버리지 요약(coverage/coverage-summary.json)을 GitHub Actions 요약에 표로 남긴다.
// 기준치는 아직 걸지 않는다(실제 수치를 본 뒤 정한다).
import { appendFileSync, readFileSync } from "node:fs";

const { total } = JSON.parse(
  readFileSync("coverage/coverage-summary.json", "utf8"),
);
const rows = [
  ["구문", total.statements],
  ["분기", total.branches],
  ["함수", total.functions],
  ["줄", total.lines],
].map(([name, m]) => `| ${name} | ${m.pct}% | ${m.covered} / ${m.total} |`);

const md = [
  "### 커버리지",
  "",
  "| 항목 | 비율 | 덮은 수 |",
  "|---|---|---|",
  ...rows,
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
else console.log(md);
