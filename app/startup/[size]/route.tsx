import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { STARTUP } from "@/app/_og/startup";
import { TOKENS } from "@/lib/theme";

// 아이폰 시작 화면 그림. 빌드 때 크기마다 미리 만든다(PNG 파일을 커밋하지 않는다)
export function generateStaticParams() {
  return STARTUP.map(({ name }) => ({ size: name }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/startup/[size]">,
) {
  const { size } = await params;
  // 목록에 있는 크기만 그린다(아무 크기나 큰 그림을 만들게 두지 않는다)
  if (!STARTUP.some((s) => s.name === size))
    return new Response(null, { status: 404 });
  return new Response(await draw(size), {
    headers: { "content-type": "image/png" },
  });
}

// 파일 읽기·그리기를 캐시해야 빌드 때 정적으로 미리 만들어진다(cacheComponents)
async function draw(size: string) {
  "use cache";
  const [width, height] = size.slice(0, -4).split("x").map(Number);
  const symbol = await readFile(
    join(process.cwd(), "public/brand/symbol.svg"),
    "utf8",
  );
  // 앱 아이콘(public/icons)과 같은 짝: #FF4F12 바탕에 #111312 Q. 모서리는 한 변의 22%, Q 폭은 62%
  const mark = `data:image/svg+xml;base64,${Buffer.from(symbol.replaceAll("currentColor", TOKENS.light["on-primary"])).toString("base64")}`;
  const side = Math.round(width / 4);
  const q = Math.round(side * 0.62);

  // 바탕은 manifest background_color와 같은 다크 canvas(안드로이드 시작 화면과 같게)
  const png = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: TOKENS.dark.canvas,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: side,
          height: side,
          borderRadius: Math.round(side * 0.22),
          background: TOKENS.light.primary,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse는 img만 그린다 */}
        <img
          src={mark}
          alt=""
          width={q}
          height={Math.round((q * 570.81) / 663.08)}
        />
      </div>
    </div>,
    { width, height },
  );
  return new Uint8Array(await png.arrayBuffer());
}
