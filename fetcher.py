"""
PERSON 1's FILE — Data Fetching Layer (REAL VERSION)
Fetches actual transaction history from public blockchain explorer APIs.

SETUP REQUIRED:
- Etherscan needs a free API key: https://etherscan.io/apis
  Sign up, generate a key, paste it into ETHERSCAN_API_KEY below.
- Blockstream (Bitcoin) needs NO key — fully open.
"""

import requests
import time

ETHERSCAN_API_KEY = "YOUR_ETHERSCAN_API_KEY_HERE"  # <-- paste your free key here
ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api"  # V2 endpoint (V1 was retired)
ETHERSCAN_CHAIN_ID = 1  # 1 = Ethereum mainnet (V2 is multichain, needs this param)
BLOCKSTREAM_BASE_URL = "https://blockstream.info/api"


def fetch_transactions(address: str, chain: str = "eth"):
    """
    Returns a list of transactions FROM the given address, normalized to:
    {from, to, amount, timestamp, tx_hash, chain}
    """
    if chain == "eth":
        return _fetch_eth_transactions(address)
    elif chain == "btc":
        return _fetch_btc_transactions(address)
    else:
        raise ValueError(f"Unsupported chain: {chain}")


def _fetch_eth_transactions(address: str, max_txs: int = 25):
    """Pulls normal ETH transactions for an address via Etherscan.
    Capped to the most recent max_txs to avoid exponential blowup
    when tracing multiple hops outward from a busy wallet."""
    params = {
        "chainid": ETHERSCAN_CHAIN_ID,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "sort": "desc",  # newest first, so the cap keeps the most recent activity
        "page": 1,
        "offset": max_txs,  # tells Etherscan to only return this many results
        "apikey": ETHERSCAN_API_KEY,
    }
    try:
        time.sleep(0.25)  # stay under Etherscan's 5 calls/sec free-tier limit
        resp = requests.get(ETHERSCAN_BASE_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        print(f"[fetcher] Etherscan request failed for {address}: {e}")
        return []

    if data.get("status") != "1":
        # status "0" means no transactions found or an API error/rate-limit
        return []

    txs = []
    for tx in data.get("result", []):
        # Skip zero-value transactions with no meaningful transfer
        # (these are often on-chain messages/spam, not real fund movement)
        if int(tx["value"]) == 0:
            continue

        # Determine which side is "this address" and follow the OTHER side —
        # money can arrive at a wallet too, and for investigation purposes
        # we still want to see who it's connected to, not just outgoing sends
        if tx["from"].lower() == address.lower():
            other_party = tx["to"]
        elif tx["to"].lower() == address.lower():
            other_party = tx["from"]
        else:
            continue  # shouldn't happen, but skip defensively

        txs.append({
            "from": address,
            "to": other_party,
            "amount": int(tx["value"]) / 1e18,  # wei -> ETH
            "timestamp": tx["timeStamp"],
            "tx_hash": tx["hash"],
            "chain": "eth"
        })
    return txs


def _fetch_btc_transactions(address: str):
    """Pulls BTC transactions for an address via Blockstream (no API key needed)."""
    url = f"{BLOCKSTREAM_BASE_URL}/address/{address}/txs"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        print(f"[fetcher] Blockstream request failed for {address}: {e}")
        return []

    txs = []
    for tx in data:
        tx_hash = tx.get("txid")
        timestamp = tx.get("status", {}).get("block_time", None)
        # Bitcoin transactions can have multiple outputs (recipients) —
        # walk each output that isn't change back to this same address
        for vout in tx.get("vout", []):
            recipient = vout.get("scriptpubkey_address")
            amount_sats = vout.get("value", 0)
            if recipient and recipient != address:
                txs.append({
                    "from": address,
                    "to": recipient,
                    "amount": amount_sats / 1e8,  # sats -> BTC
                    "timestamp": timestamp,
                    "tx_hash": tx_hash,
                    "chain": "btc"
                })
    return txs


def detect_chain(address: str) -> str:
    """Basic auto-detection of which chain an address belongs to."""
    if address.startswith("0x") and len(address) == 42:
        return "eth"
    if address.startswith(("1", "3", "bc1")):
        return "btc"
    return "unknown"