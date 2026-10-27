import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { shareName } from "@/lib/share";
import { TOKENS } from "@/lib/theme";
import { loadShare } from "./load";

// 메신저 미리보기 이미지(04 기능 명세 8번). 공유 카드와 같은 칸(닉네임·주제·점수·꼬리잇기)만 그린다.
// 다크 테마 색으로 고정한다(메신저는 보는 사람의 테마를 알려주지 않는다)
export const alt = "TailQ 결과 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 한글은 Pretendard(SIL OFL 1.1) 서브셋. 자주 쓰는 한글 2,780자라 드문 글자는 빠질 수 있다.
// 경로를 글자 그대로 써야 배포 묶음(파일 추적)에 이 파일들만 들어간다

const C = TOKENS.dark;
const R = 120;
const RING = 2 * Math.PI * R;

export default async function Image({ params }: PageProps<"/s/[id]">) {
  const card = await loadShare((await params).id);
  const [regular, bold, wordmark] = await Promise.all([
    readFile(
      join(
        process.cwd(),
        "node_modules/pretendard/dist/web/static/woff-subset/Pretendard-Regular.subset.woff",
      ),
    ),
    readFile(
      join(
        process.cwd(),
        "node_modules/pretendard/dist/web/static/woff-subset/Pretendard-Bold.subset.woff",
      ),
    ),
    // 워드마크를 다크 글자색으로 칠해 넣는다
    readFile(join(process.cwd(), "public/brand/wordmark.svg"), "utf8"),
  ]);
  const logo = `data:image/svg+xml;base64,${Buffer.from(wordmark.replaceAll("#111418", C.text)).toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 15% 10%, ${C.blob1}, transparent 45%), radial-gradient(circle at 90% 80%, ${C.blob2}, transparent 50%), ${C.bg}`,
        color: C.text,
        fontFamily: "Pretendard",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse는 img만 그린다 */}
      <img
        src={logo}
        alt=""
        width={135}
        height={48}
        style={{ position: "absolute", top: 48, left: 64 }}
      />
      {card ? (
        <div style={{ display: "flex", alignItems: "center", gap: 72 }}>
          <div
            style={{
              position: "relative",
              width: 300,
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              style={{ position: "absolute" }}
            >
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke={C.track}
                strokeWidth="24"
              />
              {card.score > 0 && (
                <circle
                  cx="150"
                  cy="150"
                  r={R}
                  fill="none"
                  stroke={C.ring}
                  strokeWidth="24"
                  strokeLinecap="round"
                  strokeDasharray={`${(RING * card.score) / 100} ${RING}`}
                  transform="rotate(-90 150 150)"
                />
              )}
            </svg>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 104,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {card.score}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: C.sub,
                  marginTop: 8,
                }}
              >
                /100
              </div>
            </div>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}
          >
            <div style={{ display: "flex", fontSize: 30, color: C.sub }}>
              오늘의 기술면접
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2,
                marginTop: 12,
                lineHeight: 1.15,
              }}
            >
              {card.topic_name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                marginTop: 36,
                color: C.sub,
              }}
            >
              <span style={{ color: C.text, fontWeight: 700 }}>
                {shareName(card)}
              </span>
              {card.streak > 0 && (
                <span style={{ display: "flex" }}>
                  <span>&nbsp;·&nbsp;꼬리잇기&nbsp;</span>
                  <span style={{ color: C.accent, fontWeight: 700 }}>
                    {card.streak}
                  </span>
                  <span>&nbsp;일째</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
          매일 기술면접 질문 하나
        </div>
      )}
    </div>,
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
