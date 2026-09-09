"""
PERSON 4's FILE — API Layer & Report Output (YOUR PART)
Wires together fetcher -> grapher -> attribution into one endpoint,
and formats a readable investigation report.

Includes background job support: POST /trace/start kicks off a trace
in a separate thread and returns a job_id immediately. GET /trace/status/{job_id}
polls live progress (nodes explored, current address). POST /trace/stop/{job_id}
signals the trace to stop early and return whatever it found so far.
"""

import threading
import uuid
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from grapher import trace_path, trace_nearest
from attribution import calculate_confidence, check_risk_flags, classify_laundering_typology, generate_alert

app = FastAPI(title="VASP Attribution Engine")

_last_results = {}

# job_id -> {status, nodes_explored, current_address, result, stop_flag}
_jobs = {}


class TraceRequest(BaseModel):
    address: str
    max_hops: int | None = None  # None = no hop limit, search until exhausted


def _run_trace_job(job_id: str, address: str, max_hops):
    stop_flag = _jobs[job_id]["stop_flag"]

    def on_progress(nodes_explored, current_address):
        _jobs[job_id]["nodes_explored"] = nodes_explored
        _jobs[job_id]["current_address"] = current_address

    result = trace_path(
        address,
        max_hops=max_hops,
        stop_flag=stop_flag,
        progress_callback=on_progress
    )

    enriched_matches = []
    for m in result["matches"]:
        confidence = calculate_confidence(hops=m["hops"], hit_mixer=result["hit_mixer"], found=True)
        risk_flags = check_risk_flags(m["path"])
        typologies = classify_laundering_typology(m["path"], risk_flags, m["hops"])
        alert = generate_alert(risk_flags, confidence)
        enriched_matches.append({
            "matched_service": m["found"]["label"],
            "entity_type": m["found"]["entity_type"],
            "source_chain": m["chain"],
            "path": m["path"],
            "hop_count": m["hops"],
            "confidence_score": confidence,
            "risk_flags": risk_flags,
            "typologies": typologies,
            "alert": alert
        })

    report_text = generate_multi_match_report(address, enriched_matches, result)

    _jobs[job_id]["status"] = "stopped" if result["stopped_early"] else "done"
    _jobs[job_id]["result"] = {
        "wallet": address,
        "total_matches_found": len(enriched_matches),
        "total_paths_explored": result["all_paths_explored"],
        "hit_mixer_anywhere": result["hit_mixer"],
        "stopped_early": result["stopped_early"],
        "matches": enriched_matches,
        "report": report_text
    }


