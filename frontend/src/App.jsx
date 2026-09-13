import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import MixerBanner from "./components/MixerBanner.jsx";
import MatchCard from "./components/MatchCard.jsx";
import ReportSection from "./components/ReportSection.jsx";
import { startTrace, getTraceStatus, stopTrace } from "./api.js";

// Mock preset for preview/demo mode
const DEMO_PREVIEW_RESULT = {
  wallet: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
  total_matches_found: 2,
  total_paths_explored: 28,
  hit_mixer_anywhere: true,
  mixer_hits: [
    {
      label: "Tornado Cash",
      address: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
      chain: "ethereum",
      hop: 0,
    },
  ],
  stopped_early: false,
  matches: [
    {
      matched_service: "Binance",
      entity_type: "exchange",
      source_chain: "ethereum",
      path: [
        "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
        "0x5aFE3855358E112B5647B952709E6165e1c1eEEe",
        "0x28C6c06298d514Db089934071355E5743bf21d60",
      ],
      hop_count: 2,
      confidence_score: 55,
      risk_flags: [
        {
          address: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
          reason: "mixer",
          label: "Tornado Cash",
        },
      ],
      typologies: [
        {
          type: "Mixer / Tumbler Interaction",
          description: "Funds routed through a known mixing protocol to obscure origin.",
        },
        {
          type: "Layering",
          description: "Multiple intermediate hops utilized before landing at centralized VASP deposit.",
        },
      ],
      alert: {
        level: "CRITICAL",
        message: "High-risk mixer interaction detected within 2 hops of VASP deposit.",
      },
    },
    {
      matched_service: "Coinbase",
      entity_type: "exchange",
      source_chain: "ethereum",
      path: [
        "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
        "0x000000000000000000000000000000000000dead",
        "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3",
      ],
      hop_count: 2,
      confidence_score: 52,
      risk_flags: [
        {
          address: "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
          reason: "mixer",
          label: "Tornado Cash",
        },
      ],
      typologies: [
        {
          type: "Mixer / Tumbler Interaction",
          description: "Suspect wallet is confirmed Tornado Cash router contract.",
        },
      ],
      alert: {
        level: "HIGH",
        message: "OFAC sanctioned router contract connected to exchange infrastructure.",
      },
    },
  ],
  report: `============================================================
BLOCKCHAIN WALLET ATTRIBUTION REPORT
============================================================
Suspect wallet: 0x722122dF12D4e14e13Ac3b6895a86e84145b6967
Total addresses explored: 28
Total VASP matches found: 2

Mixer/tumbler detected: YES

What this means:
  A mixer (also called a 'tumbler') is a service designed to break
  the traceable link between a sender and a receiver. It pools funds
  from many different users together and pays back out from that
  shared pool, so it's no longer possible to prove which incoming
  deposit corresponds to which outgoing withdrawal. Investigators
  treat any path that touches a mixer as higher-risk, since it is
  a common technique used to obscure the origin of illicit funds.

Specific mixer(s) found in this search (1):
  - "Tornado Cash" at address 0x722122dF12D4e14e13Ac3b6895a86e84145b6967 (chain: ethereum, 0 hop(s) from suspect wallet)

------------------------------------------------------------
MATCH 1: Binance (exchange)
------------------------------------------------------------
Chain: ethereum
Hops from suspect wallet: 2
Confidence score: 55/100

Why this score:
  - Funds passed through 2 intermediate wallet(s) before reaching this VASP.
  - This specific path passed through the mixer "Tornado Cash" at hop 0.

Risk flags on this path:
  - 0x722122dF12D4e14e13Ac3b6895a86e84145b6967
    Matched: Tornado Cash (mixer)

Suspected typology:
  - Mixer / Tumbler Interaction: Funds routed through a known mixing protocol.
  - Layering: Multiple intermediate hops utilized.

ALERT [CRITICAL]: High-risk mixer interaction detected.

Full transaction path:
  0. 0x722122dF12D4e14e13Ac3b6895a86e84145b6967   <-- MIXER
  1. 0x5aFE3855358E112B5647B952709E6165e1c1eEEe
  2. 0x28C6c06298d514Db089934071355E5743bf21d60

============================================================
END OF REPORT
============================================================`,
};

