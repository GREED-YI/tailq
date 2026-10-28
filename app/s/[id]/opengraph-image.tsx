import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { shareDate, shareName } from "@/lib/share";
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

export default async function Image({ params }: PageProps<"/s/[id]">) {
  const card = await loadShare((await params).id);
  const font = (file: string) =>
    readFile(
      join(
        process.cwd(),
        "node_modules/pretendard/dist/web/static/woff-subset",
        file,
      ),
    );
  const [regular, bold, mono, wordmark] = await Promise.all([
    font("Pretendard-Regular.subset.woff"),
    font("Pretendard-Bold.subset.woff"),
    // 점수·날짜 숫자는 화면과 같이 Geist Mono(SIL OFL 1.1, geist 패키지)
    readFile(
      join(
        process.cwd(),
        "node_modules/geist/dist/fonts/geist-mono/GeistMono-SemiBold.ttf",
      ),
    ),
    // 워드마크를 다크 글자색으로 칠해 넣는다
    readFile(join(process.cwd(), "public/brand/wordmark.svg"), "utf8"),
  ]);
  const logo = `data:image/svg+xml;base64,${Buffer.from(wordmark.replaceAll("currentColor", C.text)).toString("base64")}`;
  // 20칸 점수 막대(DESIGN.md score-bar): 5점마다 한 칸
  const on = card ? Math.round(card.score / 5) : 0;

  // 화면의 결과 카드와 같은 결: 평평한 바탕, 1px 선, 큰 모노 점수와 20칸 막대. 글래스·그라디언트 없음
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "56px 72px 64px",
        background: C.canvas,
        color: C.text,
        fontFamily: "Pretendard",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 32,
          borderBottom: `2px solid ${C.text}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse는 img만 그린다 */}
        <img src={logo} alt="" width={141} height={48} />
        {card && (
          <div
            style={{
              display: "flex",
              fontFamily: "Geist Mono",
              fontSize: 26,
              color: C["text-muted"],
            }}
          >
            {shareDate(card)}
          </div>
        )}
      </div>
      {card ? (
        <div
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 72 }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 20px",
                borderRadius: 999,
                background: C["accent-soft"],
                color: C.accent,
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              오늘의 기술면접
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2,
                marginTop: 24,
                lineHeight: 1.2,
              }}
            >
              {card.topic_name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                marginTop: 28,
                color: C["text-sub"],
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
          <div
            style={{
              width: 380,
              display: "flex",
              flexDirection: "column",
              gap: 24,
              padding: 32,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: "Geist Mono",
                  fontSize: 132,
                  lineHeight: 0.9,
                  letterSpacing: -6,
                  color:
                    card.score < 40
                      ? C.danger
                      : card.score < 70
                        ? C["text-sub"]
                        : C.text,
                }}
              >
                {card.score}
              </span>
              <span
                style={{
                  fontFamily: "Geist Mono",
                  fontSize: 30,
                  color: C["text-muted"],
                }}
              >
                /100
              </span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 20,
                    borderRadius: 2,
                    background: i < on ? C.text : "transparent",
                    border: i < on ? "none" : `2px solid ${C["mark-empty"]}`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: -1.5,
          }}
        >
          매일 기술면접 질문 하나
        </div>
      )}
    </div>,
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
