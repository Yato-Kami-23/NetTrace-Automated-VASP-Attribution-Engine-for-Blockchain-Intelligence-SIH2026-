"""
Streamlit Dashboard — VASP Attribution Engine
Run with: streamlit run dashboard.py
Requires api.py (FastAPI backend) to be running separately on port 8000.
"""

import streamlit as st
import requests
import networkx as nx
import matplotlib.pyplot as plt

API_URL = "http://localhost:8000"

st.set_page_config(page_title="VASP Attribution Dashboard", layout="wide")

st.title("🔍 Automated VASP Attribution Engine")
st.caption("Trace a suspect wallet to the nearest known exchange / VASP")

# ---------- Sidebar: input controls ----------
with st.sidebar:
    st.header("Trace a Wallet")
    address = st.text_input("Wallet address", placeholder="0x...")
    st.caption("No hop limit — search runs until every reachable address "
               "has been checked. This can take a while on very active wallets.")
    run_trace = st.button("Run Trace", type="primary", use_container_width=True)

# ---------- Run the trace ----------
if run_trace and address:
    with st.spinner("Tracing transaction path — no hop limit, this may take "
                     "several minutes on busy wallets, please wait..."):
        try:
            resp = requests.post(
                f"{API_URL}/trace",
                json={"address": address, "max_hops": None},
                timeout=None  # no timeout — let it run as long as the search needs
            )
            resp.raise_for_status()
            result = resp.json()
            st.session_state["result"] = result
        except requests.RequestException as e:
            st.error(f"Could not reach the backend API. Is it running on {API_URL}? Error: {e}")

# ---------- Display results ----------
if "result" in st.session_state:
    result = st.session_state["result"]

    # Top-level metrics row
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Matched Service", result["matched_service"] or "Not found")
    col2.metric("Entity Type", result["entity_type"] or "—")
    col3.metric("Hops Traced", result["hop_count"])

    confidence = result["confidence_score"]
    conf_label = "🟢 High" if confidence >= 70 else "🟡 Medium" if confidence >= 40 else "🔴 Low"
    col4.metric("Confidence", f"{confidence}/100", conf_label)

    st.divider()

    # Risk flags — highlighted prominently since this matters most to investigators
    if result["risk_flags"]:
        st.error("⚠️ RISK FLAGS DETECTED")
        for flag in result["risk_flags"]:
            st.write(f"- `{flag['address']}` matched **{flag['reason']}** ({flag['label']})")
    else:
        st.success("✅ No risk flags detected in this path")

    # Alert banner — optional problem-statement feature: alerting for high-risk wallets
    if result.get("alert"):
        alert = result["alert"]
        if alert["level"] == "CRITICAL":
            st.error(f"🚨 {alert['level']}: {alert['message']}")
        elif alert["level"] == "HIGH":
            st.warning(f"⚠️ {alert['level']}: {alert['message']}")
        else:
            st.info(f"ℹ️ {alert['level']}: {alert['message']}")

    # Laundering typology — optional problem-statement feature
    if result.get("typologies"):
        st.subheader("Suspected Typology")
        for t in result["typologies"]:
            st.write(f"**{t['type']}** — {t['description']}")

    st.divider()

    # ---------- Fund flow visualization ----------
    st.subheader("Fund Flow Path")

    path = result["path"]
    if len(path) > 1:
        graph = nx.DiGraph()
        for i in range(len(path) - 1):
            graph.add_edge(path[i][:10] + "...", path[i + 1][:10] + "...")

        fig, ax = plt.subplots(figsize=(10, 3))
        pos = {node: (i, 0) for i, node in enumerate(graph.nodes())}

        # Color the final node differently if it's the matched VASP
        node_colors = []
        nodes_list = list(graph.nodes())
        for i, node in enumerate(nodes_list):
            if i == len(nodes_list) - 1 and result["matched_service"]:
                node_colors.append("#2ecc71")  # green = matched exchange
            else:
                node_colors.append("#3498db")  # blue = intermediate wallet

        nx.draw(
            graph, pos, ax=ax, with_labels=True, node_color=node_colors,
            node_size=2500, font_size=8, arrows=True, arrowsize=20,
            edge_color="#888"
        )
        st.pyplot(fig)

        if result["matched_service"]:
            st.caption(f"🟢 Green node = matched VASP ({result['matched_service']}) | 🔵 Blue = intermediate wallets")
    else:
        st.info("Single-node path — no onward transactions found within the hop limit.")

    st.divider()

    # ---------- Full path as a table ----------
    st.subheader("Hop-by-Hop Path")
    for i, addr in enumerate(path):
        st.text(f"Hop {i}: {addr}")

    st.divider()

    # ---------- Raw investigation report ----------
    with st.expander("📄 Full Investigation Report (plain text)"):
        st.text(result["report"])

    st.download_button(
        "Download Report",
        data=result["report"],
        file_name=f"attribution_report_{result['wallet'][:10]}.txt",
        mime="text/plain"
    )

else:
    st.info("👈 Enter a wallet address in the sidebar and click Run Trace to begin.")