import { drawCard } from "@/app/_og/draw";

// 랜딩 등 공유 카드가 아닌 주소의 미리보기 이미지. 공유 카드의 대체 상태와 같은 그림
export const alt = "TailQ";
export { size } from "@/app/_og/draw";
export const contentType = "image/png";

export default function Image() {
  return drawCard(null);
}
