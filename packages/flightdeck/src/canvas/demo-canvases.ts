// Agent-drawn pages used by demo data. They are ordinary self-contained HTML,
// rendered through the same sandboxed host as live canvases.

const base = `
<style>
  :root { color-scheme: light; --fg:#16181c; --muted:#5b616b; --line:#e4e6ea; --ok:#1e7b4f; --wait:#94610a; --accent:#1d6ae0; }
  * { box-sizing: border-box; }
  body { margin:0; padding:22px 22px 32px; font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background:#fff; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
  .bar { display:flex; align-items:center; gap:12px; margin-bottom: 20px; }
  .track { flex:1; height:6px; border-radius: 3px; background:#eceef1; overflow:hidden; }
  .fill { height:100%; background: var(--ok); border-radius: 3px; }
  .count { font-weight: 650; font-variant-numeric: tabular-nums; font-size: 14px; }
  h2 { font-size: 13px; font-weight: 650; margin: 18px 0 8px; color: var(--fg); }
  .list { border:1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .row { display:flex; align-items:center; gap: 12px; padding: 9px 12px; border-top:1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .box { width:18px; height:18px; border-radius: 4px; border: 1.5px solid #c3c7cd; display:grid; place-items:center; flex: none; cursor: pointer; background: #fff; }
  .box.on { background: var(--ok); border-color: var(--ok); }
  .box.on::after { content:""; width: 9px; height: 5px; border: 2px solid #fff; border-top: 0; border-right: 0; transform: rotate(-45deg) translate(1px,-1px); }
  .label { flex:1; }
  .who { font-size: 11px; font-weight: 650; color: var(--accent); background: #e8f0fd; border-radius: 999px; padding: 2px 6px; }
  .checking { font-size: 12px; color: var(--wait); }
  .dash { color: #9aa0a8; }
  table { width:100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  th, td { text-align:left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; }
  .pass { color: var(--ok); font-weight: 600; } .run { color: var(--wait); font-weight: 600; } .fail { color: #c42d3a; font-weight: 600; }
</style>`;

const item = (label: string, state: "done" | "checking" | "open", who = "") =>
  `<div class="row"><span class="box${state === "done" ? " on" : ""}" role="checkbox" aria-checked="${state === "done"}" tabindex="0"></span><span class="label">${label}</span>${
    state === "done" ? `<span class="who">${who}</span>` : state === "checking" ? `<span class="checking">agent checking…</span>` : `<span class="dash">—</span>`
  }</div>`;

export const RELEASE_CHECKLIST_HTML = `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>
<h1>Release checklist · 0.8.8</h1>
<div class="sub">3 approvers · drawn by release-captain · items update live</div>
<div class="bar"><div class="track"><div class="fill" style="width:80.5%"></div></div><span class="count" id="count">33 of 41</span></div>
<h2>Tests</h2><div class="list">
${item("Unit tests (sdk)", "done", "MS")}${item("Unit tests (app)", "done", "MS")}${item("Local integration", "checking")}${item("Playwright e2e", "checking")}${item("Flaky tests quarantined", "open")}
</div>
<h2>Images</h2><div class="list">
${item("Azure Linux 3 starter image", "checking")}${item("Docker image signed", "done", "RK")}${item("SBOM published", "done", "RK")}
</div>
<h2>Docs</h2><div class="list">
${item("CHANGELOG has PR links", "done", "SL")}${item("Upgrade notes", "done", "SL")}${item("Portal guide screenshots", "open")}
</div>
<p class="sub" style="margin-top:18px">Read more in the <a href="https://github.com/microsoft/PilotSwarm/releases">release notes</a>.</p>
<script>
  document.querySelectorAll('.box').forEach(function (b) {
    b.addEventListener('click', function () {
      b.classList.toggle('on');
      var on = document.querySelectorAll('.box.on').length;
      document.getElementById('count').textContent = (on + 25) + ' of 41';
    });
  });
</script>
</body></html>`;

export const TEST_MATRIX_HTML = `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>
<h1>Test matrix</h1><div class="sub">9 suites · 3 platforms · updated by test-runner</div>
<table><thead><tr><th>Suite</th><th>Linux</th><th>macOS</th><th>Azure Linux 3</th><th>Duration</th></tr></thead><tbody>
<tr><td>sdk unit</td><td class="pass">pass</td><td class="pass">pass</td><td class="pass">pass</td><td>2m 14s</td></tr>
<tr><td>app unit</td><td class="pass">pass</td><td class="pass">pass</td><td class="pass">pass</td><td>48s</td></tr>
<tr><td>durability</td><td class="pass">pass</td><td class="pass">pass</td><td class="run">running</td><td>6m 02s</td></tr>
<tr><td>multi-worker</td><td class="pass">pass</td><td class="run">running</td><td class="run">queued</td><td>—</td></tr>
<tr><td>sub-agents</td><td class="pass">pass</td><td class="pass">pass</td><td class="run">queued</td><td>3m 40s</td></tr>
<tr><td>kv transport</td><td class="fail">1 failed</td><td class="pass">pass</td><td class="run">queued</td><td>1m 12s</td></tr>
</tbody></table></body></html>`;

export const P95_HTML = `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>
<h1>p95 latency by worker image</h1><div class="sub">chk cluster · last 2 hours · dashed line marks the rollout at 13:20</div>
<svg viewBox="0 0 560 220" width="100%" role="img" aria-label="p95 latency doubled after the 13:20 rollout">
  <g stroke="#eceef1">${[40, 80, 120, 160, 200].map((y) => `<line x1="40" x2="550" y1="${y}" y2="${y}"/>`).join("")}</g>
  <g fill="#5b616b" font-size="11">${["800ms", "600ms", "400ms", "200ms", "0"].map((t, i) => `<text x="0" y="${44 + i * 40}">${t}</text>`).join("")}</g>
  <line x1="300" x2="300" y1="20" y2="200" stroke="#5b616b" stroke-dasharray="4 4"/>
  <text x="306" y="32" font-size="11" fill="#5b616b">v0.8.6 rollout</text>
  <polyline fill="none" stroke="#1d6ae0" stroke-width="2" points="40,150 80,146 120,152 160,147 200,149 240,151 280,148 300,140 320,88 360,72 400,80 440,66 480,74 520,62 550,70"/>
</svg>
<table><thead><tr><th>Image</th><th>p50</th><th>p95</th><th>Error rate</th></tr></thead><tbody>
<tr><td>v0.8.5</td><td>112 ms</td><td>318 ms</td><td>0.08%</td></tr>
<tr><td>v0.8.6</td><td>131 ms</td><td>702 ms</td><td>0.11%</td></tr>
</tbody></table></body></html>`;
