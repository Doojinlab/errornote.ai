import { Flame, Gem } from "lucide-react";

/** 둥근 알약. flame=연속학습(gold), gem=보석(gem). 값은 800 굵기. 스펙 §4. */
export default function StatChip({
  type,
  value,
}: {
  type: "flame" | "gem";
  value: number | string;
}) {
  const isFlame = type === "flame";
  const Icon = isFlame ? Flame : Gem;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-extrabold ${
        isFlame ? "bg-gold-soft text-gold-dark" : "bg-gem-soft text-gem-dark"
      }`}
    >
      <Icon size={15} aria-hidden />
      {value}
    </span>
  );
}