def generate_multi_match_report(wallet, matches, raw_result):
    """
    Explainable investigation report covering EVERY VASP match found
    across the full multi-path trace — not just one answer. Each match
    includes plain-language reasoning for its confidence score and any
    flags, so an investigator (or a court) can see how the system
    reached its conclusion, not just the conclusion itself.
    """
    lines = []
    lines.append("=" * 60)
    lines.append("BLOCKCHAIN WALLET ATTRIBUTION REPORT")
    lines.append("=" * 60)
    lines.append(f"Suspect wallet: {wallet}")
    lines.append(f"Total addresses explored: {raw_result['all_paths_explored']}")
    lines.append(f"Total VASP matches found: {len(matches)}")
    lines.append(f"Mixer/tumbler detected anywhere in search: {'YES' if raw_result['hit_mixer'] else 'No'}")
    if raw_result.get("stopped_early"):
        lines.append("NOTE: search was stopped early by the investigator — "
                      "results reflect a partial trace, not an exhaustive one.")
    lines.append("")

    if not matches:
        lines.append("No known VASP was found within the search scope.")
        lines.append("This wallet may be genuinely unhosted, or the destination")
        lines.append("exchange is not yet in the attribution database.")
        lines.append("=" * 60)
        return "\n".join(lines)

    # Sort so the strongest (nearest, highest-confidence) match leads the report
    sorted_matches = sorted(matches, key=lambda m: m["hop_count"])

    for i, m in enumerate(sorted_matches, 1):
        lines.append("-" * 60)
        lines.append(f"MATCH {i}: {m['matched_service']} ({m['entity_type']})")
        lines.append("-" * 60)
        lines.append(f"Chain: {m['source_chain']}")
        lines.append(f"Hops from suspect wallet: {m['hop_count']}")
        lines.append(f"Confidence score: {m['confidence_score']}/100")
        lines.append("")

        # --- Explain WHY this confidence score, in plain language ---
        lines.append("Why this score:")
        if m["hop_count"] <= 1:
            lines.append("  - Direct or near-direct deposit to a known VASP address.")
            lines.append("    This is the strongest possible signal — the funds")
            lines.append("    landed almost immediately at a labeled exchange wallet.")
        else:
            lines.append(f"  - Funds passed through {m['hop_count']} intermediate wallet(s)")
            lines.append("    before reaching this VASP. Each additional hop slightly")
            lines.append("    lowers confidence, since more intermediaries mean more")
            lines.append("    opportunity for funds to have mixed with other sources.")
        if raw_result["hit_mixer"]:
            lines.append("  - A known mixer/tumbler was encountered somewhere in the")
            lines.append("    broader search, which reduces overall trace reliability.")
        lines.append("")

        # --- Risk flags, explained ---
        if m["risk_flags"]:
            lines.append("Risk flags on this path:")
            for flag in m["risk_flags"]:
                lines.append(f"  - {flag['address']}")
                lines.append(f"    Matched: {flag['label']} ({flag['reason']})")
        else:
            lines.append("Risk flags on this path: none detected.")
        lines.append("")

        # --- Typology, explained ---
        if m.get("typologies"):
            lines.append("Suspected typology:")
            for t in m["typologies"]:
                lines.append(f"  - {t['type']}: {t['description']}")
            lines.append("")

        # --- Alert, if any ---
        if m.get("alert"):
            lines.append(f"ALERT [{m['alert']['level']}]: {m['alert']['message']}")
            lines.append("")

        # --- Full path, for audit trail ---
        lines.append("Full transaction path (suspect wallet -> VASP):")
        for j, addr in enumerate(m["path"]):
            lines.append(f"  {j}. {addr}")
        lines.append("")

    lines.append("=" * 60)
    lines.append("END OF REPORT")
    lines.append("=" * 60)
    return "\n".join(lines)


