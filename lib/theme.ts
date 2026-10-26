// 디자인 토큰(docs/07 "디자인 토큰", 값은 Figma C안 파일). CSS 변수는 이 값에서 만든다.
export type ThemeName = "dark" | "light";

export const TOKENS = {
  dark: {
    bg: "#07100E",
    text: "#ECF3F0",
    sub: "#A3B5AE",
    accent: "#7CF2CD",
    "accent-fill": "#34C79A",
    "on-accent": "#04140F",
    ring: "#34C79A",
    glass: "rgba(255,255,255,0.06)",
    "glass-hi": "rgba(255,255,255,0.16)",
    "glass-edge": "rgba(255,255,255,0.08)",
    "glass-shadow": "rgba(0,0,0,0.6)",
    sheet: "rgba(18,30,27,0.62)",
    track: "rgba(255,255,255,0.10)",
    ghost: "rgba(255,255,255,0.10)",
    "ghost-text": "rgba(236,243,240,0.4)",
    blob1: "rgba(52,199,154,0.30)",
    blob2: "rgba(32,120,140,0.32)",
    blob3: "rgba(124,242,205,0.16)",
    halo: "rgba(52,199,154,0.55)",
    "tab-active": "rgba(255,255,255,0.12)",
    ph: "rgba(236,243,240,0.42)",
    scroll: "rgba(124,242,205,0.35)",
    "dot-off": "rgba(255,255,255,0.18)",
    good: "#34C79A",
    mid: "#7CF2CD",
    low: "#F0C27A",
    danger: "#FF8A7A",
    well: "rgba(0,0,0,0.22)",
    scrim: "rgba(3,8,7,0.55)",
  },
  light: {
    bg: "#EAF1EE",
    text: "#0F1A17",
    sub: "#4B5A55",
    accent: "#0A6E58",
    "accent-fill": "#34C79A",
    "on-accent": "#04140F",
    ring: "#12A27F",
    glass: "rgba(255,255,255,0.52)",
    "glass-hi": "rgba(255,255,255,0.95)",
    "glass-edge": "rgba(15,40,33,0.07)",
    "glass-shadow": "rgba(20,70,58,0.22)",
    sheet: "rgba(255,255,255,0.72)",
    track: "rgba(15,26,23,0.08)",
    ghost: "rgba(15,26,23,0.07)",
    "ghost-text": "rgba(15,26,23,0.35)",
    blob1: "rgba(52,199,154,0.42)",
    blob2: "rgba(70,160,200,0.34)",
    blob3: "rgba(124,242,205,0.40)",
    halo: "rgba(52,199,154,0.50)",
    "tab-active": "rgba(255,255,255,0.88)",
    ph: "rgba(15,26,23,0.40)",
    scroll: "rgba(11,122,98,0.32)",
    "dot-off": "rgba(15,26,23,0.14)",
    good: "#0B7A62",
    mid: "#0E8F74",
    low: "#9A5A0B",
    danger: "#B3261E",
    well: "rgba(15,26,23,0.05)",
    scrim: "rgba(15,26,23,0.32)",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

const vars = (t: Record<string, string>) =>
  Object.entries(t)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

// 기본은 다크. 저장한 선택이 없으면 기기 설정을 따른다(script가 data-theme을 정한다).
export const themeCss =
  `:root,[data-theme="dark"]{${vars(TOKENS.dark)}color-scheme:dark}` +
  `[data-theme="light"]{${vars(TOKENS.light)}color-scheme:light}`;

export const THEME_STORAGE_KEY = "tailq-theme";

// 첫 그림 전에 테마를 정해 깜박임을 막는다. 저장값(light·dark)이 없으면 기기 설정을 따르고,
// 기기 설정이 바뀌면 같이 바꾼다.
export const themeScript = `(()=>{var d=document.documentElement,k="${THEME_STORAGE_KEY}";try{var q=matchMedia("(prefers-color-scheme: light)"),s=function(){return localStorage.getItem(k)},f=function(){var v=s();d.dataset.theme=v==="light"||v==="dark"?v:q.matches?"light":"dark"};f();q.addEventListener("change",function(){if(!s())f()})}catch(e){d.dataset.theme="dark"}})()`;
