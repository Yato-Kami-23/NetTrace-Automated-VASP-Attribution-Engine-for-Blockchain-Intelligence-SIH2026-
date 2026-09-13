import { useState } from "react";
import { reportFileName, downloadTextFile } from "../utils.js";

export default function ReportSection({ result }) {
  const [copied, setCopied] = useState(false);
  const report = result?.report;
  if (!report) return null;

  function handleDownload() {
    downloadTextFile(reportFileName(result.wallet), report);
  }

  function handleCopy() {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
          <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Official Forensic Report</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            {copied ? "✓ Copied to Clipboard" : "Copy Report"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/25 hover:text-cyan-200"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span>Download .txt Report</span>
          </button>
        </div>
      </div>

      <details className="overflow-hidden rounded-xl border border-line bg-ink/90 shadow-md">
        <summary className="flex cursor-pointer items-center justify-between border-b border-line/60 bg-panel px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-raised/70">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Full Explainable Investigation Report</span>
            <span className="font-mono text-[10px] text-muted">
              ({reportFileName(result.wallet)})
            </span>
          </div>
          <span className="text-muted">Click to toggle</span>
        </summary>
        <div className="p-4">
          <pre className="max-h-[460px] overflow-auto rounded-lg border border-slate-800 bg-[#05080e] p-4 font-mono text-[11px] leading-relaxed text-slate-300 selection:bg-cyan-500/30 selection:text-white">
            {report}
          </pre>
        </div>
      </details>
    </div>
  );
}