@app.post("/trace/start")
def start_trace(request: TraceRequest):
    """Kicks off a trace in the background, returns immediately with a job_id."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "running",
        "nodes_explored": 0,
        "current_address": request.address,
        "result": None,
        "stop_flag": threading.Event()
    }
    thread = threading.Thread(
        target=_run_trace_job,
        args=(job_id, request.address, request.max_hops),
        daemon=True
    )
    thread.start()
    return {"job_id": job_id, "status": "running"}


@app.get("/trace/status/{job_id}")
def trace_status(job_id: str):
    """Poll this to see live progress: nodes explored so far, current address, and status."""
    job = _jobs.get(job_id)
    if not job:
        return {"error": "Unknown job_id"}
    return {
        "status": job["status"],
        "nodes_explored": job["nodes_explored"],
        "current_address": job["current_address"],
        "result": job["result"]
    }


@app.post("/trace/stop/{job_id}")
def stop_trace(job_id: str):
    """Signals a running trace to stop and return whatever it found so far."""
    job = _jobs.get(job_id)
    if not job:
        return {"error": "Unknown job_id"}
    job["stop_flag"].set()
    return {"status": "stop signal sent"}


@app.post("/trace")
def trace(request: TraceRequest):
    """Returns the single nearest match (original synchronous behavior)."""
    result = trace_nearest(request.address, max_hops=request.max_hops)
    found = result["found"] is not None

    confidence = calculate_confidence(hops=result["hops"], hit_mixer=result["hit_mixer"], found=found)
    risk_flags = check_risk_flags(result["path"])
    typologies = classify_laundering_typology(result["path"], risk_flags, result["hops"])
    alert = generate_alert(risk_flags, confidence)
    report_text = generate_report(request.address, result, confidence, risk_flags)

    response = {
        "wallet": request.address,
        "matched_service": result["found"]["label"] if found else None,
        "entity_type": result["found"]["entity_type"] if found else None,
        "source_chain": result.get("chain"),
        "path": result["path"],
        "hop_count": result["hops"],
        "confidence_score": confidence,
        "risk_flags": risk_flags,
        "typologies": typologies,
        "alert": alert,
        "report": report_text
    }

    _last_results[request.address.lower()] = report_text
    return response


@app.post("/trace/all-paths")
def trace_all(request: TraceRequest):
    """
    Returns EVERY VASP match found across every branch explored — shows
    the full split/multi-node picture instead of collapsing to one answer.
    """
    result = trace_path(request.address, max_hops=request.max_hops)

    enriched_matches = []
    for m in result["matches"]:
        confidence = calculate_confidence(hops=m["hops"], hit_mixer=result["hit_mixer"], found=True)
        risk_flags = check_risk_flags(m["path"])
        enriched_matches.append({
            "matched_service": m["found"]["label"],
            "entity_type": m["found"]["entity_type"],
            "source_chain": m["chain"],
            "path": m["path"],
            "hop_count": m["hops"],
            "confidence_score": confidence,
            "risk_flags": risk_flags
        })

    return {
        "wallet": request.address,
        "total_matches_found": len(enriched_matches),
        "total_paths_explored": result["all_paths_explored"],
        "hit_mixer_anywhere": result["hit_mixer"],
        "matches": enriched_matches
    }


@app.get("/trace/report/{address}", response_class=PlainTextResponse)
def get_report(address: str):
    """
    Returns the last generated report for this address as plain text —
    renders cleanly in a browser tab or curl, no escaped \\n characters.
    Run POST /trace first for this address, then open this in a browser.
    """
    report = _last_results.get(address.lower())
    if not report:
        return "No trace found for this address yet. Run POST /trace first."
    return report


def generate_report(wallet, result, confidence, risk_flags):
    """Formats the trace result into a plain-text investigation report."""
    lines = []
    lines.append("=" * 50)
    lines.append("BLOCKCHAIN WALLET ATTRIBUTION REPORT")
    lines.append("=" * 50)
    lines.append(f"Suspect wallet: {wallet}")
    lines.append(f"Hops traced: {result['hops']}")
    lines.append("")

    if result["found"]:
        lines.append(f"Nearest VASP identified: {result['found']['label']}")
        lines.append(f"Entity type: {result['found']['entity_type']}")
        lines.append(f"Source chain: {result.get('chain', 'unknown')}")
        lines.append(f"Confidence score: {confidence}/100")
    else:
        lines.append("No known VASP found within hop limit.")
        lines.append(f"Confidence score: {confidence}/100")

    lines.append("")
    lines.append("Transaction path:")
    for i, addr in enumerate(result["path"]):
        lines.append(f"  {i}. {addr}")

    lines.append("")
    if risk_flags:
        lines.append("RISK FLAGS DETECTED:")
        for flag in risk_flags:
            lines.append(f"  - {flag['address']} matched {flag['reason']} ({flag['label']})")
    else:
        lines.append("No risk flags detected in path.")

    lines.append("=" * 50)
    return "\n".join(lines)


@app.get("/")
def root():
    return {
        "status": "VASP Attribution Engine running",
        "endpoints": {
            "trace_sync": "POST /trace  (waits for full result, no live progress)",
            "trace_start": "POST /trace/start  (returns job_id immediately)",
            "trace_status": "GET /trace/status/{job_id}  (poll for live progress + result)",
            "trace_stop": "POST /trace/stop/{job_id}  (stop a running trace early)",
            "report": "GET /trace/report/{address}"
        }
    }