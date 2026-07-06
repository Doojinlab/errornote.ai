"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MistakeEntry, PublicMistake } from "@/lib/mistake-feed";

interface Props {
  initialMine: MistakeEntry[];
  initialPublic: PublicMistake[];
}

type Tab = "submit" | "mine" | "public";

export default function MistakeFeedClient({ initialMine, initialPublic }: Props) {
  const t = useTranslations("pages.student.mistakeFeed");
  const [tab, setTab] = useState<Tab>("submit");
  const [mine, setMine] = useState<MistakeEntry[]>(initialMine);
  const [publicFeed] = useState<PublicMistake[]>(initialPublic);

  const [originalKo, setOriginalKo] = useState("");
  const [literalZh, setLiteralZh] = useState("");
  const [correctedZh, setCorrectedZh] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!originalKo.trim() || !literalZh.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mistake-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalKo, literalZh, correctedZh, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("submitFailed"));
        return;
      }
      const entry: MistakeEntry = {
        id: data.id,
        originalKo: originalKo.trim(),
        literalZh: literalZh.trim(),
        correctedZh: correctedZh.trim(),
        isPublic,
        likes: 0,
        createdAt: new Date().toISOString(),
      };
      setMine((prev) => [entry, ...prev]);
      setOriginalKo("");
      setLiteralZh("");
      setCorrectedZh("");
      setIsPublic(false);
      setTab("mine");
    } catch {
      setError(t("submitFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePublic(entry: MistakeEntry) {
    setTogglingId(entry.id);
    const next = !entry.isPublic;
    setMine((prev) => prev.map((m) => (m.id === entry.id ? { ...m, isPublic: next } : m)));
    try {
      const res = await fetch(`/api/mistake-feed/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // 롤백
      setMine((prev) => prev.map((m) => (m.id === entry.id ? { ...m, isPublic: !next } : m)));
    } finally {
      setTogglingId(null);
    }
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-xl2 px-3 py-1.5 text-sm font-medium transition-colors ${
        tab === key ? "bg-blue text-white" : "bg-white text-bodytx hover:bg-ivory"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tabBtn("submit", t("tabSubmit"))}
        {tabBtn("mine", t("tabMine"))}
        {tabBtn("public", t("tabPublic"))}
      </div>

      {tab === "submit" && (
        <form onSubmit={submit} className="space-y-3 card-pop rounded-xl2 border border-hairline bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-bodytx">{t("labelOriginalKo")}</label>
            <input
              value={originalKo}
              onChange={(e) => setOriginalKo(e.target.value)}
              placeholder={t("placeholderOriginalKo")}
              className="w-full rounded-xl2 border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bodytx">{t("labelLiteralZh")}</label>
            <input
              value={literalZh}
              onChange={(e) => setLiteralZh(e.target.value)}
              placeholder={t("placeholderLiteralZh")}
              className="w-full rounded-xl2 border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bodytx">{t("labelCorrectedZh")}</label>
            <input
              value={correctedZh}
              onChange={(e) => setCorrectedZh(e.target.value)}
              placeholder={t("placeholderCorrectedZh")}
              className="w-full rounded-xl2 border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-bodytx">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t("publicConsent")}</span>
          </label>
          {error && <p className="text-sm text-terra">{error}</p>}
          <button
            type="submit"
            disabled={busy || !originalKo.trim() || !literalZh.trim()}
            className="rounded-xl2 bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-50"
          >
            {busy ? t("submitting") : t("submit")}
          </button>
        </form>
      )}

      {tab === "mine" &&
        (mine.length === 0 ? (
          <p className="rounded-xl2 bg-white p-6 text-center text-sm text-muted shadow-sm">{t("emptyMine")}</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((m) => (
              <li key={m.id} className="card-pop rounded-xl2 border border-hairline bg-white p-4 shadow-sm">
                <p className="text-sm text-muted">🇰🇷 {m.originalKo}</p>
                <p className="mt-1 text-base text-ink font-cn" lang="zh">😅 {m.literalZh}</p>
                {m.correctedZh && <p className="mt-1 text-sm text-jade-dark font-cn" lang="zh">✅ {m.correctedZh}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {m.isPublic ? t("statusPublic") : t("statusPrivate")}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePublic(m)}
                    disabled={togglingId === m.id}
                    className="rounded-md border border-hairline px-2.5 py-1 text-xs text-bodytx hover:bg-ivory disabled:opacity-50"
                  >
                    {m.isPublic ? t("makePrivate") : t("makePublic")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === "public" &&
        (publicFeed.length === 0 ? (
          <p className="rounded-xl2 bg-white p-6 text-center text-sm text-muted shadow-sm">{t("emptyPublic")}</p>
        ) : (
          <ul className="space-y-3">
            {publicFeed.map((m) => (
              <li
                key={m.id}
                className={`card-pop rounded-xl2 border border-hairline bg-white p-4 shadow-sm ${m.isMe ? "ring-1 ring-blue" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    {m.nickname}
                    {m.isMe && ` · ${t("me")}`}
                  </span>
                  {m.likes > 0 && <span className="text-xs text-terra">❤ {m.likes}</span>}
                </div>
                <p className="text-sm text-muted">🇰🇷 {m.originalKo}</p>
                <p className="mt-1 text-base text-ink font-cn" lang="zh">😅 {m.literalZh}</p>
                {m.correctedZh && <p className="mt-1 text-sm text-jade-dark font-cn" lang="zh">✅ {m.correctedZh}</p>}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
