// WCAG 대비 계산. 반투명 유리는 배경 위에 겹친 색으로 바꿔서 잰다.
type RGBA = [number, number, number, number];

function parseColor(c: string): RGBA {
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`색을 읽을 수 없어요: ${c}`);
  const [r, g, b, a = 1] = m[1].split(",").map(Number);
  return [r, g, b, a];
}

// 위 색(over)을 아래 색(under) 위에 겹친 결과
export function over(top: string, under: string): string {
  const [r1, g1, b1, a] = parseColor(top);
  const [r2, g2, b2] = parseColor(under);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r1, r2)},${mix(g1, g2)},${mix(b1, b2)})`;
}

function luminance(c: string) {
  const [r, g, b] = parseColor(c).map((v, i) => {
    if (i === 3) return v;
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
