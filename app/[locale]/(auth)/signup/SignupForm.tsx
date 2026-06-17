"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { signup, type SignupState } from "./actions";
import { createBrowserClient } from "@/lib/supabase-browser";
import { Link } from "@/i18n/routing";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const initial: SignupState = { error: null };

type Role = "student" | "professor";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("auth.signup");
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? t("loading") : t("submit")}
    </Button>
  );
}

export default function SignupForm() {
  const t = useTranslations("auth.signup");
  const [state, formAction] = useFormState(signup, initial);
  const [role, setRole] = useState<Role>("student");
  const [agreed, setAgreed] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          {t("name")}
        </label>
        <Input id="name" name="name" required />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          {t("email")}
        </label>
        <Input id="email" type="email" name="email" required autoComplete="email" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          {t("password")}
        </label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">{t("role")}</legend>
        <div className="flex gap-2">
          {(["student", "professor"] as const).map((r) => (
            <label
              key={r}
              className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${
                role === r
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "student" ? t("roleStudent") : t("roleProfessor")}
            </label>
          ))}
        </div>
      </fieldset>

      {role === "student" && (
        <div>
          <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-slate-700">
            {/* 학번(선택) — messages 키 누락 시 한국어 fallback */}
            학번 (선택)
          </label>
          <Input id="student_id" name="student_id" />
        </div>
      )}

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          name="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
        />
        <span>
          {t.rich("agree", {
            terms: (chunks) => (
              <Link
                href="/terms"
                target="_blank"
                className="text-indigo-600 underline hover:text-indigo-700"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                target="_blank"
                className="text-indigo-600 underline hover:text-indigo-700"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton disabled={!agreed} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs text-slate-400">
          <span className="bg-white px-2">또는</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() =>
          createBrowserClient().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/api/auth/callback` },
          })
        }
      >
        Google
      </Button>
    </form>
  );
}
