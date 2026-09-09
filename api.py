"""
PERSON 4's FILE — API Layer & Report Output (YOUR PART)
Wires together fetcher -> grapher -> attribution into one endpoint,
and formats a readable investigation report.
"""

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from grapher import trace_path
from attribution import calculate_confidence, check_risk_flags, classify_laundering_typology, generate_alert

app = FastAPI(title="VASP Attribution Engine")

# Simple in-memory cache of the last trace per wallet, so the /trace/report
# endpoint can return a clean plain-text view without re-running the trace
_last_results = {}


class TraceRequest(BaseModel):
    address: str
    max_hops: int = 4


@app.post("/trace")
def trace(request: TraceRequest):
    result = trace_path(request.address, max_hops=request.max_hops)
    found = result["found"] is not None

    confidence = calculate_confidence(
        hops=result["hops"],
        hit_mixer=result["hit_mixer"],
        found=found
    )

    risk_flags = check_risk_flags(result["path"])
    typologies = classify_laundering_typology(result["path"], risk_flags, result["hops"])
    alert = generate_alert(risk_flags, confidence)
    report_text = generate_report(request.address, result, confidence, risk_flags)

    response = {
        "wallet": request.address,
        "matched_service": result["found"]["label"] if found else None,
        "entity_type": result["found"]["entity_type"] if found else None,
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
            "trace": "POST /trace",
            "report": "GET /trace/report/{address}  (view after running /trace)"
        }
    }