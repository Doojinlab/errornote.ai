import { getTranslations } from "next-intl/server";
import LoginForm from "./LoginForm";

interface Props {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  const [t, tMeta] = await Promise.all([
    getTranslations("auth.login"),
    getTranslations("meta"),
  ]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {tMeta("appName")} · {t("title")}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{tMeta("tagline")}</p>
        </div>
        <LoginForm redirectTo={searchParams.redirect} />
      </div>
    </main>
  );
}
