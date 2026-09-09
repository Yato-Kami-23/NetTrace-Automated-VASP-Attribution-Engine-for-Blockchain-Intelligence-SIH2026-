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

ETHERSCAN_API_KEY = "YOUR_ETHERIUM_KEY"
ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api"  # V2 endpoint (V1 was retired)
ETHERSCAN_CHAIN_ID = 1  # 1 = Ethereum mainnet (V2 is multichain, needs this param)
BLOCKSTREAM_BASE_URL = "https://blockstream.info/api"

# Tracks chains that have failed repeatedly during THIS run, so we stop
# wasting time retrying a chain that's clearly not responding (rate-limited,
# down, etc.) instead of hitting it again on every single hop.
_chain_failure_counts = {}
_disabled_chains = set()
FAILURE_THRESHOLD = 3  # after this many failures, stop trying that chain


def _record_chain_failure(chain_name: str):
    _chain_failure_counts[chain_name] = _chain_failure_counts.get(chain_name, 0) + 1
    if _chain_failure_counts[chain_name] >= FAILURE_THRESHOLD and chain_name not in _disabled_chains:
        _disabled_chains.add(chain_name)
        print(f"[fetcher] {chain_name} failed {FAILURE_THRESHOLD}+ times — skipping it for the rest of this trace.")


def reset_chain_failures():
    """Call this before starting a new trace, so a fresh run doesn't
    inherit skip-decisions from a previous trace."""
    _chain_failure_counts.clear()
    _disabled_chains.clear()


def fetch_transactions(address: str, chain: str = "auto"):
    """
    Returns a list of transactions FROM/TO the given address, normalized to:
    {from, to, amount, timestamp, tx_hash, chain}

    ETHEREUM ONLY for now — Bitcoin/BSC/Polygon support still exists in the
    functions below (call them directly via chain="btc"/"bsc"/"polygon" if
    needed) but "auto" is temporarily restricted to just Ethereum to keep
    trace times fast. Re-enable multi-chain fallback later by restoring
    the loop that was here.
    """
    if chain == "auto":
        if "Ethereum" in _disabled_chains:
            return []
        return _fetch_evm_transactions(address, 1, "Ethereum")
    elif chain == "eth":
        return _fetch_evm_transactions(address, 1, "Ethereum")
    elif chain == "bsc":
        return _fetch_evm_transactions(address, 56, "BNB Chain")
    elif chain == "polygon":
        return _fetch_evm_transactions(address, 137, "Polygon")
    elif chain == "btc":
        return _fetch_btc_transactions(address)
    else:
        raise ValueError(f"Unsupported chain: {chain}")


EVM_CHAINS = {
    1: "Ethereum",
    56: "BNB Chain",
    137: "Polygon",
}


def _fetch_evm_transactions(address: str, chain_id: int, chain_name: str, max_txs: int = 25):
    """Pulls transactions for an address on any EVM chain via Etherscan V2."""
    params = {
        "chainid": chain_id,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "sort": "desc",
        "page": 1,
        "offset": max_txs,
        "apikey": ETHERSCAN_API_KEY,
    }
    try:
        time.sleep(0.21)  # Etherscan free tier = 5 calls/sec max; 0.2s keeps us just under that
        resp = requests.get(ETHERSCAN_BASE_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        print(f"[fetcher] {chain_name} request failed for {address}: {e}")
        _record_chain_failure(chain_name)
        return []

    if data.get("status") != "1":
        return []

    txs = []
    for tx in data.get("result", []):
        if int(tx["value"]) == 0:
            continue
        if tx["from"].lower() == address.lower():
            other_party = tx["to"]
        elif tx["to"].lower() == address.lower():
            other_party = tx["from"]
        else:
            continue

        txs.append({
            "from": address,
            "to": other_party,
            "amount": int(tx["value"]) / 1e18,
            "timestamp": tx["timeStamp"],
            "tx_hash": tx["hash"],
            "chain": chain_name  # <-- tags which chain this transaction happened on
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
        _record_chain_failure("Bitcoin")
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
                    "chain": "Bitcoin"
                })
    return txs


def detect_chain(address: str) -> str:
    """Basic auto-detection of which chain an address belongs to."""
    if address.startswith("0x") and len(address) == 42:
        return "eth"
    if address.startswith(("1", "3", "bc1")):
        return "btc"
    return "unknown"
