import { drawCard } from "@/app/_og/draw";
import { loadShare } from "./load";

// 공유 카드 미리보기 이미지. 카드가 없으면(없는 id) 루트와 같은 대체 그림이 나간다
export const alt = "TailQ 결과 카드";
export { size } from "@/app/_og/draw";
export const contentType = "image/png";

export default async function Image({ params }: PageProps<"/s/[id]">) {
  return drawCard(await loadShare((await params).id));
}
