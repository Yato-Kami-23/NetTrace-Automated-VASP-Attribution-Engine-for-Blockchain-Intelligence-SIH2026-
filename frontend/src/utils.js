export function shortenAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return addr.slice(0, 10) + "..." + addr.slice(-6);
}

export function mixerHitsOnPath(path, mixerHits) {
  const hits = mixerHits || [];
  const pathLower = {};
  for (let i = 0; i < (path || []).length; i++) {
    pathLower[path[i].toLowerCase()] = true;
  }
  const found = [];
  for (let i = 0; i < hits.length; i++) {
    if (pathLower[hits[i].address.toLowerCase()]) {
      found.push(hits[i]);
    }
  }
  return found;
}

export function isMixerAddress(addr, mixerHits) {
  const hits = mixerHits || [];
  const lower = (addr || "").toLowerCase();
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].address.toLowerCase() === lower) return true;
  }
  return false;
}

export function reportFileName(wallet) {
  const safe = (wallet || "wallet").trim();
  return "attribution_report_" + safe + ".txt";
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
