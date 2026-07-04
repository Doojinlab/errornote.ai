// 작문·분석 화면(몰입형) 전용 팔레트.
// 랜딩 데모(Demo3Pane, landing.css)의 "따뜻한 종이 + 절제된 중국 홍색" 디자인 토큰을
// 그대로 옮겨와 실제 서비스 화면이 대문 예시와 같은 결을 갖도록 한다.
// (landing.css 토큰은 .landing-root 에 스코프돼 있어 여기선 값을 직접 상수로 쓴다.)
export const W = {
  paper: "#FCFAF7",
  paper2: "#F5F1E8",
  paper3: "#ECE6D6",
  ink: "#1A1614",
  ink2: "#3A3431",
  inkMute: "#6B6056",
  inkFaint: "#A9A096",
  line: "#E8E2D6",
  lineStrong: "#D9D1BE",
  red: "#D7263D",
  redDeep: "#A81C2E",
  redSoft: "#FBE9EC",
  green: "#2E7D5A",
  greenSoft: "#E7F1EC",
  gold: "#C49A2C",
  goldSoft: "#FCF4DD",
} as const;
