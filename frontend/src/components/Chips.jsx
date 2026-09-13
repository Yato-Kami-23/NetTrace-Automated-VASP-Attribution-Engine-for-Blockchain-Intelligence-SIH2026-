import { useState } from "react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy address"
      className="ml-1.5 inline-flex items-center rounded bg-black/30 px-1.5 py-0.5 text-[9px] text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function RiskFlagChips({ flags }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Risk Flags Detected ({flags.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {flags.map(function (flag, i) {
          return (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-200"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-bold uppercase tracking-wider text-[10px] text-rose-300">
                  {flag.reason}
                </span>
                <span className="font-semibold text-white">{flag.label}</span>
                <span className="font-mono text-[11px] text-rose-300/80 break-all">
                  {flag.address}
                </span>
              </div>
              <CopyButton text={flag.address} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TypologyChips({ typologies }) {
  if (!typologies || typologies.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>Suspected Typologies ({typologies.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {typologies.map(function (t, i) {
          return (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"
            >
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {t.type}
              </span>
              <span className="text-[12px] leading-snug text-amber-100">
                {t.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
