"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DailyQuestMission } from "@/types/daily-quests";

interface Props {
  initialMissions: DailyQuestMission[];
}

export default function QuestBoard({ initialMissions }: Props) {
  const t = useTranslations("pages.student.quests");
  const [missions, setMissions] = useState<DailyQuestMission[]>(initialMissions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [coinFlash, setCoinFlash] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allDone = missions.length > 0 && missions.every((m) => m.done);

  async function complete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: id }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as {
        missions: DailyQuestMission[];
        awardedCoins: number;
      };
      setMissions(data.missions);
      if (data.awardedCoins > 0) {
        setCoinFlash(data.awardedCoins);
        window.setTimeout(() => setCoinFlash(null), 2500);
      }
    } catch {
      setError(t("failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {allDone && (
        <p className="rounded-lg bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
          {t("allDone")}
        </p>
      )}
      {coinFlash != null && (
        <p
          className="text-center text-sm font-semibold text-amber-600"
          role="status"
        >
          {t("coinsEarned", { coins: coinFlash })}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-3">
        {missions.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${m.done ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">{m.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{m.instruction}</p>
                {m.source_label && (
                  <p className="mt-2 inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                    {t("fromYesterday", { label: m.source_label })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => complete(m.id)}
                disabled={m.done || busyId === m.id}
                className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {m.done ? t("done") : t("complete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
