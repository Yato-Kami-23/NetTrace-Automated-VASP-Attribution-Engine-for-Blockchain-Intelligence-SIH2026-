const API_BASE = "";

async function readJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function startTrace(address, maxHops) {
  const res = await fetch(API_BASE + "/trace/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address, max_hops: maxHops }),
  });
  return readJson(res);
}

export async function getTraceStatus(jobId) {
  const res = await fetch(API_BASE + "/trace/status/" + encodeURIComponent(jobId));
  return readJson(res);
}

export async function stopTrace(jobId) {
  const res = await fetch(API_BASE + "/trace/stop/" + encodeURIComponent(jobId), {
    method: "POST",
  });
  return readJson(res);
}
