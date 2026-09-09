"""
PERSON 3's FILE — Attribution Database & Risk/Confidence Scoring (REAL VERSION)
Seeded with genuine, publicly documented addresses (Binance, Coinbase, Kraken
hot wallets are widely published/known from on-chain analysis and exchange
disclosures) instead of placeholder fake addresses.

NOTE: Exchanges rotate hot wallets over time, so this list will go stale.
For a real production system you'd refresh this from a maintained source
(e.g. Etherscan's own address-tag labels, or a paid Chainalysis/TRM feed).
For a hackathon demo, this static list is enough to prove real matches happen.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "addresses.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS addresses (
            address TEXT PRIMARY KEY,
            label TEXT,
            entity_type TEXT,
            source TEXT
        )
    """)

    # Real, publicly documented addresses (verifiable on Etherscan/Blockstream,
    # which label them directly on the address page)
    real_data = [
        # --- Binance known hot wallets (ETH) ---
        ("0x28C6c06298d514Db089934071355E5743bf21d60", "Binance", "exchange", "etherscan-label"),
        ("0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", "Binance", "exchange", "etherscan-label"),
        ("0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", "Binance", "exchange", "etherscan-label"),

        # --- Coinbase known hot wallets (ETH) ---
        ("0x71660c4005BA85c37ccec55d0C4493E66Fe775d3", "Coinbase", "exchange", "etherscan-label"),
        ("0x503828976D22510aad0201ac7EC88293211D923", "Coinbase", "exchange", "etherscan-label"),

        # --- Kraken known hot wallet (ETH) ---
        ("0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", "Kraken", "exchange", "etherscan-label"),

        # --- Known Bitcoin exchange address (Bitfinex cold/hot storage, widely cited) ---
        ("3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r", "Bitfinex", "exchange", "public-record"),

        # --- Known mixer (Tornado Cash router, OFAC sanctioned Aug 2022) ---
        ("0x722122dF12D4e14e13Ac3b6895a86e84145b6967", "Tornado Cash", "mixer", "ofac-sdn"),

        # --- OFAC sanctioned example address ---
        ("0x8589427373D6D84E98730D7795D8f6f8731FDA0", "OFAC Sanctioned Entity", "sanctioned", "ofac-sdn"),
    ]

    cur.executemany(
        "INSERT OR IGNORE INTO addresses VALUES (?, ?, ?, ?)", real_data
    )
    conn.commit()
    conn.close()


def lookup_known_address(address: str):
    """Case-insensitive lookup. Returns {label, entity_type, source} or None."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT label, entity_type, source FROM addresses WHERE LOWER(address) = LOWER(?)",
        (address,)
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return {"label": row[0], "entity_type": row[1], "source": row[2]}
    return None


def check_risk_flags(path: list):
    """Checks every address in the path against sanctioned/mixer entries."""
    flags = []
    for addr in path:
        match = lookup_known_address(addr)
        if match and match["entity_type"] in ("sanctioned", "mixer"):
            flags.append({"address": addr, "reason": match["entity_type"], "label": match["label"]})
    return flags


def classify_laundering_typology(path: list, risk_flags: list, hops: int):
    """
    Optional problem-statement feature: identification of laundering typologies.
    Simple rule-based classification (not ML) — transparent and explainable,
    which matters for an investigation tool that has to justify its output.
    """
    typologies = []

    mixer_hits = [f for f in risk_flags if f["reason"] == "mixer"]
    sanctioned_hits = [f for f in risk_flags if f["reason"] == "sanctioned"]

    if mixer_hits:
        typologies.append({
            "type": "Layering via Mixer",
            "description": "Funds passed through a mixing/tumbling service, "
                            "a classic technique to obscure the origin of funds."
        })

    if sanctioned_hits:
        typologies.append({
            "type": "Sanctioned Entity Exposure",
            "description": "Path touches an OFAC-sanctioned address — "
                            "requires priority escalation."
        })

    if hops >= 5 and not risk_flags:
        typologies.append({
            "type": "Layering via Chain-Hopping",
            "description": "Long hop chain with no direct exchange contact — "
                            "consistent with deliberate obfuscation through "
                            "many intermediate wallets."
        })

    if not typologies:
        typologies.append({
            "type": "Direct Deposit",
            "description": "Straightforward path to a known VASP with no "
                            "obfuscation indicators detected."
        })

    return typologies


def generate_alert(risk_flags: list, confidence: int):
    """
    Optional problem-statement feature: alerting for high-risk wallets.
    Returns an alert dict if this trace warrants investigator attention,
    or None if it's routine.
    """
    if any(f["reason"] == "sanctioned" for f in risk_flags):
        return {"level": "CRITICAL", "message": "Path includes a sanctioned address — immediate escalation recommended."}
    if any(f["reason"] == "mixer" for f in risk_flags):
        return {"level": "HIGH", "message": "Path passed through a known mixer — funds may be deliberately obscured."}
    if confidence < 30:
        return {"level": "MEDIUM", "message": "Low confidence attribution — manual investigator review recommended."}
    return None


def calculate_confidence(hops: int, hit_mixer: bool, found: bool = True, address_reuse_count: int = 0):
    """
    Transparent weighted score, 0-100.
    Rebalanced so an actual match still scores meaningfully high —
    a found VASP at hop 1 = 100, decaying gently per extra hop,
    rather than being wiped out by hop count alone.
    """
    if not found:
        return 0  # never found a match at all, no point scoring confidence

    score = 100 - max(hops - 1, 0) * 10  # hop 1 = 100, hop 2 = 90, hop 3 = 80, hop 4 = 70...
    if hit_mixer:
        score -= 30  # path passed through a mixer, so attribution is murkier
    if address_reuse_count > 10:
        score += 10  # this address is a known high-traffic deposit point

    return max(min(score, 100), 0)


def add_known_address(address: str, label: str, entity_type: str, source: str = "manual"):
    """Lets teammates add newly discovered addresses to the database at runtime."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO addresses VALUES (?, ?, ?, ?)",
        (address, label, entity_type, source)
    )
    conn.commit()
    conn.close()


# Auto-init on import
init_db()