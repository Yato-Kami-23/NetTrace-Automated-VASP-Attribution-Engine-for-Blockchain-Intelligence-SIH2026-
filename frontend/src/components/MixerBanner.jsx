import { useState } from "react";

const MIXER_EXPLAIN =
  "A mixer (tumbler) is a service designed to break the traceable link between a sender and a receiver. It pools funds from many different users together and pays back out from that shared pool, so it is no longer possible to prove which incoming deposit corresponds to which outgoing withdrawal. Its presence on a trace is a critical red flag commonly associated with deliberate attempts to obscure illicit fund flows.";

export default function MixerBanner({ mixerHits }) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const hits = mixerHits || [];

  if (hits.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-4 py-3.5 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-emerald-300">
            No mixer/tumbler detected anywhere in this search
          </div>
          <p className="text-xs text-emerald-400/80">
            All traced transaction trails connect directly through transparent addresses without pooling obscuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border-2 border-rose-500/60 bg-rose-950/25 shadow-lg shadow-rose-950/40">
      <div className="flex items-start justify-between gap-4 border-b border-rose-500/30 bg-rose-900/30 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600/30 text-rose-400 ring-1 ring-rose-500/50">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-rose-200">
                Mixer / Tumbler Detected
              </span>
              <span className="rounded-full bg-rose-500/30 px-2.5 py-0.5 text-xs font-extrabold text-rose-300 ring-1 ring-rose-400/40">
                {hits.length} FOUND
              </span>
            </div>
            <p className="text-xs text-rose-300/80">
              High-risk laundering technique identified on one or more transaction branches.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="rounded border border-rose-500/30 bg-rose-950/60 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/50"
        >
          {detailsOpen ? "Hide Details ▴" : "Show Details ▾"}
        </button>
      </div>

      {detailsOpen && (
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-md border border-rose-500/20 bg-black/40 p-3.5 text-xs leading-relaxed text-rose-100/90">
            <div className="mb-1 font-semibold uppercase tracking-wider text-rose-300">
              What is a mixer? / Forensic Context
            </div>
            {MIXER_EXPLAIN}
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-400">
              Specific Mixer Addresses Identified ({hits.length})
            </div>
            <div className="space-y-2">
              {hits.map(function (hit, i) {
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-500/30 bg-rose-950/40 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-sm">
                        {hit.label}
                      </span>
                      <span className="font-mono text-rose-200 font-medium break-all">
                        {hit.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-rose-300/90">
                      <span className="rounded bg-black/40 px-2 py-0.5 text-[11px]">
                        Chain: <strong className="text-white">{hit.chain}</strong>
                      </span>
                      <span className="rounded bg-black/40 px-2 py-0.5 text-[11px]">
                        Distance: <strong className="text-white">{hit.hop} hop(s)</strong> from suspect
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
