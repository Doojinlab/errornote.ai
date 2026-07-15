"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Volume2, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { HSK_LEVELS } from "@/lib/hsk";
import type { HskLevel } from "@/types";
import type { HskListeningQuestion, HskListeningGenerateResponse } from "@/types/hsk";

export default function HskListeningClient({ initialLevel }: { initialLevel: HskLevel }) {
  const t = useTranslations("pages.student.hskListening");

  const [level, setLevel] = useState<HskLevel>(initialLevel);
  const [question, setQuestion] = useState<HskListeningQuestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resetAudio = useCallback(() => {
    audioRef.current?.pause();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  useEffect(() => resetAudio, [resetAudio]);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setSelected(null);
    setTtsUnavailable(false);
    resetAudio();
    try {
      const res = await fetch("/api/hsk/listening/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const json = (await res.json()) as HskListeningGenerateResponse | { error?: string };
      if (!res.ok) throw new Error(("error" in json && json.error) || `요청 실패 (${res.status})`);
      setQuestion((json as HskListeningGenerateResponse).question);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsGenerating(false);
    }
  }, [level, resetAudio, t]);

  const play = useCallback(async () => {
    if (!question) return;
    // 이미 합성된 오디오가 있으면 재생만.
    if (audioUrlRef.current && audioRef.current) {
      void audioRef.current.play();
      return;
    }
    setIsSynthesizing(true);
    setError(null);
    try {
      const res = await fetch("/api/hsk/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question.audioScript }),
      });
      if (!res.ok) {
        // 503(tts_unconfigured) → 대본 표시로 폴백.
        let code: string | undefined;
        try {
          code = ((await res.json()) as { code?: string }).code;
        } catch {
          /* ignore */
        }
        if (res.status === 503 || code === "tts_unconfigured") {
          setTtsUnavailable(true);
          return;
        }
        throw new Error(`재생 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      void audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsSynthesizing(false);
    }
  }, [question, t]);

  const revealed = selected !== null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-semibold text-bodytx">{t("levelLabel")}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {HSK_LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              disabled={isGenerating}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                level === lv
                  ? "bg-blue text-white"
                  : "border border-hairline bg-white text-bodytx"
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isGenerating}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-dark disabled:opacity-60"
        >
          <Sparkles size={16} aria-hidden />
          {isGenerating ? t("generating") : question ? t("newQuestion") : t("generate")}
        </button>
        {error && <p className="mt-2 text-xs text-terra">{error}</p>}
      </Card>

      {question && (
        <Card className="space-y-3 p-4">
          <p className="text-sm text-bodytx">{question.instructions}</p>

          <button
            type="button"
            onClick={play}
            disabled={isSynthesizing}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-4 py-2 text-sm font-bold text-blue-dark disabled:opacity-60"
          >
            <Volume2 size={16} aria-hidden />
            {isSynthesizing ? t("synthesizing") : t("play")}
          </button>

          {ttsUnavailable && (
            <div className="rounded-md border border-gold-soft bg-gold-soft px-3 py-2">
              <p className="text-[11px] font-semibold text-gold-dark">{t("ttsUnavailable")}</p>
              <p lang="zh" className="mt-1 whitespace-pre-wrap font-cn text-sm text-ink">
                {question.audioScript}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-ink">{question.question}</p>
            <div className="mt-2 space-y-2">
              {question.options.map((opt) => {
                const isAnswer = opt === question.answer;
                const isPicked = opt === selected;
                let cls = "border-hairline bg-white text-bodytx";
                if (revealed && isAnswer) cls = "border-jade bg-jade-soft text-jade-dark";
                else if (revealed && isPicked) cls = "border-terra bg-terra-soft text-terra-dark";
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !revealed && setSelected(opt)}
                    disabled={revealed}
                    lang="zh"
                    className={`block w-full rounded-lg border px-3 py-2 text-left font-cn text-sm transition-colors ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {revealed && (
            <div className="space-y-2 rounded-md border border-hairline bg-ivory p-3">
              <p className="text-sm font-bold">
                {selected === question.answer ? (
                  <span className="text-jade-dark">{t("correct")}</span>
                ) : (
                  <span className="text-terra-dark">{t("incorrect")}</span>
                )}
              </p>
              <p className="text-xs text-bodytx">
                {t("answerLabel")}:{" "}
                <span lang="zh" className="font-cn font-semibold text-ink">
                  {question.answer}
                </span>
              </p>
              <div>
                <p className="text-[11px] font-semibold text-muted">{t("scriptHeading")}</p>
                <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm text-ink">
                  {question.audioScript}
                </p>
              </div>
              {question.explanation && (
                <div>
                  <p className="text-[11px] font-semibold text-muted">{t("explanationHeading")}</p>
                  <p className="mt-0.5 text-sm text-bodytx">{question.explanation}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
