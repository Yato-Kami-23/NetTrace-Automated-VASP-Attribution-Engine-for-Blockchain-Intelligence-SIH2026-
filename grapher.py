"""
PERSON 2's FILE — Graph & Path Search
Uses NetworkX to walk the transaction graph outward (BFS) until it
finds an address that matches something in the labeled database.
This version is fully functional (not a stub) — it just depends on
fetch_transactions() and lookup_known_address() from the other files.
"""

import networkx as nx
from fetcher import fetch_transactions, reset_chain_failures
from attribution import lookup_known_address


def trace_path(start_address: str, max_hops: int = None, branch_limit: int = None,
                max_api_calls: int = 2000, stop_flag=None, progress_callback=None):
    """
    BFS outward from start_address, exploring ALL branches (not stopping
    at the first match) so every reachable VASP gets reported.

    max_hops: None = no hop limit.
    max_api_calls: safety ceiling.
    stop_flag: optional threading.Event — if set() while running, the
    search stops early and returns whatever it found so far.
    progress_callback: optional function(nodes_explored, current_address)
    called on every node visited, so a caller can show live progress.

    Returns: {
        matches: [ {found, path, hops, chain}, ... ],
        all_paths_explored: int,
        hit_mixer: bool,                # kept for backward compatibility
        mixer_hits: [ {address, label, hop, chain}, ... ],  # NEW: full detail
        stopped_early: bool
    }
    """
    visited = set()
    reset_chain_failures()
    queue = [(start_address, [start_address], 0, [])]
    matches = []
    mixer_hits = []  # NEW: records WHICH mixer, WHERE, and on what chain
    api_calls_made = 0
    paths_explored = 0
    stopped_early = False

    while queue:
        if stop_flag is not None and stop_flag.is_set():
            stopped_early = True
            break

        current, path, hops, chain_trail = queue.pop(0)

        if current in visited:
            continue
        if max_hops is not None and hops > max_hops:
            continue
        visited.add(current)
        paths_explored += 1

        if progress_callback:
            progress_callback(paths_explored, current)

        match = lookup_known_address(current)
        if match and current != start_address:
            if match["entity_type"] == "mixer":
                # NEW: record the specific mixer hit instead of just a flag
                mixer_hits.append({
                    "address": current,
                    "label": match["label"],
                    "hop": hops,
                    "chain": chain_trail[-1] if chain_trail else "unknown",
                    "path_to_mixer": path
                })
            else:
                matches.append({
                    "found": match,
                    "path": path,
                    "hops": hops,
                    "chain": chain_trail[-1] if chain_trail else "unknown",
                })
                continue

        if api_calls_made >= max_api_calls:
            break

        txs = fetch_transactions(current)
        api_calls_made += 1

        txs_to_follow = txs[:branch_limit] if branch_limit else txs
        for tx in txs_to_follow:
            if tx["to"] not in visited:
                queue.append((
                    tx["to"],
                    path + [tx["to"]],
                    hops + 1,
                    chain_trail + [tx["chain"]]
                ))

    return {
        "matches": matches,
        "all_paths_explored": paths_explored,
        "hit_mixer": len(mixer_hits) > 0,
        "mixer_hits": mixer_hits,
        "stopped_early": stopped_early
    }


def trace_nearest(start_address: str, max_hops: int = None, branch_limit: int = None,
                   max_api_calls: int = 2000, stop_flag=None, progress_callback=None):
    """Convenience wrapper — picks the lowest-hop match from the full trace."""
    result = trace_path(start_address, max_hops, branch_limit, max_api_calls, stop_flag, progress_callback)
    if not result["matches"]:
        return {
            "found": None,
            "path": [start_address],
            "hops": 0,
            "hit_mixer": result["hit_mixer"],
            "mixer_hits": result["mixer_hits"],
            "chain": None,
            "stopped_early": result["stopped_early"]
        }

    nearest = min(result["matches"], key=lambda m: m["hops"])
    nearest["hit_mixer"] = result["hit_mixer"]
    nearest["mixer_hits"] = result["mixer_hits"]
    nearest["stopped_early"] = result["stopped_early"]
    return nearest