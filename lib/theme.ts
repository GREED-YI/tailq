// 디자인 토큰(DESIGN.md "Semantic tokens"). CSS 변수는 이 값에서 만든다.
// 라이트·다크는 같은 이름을 쓰고 값만 바꾼다. 컴포넌트에는 색 값을 직접 쓰지 않는다
export type ThemeName = "dark" | "light";

export const TOKENS = {
  dark: {
    canvas: "#0E0F0E",
    surface: "#171918",
    text: "#EDEEEC",
    "text-sub": "#A4A9A5",
    "text-muted": "#8A8F8B",
    line: "#262927",
    "line-strong": "#3A3E3B",
    primary: "#FF5A1F",
    "on-primary": "#0E0F0E",
    accent: "#FF7A45",
    "accent-soft": "#2A1810",
    danger: "#FF6B86",
    "danger-fill": "#B0123B",
    "on-danger": "#FFFFFF",
    "mark-empty": "#6A6E6A",
    // 대화상자·바텀시트 뒤 가림막
    scrim: "rgba(0,0,0,0.6)",
  },
  light: {
    canvas: "#F3F4F2",
    surface: "#FFFFFF",
    text: "#111312",
    "text-sub": "#5B605D",
    "text-muted": "#6A6F6B",
    line: "#DCDEDB",
    "line-strong": "#C5C8C5",
    primary: "#FF4F12",
    "on-primary": "#111312",
    accent: "#B83505",
    "accent-soft": "#FFEDE4",
    danger: "#B0123B",
    "danger-fill": "#B0123B",
    "on-danger": "#FFFFFF",
    "mark-empty": "#868A87",
    scrim: "rgba(17,19,18,0.4)",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

// 운영 화면(/admin, data-admin이 있는 화면)은 같은 토큰 구조를 쓰고(DESIGN.md), 강조색만 남색으로 바꿔
// 운영 화면임을 알린다(헤더에는 "운영" 표시, components/AppNav.tsx). 처음엔 배경·유리·점수까지 남색이었다(#104)
export const ADMIN_TOKENS = {
  dark: { accent: "#8FA8FF", "accent-soft": "#151B33" },
  light: { accent: "#2E45B8", "accent-soft": "#E6EBFF" },
} as const satisfies Record<ThemeName, Partial<Record<string, string>>>;

// 예전 이름(C안 글라스 디자인). 화면을 새 이름으로 옮기는 동안만 남기고, 다 옮기면 지운다.
// 글라스·빛 덩어리·그라디언트 색은 투명이 되어 장식이 사라진다
export const LEGACY_ALIASES: Record<string, string> = {
  bg: "var(--canvas)",
  sub: "var(--text-sub)",
  muted: "var(--text-muted)",
  "accent-fill": "var(--primary)",
  "on-accent": "var(--on-primary)",
  ring: "var(--accent)",
  glass: "var(--surface)",
  "glass-hi": "transparent",
  "glass-edge": "var(--line)",
  "glass-shadow": "transparent",
  sheet: "var(--surface)",
  track: "var(--line)",
  ghost: "var(--line)",
  "ghost-text": "var(--text-muted)",
  blob1: "transparent",
  blob2: "transparent",
  blob3: "transparent",
  wash1: "transparent",
  wash2: "transparent",
  halo: "transparent",
  hero1: "transparent",
  hero2: "transparent",
  "tab-active": "var(--surface)",
  hover: "var(--surface)",
  ph: "var(--text-muted)",
  scroll: "var(--line-strong)",
  "dot-off": "var(--mark-empty)",
  // 점수 구간: 높음 text, 중간 text-sub, 낮음 danger(DESIGN.md Foundation rules)
  good: "var(--text)",
  mid: "var(--text-sub)",
  low: "var(--danger)",
  well: "var(--canvas)",
  "grass-0": "var(--line)",
  "grass-1": "color-mix(in srgb, var(--accent) 35%, transparent)",
  "grass-2": "color-mix(in srgb, var(--accent) 60%, transparent)",
  "grass-3": "color-mix(in srgb, var(--accent) 80%, transparent)",
  "grass-4": "var(--accent)",
};

const vars = (t: Record<string, string>) =>
  Object.entries(t)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

// 기본은 다크. 저장한 선택이 없으면 기기 설정을 따른다(script가 data-theme을 정한다).
// 운영 화면은 :has([data-admin])로 같은 자리에서 덮어쓴다.
// 처음엔 [data-admin]이 있기만 하면 덮었는데, 다른 화면으로 가도 운영 화면이 숨겨진 채(display: none) 문서에 남아
// 운영 색이 그대로였다(cacheComponents). 숨겨진 운영 화면은 빼고 센다
// 별칭은 모두 html 한 곳에 걸려 테마·운영 덮어쓰기를 그대로 따라간다
const ADMIN_SHOWN =
  ':has([data-admin]:not([style*="display: none"],[style*="display: none"] *))';
export const themeCss =
  `:root,[data-theme="dark"]{${vars(TOKENS.dark)}color-scheme:dark}` +
  `[data-theme="light"]{${vars(TOKENS.light)}color-scheme:light}` +
  `:root:not([data-theme="light"])${ADMIN_SHOWN}{${vars(ADMIN_TOKENS.dark)}}` +
  `[data-theme="light"]${ADMIN_SHOWN}{${vars(ADMIN_TOKENS.light)}}` +
  `:root{${vars(LEGACY_ALIASES)}}`;

export const THEME_STORAGE_KEY = "tailq-theme";

// 첫 그림 전에 테마를 정해 깜박임을 막는다. 저장값(light·dark)이 없으면 기기 설정을 따르고,
// 기기 설정이 바뀌면 같이 바꾼다.
// 저장소를 못 읽어도(사생활 보호 모드 등) 기기 설정은 따른다.
export const themeScript = `(()=>{var d=document.documentElement,k="${THEME_STORAGE_KEY}",q=window.matchMedia?matchMedia("(prefers-color-scheme: light)"):null,s=function(){try{return localStorage.getItem(k)}catch(e){return null}},f=function(){var v=s();d.dataset.theme=v==="light"||v==="dark"?v:q&&q.matches?"light":"dark"};f();if(q&&q.addEventListener)q.addEventListener("change",function(){if(!s())f()})})()`;
