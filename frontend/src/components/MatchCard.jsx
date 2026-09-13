import { useState } from "react";
import ConfidenceMeter from "./ConfidenceMeter.jsx";
import PathGraph from "./PathGraph.jsx";
import { RiskFlagChips, TypologyChips } from "./Chips.jsx";
import { mixerHitsOnPath } from "../utils.js";

export default function MatchCard({ index, match, mixerHits }) {
  const [open, setOpen] = useState(index === 0); // first match open by default
  const pathMixers = mixerHitsOnPath(match.path || [], mixerHits);
  const hasMixer = pathMixers.length > 0;

  return (
    <div className={`overflow-hidden rounded-xl border transition-all duration-200 ${
      open ? "border-cyan-500/40 bg-raised shadow-lg shadow-cyan-950/20" : "border-line bg-panel hover:border-slate-600 hover:bg-raised/70"
    }`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 font-mono text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/30">
            #{index + 1}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-white">
                {match.matched_service}
              </span>
              <span className="rounded bg-cyan-950/60 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30">
                {match.entity_type}
              </span>
              {hasMixer && (
                <span className="flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                  <span>⚠️ MIXER TOUCHED</span>
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{match.hop_count} hop(s)</span>
              <span>•</span>
              <span className="uppercase text-slate-300">Chain: {match.source_chain}</span>
              <span>•</span>
              <span className="font-semibold text-slate-200">
                Confidence: {match.confidence_score}/100
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-line bg-ink text-sm font-bold text-slate-300 transition-transform duration-200 ${
            open ? "rotate-90 text-cyan-400 border-cyan-500/40" : ""
          }`}>
            ›
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-line/80 bg-ink/40 px-5 py-5">
          {/* Top Row: Meta info and Confidence Meter */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="rounded-md border border-line bg-panel px-3 py-2">
                <span className="text-muted block text-[10px] uppercase font-bold">Source Chain</span>
                <span className="font-semibold text-white uppercase">{match.source_chain}</span>
              </div>
              <div className="rounded-md border border-line bg-panel px-3 py-2">
                <span className="text-muted block text-[10px] uppercase font-bold">Hop Distance</span>
                <span className="font-semibold text-white">{match.hop_count} hop(s)</span>
              </div>
              <div className="rounded-md border border-line bg-panel px-3 py-2">
                <span className="text-muted block text-[10px] uppercase font-bold">Entity Type</span>
                <span className="font-semibold text-cyan-300">{match.entity_type}</span>
              </div>
            </div>

            <ConfidenceMeter score={match.confidence_score} />
          </div>

          {/* Per-Path Mixer Warning */}
          {hasMixer && (
            <div className="space-y-2">
              {pathMixers.map(function (hit, i) {
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border-2 border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200"
                  >
                    <span className="text-base">⚠️</span>
                    <div>
                      <div className="font-bold text-rose-100">
                        Mixer Exposure Detected on this Exact Path:
                      </div>
                      <div className="mt-0.5 text-rose-200/90">
                        Funds routed through mixer <strong>{hit.label}</strong> at hop <strong>{hit.hop}</strong> (
                        <span className="font-mono text-[11px] text-rose-300">{hit.address}</span>)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Typologies */}
          <TypologyChips typologies={match.typologies} />

          {/* Alert Message */}
          {match.alert && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-200">
              <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                ALERT [{match.alert.level}]
              </span>
              <span className="font-medium text-amber-100">{match.alert.message}</span>
            </div>
          )}

          {/* Visual Path Flow Graph */}
          <PathGraph
            path={match.path}
            mixerHits={pathMixers}
            matchedService={match.matched_service}
          />

          {/* Risk Flags */}
          <RiskFlagChips flags={match.risk_flags} />
        </div>
      )}
    </div>
  );
}
