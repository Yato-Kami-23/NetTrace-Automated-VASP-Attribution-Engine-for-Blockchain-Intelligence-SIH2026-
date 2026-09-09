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


def trace_path(start_address: str, max_hops: int = 4):
    """
    BFS outward from start_address. At each new address, check if it's
    a known labeled entity. Stop at first match.
    Returns: {found, path, hops, hit_mixer}
    """
    graph = nx.DiGraph()
    visited = set()
    queue = [(start_address, [start_address], 0)]
    hit_mixer = False

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

        txs = fetch_transactions(current)
        for tx in txs:
            graph.add_edge(tx["from"], tx["to"])
            if tx["to"] not in visited:
                queue.append((tx["to"], path + [tx["to"]], hops + 1))

    return {
        "found": None,
        "path": path,
        "hops": hops,
        "hit_mixer": hit_mixer
    }