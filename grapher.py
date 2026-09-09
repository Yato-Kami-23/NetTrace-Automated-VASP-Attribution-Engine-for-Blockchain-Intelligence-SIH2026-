"""
PERSON 2's FILE — Graph & Path Search
Uses NetworkX to walk the transaction graph outward (BFS) until it
finds an address that matches something in the labeled database.
This version is fully functional (not a stub) — it just depends on
fetch_transactions() and lookup_known_address() from the other files.
"""

import networkx as nx
from fetcher import fetch_transactions
from attribution import lookup_known_address


def trace_path(start_address: str, max_hops: int = 4, branch_limit: int = None, max_api_calls: int = 500):
    """
    BFS outward from start_address. At each new address, check if it's
    a known labeled entity. Stop at first match.

    branch_limit: None = follow all transactions found per address (no cap).
    max_api_calls: generous safety ceiling only, so a trace can never hang
    forever — not meant to actually be hit in normal use.

    Returns: {found, path, hops, hit_mixer}
    """
    graph = nx.DiGraph()
    visited = set()
    queue = [(start_address, [start_address], 0)]
    hit_mixer = False
    api_calls_made = 0

    while queue:
        current, path, hops = queue.pop(0)

        if current in visited or hops > max_hops:
            continue
        visited.add(current)

        match = lookup_known_address(current)
        if match and current != start_address:
            if match["entity_type"] == "mixer":
                hit_mixer = True
                # don't stop here — keep tracing past the mixer
            else:
                return {
                    "found": match,
                    "path": path,
                    "hops": hops,
                    "hit_mixer": hit_mixer
                }

        if api_calls_made >= max_api_calls:
            # Hit the safety ceiling — stop expanding further, return best-effort result
            break

        txs = fetch_transactions(current)
        api_calls_made += 1

        # Only follow the top `branch_limit` transactions from this address
        # if a limit is set — otherwise follow every transaction found
        txs_to_follow = txs[:branch_limit] if branch_limit else txs
        for tx in txs_to_follow:
            graph.add_edge(tx["from"], tx["to"])
            if tx["to"] not in visited:
                queue.append((tx["to"], path + [tx["to"]], hops + 1))

    return {
        "found": None,
        "path": path,
        "hops": hops,
        "hit_mixer": hit_mixer
    }