export default function App() {
  const [address, setAddress] = useState("");
  const [useHopLimit, setUseHopLimit] = useState(true);
  const [maxHops, setMaxHops] = useState(4);

  const [jobId, setJobId] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [nodesExplored, setNodesExplored] = useState(0);
  const [currentAddress, setCurrentAddress] = useState("");
  const [stopSent, setStopSent] = useState(false);
  const [stoppedEarlyMsg, setStoppedEarlyMsg] = useState("");
  const [error, setError] = useState("");

  const running = Boolean(jobId) && !result;

  // Support #preview hash or URL query param for easy demo presentation
  useEffect(function () {
    if (window.location.hash === "#preview") {
      setResult(DEMO_PREVIEW_RESULT);
    }
  }, []);

  // Polling loop for trace job
  useEffect(
    function () {
      if (!jobId || result) return undefined;

      let cancelled = false;

      async function poll() {
        try {
          const data = await getTraceStatus(jobId);
          if (cancelled) return;
          if (data.error) {
            setError(data.error);
            return;
          }
          setStatus(data.status);
          setNodesExplored(data.nodes_explored || 0);
          setCurrentAddress(data.current_address || "");

          if (data.status === "done" || data.status === "stopped") {
            setResult(data.result);
            if (data.status === "stopped") {
              setStoppedEarlyMsg(
                `Trace stopped early after exploring ${data.nodes_explored} nodes.`
              );
            }
          }
        } catch (e) {
          if (!cancelled) {
            setError("Lost connection to backend: " + e.message);
          }
        }
      }

      poll();
      const timer = setInterval(poll, 1500);
      return function () {
        cancelled = true;
        clearInterval(timer);
      };
    },
    [jobId, result]
  );

  async function handleStart() {
    const trimmed = address.trim();
    if (!trimmed) return;
    setError("");
    setResult(null);
    setStopSent(false);
    setStoppedEarlyMsg("");
    setStatus("running");
    setNodesExplored(0);
    setCurrentAddress(trimmed);

    try {
      const hops = useHopLimit ? maxHops : null;
      const data = await startTrace(trimmed, hops);
      setJobId(data.job_id);
    } catch (e) {
      setError(
        "Could not reach the backend API. Is it running on http://localhost:8080? Error: " +
          e.message
      );
      setJobId(null);
      setStatus(null);
    }
  }

  async function handleStop() {
    if (!jobId) return;
    try {
      await stopTrace(jobId);
      setStopSent(true);
    } catch (e) {
      setError("Lost connection to backend: " + e.message);
    }
  }

  function handleReset() {
    setJobId(null);
    setResult(null);
    setStatus(null);
    setNodesExplored(0);
    setCurrentAddress("");
    setStopSent(false);
    setStoppedEarlyMsg("");
    setError("");
  }

  function loadDemoData() {
    setAddress(DEMO_PREVIEW_RESULT.wallet);
    setResult(DEMO_PREVIEW_RESULT);
    setJobId("demo-session");
    setStatus("done");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink text-slate-100 antialiased">
      {/* Sidebar Controls */}
      <Sidebar
        address={address}
        setAddress={setAddress}
        useHopLimit={useHopLimit}
        setUseHopLimit={setUseHopLimit}
        maxHops={maxHops}
        setMaxHops={setMaxHops}
        onStart={handleStart}
        running={running}
      />

      {/* Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Command Center Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel/70 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00d2ff]" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Intelligence Feed
            </span>
            {result && (
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                Target: {result.wallet ? `${result.wallet.slice(0, 12)}...` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!result && !running && (
              <button
                type="button"
                onClick={loadDemoData}
                className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
              >
                Load Forensic Demo Case
              </button>
            )}

            <div className="flex items-center gap-2 rounded-md border border-line bg-ink px-3 py-1 text-[11px] text-muted">
              <span>Status:</span>
              {running ? (
                <span className="font-bold text-amber-400">SCANNING</span>
              ) : result ? (
                <span className="font-bold text-emerald-400">ANALYZED</span>
              ) : (
                <span className="font-bold text-slate-400">STANDBY</span>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Error Banner */}
          {error && (
            <div className="mb-6 flex items-center justify-between rounded-lg border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-200 shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-rose-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-xs text-rose-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Initial Idle State */}
          {!jobId && !result && !error && (
            <div className="flex h-[80%] flex-col items-center justify-center text-center">
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-line bg-panel shadow-2xl">
                <div className="absolute h-full w-full rounded-full border border-cyan-500/20 pulse-dot" />
                <svg className="h-10 w-10 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                VASP Attribution Radar Ready
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                Enter a target wallet address in the sidebar and configure search parameters to execute an automated multi-hop blockchain tracing routine.
              </p>
            </div>
          )}

          {/* Running State with High-Tech Radar Scanning Progress */}
          {running && (
            <div className="space-y-6">
              {stopSent && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                  <span className="text-base">⏳</span>
                  <span>Stop signal sent — finishing current step and returning results so far...</span>
                </div>
              )}

              {/* Radar Progress Container */}
              <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-panel/80 p-6 shadow-2xl shadow-cyan-950/20">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/40">
                      <span className="h-3 w-3 rounded-full bg-cyan-400 pulse-dot" />
                      <div className="radar-sweep absolute h-full w-full rounded-lg border-t-2 border-cyan-400 opacity-60" />
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                        Forensic Graph Search in Progress
                      </div>
                      <div className="text-xs text-muted">
                        Executing multi-branch breadth-first search across on-chain transactions
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStop}
                    disabled={stopSent}
                    className="flex items-center gap-2 rounded-lg border border-rose-500/60 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-200 transition-all hover:bg-rose-500/30 active:scale-95 disabled:opacity-40"
                  >
                    <span>🛑</span>
                    <span>{stopSent ? "Halting Trace..." : "Stop Trace"}</span>
                  </button>
                </div>

                {/* Animated Scanner Bar */}
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-900 ring-1 ring-cyan-500/20">
                  <div className="scan-bar h-full w-full" />
                </div>

                {/* Real-time Diagnostics Grid */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-ink/70 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Nodes Explored
                    </div>
                    <div className="mt-1 font-mono text-3xl font-extrabold text-white">
                      {nodesExplored}
                    </div>
                  </div>

                  <div className="rounded-lg border border-line bg-ink/70 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Currently Checking On-Chain Node
                    </div>
                    <div className="mt-1 font-mono text-xs font-bold text-cyan-300 break-all">
                      {currentAddress || "Initializing crawler..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results State */}
          {result && (
            <div className="space-y-6">
              {/* Early Stop Alert */}
              {stoppedEarlyMsg && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                  ⚠️ {stoppedEarlyMsg}
                </div>
              )}

              {/* Top Metric Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Nodes Explored
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      PATH BREADTH
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-white">
                    {result.total_paths_explored}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      VASPs Found
                    </span>
                    <span className="rounded bg-cyan-950/70 px-2 py-0.5 font-mono text-[10px] text-cyan-400 border border-cyan-500/30">
                      IDENTIFIED
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-cyan-400">
                    {result.total_matches_found}
                  </div>
                </div>
              </div>

              {/* Mixer Banner */}
              <MixerBanner mixerHits={result.mixer_hits} />

              {/* Match Cards or Empty State */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    All Matches Found ({result.matches ? result.matches.length : 0})
                  </h2>
                </div>

                {result.matches && result.matches.length > 0 ? (
                  <div className="space-y-3">
                    {result.matches.map(function (m, i) {
                      return (
                        <MatchCard
                          key={i}
                          index={i}
                          match={m}
                          mixerHits={result.mixer_hits}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5 text-sm leading-relaxed text-cyan-200">
                    <div className="font-semibold text-cyan-100 mb-1">
                      No known VASP identified within search scope
                    </div>
                    No known VASP found within the search — either it's genuinely unhosted, or increase the hop limit / remove it to search further.
                  </div>
                )}
              </div>

              {/* Report Section */}
              <ReportSection result={result} />

              {/* Reset Trace Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-line bg-raised px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                >
                  Start New Trace
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
