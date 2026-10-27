// 디자인 토큰(docs/07 "디자인 토큰", 값은 Figma C안 파일). CSS 변수는 이 값에서 만든다.
export type ThemeName = "dark" | "light";

export const TOKENS = {
  dark: {
    bg: "#07100E",
    text: "#ECF3F0",
    sub: "#BCCBC5",
    muted: "#9DB0A9",
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
    // 기본 배경: 화면 전체에 깔리는 은은한 선형 그라디언트 두 겹(왼쪽 위·오른쪽 아래)
    wash1: "rgba(52,199,154,0.16)",
    wash2: "rgba(32,120,140,0.22)",
    halo: "rgba(52,199,154,0.55)",
    "tab-active": "rgba(255,255,255,0.12)",
    // 누를 수 있는 행·메뉴·유리 버튼의 hover 면(선택 캡슐 tab-active보다 옅게)
    hover: "rgba(255,255,255,0.06)",
    ph: "rgba(236,243,240,0.42)",
    scroll: "rgba(124,242,205,0.35)",
    "dot-off": "rgba(255,255,255,0.18)",
    // 점수 구간: 높음 초록, 중간 앰버, 낮음 산호(scoreColor 70/40)
    good: "#34C79A",
    mid: "#F0C27A",
    low: "#FF8A7A",
    danger: "#FF8A7A",
    well: "rgba(0,0,0,0.22)",
    scrim: "rgba(3,8,7,0.55)",
    // 학습 잔디 5단계(docs/07 "학습 잔디")
    "grass-0": "rgba(255,255,255,0.06)",
    "grass-1": "rgba(52,199,154,0.30)",
    "grass-2": "rgba(52,199,154,0.55)",
    "grass-3": "#34C79A",
    "grass-4": "#7CF2CD",
    // 홈 오늘 카드 바탕의 옅은 빛(왼쪽 위 강조색 · 오른쪽 아래 민트, #115 개편안)
    hero1: "rgba(52,199,154,0.30)",
    hero2: "rgba(124,242,205,0.10)",
  },
  light: {
    bg: "#EAF1EE",
    text: "#0F1A17",
    sub: "#3B4944",
    muted: "#505F59",
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
    wash1: "rgba(52,199,154,0.30)",
    wash2: "rgba(70,160,200,0.26)",
    halo: "rgba(52,199,154,0.50)",
    "tab-active": "rgba(255,255,255,0.88)",
    hover: "rgba(15,26,23,0.05)",
    ph: "rgba(15,26,23,0.40)",
    scroll: "rgba(11,122,98,0.32)",
    "dot-off": "rgba(15,26,23,0.14)",
    good: "#0B7A62",
    mid: "#965A00",
    low: "#B3261E",
    danger: "#B3261E",
    well: "rgba(15,26,23,0.05)",
    scrim: "rgba(15,26,23,0.32)",
    "grass-0": "rgba(15,26,23,0.07)",
    "grass-1": "rgba(18,162,127,0.30)",
    "grass-2": "rgba(18,162,127,0.55)",
    "grass-3": "#12A27F",
    "grass-4": "#0E7C66",
    hero1: "rgba(52,199,154,0.34)",
    hero2: "rgba(124,242,205,0.30)",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

// 운영 화면(/admin, data-admin이 있는 화면)만 남색으로 덮어쓴다(#104). 사용자 화면은 위 민트 그대로.
// 남색 배경·유리에 페리윙클 강조. 점수는 페리윙클(높음)·앰버(중간)·산호(낮음)
export const ADMIN_TOKENS = {
  dark: {
    bg: "#070A16",
    text: "#EBEFFA",
    sub: "#C0C7DC",
    muted: "#A2AAC4",
    accent: "#9DB4FF",
    "accent-fill": "#7C96FF",
    "on-accent": "#050A1C",
    ring: "#7C96FF",
    sheet: "rgba(16,22,44,0.66)",
    blob1: "rgba(76,111,255,0.32)",
    blob2: "rgba(124,92,255,0.26)",
    blob3: "rgba(157,180,255,0.14)",
    wash1: "rgba(76,111,255,0.18)",
    wash2: "rgba(124,92,255,0.18)",
    halo: "rgba(124,150,255,0.55)",
    "tab-active": "rgba(157,180,255,0.14)",
    scroll: "rgba(157,180,255,0.35)",
    good: "#8FA8FF",
    mid: "#F5C27A",
    low: "#FF8F87",
    scrim: "rgba(4,6,16,0.55)",
  },
  light: {
    bg: "#EEF1FA",
    text: "#0E1530",
    sub: "#363F5C",
    muted: "#4A5474",
    accent: "#2E45B8",
    "accent-fill": "#3D5AFE",
    "on-accent": "#FFFFFF",
    ring: "#3D5AFE",
    "glass-edge": "rgba(14,21,48,0.08)",
    "glass-shadow": "rgba(24,36,90,0.20)",
    track: "rgba(14,21,48,0.08)",
    blob1: "rgba(61,90,254,0.30)",
    blob2: "rgba(139,120,255,0.28)",
    blob3: "rgba(120,160,255,0.30)",
    wash1: "rgba(61,90,254,0.20)",
    wash2: "rgba(139,120,255,0.22)",
    halo: "rgba(61,90,254,0.40)",
    scroll: "rgba(46,69,184,0.32)",
    good: "#2E45B8",
    mid: "#965A00",
    low: "#B3261E",
    scrim: "rgba(14,21,48,0.32)",
  },
} as const satisfies Record<ThemeName, Partial<Record<string, string>>>;

const vars = (t: Record<string, string>) =>
  Object.entries(t)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

// 기본은 다크. 저장한 선택이 없으면 기기 설정을 따른다(script가 data-theme을 정한다).
// 운영 화면은 :has([data-admin])로 같은 자리에서 덮어써 배경 빛·사이드 메뉴까지 남색이 된다.
// 처음엔 [data-admin]이 있기만 하면 덮었는데, 다른 화면으로 가도 운영 화면이 숨겨진 채(display: none) 문서에 남아
// 남색이 그대로였다(cacheComponents). 숨겨진 운영 화면은 빼고 센다
const ADMIN_SHOWN =
  ':has([data-admin]:not([style*="display: none"],[style*="display: none"] *))';
export const themeCss =
  `:root,[data-theme="dark"]{${vars(TOKENS.dark)}color-scheme:dark}` +
  `[data-theme="light"]{${vars(TOKENS.light)}color-scheme:light}` +
  `:root:not([data-theme="light"])${ADMIN_SHOWN}{${vars(ADMIN_TOKENS.dark)}}` +
  `[data-theme="light"]${ADMIN_SHOWN}{${vars(ADMIN_TOKENS.light)}}`;

export const THEME_STORAGE_KEY = "tailq-theme";

// 배경 모양. 기본은 은은한 그라디언트(soft, 저장하지 않는다), "glow"면 예전 빛 덩어리 배경
export type BackdropName = "soft" | "glow";
export const BACKDROP_STORAGE_KEY = "tailq-bg";

// 첫 그림 전에 테마를 정해 깜박임을 막는다. 저장값(light·dark)이 없으면 기기 설정을 따르고,
// 기기 설정이 바뀌면 같이 바꾼다.
// 저장소를 못 읽어도(사생활 보호 모드 등) 기기 설정은 따른다.
// 배경도 같이 정한다: 저장값이 glow면 data-bg="glow"(빛 덩어리), 아니면 기본 그라디언트.
export const themeScript = `(()=>{var d=document.documentElement,k="${THEME_STORAGE_KEY}",q=window.matchMedia?matchMedia("(prefers-color-scheme: light)"):null,s=function(){try{return localStorage.getItem(k)}catch(e){return null}},f=function(){var v=s();d.dataset.theme=v==="light"||v==="dark"?v:q&&q.matches?"light":"dark"};f();try{if(localStorage.getItem("${BACKDROP_STORAGE_KEY}")==="glow")d.dataset.bg="glow"}catch(e){}if(q&&q.addEventListener)q.addEventListener("change",function(){if(!s())f()})})()`;
