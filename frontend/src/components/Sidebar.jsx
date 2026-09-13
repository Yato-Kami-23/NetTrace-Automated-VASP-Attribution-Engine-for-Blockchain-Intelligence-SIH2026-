import { useState } from "react";

const DEMO_TARGETS = [
  {
    name: "Tornado Cash (Mixer)",
    addr: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
  },
  {
    name: "Binance Hot Wallet",
    addr: "0x28C6c06298d514Db089934071355E5743bf21d60",
  },
  {
    name: "Coinbase Hot Wallet",
    addr: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3",
  },
  {
    name: "OFAC Sanctioned",
    addr: "0x8589427373D6D84E98730D7795D8f6f8731FDA0",
  },
];

export default function Sidebar({
  address,
  setAddress,
  useHopLimit,
  setUseHopLimit,
  maxHops,
  setMaxHops,
  onStart,
  running,
}) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-line bg-panel shadow-2xl">
      {/* Brand Header */}
      <div className="border-b border-line/80 px-5 py-5 bg-ink/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="m10 15 5-3-5-3v6Z" fill="currentColor" />
              </svg>
            </div>
            <span className="font-mono text-xs font-black uppercase tracking-widest text-cyan-400">
              NetTrace OS
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            ONLINE
          </span>
        </div>

        <h1 className="mt-2 text-base font-bold tracking-tight text-white">
          VASP Attribution Engine
        </h1>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          Multi-hop blockchain intelligence & forensic counter-mixer tracking
        </p>
      </div>

      {/* Controls Form */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Suspect Wallet Address
              </span>
              {address && !running && (
                <button
                  type="button"
                  onClick={() => setAddress("")}
                  className="text-[10px] text-muted hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... or BTC address"
              disabled={running}
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-xs text-white placeholder-slate-600 transition-all outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
            />
          </label>

          {/* Quick Preset Badges */}
          {!running && (
            <div className="mt-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                Preset Forensic Targets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_TARGETS.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAddress(t.addr)}
                    className="rounded border border-slate-700/80 bg-raised/90 px-2 py-1 text-[10px] font-medium text-slate-300 transition-all hover:border-cyan-500/50 hover:bg-cyan-950/30 hover:text-cyan-200"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hop Limit Settings */}
        <div className="rounded-lg border border-line bg-raised/40 p-3.5 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={useHopLimit}
              disabled={running}
              onChange={(e) => setUseHopLimit(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-ink text-cyan-500 focus:ring-cyan-400"
            />
            <span>Set a hop limit</span>
          </label>

          {useHopLimit && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-[11px] font-medium text-muted">Search Depth</span>
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {maxHops} {maxHops === 1 ? "Hop" : "Hops"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={maxHops}
                disabled={running}
                onChange={(e) => setMaxHops(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted">
                <span>1 (Direct)</span>
                <span>5 (Deep)</span>
                <span>10 (Max)</span>
              </div>
            </div>
          )}
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={onStart}
          disabled={running || !address.trim()}
          className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-400/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? (
            <>
              <span className="h-2 w-2 rounded-full bg-slate-950 pulse-dot" />
              <span>Tracing Active...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>Start Trace</span>
            </>
          )}
        </button>

        {/* System Diagnostics Box */}
        <div className="mt-auto border-t border-line/60 pt-4 text-[10px] text-muted space-y-1">
          <div className="flex justify-between">
            <span>Backend Gateway</span>
            <span className="font-mono text-slate-400">localhost:8080</span>
          </div>
          <div className="flex justify-between">
            <span>Engine Threading</span>
            <span className="font-mono text-emerald-400">Background BFS</span>
          </div>
          <div className="flex justify-between">
            <span>Database Status</span>
            <span className="font-mono text-slate-400">SQLite Hot-Wallets</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
