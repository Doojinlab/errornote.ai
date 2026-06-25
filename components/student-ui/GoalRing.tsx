/** SVG 원형 progress. stroke=jade, 가운데 "current /total". 스펙 §4. */
export default function GoalRing({
  current,
  total,
  size = 96,
}: {
  current: number;
  total: number;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke - 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`목표 ${current} / ${total}`}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--color-jade)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </g>
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-ink text-sm font-extrabold"
      >
        {current} /{total}
      </text>
    </svg>
  );
}
