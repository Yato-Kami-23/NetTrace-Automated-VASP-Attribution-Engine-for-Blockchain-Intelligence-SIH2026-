export default function ConfidenceMeter({ score }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const size = 76;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;

  let color = "#ef4444"; // danger
  let glowColor = "rgba(239, 68, 68, 0.35)";
  let tierLabel = "LOW / UNCERTAIN";
  let tierBadge = "border-red-500/30 bg-red-500/10 text-red-400";

  if (value >= 70) {
    color = "#10b981"; // green
    glowColor = "rgba(16, 185, 129, 0.35)";
    tierLabel = "HIGH CONFIDENCE";
    tierBadge = "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  } else if (value >= 40) {
    color = "#f59e0b"; // amber
    glowColor = "rgba(245, 158, 11, 0.35)";
    tierLabel = "MODERATE ATTRIBUTION";
    tierBadge = "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }

  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-line bg-ink/70 px-3.5 py-2.5 shadow-sm">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1b2536"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="font-mono text-sm font-bold leading-none text-text-bright">
            {value}
          </span>
          <span className="text-[9px] font-medium tracking-tighter text-muted">/100</span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Attribution Score
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide border " +
              tierBadge
            }
          >
            {tierLabel}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${value}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
