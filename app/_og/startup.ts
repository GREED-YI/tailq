// 아이폰 홈 화면 앱의 시작 화면(apple-touch-startup-image). 아이폰은 기기 화면과 크기가 똑같은 그림만 쓰므로 해상도마다 링크를 둔다.
// 세로 방향만. iOS 27이 지원하는 아이폰(11 이후, SE 2·3세대)의 화면 크기(pt)와 배율이다(Apple HIG·기기 사양 기준)
const SCREENS: [width: number, height: number, ratio: number][] = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max, 18 Pro Max
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
  [420, 912, 3], // Air
  [414, 896, 3], // 11 Pro Max
  [414, 896, 2], // 11
  [402, 874, 3], // 16 Pro, 17, 17 Pro, 18 Pro
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [390, 844, 3], // 12, 12 Pro, 13, 13 Pro, 14, 16e, 17e
  [375, 812, 3], // 11 Pro, 12 mini, 13 mini
  [375, 667, 2], // SE 2·3세대
];

// 그림 주소의 이름(픽셀 폭x높이.png). .png로 끝나 proxy(로그인 확인)를 거치지 않는다
export const STARTUP = SCREENS.map(([w, h, r]) => ({
  name: `${w * r}x${h * r}.png`,
  url: `/startup/${w * r}x${h * r}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));
