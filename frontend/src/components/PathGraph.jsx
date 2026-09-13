import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import { isMixerAddress, shortenAddress } from "../utils.js";

function CopyIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CustomWalletNode({ data }) {
  const [copied, setCopied] = useState(false);
  const kind = data.kind;

  function copyAddr(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(data.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  // Tactical styling themes per node role
  let containerStyle = "border-slate-700 bg-slate-900/95 text-slate-200 shadow-md";
  let badgeStyle = "bg-slate-800 text-slate-400 border border-slate-700";
  let badgeText = `HOP #${data.hop}`;
  let glowColor = "transparent";

  if (kind === "suspect") {
    containerStyle = "border-amber-500/80 bg-[#161206]/95 text-amber-100 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/40";
    badgeStyle = "bg-amber-500/25 text-amber-300 border border-amber-500/50";
    badgeText = "SUSPECT WALLET";
    glowColor = "rgba(245, 158, 11, 0.2)";
  } else if (kind === "mixer") {
    containerStyle = "border-rose-500/90 bg-[#200909]/95 text-rose-100 shadow-xl shadow-rose-950/60 ring-2 ring-rose-500/50 mixer-pulse";
    badgeStyle = "bg-rose-600 text-white font-black tracking-wider";
    badgeText = "⚠️ MIXER / TUMBLER";
    glowColor = "rgba(239, 68, 68, 0.4)";
  } else if (kind === "vasp") {
    containerStyle = "border-cyan-400/80 bg-[#06161f]/95 text-cyan-100 shadow-xl shadow-cyan-950/50 ring-1 ring-cyan-400/40";
    badgeStyle = "bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 font-bold";
    badgeText = "🎯 IDENTIFIED VASP";
    glowColor = "rgba(6, 182, 212, 0.3)";
  }

  return (
    <div
      style={{ boxShadow: `0 0 16px ${glowColor}` }}
      className={`min-w-[190px] max-w-[240px] rounded-lg border px-3 py-2.5 backdrop-blur transition-all ${containerStyle}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !bg-slate-400 !border-2 !border-slate-900"
      />

      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${badgeStyle}`}>
          {badgeText}
        </span>
        <button
          type="button"
          onClick={copyAddr}
          title="Copy address"
          className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/20 hover:text-white"
        >
          <CopyIcon />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <div className="font-mono text-[11px] font-semibold text-slate-100 break-all leading-tight">
        {shortenAddress(data.address)}
      </div>

      {data.label && (
        <div className="mt-1 truncate text-[10px] font-semibold text-cyan-300">
          {data.label}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !bg-slate-400 !border-2 !border-slate-900"
      />
    </div>
  );
}

const nodeTypes = { wallet: CustomWalletNode };

export default function PathGraph({ path, mixerHits, matchedService }) {
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const addrs = path || [];

  const graph = useMemo(
    function () {
      const nodes = addrs.map(function (addr, i) {
        let kind = "hop";
        let label = "";

        if (i === 0) {
          kind = "suspect";
          label = "Suspect Origin";
        } else if (i === addrs.length - 1 && addrs.length > 1) {
          kind = "vasp";
          label = matchedService || "Target Exchange";
        }

        if (isMixerAddress(addr, mixerHits)) {
          kind = "mixer";
          const hit = (mixerHits || []).find(
            (h) => h.address.toLowerCase() === addr.toLowerCase()
          );
          if (hit) label = hit.label;
        }

        return {
          id: String(i),
          type: "wallet",
          position: { x: i * 260, y: 35 },
          data: { address: addr, hop: i, kind: kind, label: label },
          sourcePosition: "right",
          targetPosition: "left",
        };
      });

      const edges = [];
      for (let i = 0; i < addrs.length - 1; i++) {
        const touchesMixer =
          isMixerAddress(addrs[i], mixerHits) || isMixerAddress(addrs[i + 1], mixerHits);

        edges.push({
          id: `edge-${i}-${i + 1}`,
          source: String(i),
          target: String(i + 1),
          animated: true,
          style: {
            stroke: touchesMixer ? "#ef4444" : "#00d2ff",
            strokeWidth: touchesMixer ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: touchesMixer ? "#ef4444" : "#00d2ff",
            width: 16,
            height: 16,
          },
        });
      }

      return { nodes: nodes, edges: edges };
    },
    [addrs, mixerHits, matchedService]
  );

  if (!addrs || addrs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
          <svg className="h-3.5 w-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Visual Hop Flow Graph ({addrs.length} Nodes)</span>
        </div>

        <button
          type="button"
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="rounded border border-line bg-raised px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-raised-hover hover:text-white"
        >
          {showAuditTrail ? "Hide Address List" : "Show Full Address Audit Trail"}
        </button>
      </div>

      <div className="h-[240px] w-full overflow-hidden rounded-lg border border-line bg-[#080d17] shadow-inner">
        <ReactFlowProvider>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.25}
            maxZoom={1.8}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#16233b" gap={20} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>Suspect</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Mixer Hop</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
            <span>Intermediary</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span>Identified VASP</span>
          </span>
        </div>
        <span>Drag nodes or scroll to pan/zoom</span>
      </div>

      {showAuditTrail && (
        <div className="rounded-md border border-line bg-ink/90 p-3 text-xs">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Transaction Path Audit Log
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {addrs.map(function (addr, j) {
              const isMixer = isMixerAddress(addr, mixerHits);
              return (
                <div
                  key={j}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    isMixer ? "bg-rose-950/40 text-rose-300 font-bold border border-rose-500/30" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="break-all">
                    {j}. {addr} {isMixer && " ⚠️ MIXER"}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(addr)}
                    className="ml-2 shrink-0 text-[10px] text-muted hover:text-white"
                  >
                    copy
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
