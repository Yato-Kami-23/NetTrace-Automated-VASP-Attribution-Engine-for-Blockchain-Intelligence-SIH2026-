"""
Streamlit Dashboard — VASP Attribution Engine (LIVE PROGRESS VERSION)
Run with: streamlit run dashboard.py
Requires api.py (FastAPI backend) running separately on port 8000.

Uses the background job endpoints (/trace/start, /trace/status, /trace/stop)
so you get a live "nodes explored" counter and a Stop button, instead of
waiting blind on one long synchronous call.
"""

import streamlit as st
import requests
import time

API_URL = "http://localhost:8000"

st.set_page_config(page_title="VASP Attribution Dashboard", layout="wide")

st.title("🔍 Automated VASP Attribution Engine")
st.caption("Trace a suspect wallet to every reachable known exchange / VASP")

# ---------- Sidebar: input controls ----------
with st.sidebar:
    st.header("Trace a Wallet")
    address = st.text_input("Wallet address", placeholder="0x...")
    use_hop_limit = st.checkbox("Set a hop limit", value=True)
    max_hops = st.slider("Max hops", 1, 10, 4) if use_hop_limit else None
    start_button = st.button("Start Trace", type="primary", use_container_width=True)

# ---------- Start a new trace job ----------
if start_button and address:
    try:
        resp = requests.post(f"{API_URL}/trace/start", json={"address": address, "max_hops": max_hops})
        resp.raise_for_status()
        job_id = resp.json()["job_id"]
        st.session_state["job_id"] = job_id
        st.session_state["result"] = None
    except requests.RequestException as e:
        st.error(f"Could not reach the backend API. Is it running on {API_URL}? Error: {e}")

# ---------- Live progress + polling ----------
if st.session_state.get("job_id") and not st.session_state.get("result"):
    job_id = st.session_state["job_id"]

    if st.button("🛑 Stop Trace", key="stop_btn"):
        requests.post(f"{API_URL}/trace/stop/{job_id}")
        st.warning("Stop signal sent — finishing current step and returning results so far...")

    try:
        status_resp = requests.get(f"{API_URL}/trace/status/{job_id}", timeout=10)
        status = status_resp.json()
    except requests.RequestException as e:
        st.error(f"Lost connection to backend: {e}")
        status = None

    if status:
        st.info(
            f"🔎 Nodes explored: **{status['nodes_explored']}** | "
            f"Currently checking: `{status['current_address']}`"
        )

        if status["status"] in ("done", "stopped"):
            st.session_state["result"] = status["result"]
            if status["status"] == "stopped":
                st.warning(f"Trace stopped early after exploring {status['nodes_explored']} nodes.")
            st.rerun()
        else:
            # Not done yet — wait briefly, then rerun the script to poll again.
            # This (rather than a blocking loop) keeps the Stop button clickable
            # in between refreshes, since each rerun redraws the whole page.
            time.sleep(1.5)
            st.rerun()

# ---------- Display results ----------
if st.session_state.get("result"):
    result = st.session_state["result"]

    col1, col2, col3 = st.columns(3)
    col1.metric("Nodes Explored", result["total_paths_explored"])
    col2.metric("VASPs Found", result["total_matches_found"])
    col3.metric("Mixer Detected", "Yes ⚠️" if result["hit_mixer_anywhere"] else "No ✅")

    st.divider()

    if result["matches"]:
        st.subheader(f"All {len(result['matches'])} Matches Found")
        for i, m in enumerate(result["matches"]):
            with st.expander(
                f"Match {i+1}: {m['matched_service']} ({m['entity_type']}) "
                f"— {m['hop_count']} hops on {m['source_chain']} — "
                f"confidence {m['confidence_score']}/100"
            ):
                st.write(f"**Source chain:** {m['source_chain']}")
                st.write(f"**Confidence:** {m['confidence_score']}/100")
                if m.get("typologies"):
                    st.write("**Suspected typology:**")
                    for t in m["typologies"]:
                        st.write(f"- {t['type']}: {t['description']}")
                if m.get("alert"):
                    st.warning(f"{m['alert']['level']}: {m['alert']['message']}")
                st.write("**Path:**")
                for j, addr in enumerate(m["path"]):
                    st.text(f"  {j}. {addr}")
                if m["risk_flags"]:
                    st.error("Risk flags:")
                    for flag in m["risk_flags"]:
                        st.write(f"- {flag['address']} — {flag['reason']} ({flag['label']})")
    else:
        st.info("No known VASP found within the search — either it's genuinely unhosted, "
                "or increase the hop limit / remove it to search further.")

    st.divider()

    # ---------- Explainable report, downloadable ----------
    if result.get("report"):
        with st.expander("📄 Full Explainable Investigation Report"):
            st.text(result["report"])

        st.download_button(
            "⬇️ Download Investigation Report",
            data=result["report"],
            file_name=f"attribution_report_{result['wallet'][:10]}.txt",
            mime="text/plain",
            use_container_width=True
        )

    st.divider()
    if st.button("Start New Trace"):
        st.session_state["job_id"] = None
        st.session_state["result"] = None
        st.rerun()

elif not st.session_state.get("job_id"):
    st.info("👈 Enter a wallet address in the sidebar and click Start Trace to begin.")