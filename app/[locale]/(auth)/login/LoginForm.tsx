"use client";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase-browser";
import Button from "@/components/ui/Button";

interface Props {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo }: Props) {
  const t = useTranslations("auth.login");

  const signInWithGoogle = () => {
    // redirect 파라미터(보호 경로 진입 시 미들웨어가 부여)를 콜백의 next 로 전달해
    // 로그인 후 원래 가려던 경로로 복귀시킨다. 콜백에서 same-origin 검증함.
    const callback = new URL("/api/auth/callback", window.location.origin);
    if (redirectTo) callback.searchParams.set("next", redirectTo);
    return createBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  };

  return (
    <Button type="button" className="w-full" onClick={signInWithGoogle}>
      {t("google")}
    </Button>
  );
}
