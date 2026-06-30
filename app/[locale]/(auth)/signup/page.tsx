import { redirect } from "next/navigation";

// Google OAuth 전용으로 전환하면서 가입과 로그인이 동일한 흐름이 되었으므로
// 별도 가입 페이지를 두지 않고 /login 으로 통합한다. (랜딩의 /signup 링크 유지용)
export default function SignupPage() {
  redirect("/login");
}
