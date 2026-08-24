// Boot: check /api/health and reflect it in the footer. No framework, no build step.

async function boot() {
  const el = document.getElementById("health-status");
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    el.textContent = `model: ${data.model ?? "none"} · key: ${data.keyPresent ? "present" : "missing"}`;
  } catch (err) {
    el.textContent = "health unreachable";
  }
}

boot();
